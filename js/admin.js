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

    async init() {
        Perf.init('管理后台');
        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') this.login(); });
        if (this.password) await this.loadAll();
    },

    // ==================== 登录 ====================

    async login() {
        const pwd = document.getElementById('admin-password').value.trim();
        if (!pwd) return;
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
                this.showApp();
            } else {
                err.textContent = (d && d.error) || '密码错误';
                err.style.display = 'block';
            }
        } catch (e) {
            err.textContent = '网络错误: ' + e.message;
            err.style.display = 'block';
        }
    },

    logout() { 
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
            this.showApp();
        } catch (e) { 
            console.error('[Admin] ❌ 登录验证异常:', e.message);
            // 网络错误时不清除密码，下次刷新再试
            if (!this._loginVerified) {
                localStorage.removeItem('admin_pwd'); 
                sessionStorage.removeItem('admin_pwd'); 
            }
        }
    },

    showApp() {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('admin-app').style.display = '';
        this.renderTab();
    },

    switchTab(t) {
        this.tab = t;
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

    async post(path, body) {
        try {
            const r = await fetch(API.BASE_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: API.getDeviceId(), password: this.password, ...body }) });
            if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
            return await r.json();
        } catch (e) { return { ok: false, error: e.message }; }
    },

    async put(path, body) {
        try {
            const r = await fetch(API.BASE_URL + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: API.getDeviceId(), password: this.password, ...body }) });
            if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
            return await r.json();
        } catch (e) { return { ok: false, error: e.message }; }
    },

    async delete(path, body = {}) {
        try {
            const r = await fetch(API.BASE_URL + path, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: API.getDeviceId(), password: this.password, ...body }) });
            if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
            return await r.json();
        } catch (e) { return { ok: false, error: e.message }; }
    },

    async get(path) { return this.getWithAuth(path, this.password); },

    async getWithAuth(path, pwd) {
        try {
            const url = API.BASE_URL + path;
            const r = await fetch(url, { headers: { 'X-Admin-Password': pwd, 'X-Admin-Device-Id': API.getDeviceId() } });
            if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
            return await r.json();
        } catch (e) { return { ok: false, error: e.message }; }
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
