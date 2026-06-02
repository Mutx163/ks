/**
 * 主应用模块
 */

import Storage from './storage.js';
import Utils from './utils.js';
import BankLoader from './bankLoader.js';
import Tracker from './tracker.js';
import API from './api.js';

const App = {
    state: {
        banks: [],
        stats: null,
        lightningMode: false,
        selectedTypes: {}
    },

    async init() {
        window._pageStartTime = window._pageStartTime || Date.now();

        // 加载题库（10秒超时，失败不影响页面显示）
        try {
            await Promise.race([
                BankLoader.loadAllBuiltinBanks(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))
            ]);
        } catch (e) {
            console.warn('[App] 题库加载超时或失败:', e.message);
        }

        // 云同步（静默，3秒超时）
        try { await Promise.race([API.autoSync(), new Promise(r => setTimeout(r, 3000))]); } catch {}

        this.loadData();

        // 隐藏骨架屏，显示真实内容（最少显示 500ms）
        const skeleton = document.getElementById('loading-skeleton');
        const banksSection = document.getElementById('section-banks');
        const showReal = () => {
            if (skeleton) skeleton.classList.add('hidden');
            if (banksSection) banksSection.style.display = '';
        };
        const elapsed = Date.now() - window._pageStartTime;
        if (elapsed < 500) setTimeout(showReal, 500 - elapsed);
        else showReal();

        this.render();
        this.bindEvents();

        // 首次访问：提示注册
        if (!API.isRegistered()) {
            setTimeout(() => API.showRegisterModal(), 1500);
        }

        // 加载公告横幅
        this.loadAnnouncement();
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
                    <span class="wrong-book-icon">${Utils.icon('x-circle')}</span>
                    <span class="wrong-book-title">错题本</span>
                    <span class="wrong-book-count">${stats.totalWrong} 题</span>
                </div>
                <div class="wrong-book-body">
                    ${stats.details
                        .map(
                            (d) => `
                        <div class="wrong-book-bank">
                            <span class="wrong-book-bank-name">${Utils.escapeHtml(d.bankName)}</span>
                            <span class="wrong-book-bank-count">${d.count} 题</span>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                <div class="wrong-book-actions">
                    <button class="btn btn-secondary btn-sm" onclick="App.clearAllWrong()">${Utils.icon('trash-2')} 清空错题本</button>
                    <button class="btn btn-primary btn-sm" onclick="App.startWrongPractice()">${Utils.icon('repeat')} 错题重做</button>
                </div>
            </div>
        `;
        el.style.display = '';
        Utils.initIcons();
    },

    clearAllWrong() {
        Utils.showModal({
            title: `${Utils.icon('alert-triangle')} 清空错题本`,
            content: '<p>确定清空全部错题本？此操作不可恢复。</p>',
            buttons: [
                {
                    label: '确定清空',
                    class: 'btn-danger',
                    onClick: (modal) => {
                        modal.remove();
                        const wrongCount = Storage.getGlobalWrongStats().totalWrong;
                        Storage.clearAllWrong();
                        Tracker.clearWrongBook(wrongCount);
                        Utils.showToast('错题本已清空', 'success');
                        this.loadData();
                        this.render();
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'sm'
        });
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
        // 已用公告横幅替代，此方法保留兼容
    },

    async loadAnnouncement() {
        const el = document.getElementById('smart-banner');
        if (!el) return;
        const CACHE_KEY = 'ks_cached_announce';
        let shown = false;

        // 从缓存恢复
        const cached = (() => { try { return localStorage.getItem(CACHE_KEY); } catch { return null; } })();
        if (cached) { this._renderAnnounceWrap(el, cached); shown = true; }

        // 尝试云 API
        try {
            console.log('[公告] 请求中...');
            const d = await API.request('/api/announce');
            console.log('[公告] 响应:', JSON.stringify(d));
            if (d?.ok && d.announce?.content) {
                const text = Utils.escapeHtml(d.announce.content.replace(/\n/g, ' '));
                try { localStorage.setItem(CACHE_KEY, text); } catch {}
                this._renderAnnounceWrap(el, text);
                return;
            } else {
                // 没有公告时清除缓存
                try { localStorage.removeItem(CACHE_KEY); } catch {}
                if (!shown) el.style.display = 'none';
                return;
            }
        } catch {}

        // 全部失败
        if (!shown) el.style.display = 'none';
    },

    _renderAnnounceWrap(el, text) {
        el.innerHTML = `
            <div class="announce-banner">
                <div class="announce-badge">公告</div>
                <div class="announce-scroll-wrap" id="announce-scroll-wrap">
                    <div class="announce-scroll-text" id="announce-scroll-text">${text}</div>
                </div>
            </div>
        `;
        el.style.display = '';
        requestAnimationFrame(() => {
            const wrap = document.getElementById('announce-scroll-wrap');
            const txt = document.getElementById('announce-scroll-text');
            if (wrap && txt && txt.scrollWidth > wrap.clientWidth) {
                wrap.classList.add('overflow');
            }
        });
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

        // 格式化学习时长
        const formatDuration = (seconds) => {
            if (seconds < 60) return `${seconds}秒`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
        };

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
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">学习时长</div>
                    <div class="stat-value">${formatDuration(stats.totalDuration || 0)}</div>
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
                            <div class="stat-ring-label">${Utils.icon('check-circle', 'text-success')} 正确 <span>${Utils.formatNumber(stats.totalCorrect)}</span></div>
                            <div class="stat-ring-label">${Utils.icon('x-circle', 'text-danger')} 错误 <span>${Utils.formatNumber(stats.totalWrong)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        Utils.initIcons();
    },

    /**
     * 获取题库的可用题型列表
     */
    getBankTypes(bank) {
        if (!bank || !bank.questions) return [];
        const typeSet = new Set();
        bank.questions.forEach((q) => {
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
     * 检查做题模式是否被允许
     * @param {Array|null} allowed - 允许的模式数组，null表示全部允许
     * @param {string} mode - 要检查的模式
     * @returns {boolean}
     */
    _isModeAllowed(allowed, mode) {
        if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return true;
        return allowed.includes(mode);
    },

    /**
     * 渲染做题模式按钮
     */
    _renderModeButtons(bankId, allowedModes, wrongCount, dueCount, bookmarkCount) {
        const btns = [];

        if (this._isModeAllowed(allowedModes, 'all')) {
            btns.push(`<button class="btn btn-primary btn-sm" onclick="App.startQuiz('${bankId}', 'all')">${Utils.icon('list')} 顺序刷题</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'random')) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'random')">${Utils.icon('shuffle')} 随机</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'shuffle_options')) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'shuffle_options')">${Utils.icon('refresh-cw')} 选项乱序</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'wrong')) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>${Utils.icon('alert-circle')} 错题${wrongCount > 0 ? '(' + wrongCount + ')' : ''}</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'review')) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'review')">${Utils.icon('book-open')} 背题</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'spaced') && dueCount > 0) {
            btns.push(`<button class="btn btn-accent btn-sm" onclick="App.startQuiz('${bankId}', 'spaced')">${Utils.icon('brain')} 复习(${dueCount})</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'bookmark') && bookmarkCount > 0) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'bookmark')">${Utils.icon('star')} 收藏(${bookmarkCount})</button>`);
        }
        if (this._isModeAllowed(allowedModes, 'exam')) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="App.startExam('${bankId}')">${Utils.icon('file-text')} 考试</button>`);
        }

        // 如果没有任何按钮，显示提示
        if (btns.length === 0) {
            btns.push(`<span style="font-size:12px;color:var(--text-tertiary)">暂无可用模式</span>`);
        }

        return btns.join('\n');
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
                    <div class="bank-empty-icon">${Utils.icon('book-open', 'icon-xl')}</div>
                    <div class="bank-empty-title">加载题库中...</div>
                    <div class="bank-empty-desc">请稍候，题库正在加载</div>
                </div>
            `;
            return;
        }

        // 更新题库计数
        const countEl = document.getElementById('bank-count');
        if (countEl) countEl.textContent = banks.length + ' 个题库';

        container.innerHTML = banks
            .map((bank) => {
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
                        ${(bank.categories || [])
                            .slice(0, 3)
                            .map((cat) => `<span class="tag">${Utils.escapeHtml(cat)}</span>`)
                            .join('')}
                        ${dueCount > 0 ? `<span class="tag tag-warning">${Utils.icon('brain')} ${dueCount} 待复习</span>` : ''}
                        <span class="tag">${bankTypes
                            .filter((t) => t !== 'all')
                            .map((t) => this.getTypeLabel(t))
                            .join(' · ')}</span>
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
                        ${bankTypes
                            .map((type) => {
                                const isActive =
                                    (this.state.selectedTypes[bank.id] || 'all') === type;
                                return `<button class="bank-type-btn ${isActive ? 'active' : ''}" onclick="App.selectType('${bank.id}', '${type}')">
                                ${type === 'all' ? Utils.icon('layers') + ' 全部' : this.getTypeLabel(type)}
                            </button>`;
                            })
                            .join('')}
                    </div>

                    <!-- 刷题模式按钮网格 -->
                    <div class="bank-card-modes">
                        ${this._renderModeButtons(bank.id, bank.allowed_modes, wrongCount, dueCount, bookmarkCount)}
                    </div>

                    <div class="bank-card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="App.resetProgress('${bank.id}')" title="重置进度">
                            <span>${Utils.icon('rotate-ccw')} 重置</span>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="App.exportBank('${bank.id}')" title="导出题库">
                            <span>${Utils.icon('download')} 导出</span>
                        </button>
                    </div>
                </div>
            `;
            })
            .join('');
        Utils.initIcons();
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
            const matched = bank.questions.filter((q) => {
                const searchText = [
                    q.question,
                    q.explanation,
                    q.category,
                    ...(q.options || []),
                    q.answer
                ].join(' ');
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
            banks: results.map((r) => ({
                bankId: r.bank.id,
                questionIds: r.matched.map((q) => q.id),
                count: r.count
            }))
        };
        sessionStorage.setItem('quiz_search_results', JSON.stringify(searchData));

        const firstBank = results[0].bank;
        const totalCount = results.reduce((s, r) => s + r.count, 0);
        Tracker.searchQuestions(keyword, totalCount);
        Utils.showToast(
            '找到 ' + totalCount + ' 道匹配题目',
            'success',
            2000
        );
        setTimeout(() => {
            window.location.href =
                'quiz.html?bank=' + firstBank.id + '&mode=search&q=' + encodeURIComponent(keyword);
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
     * 开始刷题
     * @param {string} bankId - 题库 ID
     */
    selectType(bankId, type) {
        this.state.selectedTypes[bankId] = type;
        Tracker.selectType(bankId, type);
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
        window.location.href = `quiz.html?bank=${bankId}&mode=${mode}${typeParam}`;
    },

    /**
     * 开始模拟考试
     */
    startExam(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        const totalQuestions = bank.questions?.length || 0;

        const defaultExamCount = Math.min(totalQuestions, 20);
        const content = `
            <p style="margin-bottom: var(--space-3); color: var(--text-secondary);">题库：${Utils.escapeHtml(bank.name)}（${totalQuestions}题）</p>
            <label>抽取题数（最多 ${totalQuestions} 题，0 表示全部）</label>
            <input type="number" id="exam-count" value="${defaultExamCount}" min="0" max="${totalQuestions}">
            <label>考试限时（分钟，0表示不限时）</label>
            <input type="number" id="exam-time" value="60" min="0" max="300">
            <label>及格线（百分比）</label>
            <input type="number" id="exam-pass" value="60" min="0" max="100">
        `;

        Utils.showModal({
            title: '📝 模拟考试设置',
            content,
            buttons: [
                {
                    label: '开始考试',
                    class: 'btn-primary',
                    onClick: (modal) => {
                        const count = parseInt(modal.querySelector('#exam-count').value) || 0;
                        const timeMinutes = parseInt(modal.querySelector('#exam-time').value) || 0;
                        const passRate = parseInt(modal.querySelector('#exam-pass').value) || 60;
                        const countParam = count > 0 ? `&count=${count}` : '';
                        const timeParam = timeMinutes > 0 ? `&time=${timeMinutes * 60}` : '';
                        window.location.href = `quiz.html?bank=${bankId}&mode=exam${countParam}${timeParam}&pass=${passRate}`;
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'sm'
        });
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

        Utils.showModal({
            title: `${Utils.icon('alert-triangle')} 重置进度`,
            content: `<p>确定要重置「${Utils.escapeHtml(bank.name)}」的所有进度吗？</p>`,
            buttons: [
                {
                    label: '确定重置',
                    class: 'btn-danger',
                    onClick: (modal) => {
                        modal.remove();
                        Storage.resetBankProgress(bankId);
                        Tracker.resetProgress(bankId, bank.name);
                        Utils.showToast('进度已重置', 'success');
                        this.loadData();
                        this.render();
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'sm'
        });
    },

    /**
     * 导出题库
     */
    exportBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        Tracker.exportBank(bankId, bank.name);
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
                const confirmed = await new Promise((resolve) => {
                    Utils.showModal({
                        title: `${Utils.icon('alert-triangle')} 覆盖题库`,
                        content: `<p>题库「${Utils.escapeHtml(data.name)}」已存在，是否覆盖？</p>`,
                        buttons: [
                            {
                                label: '确定覆盖',
                                class: 'btn-danger',
                                onClick: (modal) => {
                                    modal.remove();
                                    resolve(true);
                                }
                            },
                            {
                                label: '取消',
                                class: 'btn-secondary',
                                onClick: (modal) => {
                                    modal.remove();
                                    resolve(false);
                                }
                            }
                        ],
                        size: 'sm',
                        onClose: () => resolve(false)
                    });
                });
                if (!confirmed) return;
            }

            Storage.addBank(data);
            Tracker.importBank(data.name, data.questions?.length || 0);
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

        const themeLabels = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' };
        const themeIconNames = { auto: 'monitor', light: 'sun', dark: 'moon' };
        Utils.showToast(`${Utils.icon(themeIconNames[theme] || 'monitor')} 主题：${themeLabels[theme]}`, 'success', 1500);
    },

    /**
     * 打开主题设置
     */
    showThemePicker() {
        const current = document.documentElement.getAttribute('data-theme') || 'auto';
        const themeNames = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' };

        const themes = [
            { value: 'auto', icon: 'monitor', label: '跟随系统' },
            { value: 'light', icon: 'sun', label: '浅色模式' },
            { value: 'dark', icon: 'moon', label: '深色模式' }
        ];

        const content = themes
            .map(
                (t) => `
            <label style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; cursor: pointer;">
                <input type="radio" name="theme" value="${t.value}" ${t.value === current ? 'checked' : ''}>
                <span>${Utils.icon(t.icon)} ${t.label}</span>
            </label>
        `
            )
            .join('');

        Utils.showModal({
            title: `${Utils.icon('palette')} 选择主题`,
            content,
            buttons: [
                {
                    label: '确定',
                    class: 'btn-primary',
                    onClick: (modal) => {
                        const selected = modal.querySelector('input[name="theme"]:checked');
                        if (!selected) return;
                        const theme = selected.value;
                        if (theme === 'auto') {
                            document.documentElement.removeAttribute('data-theme');
                        } else {
                            document.documentElement.setAttribute('data-theme', theme);
                        }
                        Storage.updateSettings({ theme });
                        Utils.showToast(`已切换为 ${themeNames[theme]}`, 'success');
                        modal.remove();
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'sm'
        });
    },

    /**
     * 打开设置面板
     */
    showSettings() {
        const settings = Storage.getSettings();
        const fontSize = settings.fontSize || 16;
        const answerMode = settings.answerMode || 'normal';
        const swipeEnabled = settings.swipeNavigation !== false;
        const aiEngine = settings.aiEngine || 'metaso';
        const customAiEngine = settings.customAiEngine || '';

        const content = `
            <label>字体大小</label>
            <select id="setting-font-size">
                <option value="14" ${fontSize === 14 ? 'selected' : ''}>14px - 较小</option>
                <option value="16" ${fontSize === 16 ? 'selected' : ''}>16px - 标准</option>
                <option value="18" ${fontSize === 18 ? 'selected' : ''}>18px - 较大</option>
                <option value="20" ${fontSize === 20 ? 'selected' : ''}>20px - 大</option>
                <option value="24" ${fontSize === 24 ? 'selected' : ''}>24px - 超大</option>
            </select>
            <label>答题模式</label>
            <select id="setting-answer-mode">
                <option value="normal" ${answerMode === 'normal' ? 'selected' : ''}>普通模式 - 手动提交手动跳题</option>
                <option value="autoNext" ${answerMode === 'autoNext' ? 'selected' : ''}>自动跳题 - 手动提交答对自动跳</option>
                <option value="lightning" ${answerMode === 'lightning' ? 'selected' : ''}>闪电模式 - 点击即判答对自动跳</option>
                <option value="instant" ${answerMode === 'instant' ? 'selected' : ''}>即时判断 - 点击即判不自动跳</option>
            </select>
            <label>左右滑动</label>
            <label class="toggle-label">
                <input type="checkbox" id="setting-swipe" ${swipeEnabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span>滑动切换题目</span>
            </label>

            <label>AI 搜索引擎</label>
            <select id="setting-ai-engine">
                <option value="metaso" ${aiEngine === 'metaso' ? 'selected' : ''}>秘塔搜索 (metaso.cn)</option>
                <option value="felo" ${aiEngine === 'felo' ? 'selected' : ''}>Felo AI (felo.ai)</option>
                <option value="andi" ${aiEngine === 'andi' ? 'selected' : ''}>Andi Search (andisearch.com)</option>
                <option value="baidu" ${aiEngine === 'baidu' ? 'selected' : ''}>百度搜索 (baidu.com)</option>
                <option value="custom" ${aiEngine === 'custom' ? 'selected' : ''}>自定义引擎</option>
            </select>
            <div id="custom-engine-wrap" style="display: ${aiEngine === 'custom' ? 'block' : 'none'}; margin-top: 8px;">
                <label>自定义引擎 URL</label>
                <input type="text" id="setting-custom-engine" placeholder="https://example.com/search?q={keyword}" value="${Utils.escapeHtml(customAiEngine)}">
                <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">用 {keyword} 表示搜索关键词</p>
            </div>
        `;

        Utils.showModal({
            title: `${Utils.icon('settings')} 设置`,
            content,
            buttons: [
                {
                    label: '保存',
                    class: 'btn-primary',
                    onClick: (modal) => {
                        const size = parseInt(modal.querySelector('#setting-font-size').value);
                        const newAnswerMode = modal.querySelector('#setting-answer-mode').value;
                        const newAiEngine = modal.querySelector('#setting-ai-engine').value;
                        const newCustomEngine = modal.querySelector('#setting-custom-engine')?.value || '';

                        if (size >= 12 && size <= 24) {
                            Storage.updateSettings({ fontSize: size });
                            Utils.applyFontSize(size);
                        }

                        const newSwipe = modal.querySelector('#setting-swipe').checked;

                        Storage.updateSettings({
                            answerMode: newAnswerMode,
                            swipeNavigation: newSwipe,
                            aiEngine: newAiEngine,
                            customAiEngine: newCustomEngine
                        });

                        // 同步设置到云端
                        API.pushSettings(Storage.getSettings());

                        Utils.showToast('设置已保存', 'success');
                        modal.remove();
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'sm'
        });

        // 监听 AI 引擎选择变化（showModal 已同步插入 DOM，元素立即可用）
        const engineSelect = document.getElementById('setting-ai-engine');
        const customWrap = document.getElementById('custom-engine-wrap');
        if (engineSelect && customWrap) {
            engineSelect.addEventListener('change', () => {
                customWrap.style.display = engineSelect.value === 'custom' ? 'block' : 'none';
            });
        }
    },

    /**
     * 显示键盘快捷键参考
     */
    showShortcuts() {
        const shown = localStorage.getItem('quiz_shortcuts_shown');
        Utils.showToast('快捷键：Enter 提交 · A-D 选答案 · Alt+←→ 切换 · 1/0 判断', 'info', 5000);
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

        const syncBtn = document.getElementById('btn-sync');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                if (API.isRegistered()) {
                    API.showAccountPanel();
                } else {
                    API.showRegisterModal();
                }
            });
        }

        // 快捷键帮助
        const shortcutsBtn = document.getElementById('btn-shortcuts');
        if (shortcutsBtn) {
            shortcutsBtn.addEventListener('click', () => this.showShortcuts());
        }

        // 应用字体大小
        const settings = Storage.getSettings();
        if (settings.fontSize) {
            Utils.applyFontSize(settings.fontSize);
        }

        // 应用主题
        if (settings.theme && settings.theme !== 'auto') {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }

        // 首次访问显示快捷键提示
        if (!localStorage.getItem('quiz_shortcuts_shown')) {
            setTimeout(() => {
                Utils.showToast(`${Utils.icon('lightbulb')} 按 Enter 提交 · Alt+←→ 切换 · A-D 选答案`, 'info', 4000);
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
