/**
 * 排行榜页面模块
 */

import API from './api.js';
import Utils from './utils.js';

const LB = {
    currentSort: 'answered',

    async init() {
        // 自动同步
        await API.autoSync();

        // 未注册则提示
        if (!API.isRegistered()) {
            document.getElementById('lb-list').innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">🏆</div>
                    <p>注册后即可参与排行</p>
                    <button class="btn btn-primary" onclick="LB.promptRegister()">注册加入</button>
                </div>
            `;
            return;
        }

        await this.loadLeaderboard();
    },

    async promptRegister() {
        const ok = await API.showRegisterModal();
        if (ok) {
            location.reload();
        }
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
        listEl.innerHTML = '<div class="lb-loading">加载中...</div>';

        const data = await API.getLeaderboard(this.currentSort, 50);
        if (!data || !data.ok) {
            listEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">📡</div>
                    <p>加载失败，请稍后重试</p>
                </div>
            `;
            return;
        }

        // 渲染当前用户
        this.renderCurrentUser(data.currentUser);

        // 渲染排行榜
        if (data.leaderboard.length === 0) {
            listEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty-icon">📭</div>
                    <p>暂无数据，成为第一个上榜的人吧！</p>
                </div>
            `;
            return;
        }

        const myCode = API.getSyncCode();
        listEl.innerHTML = data.leaderboard.map(row => {
            const isMe = row.syncCode === myCode;
            const rankClass = row.rank <= 3 ? `top-${row.rank}` : '';
            const value = this.formatValue(row);

            return `
                <div class="lb-row ${isMe ? 'is-me' : ''}">
                    <div class="lb-rank ${rankClass}">${row.rank}</div>
                    <div class="lb-avatar">${row.initials || '?'}</div>
                    <div class="lb-name">
                        ${Utils.escapeHtml(row.initials)}
                        ${isMe ? '<span style="color:var(--primary);font-size:12px;">← 我</span>' : ''}
                    </div>
                    <div style="text-align:right;">
                        <div class="lb-value">${value}</div>
                        <div class="lb-sub">${this.formatSub(row)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 描述
        const descMap = {
            'answered': '按总答题数排名',
            'accuracy': '按正确率排名（答题数≥10）',
            'duration': '按累计学习时长排名'
        };
        document.getElementById('lb-desc').textContent = descMap[this.currentSort] || '';
    },

    renderCurrentUser(user) {
        const meEl = document.getElementById('lb-me');
        if (!user || !meEl) {
            if (meEl) meEl.style.display = 'none';
            return;
        }

        meEl.style.display = 'flex';
        meEl.innerHTML = `
            <div class="lb-me-rank">#${user.rank}</div>
            <div class="lb-me-info">
                <div class="lb-me-name">${Utils.escapeHtml(user.initials)}（我）</div>
                <div class="lb-me-stats">
                    <span>📊 ${user.answered} 题</span>
                    <span>🎯 ${user.accuracy}%</span>
                    <span>⏱ ${this.formatDuration(user.duration)}</span>
                </div>
            </div>
        `;
    },

    formatValue(row) {
        switch (this.currentSort) {
            case 'answered': return row.answered + ' 题';
            case 'accuracy': return row.accuracy + '%';
            case 'duration': return this.formatDuration(row.duration);
            default: return '';
        }
    },

    formatSub(row) {
        switch (this.currentSort) {
            case 'answered': return `正确率 ${row.accuracy}%`;
            case 'accuracy': return `${row.answered} 题`;
            case 'duration': return `${row.answered} 题`;
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
