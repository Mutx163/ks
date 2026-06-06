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
import { initAI } from './admin-ai.js';
import { initLogs } from './admin-logs.js';
import { initStatus } from './admin-status.js';

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
        } catch {
            localStorage.removeItem('admin_pwd');
            return '';
        }
    })(),
    sort: 'time',
    tab: 'overview',
    _loginVerified: false, // 标记是否已验证过密码
    _routeBound: false,

    logAction(action, detail = {}, level = 'info') {
        const time = new Date().toISOString();
        const safeDetail = this._sanitizeLogDetail(detail);
        const logger =
            level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        logger(`[Admin][${time}] ${action}`, safeDetail);
    },

    _sanitizeLogDetail(detail) {
        const secretKeys = new Set([
            'password',
            'pwd',
            'token',
            'authorization',
            'x-admin-password'
        ]);
        try {
            return JSON.parse(
                JSON.stringify(detail, (key, value) => {
                    if (secretKeys.has(String(key).toLowerCase())) return '***';
                    if (typeof value === 'string' && value.length > 500)
                        return value.slice(0, 500) + '...';
                    return value;
                })
            );
        } catch {
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
                value:
                    type === 'password' || type === 'file'
                        ? '[hidden]'
                        : String(target.value || '').slice(0, 120)
            });
        });
    },

    async init() {
        Perf.init('管理后台');
        this.logAction('初始化后台');
        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.login();
        });
        this.bindOperationLogger();
        this.bindRouter();

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
                this.handleRoute();
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
        this.logAction('后台登录尝试', {
            remember: document.getElementById('remember-me')?.checked || false
        });
        const remember = document.getElementById('remember-me')?.checked || false;
        const err = document.getElementById('login-error');
        err.style.display = 'none';
        try {
            const d = await this.getWithAuth('/api/admin/users', pwd);
            if (d && d.ok) {
                // 保存密码，包含"记住我"状态
                localStorage.setItem(
                    'admin_pwd',
                    JSON.stringify({
                        pwd,
                        ts: Date.now(),
                        remember
                    })
                );
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
        this.bindRouter();
        this.handleRoute();
    },

    bindRouter() {
        if (this._routeBound) return;
        this._routeBound = true;
        window.addEventListener('hashchange', () => this.handleRoute());
    },

    hashForTab(t) {
        const map = {
            overview: '#/overview',
            users: '#/users',
            banks: '#/banks',
            activity: '#/activity',
            announce: '#/announce',
            ai: '#/ai',
            logs: '#/logs',
            status: '#/status'
        };
        return map[t] || '#/overview';
    },

    navigate(hash) {
        if (location.hash === hash) this.handleRoute();
        else location.hash = hash;
    },

    activateTab(t) {
        this.tab = t;
        localStorage.setItem('admin_tab', t);
        document
            .querySelectorAll('.tab')
            .forEach((el) => el.classList.toggle('active', el.dataset.tab === t));
        document
            .querySelectorAll('.section')
            .forEach((el) => el.classList.toggle('active', el.id === 'sec-' + t));
    },

    switchTab(t, { pushHash = true } = {}) {
        this.logAction('后台切换标签页', { from: this.tab, to: t });
        if (pushHash) {
            this.navigate(this.hashForTab(t));
            return;
        }
        this.activateTab(t);
        this.renderTab();
    },

    async handleRoute() {
        if (document.getElementById('admin-app')?.style.display === 'none') return;
        const valid = ['overview', 'users', 'banks', 'activity', 'announce', 'ai', 'logs', 'status'];
        const saved = localStorage.getItem('admin_tab');
        const fallback = valid.includes(saved) ? saved : 'overview';
        const parts = decodeURIComponent((location.hash || `#/${fallback}`).replace(/^#\/?/, ''))
            .split('/')
            .filter(Boolean);
        const main = parts[0] || fallback;
        if (main === 'users' && parts[1]) {
            this.activateTab('users');
            await this.showUserDetail(parts[1], { pushHash: false });
            return;
        }
        if (main === 'banks' && parts[1] && parts[2] === 'questions') {
            this.activateTab('banks');
            await this.showQuestionList(parts[1], '', { pushHash: false });
            return;
        }
        if (main === 'banks' && parts[1]) {
            this.activateTab('banks');
            await this.showBankDetail(parts[1], { pushHash: false });
            return;
        }
        this.switchTab(valid.includes(main) ? main : 'overview', { pushHash: false });
    },

    async renderTab() {
        const map = {
            overview: 'renderOverview',
            users: 'renderUsers',
            banks: 'renderBanks',
            activity: 'renderActivity',
            announce: 'renderAnnounce',
            ai: 'renderAI',
            logs: 'renderLogs',
            status: 'renderStatus'
        };
        if (map[this.tab]) await this[map[this.tab]]();
    },


    pageHeader({ title, description = '', crumbs = ['管理后台'], actions = '' }) {
        const safeCrumbs = crumbs.map((c) => `<span>${Utils.escapeHtml(c)}</span>`).join('');
        return `
            <div class="page-head">
                <div class="page-meta">
                    <div class="breadcrumb">${safeCrumbs}</div>
                    <h1 class="page-title">${Utils.escapeHtml(title)}</h1>
                    ${description ? `<div class="page-desc">${Utils.escapeHtml(description)}</div>` : ''}
                </div>
                ${actions ? `<div class="page-actions">${actions}</div>` : ''}
            </div>`;
    },

    emptyState({ title = '暂无数据', desc = '', action = '' } = {}) {
        return `<div class="empty-state"><strong>${Utils.escapeHtml(title)}</strong>${desc ? `<div>${Utils.escapeHtml(desc)}</div>` : ''}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
    },

    statusPill(enabled, labels = {}) {
        const label = enabled ? labels.enabled || '启用' : labels.disabled || '禁用';
        return `<span class="status-pill ${enabled ? 'enabled' : 'disabled'}">${Utils.escapeHtml(label)}</span>`;
    },

    pager({ page = 1, pageSize = 20, total = 0, onPage, onPageSize, pageSizes = [10, 20, 50, 100] }) {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
        const end = Math.min(total, safePage * pageSize);
        const prev = Math.max(1, safePage - 1);
        const next = Math.min(totalPages, safePage + 1);
        return `
            <div class="pager">
                <div class="pager-info">显示 ${start}-${end} / 共 ${total} 条</div>
                <div class="pager-actions">
                    <select class="admin-select pager-size" onchange="${onPageSize}(parseInt(this.value, 10))">
                        ${pageSizes.map((size) => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
                    </select>
                    <button class="abtn" ${safePage <= 1 ? 'disabled' : ''} onclick="${onPage}(${prev})">上一页</button>
                    <span class="pager-current">${safePage} / ${totalPages}</span>
                    <button class="abtn" ${safePage >= totalPages ? 'disabled' : ''} onclick="${onPage}(${next})">下一页</button>
                </div>
            </div>`;
    },

    async confirmDanger({
        title = '确认操作',
        message = '',
        targetLabel = '',
        requiredText = '',
        confirmText = '确认',
        danger = true
    } = {}) {
        const id = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const root = document.getElementById('modal-root');
        root.innerHTML = `
            <div class="modal-mask" id="${id}-mask">
                <div class="modal-box ${danger ? 'danger-modal' : ''}">
                    <h3>${Utils.escapeHtml(title)}</h3>
                    ${targetLabel ? `<p style="font-size:13px;color:var(--admin-text-secondary);margin-bottom:8px">对象：<strong>${Utils.escapeHtml(targetLabel)}</strong></p>` : ''}
                    ${message ? `<p style="font-size:13px;color:${danger ? 'var(--admin-danger)' : 'var(--admin-text-secondary)'};margin-bottom:10px">${Utils.escapeHtml(message)}</p>` : ''}
                    ${
                        requiredText
                            ? `
                        <label>请输入 <code>${Utils.escapeHtml(requiredText)}</code> 确认</label>
                        <input class="confirm-input" id="${id}-input" autocomplete="off" placeholder="${Utils.escapeHtml(requiredText)}">
                    `
                            : ''
                    }
                    <div class="modal-actions">
                        <button class="ms" type="button" id="${id}-cancel">取消</button>
                        <button class="${danger ? 'danger' : 'mp'}" type="button" id="${id}-ok" ${requiredText ? 'disabled' : ''}>${Utils.escapeHtml(confirmText)}</button>
                    </div>
                </div>
            </div>`;

        return await new Promise((resolve) => {
            const mask = document.getElementById(`${id}-mask`);
            const input = document.getElementById(`${id}-input`);
            const ok = document.getElementById(`${id}-ok`);
            const cancel = document.getElementById(`${id}-cancel`);
            const close = (value) => {
                mask?.remove();
                resolve(value);
            };
            mask?.addEventListener('click', (e) => {
                if (e.target === mask) close(false);
            });
            cancel?.addEventListener('click', () => close(false));
            input?.addEventListener('input', () => {
                ok.disabled = input.value.trim() !== requiredText;
            });
            ok?.addEventListener('click', () => close(true));
        });
    },

    // ==================== 总览 ====================

    async renderOverview() {
        const el = document.getElementById('sec-overview');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/admin/overview');
            if (!d?.ok) {
                el.innerHTML = '<div class="empty-state">加载失败</div>';
                return;
            }
            const o = d.overview;
            const total = this.users.reduce((s, u) => s + u.total_answered, 0);
            const dur = this.users.reduce((s, u) => s + u.total_duration, 0);
            const acc =
                total > 0
                    ? Math.round(
                          (this.users.reduce((s, u) => s + u.total_correct, 0) / total) * 100
                      )
                    : 0;
            const maxCnt = Math.max(...o.weekTrend.map((w) => w.cnt), 1);
            el.innerHTML = `
                ${this.pageHeader({
                    title: '总览',
                    description: '查看平台运行、用户增长、答题规模与题库核心状态。',
                    crumbs: ['管理后台', '总览'],
                    actions:
                        '<button class="abtn" onclick="Admin.renderOverview()">刷新数据</button>'
                })}
                <div class="system-notice"><span class="notice-dot"></span><div>数据实时来自云端 Worker/D1 API。题库启用或禁用后，前台列表会通过无缓存请求立即获取最新状态。</div></div>
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon">${Utils.icon('users')}</div><div class="stat-info"><div class="stat-value">${this.users.length}</div><div class="stat-label">注册用户</div></div></div>
                    <div class="stat-card"><div class="stat-icon">${Utils.icon('check-circle')}</div><div class="stat-info"><div class="stat-value">${this.fmtN(total)}</div><div class="stat-label">总答题数</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${Utils.icon('target')}</div><div class="stat-info"><div class="stat-value">${acc}%</div><div class="stat-label">平均正确率</div></div></div>
                    <div class="stat-card"><div class="stat-icon orange">${Utils.icon('clock')}</div><div class="stat-info"><div class="stat-value">${this.fmtDur(dur)}</div><div class="stat-label">总学习时长</div></div></div>
                </div>
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon">${Utils.icon('user-plus')}</div><div class="stat-info"><div class="stat-value">${o.todayReg}</div><div class="stat-label">今日注册</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${Utils.icon('activity')}</div><div class="stat-info"><div class="stat-value">${o.todayActive}</div><div class="stat-label">今日活跃</div></div></div>
                    <div class="stat-card"><div class="stat-icon">${Utils.icon('book-open')}</div><div class="stat-info"><div class="stat-value">${o.bankCount}</div><div class="stat-label">题库总数</div></div></div>
                    <div class="stat-card"><div class="stat-icon red">${Utils.icon('shield-off')}</div><div class="stat-info"><div class="stat-value">${o.bannedCount}</div><div class="stat-label">封禁用户</div></div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>近 7 天注册趋势</h3><span class="count">按天统计</span></div>
                    <div class="trend-chart">${o.weekTrend.map((w) => `<div class="trend-bar" style="height:${Math.max((w.cnt / maxCnt) * 60, 3)}px"><span class="trend-value">${w.cnt}</span><span class="trend-label">${(this.fmtDate(w.day) || '').slice(5)}</span></div>`).join('') || this.emptyState({ title: '暂无趋势数据' })}</div>
                </div>`;
            Utils.initIcons?.();
        } catch (e) {
            el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
        }
    },

    // ==================== 活跃 ====================

    async renderActivity() {
        const el = document.getElementById('sec-activity');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/admin/activity');
            if (!d?.ok) {
                el.innerHTML = '<div class="empty-state">加载失败</div>';
                return;
            }
            el.innerHTML = `
                ${this.pageHeader({
                    title: '活跃记录',
                    description: '查看最近用户学习行为，用于判断题库活跃度与同步状态。',
                    crumbs: ['管理后台', '活跃记录'],
                    actions: '<button class="abtn" onclick="Admin.renderActivity()">刷新</button>'
                })}
                ${
                    d.activity.length === 0
                        ? this.emptyState({
                              title: '暂无活跃记录',
                              desc: '用户完成答题并同步后会显示在这里。'
                          })
                        : `
                <div class="card">
                    <div class="card-header"><h3>最近活跃</h3><span class="count">最近 50 条</span></div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>用户</th><th>题库</th><th>答题</th><th>正确</th><th>学习时长</th><th>更新时间</th></tr></thead>
                            <tbody>${d.activity
                                .map(
                                    (a) => `
                                <tr>
                                    <td><strong>${Utils.escapeHtml(a.initials)}</strong></td>
                                    <td>${Utils.escapeHtml(a.bank_name || '-')}</td>
                                    <td>${a.answered}</td>
                                    <td>${a.correct}</td>
                                    <td>${this.fmtDur(a.duration)}</td>
                                    <td>${this.fmtTime(a.updated_at)}</td>
                                </tr>
                            `
                                )
                                .join('')}</tbody>
                        </table>
                    </div>
                </div>`
                }`;
        } catch (e) {
            el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
        }
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
                } catch {
                    data = { ok: false, error: '非 JSON 响应', raw: text.slice(0, 200) };
                }
            }

            const result = r.ok ? data : { ok: false, error: data?.error || `HTTP ${r.status}` };
            this.logAction(
                r.ok ? '后台接口请求成功' : '后台接口请求失败',
                {
                    requestId,
                    method,
                    path,
                    status: r.status,
                    elapsedMs: Date.now() - startedAt,
                    response: result
                },
                r.ok ? 'info' : 'warn'
            );
            return result;
        } catch (e) {
            const result = { ok: false, error: e.message };
            this.logAction(
                '后台接口请求异常',
                {
                    requestId,
                    method,
                    path,
                    elapsedMs: Date.now() - startedAt,
                    error: e.message
                },
                'error'
            );
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

    async get(path) {
        return this.getWithAuth(path, this.password);
    },

    async getWithAuth(path, pwd) {
        return await this.requestAdmin(
            'GET',
            path,
            {},
            {
                headers: { 'X-Admin-Password': pwd, 'X-Admin-Device-Id': API.getDeviceId() }
            }
        );
    },

    fmtN(n) {
        return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
    },
    fmtDur(s) {
        if (!s || s < 60) return (s || 0) + '秒';
        if (s < 3600) return Math.floor(s / 60) + '分';
        return (s / 3600).toFixed(1) + '时';
    },
    /** 将 UTC ISO 字符串转为北京时间显示 */
    fmtTime(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const bj = new Date(d.getTime() + 8 * 3600000);
            return bj.toISOString().replace('T', ' ').slice(0, 16);
        } catch {
            return iso;
        }
    },
    /** UTC ISO 转北京时间日期 */
    fmtDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const bj = new Date(d.getTime() + 8 * 3600000);
            return bj.toISOString().slice(0, 10);
        } catch {
            return iso;
        }
    }
};

// 注册子模块
initUsers(Admin);
initBanks(Admin);
initEditor(Admin);
initAnnounce(Admin);
initAI(Admin);
initLogs(Admin);
initStatus(Admin);

// 挂载全局
window.Admin = Admin;

// 初始化
Admin.init();
