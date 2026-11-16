/**
 * 排行榜页面模块（优化版）
 * - Top 3 领奖台展示
 * - 进度条显示相对差距
 * - 交错入场动画
 * - 粘性用户卡片
 */

import API from './api.js';
import Utils from './utils.js';
import Perf from './perf.js';

const LB = {
    currentSort: 'answered',
    // 用户显式选择的赛季 id；null = 跟随服务端当前赛季（绝不自己算赛季）
    season: null,
    // 服务端返回的赛季信息 {id,name}
    seasonInfo: null,
    // 当前激活赛季 id（用于判断"这是历史赛季"）
    activeSeasonId: null,
    // 可切换的赛季列表（来自公开接口；接口缺失时只有当前一个）
    seasons: null,

    /**
     * 读取用户显式选择的赛季：
     * - 优先 URL 上的 ?season=xxx（便于分享/深链）
     * - 其次 sessionStorage，保证切 tab/刷新不丢选择
     * - 都用 sessionStorage 而不是 localStorage，且与刷题进度完全无关（不影响正在做的题）
     */
    _readSeasonChoice() {
        try {
            const fromUrl = new URLSearchParams(location.search).get('season');
            if (fromUrl) return fromUrl;
            return sessionStorage.getItem('ks_lb_season') || null;
        } catch {
            return null;
        }
    },

    _rememberSeasonChoice(id) {
        this.season = id || null;
        try {
            if (id) sessionStorage.setItem('ks_lb_season', id);
            else sessionStorage.removeItem('ks_lb_season');
        } catch {
            /* ignore */
        }
    },

    /**
     * 查当前激活赛季 id（用一次 limit=1 的默认请求，服务端返回的 season 字段为准）
     */
    async _ensureActiveSeason() {
        if (this.activeSeasonId) return this.activeSeasonId;
        const d = await API.getLeaderboard('answered', 1);
        this.activeSeasonId = d?.season?.id || null;
        return this.activeSeasonId;
    },

    async init() {
        Perf.init('排行榜');
        Perf.mark('开始同步');
        await API.autoSync();
        Perf.mark('同步完成');

        if (!API.isRegistered()) {
            Perf.done({ registered: false });
            document.getElementById('lb-list').innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">${Utils.icon('trophy', 'icon-xl')}</div>
                    <div class="lb-empty-title">注册后即可参与排行</div>
                    <p style="margin-bottom:var(--space-4);color:var(--text-secondary);">与全站同学一起比拼学习数据</p>
                    <button class="btn btn-primary" onclick="LB.promptRegister()">立即注册加入</button>
                </div>
            `;
            return;
        }

        this.season = this._readSeasonChoice();
        await this._loadSeasonList();
        Perf.mark('加载排行榜');
        await this.loadLeaderboard();
        Perf.mark('排行榜加载完成');
        Perf.done({ registered: true });
    },

    async promptRegister() {
        const ok = await API.showRegisterModal();
        if (ok) location.reload();
    },

    async switchTab(sort) {
        this.currentSort = sort;
        document.querySelectorAll('.lb-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.sort === sort);
        });
        await this.loadLeaderboard();
    },

    async loadLeaderboard() {
        const listEl = document.getElementById('lb-list');

        // 加载状态
        listEl.innerHTML = `
            <div class="lb-loading">
                <div class="lb-loading-spinner"></div>
                <div>加载中...</div>
            </div>
        `;

        const data = await API.getLeaderboard(this.currentSort, 50, false, this.season);
        if (!data || !data.ok) {
            const isHistoryGone = data === null && this.season;
            listEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">${Utils.icon('wifi-off', 'icon-xl')}</div>
                    <div class="lb-empty-title">${isHistoryGone ? '该赛季不可用' : '加载失败'}</div>
                    <p style="color:var(--text-secondary);">${isHistoryGone ? '赛季不存在或已下线，可切回当前赛季' : '请检查网络后重试'}</p>
                    ${
                        isHistoryGone
                            ? `<button class="btn btn-secondary" style="margin-top:var(--space-3);" onclick="LB.switchSeason('')">回到当前赛季</button>`
                            : `<button class="btn btn-secondary" style="margin-top:var(--space-3);" onclick="LB.loadLeaderboard()">重新加载</button>`
                    }
                </div>
            `;
            return;
        }

        // 赛季信息一律以服务端返回为准
        this.seasonInfo = data.season || null;
        await this._ensureActiveSeason();
        this.renderSeasonBar();

        // 渲染当前用户
        this.renderCurrentUser(data.currentUser);

        const leaderboard = data.leaderboard || [];
        if (leaderboard.length === 0) {
            listEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">${Utils.icon('clipboard-list', 'icon-xl')}</div>
                    <div class="lb-empty-title">暂无数据</div>
                    <p style="color:var(--text-secondary);">成为第一个上榜的人吧！</p>
                </div>
            `;
            return;
        }

        // 更新描述
        const descMap = {
            answered: '按总答题数排名',
            accuracy: '按正确率排名（答题数≥10）',
            duration: '按累计学习时长排名'
        };
        document.getElementById('lb-desc').textContent = descMap[this.currentSort] || '';

        // 服务端只下发 isMe 标记，不再公开 syncCode
        this.renderList(leaderboard);
    },

    /**
     * 尝试拉取公开赛季列表（后端尚未提供该接口时静默跳过，选择器自动隐藏）
     */
    async _loadSeasonList() {
        try {
            const d = await API.request('/api/seasons');
            if (d?.ok && Array.isArray(d.seasons)) this.seasons = d.seasons;
        } catch {
            /* 没有这个接口就只显示当前赛季 */
        }
    },

    /**
     * 赛季信息条：名称 + 本赛季/历史赛季徽标 + 切换器
     * 历史赛季 = 只读：本页不渲染任何写入口（注册/开始刷题都不出现在这里）
     */
    renderSeasonBar() {
        const el = document.getElementById('lb-season');
        if (!el) return;
        const info = this.seasonInfo;
        if (!info || !info.id) {
            el.innerHTML = '';
            return;
        }
        const isHistory = !!this.activeSeasonId && info.id !== this.activeSeasonId;
        const list = Array.isArray(this.seasons) && this.seasons.length > 1 ? this.seasons : [];
        const options = list
            .map(
                (s) =>
                    `<option value="${Utils.escapeHtml(s.id)}" ${s.id === info.id ? 'selected' : ''}>${Utils.escapeHtml(s.name || s.id)}${s.is_active ? '（当前）' : ''}</option>`
            )
            .join('');

        el.innerHTML = `
            <div class="lb-season ${isHistory ? 'is-history' : ''}">
                <span class="lb-season-label">赛季</span>
                <strong class="lb-season-name">${Utils.escapeHtml(info.name || info.id)}</strong>
                <span class="lb-season-pill ${isHistory ? 'history' : 'active'}">
                    ${isHistory ? '历史赛季 · 只读' : '本赛季'}
                </span>
                ${
                    options
                        ? `<select class="lb-season-select" aria-label="切换赛季" onchange="LB.switchSeason(this.value)">${options}</select>`
                        : ''
                }
            </div>
            ${isHistory ? '<p class="lb-season-note">历史赛季数据已冻结，仅可查看，不能参与或修改。</p>' : ''}
        `;
        if (window.Utils && Utils.initIcons) Utils.initIcons();
    },

    /**
     * 切换赛季。选择存在 sessionStorage，与刷题进度完全无关，
     * 不会影响用户正在做的题（也不写 quiz_* 任何 key）。
     */
    async switchSeason(id) {
        this._rememberSeasonChoice(id || null);
        await this.loadLeaderboard();
    },

    renderCurrentUser(user) {
        const meEl = document.getElementById('lb-me');
        if (!user || !meEl) {
            if (meEl) {
                meEl.style.display = 'none';
                meEl.classList.remove('lb-me');
            }
            return;
        }

        const rankDisplay = `#${user.rank}`;

        // 样式全部挂在 .lb-me 上，容器本身只是 #lb-me，必须补上类名
        meEl.classList.add('lb-me');
        meEl.style.display = 'flex';
        meEl.innerHTML = `
            <div class="lb-me-rank">${rankDisplay}</div>
            <div class="lb-me-info">
                <div class="lb-me-name">
                    ${Utils.escapeHtml(user.initials)}
                    <span class="lb-me-badge">我的排名</span>
                </div>
                <div class="lb-me-stats">
                    <span class="lb-me-stat">${Utils.icon('list', 'icon-sm')} ${user.answered} 题</span>
                    <span class="lb-me-stat">${Utils.icon('target', 'icon-sm')} ${user.accuracy}% 正确率</span>
                    <span class="lb-me-stat">${Utils.icon('clock', 'icon-sm')} ${this.formatDuration(user.duration)}</span>
                </div>
            </div>
        `;
    },

    renderList(users) {
        const listEl = document.getElementById('lb-list');
        if (users.length === 0) {
            listEl.innerHTML = '';
            return;
        }

        const maxVal = this.getRawValue(users[0]);
        // 新 Worker 只下发 isMe；旧 Worker 仍下发 syncCode。
        // 前端可能先于 Worker 部署，两种都要认。
        const myCode = API.getSyncCode();

        listEl.innerHTML = users
            .map((row, index) => {
                const isMe = row.isMe === true || (!!myCode && row.syncCode === myCode);
                const rank = row.rank;
                const rawVal = this.getRawValue(row);
                const barPct = maxVal > 0 ? Math.round((rawVal / maxVal) * 100) : 0;

                // 排名样式
                let rankClass = '';
                if (rank <= 3) rankClass = `top-${rank}`;
                else if (rank <= 10) rankClass = `rank-${rank}`;

                const rowClass = rank <= 3 ? `top-${rank}` : '';

                return `
                <div class="lb-row ${rowClass} ${isMe ? 'is-me' : ''}" style="animation: rowSlideIn 0.3s ease both; animation-delay: ${Math.min(index * 0.03, 0.5)}s;">
                    <div class="lb-rank ${rankClass}">
                        <span class="lb-rank-num">${rank}</span>
                    </div>
                    <div class="lb-avatar">${row.initials?.charAt(0)?.toUpperCase() || '?'}</div>
                    <div class="lb-name">
                        ${Utils.escapeHtml(row.initials)}
                        ${isMe ? '<span class="lb-name-tag">← 我</span>' : ''}
                    </div>
                    <div class="lb-value-wrap">
                        <div class="lb-value">${this.formatValue(row)}</div>
                        <div class="lb-sub">${this.formatSub(row)}</div>
                    </div>
                    <div class="lb-row-bar" style="width:${barPct}%;"></div>
                </div>
            `;
            })
            .join('');
    },

    /**
     * 获取排序字段的原始数值（用于进度条计算）
     */
    getRawValue(row) {
        switch (this.currentSort) {
            case 'answered':
                return row.answered || 0;
            case 'accuracy':
                return row.accuracy || 0;
            case 'duration':
                return row.duration || 0;
            default:
                return 0;
        }
    },

    formatValue(row) {
        switch (this.currentSort) {
            case 'answered':
                return (row.answered || 0) + ' 题';
            case 'accuracy':
                return (row.accuracy || 0) + '%';
            case 'duration':
                return this.formatDuration(row.duration);
            default:
                return '';
        }
    },

    formatSub(row) {
        switch (this.currentSort) {
            case 'answered':
                return `正确率 ${row.accuracy || 0}%`;
            case 'accuracy':
                return `${row.answered || 0} 题`;
            case 'duration':
                return `${row.answered || 0} 题`;
            default:
                return '';
        }
    },

    formatDuration(seconds) {
        if (!seconds || seconds < 60) return (seconds || 0) + '秒';
        if (seconds < 3600) return Math.floor(seconds / 60) + '分钟';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}时${m}分` : `${h}小时`;
    }
};

window.LB = LB;

// 仅在独立页面载入或当前路由匹配时执行自动初始化
if (
    window.location.pathname.includes('leaderboard.html') ||
    window.location.hash === '#/leaderboard'
) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => LB.init());
    } else {
        LB.init();
    }
}
