/**
 * 主应用模块
 */

import Storage from './storage.js';
import Utils from './utils.js';

const App = {
    builtinBanks: ['c-language.json', 'engineering-mechanics.json'],

    state: {
        banks: [],
        stats: null,
        filterType: 'all',
        lightningMode: false
    },

    async init() {
        await this.loadBuiltinBanks();
        this.loadData();
        this.render();
        this.bindEvents();
    },

    async loadBuiltinBanks() {
        for (const filename of this.builtinBanks) {
            try {
                const response = await fetch(`banks/${filename}`);
                if (response.ok) {
                    const bank = await response.json();
                    const localBank = Storage.getBank(bank.id);
                    if (!localBank || localBank.version !== bank.version) {
                        Storage.addBank(bank);
                    }
                }
            } catch (e) {
                console.error(`Failed to load ${filename}:`, e);
            }
        }
    },

    loadData() {
        this.state.banks = Storage.getBanks();
        this.state.stats = Storage.getGlobalStats();
    },

    render() {
        this.renderStats();
        this.renderTodayDue();
        this.renderWeakCategories();
        this.renderTrend();
        this.renderBankGrid();
    },

    renderStats() {
        const stats = this.state.stats;
        document.getElementById('stat-banks').textContent = stats.bankCount;
        document.getElementById('stat-questions').textContent = Utils.formatNumber(stats.totalQuestions);
        document.getElementById('stat-answered').textContent = Utils.formatNumber(stats.totalAnswered);
        document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
    },

    /**
     * 渲染今日待复习
     */
    renderTodayDue() {
        const dueCount = Storage.getTodayDueCount();
        const el = document.getElementById('today-due');
        if (!el) return;

        if (dueCount > 0) {
            el.innerHTML = `
                <div class="due-banner">
                    <div class="due-banner-icon">🧠</div>
                    <div class="due-banner-info">
                        <div class="due-banner-title">今日待复习</div>
                        <div class="due-banner-desc">有 ${dueCount} 道题需要复习，间隔重复有助于长期记忆</div>
                    </div>
                    <button class="btn btn-primary" onclick="App.startSmartReview()">开始复习</button>
                </div>
            `;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    },

    /**
     * 渲染学习趋势（最近7天正确率）
     */
    renderTrend() {
        const el = document.getElementById('trend-section');
        if (!el) return;

        const history = Storage.getHistory();
        if (history.length < 2) {
            el.style.display = 'none';
            return;
        }

        // 按天聚合
        const dayMap = {};
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = `${d.getMonth() + 1}/${d.getDate()}`;
            dayMap[key] = { correct: 0, total: 0 };
        }

        for (const h of history) {
            const d = new Date(h.timestamp);
            const key = `${d.getMonth() + 1}/${d.getDate()}`;
            if (dayMap[key]) {
                dayMap[key].correct += h.correct || 0;
                dayMap[key].total += h.total || 0;
            }
        }

        const days = Object.entries(dayMap);
        const maxTotal = Math.max(1, ...days.map(([_, d]) => d.total));

        el.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">📈 学习趋势（近7天）</h2>
            </div>
            <div class="trend-chart">
                ${days.map(([label, data]) => {
                    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    const barHeight = data.total > 0 ? Math.max(4, Math.round((data.total / maxTotal) * 100)) : 0;
                    return `
                        <div class="trend-bar-group">
                            <div class="trend-bar-value">${data.total > 0 ? accuracy + '%' : '-'}</div>
                            <div class="trend-bar-track">
                                <div class="trend-bar-fill" style="height: ${barHeight}%"></div>
                            </div>
                            <div class="trend-bar-label">${label}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        el.style.display = '';
    },

    /**
     * 渲染薄弱知识点
     */
    renderWeakCategories() {
        const el = document.getElementById('weak-categories');
        if (!el) return;

        const allWeak = [];
        for (const bank of this.state.banks) {
            const weak = Storage.getWeakCategories(bank.id, 3);
            for (const w of weak) {
                allWeak.push({ bankName: bank.name, bankId: bank.id, ...w });
            }
        }

        // 全局排序取最弱的 5 个
        allWeak.sort((a, b) => a.accuracy - b.accuracy);
        const topWeak = allWeak.slice(0, 5);

        if (topWeak.length > 0) {
            el.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">📊 薄弱知识点</h2>
                </div>
                <div class="weak-list">
                    ${topWeak.map(w => `
                        <div class="weak-item">
                            <div class="weak-item-info">
                                <span class="weak-item-name">${Utils.escapeHtml(w.name)}</span>
                                <span class="weak-item-bank">${Utils.escapeHtml(w.bankName)}</span>
                            </div>
                            <div class="weak-item-stats">
                                <span class="weak-item-accuracy ${w.accuracy < 60 ? 'danger' : w.accuracy < 80 ? 'warning' : ''}">${w.accuracy}%</span>
                                <span class="weak-item-detail">${w.correct}/${w.answered} 正确</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    },

    /**
     * 渲染题库网格
     */
    renderBankGrid() {
        const container = document.getElementById('bank-grid');
        const banks = this.state.banks;
        const filterType = this.state.filterType;

        if (banks.length === 0) {
            container.innerHTML = `
                <div class="bank-empty">
                    <div class="bank-empty-title">加载题库中...</div>
                </div>
            `;
            return;
        }

        container.innerHTML = banks.map(bank => {
            const stats = Storage.getBankStats(bank.id);
            const wrongCount = Storage.getWrongQuestions(bank.id).length;
            const dueCount = Storage.getDueQuestions(bank.id).length;
            const bookmarkCount = Storage.getBookmarkCount(bank.id);
            
            // 按题型统计
            const questions = bank.questions || [];
            const typeCount = filterType === 'all' ? questions.length : questions.filter(q => q.type === filterType).length;
            const typeLabel = filterType === 'all' ? '共' : `筛选`;
            
            if (typeCount === 0 && filterType !== 'all') return '';
            const iconClass = bank.id.includes('c-language') ? 'c-lang' : 
                             bank.id.includes('mechanics') ? 'mechanics' : 'default';
            const iconText = bank.id.includes('c-language') ? 'C' : 
                            bank.id.includes('mechanics') ? 'M' : 'Q';
            
            return `
                <div class="bank-card" data-id="${bank.id}">
                    <div class="bank-card-header">
                        <div class="bank-card-icon ${iconClass}">${iconText}</div>
                        <div class="bank-card-info">
                            <div class="bank-card-title">${Utils.escapeHtml(bank.name)}</div>
                            <div class="bank-card-desc">${Utils.escapeHtml(bank.description || '')}</div>
                        </div>
                    </div>
                    
                    <div class="bank-card-meta">
                        ${(bank.categories || []).slice(0, 4).map(cat => 
                            `<span class="tag">${Utils.escapeHtml(cat)}</span>`
                        ).join('')}
                    </div>
                    
                    <div class="bank-card-progress">
                        <div class="bank-card-progress-header">
                            <span>完成进度</span>
                            <span>${stats.progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill ${stats.progress === 100 ? 'success' : ''}" 
                                 style="width: ${stats.progress}%"></div>
                        </div>
                    </div>
                    
                    <div class="bank-card-stats">
                        <div class="bank-card-stat">
                            ${typeLabel} <span class="bank-card-stat-num">${typeCount}</span> 题
                        </div>
                        <div class="bank-card-stat">
                            已答 <span class="bank-card-stat-num">${stats.answered}</span>
                        </div>
                        <div class="bank-card-stat">
                            正确 <span class="bank-card-stat-num">${stats.correct}</span>
                        </div>
                        <div class="bank-card-stat">
                            错误 <span class="bank-card-stat-num">${stats.wrong}</span>
                        </div>
                    </div>
                    
                    <div class="bank-card-modes">
                        <button class="btn btn-primary btn-sm" onclick="App.startQuiz('${bank.id}', 'all')">
                            🚀 顺序刷题
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'random')">
                            🎲 随机刷题
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>
                            🔄 错题重做 ${wrongCount > 0 ? '(' + wrongCount + ')' : ''}
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'review')">
                            📖 背题模式
                        </button>
                        ${dueCount > 0 ? `
                        <button class="btn btn-accent btn-sm" onclick="App.startQuiz('${bank.id}', 'spaced')">
                            🧠 智能复习 (${dueCount})
                        </button>
                        ` : ''}
                        ${bookmarkCount > 0 ? `
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'bookmark')">
                            ⭐ 收藏题 (${bookmarkCount})
                        </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="App.startExam('${bank.id}')">
                            📝 模拟考试
                        </button>
                    </div>
                    
                    <div class="bank-card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="App.resetProgress('${bank.id}')">
                            重置进度
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="App.exportBank('${bank.id}')">
                            导出题库
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * 按题型筛选
     */
    filterByType(type) {
        this.state.filterType = type;
        
        // 更新按钮状态
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        // 重新渲染题库
        this.renderBankGrid();
    },

    /**
     * 切换闪电模式
     */
    toggleLightning(checked) {
        this.state.lightningMode = checked;
    },

    /**
     * 开始刷题
     */
    startQuiz(bankId, mode) {
        const typeParam = this.state.filterType !== 'all' ? `&type=${this.state.filterType}` : '';
        const lightningParam = this.state.lightningMode ? '&lightning=1' : '';
        window.location.href = `quiz.html?bank=${bankId}&mode=${mode}${typeParam}${lightningParam}`;
    },

    /**
     * 开始模拟考试
     */
    startExam(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        const totalQuestions = bank.questions?.length || 0;
        const timeStr = prompt(`模拟考试设置\n\n题库：${bank.name}（${totalQuestions}题）\n\n请输入考试限时（分钟，0表示不限时）：`, '60');
        if (timeStr === null) return;

        const timeMinutes = parseInt(timeStr) || 0;
        const passStr = prompt('请输入及格线（百分比，如 60）：', '60');
        if (passStr === null) return;

        const passRate = parseInt(passStr) || 60;
        const timeParam = timeMinutes > 0 ? `&time=${timeMinutes * 60}` : '';

        window.location.href = `quiz.html?bank=${bankId}&mode=exam${timeParam}&pass=${passRate}`;
    },

    /**
     * 开始全局智能复习（跨题库）
     */
    startSmartReview() {
        // 找到第一个有待复习题目的题库
        const banks = this.state.banks;
        for (const bank of banks) {
            const due = Storage.getDueQuestions(bank.id);
            if (due.length > 0) {
                this.startQuiz(bank.id, 'spaced');
                return;
            }
        }
        Utils.showToast('没有需要复习的题目', 'info');
    },

    /**
     * 重置进度
     */
    resetProgress(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        
        if (confirm(`确定要重置 "${bank.name}" 的所有进度吗？`)) {
            Storage.resetBankProgress(bankId);
            Utils.showToast('进度已重置', 'success');
            this.loadData();
            this.render();
        }
    },

    /**
     * 导出题库
     */
    exportBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        Utils.downloadJSON(bank, `${bank.name}.json`);
        Utils.showToast('题库已导出', 'success');
    },

    /**
     * 导入题库
     */
    async importBank() {
        try {
            const file = await Utils.pickFile('.json');
            if (!file) return;

            const data = await Utils.readJSONFile(file);
            const validation = Utils.validateBank(data);

            if (!validation.valid) {
                Utils.showToast('题库格式错误：' + validation.errors[0], 'error', 5000);
                return;
            }

            if (Storage.bankExists(data.id)) {
                if (!confirm(`题库 "${data.name}" 已存在，是否覆盖？`)) {
                    return;
                }
            }

            Storage.addBank(data);
            Utils.showToast(`题库 "${data.name}" 导入成功！`, 'success');
            this.loadData();
            this.render();
        } catch (e) {
            Utils.showToast('导入失败：' + e.message, 'error', 5000);
        }
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 导入按钮
        const importBtn = document.getElementById('btn-import');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importBank());
        }

        // 历史记录按钮
        const historyBtn = document.getElementById('btn-history');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.showHistory());
        }
    },

    /**
     * 显示历史记录
     */
    showHistory() {
        const history = Storage.getHistory();
        const container = document.getElementById('history-section');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">📋 答题历史</h2>
                </div>
                <div class="empty-hint">暂无答题记录</div>
            `;
        } else {
            container.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">📋 答题历史</h2>
                    <button class="btn btn-ghost btn-sm" onclick="App.clearHistory()">清空</button>
                </div>
                <div class="history-list">
                    ${history.slice(0, 20).map(h => {
                        const date = new Date(h.timestamp);
                        const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
                        const duration = h.duration || 0;
                        const minutes = Math.floor(duration / 60);
                        const seconds = duration % 60;
                        return `
                            <div class="history-item">
                                <div class="history-item-info">
                                    <span class="history-item-name">${Utils.escapeHtml(h.bankName || '未知题库')}</span>
                                    <span class="history-item-mode">${h.mode || ''}</span>
                                </div>
                                <div class="history-item-stats">
                                    <span class="history-item-correct">${h.correct || 0}/${h.total || 0}</span>
                                    <span class="history-item-time">${minutes > 0 ? minutes + '分' : ''}${seconds}秒</span>
                                    <span class="history-item-date">${dateStr}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        container.style.display = container.style.display === 'none' ? '' : 'none';
    },

    /**
     * 清空历史
     */
    clearHistory() {
        if (confirm('确定要清空所有答题历史吗？')) {
            Storage.clearHistory();
            Utils.showToast('历史已清空', 'success');
            this.showHistory();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
export default App;
