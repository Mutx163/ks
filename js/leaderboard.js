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

    async init() {
        Perf.init('排行榜');
        Perf.mark('开始同步');
        await API.autoSync();
        Perf.mark('同步完成');

        if (!API.isRegistered()) {
            Perf.done({ registered: false });
            document.getElementById('lb-list').innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">🏆</div>
                    <div class="lb-empty-title">注册后即可参与排行</div>
                    <p style="margin-bottom:var(--space-4);color:var(--text-secondary);">与全站同学一起比拼学习数据</p>
                    <button class="btn btn-primary" onclick="LB.promptRegister()">立即注册加入</button>
                </div>
            `;
            return;
        }

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
        document.querySelectorAll('.lb-tab').forEach(tab => {
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

        const data = await API.getLeaderboard(this.currentSort, 50);
        if (!data || !data.ok) {
            listEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">📡</div>
                    <div class="lb-empty-title">加载失败</div>
                    <p style="color:var(--text-secondary);">请检查网络后重试</p>
                    <button class="btn btn-secondary" style="margin-top:var(--space-3);" onclick="LB.loadLeaderboard()">重新加载</button>
                </div>
            `;
            return;
        }

        // 渲染当前用户
        this.renderCurrentUser(data.currentUser);

        const leaderboard = data.leaderboard || [];
        if (leaderboard.length === 0) {
            listEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">📭</div>
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

        const myCode = API.getSyncCode();

        // 全部渲染到一个列表，Top 3 通过 CSS 特殊样式区分
        this.renderList(leaderboard, myCode);
    },

    renderCurrentUser(user) {
        const meEl = document.getElementById('lb-me');
        if (!user || !meEl) {
            if (meEl) meEl.style.display = 'none';
            return;
        }

        const rankDisplay = user.rank <= 3
            ? ['🥇', '🥈', '🥉'][user.rank - 1]
            : `#${user.rank}`;

        meEl.style.display = 'flex';
        meEl.innerHTML = `
            <div class="lb-me-rank">${rankDisplay}</div>
            <div class="lb-me-info">
                <div class="lb-me-name">
                    ${Utils.escapeHtml(user.initials)}
                    <span class="lb-me-badge">我的排名</span>
                </div>
                <div class="lb-me-stats">
                    <span class="lb-me-stat">📊 ${user.answered} 题</span>
                    <span class="lb-me-stat">🎯 ${user.accuracy}% 正确率</span>
                    <span class="lb-me-stat">⏱ ${this.formatDuration(user.duration)}</span>
                </div>
            </div>
        `;
    },

    renderList(users, myCode) {
        const listEl = document.getElementById('lb-list');
        if (users.length === 0) {
            listEl.innerHTML = '';
            return;
        }

        const maxVal = this.getRawValue(users[0]);

        listEl.innerHTML = users.map((row, index) => {
            const isMe = row.syncCode === myCode;
            const rank = row.rank;
            const rawVal = this.getRawValue(row);
            const barPct = maxVal > 0 ? Math.round((rawVal / maxVal) * 100) : 0;

            // 排名样式
            let rankClass = '';
            if (rank <= 3) rankClass = `top-${rank}`;
            else if (rank <= 10) rankClass = `rank-${rank}`;

            const medalIcon = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : '';
            const rowClass = rank <= 3 ? `top-${rank}` : '';

            return `
                <div class="lb-row ${rowClass} ${isMe ? 'is-me' : ''}" style="animation: rowSlideIn 0.3s ease both; animation-delay: ${Math.min(index * 0.03, 0.5)}s;">
                    <div class="lb-rank ${rankClass}">
                        ${medalIcon || `<span class="lb-rank-num">${rank}</span>`}
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
        }).join('');
    },

    /**
     * 获取排序字段的原始数值（用于进度条计算）
     */
    getRawValue(row) {
        switch (this.currentSort) {
            case 'answered': return row.answered || 0;
            case 'accuracy': return row.accuracy || 0;
            case 'duration': return row.duration || 0;
            default: return 0;
        }
    },

    formatValue(row) {
        switch (this.currentSort) {
            case 'answered': return (row.answered || 0) + ' 题';
            case 'accuracy': return (row.accuracy || 0) + '%';
            case 'duration': return this.formatDuration(row.duration);
            default: return '';
        }
    },

    formatSub(row) {
        switch (this.currentSort) {
            case 'answered': return `正确率 ${row.accuracy || 0}%`;
            case 'accuracy': return `${row.answered || 0} 题`;
            case 'duration': return `${row.answered || 0} 题`;
            default: return '';
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
document.addEventListener('DOMContentLoaded', () => LB.init());
