/**
 * 城科卷王 API 服务端（宝塔 MySQL 版）
 * 
 * 从 Cloudflare Worker 移植，保持相同的 API 接口
 * 前端只需修改 BASE_URL 即可切换
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const crypto = require('crypto');
const { pool, testConnection, config } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ========== 内存缓存 ==========
class MemoryCache {
    constructor() {
        this.cache = new Map();
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expireAt) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    set(key, value, ttlMs = 30000) {
        this.cache.set(key, {
            value,
            expireAt: Date.now() + ttlMs
        });
    }
    invalidate(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
}
const cache = new MemoryCache();

// ========== 中间件 ==========

// CORS 配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Password', 'X-Admin-Device-Id'],
    maxAge: 86400
}));

// Gzip 压缩
app.use(compression({ threshold: 1024 }));

// 解析 JSON
app.use(express.json({ limit: '10mb' }));

// 静态资源缓存头
app.use((req, res, next) => {
    // API 响应设置缓存控制
    if (req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'no-cache');
    }
    next();
});

// 请求日志
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const elapsed = Date.now() - start;
        if (req.path !== '/api/health') {
            console.log(`${req.method} ${req.path} ${res.statusCode} ${elapsed}ms`);
        }
    });
    next();
});

// ========== 工具函数 ==========

// 管理员密码哈希（与 Worker 一致）
const ADMIN_PASSWORD_HASH = 'c014d32d3686385fd8287ed5c61374fae42ab80342105ece72930d5c8f9c6065';

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

// 生成同步码
function generateSyncCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// 设备ID → 用户ID
async function resolveUser(deviceId) {
    const [rows] = await pool.execute(
        'SELECT user_id FROM devices WHERE device_id = ?',
        [deviceId]
    );
    return rows[0]?.user_id || null;
}

// 检查用户是否被封禁
async function checkUserBanned(userId) {
    const [rows] = await pool.execute(
        'SELECT banned FROM users WHERE id = ?',
        [userId]
    );
    return rows[0]?.banned === 1;
}

// 验证管理员
async function requireAdmin(deviceId, password, req) {
    // 支持从 header 或 query 读取凭据
    if (!deviceId && req) {
        deviceId = req.headers['x-admin-device-id'] || req.query?.deviceId || '';
    }
    if (!password && req) {
        password = req.headers['x-admin-password'] || req.query?.password || '';
    }
    if (!deviceId || !password) return null;
    if (sha256(password) !== ADMIN_PASSWORD_HASH) return null;
    const userId = await resolveUser(deviceId);
    if (!userId) return null;
    const [rows] = await pool.execute(
        'SELECT id, initials, is_admin FROM users WHERE id = ?',
        [userId]
    );
    const user = rows[0];
    return user?.is_admin ? user : null;
}

// 写入管理员操作日志
async function writeAdminOperationLog({ action, targetType = '', targetId = '', detail = '', ok = true, operator = '' }) {
    try {
        await pool.execute(
            'INSERT INTO admin_operation_logs (action, target_type, target_id, detail, ok, operator, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [action, targetType, targetId, detail, ok ? 1 : 0, operator, new Date().toISOString()]
        );
    } catch (e) {
        console.error('writeAdminOperationLog failed:', e.message);
    }
}

// ========== 健康检查 ==========
app.get('/api/health', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({ ok: true, time: new Date().toISOString(), db: 'connected' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ========== 注册用户 ==========
app.post('/api/register', async (req, res) => {
    try {
        const { deviceId, initials } = req.body;

        if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
            return res.status(400).json({ error: '无效的设备ID' });
        }
        if (!initials || typeof initials !== 'string' || initials.length < 1 || initials.length > 4) {
            return res.status(400).json({ error: '姓名首字母需1-4个字符' });
        }

        // 检查设备是否已绑定
        const [existing] = await pool.execute(
            'SELECT user_id FROM devices WHERE device_id = ?',
            [deviceId]
        );

        if (existing[0]) {
            await pool.execute(
                'UPDATE users SET initials = ? WHERE id = ?',
                [initials.trim().toUpperCase(), existing[0].user_id]
            );
            const [user] = await pool.execute(
                'SELECT id, initials FROM users WHERE id = ?',
                [existing[0].user_id]
            );
            return res.json({ ok: true, message: '已注册', syncCode: user[0].id, initials: user[0].initials });
        }

        // 生成唯一同步码
        let syncCode;
        for (let i = 0; i < 10; i++) {
            syncCode = generateSyncCode();
            const [exists] = await pool.execute('SELECT id FROM users WHERE id = ?', [syncCode]);
            if (!exists[0]) break;
            if (i === 9) return res.status(500).json({ error: '生成同步码失败，请重试' });
        }

        const now = new Date().toISOString();

        await pool.execute(
            'INSERT INTO users (id, initials, created_at, created_device) VALUES (?, ?, ?, ?)',
            [syncCode, initials.trim().toUpperCase(), now, deviceId]
        );

        await pool.execute(
            'INSERT INTO devices (device_id, user_id, bound_at) VALUES (?, ?, ?)',
            [deviceId, syncCode, now]
        );

        res.status(201).json({ ok: true, syncCode, initials: initials.trim().toUpperCase() });
    } catch (e) {
        console.error('register error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 绑定设备 ==========
app.post('/api/bind', async (req, res) => {
    try {
        const { deviceId, syncCode, localStats } = req.body;

        if (!deviceId || !syncCode) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const code = syncCode.trim().toUpperCase();

        const [user] = await pool.execute(
            'SELECT id, initials FROM users WHERE id = ?',
            [code]
        );

        if (!user[0]) {
            return res.status(404).json({ error: '同步码不存在，请检查后重试' });
        }

        // 检查设备是否已绑定其他账号
        const [existing] = await pool.execute(
            'SELECT user_id FROM devices WHERE device_id = ?',
            [deviceId]
        );

        if (existing[0] && existing[0].user_id !== code) {
            await pool.execute('DELETE FROM devices WHERE device_id = ?', [deviceId]);
        }

        const now = new Date().toISOString();
        await pool.execute(
            'INSERT INTO devices (device_id, user_id, bound_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), bound_at = VALUES(bound_at)',
            [deviceId, code, now]
        );

        // 合并本地答题数据
        if (localStats && Array.isArray(localStats)) {
            for (const stat of localStats) {
                if (!stat.bankId) continue;
                await pool.execute(`
                    INSERT INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        answered = answered + VALUES(answered),
                        correct = correct + VALUES(correct),
                        duration = duration + VALUES(duration),
                        updated_at = VALUES(updated_at)
                `, [code, stat.bankId, stat.bankName || '', stat.answered || 0, stat.correct || 0, stat.duration || 0, now]);
            }
        }

        res.json({ ok: true, syncCode: code, initials: user[0].initials });
    } catch (e) {
        console.error('bind error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 查询用户 ==========
app.get('/api/user/:did', async (req, res) => {
    try {
        const did = req.params.did;
        const [device] = await pool.execute(
            'SELECT user_id FROM devices WHERE device_id = ?',
            [did]
        );

        if (!device[0]) {
            return res.json({ ok: false, registered: false });
        }

        const [user] = await pool.execute(
            'SELECT id, initials, created_at FROM users WHERE id = ?',
            [device[0].user_id]
        );

        res.json({ ok: true, registered: true, user: { syncCode: user[0].id, initials: user[0].initials } });
    } catch (e) {
        console.error('getUser error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 同步答题数据 ==========
app.post('/api/sync', async (req, res) => {
    try {
        const { deviceId, bankId, bankName, answered, correct, duration } = req.body;

        if (!deviceId || !bankId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const userId = await resolveUser(deviceId);
        if (!userId) return res.status(400).json({ error: '设备未注册' });

        if (await checkUserBanned(userId)) {
            return res.status(403).json({ error: '账号已被封禁，无法同步数据' });
        }

        const now = new Date().toISOString();
        await pool.execute(`
            INSERT INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                answered = answered + VALUES(answered),
                correct = correct + VALUES(correct),
                duration = duration + VALUES(duration),
                bank_name = VALUES(bank_name),
                updated_at = VALUES(updated_at)
        `, [userId, bankId, bankName || '', answered || 0, correct || 0, duration || 0, now]);

        res.json({ ok: true });
    } catch (e) {
        console.error('sync error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 同步设置 ==========
app.post('/api/settings', async (req, res) => {
    try {
        const { deviceId, settings } = req.body;
        if (!deviceId || !settings) return res.status(400).json({ error: '缺少参数' });

        const userId = await resolveUser(deviceId);
        if (!userId) return res.status(400).json({ error: '设备未注册' });
        if (await checkUserBanned(userId)) return res.status(403).json({ error: '账号已被封禁' });

        const now = new Date().toISOString();
        await pool.execute(
            'UPDATE users SET settings = ?, last_sync_at = ? WHERE id = ?',
            [JSON.stringify(settings), now, userId]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('settings error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 同步进度 ==========
app.post('/api/progress', async (req, res) => {
    try {
        const { deviceId, progress } = req.body;
        if (!deviceId || !progress) return res.status(400).json({ error: '缺少参数' });

        const userId = await resolveUser(deviceId);
        if (!userId) return res.status(400).json({ error: '设备未注册' });
        if (await checkUserBanned(userId)) return res.status(403).json({ error: '账号已被封禁' });

        const now = new Date().toISOString();
        await pool.execute(
            'UPDATE users SET progress = ?, last_sync_at = ? WHERE id = ?',
            [JSON.stringify(progress), now, userId]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('progress error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 同步收藏 ==========
app.post('/api/bookmarks', async (req, res) => {
    try {
        const { deviceId, bookmarks } = req.body;
        if (!deviceId || !bookmarks) return res.status(400).json({ error: '缺少参数' });

        const userId = await resolveUser(deviceId);
        if (!userId) return res.status(400).json({ error: '设备未注册' });
        if (await checkUserBanned(userId)) return res.status(403).json({ error: '账号已被封禁' });

        const now = new Date().toISOString();
        await pool.execute(
            'UPDATE users SET bookmarks = ?, last_sync_at = ? WHERE id = ?',
            [JSON.stringify(bookmarks), now, userId]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('bookmarks error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 获取云端数据 ==========
app.get('/api/cloud-data/:did', async (req, res) => {
    try {
        const userId = await resolveUser(req.params.did);
        if (!userId) return res.json({ ok: false });

        const [users] = await pool.execute(
            'SELECT initials, settings, progress, bookmarks, last_sync_at, banned, is_admin FROM users WHERE id = ?',
            [userId]
        );
        const user = users[0];
        if (!user) return res.json({ ok: false });

        let settings = {}, progress = {}, bookmarks = {};
        try { settings = JSON.parse(user.settings || '{}'); } catch {}
        try { progress = JSON.parse(user.progress || '{}'); } catch {}
        try { bookmarks = JSON.parse(user.bookmarks || '{}'); } catch {}

        res.json({
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
        });
    } catch (e) {
        console.error('cloud-data error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 排行榜 ==========
app.get('/api/leaderboard', async (req, res) => {
    try {
        const sort = req.query.sort || 'answered';
        const limit = Math.min(parseInt(req.query.limit || '50'), 100);
        const deviceId = req.query.deviceId || '';
        const wantStats = req.query.stats === '1';

        // 缓存键（不含 deviceId，因为排行榜数据是公共的）
        const cacheKey = `leaderboard_${sort}_${limit}_${wantStats ? 'stats' : 'nostats'}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData && !deviceId) {
            // 无 deviceId 时直接返回缓存
            res.set('X-Cache', 'HIT');
            return res.json(cachedData);
        }

        const sortMap = {
            'answered': 'total_answered DESC',
            'accuracy': 'CASE WHEN total_answered > 0 THEN CAST(total_correct AS DECIMAL) / total_answered ELSE 0 END DESC',
            'duration': 'total_duration DESC'
        };
        const orderBy = sortMap[sort] || sortMap['answered'];

        const [results] = await pool.execute(`
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
        `, [limit]);

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
            const userId = await resolveUser(deviceId);
            if (userId) {
                const idx = leaderboard.findIndex(r => r.syncCode === userId);
                if (idx >= 0) {
                    currentUser = leaderboard[idx];
                } else {
                    const [userStats] = await pool.execute(`
                        SELECT SUM(answered) as ta, SUM(correct) as tc, SUM(duration) as td
                        FROM stats WHERE user_id = ?
                    `, [userId]);

                    if (userStats[0] && userStats[0].ta > 0) {
                        const [rankResult] = await pool.execute(`
                            SELECT COUNT(*) + 1 as rank FROM (
                                SELECT SUM(answered) as total FROM stats GROUP BY user_id
                                HAVING total > ?
                            ) as sub
                        `, [userStats[0].ta]);

                        const [user] = await pool.execute('SELECT initials FROM users WHERE id = ?', [userId]);
                        currentUser = {
                            rank: rankResult[0]?.rank || '-',
                            syncCode: userId,
                            initials: user[0]?.initials || '',
                            answered: userStats[0].ta,
                            correct: userStats[0].tc,
                            accuracy: Math.round((userStats[0].tc / userStats[0].ta) * 100),
                            duration: userStats[0].td
                        };
                    }
                }
            }
        }

        let statsData = null;
        if (req.query.stats === '1') {
            const todayChina = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

            const [totalActive] = await pool.execute(`
                SELECT COUNT(DISTINCT s.user_id) as cnt
                FROM stats s
                INNER JOIN users u ON s.user_id = u.id
                WHERE u.banned = 0 OR u.banned IS NULL
            `);

            const [todayActive] = await pool.execute(`
                SELECT COUNT(DISTINCT s.user_id) as cnt
                FROM stats s
                INNER JOIN users u ON s.user_id = u.id
                WHERE (u.banned = 0 OR u.banned IS NULL) AND DATE(CONVERT_TZ(s.updated_at, '+00:00', '+08:00')) = ?
            `, [todayChina]);

            const [recentResults] = await pool.execute(`
                SELECT u.initials, MAX(s.updated_at) as last_active
                FROM users u
                INNER JOIN stats s ON u.id = s.user_id
                WHERE u.banned = 0 OR u.banned IS NULL
                GROUP BY u.id
                ORDER BY last_active DESC
                LIMIT 5
            `);

            statsData = {
                totalActiveCount: totalActive[0]?.cnt || 0,
                todayActiveCount: todayActive[0]?.cnt || 0,
                recentActiveUsers: recentResults.map(row => ({
                    initials: row.initials,
                    lastActive: row.last_active
                }))
            };
        }

        const result = { ok: true, leaderboard, currentUser, statsData };
        
        // 缓存排行榜数据（15秒）
        if (!deviceId) {
            cache.set(cacheKey, result, 15000);
        }
        res.set('X-Cache', 'MISS');
        res.json(result);
    } catch (e) {
        console.error('leaderboard error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== AI 配置（公开） ==========
app.get('/api/ai/config', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT value FROM app_config WHERE `key` = 'ai_config'"
        );
        if (!rows[0]) {
            return res.json({ ok: true, config: { enabled: false, allowUserOverride: false, hasGlobalKey: false, mode: 'search', provider: 'openai', baseUrl: '', model: '' } });
        }
        const c = JSON.parse(rows[0].value);
        if (!c.enabled) {
            return res.json({ ok: true, config: { enabled: false, allowUserOverride: false, hasGlobalKey: false, mode: 'search', provider: 'openai', baseUrl: '', model: '' } });
        }
        res.json({
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
        });
    } catch (e) {
        res.status(500).json({ error: '获取 AI 配置失败: ' + e.message });
    }
});

// ========== 获取题库列表（前端） ==========
app.get('/api/banks', async (req, res) => {
    try {
        const showAll = req.query.all === 'true'; // 管理后台传 all=true 显示所有题库
        
        // 使用缓存（30秒）
        const cacheKey = showAll ? 'banks_list_all' : 'banks_list';
        const cached = cache.get(cacheKey);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const query = showAll 
            ? 'SELECT id, name, description, category, version, question_count, allowed_modes, enabled, updated_at FROM banks ORDER BY name'
            : 'SELECT id, name, description, category, version, question_count, allowed_modes, enabled, updated_at FROM banks WHERE enabled = 1 ORDER BY name';
        
        const [rows] = await pool.execute(query);

        const banks = rows.map(b => ({
            ...b,
            enabled: b.enabled !== 0,
            allowed_modes: b.allowed_modes ? JSON.parse(b.allowed_modes) : null
        }));

        const result = { ok: true, banks };
        cache.set(cacheKey, result, 30000); // 缓存30秒
        res.set('X-Cache', 'MISS');
        res.json(result);
    } catch (e) {
        console.error('banks error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 获取单个题库（前端） ==========
app.get('/api/bank/:id', async (req, res) => {
    try {
        const bankId = req.params.id;
        
        // 使用缓存（60秒）
        const cacheKey = `bank_${bankId}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const [rows] = await pool.execute(
            'SELECT * FROM banks WHERE id = ?',
            [bankId]
        );
        const bank = rows[0];
        if (!bank) return res.status(404).json({ error: '题库不存在' });
        if (bank.enabled === 0) return res.status(403).json({ error: '题库已禁用' });

        let questions = [];
        try { questions = JSON.parse(bank.questions_json || '[]'); } catch {
            return res.status(500).json({ error: '题库数据损坏' });
        }

        const result = {
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
        };
        cache.set(cacheKey, result, 60000); // 缓存60秒
        res.set('X-Cache', 'MISS');
        res.json(result);
    } catch (e) {
        console.error('bank error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 获取公告 ==========
app.get('/api/announce', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, content, created_at FROM announcements ORDER BY id DESC LIMIT 1'
        );
        res.json({ ok: true, announce: rows[0] || null });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST 版本（兼容）
app.post('/api/announce', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, content, created_at FROM announcements ORDER BY id DESC LIMIT 1'
        );
        res.json({ ok: true, announce: rows[0] || null });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== AI 解读（流式） ==========
app.post('/api/ai/explain', async (req, res) => {
    try {
        const { question, bankName, override } = req.body;
        if (!question) return res.status(400).json({ error: '缺少 question 参数' });

        const [rows] = await pool.execute(
            "SELECT value FROM app_config WHERE `key` = 'ai_config'"
        );
        const globalCfg = rows[0] ? JSON.parse(rows[0].value) : {};

        if (!globalCfg.enabled) return res.status(403).json({ error: 'AI 解读功能未启用' });

        const allowUser = !!globalCfg.allowUserOverride;
        const hasUserKey = allowUser && override?.apiKey && override.apiKey.length > 0;

        const provider = hasUserKey && override?.provider ? override.provider : (globalCfg.provider || 'openai');
        const baseUrl = (hasUserKey && override?.baseUrl ? override.baseUrl : (globalCfg.baseUrl || '')).replace(/\/+$/, '');
        const apiKey = hasUserKey ? override.apiKey : (globalCfg.apiKey || '');
        const model = hasUserKey && override?.model ? override.model : (globalCfg.model || 'gpt-4o-mini');
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

        if (!baseUrl) return res.status(400).json({ error: '后台未配置 Base URL' });
        if (!apiKey) return res.status(400).json({ error: '后台未配置 API 密钥' });

        let context = `题目：${question}`;
        if (bankName) context += `\n题库：${bankName}`;

        // 设置 SSE 头
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        if (provider === 'gemini') {
            const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
            const payload = {
                contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + context }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            };
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const errText = await resp.text();
                res.end(`[AI 接口错误 ${resp.status}] ${errText.slice(0, 200)}`);
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
                        if (text) res.write(text);
                    } catch {}
                }
            }
            res.end();
        } else {
            // OpenAI 兼容
            const url = `${baseUrl}/chat/completions`;
            const payload = {
                model,
                stream: true,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: context }
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
                res.end(`[AI 接口错误 ${resp.status}] ${errText.slice(0, 200)}`);
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
                    if (data === '[DONE]') { res.end(); return; }
                    try {
                        const d = JSON.parse(data);
                        const delta = d.choices?.[0]?.delta || {};
                        if (delta.reasoning_content) {
                            res.write('\x00[THINK]\x00' + delta.reasoning_content + '\x00[/THINK]\x00');
                        }
                        const token = delta.content;
                        if (token) res.write(token);
                    } catch {}
                }
            }
            res.end();
        }
    } catch (e) {
        console.error('ai explain error:', e);
        if (!res.headersSent) {
            res.status(500).json({ error: 'AI 解读失败: ' + e.message });
        } else {
            res.end(`[错误] ${e.message}`);
        }
    }
});

// ========== 日志收集 ==========
app.post('/api/logs', async (req, res) => {
    try {
        const { deviceId, logs } = req.body;
        if (!logs || !Array.isArray(logs)) {
            return res.json({ ok: false, error: '无效的日志格式' });
        }

        const did = deviceId || 'unknown';
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const [recent] = await pool.execute(
            'SELECT COUNT(*) as cnt FROM client_logs WHERE device_id = ? AND created_at > ?',
            [did, oneHourAgo]
        );

        const remaining = 100 - (recent[0]?.cnt || 0);
        if (remaining <= 0) {
            return res.json({ ok: true, dropped: logs.length });
        }

        const batch = logs.slice(0, Math.min(logs.length, remaining));
        for (const log of batch) {
            await pool.execute(
                `INSERT INTO client_logs (device_id, level, type, message, stack, page_url, source, line, col, ua, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    did,
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
                ]
            );
        }

        res.json({ ok: true, received: batch.length, dropped: logs.length - batch.length });
    } catch (e) {
        console.error('logs error:', e);
        res.status(500).json({ ok: false, error: '处理失败' });
    }
});

// ========== 管理员接口 ==========

// 管理员：查看用户
app.get('/api/admin/users', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [results] = await pool.execute(`
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
        `);

        res.json({ ok: true, users: results });
    } catch (e) {
        console.error('admin users error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：用户详情
app.get('/api/admin/user-detail/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const userId = req.params.id;
        const [users] = await pool.execute(
            'SELECT id, initials, created_at, is_admin, banned FROM users WHERE id = ?',
            [userId]
        );
        if (!users[0]) return res.status(404).json({ error: '用户不存在' });

        const [devices] = await pool.execute(
            'SELECT device_id, bound_at FROM devices WHERE user_id = ?',
            [userId]
        );

        const [stats] = await pool.execute(
            'SELECT bank_id, bank_name, answered, correct, duration, updated_at FROM stats WHERE user_id = ?',
            [userId]
        );

        res.json({ ok: true, user: users[0], devices, stats });
    } catch (e) {
        console.error('admin user-detail error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：删除用户
app.post('/api/admin/delete-user', async (req, res) => {
    try {
        const { deviceId, targetUserId, password } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (targetUserId === admin.id) return res.status(400).json({ error: '不能删除自己' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute('DELETE FROM stats WHERE user_id = ?', [targetUserId]);
            await conn.execute('DELETE FROM devices WHERE user_id = ?', [targetUserId]);
            await conn.execute('DELETE FROM users WHERE id = ?', [targetUserId]);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        await writeAdminOperationLog({ action: '删除用户', targetType: 'user', targetId: targetUserId, operator: admin.id });
        res.json({ ok: true, message: '已删除' });
    } catch (e) {
        console.error('admin delete-user error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：重置用户数据
app.post('/api/admin/reset-stats', async (req, res) => {
    try {
        const { deviceId, targetUserId, password } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        await pool.execute('DELETE FROM stats WHERE user_id = ?', [targetUserId]);
        await writeAdminOperationLog({ action: '重置用户数据', targetType: 'user', targetId: targetUserId, operator: admin.id });
        res.json({ ok: true, message: '数据已重置' });
    } catch (e) {
        console.error('admin reset-stats error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：修改用户
app.post('/api/admin/update-user', async (req, res) => {
    try {
        const { deviceId, password, targetUserId, initials, isAdmin } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const updates = [];
        const params = [];
        if (initials) { updates.push('initials = ?'); params.push(initials.trim().toUpperCase()); }
        if (isAdmin !== undefined) { updates.push('is_admin = ?'); params.push(isAdmin ? 1 : 0); }
        if (updates.length === 0) return res.status(400).json({ error: '无更新内容' });

        params.push(targetUserId);
        await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        await writeAdminOperationLog({ action: '修改用户', targetType: 'user', targetId: targetUserId, detail: JSON.stringify({ initials, isAdmin }), operator: admin.id });
        res.json({ ok: true, message: '已更新' });
    } catch (e) {
        console.error('admin update-user error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：封禁/解封
app.post('/api/admin/ban-user', async (req, res) => {
    try {
        const { deviceId, password, targetUserId, banned, ban } = req.body;
        const isBanned = banned ?? ban;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (targetUserId === admin.id) return res.status(400).json({ error: '不能封禁自己' });

        await pool.execute('UPDATE users SET banned = ? WHERE id = ?', [isBanned ? 1 : 0, targetUserId]);
        await writeAdminOperationLog({ action: isBanned ? '封禁用户' : '解封用户', targetType: 'user', targetId: targetUserId, operator: admin.id });
        res.json({ ok: true, message: isBanned ? '已封禁' : '已解封' });
    } catch (e) {
        console.error('admin ban-user error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：批量封禁
app.post('/api/admin/batch-ban', async (req, res) => {
    try {
        const { deviceId, password, userIds, banned, ban } = req.body;
        const isBanned = banned ?? ban;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: '缺少 userIds' });

        const targets = userIds.filter(id => id !== admin.id);
        if (targets.length === 0) return res.status(400).json({ error: '不能封禁自己' });

        const placeholders = targets.map(() => '?').join(', ');
        await pool.execute(
            `UPDATE users SET banned = ? WHERE id IN (${placeholders})`,
            [isBanned ? 1 : 0, ...targets]
        );

        await writeAdminOperationLog({ action: isBanned ? '批量封禁' : '批量解封', targetType: 'user', targetId: targets.join(','), detail: `${targets.length}人`, operator: admin.id });
        res.json({ ok: true, affected: targets.length });
    } catch (e) {
        console.error('admin batch-ban error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：题库统计
app.get('/api/admin/banks', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [results] = await pool.execute(`
            SELECT 
                bank_id, bank_name,
                COUNT(DISTINCT user_id) as user_count,
                SUM(answered) as total_answered,
                SUM(correct) as total_correct,
                SUM(duration) as total_duration
            FROM stats
            GROUP BY bank_id
            ORDER BY total_answered DESC
        `);

        res.json({ ok: true, banks: results });
    } catch (e) {
        console.error('admin banks error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：最近活跃
app.get('/api/admin/activity', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [results] = await pool.execute(`
            SELECT u.id, u.initials, s.bank_name, s.answered, s.correct, s.duration, s.updated_at
            FROM stats s
            JOIN users u ON s.user_id = u.id
            WHERE s.updated_at IS NOT NULL AND s.updated_at != ''
            ORDER BY s.updated_at DESC
            LIMIT 50
        `);

        res.json({ ok: true, activity: results });
    } catch (e) {
        console.error('admin activity error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：系统概览
app.get('/api/admin/overview', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const todayChina = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

        const [todayReg] = await pool.execute(
            "SELECT COUNT(*) as cnt FROM users WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ?",
            [todayChina]
        );

        const [todayActive] = await pool.execute(
            "SELECT COUNT(DISTINCT user_id) as cnt FROM stats WHERE DATE(CONVERT_TZ(updated_at, '+00:00', '+08:00')) = ?",
            [todayChina]
        );

        const [bankCount] = await pool.execute('SELECT COUNT(DISTINCT bank_id) as cnt FROM stats');
        const [bannedCount] = await pool.execute('SELECT COUNT(*) as cnt FROM users WHERE banned = 1');

        const [weekTrend] = await pool.execute(`
            SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as cnt
            FROM users
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY day
            ORDER BY day
        `);

        res.json({
            ok: true,
            overview: {
                todayReg: todayReg[0]?.cnt || 0,
                todayActive: todayActive[0]?.cnt || 0,
                bankCount: bankCount[0]?.cnt || 0,
                bannedCount: bannedCount[0]?.cnt || 0,
                weekTrend
            }
        });
    } catch (e) {
        console.error('admin overview error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：发布公告
app.post('/api/admin/announce', async (req, res) => {
    try {
        const { deviceId, password, content } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!content || content.length > 500) return res.status(400).json({ error: '公告内容1-500字' });

        await pool.execute(
            'INSERT INTO announcements (content, created_at) VALUES (?, ?)',
            [content.trim(), new Date().toISOString()]
        );

        await writeAdminOperationLog({ action: '发布公告', targetType: 'announcement', detail: content.slice(0, 100), operator: admin.id });
        res.json({ ok: true, message: '已发布' });
    } catch (e) {
        console.error('admin announce error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：公告列表
app.get('/api/admin/announcements', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [rows] = await pool.execute(
            'SELECT id, content, created_at FROM announcements ORDER BY id DESC LIMIT 50'
        );

        res.json({ ok: true, announcements: rows });
    } catch (e) {
        console.error('admin announcements error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：删除公告
app.post('/api/admin/delete-announcement', async (req, res) => {
    try {
        const { deviceId, password, id } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!id) return res.status(400).json({ error: '缺少 id' });

        await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
        await writeAdminOperationLog({ action: '删除公告', targetType: 'announcement', targetId: String(id), operator: admin.id });
        res.json({ ok: true });
    } catch (e) {
        console.error('admin delete-announcement error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：编辑公告
app.post('/api/admin/edit-announcement', async (req, res) => {
    try {
        const { deviceId, password, id, content } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!id || !content) return res.status(400).json({ error: '缺少参数' });
        if (content.length > 500) return res.status(400).json({ error: '公告不超过500字' });

        await pool.execute('UPDATE announcements SET content = ? WHERE id = ?', [content.trim(), id]);
        await writeAdminOperationLog({ action: '编辑公告', targetType: 'announcement', targetId: String(id), detail: content.slice(0, 100), operator: admin.id });
        res.json({ ok: true });
    } catch (e) {
        console.error('admin edit-announcement error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：AI 配置
app.get('/api/admin/ai-config', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [rows] = await pool.execute(
            "SELECT value FROM app_config WHERE `key` = 'ai_config'"
        );
        if (!rows[0]) {
            return res.json({ ok: true, config: { enabled: false, allowUserOverride: false, hasGlobalKey: false, mode: 'search', provider: 'openai', baseUrl: '', model: '', systemPrompt: '', updatedAt: null } });
        }
        const c = JSON.parse(rows[0].value);
        res.json({
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
        });
    } catch (e) {
        res.status(500).json({ error: '获取 AI 配置失败: ' + e.message });
    }
});

// 管理员：更新 AI 配置
app.put('/api/admin/ai-config', async (req, res) => {
    try {
        const { deviceId, password, config } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!config) return res.status(400).json({ error: '缺少 config' });

        const [rows] = await pool.execute(
            "SELECT value FROM app_config WHERE `key` = 'ai_config'"
        );
        const existing = rows[0] ? JSON.parse(rows[0].value) : {};
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

        await pool.execute(
            "INSERT INTO app_config (`key`, `value`, `updated_at`) VALUES ('ai_config', ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = VALUES(`updated_at`)",
            [JSON.stringify(merged), merged.updatedAt]
        );

        await writeAdminOperationLog({ action: '更新AI配置', targetType: 'system', detail: JSON.stringify({ enabled: merged.enabled, mode: merged.mode }), operator: admin.id });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: '保存 AI 配置失败: ' + e.message });
    }
});

// 管理员：导入题库
app.post('/api/admin/import-bank', async (req, res) => {
    try {
        const { deviceId, password, id, name, description, category, questions, allowed_modes } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!id || !name || !questions) return res.status(400).json({ error: '缺少参数' });

        const now = new Date().toISOString();
        const [existing] = await pool.execute('SELECT version, allowed_modes FROM banks WHERE id = ?', [id]);
        const version = existing[0] ? (existing[0].version || 0) + 1 : 1;
        const modesJson = allowed_modes ? JSON.stringify(allowed_modes) : (existing[0]?.allowed_modes || '');

        await pool.execute(`
            INSERT INTO banks (id, name, description, category, version, question_count, questions_json, allowed_modes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name), description = VALUES(description), category = VALUES(category),
                version = VALUES(version), question_count = VALUES(question_count),
                questions_json = VALUES(questions_json), allowed_modes = VALUES(allowed_modes),
                updated_at = VALUES(updated_at)
        `, [id, name, description || '', category || '', version, questions.length, JSON.stringify(questions), modesJson, now, now]);

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, existing[0] ? 'upload' : 'create', `${questions.length}道题`, admin.id, now]
        );

        await writeAdminOperationLog({ action: existing[0] ? '导入题库' : '创建题库', targetType: 'bank', targetId: id, detail: `${name} (${questions.length}题)`, operator: admin.id });
        res.json({ ok: true, version, count: questions.length });
    } catch (e) {
        console.error('admin import-bank error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：上传题库
app.post('/api/admin/upload-bank', async (req, res) => {
    try {
        const { deviceId, password, bank, existingId } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!bank || !bank.id || !bank.name || !bank.questions) return res.status(400).json({ error: '题库格式错误' });

        const id = existingId || bank.id;
        const now = new Date().toISOString();
        const [existing] = await pool.execute('SELECT version, allowed_modes FROM banks WHERE id = ?', [id]);
        const version = existing[0] ? (existing[0].version || 0) + 1 : 1;
        const modesJson = existing[0]?.allowed_modes || '';
        const category = bank.category || (Array.isArray(bank.categories) ? bank.categories.join(', ') : '');

        await pool.execute(`
            INSERT INTO banks (id, name, description, category, version, question_count, questions_json, allowed_modes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name), description = VALUES(description), category = VALUES(category),
                version = VALUES(version), question_count = VALUES(question_count),
                questions_json = VALUES(questions_json), allowed_modes = VALUES(allowed_modes),
                updated_at = VALUES(updated_at)
        `, [id, bank.name, bank.description || '', category, version, bank.questions.length, JSON.stringify(bank.questions), modesJson, now, now]);

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, existing[0] ? 'replace' : 'create', `${bank.questions.length}道题`, admin.id, now]
        );

        await writeAdminOperationLog({ action: existing[0] ? '替换题库' : '上传题库', targetType: 'bank', targetId: id, detail: `${bank.name} (${bank.questions.length}题)`, operator: admin.id });
        res.json({ ok: true, version, count: bank.questions.length });
    } catch (e) {
        console.error('admin upload-bank error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：获取题库详情
app.get('/api/admin/bank/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [rows] = await pool.execute('SELECT * FROM banks WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        const bank = rows[0];
        let questions = [];
        try { questions = JSON.parse(bank.questions_json || '[]'); } catch {}

        res.json({
            ok: true,
            bank: {
                ...bank,
                questions,
                questions_json: undefined,
                enabled: bank.enabled !== 0,
                allowed_modes: bank.allowed_modes ? JSON.parse(bank.allowed_modes) : null
            }
        });
    } catch (e) {
        console.error('admin get-bank error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：题库修改历史
app.get('/api/admin/bank/:id/history', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [rows] = await pool.execute(
            'SELECT * FROM bank_history WHERE bank_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.params.id]
        );

        res.json({ ok: true, history: rows });
    } catch (e) {
        console.error('admin bank-history error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：更新题库设置
app.put('/api/admin/bank/:id/settings', async (req, res) => {
    try {
        const { deviceId, password, allowed_modes, name, description, category } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const bankId = req.params.id;
        const [rows] = await pool.execute('SELECT * FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        const now = new Date().toISOString();
        const changes = [];
        let updateSql = 'UPDATE banks SET updated_at = ?';
        let params = [now];

        if (name !== undefined && name !== rows[0].name) {
            updateSql += ', name = ?';
            params.push(name);
            changes.push(`名称: "${rows[0].name}" -> "${name}"`);
        }
        if (description !== undefined) {
            updateSql += ', description = ?';
            params.push(description);
        }
        if (category !== undefined) {
            updateSql += ', category = ?';
            params.push(category);
        }
        if (allowed_modes !== undefined) {
            updateSql += ', allowed_modes = ?';
            params.push(Array.isArray(allowed_modes) ? JSON.stringify(allowed_modes) : '');
        }

        updateSql += ' WHERE id = ?';
        params.push(bankId);

        if (changes.length > 0) {
            await pool.execute(updateSql, params);
            await pool.execute(
                'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
                [bankId, 'update_settings', changes.join('; '), admin.id, now]
            );
        }

        const [updated] = await pool.execute('SELECT name, description, category, allowed_modes FROM banks WHERE id = ?', [bankId]);
        res.json({
            ok: true,
            bank: {
                name: updated[0].name,
                description: updated[0].description,
                category: updated[0].category,
                allowed_modes: updated[0].allowed_modes ? JSON.parse(updated[0].allowed_modes) : null
            }
        });
    } catch (e) {
        console.error('admin update-bank-settings error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：启用/禁用题库
app.put('/api/admin/bank/:id/toggle', async (req, res) => {
    try {
        const { deviceId, password, enabled } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const bankId = req.params.id;
        const [rows] = await pool.execute('SELECT id, name FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        const now = new Date().toISOString();
        await pool.execute('UPDATE banks SET enabled = ?, updated_at = ? WHERE id = ?', [enabled ? 1 : 0, now, bankId]);
        // 清除题库缓存
        cache.invalidate('banks_list');
        cache.invalidate('banks_list_all');
        cache.invalidate('bank_' + bankId);

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [bankId, 'toggle', `${enabled ? '启用' : '禁用'}题库`, admin.id, now]
        );

        await writeAdminOperationLog({ action: enabled ? '启用题库' : '禁用题库', targetType: 'bank', targetId: bankId, detail: rows[0].name, operator: admin.id });
        res.json({ ok: true, enabled: !!enabled });
    } catch (e) {
        console.error('admin toggle-bank error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：删除题库
app.delete('/api/admin/bank/:id', async (req, res) => {
    try {
        const { deviceId, password } = req.body || {};
        const admin = await requireAdmin(deviceId || req.query.deviceId, password || req.query.password);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const bankId = req.params.id;
        const [rows] = await pool.execute('SELECT id, name FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute('DELETE FROM stats WHERE bank_id = ?', [bankId]);
            await conn.execute('DELETE FROM bank_history WHERE bank_id = ?', [bankId]);
            await conn.execute('DELETE FROM banks WHERE id = ?', [bankId]);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        // 清除题库缓存
        cache.invalidate('banks_list');
        cache.invalidate('banks_list_all');
        cache.invalidate('bank_' + bankId);

        await writeAdminOperationLog({ action: '删除题库', targetType: 'bank', targetId: bankId, detail: rows[0].name, operator: admin.id });
        res.json({ ok: true, message: `题库 "${rows[0].name}" 已删除` });
    } catch (e) {
        console.error('admin delete-bank error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：批量导入题目
app.post('/api/admin/bank/:id/import-questions', async (req, res) => {
    try {
        const { deviceId, password, questions: newQuestions } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!Array.isArray(newQuestions) || newQuestions.length === 0) return res.status(400).json({ error: '缺少题目' });

        const bankId = req.params.id;
        const [rows] = await pool.execute('SELECT questions_json, version FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        let questions = [];
        try { questions = JSON.parse(rows[0].questions_json || '[]'); } catch {}

        const maxId = questions.reduce((max, q) => Math.max(max, q.id || 0), 0);
        let added = 0;
        const now = new Date().toISOString();

        newQuestions.forEach(q => {
            if (!q.question) return;
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
            if (question.options.length > 0) {
                question.options = question.options.map(opt => String(opt).replace(/^[A-Z][.、。\s]+/, '').trim());
            }
            if (Array.isArray(question.answer)) {
                question.answer = question.answer.join('');
            }
            questions.push(question);
            added++;
        });

        await pool.execute(
            'UPDATE banks SET questions_json = ?, question_count = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [JSON.stringify(questions), questions.length, now, bankId]
        );

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [bankId, 'batch_import', `批量导入 ${added} 题`, admin.id, now]
        );

        await writeAdminOperationLog({ action: '批量导入题目', targetType: 'bank', targetId: bankId, detail: `${added}题`, operator: admin.id });
        res.json({ ok: true, added, total: questions.length });
    } catch (e) {
        console.error('admin import-questions error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：添加单题
app.post('/api/admin/bank/:id/question', async (req, res) => {
    try {
        const { deviceId, password, question } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!question || !question.question) return res.status(400).json({ error: '缺少题目内容' });

        const bankId = req.params.id;
        const [rows] = await pool.execute('SELECT questions_json, version FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        let questions = [];
        try { questions = JSON.parse(rows[0].questions_json || '[]'); } catch {}

        const maxId = questions.reduce((max, q) => Math.max(max, q.id || 0), 0);
        question.id = maxId + 1;
        questions.push(question);

        const now = new Date().toISOString();
        await pool.execute(
            'UPDATE banks SET questions_json = ?, question_count = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [JSON.stringify(questions), questions.length, now, bankId]
        );

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [bankId, 'add_question', `添加: ${question.question.slice(0, 50)}`, admin.id, now]
        );

        res.json({ ok: true, id: question.id, count: questions.length });
    } catch (e) {
        console.error('admin add-question error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：编辑题目
app.put('/api/admin/bank/:id/question/:qid', async (req, res) => {
    try {
        const { deviceId, password, question } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const bankId = req.params.id;
        const qid = parseInt(req.params.qid);

        const [rows] = await pool.execute('SELECT questions_json FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        let questions = [];
        try { questions = JSON.parse(rows[0].questions_json || '[]'); } catch {}

        const idx = questions.findIndex(q => q.id === qid);
        if (idx === -1) return res.status(404).json({ error: '题目不存在' });

        questions[idx] = { ...questions[idx], ...question, id: qid };

        const now = new Date().toISOString();
        await pool.execute(
            'UPDATE banks SET questions_json = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [JSON.stringify(questions), now, bankId]
        );

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [bankId, 'edit_question', `编辑 #${qid}`, admin.id, now]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('admin edit-question error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：删除题目
app.delete('/api/admin/bank/:id/question/:qid', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const bankId = req.params.id;
        const qid = parseInt(req.params.qid);

        const [rows] = await pool.execute('SELECT questions_json FROM banks WHERE id = ?', [bankId]);
        if (!rows[0]) return res.status(404).json({ error: '题库不存在' });

        let questions = [];
        try { questions = JSON.parse(rows[0].questions_json || '[]'); } catch {}

        const idx = questions.findIndex(q => q.id === qid);
        if (idx === -1) return res.status(404).json({ error: '题目不存在' });

        const removed = questions.splice(idx, 1)[0];

        const now = new Date().toISOString();
        await pool.execute(
            'UPDATE banks SET questions_json = ?, question_count = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [JSON.stringify(questions), questions.length, now, bankId]
        );

        await pool.execute(
            'INSERT INTO bank_history (bank_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)',
            [bankId, 'delete_question', `删除 #${qid}: ${(removed.question || '').slice(0, 50)}`, admin.id, now]
        );

        res.json({ ok: true, count: questions.length });
    } catch (e) {
        console.error('admin delete-question error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：操作日志
app.get('/api/admin/operation-logs', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const page = Math.max(1, parseInt(req.query.page || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20')));
        const offset = (page - 1) * pageSize;

        let where = '1=1';
        const params = [];
        if (req.query.action) { where += ' AND action = ?'; params.push(req.query.action); }
        if (req.query.targetType) { where += ' AND target_type = ?'; params.push(req.query.targetType); }
        if (req.query.ok === '1') { where += ' AND ok = 1'; }
        else if (req.query.ok === '0') { where += ' AND ok = 0'; }

        const [countRows] = await pool.execute(`SELECT COUNT(*) as cnt FROM admin_operation_logs WHERE ${where}`, params);
        const total = countRows[0]?.cnt || 0;

        const [logs] = await pool.execute(
            `SELECT * FROM admin_operation_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        const [actions] = await pool.execute('SELECT DISTINCT action FROM admin_operation_logs ORDER BY action');

        res.json({ ok: true, logs, total, page, pageSize, actions: actions.map(a => a.action) });
    } catch (e) {
        console.error('admin operation-logs error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：写操作日志
app.post('/api/admin/operation-logs', async (req, res) => {
    try {
        const { deviceId, password, action, targetType, targetId, detail, ok } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!action) return res.status(400).json({ error: '缺少 action' });

        await writeAdminOperationLog({
            action,
            targetType: targetType || '',
            targetId: targetId || '',
            detail: typeof detail === 'string' ? detail.slice(0, 2000) : JSON.stringify(detail || '').slice(0, 2000),
            ok: ok !== false,
            operator: admin.id
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('admin write-log error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：系统状态
app.get('/api/admin/system-status', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const status = {};

        // MySQL check
        try {
            await pool.execute('SELECT 1');
            status.d1 = { ok: true }; // 保持字段名兼容
        } catch (e) {
            status.d1 = { ok: false, error: e.message };
        }

        // Table counts
        const tables = [];
        for (const name of ['users', 'devices', 'stats', 'banks', 'announcements', 'bank_history', 'admin_operation_logs', 'app_config']) {
            try {
                const [rows] = await pool.execute(`SELECT COUNT(*) as cnt FROM \`${name}\``);
                tables.push({ name, count: rows[0]?.cnt || 0 });
            } catch {
                tables.push({ name, count: -1 });
            }
        }
        status.tables = tables;

        try {
            const [userCount] = await pool.execute('SELECT COUNT(*) as cnt FROM users');
            const [bankCount] = await pool.execute('SELECT COUNT(*) as cnt FROM banks');
            const [announceCount] = await pool.execute('SELECT COUNT(*) as cnt FROM announcements');
            status.userCount = userCount[0]?.cnt || 0;
            status.bankCount = bankCount[0]?.cnt || 0;
            status.announcementCount = announceCount[0]?.cnt || 0;
        } catch {}

        status.workerVersion = 'v2-mysql';
        status.serverTime = new Date().toISOString();
        status.apiDomain = req.protocol + '://' + req.get('host');

        res.json({ ok: true, status });
    } catch (e) {
        console.error('admin system-status error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：修改同步码
app.post('/api/admin/change-sync-code', async (req, res) => {
    try {
        const { deviceId, password, targetUserId, newSyncCode } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!targetUserId || !newSyncCode) return res.status(400).json({ error: '缺少参数' });

        const code = newSyncCode.trim().toUpperCase();
        if (code.length < 4 || code.length > 8) return res.status(400).json({ error: '同步码4-8位' });
        if (!/^[A-Z0-9]{4,8}$/.test(code)) return res.status(400).json({ error: '同步码仅支持大写字母和数字' });

        const [exists] = await pool.execute('SELECT id FROM users WHERE id = ?', [code]);
        if (exists[0]) return res.status(400).json({ error: '该同步码已被使用' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute('UPDATE users SET id = ? WHERE id = ?', [code, targetUserId]);
            await conn.execute('UPDATE devices SET user_id = ? WHERE user_id = ?', [code, targetUserId]);
            await conn.execute('UPDATE stats SET user_id = ? WHERE user_id = ?', [code, targetUserId]);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        await writeAdminOperationLog({ action: '修改同步码', targetType: 'user', targetId: targetUserId, detail: `→ ${code}`, operator: admin.id });
        res.json({ ok: true, message: '同步码已修改', newCode: code });
    } catch (e) {
        console.error('admin change-sync-code error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：解绑设备
app.post('/api/admin/remove-device', async (req, res) => {
    try {
        const { deviceId, password, targetDeviceId } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!targetDeviceId) return res.status(400).json({ error: '缺少参数' });

        const [dev] = await pool.execute('SELECT user_id FROM devices WHERE device_id = ?', [targetDeviceId]);
        if (!dev[0]) return res.status(404).json({ error: '设备不存在' });

        const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM devices WHERE user_id = ?', [dev[0].user_id]);
        if (count[0].cnt <= 1) return res.status(400).json({ error: '该用户只有一个设备，无法解绑' });

        await pool.execute('DELETE FROM devices WHERE device_id = ?', [targetDeviceId]);

        await writeAdminOperationLog({ action: '解绑设备', targetType: 'user', targetId: dev[0].user_id, detail: targetDeviceId, operator: admin.id });
        res.json({ ok: true, message: '设备已解绑' });
    } catch (e) {
        console.error('admin remove-device error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：查看用户云端数据
app.get('/api/admin/user-cloud-data/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const [users] = await pool.execute(
            'SELECT id, initials, settings, progress, bookmarks, last_sync_at FROM users WHERE id = ?',
            [req.params.id]
        );
        if (!users[0]) return res.status(404).json({ error: '用户不存在' });

        const user = users[0];
        let settings = {}, progress = {}, bookmarks = {};
        try { settings = JSON.parse(user.settings || '{}'); } catch {}
        try { progress = JSON.parse(user.progress || '{}'); } catch {}
        try { bookmarks = JSON.parse(user.bookmarks || '{}'); } catch {}

        res.json({ ok: true, user: { id: user.id, initials: user.initials, lastSyncAt: user.last_sync_at }, settings, progress, bookmarks });
    } catch (e) {
        console.error('admin user-cloud-data error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：调整用户数据
app.post('/api/admin/adjust-stats', async (req, res) => {
    try {
        const { deviceId, password, targetUserId, bankId, bankName, answered, correct, duration } = req.body;
        const admin = await requireAdmin(deviceId, password, req);
        if (!admin) return res.status(403).json({ error: '无权限' });
        if (!targetUserId || !bankId) return res.status(400).json({ error: '缺少参数' });

        const now = new Date().toISOString();
        await pool.execute(`
            INSERT INTO stats (user_id, bank_id, bank_name, answered, correct, duration, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                answered = answered + VALUES(answered),
                correct = correct + VALUES(correct),
                duration = duration + VALUES(duration),
                updated_at = VALUES(updated_at)
        `, [targetUserId, bankId, bankName || '', answered || 0, correct || 0, duration || 0, now]);

        await writeAdminOperationLog({ action: '调整用户数据', targetType: 'user', targetId: targetUserId, detail: JSON.stringify({ bankId, answered, correct, duration }), operator: admin.id });
        res.json({ ok: true, message: '已调整' });
    } catch (e) {
        console.error('admin adjust-stats error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 管理员：前端日志
app.get('/api/admin/logs', async (req, res) => {
    try {
        const admin = await requireAdmin(null, null, req);
        if (!admin) return res.status(403).json({ error: '无权限' });

        const filterDeviceId = req.query.filterDeviceId || '';
        const level = req.query.level || '';
        const type = req.query.type || '';
        const keyword = req.query.keyword || '';
        const timeStart = req.query.timeStart || '';
        const timeEnd = req.query.timeEnd || '';
        const userName = req.query.userName || '';
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        let query = `
            SELECT cl.*, u.initials AS user_name, u.id AS sync_code
            FROM client_logs cl
            LEFT JOIN devices d ON cl.device_id = d.device_id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE 1=1`;
        const params = [];

        if (filterDeviceId) { query += ' AND cl.device_id = ?'; params.push(filterDeviceId); }
        if (level) { query += ' AND cl.level = ?'; params.push(level); }
        if (type) { query += ' AND cl.type = ?'; params.push(type); }
        if (keyword) { query += ' AND cl.message LIKE ?'; params.push('%' + keyword + '%'); }
        if (timeStart) { query += ' AND cl.created_at >= ?'; params.push(timeStart); }
        if (timeEnd) { query += ' AND cl.created_at <= ?'; params.push(timeEnd); }
        if (userName) { query += ' AND u.initials LIKE ?'; params.push('%' + userName + '%'); }

        query += ' ORDER BY cl.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [logs] = await pool.execute(query, params);

        // 总数
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

        const [countRows] = await pool.execute(countQuery, countParams);

        // 错误聚合
        const [errorSummary] = await pool.execute(`
            SELECT message, COUNT(*) as cnt
            FROM client_logs
            WHERE level = 'error' AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY message
            ORDER BY cnt DESC
            LIMIT 20
        `);

        // 活跃设备
        const [activeDevices] = await pool.execute(`
            SELECT cl.device_id, COUNT(*) as log_count, MAX(cl.created_at) as last_active,
                    u.initials AS user_name, u.id AS sync_code
            FROM client_logs cl
            LEFT JOIN devices d ON cl.device_id = d.device_id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE cl.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY cl.device_id
            ORDER BY last_active DESC
            LIMIT 20
        `);

        res.json({
            ok: true,
            logs,
            total: countRows[0]?.total || 0,
            errorSummary,
            activeDevices
        });
    } catch (e) {
        console.error('admin logs error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========== 404 ==========
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// ========== 启动服务器 ==========
app.listen(PORT, async () => {
    console.log(`\n🚀 城科卷王 API 服务器已启动`);
    console.log(`📍 地址: http://localhost:${PORT}`);
    console.log(`📊 数据库: ${config.host}:${config.port}/${config.database}`);
    
    await testConnection();
    
    console.log(`\n📋 API 文档:`);
    console.log(`   GET  /api/health          - 健康检查`);
    console.log(`   POST /api/register         - 注册用户`);
    console.log(`   POST /api/bind             - 绑定设备`);
    console.log(`   GET  /api/banks            - 题库列表`);
    console.log(`   GET  /api/leaderboard      - 排行榜`);
    console.log(`   ... 更多接口请查看源码\n`);
});
