import Storage from './storage.js';
import Utils from './utils.js';
import BankLoader from './bankLoader.js';

const Insights = {
    state: {
        page: '',
        banks: [],
        stats: null,
        history: [],
        questionActivity: []
    },

    async init() {
        this.state.page = document.body.dataset.page || 'trend';
        this.applySettings();
        await this.loadBuiltinBanks();
        this.loadData();

        if (this.state.page === 'analysis') {
            this.renderAnalysisPage();
        } else {
            this.renderTrendPage();
        }
    },

    applySettings() {
        const settings = Storage.getSettings();
        if (settings.fontSize) {
            Utils.applyFontSize(settings.fontSize);
        }
        if (settings.theme && settings.theme !== 'auto') {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }
    },

    async loadBuiltinBanks() {
        await BankLoader.loadAllBuiltinBanks();
    },

    loadData() {
        this.state.banks = Storage.getBanks();
        this.state.stats = Storage.getGlobalStats();
        this.state.history = Storage.getHistory();
        this.state.questionActivity = this.getQuestionActivity();
    },

    renderTrendPage() {
        this.renderTrendSummary();
        this.renderDailyTrend();
        this.renderBankTrend();
        this.renderRecentHistory();
    },

    renderAnalysisPage() {
        this.renderAnalysisSummary();
        this.renderWeakCategories();
        this.renderTypeAnalysis();
        this.renderBankAnalysis();
    },

    renderTrendSummary() {
        const el = document.getElementById('trend-summary');
        if (!el) return;

        const stats = this.state.stats;
        const today = this.getDailySeries(1)[0];
        const streak = this.getStudyStreak();
        const totalDuration = this.state.history.reduce((sum, h) => sum + (h.duration || 0), 0);

        el.innerHTML = `
            ${this.renderStatCard('总答题', Utils.formatNumber(stats.totalAnswered), `${stats.bankCount} 个题库`, 'primary')}
            ${this.renderStatCard('正确率', `${stats.accuracy}%`, `${Utils.formatNumber(stats.totalCorrect)} / ${Utils.formatNumber(stats.totalAnswered || 0)}`, this.getAccuracyTone(stats.accuracy))}
            ${this.renderStatCard('今日答题', Utils.formatNumber(today.total), today.total > 0 ? `${today.accuracy}% 正确率` : '暂无记录', today.total > 0 ? 'success' : '')}
            ${this.renderStatCard('连续天数', `${streak} 天`, `累计 ${this.formatDuration(totalDuration)}`, streak > 0 ? 'warning' : '')}
        `;
    },

    renderDailyTrend() {
        const container = document.getElementById('daily-trend');
        const range = document.getElementById('trend-range');
        if (!container) return;

        const series = this.getDailySeries(14);
        const activeDays = series.filter((d) => d.total > 0);
        if (range && series.length > 0) {
            range.textContent = `${series[0].label} - ${series[series.length - 1].label}`;
        }

        if (activeDays.length === 0) {
            container.innerHTML = this.renderEmpty('暂无答题记录');
            return;
        }

        const maxTotal = Math.max(1, ...series.map((d) => d.total));
        container.innerHTML = `
            <div class="daily-chart">
                ${series
                    .map((day) => {
                        const height =
                            day.total > 0
                                ? Math.max(8, Math.round((day.total / maxTotal) * 100))
                                : 0;
                        const tone = day.total === 0 ? 'empty' : this.getAccuracyTone(day.accuracy);
                        return `
                        <div class="daily-item" title="${day.fullLabel} ${day.total}题 ${day.accuracy}%">
                            <div class="daily-value">${day.total > 0 ? day.accuracy + '%' : ''}</div>
                            <div class="daily-track">
                                <div class="daily-fill ${tone}" style="height:${height}%"></div>
                            </div>
                            <div class="daily-label">${day.shortLabel}</div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    renderBankTrend() {
        const el = document.getElementById('bank-trend');
        if (!el) return;

        const rows = this.state.banks
            .map((bank) => {
                const stats = Storage.getBankStats(bank.id);
                const history = this.getHistoryForBank(bank.id);
                return { bank, stats, historyCount: history.length };
            })
            .sort((a, b) => b.stats.answered - a.stats.answered);

        if (rows.length === 0) {
            el.innerHTML = this.renderEmpty('暂无题库');
            return;
        }

        el.innerHTML = `
            <div class="insight-list">
                ${rows
                    .map(
                        (row) => `
                    <div class="insight-row">
                        <div class="insight-row-main">
                            <div class="insight-row-title">${Utils.escapeHtml(row.bank.name)}</div>
                            <div class="insight-row-meta">${row.stats.answered}/${row.stats.totalQuestions} 已答 · ${row.historyCount} 次练习</div>
                            <div class="mini-progress">
                                <div class="mini-progress-fill ${this.getAccuracyTone(row.stats.accuracy)}" style="width:${row.stats.progress}%"></div>
                            </div>
                        </div>
                        <div class="insight-row-value">${row.stats.accuracy}%</div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;
    },

    renderRecentHistory() {
        const el = document.getElementById('recent-history');
        if (!el) return;

        const history = this.state.history.slice(0, 8);
        if (history.length === 0) {
            el.innerHTML = this.renderEmpty('暂无历史记录');
            return;
        }

        el.innerHTML = `
            <div class="insight-list">
                ${history
                    .map((record) => {
                        const accuracy =
                            record.total > 0
                                ? Math.round(((record.correct || 0) / record.total) * 100)
                                : 0;
                        return `
                        <div class="history-line">
                            <div>
                                <div class="history-title">${Utils.escapeHtml(record.bankName || '未知题库')}</div>
                                <div class="history-meta">${this.getModeLabel(record.mode)} · ${this.formatDateTime(record.timestamp)} · ${this.formatDuration(record.duration || 0)}</div>
                            </div>
                            <div class="history-score">${accuracy}%</div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    renderAnalysisSummary() {
        const el = document.getElementById('analysis-summary');
        if (!el) return;

        const stats = this.state.stats;
        const wrongStats = Storage.getGlobalWrongStats();
        const dueCount = Storage.getTodayDueCount();
        const weakCount = this.getAllCategoryRows().filter(
            (row) => row.answered > 0 && row.accuracy < 70
        ).length;

        el.innerHTML = `
            ${this.renderStatCard('待复习', Utils.formatNumber(dueCount), '今日到期', dueCount > 0 ? 'warning' : 'success')}
            ${this.renderStatCard('错题', Utils.formatNumber(wrongStats.totalWrong), `${wrongStats.details.length} 个题库`, wrongStats.totalWrong > 0 ? 'danger' : 'success')}
            ${this.renderStatCard('薄弱点', Utils.formatNumber(weakCount), '正确率低于 70%', weakCount > 0 ? 'warning' : 'success')}
            ${this.renderStatCard('整体正确率', `${stats.accuracy}%`, `${Utils.formatNumber(stats.totalCorrect)} / ${Utils.formatNumber(stats.totalAnswered || 0)}`, this.getAccuracyTone(stats.accuracy))}
        `;
    },

    renderWeakCategories() {
        const el = document.getElementById('weak-categories');
        if (!el) return;

        const rows = this.getAllCategoryRows()
            .filter((row) => row.answered > 0)
            .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
            .slice(0, 12);

        if (rows.length === 0) {
            el.innerHTML = this.renderEmpty('暂无可分析记录');
            return;
        }

        el.innerHTML = `
            <div class="insight-list">
                ${rows
                    .map(
                        (row) => `
                    <div class="insight-row">
                        <div class="insight-row-main">
                            <div class="insight-row-title">${Utils.escapeHtml(row.name)}</div>
                            <div class="insight-row-meta">${Utils.escapeHtml(row.bankName)} · ${row.correct}/${row.answered} 正确</div>
                            <div class="mini-progress">
                                <div class="mini-progress-fill ${this.getAccuracyTone(row.accuracy)}" style="width:${row.accuracy}%"></div>
                            </div>
                        </div>
                        <div class="insight-row-value">${row.accuracy}%</div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;
    },

    renderTypeAnalysis() {
        const el = document.getElementById('type-analysis');
        if (!el) return;

        const rows = this.getTypeRows();
        if (rows.length === 0) {
            el.innerHTML = this.renderEmpty('暂无题型数据');
            return;
        }

        el.innerHTML = `
            <div class="insight-list">
                ${rows
                    .map((row) => {
                        const accuracy =
                            row.answered > 0 ? Math.round((row.correct / row.answered) * 100) : 0;
                        const progress =
                            row.total > 0 ? Math.round((row.answered / row.total) * 100) : 0;
                        return `
                        <div class="insight-row">
                            <div class="insight-row-main">
                                <div class="insight-row-title">${this.getTypeLabel(row.type)}</div>
                                <div class="insight-row-meta">${row.answered}/${row.total} 已答 · ${row.correct} 正确</div>
                                <div class="mini-progress">
                                    <div class="mini-progress-fill ${this.getAccuracyTone(accuracy)}" style="width:${progress}%"></div>
                                </div>
                            </div>
                            <div class="insight-row-value">${row.answered > 0 ? accuracy + '%' : '-'}</div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    renderBankAnalysis() {
        const el = document.getElementById('bank-analysis');
        if (!el) return;

        if (this.state.banks.length === 0) {
            el.innerHTML = this.renderEmpty('暂无题库');
            return;
        }

        el.innerHTML = `
            <div class="bank-analysis-grid">
                ${this.state.banks
                    .map((bank) => {
                        const stats = Storage.getBankStats(bank.id);
                        const wrongCount = Storage.getWrongQuestions(bank.id).length;
                        const dueCount = Storage.getDueQuestions(bank.id).length;
                        const categories = Object.entries(Storage.getCategoryStats(bank.id))
                            .filter(([_, stat]) => stat.answered > 0)
                            .sort((a, b) => a[1].accuracy - b[1].accuracy)
                            .slice(0, 4);

                        return `
                        <div class="bank-analysis-card">
                            <div class="bank-analysis-head">
                                <div>
                                    <div class="bank-analysis-title">${Utils.escapeHtml(bank.name)}</div>
                                    <div class="bank-analysis-desc">${stats.answered}/${stats.totalQuestions} 已答 · ${stats.accuracy}% 正确率</div>
                                </div>
                                <span class="tag ${stats.progress === 100 ? 'tag-success' : 'tag-primary'}">${stats.progress}%</span>
                            </div>
                            <div class="mini-progress">
                                <div class="mini-progress-fill ${this.getAccuracyTone(stats.accuracy)}" style="width:${stats.progress}%"></div>
                            </div>
                            <div class="category-stack">
                                ${
                                    categories.length > 0
                                        ? categories
                                              .map(
                                                  ([name, stat]) => `
                                    <div class="category-line">
                                        <div class="category-name">${Utils.escapeHtml(name)}</div>
                                        <div class="category-accuracy">${stat.accuracy}%</div>
                                    </div>
                                `
                                              )
                                              .join('')
                                        : '<div class="insight-subtle">暂无分类记录</div>'
                                }
                            </div>
                            <div class="bank-analysis-actions">
                                <a class="btn btn-primary btn-sm" href="quiz.html?bank=${encodeURIComponent(bank.id)}&mode=all">顺序刷题</a>
                                ${wrongCount > 0 ? `<a class="btn btn-secondary btn-sm" href="quiz.html?bank=${encodeURIComponent(bank.id)}&mode=wrong">错题 ${wrongCount}</a>` : ''}
                                ${dueCount > 0 ? `<a class="btn btn-secondary btn-sm" href="quiz.html?bank=${encodeURIComponent(bank.id)}&mode=spaced">复习 ${dueCount}</a>` : ''}
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    renderStatCard(label, value, meta, tone = '') {
        return `
            <div class="insight-stat">
                <div class="insight-stat-label">${label}</div>
                <div class="insight-stat-value ${tone}">${value}</div>
                <div class="insight-stat-meta">${meta}</div>
            </div>
        `;
    },

    renderEmpty(text) {
        return `<div class="empty-state">${Utils.escapeHtml(text)}</div>`;
    },

    getDailySeries(days) {
        const map = new Map();
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - i);
            const key = this.getDateKey(date);
            map.set(key, {
                key,
                date,
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                shortLabel:
                    days > 7 ? `${date.getDate()}` : `${date.getMonth() + 1}/${date.getDate()}`,
                fullLabel: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
                total: 0,
                correct: 0,
                accuracy: 0
            });
        }

        this.state.questionActivity.forEach((record) => {
            const key = this.getDateKey(new Date(record.timestamp));
            const day = map.get(key);
            if (!day) return;
            day.total++;
            if (record.correct) day.correct++;
        });

        return [...map.values()].map((day) => ({
            ...day,
            accuracy: day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0
        }));
    },

    getStudyStreak() {
        const activeDays = new Set(
            this.state.questionActivity.map((record) => this.getDateKey(new Date(record.timestamp)))
        );
        let streak = 0;
        const date = new Date();
        date.setHours(0, 0, 0, 0);

        while (activeDays.has(this.getDateKey(date))) {
            streak++;
            date.setDate(date.getDate() - 1);
        }

        return streak;
    },

    getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    getHistoryForBank(bankId) {
        return this.state.history.filter((record) => record.bankId === bankId);
    },

    getQuestionActivity() {
        const rows = [];
        this.state.banks.forEach((bank) => {
            const progress = Storage.getBankProgress(bank.id);
            Object.entries(progress.questions || {}).forEach(([questionId, questionProgress]) => {
                if (!questionProgress.answeredAt) return;
                rows.push({
                    bankId: bank.id,
                    bankName: bank.name,
                    questionId,
                    timestamp: questionProgress.answeredAt,
                    correct: questionProgress.correct === true
                });
            });
        });
        return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    getAllCategoryRows() {
        const rows = [];
        this.state.banks.forEach((bank) => {
            const stats = Storage.getCategoryStats(bank.id);
            Object.entries(stats).forEach(([name, stat]) => {
                rows.push({
                    bankId: bank.id,
                    bankName: bank.name,
                    name,
                    ...stat
                });
            });
        });
        return rows;
    },

    getTypeRows() {
        const map = new Map();
        this.state.banks.forEach((bank) => {
            const progress = Storage.getBankProgress(bank.id);
            (bank.questions || []).forEach((question) => {
                const type = question.type || 'unknown';
                if (!map.has(type)) {
                    map.set(type, { type, total: 0, answered: 0, correct: 0 });
                }
                const row = map.get(type);
                row.total++;

                const questionProgress = progress.questions[question.id];
                if (questionProgress) {
                    row.answered++;
                    if (questionProgress.correct) row.correct++;
                }
            });
        });

        return [...map.values()].sort((a, b) => b.total - a.total);
    },

    getAccuracyTone(accuracy) {
        if (accuracy >= 85) return 'success';
        if (accuracy >= 60) return 'warning';
        if (accuracy > 0) return 'danger';
        return '';
    },

    getModeLabel(mode) {
        const labels = {
            all: '顺序',
            random: '随机',
            shuffle_options: '选项乱序',
            wrong: '错题',
            review: '背题',
            spaced: '复习',
            bookmark: '收藏',
            exam: '考试',
            search: '搜索'
        };
        return labels[mode] || mode || '练习';
    },

    getTypeLabel(type) {
        const labels = {
            single: '单选题',
            multiple: '多选题',
            judge: '判断题',
            fill: '填空题',
            code: '编程题',
            essay: '简答题'
        };
        return labels[type] || type;
    },

    formatDuration(seconds) {
        const value = Math.max(0, Number(seconds) || 0);
        const minutes = Math.floor(value / 60);
        const remain = value % 60;
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
        }
        if (minutes > 0) return `${minutes}分${remain}秒`;
        return `${remain}秒`;
    },

    formatDateTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Insights.init();
});

window.Insights = Insights;
export default Insights;
