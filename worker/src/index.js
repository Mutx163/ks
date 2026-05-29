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

            // ========== 管理员接口 ==========

            // GET /api/admin/users?syncCode=xxx
            if (method === 'GET' && path === '/api/admin/users') {
                return await handleAdminUsers(url, env, origin);
            }

            // POST /api/admin/delete-user
            if (method === 'POST' && path === '/api/admin/delete-user') {
                return await handleAdminDeleteUser(request, env, origin);
            }

            // POST /api/admin/reset-stats
            if (method === 'POST' && path === '/api/admin/reset-stats') {
                return await handleAdminResetStats(request, env, origin);
            }

            // GET /api/admin/user-detail/:id
            if (method === 'GET' && path.startsWith('/api/admin/user-detail/')) {
                const uid = path.split('/api/admin/user-detail/')[1];
                const deviceId = url.searchParams.get('deviceId') || '';
                const password = url.searchParams.get('password') || '';
                const admin = await requireAdmin(deviceId, password, env);
                if (!admin) return error('无权限', 403, origin);
                return await handleAdminUserDetail(uid, env, origin);
            }

            // POST /api/admin/update-user
            if (method === 'POST' && path === '/api/admin/update-user') {
                return await handleAdminUpdateUser(request, env, origin);
            }

            // POST /api/admin/ban-user
            if (method === 'POST' && path === '/api/admin/ban-user') {
                return await handleAdminBanUser(request, env, origin);
            }

            // GET /api/admin/banks
            if (method === 'GET' && path === '/api/admin/banks') {
                return await handleAdminBanks(url, env, origin);
            }

            // GET /api/admin/activity
            if (method === 'GET' && path === '/api/admin/activity') {
                return await handleAdminActivity(url, env, origin);
            }

            // GET /api/admin/overview
            if (method === 'GET' && path === '/api/admin/overview') {
                return await handleAdminOverview(url, env, origin);
            }

            // POST /api/admin/announce
            if (method === 'POST' && path === '/api/admin/announce') {
                return await handleAdminAnnounce(request, env, origin);
            }

            // GET /api/admin/announcements
            if (method === 'GET' && path === '/api/admin/announcements') {
                return await handleAdminListAnnouncements(url, env, origin);
            }

            // POST /api/admin/delete-announcement
            if (method === 'POST' && path === '/api/admin/delete-announcement') {
                return await handleAdminDeleteAnnouncement(request, env, origin);
            }

            // POST /api/admin/adjust-stats
            if (method === 'POST' && path === '/api/admin/adjust-stats') {
                return await handleAdminAdjustStats(request, env, origin);
            }

            // POST /api/admin/change-sync-code
            if (method === 'POST' && path === '/api/admin/change-sync-code') {
                return await handleAdminChangeSyncCode(request, env, origin);
            }

            // POST /api/admin/remove-device
            if (method === 'POST' && path === '/api/admin/remove-device') {
                return await handleAdminRemoveDevice(request, env, origin);
            }

            // GET /api/admin/user-cloud-data/:id
            if (method === 'GET' && path.startsWith('/api/admin/user-cloud-data/')) {
                const uid = path.split('/api/admin/user-cloud-data/')[1];
                return await handleAdminUserCloudData(uid, url, env, origin);
            }

            // GET /api/announce
            if (method === 'GET' && path === '/api/announce') {
                return await handleGetAnnounce(env, origin);
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
        // 已绑定：更新姓名首字母
        await env.DB.prepare(
            'UPDATE users SET initials = ? WHERE id = ?'
        ).bind(initials.trim().toUpperCase(), existingDevice.user_id).run();
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

// 管理员密码（SHA-256 哈希）
const ADMIN_PASSWORD_HASH = 'c014d32d3686385fd8287ed5c61374fae42ab80342105ece72930d5c8f9c6065';

async function sha256(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========== 工具函数：验证管理员 ==========
async function requireAdmin(deviceId, password, env) {
    if (!deviceId || !password) return null;
    if (await sha256(password) !== ADMIN_PASSWORD_HASH) return null;
    const userId = await resolveUser(deviceId, env);
    if (!userId) return null;
    const user = await env.DB.prepare(
        'SELECT id, initials, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
    return user?.is_admin ? user : null;
}

// ========== 管理员：查看所有用户 ==========
async function handleAdminUsers(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const { results } = await env.DB.prepare(`
        SELECT 
            u.id, u.initials, u.created_at, u.is_admin,
            (SELECT COUNT(*) FROM devices WHERE user_id = u.id) as device_count,
            COALESCE(SUM(s.answered), 0) as total_answered,
            COALESCE(SUM(s.correct), 0) as total_correct,
            COALESCE(SUM(s.duration), 0) as total_duration
        FROM users u
        LEFT JOIN stats s ON u.id = s.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `).all();

    return json({ ok: true, users: results }, 200, origin);
}

// ========== 管理员：查看用户详情 ==========
async function handleAdminUserDetail(userId, env, origin) {
    // 注意：此函数不验证密码，由调用方保证
    const user = await env.DB.prepare(
        'SELECT id, initials, created_at, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
    if (!user) return error('用户不存在', 404, origin);

    const devices = await env.DB.prepare(
        'SELECT device_id, bound_at FROM devices WHERE user_id = ?'
    ).bind(userId).all();

    const stats = await env.DB.prepare(
        'SELECT bank_id, bank_name, answered, correct, duration, updated_at FROM stats WHERE user_id = ?'
    ).bind(userId).all();

    return json({ ok: true, user, devices: devices.results, stats: stats.results }, 200, origin);
}

// ========== 管理员：删除用户 ==========
async function handleAdminDeleteUser(request, env, origin) {
    const body = await request.json();
    const { deviceId, targetUserId, password } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (targetUserId === admin.id) return error('不能删除自己', 400, origin);

    await env.DB.prepare('DELETE FROM stats WHERE user_id = ?').bind(targetUserId).run();
    await env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(targetUserId).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();

    return json({ ok: true, message: '已删除' }, 200, origin);
}

// ========== 管理员：重置用户数据 ==========
async function handleAdminResetStats(request, env, origin) {
    const body = await request.json();
    const { deviceId, targetUserId, password } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    await env.DB.prepare('DELETE FROM stats WHERE user_id = ?').bind(targetUserId).run();

    return json({ ok: true, message: '数据已重置' }, 200, origin);
}

// ========== 管理员：修改用户信息 ==========
async function handleAdminUpdateUser(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetUserId, initials, isAdmin } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const updates = [];
    const params = [];
    if (initials) { updates.push('initials = ?'); params.push(initials.trim().toUpperCase()); }
    if (isAdmin !== undefined) { updates.push('is_admin = ?'); params.push(isAdmin ? 1 : 0); }
    if (updates.length === 0) return error('无更新内容', 400, origin);

    params.push(targetUserId);
    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    return json({ ok: true, message: '已更新' }, 200, origin);
}

// ========== 管理员：封禁/解封用户 ==========
async function handleAdminBanUser(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetUserId, banned } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (targetUserId === admin.id) return error('不能封禁自己', 400, origin);

    await env.DB.prepare('UPDATE users SET banned = ? WHERE id = ?').bind(banned ? 1 : 0, targetUserId).run();

    return json({ ok: true, message: banned ? '已封禁' : '已解封' }, 200, origin);
}

// ========== 管理员：题库统计 ==========
async function handleAdminBanks(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const { results } = await env.DB.prepare(`
        SELECT 
            bank_id,
            bank_name,
            COUNT(DISTINCT user_id) as user_count,
            SUM(answered) as total_answered,
            SUM(correct) as total_correct,
            SUM(duration) as total_duration
        FROM stats
        GROUP BY bank_id
        ORDER BY total_answered DESC
    `).all();

    return json({ ok: true, banks: results }, 200, origin);
}

// ========== 管理员：最近活跃 ==========
async function handleAdminActivity(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const { results } = await env.DB.prepare(`
        SELECT 
            u.id, u.initials,
            s.bank_name,
            s.answered, s.correct, s.duration,
            s.updated_at
        FROM stats s
        JOIN users u ON s.user_id = u.id
        WHERE s.updated_at IS NOT NULL AND s.updated_at != ''
        ORDER BY s.updated_at DESC
        LIMIT 50
    `).all();

    return json({ ok: true, activity: results }, 200, origin);
}

// ========== 管理员：系统概览 ==========
async function handleAdminOverview(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    // 今日注册
    const today = new Date().toISOString().slice(0, 10);
    const todayReg = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE created_at LIKE ?"
    ).bind(today + '%').first();

    // 今日活跃（有更新记录的）
    const todayActive = await env.DB.prepare(
        "SELECT COUNT(DISTINCT user_id) as cnt FROM stats WHERE updated_at LIKE ?"
    ).bind(today + '%').first();

    // 总题库数
    const bankCount = await env.DB.prepare(
        'SELECT COUNT(DISTINCT bank_id) as cnt FROM stats'
    ).first();

    // 封禁用户数
    const bannedCount = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM users WHERE banned = 1'
    ).first();

    // 最近7天注册趋势
    const weekTrend = await env.DB.prepare(`
        SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as cnt
        FROM users
        WHERE created_at >= DATE('now', '-7 days')
        GROUP BY day
        ORDER BY day
    `).all();

    return json({
        ok: true,
        overview: {
            todayReg: todayReg?.cnt || 0,
            todayActive: todayActive?.cnt || 0,
            bankCount: bankCount?.cnt || 0,
            bannedCount: bannedCount?.cnt || 0,
            weekTrend: weekTrend?.results || []
        }
    }, 200, origin);
}

// ========== 管理员：发布公告 ==========
async function handleAdminAnnounce(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, content } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!content || content.length > 500) return error('公告内容1-500字', 400, origin);

    await env.DB.prepare(
        'INSERT INTO announcements (content, created_at) VALUES (?, ?)'
    ).bind(content.trim(), new Date().toISOString()).run();

    return json({ ok: true, message: '已发布' }, 200, origin);
}

// ========== 公开：获取最新公告 ==========
async function handleGetAnnounce(env, origin) {
    const announce = await env.DB.prepare(
        'SELECT id, content, created_at FROM announcements ORDER BY id DESC LIMIT 1'
    ).first();

    return json({ ok: true, announce }, 200, origin);
}

// ========== 管理员：公告列表 ==========
async function handleAdminListAnnouncements(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId');
    const password = url.searchParams.get('password');
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const rows = await env.DB.prepare(
        'SELECT id, content, created_at FROM announcements ORDER BY id DESC LIMIT 50'
    ).all();

    return json({ ok: true, announcements: rows.results || [] }, 200, origin);
}

// ========== 管理员：删除公告 ==========
async function handleAdminDeleteAnnouncement(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, id } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!id) return error('缺少 id', 400, origin);

    await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, origin);
}

// ========== 管理员：手动调整用户数据 ==========
async function handleAdminAdjustStats(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetUserId, bankId, bankName, answered, correct, duration } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!targetUserId || !bankId) return error('缺少参数', 400, origin);
    if (answered !== undefined && (typeof answered !== 'number' || answered < 0)) return error('answered 必须为非负数', 400, origin);
    if (correct !== undefined && (typeof correct !== 'number' || correct < 0)) return error('correct 必须为非负数', 400, origin);
    if (duration !== undefined && (typeof duration !== 'number' || duration < 0)) return error('duration 必须为非负数', 400, origin);

    const now = new Date().toISOString();
    await env.DB.prepare(`
        INSERT INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, bank_id) DO UPDATE SET
            answered = stats.answered + excluded.answered,
            correct = stats.correct + excluded.correct,
            duration = stats.duration + excluded.duration,
            updated_at = excluded.updated_at
    `).bind(targetUserId, bankId, bankName || '', answered || 0, correct || 0, duration || 0, now).run();

    return json({ ok: true, message: '已调整' }, 200, origin);
}

// ========== 管理员：修改同步码 ==========
async function handleAdminChangeSyncCode(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetUserId, newSyncCode } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!targetUserId || !newSyncCode) return error('缺少参数', 400, origin);
    if (newSyncCode.length < 4 || newSyncCode.length > 8) return error('同步码4-8位', 400, origin);

    const code = newSyncCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) return error('同步码仅支持大写字母和数字', 400, origin);

    // 检查新同步码是否已存在
    const exists = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(code).first();
    if (exists) return error('该同步码已被使用', 400, origin);

    // 更新 users 表
    await env.DB.prepare('UPDATE users SET id = ? WHERE id = ?').bind(code, targetUserId).run();
    // 更新 devices 表
    await env.DB.prepare('UPDATE devices SET user_id = ? WHERE user_id = ?').bind(code, targetUserId).run();
    // 更新 stats 表
    await env.DB.prepare('UPDATE stats SET user_id = ? WHERE user_id = ?').bind(code, targetUserId).run();

    return json({ ok: true, message: '同步码已修改', newCode: code }, 200, origin);
}

// ========== 管理员：解绑设备 ==========
async function handleAdminRemoveDevice(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetDeviceId } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!targetDeviceId) return error('缺少参数', 400, origin);

    // 检查设备是否存在
    const dev = await env.DB.prepare('SELECT user_id FROM devices WHERE device_id = ?').bind(targetDeviceId).first();
    if (!dev) return error('设备不存在', 404, origin);
    // 检查用户是否还有其他设备
    const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM devices WHERE user_id = ?').bind(dev.user_id).first();
    if (count.cnt <= 1) return error('该用户只有一个设备，无法解绑', 400, origin);

    await env.DB.prepare('DELETE FROM devices WHERE device_id = ?').bind(targetDeviceId).run();

    return json({ ok: true, message: '设备已解绑' }, 200, origin);
}

// ========== 管理员：查看用户云端数据 ==========
async function handleAdminUserCloudData(userId, url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const user = await env.DB.prepare(
        'SELECT id, initials, settings, progress, last_sync_at FROM users WHERE id = ?'
    ).bind(userId).first();
    if (!user) return error('用户不存在', 404, origin);

    let settings = {}, progress = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch {}
    try { progress = JSON.parse(user.progress || '{}'); } catch {}

    return json({ ok: true, user: { id: user.id, initials: user.initials, lastSyncAt: user.last_sync_at }, settings, progress }, 200, origin);
}
