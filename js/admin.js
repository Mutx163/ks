/**
 * 管理后台 - 主入口
 */

// 导入 vendor 模块（打包进构建）
import './vendor/lucide.js';

import API from './api.js';
import Utils from './utils.js';
import Perf from './perf.js';
import { initUsers } from './admin-users.js';
import { initBanks } from './admin-banks.js';
import { initEditor } from './admin-editor.js';
import { initAnnounce } from './admin-announce.js';
import { initAI } from './admin-ai.js';
import { initLogs } from './admin-logs.js';
import { initClientLogs } from './admin-client-logs.js';
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
        
        // 构建详细的日志前缀
        const prefix = `[Admin][${time}]`;
        const tabInfo = this.tab ? `[Tab:${this.tab}]` : '';
        const loginInfo = this._loginVerified ? '[已验证]' : '[未验证]';
        
        logger(`${prefix}${tabInfo}${loginInfo} ${action}`, safeDetail);
        
        // 错误级别时输出调用栈
        if (level === 'error') {
            console.trace('[Admin] 错误调用栈:');
        }
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

    /**
     * 处理 modal-mask 点击关闭，防止滑动选择文字时误关闭
     * 用法：onclick="Admin.onMaskClick(event)"
     */
    onMaskClick(event) {
        const mask = event.currentTarget;
        // 只有点击目标是遮罩层本身（不是子元素）才关闭
        if (event.target !== mask) return;
        // 如果有文本被选中，不关闭（防止滑动复制时误关闭）
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        mask.remove();
    },

    bindTabKeyboard() {
        const tabsContainer = document.getElementById('tabs');
        if (!tabsContainer || tabsContainer._kbBound) return;
        tabsContainer._kbBound = true;
        tabsContainer.addEventListener('keydown', (e) => {
            const tabs = [...tabsContainer.querySelectorAll('.tab')];
            const current = tabs.findIndex((t) => t.dataset.tab === this.tab);
            let next = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                next = (current + 1) % tabs.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                next = (current - 1 + tabs.length) % tabs.length;
            } else if (e.key === 'Home') {
                next = 0;
            } else if (e.key === 'End') {
                next = tabs.length - 1;
            }
            if (next >= 0) {
                e.preventDefault();
                this.switchTab(tabs[next].dataset.tab);
            }
        });
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
        this.logAction('初始化后台', {
            hasPassword: !!this.password,
            currentHash: location.hash,
            localStorageKeys: Object.keys(localStorage).filter(k => k.startsWith('admin_')).length,
            browserInfo: {
                userAgent: navigator.userAgent.slice(0, 100),
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled
            },
            timestamp: new Date().toISOString()
        });
        
        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.login();
        });
        this.bindOperationLogger();
        this.bindTabKeyboard();
        this.bindRouter();

        if (this.password) {
            // 快速显示界面，后台验证密码
            this.logAction('快速进入模式', {
                passwordLength: this.password.length,
                savedTab: localStorage.getItem('admin_tab') || 'overview'
            });
            console.log('[Admin] ⚡ 快速进入模式');
            this.showApp();
            this.loadAllInBackground();
        } else {
            this.logAction('需要登录', {
                reason: '无保存的密码'
            });
        }
    },

    // 后台验证密码（不阻塞界面显示）
    async loadAllInBackground() {
        const startTime = Date.now();
        this.logAction('后台验证开始', {
            currentTab: this.tab,
            timestamp: new Date().toISOString()
        });
        
        try {
            const d = await this.get('/api/admin/users');
            const elapsedMs = Date.now() - startTime;
            
            if (d?.ok) {
                this.logAction('后台验证成功', {
                    userCount: d.users?.length || 0,
                    elapsedMs,
                    elapsedFormatted: elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(2)}s`,
                    response: { ok: d.ok, userCount: d.users?.length }
                });
                console.log('[Admin] ✅ 后台验证成功');
                this.users = d.users;
                this._loginVerified = true;
                this.handleRoute();
            } else {
                this.logAction('后台验证失败', {
                    reason: '密码已过期或无效',
                    elapsedMs,
                    response: d
                }, 'warn');
                console.warn('[Admin] ⚠️ 密码已过期，需要重新登录');
                this.logout();
            }
        } catch (e) {
            const elapsedMs = Date.now() - startTime;
            this.logAction('后台验证异常', {
                error: e.message,
                errorName: e.name,
                elapsedMs,
                reason: '网络错误，保留本地数据'
            }, 'warn');
            console.warn('[Admin] ⚠️ 验证失败，保留本地数据:', e.message);
            // 网络错误不清除密码，使用缓存数据
        }
    },

    // ==================== 登录 ====================

    async login() {
        const pwd = document.getElementById('admin-password').value.trim();
        if (!pwd) {
            this.logAction('登录尝试失败', { reason: '密码为空' });
            return;
        }
        const remember = document.getElementById('remember-me')?.checked || false;
        
        this.logAction('后台登录尝试', {
            remember,
            passwordLength: pwd.length,
            timestamp: new Date().toISOString()
        });
        
        const err = document.getElementById('login-error');
        err.style.display = 'none';
        
        const startTime = Date.now();
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
                this.logAction('后台登录成功', {
                    userCount: this.users.length,
                    elapsedMs: Date.now() - startTime,
                    response: { ok: d.ok, userCount: d.users?.length }
                });
                this.showApp();
            } else {
                this.logAction('后台登录失败', {
                    error: (d && d.error) || '密码错误',
                    elapsedMs: Date.now() - startTime,
                    response: d
                }, 'warn');
                err.textContent = (d && d.error) || '密码错误';
                err.style.display = 'block';
            }
        } catch (e) {
            this.logAction('后台登录异常', {
                error: e.message,
                errorName: e.name,
                elapsedMs: Date.now() - startTime
            }, 'error');
            err.textContent = '网络错误: ' + e.message;
            err.style.display = 'block';
        }
    },

    logout() {
        this.logAction('后台退出登录', {
            currentTab: this.tab,
            userCount: this.users?.length || 0,
            timestamp: new Date().toISOString()
        });
        localStorage.removeItem('admin_pwd');
        sessionStorage.removeItem('admin_pwd');
        this._loginVerified = false;
        location.reload();
    },

    async loadAll() {
        const startTime = Date.now();
        this.logAction('刷新用户数据开始', {
            currentTab: this.tab,
            currentUserCount: this.users?.length || 0
        });
        console.log('[Admin] 🔐 验证登录状态...');
        
        try {
            const d = await this.get('/api/admin/users');
            const elapsedMs = Date.now() - startTime;
            
            if (!d?.ok) {
                this.logAction('刷新用户数据失败', {
                    reason: '登录验证失败',
                    elapsedMs,
                    response: d
                }, 'warn');
                console.warn('[Admin] ❌ 登录验证失败');
                localStorage.removeItem('admin_pwd');
                sessionStorage.removeItem('admin_pwd');
                return;
            }
            
            this.logAction('刷新用户数据成功', {
                userCount: d.users?.length || 0,
                elapsedMs,
                elapsedFormatted: elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(2)}s`
            });
            console.log('[Admin] ✅ 登录验证成功');
            this.users = d.users;
            this._loginVerified = true;
        } catch (e) {
            const elapsedMs = Date.now() - startTime;
            this.logAction('刷新用户数据异常', {
                error: e.message,
                errorName: e.name,
                elapsedMs
            }, 'error');
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
        // ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const mask = document.querySelector('.modal-mask');
                if (mask) {
                    const cancelBtn = mask.querySelector('[id$="-cancel"]');
                    if (cancelBtn) cancelBtn.click();
                }
            }
        });
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
            'client-logs': '#/client-logs',
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
        document.querySelectorAll('.tab').forEach((el) => {
            const isActive = el.dataset.tab === t;
            el.classList.toggle('active', isActive);
            el.setAttribute('aria-selected', isActive ? 'true' : 'false');
            el.setAttribute('tabindex', isActive ? '0' : '-1');
        });
        document
            .querySelectorAll('.section')
            .forEach((el) => el.classList.toggle('active', el.id === 'sec-' + t));
        // 将焦点移到激活的 Tab
        const activeTab = document.querySelector(`.tab[data-tab="${t}"]`);
        if (activeTab && document.activeElement?.closest('.tabs')) activeTab.focus();
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
        const valid = [
            'overview',
            'users',
            'banks',
            'activity',
            'announce',
            'ai',
            'logs',
            'client-logs',
            'status'
        ];
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
            'client-logs': 'renderClientLogs',
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

    pager({
        page = 1,
        pageSize = 20,
        total = 0,
        onPage,
        onPageSize,
        pageSizes = [10, 20, 50, 100]
    }) {
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
                    ${targetLabel ? `<p class="confirm-meta">对象：<strong>${Utils.escapeHtml(targetLabel)}</strong></p>` : ''}
                    ${message ? `<p class="confirm-msg ${danger ? 'danger' : 'default'}">${Utils.escapeHtml(message)}</p>` : ''}
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

    // ==================== 总览 - 高端设计 ====================

    // 骨架屏渲染
    _renderOverviewSkeleton() {
        return `
            ${this.pageHeader({
                title: '总览',
                description: '查看平台运行、用户增长、答题规模与题库核心状态。',
                crumbs: ['管理后台', '总览'],
                actions: '<button class="abtn" disabled>刷新数据</button>'
            })}
            
            <!-- Hero 骨架屏 -->
            <div class="overview-hero">
                <div class="hero-metric hero-metric-primary">
                    <div class="skeleton skeleton-text" style="width:100px;height:14px;margin-bottom:8px"></div>
                    <div class="skeleton skeleton-value" style="width:120px;height:48px"></div>
                    <div class="skeleton skeleton-text-sm" style="width:140px;margin-top:8px"></div>
                </div>
                <div class="hero-metric">
                    <div class="skeleton skeleton-text" style="width:80px;height:14px;margin-bottom:8px"></div>
                    <div style="display:flex;align-items:center;gap:20px">
                        <div class="skeleton skeleton-circle" style="width:80px;height:80px;border-radius:50%"></div>
                        <div>
                            <div class="skeleton skeleton-value" style="width:60px;height:32px;margin-bottom:8px"></div>
                            <div class="skeleton skeleton-text-sm" style="width:100px"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 今日数据骨架屏 -->
            <div class="overview-grid">
                <div class="today-stats">
                    ${Array(4)
                        .fill(
                            `
                        <div class="today-stat-item">
                            <div class="skeleton skeleton-circle"></div>
                            <div class="today-stat-info">
                                <div class="skeleton skeleton-value" style="width:60px;height:24px;margin-bottom:6px"></div>
                                <div class="skeleton skeleton-text-sm" style="width:80px"></div>
                            </div>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="skeleton skeleton-text" style="width:120px;height:16px"></div>
                        <div class="skeleton skeleton-text-sm" style="width:60px"></div>
                    </div>
                    <div class="trend-list">
                        ${Array(7)
                            .fill(
                                `
                            <div class="trend-list-item">
                                <div class="trend-list-date">
                                    <div class="skeleton" style="width:32px;height:20px;margin:0 auto 4px"></div>
                                    <div class="skeleton" style="width:24px;height:10px;margin:0 auto"></div>
                                </div>
                                <div class="trend-list-bar-track">
                                    <div class="skeleton skeleton-bar"></div>
                                </div>
                                <div class="trend-list-count">
                                    <div class="skeleton" style="width:40px;height:16px;margin-left:auto"></div>
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>
            </div>
            
            <!-- 指标卡片骨架屏 -->
            <div class="stat-grid">
                ${Array(4)
                    .fill(
                        `
                    <div class="stat-card">
                        <div class="skeleton skeleton-circle"></div>
                        <div class="stat-info">
                            <div class="skeleton skeleton-value" style="margin-bottom:6px"></div>
                            <div class="skeleton skeleton-text-sm" style="width:60px"></div>
                        </div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;
    },

    async renderOverview() {
        const el = document.getElementById('sec-overview');

        // 显示骨架屏
        el.innerHTML = this._renderOverviewSkeleton();

        try {
            const d = await this.get('/api/admin/overview');
            if (!d?.ok) {
                el.innerHTML = `
                    ${this.pageHeader({
                        title: '总览',
                        description: '查看平台运行、用户增长、答题规模与题库核心状态。',
                        crumbs: ['管理后台', '总览'],
                        actions:
                            '<button class="abtn" onclick="Admin.renderOverview()">重试</button>'
                    })}
                    <div class="empty-state">
                        <strong>加载失败</strong>
                        <div class="error-desc">${d?.error || '无法获取数据，请检查网络连接'}</div>
                        <button class="abtn primary error-retry" onclick="Admin.renderOverview()">重新加载</button>
                    </div>
                `;
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

            // 计算题库分布（取前5个最活跃的题库）
            // 暂时使用简化版本

            el.innerHTML = `
                ${this.pageHeader({
                    title: '总览',
                    description: '查看平台运行、用户增长、答题规模与题库核心状态。',
                    crumbs: ['管理后台', '总览'],
                    actions:
                        '<button class="abtn" onclick="Admin.renderOverview()">刷新数据</button>'
                })}
                
                <!-- 系统通知 -->
                <div class="system-notice">
                    <span class="notice-dot"></span>
                    <div>数据实时来自云端 Worker/D1 API。题库启用或禁用后，前台列表会通过无缓存请求立即获取最新状态。</div>
                </div>
                
                <!-- Hero 指标区域 -->
                <div class="overview-hero" role="region" aria-label="核心数据概览">
                    <div class="hero-metric hero-metric-primary">
                        <div class="hero-label">总答题数</div>
                        <div class="hero-value" aria-label="${this.fmtN(total)} 题">${this.fmtN(total)}</div>
                        <div class="hero-subtitle">${this.users.length} 位用户参与</div>
                    </div>
                    <div class="hero-metric">
                        <div class="hero-label">平均正确率</div>
                        <div class="flex-center-gap">
                            <div class="ring-progress" style="--progress:${acc}" role="img" aria-label="正确率 ${acc}%">
                                <span class="ring-progress-value">${acc}%</span>
                            </div>
                            <div>
                                <div class="hero-stat-value">${acc}%</div>
                                <div class="hero-stat-sub">正确率</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 今日数据 + 趋势图 -->
                <div class="overview-grid">
                    <div class="today-stats" role="list" aria-label="今日运营数据">
                        <div class="today-stat-item" role="listitem" aria-label="今日注册 ${o.todayReg} 人">
                            <div class="today-stat-icon" aria-hidden="true">${Utils.icon('user-plus')}</div>
                            <div class="today-stat-info">
                                <div class="today-stat-value">${o.todayReg}</div>
                                <div class="today-stat-label">今日注册</div>
                            </div>
                        </div>
                        <div class="today-stat-item" role="listitem" aria-label="今日活跃 ${o.todayActive} 人">
                            <div class="today-stat-icon green" aria-hidden="true">${Utils.icon('activity')}</div>
                            <div class="today-stat-info">
                                <div class="today-stat-value">${o.todayActive}</div>
                                <div class="today-stat-label">今日活跃</div>
                            </div>
                        </div>
                        <div class="today-stat-item" role="listitem" aria-label="题库总数 ${o.bankCount} 个">
                            <div class="today-stat-icon orange" aria-hidden="true">${Utils.icon('book-open')}</div>
                            <div class="today-stat-info">
                                <div class="today-stat-value">${o.bankCount}</div>
                                <div class="today-stat-label">题库总数</div>
                            </div>
                        </div>
                        <div class="today-stat-item" role="listitem" aria-label="封禁用户 ${o.bannedCount} 人">
                            <div class="today-stat-icon red" aria-hidden="true">${Utils.icon('shield-off')}</div>
                            <div class="today-stat-info">
                                <div class="today-stat-value">${o.bannedCount}</div>
                                <div class="today-stat-label">封禁用户</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3>近 7 天注册趋势</h3>
                            <span class="count">按天统计</span>
                        </div>
                        <div class="trend-list" role="list" aria-label="近7天注册趋势数据">
                            ${
                                o.weekTrend.length > 0
                                    ? o.weekTrend
                                          .map(
                                              (w, i) => `
                                <div class="trend-list-item" role="listitem" style="animation-delay:${i * 60}ms" aria-label="${this.fmtDate(w.day)} 注册 ${w.cnt} 人">
                                    <div class="trend-list-date">
                                        <span class="trend-list-day">${(this.fmtDate(w.day) || '').slice(8)}</span>
                                        <span class="trend-list-month">${(this.fmtDate(w.day) || '').slice(5, 7)}月</span>
                                    </div>
                                    <div class="trend-list-bar-track" role="img" aria-label="${w.cnt} 人">
                                        <div class="trend-list-bar" style="width:${Math.max((w.cnt / maxCnt) * 100, 2)}%"></div>
                                    </div>
                                    <div class="trend-list-count">
                                        <span class="trend-list-value">${w.cnt}</span>
                                        <span class="trend-list-unit">人</span>
                                    </div>
                                </div>
                            `
                                          )
                                          .join('')
                                    : `
                                <div class="trend-list-empty">
                                    <span>暂无趋势数据</span>
                                </div>
                            `
                            }
                        </div>
                    </div>
                </div>
                
                <!-- 底部指标卡片 -->
                <div class="stat-grid" role="list" aria-label="平台核心指标">
                    <div class="stat-card" role="listitem" aria-label="注册用户 ${this.users.length} 人">
                        <div class="stat-icon" aria-hidden="true">${Utils.icon('users')}</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.users.length}</div>
                            <div class="stat-label">注册用户</div>
                        </div>
                    </div>
                    <div class="stat-card" role="listitem" aria-label="总答题数 ${this.fmtN(total)} 题">
                        <div class="stat-icon green" aria-hidden="true">${Utils.icon('check-circle')}</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.fmtN(total)}</div>
                            <div class="stat-label">总答题数</div>
                        </div>
                    </div>
                    <div class="stat-card" role="listitem" aria-label="平均正确率 ${acc}%">
                        <div class="stat-icon orange" aria-hidden="true">${Utils.icon('target')}</div>
                        <div class="stat-info">
                            <div class="stat-value">${acc}%</div>
                            <div class="stat-label">平均正确率</div>
                        </div>
                    </div>
                    <div class="stat-card" role="listitem" aria-label="总学习时长 ${this.fmtDur(dur)}">
                        <div class="stat-icon" aria-hidden="true">${Utils.icon('clock')}</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.fmtDur(dur)}</div>
                            <div class="stat-label">总学习时长</div>
                        </div>
                    </div>
                </div>
            `;

            Utils.initIcons?.();

            // 添加入场动画
            this._animateOverviewEntry();
        } catch (e) {
            el.innerHTML = `
                ${this.pageHeader({
                    title: '总览',
                    description: '查看平台运行、用户增长、答题规模与题库核心状态。',
                    crumbs: ['管理后台', '总览'],
                    actions: '<button class="abtn" onclick="Admin.renderOverview()">重试</button>'
                })}
                <div class="empty-state">
                    <strong>加载失败</strong>
                    <div class="error-desc">${e.message}</div>
                    <button class="abtn primary error-retry" onclick="Admin.renderOverview()">重新加载</button>
                </div>
            `;
        }
    },

    // 总览页入场动画
    _animateOverviewEntry() {
        const elements = document.querySelectorAll(
            '#sec-overview .overview-hero, #sec-overview .overview-grid, #sec-overview .stat-grid'
        );
        elements.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(16px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.transitionDelay = `${i * 100}ms`;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                });
            });
        });
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

        // 详细的请求开始日志
        this.logAction('后台接口请求开始', {
            requestId,
            method,
            path,
            fullUrl: url,
            body: payload,
            bodySize: JSON.stringify(payload).length,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            timestamp: new Date().toISOString(),
            currentTab: this.tab
        });

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

            const elapsedMs = Date.now() - startedAt;
            const result = r.ok ? data : { ok: false, error: data?.error || `HTTP ${r.status}` };
            
            // 详细的响应日志
            const logData = {
                requestId,
                method,
                path,
                fullUrl: url,
                status: r.status,
                statusText: r.statusText,
                elapsedMs,
                elapsedFormatted: elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(2)}s`,
                response: result,
                responseSize: text.length,
                responseOk: r.ok,
                timestamp: new Date().toISOString()
            };

            // 慢请求警告 (>1000ms)
            if (elapsedMs > 1000) {
                this.logAction('⚠️ 慢请求警告', {
                    requestId,
                    method,
                    path,
                    elapsedMs,
                    threshold: '1000ms'
                }, 'warn');
            }

            this.logAction(
                r.ok ? '后台接口请求成功' : '后台接口请求失败',
                logData,
                r.ok ? 'info' : 'warn'
            );
            return result;
        } catch (e) {
            const elapsedMs = Date.now() - startedAt;
            const result = { ok: false, error: e.message };
            this.logAction(
                '后台接口请求异常',
                {
                    requestId,
                    method,
                    path,
                    fullUrl: url,
                    elapsedMs,
                    error: e.message,
                    errorName: e.name,
                    errorStack: e.stack?.split('\n').slice(0, 3).join('\n'),
                    timestamp: new Date().toISOString()
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
initClientLogs(Admin);
initStatus(Admin);

// 挂载全局
window.Admin = Admin;

// 初始化
Admin.init();
