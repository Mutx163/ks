/**
 * 管理后台 - 主入口
 */
import API from './api.js';
import Utils from './utils.js';
import Perf from './perf.js';
import { initUsers } from './admin-users.js';
import { initBanks } from './admin-banks.js';
import { initEditor } from './admin-editor.js';
import { initAnnounce } from './admin-announce.js';

const Admin = {
    users: [],
    password: (() => {
        const saved = localStorage.getItem('admin_pwd');
        if (!saved) return sessionStorage.getItem('admin_pwd') || '';
        try {
            const { pwd, ts, remember } = JSON.parse(saved);
            // 根据"记住我"设置判断有效期
            const maxAge = remember ? 7 * 24 * 3600000 : 24 * 3600000; // 7天 或 24小时
            if (Date.now() - ts > maxAge) { 
                localStorage.removeItem('admin_pwd'); 
                return ''; 
            }
            return pwd;
        } catch { localStorage.removeItem('admin_pwd'); return ''; }
    })(),
    sort: 'time',
    tab: 'overview',
    _loginVerified: false, // 标记是否已验证过密码

    logAction(action, detail = {}, level = 'info') {
        const time = new Date().toISOString();
        const safeDetail = this._sanitizeLogDetail(detail);
        const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        logger(`[Admin][${time}] ${action}`, safeDetail);
    },

    _sanitizeLogDetail(detail) {
        const secretKeys = new Set(['password', 'pwd', 'token', 'authorization', 'x-admin-password']);
        try {
            return JSON.parse(
                JSON.stringify(detail, (key, value) => {
                    if (secretKeys.has(String(key).toLowerCase())) return '***';
                    if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '...';
                    return value;
                })
            );
        } catch (_e) {
            return { note: '日志详情不可序列化' };
        }
    },

    bindOperationLogger() {
        if (document.body.dataset.adminLogBound === '1') return;
        document.body.dataset.adminLogBound = '1';

        const inAdminArea = (target) =>
            Boolean(
                target.closest('#login-page') ||
                    target.closest('#admin-app') ||
                    target.closest('#modal-root')
            );

        document.addEventListener('click', (e) => {
            const target = e.target.closest('button,.tab,[onclick]');
            if (!target || !inAdminArea(target)) return;
            this.logAction('后台界面点击', {
                tag: target.tagName,
                id: target.id || '',
                className: target.className || '',
                text: (target.textContent || '').trim().slice(0, 80),
                tab: target.dataset?.tab || ''
            });
        });

        document.addEventListener('change', (e) => {
            const target = e.target;
            if (!target || !inAdminArea(target)) return;
            const type = target.type || target.tagName;
            this.logAction('后台表单变更', {
                tag: target.tagName,
                id: target.id || '',
                name: target.name || '',
                type,
                value: type === 'password' || type === 'file' ? '[hidden]' : String(target.value || '').slice(0, 120)
            });
        });
    },

    async init() {
        Perf.init('管理后台');
        this.logAction('初始化后台');
        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') this.login(); });
        this.bindOperationLogger();
        
        if (this.password) {
            // 快速显示界面，后台验证密码
            console.log('[Admin] ⚡ 快速进入模式');
            this.showApp();
            this.loadAllInBackground();
        }
    },

    // 后台验证密码（不阻塞界面显示）
    async loadAllInBackground() {
        try {
            const d = await this.get('/api/admin/users');
            if (d?.ok) {
                console.log('[Admin] ✅ 后台验证成功');
                this.users = d.users;
                this._loginVerified = true;
                this.renderTab();
            } else {
                console.warn('[Admin] ⚠️ 密码已过期，需要重新登录');
                this.logout();
            }
        } catch (e) {
            console.warn('[Admin] ⚠️ 验证失败，保留本地数据:', e.message);
            // 网络错误不清除密码，使用缓存数据
        }
    },

    // ==================== 登录 ====================

    async login() {
        const pwd = document.getElementById('admin-password').value.trim();
        if (!pwd) return;
        this.logAction('后台登录尝试', { remember: document.getElementById('remember-me')?.checked || false });
        const remember = document.getElementById('remember-me')?.checked || false;
        const err = document.getElementById('login-error');
        err.style.display = 'none';
        try {
            const d = await this.getWithAuth('/api/admin/users', pwd);
            if (d && d.ok) {
                // 保存密码，包含"记住我"状态
                localStorage.setItem('admin_pwd', JSON.stringify({ 
                    pwd, 
                    ts: Date.now(),
                    remember 
                }));
                sessionStorage.setItem('admin_pwd', pwd);
                this.password = pwd;
                this.users = d.users;
                this._loginVerified = true;
                this.logAction('后台登录成功', { userCount: this.users.length });
                this.showApp();
            } else {
                this.logAction('后台登录失败', { error: (d && d.error) || '密码错误' }, 'warn');
                err.textContent = (d && d.error) || '密码错误';
                err.style.display = 'block';
            }
        } catch (e) {
            this.logAction('后台登录异常', { error: e.message }, 'error');
            err.textContent = '网络错误: ' + e.message;
            err.style.display = 'block';
        }
    },

    logout() { 
        this.logAction('后台退出登录');
        localStorage.removeItem('admin_pwd'); 
        sessionStorage.removeItem('admin_pwd'); 
        this._loginVerified = false;
        location.reload(); 
    },

    async loadAll() {
        console.log('[Admin] 🔐 验证登录状态...');
        try {
            const d = await this.get('/api/admin/users');
            if (!d?.ok) { 
                console.warn('[Admin] ❌ 登录验证失败');
                localStorage.removeItem('admin_pwd'); 
                sessionStorage.removeItem('admin_pwd'); 
                return; 
            }
            console.log('[Admin] ✅ 登录验证成功');
            this.users = d.users;
            this._loginVerified = true;
        } catch (e) { 
            console.error('[Admin] ❌ 登录验证异常:', e.message);
        }
    },

    showApp() {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('admin-app').style.display = '';
        // 恢复上次的标签页
        const savedTab = localStorage.getItem('admin_tab') || 'overview';
        this.switchTab(savedTab);
    },

    switchTab(t) {
        this.logAction('后台切换标签页', { from: this.tab, to: t });
        this.tab = t;
        // 保存当前标签到 localStorage
        localStorage.setItem('admin_tab', t);
        document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
        document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === 'sec-' + t));
        this.renderTab();
    },

    async renderTab() {
        const map = { overview: 'renderOverview', users: 'renderUsers', banks: 'renderBanks', activity: 'renderActivity', announce: 'renderAnnounce' };
        if (map[this.tab]) await this[map[this.tab]]();
    },

    // ==================== 总览 ====================

    async renderOverview() {
        const el = document.getElementById('sec-overview');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/admin/overview');
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            const o = d.overview;
            const total = this.users.reduce((s, u) => s + u.total_answered, 0);
            const dur = this.users.reduce((s, u) => s + u.total_duration, 0);
            const acc = total > 0 ? Math.round(this.users.reduce((s, u) => s + u.total_correct, 0) / total * 100) : 0;
            const maxCnt = Math.max(...o.weekTrend.map(w => w.cnt), 1);
            el.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon purple">${Utils.icon('users')}</div><div class="stat-info"><div class="stat-value">${this.users.length}</div><div class="stat-label">注册用户</div></div></div>
                    <div class="stat-card"><div class="stat-icon blue">${Utils.icon('check-circle')}</div><div class="stat-info"><div class="stat-value">${this.fmtN(total)}</div><div class="stat-label">总答题数</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${Utils.icon('target')}</div><div class="stat-info"><div class="stat-value">${acc}%</div><div class="stat-label">平均正确率</div></div></div>
                    <div class="stat-card"><div class="stat-icon orange">${Utils.icon('clock')}</div><div class="stat-info"><div class="stat-value">${this.fmtDur(dur)}</div><div class="stat-label">总学习时长</div></div></div>
                </div>
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon blue">${Utils.icon('user-plus')}</div><div class="stat-info"><div class="stat-value">${o.todayReg}</div><div class="stat-label">今日注册</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${Utils.icon('activity')}</div><div class="stat-info"><div class="stat-value">${o.todayActive}</div><div class="stat-label">今日活跃</div></div></div>
                    <div class="stat-card"><div class="stat-icon purple">${Utils.icon('book-open')}</div><div class="stat-info"><div class="stat-value">${o.bankCount}</div><div class="stat-label">题库总数</div></div></div>
                    <div class="stat-card"><div class="stat-icon red">${Utils.icon('shield-off')}</div><div class="stat-info"><div class="stat-value">${o.bannedCount}</div><div class="stat-label">封禁用户</div></div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>近7天注册趋势</h3></div>
                    <div class="trend-chart">${o.weekTrend.map(w => `<div class="trend-bar" style="height:${Math.max(w.cnt/maxCnt*60,3)}px"><span class="trend-value">${w.cnt}</span><span class="trend-label">${(this.fmtDate(w.day)||'').slice(5)}</span></div>`).join('') || '<div class="empty-state">暂无数据</div>'}</div>
                </div>`;
            Utils.initIcons?.();
        } catch (e) { el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    },

    // ==================== 活跃 ====================

    async renderActivity() {
        const el = document.getElementById('sec-activity');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/admin/activity');
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            el.innerHTML = d.activity.length === 0 ? '<div class="empty-state">暂无记录</div>' : `
                <div class="card">
                    <div class="card-header"><h3>最近活跃</h3><span class="count">50条</span></div>
                    <div class="timeline">${d.activity.map(a => `
                        <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
                            <div class="tl-title"><b>${Utils.escapeHtml(a.initials)}</b> ${Utils.escapeHtml(a.bank_name||'')} · ${a.answered}题 · 正确${a.correct}</div>
                            <div class="tl-sub">${this.fmtDur(a.duration)} · ${this.fmtTime(a.updated_at)}</div>
                        </div></div>
                    `).join('')}</div>
                </div>`;
        } catch (e) { el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    },

    // ==================== 工具 ====================

    async requestAdmin(method, path, body = {}, options = {}) {
        const startedAt = Date.now();
        const requestId = `${method}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const urlObj = new URL(path, API.BASE_URL);
        if (method === 'GET') {
            urlObj.searchParams.set('_ts', Date.now().toString());
        }
        const url = urlObj.toString();
        const payload = options.authInBody
            ? { deviceId: API.getDeviceId(), password: this.password, ...body }
            : body;

        this.logAction('后台接口请求开始', { requestId, method, path, body: payload });

        try {
            const fetchOptions = {
                method,
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
            };

            if (method !== 'GET') {
                fetchOptions.body = JSON.stringify(payload);
            }

            const r = await fetch(url, fetchOptions);
            const text = await r.text();
            let data = null;
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (_e) {
                    data = { ok: false, error: '非 JSON 响应', raw: text.slice(0, 200) };
                }
            }

            const result = r.ok ? data : { ok: false, error: data?.error || `HTTP ${r.status}` };
            this.logAction(r.ok ? '后台接口请求成功' : '后台接口请求失败', {
                requestId,
                method,
                path,
                status: r.status,
                elapsedMs: Date.now() - startedAt,
                response: result
            }, r.ok ? 'info' : 'warn');
            return result;
        } catch (e) {
            const result = { ok: false, error: e.message };
            this.logAction('后台接口请求异常', {
                requestId,
                method,
                path,
                elapsedMs: Date.now() - startedAt,
                error: e.message
            }, 'error');
            return result;
        }
    },

    async post(path, body) {
        return await this.requestAdmin('POST', path, body, { authInBody: true });
    },

    async put(path, body) {
        return await this.requestAdmin('PUT', path, body, { authInBody: true });
    },

    async delete(path, body = {}) {
        return await this.requestAdmin('DELETE', path, body, { authInBody: true });
    },

    async get(path) { return this.getWithAuth(path, this.password); },

    async getWithAuth(path, pwd) {
        return await this.requestAdmin('GET', path, {}, {
            headers: { 'X-Admin-Password': pwd, 'X-Admin-Device-Id': API.getDeviceId() }
        });
    },

    fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n; },
    fmtDur(s) { if (!s || s < 60) return (s || 0) + '秒'; if (s < 3600) return Math.floor(s / 60) + '分'; return (s / 3600).toFixed(1) + '时'; },
    /** 将 UTC ISO 字符串转为北京时间显示 */
    fmtTime(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const bj = new Date(d.getTime() + 8 * 3600000);
            return bj.toISOString().replace('T', ' ').slice(0, 16);
        } catch { return iso; }
    },
    /** UTC ISO 转北京时间日期 */
    fmtDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const bj = new Date(d.getTime() + 8 * 3600000);
            return bj.toISOString().slice(0, 10);
        } catch { return iso; }
    }
};

// 注册子模块
initUsers(Admin);
initBanks(Admin);
initEditor(Admin);
initAnnounce(Admin);

// 挂载全局
window.Admin = Admin;

// 初始化
Admin.init();
