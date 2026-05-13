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
        lightningMode: false,
        activeTab: 'overview'
    },

    async init() {
        await this.loadBuiltinBanks();
        this.loadData();
        this.render();
        this.bindEvents();
    },

    /**
     * 加载内置题库（带版本缓存，避免重复 fetch）
     */
    async loadBuiltinBanks() {
        const cacheKey = 'quiz_cache_versions';
        const cacheVersions = JSON.parse(localStorage.getItem(cacheKey) || '{}');

        for (const filename of this.builtinBanks) {
            try {
                const bankId = filename.replace('.json', '');
                const existing = Storage.getBank(bankId);

                // 如果已有完整数据且版本匹配，跳过 fetch
                if (existing && existing.questions && cacheVersions[bankId] === existing.version) {
                    continue;
                }

                const response = await fetch(`banks/${filename}`);
                if (response.ok) {
                    const bank = await response.json();
                    const localBank = Storage.getBank(bank.id);
                    if (!localBank || localBank.version !== bank.version) {
                        Storage.addBank(bank);
                        cacheVersions[bank.id] = bank.version;
                    }
                }
            } catch (e) {
                console.error(`Failed to load ${filename}:`, e);
            }
        }
        localStorage.setItem(cacheKey, JSON.stringify(cacheVersions));
    },

    loadData() {
        this.state.banks = Storage.getBanks();
        this.state.stats = Storage.getGlobalStats();
    },

    render() {
        this.renderSmartBanner();
        this.renderStatsTabs();
        this.renderStatsOverview();
        this.renderTrend();
        this.renderWeakCategories();
        this.renderHistory();
        this.renderBankGrid();
    },

    /**
     * 渲染智能头条 — 根据用户状态动态展示
     */
    renderSmartBanner() {
        const el = document.getElementById('smart-banner');
        if (!el) return;

        const dueCount = Storage.getTodayDueCount();
        const stats = this.state.stats;
        const history = Storage.getHistory();
        const lastSession = history[0]; // 最近一次答题

        let icon, title, desc, btn;

        if (dueCount > 0) {
            // 有待复习
            icon = '🧠';
            title = '今日待复习';
            desc = `有 ${dueCount} 道题需要复习，间隔重复有助于长期记忆`;
            btn = `<button class="btn btn-primary btn-sm" onclick="App.startSmartReview()">开始复习</button>`;
        } else if (lastSession) {
            const date = new Date(lastSession.timestamp);
            const isToday = new Date().toDateString() === date.toDateString();
            if (isToday) {
                icon = '🎉';
                title = '今日已无待复习';
                desc = `上次答题：${lastSession.correct}/${lastSession.total} 正确`;
                btn = `<button class="btn btn-primary btn-sm" onclick="App.scrollToBankGrid()">继续刷题</button>`;
            } else {
                icon = '👋';
                title = '欢迎回来';
                desc = `上次答题：${Utils.formatDate(lastSession.timestamp, 'MM月DD日 HH:mm')}，正确率 ${Math.round(lastSession.correct / lastSession.total * 100)}%`;
                btn = `<button class="btn btn-primary btn-sm" onclick="App.scrollToBankGrid()">开始刷题</button>`;
            }
        } else if (stats.totalQuestions > 0) {
            icon = '👋';
            title = '欢迎使用智能刷题系统';
            desc = `共 ${stats.totalQuestions} 道题，选择一个题库开始学习吧`;
            btn = `<button class="btn btn-primary btn-sm" onclick="App.scrollToBankGrid()">查看题库</button>`;
        } else {
            icon = '📥';
            title = '还没有题库';
            desc = '点击导入按钮或等待内置题库加载';
            btn = `<button class="btn btn-primary btn-sm" onclick="App.importBank()">导入题库</button>`;
        }

        el.innerHTML = `
            <div class="smart-banner">
                <div class="smart-banner-icon">${icon}</div>
                <div class="smart-banner-info">
                    <div class="smart-banner-title">${title}</div>
                    <div class="smart-banner-desc">${desc}</div>
                </div>
                ${btn}
            </div>
        `;
        el.style.display = '';
    },

    scrollToBankGrid() {
        const grid = document.getElementById('bank-grid');
        if (grid) {
            grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    /**
     * 切换统计标签页
     */
    switchTab(tab) {
        this.state.activeTab = tab;

        document.querySelectorAll('.stats-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.querySelectorAll('.stats-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === `tab-${tab}`);
        });
    },

    /**
     * 渲染统计标签页导航
     */
    renderStatsTabs() {
        const stats = this.state.stats;
        const hasData = stats.totalAnswered > 0;
        const history = Storage.getHistory();
        const hasHistory = history.length > 0;

        // 动态显示有内容的标签页
        const tabs = [
            { id: 'overview', label: '📊 概览', show: true },
            { id: 'trend', label: '📈 趋势', show: hasData },
            { id: 'analysis', label: '📊 分析', show: hasData },
            { id: 'history', label: '📋 历史', show: hasHistory }
        ].filter(t => t.show);

        const el = document.getElementById('stats-tabs');
        if (!el) return;

        if (tabs.length <= 1) {
            el.style.display = 'none';
            return;
        }

        el.innerHTML = `
            <div class="stats-tab-bar">
                ${tabs.map(t => `
                    <button class="stats-tab ${t.id === this.state.activeTab ? 'active' : ''}" 
                            data-tab="${t.id}" onclick="App.switchTab('${t.id}')">
                        ${t.label}
                    </button>
                `).join('')}
            </div>
        `;
        el.style.display = '';
    },

    /**
     * 渲染概览统计（含环形图）
     */
    renderStatsOverview() {
        const stats = this.state.stats;
        const el = document.getElementById('tab-overview');
        if (!el) return;

        const accuracy = stats.accuracy || 0;
        // 计算环形图参数
        const circumference = 2 * Math.PI * 34; // r=34
        const offset = circumference - (accuracy / 100) * circumference;

        el.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">题库数量</div>
                    <div class="stat-value primary">${stats.bankCount}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">总题目数</div>
                    <div class="stat-value">${Utils.formatNumber(stats.totalQuestions)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">已答题数</div>
                    <div class="stat-value success">${Utils.formatNumber(stats.totalAnswered)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">正确率</div>
                    <div class="stat-ring">
                        <div class="stat-ring-chart">
                            <svg class="stat-ring-svg" width="80" height="80" viewBox="0 0 80 80">
                                <circle class="stat-ring-bg" cx="40" cy="40" r="34"/>
                                <circle class="stat-ring-fill" cx="40" cy="40" r="34" 
                                        stroke-dasharray="${circumference}" 
                                        stroke-dashoffset="${offset}"/>
                            </svg>
                            <div class="stat-ring-center">${accuracy}%</div>
                        </div>
                        <div class="stat-ring-labels">
                            <div class="stat-ring-label">✅ 正确 <span>${Utils.formatNumber(stats.totalCorrect)}</span></div>
                            <div class="stat-ring-label">❌ 错误 <span>${Utils.formatNumber(stats.totalWrong)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染学习趋势
     */
    renderTrend() {
        const el = document.getElementById('tab-trend');
        if (!el) return;

        const history = Storage.getHistory();
        if (history.length < 2) {
            el.innerHTML = '<div class="empty-hint">继续答题即可查看学习趋势 📈</div>';
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
            <div class="trend-chart">
                ${days.map(([label, data]) => {
                    const acc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    const barHeight = data.total > 0 ? Math.max(4, Math.round((data.total / maxTotal) * 100)) : 0;
                    return `
                        <div class="trend-bar-group">
                            <div class="trend-bar-value">${data.total > 0 ? acc + '%' : '-'}</div>
                            <div class="trend-bar-track">
                                <div class="trend-bar-fill" style="height: ${barHeight}%"></div>
                            </div>
                            <div class="trend-bar-label">${label}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * 渲染薄弱知识点
     */
    renderWeakCategories() {
        const el = document.getElementById('tab-analysis');
        if (!el) return;

        const allWeak = [];
        for (const bank of this.state.banks) {
            const weak = Storage.getWeakCategories(bank.id, 3);
            for (const w of weak) {
                allWeak.push({ bankName: bank.name, bankId: bank.id, ...w });
            }
        }

        allWeak.sort((a, b) => a.accuracy - b.accuracy);
        const topWeak = allWeak.slice(0, 5);

        if (topWeak.length === 0) {
            el.innerHTML = '<div class="empty-hint">继续答题即可分析薄弱知识点 📊</div>';
            return;
        }

        const accClass = (acc) => acc < 60 ? 'danger' : acc < 80 ? 'warning' : 'success';

        el.innerHTML = `
            <div class="weak-list">
                ${topWeak.map(w => `
                    <div class="weak-item">
                        <div class="weak-item-info">
                            <span class="weak-item-name">${Utils.escapeHtml(w.name)}</span>
                            <span class="weak-item-bank">${Utils.escapeHtml(w.bankName)}</span>
                        </div>
                        <div class="weak-item-stats">
                            <span class="weak-item-accuracy ${accClass(w.accuracy)}">${w.accuracy}%</span>
                            <span class="weak-item-detail">${w.correct}/${w.answered} 正确</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * 渲染历史记录
     */
    renderHistory() {
        const el = document.getElementById('tab-history');
        if (!el) return;

        const history = Storage.getHistory();
        if (history.length === 0) {
            el.innerHTML = '<div class="empty-hint">暂无答题记录 📋</div>';
            return;
        }

        el.innerHTML = `
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
                                <span>${minutes > 0 ? minutes + '分' : ''}${seconds}秒</span>
                                <span>${dateStr}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${history.length > 20 ? '<div style="text-align:center;margin-top:8px;font-size:12px;color:var(--text-tertiary)">仅显示最近 20 条</div>' : ''}
        `;
    },

    /**
     * 渲染题库网格（瘦身版）
     */
    renderBankGrid() {
        const container = document.getElementById('bank-grid');
        const banks = this.state.banks;

        if (banks.length === 0) {
            container.innerHTML = `
                <div class="bank-empty">
                    <div class="bank-empty-icon">📚</div>
                    <div class="bank-empty-title">加载题库中...</div>
                    <div class="bank-empty-desc">请稍候，题库正在加载</div>
                </div>
            `;
            return;
        }

        container.innerHTML = banks.map(bank => {
            const stats = Storage.getBankStats(bank.id);
            const wrongCount = Storage.getWrongQuestions(bank.id).length;
            const dueCount = Storage.getDueQuestions(bank.id).length;
            const bookmarkCount = Storage.getBookmarkCount(bank.id);

            const questions = bank.questions || [];
            const bankTypes = this.getBankTypes(bank);

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
                        ${(bank.categories || []).slice(0, 3).map(cat => 
                            `<span class="tag">${Utils.escapeHtml(cat)}</span>`
                        ).join('')}
                        ${dueCount > 0 ? `<span class="tag tag-warning">🧠 ${dueCount} 待复习</span>` : ''}
                        <span class="tag">${bankTypes.filter(t => t !== 'all').map(t => this.getTypeLabel(t)).join(' · ')}</span>
                    </div>

                    <div class="bank-card-progress">
                        <div class="bank-card-progress-header">
                            <span>完成进度</span>
                            <span>${stats.progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill ${stats.progress === 100 ? 'success' : stats.progress > 0 ? 'warning' : ''}" 
                                 style="width: ${stats.progress}%"></div>
                        </div>
                    </div>

                    <div class="bank-card-stats">
                        <div class="bank-card-stat">
                            共 <span class="bank-card-stat-num">${questions.length}</span> 题
                        </div>
                        <div class="bank-card-stat">
                            已答 <span class="bank-card-stat-num">${stats.answered}</span>
                        </div>
                        <div class="bank-card-stat">
                            正确 <span class="bank-card-stat-num">${stats.correct}</span>
                        </div>
                    </div>

                    <!-- 主按钮：开始刷题（全部题型）+ 更多菜单（含题型选择和刷题模式） -->
                    <div class="bank-card-actions">
                        <button class="btn btn-primary btn-sm" onclick="App.startQuiz('${bank.id}', 'all')" aria-label="顺序刷题（全部题型）">
                            🚀 开始刷题
                        </button>
                        <div class="bank-card-more-wrap">
                            <button class="bank-card-more-btn" onclick="App.toggleMoreMenu(this)" aria-label="更多模式" title="选择题型或模式">
                                ▾ 更多
                            </button>
                            <div class="bank-card-more-menu">
                                <div class="bank-card-more-group">📝 题型选择</div>
                                ${bankTypes.map(type => `
                                    <button class="bank-card-more-item" onclick="App.startQuiz('${bank.id}', 'all', '${type}')">
                                        ${type === 'all' ? '📚 全部题型' : '📝 只练' + this.getTypeLabel(type)}
                                    </button>
                                `).join('')}
                                <div class="bank-card-more-divider"></div>
                                <div class="bank-card-more-group">🎯 刷题模式</div>
                                <button class="bank-card-more-item" onclick="App.startQuiz('${bank.id}', 'random')">🎲 随机刷题</button>
                                <button class="bank-card-more-item" onclick="App.startQuiz('${bank.id}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>
                                    🔄 错题重做 ${wrongCount > 0 ? '(' + wrongCount + ')' : ''}
                                </button>
                                <button class="bank-card-more-item" onclick="App.startQuiz('${bank.id}', 'review')">📖 背题模式</button>
                                ${dueCount > 0 ? `
                                    <button class="bank-card-more-item" onclick="App.startQuiz('${bank.id}', 'spaced')">🧠 智能复习 (${dueCount})</button>
                                ` : ''}
                                ${bookmarkCount > 0 ? `
                                    <button class="bank-card-more-item" onclick="App.startQuiz('${bank.id}', 'bookmark')">⭐ 收藏题 (${bookmarkCount})</button>
                                ` : ''}
                                <button class="bank-card-more-item" onclick="App.startExam('${bank.id}')">📝 模拟考试</button>
                            </div>
                        </div>
                    </div>

                    <div class="bank-card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="App.resetProgress('${bank.id}')" title="重置进度">
                            <span>🔄 重置</span>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="App.exportBank('${bank.id}')" title="导出题库">
                            <span>📥 导出</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * 切换更多菜单
     */
    toggleMoreMenu(btn) {
        const menu = btn.nextElementSibling;
        const isOpen = menu.classList.contains('show');

        // 关闭所有其他菜单
        document.querySelectorAll('.bank-card-more-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        menu.classList.toggle('show', !isOpen);

        // 点击外部关闭
        if (!isOpen) {
            const close = (e) => {
                if (!menu.contains(e.target) && e.target !== btn) {
                    menu.classList.remove('show');
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    },

    /**
     * 切换闪电模式
     */
    toggleLightning(checked) {
        this.state.lightningMode = checked;
    },

    /**
     * 开始刷题
     * @param {string} bankId - 题库 ID
     * @param {string} mode - 模式（all/random/wrong/review/spaced/bookmark/exam）
     * @param {string} type - 题型筛选（all/single/multiple/judge/fill/code），可选
     */
    startQuiz(bankId, mode, type) {
        const typeParam = type && type !== 'all' ? `&type=${type}` : '';
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
     * 开始全局智能复习
     */
    startSmartReview() {
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
     * 主题切换（循环：auto → light → dark → auto）
     */
    cycleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'auto';
        const themeOrder = ['auto', 'light', 'dark'];
        const nextIndex = (themeOrder.indexOf(current) + 1) % themeOrder.length;
        const theme = themeOrder[nextIndex];
        
        if (theme === 'auto') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        
        Storage.updateSettings({ theme });
        
        const themeIcons = { auto: '🌓 跟随系统', light: '☀️ 浅色', dark: '🌙 深色' };
        Utils.showToast(`主题：${themeIcons[theme]}`, 'success', 1500);
    },

    /**
     * 打开主题设置
     */
    showThemePicker() {
        const current = document.documentElement.getAttribute('data-theme') || 'auto';
        const themeNames = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' };
        const choice = prompt(`选择主题：\n1. 跟随系统 (auto)\n2. 浅色模式 (light)\n3. 深色模式 (dark)\n\n当前：${themeNames[current]}`);
        if (!choice) return;

        const map = { '1': 'auto', '2': 'light', '3': 'dark', 'auto': 'auto', 'light': 'light', 'dark': 'dark' };
        const theme = map[choice.trim()];
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme === 'auto' ? '' : theme);
            if (theme === 'auto') {
                document.documentElement.removeAttribute('data-theme');
            }
            Storage.updateSettings({ theme });
            Utils.showToast(`已切换为 ${themeNames[theme]}`, 'success');
        }
    },

    /**
     * 打开设置面板
     */
    showSettings() {
        const settings = Storage.getSettings();
        const fontSize = settings.fontSize || 16;
        const autoNext = settings.autoNext || false;

        const result = prompt(
            `设置\n\n` +
            `字体大小（当前 ${fontSize}px）：\n` +
            `输入 14、16、18、20 调整字体大小\n\n` +
            `自动下一题（当前 ${autoNext ? '开' : '关'}）：\n` +
            `输入 "auto" 切换`,
            fontSize.toString()
        );

        if (!result) return;

        if (result === 'auto') {
            Storage.updateSettings({ autoNext: !autoNext });
            Utils.showToast(`自动下一题 ${!autoNext ? '已开启' : '已关闭'}`, 'success');
        } else {
            const size = parseInt(result);
            if (size >= 12 && size <= 24) {
                Storage.updateSettings({ fontSize: size });
                document.documentElement.style.setProperty('--font-size-base', size + 'px');
                Utils.showToast(`字体大小已设为 ${size}px`, 'success');
            } else {
                Utils.showToast('字体大小范围为 12-24px', 'error');
            }
        }
    },

    /**
     * 显示键盘快捷键参考
     */
    showShortcuts() {
        const shown = localStorage.getItem('quiz_shortcuts_shown');
        Utils.showToast(
            '快捷键：Enter 提交 · A-D 选答案 · Alt+←→ 切换 · 1/0 判断',
            'info', 5000
        );
        localStorage.setItem('quiz_shortcuts_shown', '1');
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

        // 主题切换按钮
        const themeBtn = document.getElementById('btn-theme');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.cycleTheme());
        }

        // 设置按钮
        const settingsBtn = document.getElementById('btn-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // 快捷键帮助
        const shortcutsBtn = document.getElementById('btn-shortcuts');
        if (shortcutsBtn) {
            shortcutsBtn.addEventListener('click', () => this.showShortcuts());
        }

        // 应用字体大小
        const settings = Storage.getSettings();
        if (settings.fontSize && settings.fontSize !== 16) {
            document.documentElement.style.setProperty('--font-size-base', settings.fontSize + 'px');
        }

        // 应用主题
        if (settings.theme && settings.theme !== 'auto') {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }

        // 首次访问显示快捷键提示
        if (!localStorage.getItem('quiz_shortcuts_shown')) {
            setTimeout(() => {
                Utils.showToast('💡 按 Enter 提交 · Alt+←→ 切换 · A-D 选答案', 'info', 4000);
                localStorage.setItem('quiz_shortcuts_shown', '1');
            }, 2000);
        }

        // 首次使用引导（检查是否有题库数据）
        if (!localStorage.getItem('quiz_welcome_shown') && this.state.banks.length > 0) {
            localStorage.setItem('quiz_welcome_shown', '1');
            setTimeout(() => {
                Utils.showToast('👋 点击题库卡片上的「开始刷题」按钮即可学习', 'info', 5000);
            }, 4000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
export default App;
