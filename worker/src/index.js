/**
 * 城科卷王 - 多端同步 & 排行榜 API Worker
 *
 * API 端点：
 *   POST /api/register      - 注册用户（生成同步码）
 *   POST /api/bind          - 绑定设备到已有同步码
 *   GET  /api/user/:did     - 通过设备ID查询用户
 *   POST /api/sync          - 同步答题数据
 *   POST /api/settings      - 同步设置
 *   POST /api/progress      - 同步进度
 *   GET  /api/cloud-data/:did - 获取云端设置+进度
 *   GET  /api/leaderboard   - 排行榜
 */

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function json(data, status = 200, origin = '*') {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
    });
}

function error(msg, status = 400, origin = '*') {
    return json({ error: msg }, status, origin);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const origin = request.headers.get('Origin') || '';

        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        try {
            // POST /api/register
            if (method === 'POST' && path === '/api/register') {
                return await handleRegister(request, env, origin);
            }

            // POST /api/bind
            if (method === 'POST' && path === '/api/bind') {
                return await handleBind(request, env, origin);
            }

            // GET /api/user/:did
            if (method === 'GET' && path.startsWith('/api/user/')) {
                const did = path.split('/api/user/')[1];
                return await handleGetUser(did, env, origin);
            }

            // POST /api/sync
            if (method === 'POST' && path === '/api/sync') {
                return await handleSync(request, env, origin);
            }

            // POST /api/settings
            if (method === 'POST' && path === '/api/settings') {
                return await handleSyncSettings(request, env, origin);
            }

            // POST /api/progress
            if (method === 'POST' && path === '/api/progress') {
                return await handleSyncProgress(request, env, origin);
            }

            // GET /api/cloud-data/:did
            if (method === 'GET' && path.startsWith('/api/cloud-data/')) {
                const did = path.split('/api/cloud-data/')[1];
                return await handleGetCloudData(did, env, origin);
            }

            // GET /api/leaderboard
            if (method === 'GET' && path === '/api/leaderboard') {
                return await handleLeaderboard(url, env, origin);
            }

            return error('Not Found', 404, origin);
        } catch (e) {
            console.error('Worker error:', e);
            return error('Internal Server Error', 500, origin);
        }
    }
};

// ========== 生成同步码（6位大写字母+数字，排除易混淆字符） ==========
function generateSyncCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除 I,O,0,1
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// ========== 注册用户 ==========
async function handleRegister(request, env, origin) {
    const body = await request.json();
    const { deviceId, initials } = body;

    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
        return error('无效的设备ID', 400, origin);
    }
    if (!initials || typeof initials !== 'string' || initials.length < 1 || initials.length > 4) {
        return error('姓名首字母需1-4个字符', 400, origin);
    }

    // 检查设备是否已绑定
    const existingDevice = await env.DB.prepare(
        'SELECT user_id FROM devices WHERE device_id = ?'
    ).bind(deviceId).first();

    if (existingDevice) {
        const user = await env.DB.prepare(
            'SELECT id, initials FROM users WHERE id = ?'
        ).bind(existingDevice.user_id).first();
        return json({ ok: true, message: '已注册', syncCode: user.id, initials: user.initials }, 200, origin);
    }

    // 生成唯一同步码（最多尝试10次）
    let syncCode;
    for (let i = 0; i < 10; i++) {
        syncCode = generateSyncCode();
        const exists = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(syncCode).first();
        if (!exists) break;
        if (i === 9) return error('生成同步码失败，请重试', 500, origin);
    }

    const now = new Date().toISOString();

    // 创建用户
    await env.DB.prepare(
        'INSERT INTO users (id, initials, created_at, created_device) VALUES (?, ?, ?, ?)'
    ).bind(syncCode, initials.trim().toUpperCase(), now, deviceId).run();

    // 绑定设备
    await env.DB.prepare(
        'INSERT INTO devices (device_id, user_id, bound_at) VALUES (?, ?, ?)'
    ).bind(deviceId, syncCode, now).run();

    return json({ ok: true, syncCode, initials: initials.trim().toUpperCase() }, 201, origin);
}

// ========== 绑定设备到已有同步码 ==========
async function handleBind(request, env, origin) {
    const body = await request.json();
    const { deviceId, syncCode, localStats } = body;

    if (!deviceId || !syncCode) {
        return error('缺少必要参数', 400, origin);
    }

    const code = syncCode.trim().toUpperCase();

    // 验证同步码存在
    const user = await env.DB.prepare(
        'SELECT id, initials FROM users WHERE id = ?'
    ).bind(code).first();

    if (!user) {
        return error('同步码不存在，请检查后重试', 404, origin);
    }

    // 检查设备是否已绑定其他账号
    const existing = await env.DB.prepare(
        'SELECT user_id FROM devices WHERE device_id = ?'
    ).bind(deviceId).first();

    if (existing && existing.user_id !== code) {
        // 解绑旧账号（不删除数据）
        await env.DB.prepare('DELETE FROM devices WHERE device_id = ?').bind(deviceId).run();
    }

    // 绑定设备
    const now = new Date().toISOString();
    await env.DB.prepare(
        'INSERT OR REPLACE INTO devices (device_id, user_id, bound_at) VALUES (?, ?, ?)'
    ).bind(deviceId, code, now).run();

    // 合并本地答题数据到云端
    if (localStats && Array.isArray(localStats)) {
        for (const stat of localStats) {
            if (!stat.bankId) continue;
            await env.DB.prepare(`
                INSERT INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, bank_id) DO UPDATE SET
                    answered = stats.answered + excluded.answered,
                    correct = stats.correct + excluded.correct,
                    duration = stats.duration + excluded.duration,
                    updated_at = excluded.updated_at
            `).bind(code, stat.bankId, stat.bankName || '', stat.answered || 0, stat.correct || 0, stat.duration || 0, now).run();
        }
    }

    return json({ ok: true, syncCode: code, initials: user.initials }, 200, origin);
}

// ========== 查询用户 ==========
async function handleGetUser(did, env, origin) {
    const device = await env.DB.prepare(
        'SELECT user_id FROM devices WHERE device_id = ?'
    ).bind(did).first();

    if (!device) {
        return json({ ok: false, registered: false }, 200, origin);
    }

    const user = await env.DB.prepare(
        'SELECT id, initials, created_at FROM users WHERE id = ?'
    ).bind(device.user_id).first();

    return json({ ok: true, registered: true, user: { syncCode: user.id, initials: user.initials } }, 200, origin);
}

// ========== 同步答题数据 ==========
async function handleSync(request, env, origin) {
    const body = await request.json();
    const { deviceId, bankId, bankName, answered, correct, duration } = body;

    if (!deviceId || !bankId) {
        return error('缺少必要参数', 400, origin);
    }

    const userId = await resolveUser(deviceId, env);
    if (!userId) return error('设备未注册', 400, origin);

    const now = new Date().toISOString();
    await env.DB.prepare(`
        INSERT INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, bank_id) DO UPDATE SET
            answered = stats.answered + excluded.answered,
            correct = stats.correct + excluded.correct,
            duration = stats.duration + excluded.duration,
            bank_name = excluded.bank_name,
            updated_at = excluded.updated_at
    `).bind(userId, bankId, bankName || '', answered || 0, correct || 0, duration || 0, now).run();

    return json({ ok: true }, 200, origin);
}

// ========== 同步设置 ==========
async function handleSyncSettings(request, env, origin) {
    const body = await request.json();
    const { deviceId, settings } = body;

    if (!deviceId || !settings) return error('缺少参数', 400, origin);

    const userId = await resolveUser(deviceId, env);
    if (!userId) return error('设备未注册', 400, origin);

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE users SET settings = ?, last_sync_at = ? WHERE id = ?'
    ).bind(JSON.stringify(settings), now, userId).run();

    return json({ ok: true }, 200, origin);
}

// ========== 同步进度 ==========
async function handleSyncProgress(request, env, origin) {
    const body = await request.json();
    const { deviceId, progress } = body;

    if (!deviceId || !progress) return error('缺少参数', 400, origin);

    const userId = await resolveUser(deviceId, env);
    if (!userId) return error('设备未注册', 400, origin);

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE users SET progress = ?, last_sync_at = ? WHERE id = ?'
    ).bind(JSON.stringify(progress), now, userId).run();

    return json({ ok: true }, 200, origin);
}

// ========== 获取云端数据 ==========
async function handleGetCloudData(did, env, origin) {
    const userId = await resolveUser(did, env);
    if (!userId) return json({ ok: false }, 200, origin);

    const user = await env.DB.prepare(
        'SELECT settings, progress, last_sync_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) return json({ ok: false }, 200, origin);

    let settings = {};
    let progress = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch {}
    try { progress = JSON.parse(user.progress || '{}'); } catch {}

    return json({
        ok: true,
        settings,
        progress,
        lastSyncAt: user.last_sync_at
    }, 200, origin);
}

// ========== 排行榜 ==========
async function handleLeaderboard(url, env, origin) {
    const sort = url.searchParams.get('sort') || 'answered';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const deviceId = url.searchParams.get('deviceId') || '';

    const sortMap = {
        'answered': 'total_answered DESC',
        'accuracy': 'CASE WHEN total_answered > 0 THEN CAST(total_correct AS REAL) / total_answered ELSE 0 END DESC',
        'duration': 'total_duration DESC'
    };
    const orderBy = sortMap[sort] || sortMap['answered'];

    const { results } = await env.DB.prepare(`
        SELECT 
            u.id as sync_code,
            u.initials,
            SUM(s.answered) as total_answered,
            SUM(s.correct) as total_correct,
            SUM(s.duration) as total_duration,
            MAX(s.updated_at) as last_active
        FROM users u
        INNER JOIN stats s ON u.id = s.user_id
        GROUP BY u.id
        ORDER BY ${orderBy}
        LIMIT ?
    `).bind(limit).all();

    const leaderboard = results.map((row, index) => ({
        rank: index + 1,
        syncCode: row.sync_code,
        initials: row.initials,
        answered: row.total_answered,
        correct: row.total_correct,
        accuracy: row.total_answered > 0
            ? Math.round((row.total_correct / row.total_answered) * 100)
            : 0,
        duration: row.total_duration,
        lastActive: row.last_active
    }));

    // 查当前用户
    let currentUser = null;
    if (deviceId) {
        const userId = await resolveUser(deviceId, env);
        if (userId) {
            const idx = leaderboard.findIndex(r => r.syncCode === userId);
            if (idx >= 0) {
                currentUser = leaderboard[idx];
            } else {
                const userStats = await env.DB.prepare(`
                    SELECT SUM(answered) as ta, SUM(correct) as tc, SUM(duration) as td
                    FROM stats WHERE user_id = ?
                `).bind(userId).first();

                if (userStats && userStats.ta > 0) {
                    const rankResult = await env.DB.prepare(`
                        SELECT COUNT(*) + 1 as rank FROM (
                            SELECT SUM(answered) as total FROM stats GROUP BY user_id
                            HAVING total > ?
                        )
                    `).bind(userStats.ta).first();

                    const user = await env.DB.prepare('SELECT initials FROM users WHERE id = ?').bind(userId).first();
                    currentUser = {
                        rank: rankResult?.rank || '-',
                        syncCode: userId,
                        initials: user?.initials || '',
                        answered: userStats.ta,
                        correct: userStats.tc,
                        accuracy: Math.round((userStats.tc / userStats.ta) * 100),
                        duration: userStats.td
                    };
                }
            }
        }
    }

    return json({ ok: true, leaderboard, currentUser }, 200, origin);
}

// ========== 工具函数：设备ID → 用户ID ==========
async function resolveUser(deviceId, env) {
    const device = await env.DB.prepare(
        'SELECT user_id FROM devices WHERE device_id = ?'
    ).bind(deviceId).first();
    return device?.user_id || null;
}
