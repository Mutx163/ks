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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Admin-Device-Id',
        'Access-Control-Max-Age': '86400'
    };
}

function json(data, status = 200, origin = '*', cacheMaxAge = 0) {
    const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };
    if (cacheMaxAge > 0) {
        headers['Cache-Control'] = `public, max-age=${cacheMaxAge}`;
    } else {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
    }
    return new Response(JSON.stringify(data), { status, headers });
}

function error(msg, status = 400, origin = '*') {
    return json({ error: msg }, status, origin);
}

function streamText(stream, origin = '*') {
    return new Response(stream, {
        headers: {
            ...corsHeaders(origin),
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const origin = request.headers.get('Origin') || '';

        // 支持管理员密码通过 Header 传递（避免暴露在 URL query string）
        if (method === 'GET' && path.startsWith('/api/admin')) {
            const pwd = request.headers.get('X-Admin-Password');
            if (pwd) url.searchParams.set('password', pwd);
            const did = request.headers.get('X-Admin-Device-Id');
            if (did) url.searchParams.set('deviceId', did);
        }

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

            // POST /api/bookmarks
            if (method === 'POST' && path === '/api/bookmarks') {
                return await handleSyncBookmarks(request, env, origin);
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

            // GET /api/ai/config（公开：AI 解读配置，不返回后台密钥）
            if (method === 'GET' && path === '/api/ai/config') {
                return await handleGetAIConfig(env, origin);
            }

            // POST /api/ai/explain（网页内 AI 流式解读）
            if (method === 'POST' && path === '/api/ai/explain') {
                return await handleAIExplain(request, env, origin);
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

            // POST /api/admin/batch-ban
            if (method === 'POST' && path === '/api/admin/batch-ban') {
                return await handleAdminBatchBan(request, env, origin);
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

            // GET /api/admin/ai-config
            if (method === 'GET' && path === '/api/admin/ai-config') {
                return await handleAdminGetAIConfig(url, env, origin);
            }

            // PUT /api/admin/ai-config
            if (method === 'PUT' && path === '/api/admin/ai-config') {
                return await handleAdminUpdateAIConfig(request, env, origin);
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

            // POST /api/admin/edit-announcement
            if (method === 'POST' && path === '/api/admin/edit-announcement') {
                return await handleAdminEditAnnouncement(request, env, origin);
            }

            // POST /api/admin/import-bank
            if (method === 'POST' && path === '/api/admin/import-bank') {
                return await handleAdminImportBank(request, env, origin);
            }

            // POST /api/admin/upload-bank（前端题库上传接口）
            if (method === 'POST' && path === '/api/admin/upload-bank') {
                return await handleAdminUploadBank(request, env, origin);
            }

            // GET /api/admin/bank/:id/history（必须在 :id 前面）
            if (method === 'GET' && path.match(/\/api\/admin\/bank\/[^/]+\/history$/)) {
                const bankId = path.split('/api/admin/bank/')[1].split('/')[0];
                return await handleAdminBankHistory(bankId, url, env, origin);
            }

            // GET /api/admin/bank/:id
            if (method === 'GET' && path.startsWith('/api/admin/bank/')) {
                const bankId = path.split('/api/admin/bank/')[1];
                return await handleAdminGetBank(bankId, url, env, origin);
            }

            // POST /api/admin/bank/:id/import-questions
            if (method === 'POST' && path.match(/\/api\/admin\/bank\/[^/]+\/import-questions$/)) {
                const bankId = path.split('/api/admin/bank/')[1].split('/')[0];
                return await handleAdminImportQuestions(bankId, request, env, origin);
            }

            // POST /api/admin/bank/:id/question
            if (method === 'POST' && path.match(/\/api\/admin\/bank\/[^/]+\/question$/)) {
                const bankId = path.split('/api/admin/bank/')[1].split('/')[0];
                return await handleAdminAddQuestion(bankId, request, env, origin);
            }

            // PUT /api/admin/bank/:id/question/:qid
            if (method === 'PUT' && path.match(/\/api\/admin\/bank\/[^/]+\/question\/\d+$/)) {
                const parts = path.split('/');
                const bankId = parts[4];
                const qid = parseInt(parts[6]);
                return await handleAdminEditQuestion(bankId, qid, request, env, origin);
            }

            // DELETE /api/admin/bank/:id/question/:qid
            if (method === 'DELETE' && path.match(/\/api\/admin\/bank\/[^/]+\/question\/\d+$/)) {
                const parts = path.split('/');
                const bankId = parts[4];
                const qid = parseInt(parts[6]);
                return await handleAdminDeleteQuestion(bankId, qid, request, env, origin);
            }

            // PUT /api/admin/bank/:id/settings（更新题库设置）
            if (method === 'PUT' && path.match(/\/api\/admin\/bank\/[^/]+\/settings$/)) {
                const bankId = path.split('/api/admin/bank/')[1].split('/')[0];
                return await handleAdminUpdateBankSettings(bankId, request, env, origin);
            }

            // PUT /api/admin/bank/:id/toggle（启用/禁用题库）
            if (method === 'PUT' && path.match(/\/api\/admin\/bank\/[^/]+\/toggle$/)) {
                const bankId = path.split('/api/admin/bank/')[1].split('/')[0];
                return await handleAdminToggleBank(bankId, request, env, origin);
            }

            // DELETE /api/admin/bank/:id（删除题库）
            if (method === 'DELETE' && path.match(/\/api\/admin\/bank\/[^/]+$/)) {
                const bankId = path.split('/api/admin/bank/')[1];
                return await handleAdminDeleteBank(bankId, request, env, origin);
            }

            // GET /api/banks（前端获取题库列表）
            if (method === 'GET' && path === '/api/banks') {
                return await handleGetBanks(request, env, origin);
            }

            // GET /api/bank/:id（前端获取题库数据）
            if (method === 'GET' && path.startsWith('/api/bank/')) {
                const bankId = path.split('/api/bank/')[1];
                return await handleGetBank(bankId, request, env, origin);
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

            // GET / POST /api/announce（支持 POST 绕过部分网络对 GET 的限制）
            if ((method === 'GET' || method === 'POST') && path === '/api/announce') {
                return await handleGetAnnounce(env, origin);
            }

            // GET /api/admin/operation-logs
            if (method === 'GET' && path === '/api/admin/operation-logs') {
                return await handleAdminOperationLogs(url, env, origin);
            }

            // POST /api/admin/operation-logs
            if (method === 'POST' && path === '/api/admin/operation-logs') {
                return await handleAdminWriteOperationLog(request, env, origin);
            }

            // GET /api/admin/system-status
            if (method === 'GET' && path === '/api/admin/system-status') {
                return await handleAdminSystemStatus(url, env, origin);
            }

            // POST /api/logs - 前端控制台日志上报
            if (method === 'POST' && path === '/api/logs') {
                return await handleLogs(request, env, origin);
            }

            // GET /api/admin/logs - 管理员查看日志
            if (method === 'GET' && path === '/api/admin/logs') {
                return await handleAdminLogs(url, env, origin);
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


// ========== 管理员操作日志 ==========
async function writeAdminOperationLog(env, { action, targetType = '', targetId = '', detail = '', ok = true, operator = '' }) {
    try {
        await env.DB.prepare(
            'INSERT INTO admin_operation_logs (action, target_type, target_id, detail, ok, operator, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(action, targetType, targetId, detail, ok ? 1 : 0, operator, new Date().toISOString()).run();
    } catch (e) {
        console.error('writeAdminOperationLog failed:', e);
    }
}

async function handleAdminOperationLogs(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const action = url.searchParams.get('action') || '';
    const targetType = url.searchParams.get('targetType') || '';
    const okFilter = url.searchParams.get('ok') || '';
    const offset = (page - 1) * pageSize;

    let where = '1=1';
    const binds = [];
    if (action) { where += ' AND action = ?'; binds.push(action); }
    if (targetType) { where += ' AND target_type = ?'; binds.push(targetType); }
    if (okFilter === '1') { where += ' AND ok = 1'; }
    else if (okFilter === '0') { where += ' AND ok = 0'; }

    const countRow = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM admin_operation_logs WHERE ${where}`).bind(...binds).first();
    const total = countRow?.cnt || 0;

    const logsResult = await env.DB.prepare(
        `SELECT * FROM admin_operation_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();
    const logs = logsResult?.results || [];

    // Get distinct actions for filter dropdown
    const actionsResult = await env.DB.prepare('SELECT DISTINCT action FROM admin_operation_logs ORDER BY action').all();
    const actions = (actionsResult?.results || []).map(r => r.action);

    return json({ ok: true, logs, total, page, pageSize, actions }, 200, origin);
}

async function handleAdminWriteOperationLog(request, env, origin) {
    const body = await request.json().catch(() => ({}));
    const { deviceId, password, action, targetType, targetId, detail, ok } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    if (!action) return error('缺少 action', 400, origin);

    await writeAdminOperationLog(env, {
        action,
        targetType: targetType || '',
        targetId: targetId || '',
        detail: typeof detail === 'string' ? detail.slice(0, 2000) : JSON.stringify(detail || '').slice(0, 2000),
        ok: ok !== false,
        operator: admin.id || admin.initials || ''
    });

    return json({ ok: true }, 200, origin);
}

async function handleAdminSystemStatus(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const status = {};

    // D1 check
    try {
        await env.DB.prepare('SELECT 1').first();
        status.d1 = { ok: true };
    } catch (e) {
        status.d1 = { ok: false, error: e.message };
    }

    // Table counts
    const tables = [];
    for (const name of ['users', 'devices', 'stats', 'banks', 'announcements', 'bank_history', 'admin_operation_logs', 'app_config']) {
        try {
            const row = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM ${name}`).first();
            tables.push({ name, count: row?.cnt || 0 });
        } catch {
            tables.push({ name, count: -1 });
        }
    }
    status.tables = tables;

    // Logs count
    try {
        const logsRow = await env.DB.prepare('SELECT COUNT(*) as cnt FROM admin_operation_logs').first();
        status.logs = { ok: true, count: logsRow?.cnt || 0 };
    } catch {
        status.logs = { ok: false };
    }

    // User/bank/announcement counts
    try {
        status.userCount = (await env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first())?.cnt || 0;
        status.bankCount = (await env.DB.prepare('SELECT COUNT(*) as cnt FROM banks').first())?.cnt || 0;
        status.announcementCount = (await env.DB.prepare('SELECT COUNT(*) as cnt FROM announcements').first())?.cnt || 0;
    } catch {}

    status.workerVersion = 'v2';
    status.serverTime = new Date().toISOString();
    status.apiDomain = new URL(url).origin;

    return json({ ok: true, status }, 200, origin);
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

    // 检查用户是否被封禁
    const isBanned = await checkUserBanned(userId, env);
    if (isBanned) return error('账号已被封禁，无法同步数据', 403, origin);

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

    // 检查用户是否被封禁
    const isBanned = await checkUserBanned(userId, env);
    if (isBanned) return error('账号已被封禁', 403, origin);

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

    // 检查用户是否被封禁
    const isBanned = await checkUserBanned(userId, env);
    if (isBanned) return error('账号已被封禁', 403, origin);

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE users SET progress = ?, last_sync_at = ? WHERE id = ?'
    ).bind(JSON.stringify(progress), now, userId).run();

    return json({ ok: true }, 200, origin);
}

// ========== 同步收藏 ==========
async function handleSyncBookmarks(request, env, origin) {
    const body = await request.json();
    const { deviceId, bookmarks } = body;

    if (!deviceId || !bookmarks) return error('缺少参数', 400, origin);

    const userId = await resolveUser(deviceId, env);
    if (!userId) return error('设备未注册', 400, origin);

    // 检查用户是否被封禁
    const isBanned = await checkUserBanned(userId, env);
    if (isBanned) return error('账号已被封禁', 403, origin);

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE users SET bookmarks = ?, last_sync_at = ? WHERE id = ?'
    ).bind(JSON.stringify(bookmarks), now, userId).run();

    return json({ ok: true }, 200, origin);
}

// ========== 获取云端数据 ==========
async function handleGetCloudData(did, env, origin) {
    const userId = await resolveUser(did, env);
    if (!userId) return json({ ok: false }, 200, origin);

    const user = await env.DB.prepare(
        'SELECT initials, settings, progress, bookmarks, last_sync_at, banned FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) return json({ ok: false }, 200, origin);

    let settings = {};
    let progress = {};
    let bookmarks = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch {}
    try { progress = JSON.parse(user.progress || '{}'); } catch {}
    try { bookmarks = JSON.parse(user.bookmarks || '{}'); } catch {}

    return json({
        ok: true,
        user: { 
            initials: user.initials,
            banned: user.banned || 0,
            is_admin: user.is_admin || 0
        },
        settings,
        progress,
        bookmarks,
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
        WHERE u.banned = 0 OR u.banned IS NULL
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

    let statsData = null;
    if (url.searchParams.get('stats') === '1') {
        const todayChina = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
        
        const totalActiveResult = await env.DB.prepare(`
            SELECT COUNT(DISTINCT s.user_id) as cnt
            FROM stats s
            INNER JOIN users u ON s.user_id = u.id
            WHERE u.banned = 0 OR u.banned IS NULL
        `).first();

        const todayActiveResult = await env.DB.prepare(`
            SELECT COUNT(DISTINCT s.user_id) as cnt
            FROM stats s
            INNER JOIN users u ON s.user_id = u.id
            WHERE (u.banned = 0 OR u.banned IS NULL) AND date(s.updated_at, '+8 hours') = ?
        `).bind(todayChina).first();

        const { results: recentResults } = await env.DB.prepare(`
            SELECT u.initials, MAX(s.updated_at) as last_active
            FROM users u
            INNER JOIN stats s ON u.id = s.user_id
            WHERE u.banned = 0 OR u.banned IS NULL
            GROUP BY u.id
            ORDER BY last_active DESC
            LIMIT 5
        `).all();

        statsData = {
            totalActiveCount: totalActiveResult?.cnt || 0,
            todayActiveCount: todayActiveResult?.cnt || 0,
            recentActiveUsers: (recentResults || []).map(row => ({
                initials: row.initials,
                lastActive: row.last_active
            }))
        };
    }

    return json({ ok: true, leaderboard, currentUser, statsData }, 200, origin);
}

// ========== 工具函数：设备ID → 用户ID ==========
async function resolveUser(deviceId, env) {
    const device = await env.DB.prepare(
        'SELECT user_id FROM devices WHERE device_id = ?'
    ).bind(deviceId).first();
    return device?.user_id || null;
}

// 检查用户是否被封禁
async function checkUserBanned(userId, env) {
    const user = await env.DB.prepare(
        'SELECT banned FROM users WHERE id = ?'
    ).bind(userId).first();
    return user?.banned === 1;
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
            u.id, u.initials, u.created_at, u.is_admin, u.banned,
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
        'SELECT id, initials, created_at, is_admin, banned FROM users WHERE id = ?'
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

    await env.DB.batch([
        env.DB.prepare('DELETE FROM stats WHERE user_id = ?').bind(targetUserId),
        env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(targetUserId),
        env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId)
    ]);

    await writeAdminOperationLog(env, { action: '删除用户', targetType: 'user', targetId: targetUserId, operator: admin.id || admin.initials || '' });
    return json({ ok: true, message: '已删除' }, 200, origin);
}

// ========== 管理员：重置用户数据 ==========
async function handleAdminResetStats(request, env, origin) {
    const body = await request.json();
    const { deviceId, targetUserId, password } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    await env.DB.prepare('DELETE FROM stats WHERE user_id = ?').bind(targetUserId).run();

    await writeAdminOperationLog(env, { action: '重置用户数据', targetType: 'user', targetId: targetUserId, operator: admin.id || admin.initials || '' });
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

    await writeAdminOperationLog(env, { action: '修改用户', targetType: 'user', targetId: targetUserId, detail: JSON.stringify({ initials, isAdmin }), operator: admin.id || admin.initials || '' });
    return json({ ok: true, message: '已更新' }, 200, origin);
}

// ========== 管理员：封禁/解封用户 ==========
async function handleAdminBanUser(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetUserId } = body;
    const banned = body.banned ?? body.ban;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (targetUserId === admin.id) return error('不能封禁自己', 400, origin);

    await env.DB.prepare('UPDATE users SET banned = ? WHERE id = ?').bind(banned ? 1 : 0, targetUserId).run();

    await writeAdminOperationLog(env, { action: banned ? '封禁用户' : '解封用户', targetType: 'user', targetId: targetUserId, operator: admin.id || admin.initials || '' });
    return json({ ok: true, message: banned ? '已封禁' : '已解封' }, 200, origin);
}

// ========== 管理员：批量封禁/解封 ==========
async function handleAdminBatchBan(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, userIds } = body;
    const banned = body.banned ?? body.ban;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!Array.isArray(userIds) || userIds.length === 0) return error('缺少 userIds 数组', 400, origin);

    const bannedValue = banned ? 1 : 0;
    const adminId = admin.id || '';
    // 过滤掉自己
    const targets = userIds.filter(id => id !== adminId);
    if (targets.length === 0) return error('不能封禁自己', 400, origin);

    // 批量更新
    const placeholders = targets.map(() => '?').join(', ');
    await env.DB.prepare(`UPDATE users SET banned = ? WHERE id IN (${placeholders})`)
        .bind(bannedValue, ...targets)
        .run();

    await writeAdminOperationLog(env, {
        action: banned ? '批量封禁' : '批量解封',
        targetType: 'user',
        targetId: targets.join(','),
        detail: `${targets.length}人`,
        operator: admin.initials || adminId
    });

    return json({ ok: true, affected: targets.length }, 200, origin);
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

    // 今日注册（北京时间）
    const todayChina = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const todayReg = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE date(created_at, '+8 hours') = ?"
    ).bind(todayChina).first();

    // 今日活跃（有更新记录的，北京时间）
    const todayActive = await env.DB.prepare(
        "SELECT COUNT(DISTINCT user_id) as cnt FROM stats WHERE date(updated_at, '+8 hours') = ?"
    ).bind(todayChina).first();

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

    await writeAdminOperationLog(env, { action: '发布公告', targetType: 'announcement', detail: content.slice(0, 100), operator: admin.id || admin.initials || '' });
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
    await writeAdminOperationLog(env, { action: '删除公告', targetType: 'announcement', targetId: String(id), operator: admin.id || admin.initials || '' });
    return json({ ok: true }, 200, origin);
}

// ========== 管理员：编辑公告 ==========
async function handleAdminEditAnnouncement(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, id, content } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!id || !content) return error('缺少参数', 400, origin);
    if (content.length > 500) return error('公告内容不超过500字', 400, origin);

    await env.DB.prepare('UPDATE announcements SET content = ? WHERE id = ?').bind(content.trim(), id).run();
    await writeAdminOperationLog(env, { action: '编辑公告', targetType: 'announcement', targetId: String(id), detail: content.slice(0, 100), operator: admin.id || admin.initials || '' });
    return json({ ok: true }, 200, origin);
}

// ========== 管理员：手动调整用户数据 ==========
async function handleAdminAdjustStats(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, targetUserId, bankId, bankName, answered, correct, duration } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!targetUserId || !bankId) return error('缺少参数', 400, origin);
    if (answered !== undefined && typeof answered !== 'number') return error('answered 必须为数字', 400, origin);
    if (correct !== undefined && typeof correct !== 'number') return error('correct 必须为数字', 400, origin);
    if (duration !== undefined && typeof duration !== 'number') return error('duration 必须为数字', 400, origin);

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

    await writeAdminOperationLog(env, { action: '调整用户数据', targetType: 'user', targetId: targetUserId, detail: JSON.stringify({ bankId, answered, correct, duration }), operator: admin.id || admin.initials || '' });
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

    // 事务性更新三张表（全部成功或全部回滚）
    await env.DB.batch([
        env.DB.prepare('UPDATE users SET id = ? WHERE id = ?').bind(code, targetUserId),
        env.DB.prepare('UPDATE devices SET user_id = ? WHERE user_id = ?').bind(code, targetUserId),
        env.DB.prepare('UPDATE stats SET user_id = ? WHERE user_id = ?').bind(code, targetUserId)
    ]);

    await writeAdminOperationLog(env, { action: '修改同步码', targetType: 'user', targetId: targetUserId, detail: `→ ${code}`, operator: admin.id || admin.initials || '' });
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

    await writeAdminOperationLog(env, { action: '解绑设备', targetType: 'user', targetId: dev.user_id, detail: targetDeviceId, operator: admin.id || admin.initials || '' });
    return json({ ok: true, message: '设备已解绑' }, 200, origin);
}

// ========== 管理员：查看用户云端数据 ==========
async function handleAdminUserCloudData(userId, url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const user = await env.DB.prepare(
        'SELECT id, initials, settings, progress, bookmarks, last_sync_at FROM users WHERE id = ?'
    ).bind(userId).first();
    if (!user) return error('用户不存在', 404, origin);

    let settings = {}, progress = {}, bookmarks = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch {}
    try { progress = JSON.parse(user.progress || '{}'); } catch {}
    try { bookmarks = JSON.parse(user.bookmarks || '{}'); } catch {}

    return json({ ok: true, user: { id: user.id, initials: user.initials, lastSyncAt: user.last_sync_at }, settings, progress, bookmarks }, 200, origin);
}

// ==================== 题库管理 API ====================

// 前端：获取题库列表（不含题目详情）
async function handleGetBanks(request, env, origin) {
    const rows = await env.DB.prepare(
        'SELECT id, name, description, category, version, question_count, allowed_modes, enabled, updated_at FROM banks ORDER BY name'
    ).all();
    
    const rawBanks = rows.results || [];
    
    // 生成弱 ETag (拼接各行状态)
    const etagData = rawBanks.map(b => `${b.id}:${b.version || 0}:${b.enabled}:${b.updated_at || ''}`).join('|');
    let hash = 0;
    for (let i = 0; i < etagData.length; i++) {
        hash = (hash << 5) - hash + etagData.charCodeAt(i);
        hash |= 0;
    }
    const etag = `W/"banks-${etagData.length}-${hash}"`;
    
    const clientEtag = request.headers.get('If-None-Match');
    if (clientEtag === etag) {
        const headers = { 
            ...corsHeaders(origin),
            'ETag': etag,
            'Cache-Control': 'public, max-age=0, must-revalidate'
        };
        return new Response(null, { status: 304, headers });
    }

    // 解析 allowed_modes JSON
    const banks = rawBanks.map(b => ({
        ...b,
        enabled: b.enabled !== 0, // 转为布尔值
        allowed_modes: b.allowed_modes ? JSON.parse(b.allowed_modes) : null
    }));

    const res = json({ ok: true, banks }, 200, origin);
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return res;
}

// 前端：获取题库完整数据（含题目）
async function handleGetBank(bankId, request, env, origin) {
    const bank = await env.DB.prepare(
        'SELECT * FROM banks WHERE id = ?'
    ).bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);
    // 检查题库是否启用
    if (bank.enabled === 0) return error('题库已禁用', 403, origin);

    let questions = [];
    try { 
        questions = JSON.parse(bank.questions_json || '[]'); 
    } catch (e) {
        console.error(`[Worker] 解析题库 ${bankId} 题目 JSON 失败:`, e.message);
        return error('题库数据损坏，无法解析', 500, origin);
    }

    // 生成弱 ETag
    const etag = `W/"bank-${bank.id}-${bank.version || 1}"`;
    const clientEtag = request.headers.get('If-None-Match');
    if (clientEtag === etag) {
        const headers = { 
            ...corsHeaders(origin),
            'ETag': etag,
            'Cache-Control': 'public, max-age=300'
        };
        return new Response(null, { status: 304, headers });
    }

    const res = json({
        ok: true,
        bank: {
            id: bank.id,
            name: bank.name,
            description: bank.description,
            category: bank.category,
            version: bank.version,
            allowed_modes: bank.allowed_modes ? JSON.parse(bank.allowed_modes) : null,
            questions
        }
    }, 200, origin, 300);

    res.headers.set('ETag', etag);
    return res;
}

// 管理员：导入/替换题库
async function handleAdminImportBank(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, id, name, description, category, questions, allowed_modes } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!id || !name || !questions) return error('缺少参数', 400, origin);

    const now = new Date().toISOString();
    const existing = await env.DB.prepare('SELECT version, allowed_modes FROM banks WHERE id = ?').bind(id).first();
    const version = existing ? (existing.version || 0) + 1 : 1;
    const modesJson = allowed_modes ? JSON.stringify(allowed_modes) : (existing?.allowed_modes || '');

    await env.DB.prepare(`
        INSERT OR REPLACE INTO banks (id, name, description, category, version, question_count, questions_json, allowed_modes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, name, description || '', category || '', version, questions.length, JSON.stringify(questions), modesJson, now, now).run();

    // 记录历史
    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, existing ? 'upload' : 'create', `${questions.length}道题`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: existing ? '导入题库' : '创建题库', targetType: 'bank', targetId: id, detail: `${name} (${questions.length}题)`, operator: admin.id || admin.initials || '' });
    return json({ ok: true, version, count: questions.length }, 200, origin);
}

// 管理员：获取单个题库详情
async function handleAdminGetBank(bankId, url, env, origin) {
    const deviceId = url.searchParams.get('deviceId');
    const password = url.searchParams.get('password');
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const bank = await env.DB.prepare('SELECT * FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    let questions = [];
    try { questions = JSON.parse(bank.questions_json || '[]'); } catch {}

    return json({ ok: true, bank: { ...bank, questions, questions_json: undefined, enabled: bank.enabled !== 0, allowed_modes: bank.allowed_modes ? JSON.parse(bank.allowed_modes) : null } }, 200, origin);
}

// 管理员：启用/禁用题库
async function handleAdminToggleBank(bankId, request, env, origin) {
    const body = await request.json();
    const { deviceId, password, enabled } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const bank = await env.DB.prepare('SELECT id, name FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    const enabledValue = enabled ? 1 : 0;
    const now = new Date().toISOString();

    await env.DB.prepare(
        'UPDATE banks SET enabled = ?, updated_at = ? WHERE id = ?'
    ).bind(enabledValue, now, bankId).run();

    // 记录历史
    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(bankId, 'toggle', `${enabled ? '启用' : '禁用'}题库`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: enabled ? '启用题库' : '禁用题库', targetType: 'bank', targetId: bankId, detail: bank.name, operator: admin.id || admin.initials || '' });
    return json({ ok: true, enabled: !!enabledValue }, 200, origin);
}

// 管理员：删除题库
async function handleAdminDeleteBank(bankId, request, env, origin) {
    try {
        // 支持从body或URL参数获取认证信息
        let deviceId, password;
        
        // 尝试从body获取
        try {
            const body = await request.json();
            deviceId = body.deviceId;
            password = body.password;
        } catch (e) {
            // body解析失败，尝试从URL参数获取
            const url = new URL(request.url);
            deviceId = url.searchParams.get('deviceId');
            password = url.searchParams.get('password');
        }
        
        console.log('删除题库请求:', { bankId, deviceId: deviceId ? '已提供' : '未提供', password: password ? '已提供' : '未提供' });
        
        const admin = await requireAdmin(deviceId, password, env);
        if (!admin) return error('无权限', 403, origin);

        const bank = await env.DB.prepare('SELECT id, name FROM banks WHERE id = ?').bind(bankId).first();
        if (!bank) return error('题库不存在', 404, origin);

        console.log('开始删除题库:', bank.name);
        
        // 删除题库、历史记录和统计数据（注意顺序：先删子表，再删父表）
        await env.DB.prepare('DELETE FROM stats WHERE bank_id = ?').bind(bankId).run();
        await env.DB.prepare('DELETE FROM bank_history WHERE bank_id = ?').bind(bankId).run();
        await env.DB.prepare('DELETE FROM banks WHERE id = ?').bind(bankId).run();

        await writeAdminOperationLog(env, { action: '删除题库', targetType: 'bank', targetId: bankId, detail: bank.name, operator: admin.id || admin.initials || '' });
        console.log('题库删除成功:', bank.name);
        return json({ ok: true, message: `题库 "${bank.name}" 已删除` }, 200, origin);
    } catch (e) {
        console.error('删除题库失败:', e);
        return error('删除失败: ' + e.message, 500, origin);
    }
}

// 管理员：添加单题
async function handleAdminImportQuestions(bankId, request, env, origin) {
    const body = await request.json();
    const { deviceId, password, questions: newQuestions } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!Array.isArray(newQuestions) || newQuestions.length === 0) return error('缺少题目数组', 400, origin);

    const bank = await env.DB.prepare('SELECT questions_json, version FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    let questions = [];
    try { questions = JSON.parse(bank.questions_json || '[]'); } catch {}

    const maxId = questions.reduce((max, q) => Math.max(max, q.id || 0), 0);
    let added = 0;
    const now = new Date().toISOString();

    newQuestions.forEach((q, i) => {
        if (!q.question) return; // 跳过无效题目
        const question = {
            id: maxId + added + 1,
            type: q.type || 'single',
            category: q.category || '',
            tags: q.tags || [],
            difficulty: q.difficulty || 1,
            question: q.question,
            options: q.options || [],
            answer: q.answer,
            explanation: q.explanation || ''
        };
        // 规范化选项：去除 A. B. C. 前缀
        if (question.options.length > 0) {
            question.options = question.options.map(opt => {
                return String(opt).replace(/^[A-Z][.、。\s]+/, '').trim();
            });
        }
        // 规范化答案：数组转字符串
        if (Array.isArray(question.answer)) {
            question.answer = question.answer.join('');
        }
        questions.push(question);
        added++;
    });

    await env.DB.prepare(
        'UPDATE banks SET questions_json = ?, question_count = ?, version = version + 1, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(questions), questions.length, now, bankId).run();

    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)' 
    ).bind(bankId, 'batch_import', `批量导入 ${added} 题`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: '批量导入题目', targetType: 'bank', targetId: bankId, detail: `${added}题`, operator: admin.id || admin.initials || '' });
    return json({ ok: true, added, total: questions.length }, 200, origin);
}

async function handleAdminAddQuestion(bankId, request, env, origin) {
    const body = await request.json();
    const { deviceId, password, question } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    if (!question || !question.question) return error('缺少题目内容', 400, origin);

    const bank = await env.DB.prepare('SELECT questions_json, version FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    let questions = [];
    try { questions = JSON.parse(bank.questions_json || '[]'); } catch {}

    const maxId = questions.reduce((max, q) => Math.max(max, q.id || 0), 0);
    question.id = maxId + 1;
    questions.push(question);

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE banks SET questions_json = ?, question_count = ?, version = version + 1, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(questions), questions.length, now, bankId).run();

    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(bankId, 'add_question', `添加: ${question.question.slice(0, 50)}`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: '添加题目', targetType: 'question', targetId: `${bankId}#${question.id}`, detail: question.question.slice(0, 80), operator: admin.id || admin.initials || '' });
    return json({ ok: true, id: question.id, count: questions.length }, 200, origin);
}

// 管理员：编辑单题
async function handleAdminEditQuestion(bankId, qid, request, env, origin) {
    const body = await request.json();
    const { deviceId, password, question } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const bank = await env.DB.prepare('SELECT questions_json FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    let questions = [];
    try { questions = JSON.parse(bank.questions_json || '[]'); } catch {}

    const idx = questions.findIndex(q => q.id === qid);
    if (idx === -1) return error('题目不存在', 404, origin);

    questions[idx] = { ...questions[idx], ...question, id: qid };

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE banks SET questions_json = ?, version = version + 1, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(questions), now, bankId).run();

    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(bankId, 'edit_question', `编辑 #${qid}: ${(question.question || '').slice(0, 50)}`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: '编辑题目', targetType: 'question', targetId: `${bankId}#${qid}`, operator: admin.id || admin.initials || '' });
    return json({ ok: true }, 200, origin);
}

// 管理员：删除单题
async function handleAdminDeleteQuestion(bankId, qid, request, env, origin) {
    const body = await request.json().catch(() => ({}));
    const { deviceId, password } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const bank = await env.DB.prepare('SELECT questions_json FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    let questions = [];
    try { questions = JSON.parse(bank.questions_json || '[]'); } catch {}

    const idx = questions.findIndex(q => q.id === qid);
    if (idx === -1) return error('题目不存在', 404, origin);

    const removed = questions.splice(idx, 1)[0];

    const now = new Date().toISOString();
    await env.DB.prepare(
        'UPDATE banks SET questions_json = ?, question_count = ?, version = version + 1, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(questions), questions.length, now, bankId).run();

    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(bankId, 'delete_question', `删除 #${qid}: ${(removed.question || '').slice(0, 50)}`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: '删除题目', targetType: 'question', targetId: `${bankId}#${qid}`, detail: (removed.question || '').slice(0, 80), operator: admin.id || admin.initials || '' });
    return json({ ok: true, count: questions.length }, 200, origin);
}

// 管理员：题库修改历史
async function handleAdminBankHistory(bankId, url, env, origin) {
    const deviceId = url.searchParams.get('deviceId');
    const password = url.searchParams.get('password');
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const rows = await env.DB.prepare(
        'SELECT * FROM bank_history WHERE bank_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(bankId).all();

    return json({ ok: true, history: rows.results || [] }, 200, origin);
}

// 管理员：更新题库设置（allowed_modes等）
async function handleAdminUpdateBankSettings(bankId, request, env, origin) {
    const body = await request.json();
    const { deviceId, password, allowed_modes, name, description, category } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    const bank = await env.DB.prepare('SELECT id, name, description, category FROM banks WHERE id = ?').bind(bankId).first();
    if (!bank) return error('题库不存在', 404, origin);

    const now = new Date().toISOString();
    const changes = [];

    // 构建更新字段
    let updateSql = 'UPDATE banks SET updated_at = ?';
    let params = [now];

    // 更新名称
    if (name !== undefined && name !== bank.name) {
        updateSql += ', name = ?';
        params.push(name);
        changes.push(`名称: "${bank.name}" -> "${name}"`);
    }

    // 更新描述
    if (description !== undefined && description !== (bank.description || '')) {
        updateSql += ', description = ?';
        params.push(description);
        changes.push(`描述已更新`);
    }

    // 更新分类
    if (category !== undefined && category !== (bank.category || '')) {
        updateSql += ', category = ?';
        params.push(category);
        changes.push(`分类: "${bank.category || '未分类'}" -> "${category}"`);
    }

    // 更新做题模式
    if (allowed_modes !== undefined) {
        const modesJson = Array.isArray(allowed_modes) ? JSON.stringify(allowed_modes) : '';
        updateSql += ', allowed_modes = ?';
        params.push(modesJson);
        changes.push(`做题模式: ${modesJson || '全部'}`);
    }

    updateSql += ' WHERE id = ?';
    params.push(bankId);

    // 只有有变更时才更新
    if (changes.length > 0) {
        await env.DB.prepare(updateSql).bind(...params).run();

        await env.DB.prepare(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(bankId, 'update_settings', changes.join('; '), admin.id, now).run();

        await writeAdminOperationLog(env, { action: '更新题库设置', targetType: 'bank', targetId: bankId, detail: changes.join('; '), operator: admin.id || admin.initials || '' });
    }

    // 查询更新后的数据
    const updated = await env.DB.prepare('SELECT name, description, category, allowed_modes FROM banks WHERE id = ?').bind(bankId).first();

    return json({ 
        ok: true, 
        bank: {
            name: updated.name,
            description: updated.description,
            category: updated.category,
            allowed_modes: updated.allowed_modes ? JSON.parse(updated.allowed_modes) : null
        }
    }, 200, origin);
}

// 管理员：上传题库（前端专用接口）
async function handleAdminUploadBank(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, bank, existingId } = body;
    
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);
    
    if (!bank || !bank.id || !bank.name || !bank.questions) {
        return error('题库格式错误，缺少必要字段', 400, origin);
    }
    
    const id = existingId || bank.id;
    const now = new Date().toISOString();
    const existing = await env.DB.prepare('SELECT version, allowed_modes FROM banks WHERE id = ?').bind(id).first();
    const version = existing ? (existing.version || 0) + 1 : 1;
    const modesJson = existing?.allowed_modes || '';
    
    // 处理 categories 字段（前端用 categories，后端用 category）
    const category = bank.category || (Array.isArray(bank.categories) ? bank.categories.join(', ') : '');
    
    await env.DB.prepare(`
        INSERT OR REPLACE INTO banks (id, name, description, category, version, question_count, questions_json, allowed_modes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        id,
        bank.name,
        bank.description || '',
        category,
        version,
        bank.questions.length,
        JSON.stringify(bank.questions),
        modesJson,
        now,
        now
    ).run();
    
    // 记录历史
    await env.DB.prepare(
        'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, existing ? 'replace' : 'create', `${bank.questions.length}道题`, admin.id, now).run();

    await writeAdminOperationLog(env, { action: existing ? '替换题库' : '上传题库', targetType: 'bank', targetId: id, detail: `${bank.name} (${bank.questions.length}题)`, operator: admin.id || admin.initials || '' });
    return json({ ok: true, version, count: bank.questions.length }, 200, origin);
}

// ========== AI 解读：自动建表 ==========
async function ensureAIConfigTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TEXT
        )
    `).run();
}

async function getAIConfigRaw(env) {
    const row = await env.DB.prepare(
        "SELECT value FROM app_config WHERE key = 'ai_config'"
    ).first();
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
}

async function saveAIConfigRaw(env, config) {
    const now = new Date().toISOString();
    await env.DB.prepare(`
        INSERT INTO app_config (key, value, updated_at) VALUES ('ai_config', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(JSON.stringify(config), now).run();
}

// GET /api/ai/config（公开，不暴露 API 密钥）
async function handleGetAIConfig(env, origin) {
    try {
        await ensureAIConfigTable(env);
        const c = await getAIConfigRaw(env);
        if (!c || !c.enabled) {
            return json({ ok: true, config: { enabled: false, allowUserOverride: false, hasGlobalKey: false, mode: 'search', provider: 'openai', baseUrl: '', model: '' } }, 200, origin, 30);
        }
        return json({
            ok: true,
            config: {
                enabled: !!c.enabled,
                allowUserOverride: !!c.allowUserOverride,
                hasGlobalKey: !!(c.apiKey && c.apiKey.length > 0),
                mode: c.mode || 'search',
                provider: c.provider || 'openai',
                baseUrl: c.baseUrl || '',
                model: c.model || ''
            }
        }, 200, origin, 30);
    } catch (e) {
        return error('获取 AI 配置失败: ' + e.message, 500, origin);
    }
}

// GET /api/admin/ai-config（管理员，含密钥标记）
async function handleAdminGetAIConfig(url, env, origin) {
    const deviceId = url.searchParams.get('deviceId') || '';
    const password = url.searchParams.get('password') || '';
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    try {
        await ensureAIConfigTable(env);
        const c = await getAIConfigRaw(env);
        if (!c) {
            return json({ ok: true, config: { enabled: false, allowUserOverride: false, hasGlobalKey: false, mode: 'search', provider: 'openai', baseUrl: '', model: '', systemPrompt: '', updatedAt: null } }, 200, origin);
        }
        return json({
            ok: true,
            config: {
                enabled: !!c.enabled,
                allowUserOverride: !!c.allowUserOverride,
                hasGlobalKey: !!(c.apiKey && c.apiKey.length > 0),
                mode: c.mode || 'search',
                provider: c.provider || 'openai',
                baseUrl: c.baseUrl || '',
                model: c.model || '',
                systemPrompt: c.systemPrompt || '',
                updatedAt: c.updatedAt || null
            }
        }, 200, origin);
    } catch (e) {
        return error('获取 AI 配置失败: ' + e.message, 500, origin);
    }
}

// PUT /api/admin/ai-config（管理员更新）
async function handleAdminUpdateAIConfig(request, env, origin) {
    const body = await request.json();
    const { deviceId, password, config } = body;
    const admin = await requireAdmin(deviceId, password, env);
    if (!admin) return error('无权限', 403, origin);

    if (!config || typeof config !== 'object') return error('缺少 config 参数', 400, origin);

    try {
        await ensureAIConfigTable(env);
        const existing = (await getAIConfigRaw(env)) || {};
        const merged = { ...existing };

        if (config.enabled !== undefined) merged.enabled = !!config.enabled;
        if (config.allowUserOverride !== undefined) merged.allowUserOverride = !!config.allowUserOverride;
        if (config.mode !== undefined) merged.mode = config.mode;
        if (config.provider !== undefined) merged.provider = config.provider;
        if (config.baseUrl !== undefined) merged.baseUrl = config.baseUrl;
        if (config.model !== undefined) merged.model = config.model;
        if (config.systemPrompt !== undefined) merged.systemPrompt = config.systemPrompt;
        if (config.clearApiKey) {
            merged.apiKey = '';
        } else if (config.apiKey && config.apiKey.length > 0) {
            merged.apiKey = config.apiKey;
        }
        merged.updatedAt = new Date().toISOString();

        await saveAIConfigRaw(env, merged);
        await writeAdminOperationLog(env, { action: '更新AI配置', targetType: 'system', detail: JSON.stringify({ enabled: merged.enabled, mode: merged.mode, provider: merged.provider }), operator: admin.id || admin.initials || '' });
        return json({ ok: true }, 200, origin);
    } catch (e) {
        return error('保存 AI 配置失败: ' + e.message, 500, origin);
    }
}

// POST /api/ai/explain（流式解读）
async function handleAIExplain(request, env, origin) {
    const body = await request.json().catch(() => null);
    if (!body || !body.question) return error('缺少 question 参数', 400, origin);

    const { question, bankName, override } = body;
    const userProvider = override?.provider;
    const userBaseUrl = override?.baseUrl;
    const userApiKey = override?.apiKey;
    const userModel = override?.model;

    try {
        await ensureAIConfigTable(env);
        const globalCfg = (await getAIConfigRaw(env)) || {};

        if (!globalCfg.enabled) return error('AI 解读功能未启用', 403, origin);

        const allowUser = !!globalCfg.allowUserOverride;
        const hasUserKey = allowUser && userApiKey && userApiKey.length > 0;

        const provider = hasUserKey && userProvider ? userProvider : (globalCfg.provider || 'openai');
        const baseUrl = (hasUserKey && userBaseUrl ? userBaseUrl : (globalCfg.baseUrl || '')).replace(/\/+$/, '');
        const apiKey = hasUserKey ? userApiKey : (globalCfg.apiKey || '');
        const model = hasUserKey && userModel ? userModel : (globalCfg.model || 'gpt-4o-mini');
        const systemPrompt = globalCfg.systemPrompt || `你是一位严谨的辅导老师。根据题目、选项、正确答案和解析，为学生提供详细的讲解。

【核心规则】
1. 明确告诉学生他的作答是否正确
2. 如果学生答错，指出错误原因，讲解为什么正确答案是对的
3. 如果学生答对，肯定回答并补充相关知识点
4. 结合参考解析，用通俗易懂的语言讲解
5. 如果题目本身有问题（如正确答案不在选项中），请指出

【回答格式】
- 判定：答对/答错
- 逐项分析各选项
- 正确答案讲解
- 知识点补充与记忆技巧

回答控制在 300 字以内。`;

        if (!baseUrl) return error('后台未配置 Base URL', 400, origin);
        if (!apiKey) return error('后台未配置 API 密钥', 400, origin);

        let context = `题目：${question}`;
        if (bankName) context += `\n题库：${bankName}`;

        const userMessage = context;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    if (provider === 'gemini') {
                        const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
                        const payload = {
                            contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }],
                            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                        };
                        const resp = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (!resp.ok) {
                            const errText = await resp.text();
                            controller.enqueue(encoder.encode(`[AI 接口错误 ${resp.status}] ${errText.slice(0, 200)}`));
                            controller.close();
                            return;
                        }
                        const reader = resp.body.getReader();
                        const decoder = new TextDecoder();
                        let buf = '';
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buf += decoder.decode(value, { stream: true });
                            const lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (const line of lines) {
                                if (!line.startsWith('data: ')) continue;
                                try {
                                    const d = JSON.parse(line.slice(6));
                                    const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
                                    if (text) controller.enqueue(encoder.encode(text));
                                } catch {}
                            }
                        }
                        controller.close();
                    } else {
                        // OpenAI 兼容
                        const url = `${baseUrl}/chat/completions`;
                        const payload = {
                            model,
                            stream: true,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userMessage }
                            ],
                            temperature: 0.7,
                            max_tokens: 1024
                        };
                        const resp = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                            body: JSON.stringify(payload)
                        });
                        if (!resp.ok) {
                            const errText = await resp.text();
                            controller.enqueue(encoder.encode(`[AI 接口错误 ${resp.status}] ${errText.slice(0, 200)}`));
                            controller.close();
                            return;
                        }
                        const reader = resp.body.getReader();
                        const decoder = new TextDecoder();
                        let buf = '';
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buf += decoder.decode(value, { stream: true });
                            const lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (const line of lines) {
                                if (!line.startsWith('data: ')) continue;
                                const data = line.slice(6).trim();
                                if (data === '[DONE]') { controller.close(); return; }
                                try {
                                    const d = JSON.parse(data);
                                    const delta = d.choices?.[0]?.delta || {};
                                    // 思考内容（reasoning_content）
                                    if (delta.reasoning_content) {
                                        controller.enqueue(encoder.encode('\x00[THINK]\x00' + delta.reasoning_content + '\x00[/THINK]\x00'));
                                    }
                                    // 正式回答
                                    const token = delta.content;
                                    if (token) controller.enqueue(encoder.encode(token));
                                } catch {}
                            }
                        }
                        controller.close();
                    }
                } catch (e) {
                    controller.enqueue(encoder.encode(`[错误] ${e.message}`));
                    controller.close();
                }
            }
        });

        return streamText(stream, origin);
    } catch (e) {
        return error('AI 解读失败: ' + e.message, 500, origin);
    }
}


// ========== 前端日志收集 ==========

/**
 * POST /api/logs - 接收前端控制台日志上报
 * 日志字段：deviceId, level, type, message, stack, pageUrl, source, line, col, ua, ts
 * 速率限制：每设备每小时最多 100 条
 */
async function handleLogs(request, env, origin) {
    try {
        const body = await request.json();
        if (!body || !body.logs || !Array.isArray(body.logs)) {
            return json({ ok: false, error: '无效的日志格式' }, 400, origin);
        }

        const deviceId = body.deviceId || 'unknown';
        const logs = body.logs;

        // 速率限制检查
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const recentLogs = await env.DB.prepare(
            'SELECT COUNT(*) as cnt FROM client_logs WHERE device_id = ? AND created_at > ?'
        ).bind(deviceId, oneHourAgo).first();

        const recentCount = recentLogs?.cnt || 0;
        const maxAllowed = 100;

        if (recentCount >= maxAllowed) {
            // 超出限制，静默丢弃
            return json({ ok: true, dropped: logs.length }, 200, origin);
        }

        // 计算本次可接受的数量
        const remaining = maxAllowed - recentCount;
        const batch = logs.slice(0, Math.min(logs.length, remaining));

        // 批量插入
        const stmt = env.DB.prepare(
            `INSERT INTO client_logs (device_id, level, type, message, stack, page_url, source, line, col, ua, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const insertBatch = [];
        for (const log of batch) {
            insertBatch.push(
                stmt.bind(
                    deviceId,
                    (log.level || 'log').slice(0, 10),
                    (log.type || 'console').slice(0, 20),
                    (log.message || '').slice(0, 1000),
                    (log.stack || '').slice(0, 2000),
                    (log.pageUrl || '').slice(0, 500),
                    (log.source || '').slice(0, 500),
                    log.line || 0,
                    log.col || 0,
                    (log.ua || '').slice(0, 500),
                    log.ts || new Date().toISOString()
                )
            );
        }

        if (insertBatch.length > 0) {
            await env.DB.batch(insertBatch);
        }

        return json({ ok: true, received: batch.length, dropped: logs.length - batch.length }, 200, origin);
    } catch (e) {
        console.error('[Logs] 处理错误:', e.message);
        return json({ ok: false, error: '处理失败' }, 500, origin);
    }
}


/**
 * GET /api/admin/logs - 管理员查看前端日志
 * 查询参数：
 *   - deviceId: 按设备筛选（可选）
 *   - level: 按级别筛选 error/warn（可选）
 *   - limit: 每页条数（默认 50，最大 200）
 *   - offset: 偏移量（默认 0）
 */
async function handleAdminLogs(url, env, origin) {
    const filterDeviceId = url.searchParams.get('filterDeviceId') || '';
    const level = url.searchParams.get('level') || '';
    const type = url.searchParams.get('type') || '';
    const keyword = url.searchParams.get('keyword') || '';
    const timeStart = url.searchParams.get('timeStart') || '';
    const timeEnd = url.searchParams.get('timeEnd') || '';
    const userName = url.searchParams.get('userName') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // 验证管理员权限
    const pwd = url.searchParams.get('password') || '';
    const did = url.searchParams.get('deviceId') || '';

    try {
        // 验证管理员
        const admin = await requireAdmin(did, pwd, env);
        if (!admin) return error('无权限', 403, origin);

        let query = `
            SELECT cl.*, u.initials AS user_name, u.id AS sync_code
            FROM client_logs cl
            LEFT JOIN devices d ON cl.device_id = d.device_id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE 1=1`;
        const params = [];

        if (filterDeviceId) {
            query += ' AND cl.device_id = ?';
            params.push(filterDeviceId);
        }
        if (level) {
            query += ' AND cl.level = ?';
            params.push(level);
        }
        if (type) {
            query += ' AND cl.type = ?';
            params.push(type);
        }
        if (keyword) {
            query += ' AND cl.message LIKE ?';
            params.push('%' + keyword + '%');
        }
        if (timeStart) {
            query += ' AND cl.created_at >= ?';
            params.push(timeStart);
        }
        if (timeEnd) {
            query += ' AND cl.created_at <= ?';
            params.push(timeEnd);
        }
        if (userName) {
            query += ' AND u.initials LIKE ?';
            params.push('%' + userName + '%');
        }

        query += ' ORDER BY cl.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const { results } = await env.DB.prepare(query).bind(...params).all();

        // 获取总数（复用相同筛选条件）
        let countQuery = `
            SELECT COUNT(*) as total
            FROM client_logs cl
            LEFT JOIN devices d ON cl.device_id = d.device_id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE 1=1`;
        const countParams = [];
        if (filterDeviceId) { countQuery += ' AND cl.device_id = ?'; countParams.push(filterDeviceId); }
        if (level) { countQuery += ' AND cl.level = ?'; countParams.push(level); }
        if (type) { countQuery += ' AND cl.type = ?'; countParams.push(type); }
        if (keyword) { countQuery += ' AND cl.message LIKE ?'; countParams.push('%' + keyword + '%'); }
        if (timeStart) { countQuery += ' AND cl.created_at >= ?'; countParams.push(timeStart); }
        if (timeEnd) { countQuery += ' AND cl.created_at <= ?'; countParams.push(timeEnd); }
        if (userName) { countQuery += ' AND u.initials LIKE ?'; countParams.push('%' + userName + '%'); }
        const { total } = await env.DB.prepare(countQuery).bind(...countParams).first();

        // 获取错误日志聚合统计
        const { results: errorSummary } = await env.DB.prepare(
            `SELECT message, COUNT(*) as cnt
             FROM client_logs
             WHERE level = 'error'
               AND created_at > datetime('now', '-7 days')
             GROUP BY message
             ORDER BY cnt DESC
             LIMIT 20`
        ).all();

        // 获取最近活跃设备（关联用户名和同步码）
        const { results: activeDevices } = await env.DB.prepare(
            `SELECT cl.device_id, COUNT(*) as log_count, MAX(cl.created_at) as last_active,
                    u.initials AS user_name, u.id AS sync_code
             FROM client_logs cl
             LEFT JOIN devices d ON cl.device_id = d.device_id
             LEFT JOIN users u ON d.user_id = u.id
             WHERE cl.created_at > datetime('now', '-24 hours')
             GROUP BY cl.device_id
             ORDER BY last_active DESC
             LIMIT 20`
        ).all();

        return json({
            ok: true,
            logs: results || [],
            total: total || 0,
            errorSummary: errorSummary || [],
            activeDevices: activeDevices || []
        }, 200, origin);
    } catch (e) {
        console.error('[Admin Logs] 查询错误:', e.message);
        return error('查询失败', 500, origin);
    }
}
