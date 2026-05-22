/**
 * 主应用模块
 */

import Storage from './storage.js';
import Utils from './utils.js';
import { builtinBanks } from './config.js';

const App = {
    builtinBanks,

    state: {
        banks: [],
        stats: null,
        lightningMode: false,
        selectedTypes: {}
    },

    async init() {
        this.removeDeprecatedBanks();
        await this.loadBuiltinBanks();
        this.loadData();
        this.render();
        this.bindEvents();
    },

    removeDeprecatedBanks() {
        const deprecatedIds = new Set(['engineering-mechanics']);

        Storage.getBanks().forEach(bank => {
            if (bank.id === 'engineering-mechanics' || bank.name === '工程力学') {
                deprecatedIds.add(bank.id);
            }
        });

        deprecatedIds.forEach(bankId => Storage.removeBank(bankId));

        const history = Storage.getHistory().filter(record =>
            !deprecatedIds.has(record.bankId) && record.bankName !== '工程力学'
        );
        Storage.set(Storage.KEYS.HISTORY, history);

        const sessions = Storage.get(Storage.KEYS.SESSION) || {};
        for (const key of Object.keys(sessions)) {
            const [bankId] = key.split(':');
            if (deprecatedIds.has(bankId)) {
                delete sessions[key];
            }
        }
        Storage.set(Storage.KEYS.SESSION, sessions);

        const cacheKey = 'quiz_cache_versions';
        const cacheVersions = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        deprecatedIds.forEach(bankId => {
            delete cacheVersions[bankId];
        });
        localStorage.setItem(cacheKey, JSON.stringify(cacheVersions));
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
                    // 检查是否需要更新：无此题库、版本不同、或内存中没有完整题目
                    const localBank = Storage.getBank(bank.id);
                    const needsUpdate = !localBank || localBank.version !== bank.version || !localBank.questions;
                    if (needsUpdate) {
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
        this.renderWrongBook();
        this.renderStatsOverview();
        this.renderBankGrid();
    },

    /**
     * 渲染错题本入口
     */
    renderWrongBook() {
        const el = document.getElementById('wrong-book');
        if (!el) return;

        const stats = Storage.getGlobalWrongStats();

        if (stats.totalWrong === 0) {
            el.style.display = 'none';
            return;
        }

        el.innerHTML = `
            <div class="wrong-book">
                <div class="wrong-book-header">
                    <span class="wrong-book-icon">❌</span>
                    <span class="wrong-book-title">错题本</span>
                    <span class="wrong-book-count">${stats.totalWrong} 题</span>
                </div>
                <div class="wrong-book-body">
                    ${stats.details.map(d => `
                        <div class="wrong-book-bank">
                            <span class="wrong-book-bank-name">${Utils.escapeHtml(d.bankName)}</span>
                            <span class="wrong-book-bank-count">${d.count} 题</span>
                        </div>
                    `).join('')}
                </div>
                <div class="wrong-book-actions">
                    <button class="btn btn-secondary btn-sm" onclick="App.clearAllWrong()">🗑️ 清空错题本</button>
                    <button class="btn btn-primary btn-sm" onclick="App.startWrongPractice()">🚀 错题重做</button>
                </div>
            </div>
        `;
        el.style.display = '';
    },

    clearAllWrong() {
        if (!confirm('确定清空全部错题本？此操作不可恢复。')) return;
        Storage.clearAllWrong();
        Utils.showToast('错题本已清空', 'success');
        this.loadData();
        this.render();
    },

    startWrongPractice() {
        const stats = Storage.getGlobalWrongStats();
        if (stats.totalWrong === 0) return;
        const firstBank = stats.details[0];
        this.startQuiz(firstBank.bankId, 'wrong');
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
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">题库数量</div>
                    <div class="stat-value primary">${stats.bankCount}</div>
                </div>
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">总题目数</div>
                    <div class="stat-value">${Utils.formatNumber(stats.totalQuestions)}</div>
                </div>
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">已答题数</div>
                    <div class="stat-value success">${Utils.formatNumber(stats.totalAnswered)}</div>
                </div>
                <div class="stat-card stat-card-accuracy">
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
     * 获取题库的可用题型列表
     */
    getBankTypes(bank) {
        if (!bank || !bank.questions) return [];
        const typeSet = new Set();
        bank.questions.forEach(q => {
            if (q.type) typeSet.add(q.type);
        });
        return ['all', ...typeSet].filter(Boolean);
    },

    /**
     * 获取题型显示名称
     */
    getTypeLabel(type) {
        const map = {
            all: '全部题型',
            single: '单选',
            multiple: '多选',
            judge: '判断',
            fill: '填空',
            code: '编程',
            essay: '简答'
        };
        return map[type] || type;
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

        // 更新题库计数
        const countEl = document.getElementById('bank-count');
        if (countEl) countEl.textContent = banks.length + ' 个题库';

        container.innerHTML = banks.map(bank => {
            const stats = Storage.getBankStats(bank.id);
            const wrongCount = Storage.getWrongQuestions(bank.id).length;
            const dueCount = Storage.getDueQuestions(bank.id).length;
            const bookmarkCount = Storage.getBookmarkCount(bank.id);

            const questions = bank.questions || [];
            const bankTypes = this.getBankTypes(bank);

            const iconClass = bank.id.includes('c-language') ? 'c-lang' : 'default';
            const iconText = bank.id.includes('c-language') ? 'C' : 'Q';

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

                    <!-- 题型筛选行（选择题型后，刷题按钮自动使用所选题型） -->
                    <div class="bank-card-types">
                        ${bankTypes.map(type => {
                            const isActive = (this.state.selectedTypes[bank.id] || 'all') === type;
                            return `<button class="bank-type-btn ${isActive ? 'active' : ''}" onclick="App.selectType('${bank.id}', '${type}')">
                                ${type === 'all' ? '📚 全部' : this.getTypeLabel(type)}
                            </button>`;
                        }).join('')}
                    </div>

                    <!-- 刷题模式按钮网格 -->
                    <div class="bank-card-modes">
                        <button class="btn btn-primary btn-sm" onclick="App.startQuiz('${bank.id}', 'all')">🚀 顺序刷题</button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'random')">🎲 随机</button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'shuffle_options')">🎲 选项乱序</button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>
                            🔄 错题${wrongCount > 0 ? '(' + wrongCount + ')' : ''}
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'review')">📖 背题</button>
                        ${dueCount > 0 ? `
                            <button class="btn btn-accent btn-sm" onclick="App.startQuiz('${bank.id}', 'spaced')">🧠 复习(${dueCount})</button>
                        ` : ''}
                        ${bookmarkCount > 0 ? `
                            <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'bookmark')">⭐ 收藏(${bookmarkCount})</button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="App.startExam('${bank.id}')">📝 考试</button>
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
     * 搜索题目（跨题库关键词搜索）
     */
    searchQuestions() {
        const input = document.getElementById('search-input');
        const keyword = input ? input.value.trim() : '';
        if (!keyword) return;

        const results = [];
        const banks = this.state.banks;
        for (const bank of banks) {
            if (!bank.questions) continue;
            const matched = bank.questions.filter(q => {
                const searchText = [q.question, q.explanation, q.category, ...(q.options || []), q.answer].join(' ');
                return searchText.toLowerCase().includes(keyword.toLowerCase());
            });
            if (matched.length > 0) {
                results.push({ bank, matched, count: matched.length });
            }
        }

        if (results.length === 0) {
            Utils.showToast('未找到包含「' + keyword + '」的题目', 'info', 3000);
            return;
        }

        const searchData = {
            keyword,
            banks: results.map(r => ({
                bankId: r.bank.id,
                questionIds: r.matched.map(q => q.id),
                count: r.count
            }))
        };
        sessionStorage.setItem('quiz_search_results', JSON.stringify(searchData));

        const firstBank = results[0].bank;
        Utils.showToast('找到 ' + results.reduce((s, r) => s + r.count, 0) + ' 道匹配题目', 'success', 2000);
        setTimeout(() => {
            window.location.href = 'quiz.html?bank=' + firstBank.id + '&mode=search&q=' + encodeURIComponent(keyword);
        }, 300);
    },

    /**
     * 清除搜索
     */
    clearSearch() {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        sessionStorage.removeItem('quiz_search_results');
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
     */
    selectType(bankId, type) {
        this.state.selectedTypes[bankId] = type;
        this.renderBankGrid();
    },

    /**
     * 开始刷题（自动使用当前选中的题型）
     * @param {string} bankId - 题库 ID
     * @param {string} mode - 模式
     */
    startQuiz(bankId, mode) {
        const selectedType = this.state.selectedTypes[bankId] || 'all';
        const typeParam = selectedType !== 'all' ? `&type=${selectedType}` : '';
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

        // 搜索输入框实时显示清除按钮
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const clearBtn = document.getElementById('search-clear');
                if (clearBtn) {
                    clearBtn.style.display = searchInput.value ? '' : 'none';
                }
            });
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

        const historyBtn = document.getElementById('btn-history');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                window.location.href = 'trend.html#recent-history';
            });
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
