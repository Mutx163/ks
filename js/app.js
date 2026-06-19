/**
 * 主应用模块
 */

// 首页首屏只需要图标；Prism/KaTeX/Marked 留给题目页或 AI 解读按需加载。
import './vendor/lucide.js';


import LogCollector from './logCollector.js';
import Storage from './storage.js';
import Utils from './utils.js';
import BankLoader from './bankLoader.js';
import Tracker from './tracker.js';
import API from './api.js';
import Perf from './perf.js';
import AIEngines from './aiEngines.js';
import AIExplain from './aiExplain.js';

const App = {
    state: {
        banks: [],
        stats: null,
        lightningMode: false,
        selectedTypes: {},
        customStatsLoaded: false
    },

    _fullBanksPromise: null,

    async init() {
        Perf.init('首页');
        window._pageStartTime = window._pageStartTime || Date.now();
        // AI 解读配置首屏不需要，打开设置时再加载，避免和题库接口抢占首屏网络。

        // 初始化网络状态监听
        Utils.initNetworkMonitor();

        // 首屏只等待题库列表，题目详情后台补齐，避免 1+N 个题库详情请求阻塞 LCP。
        Perf.mark('开始加载题库列表');
        let banksLoadFailed = false;
        let bankList;
        try {
            bankList = await Promise.race([
                BankLoader.loadBankList(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
            ]);
            bankList.forEach((bank) => Storage.setBank(bank));
            Perf.mark('题库列表加载完成');
        } catch (e) {
            Perf.mark('题库列表加载失败');
            banksLoadFailed = true;
            console.warn('[App] 题库列表加载超时或失败:', e.message);
        }

        // 云同步和完整题库详情都不是首屏必需，首屏稳定后再后台执行。
        Perf.mark('后台任务已安排');

        Perf.mark('加载本地数据');
        this.loadData();

        Perf.mark('开始渲染');
        this.render();
        this.bindEvents();
        Perf.mark('渲染完成');

        // 真实内容渲染完成后再隐藏骨架屏，避免空布局 → 实际内容的中间态造成 CLS。
        const skeleton = document.getElementById('loading-skeleton');
        const homeView = document.getElementById('home-view');
        const banksSection = document.getElementById('section-banks');
        const showReal = () => {
            if (banksSection) banksSection.style.display = '';
            if (homeView) homeView.classList.remove('is-preparing');
            if (skeleton) skeleton.classList.add('hidden');
        };
        const elapsed = Date.now() - window._pageStartTime;
        if (elapsed < 500) setTimeout(showReal, 500 - elapsed);
        else showReal();

        // 首次访问：提示注册
        if (!API.isRegistered()) {
            setTimeout(() => {
                API.showRegisterModal().then((ok) => {
                    if (ok) {
                        this.loadData();
                        this.render();
                    }
                });
            }, 1500);
        }

        // 加载公告横幅
        Perf.mark('加载公告');
        this.loadAnnouncement();

        // 显示题库加载失败提示
        if (banksLoadFailed && this.state.banks.length === 0) {
            this.showBanksLoadError();
        }

        Perf.done({
            bankCount: this.state.banks.length,
            isRegistered: API.isRegistered()
        });

        this.schedulePostPaintTasks(bankList);
    },

    schedulePostPaintTasks(bankList = null) {
        const run = () => {
            if (Array.isArray(bankList) && bankList.length > 0) {
                this.loadFullBanksInBackground(bankList);
            }

            API.autoSync()
                .then((synced) => {
                    if (synced) {
                        this.loadData();
                        this.render();
                    }
                })
                .catch((e) => {
                    console.warn('[App] 云同步失败:', e.message);
                });
        };

        // 留出时间让 LCP/CLS 稳定，避免后台详情和同步重渲染抢首屏。
        setTimeout(() => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(run, { timeout: 4000 });
            } else {
                run();
            }
        }, 2500);
    },

    loadFullBanksInBackground(bankList = null) {
        if (this._fullBanksPromise) return this._fullBanksPromise;

        this._fullBanksPromise = BankLoader.loadAllBanks(bankList)
            .then((banks) => {
                if (banks.length > 0) {
                    this.loadData();
                    this.render();
                }
                return banks;
            })
            .catch((e) => {
                console.warn('[App] 题库详情后台加载失败:', e.message);
                return [];
            })
            .finally(() => {
                this._fullBanksPromise = null;
            });

        return this._fullBanksPromise;
    },

    async ensureBankLoaded(bankId) {
        const current = Storage.getBank(bankId);
        if (current && !current._metadataOnly) return current;

        if (this._fullBanksPromise) {
            await this._fullBanksPromise;
            const hydrated = Storage.getBank(bankId);
            if (hydrated && !hydrated._metadataOnly) return hydrated;
        }

        Utils.showToast('正在加载题库详情...', 'info', 1200);
        const loaded = await BankLoader.loadBank(bankId);
        if (loaded) {
            this.loadData();
            this.render();
            return loaded;
        }

        Utils.showToast('题库详情加载失败，请稍后重试', 'error');
        return null;
    },

    loadData() {
        // 过滤掉禁用的题库（兼容本地缓存）
        const allBanks = Storage.getBanks();
        const enabledBanks = allBanks.filter((b) => b.enabled !== false);

        this.state.banks = enabledBanks;
        this.state.stats = Storage.getGlobalStats();

        // 写入共享内存，供排行榜、分析、趋势等路由免除重新提取开销
        window.localBanksCache = enabledBanks;

        // 恢复排序选项
        this.state.bankSort = localStorage.getItem('quiz_bank_sort') || 'recent';
        const sortSelect = document.getElementById('bank-sort');
        if (sortSelect) sortSelect.value = this.state.bankSort;
    },

    /**
     * 显示题库加载失败的友好提示
     */
    showBanksLoadError() {
        const bankGrid = document.getElementById('bank-grid');
        if (!bankGrid) return;

        bankGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i data-lucide="wifi-off"></i>
                </div>
                <div class="empty-title">网络连接失败</div>
                <div class="empty-desc">无法加载题库，请检查网络后重试</div>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i data-lucide="refresh-cw"></i> 重新加载
                </button>
            </div>
        `;
        Utils.initIcons?.();

        // 同时显示 toast 提示
        Utils.showNetworkError('题库加载失败，请检查网络连接', () => {
            location.reload();
        });
    },

    render() {
        this.renderSmartBanner();
        this.renderWrongBook();
        this.renderStatsOverview();
        this.renderBankGrid();
        this.renderCustomStats();
    },

    async renderCustomStats() {
        const totalEl = document.getElementById('stat-total-active');
        const todayEl = document.getElementById('stat-today-active');
        const listEl = document.getElementById('recent-users-container');
        if (!totalEl || !todayEl || !listEl) return;

        // 如果还没有加载过 stats，显示 loading 骨架
        if (!this.state.customStatsLoaded) {
            listEl.innerHTML = `
                <div class="stats-loading">
                    <div class="stats-loading-spinner"></div>
                    <span>加载中...</span>
                </div>
            `;
        }

        // 数字滚动动画辅助函数
        const animateNumber = (element, targetValue) => {
            let startTimestamp = null;
            const duration = 800; // 动画持续 800ms
            const startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
            if (startValue === targetValue) {
                element.textContent = Utils.formatNumber(targetValue);
                return;
            }

            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const current = Math.floor(progress * (targetValue - startValue) + startValue);
                element.textContent = Utils.formatNumber(current);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        };

        try {
            console.log('[Stats Widget] 开始拉取系统活跃及刷题人数数据...');
            // 通过 stats=1 参数获取数据，限额设为 50 以备前端降级计算所需
            const data = await API.getLeaderboard('answered', 50, true);

            if (!data || !data.ok) {
                console.warn('[Stats Widget] 数据拉取失败，返回格式不符合预期:', data);
                if (!this.state.customStatsLoaded) {
                    listEl.innerHTML = `<div style="color:var(--text-tertiary); font-size:var(--font-size-xs); text-align:center; padding:var(--space-2) 0;">获取数据失败</div>`;
                }
                return;
            }

            let statsData = data.statsData;
            if (statsData) {
                console.log('[Stats Widget] 数据拉取成功！使用云端精确统计数据:', statsData);
            } else {
                // 降级计算：若云端未升级，利用排行榜前50个样本在前端本地计算活跃数
                const leaderboard = data.leaderboard || [];
                const todayStr = new Date().toISOString().slice(0, 10);
                const todayActiveCount = leaderboard.filter((user) => {
                    return user.lastActive && user.lastActive.startsWith(todayStr);
                }).length;
                const recentActiveUsers = leaderboard
                    .filter((user) => user.lastActive)
                    .sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))
                    .slice(0, 5)
                    .map((user) => ({
                        initials: user.initials || '??',
                        lastActive: user.lastActive
                    }));
                statsData = {
                    totalActiveCount: leaderboard.length,
                    todayActiveCount: todayActiveCount,
                    recentActiveUsers: recentActiveUsers
                };
                console.info(
                    '[Stats Widget] 云端暂未提供统计指标，已自动启用前端数据源降级计算:',
                    statsData
                );
            }

            const { totalActiveCount, todayActiveCount, recentActiveUsers } = statsData;

            // 数字递增滚动
            animateNumber(totalEl, totalActiveCount);
            animateNumber(todayEl, todayActiveCount);

            // 渲染最近活跃列表
            if (!recentActiveUsers || recentActiveUsers.length === 0) {
                listEl.innerHTML = `<div style="color:var(--text-tertiary); font-size:var(--font-size-xs); text-align:center; padding:var(--space-2) 0;">暂无活跃记录</div>`;
            } else {
                listEl.innerHTML = recentActiveUsers
                    .map((u) => {
                        const initials = Utils.escapeHtml(u.initials || '??').toUpperCase();
                        const relativeTime = Utils.formatRelativeTime(u.lastActive);
                        return `
                        <div class="recent-user-item">
                            <div class="recent-user-info">
                                <div class="recent-user-avatar">${initials}</div>
                                <span class="recent-user-name">${initials}</span>
                            </div>
                            <span class="recent-user-time">${relativeTime}</span>
                        </div>
                    `;
                    })
                    .join('');
            }

            this.state.customStatsLoaded = true;
        } catch (e) {
            console.error('[Stats Widget] 请求网络失败或发生代码内部崩溃:', e);
            if (!this.state.customStatsLoaded) {
                listEl.innerHTML = `<div style="color:var(--text-tertiary); font-size:var(--font-size-xs); text-align:center; padding:var(--space-2) 0;">服务连接失败</div>`;
            }
        }
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
            <div class="wrong-book card-fade-in">
                <div class="wrong-book-header">
                    <span class="wrong-book-icon">${Utils.icon('x-circle')}</span>
                    <span class="wrong-book-title title-gradient">错题本</span>
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
        const cached = (() => {
            try {
                return localStorage.getItem(CACHE_KEY);
            } catch {
                return null;
            }
        })();
        if (cached) {
            this._renderAnnounceWrap(el, cached);
            shown = true;
        }

        // 尝试云 API
        try {
            const d = await API.request('/api/announce');
            if (d?.ok && d.announce?.content) {
                const text = Utils.escapeHtml(d.announce.content.replace(/\n/g, ' '));
                try {
                    localStorage.setItem(CACHE_KEY, text);
                } catch (e) {
                    console.warn('[公告] 缓存公告失败:', e.message);
                }
                this._renderAnnounceWrap(el, text);
                return;
            } else {
                // 没有公告时清除缓存
                try {
                    localStorage.removeItem(CACHE_KEY);
                } catch (e) {
                    console.warn('[公告] 清除公告缓存失败:', e.message);
                }
                if (!shown) el.style.display = 'none';
                return;
            }
        } catch (e) {
            console.warn('[公告] 请求失败:', e.message);
        }

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
        if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0) {
            return ['all'];
        }
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
            btns.push(
                `<button class="btn btn-primary btn-sm" onclick="App.startQuiz('${bankId}', 'all')">${Utils.icon('list')} 顺序刷题</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'random')) {
            btns.push(
                `<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'random')">${Utils.icon('shuffle')} 随机</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'shuffle_options')) {
            btns.push(
                `<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'shuffle_options')">${Utils.icon('refresh-cw')} 选项乱序</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'wrong')) {
            btns.push(
                `<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>${Utils.icon('alert-circle')} 错题${wrongCount > 0 ? '(' + wrongCount + ')' : ''}</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'review')) {
            btns.push(
                `<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'review')">${Utils.icon('book-open')} 背题</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'spaced') && dueCount > 0) {
            btns.push(
                `<button class="btn btn-accent btn-sm" onclick="App.startQuiz('${bankId}', 'spaced')">${Utils.icon('brain')} 复习(${dueCount})</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'bookmark') && bookmarkCount > 0) {
            btns.push(
                `<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bankId}', 'bookmark')">${Utils.icon('star')} 收藏(${bookmarkCount})</button>`
            );
        }
        if (this._isModeAllowed(allowedModes, 'exam')) {
            btns.push(
                `<button class="btn btn-secondary btn-sm" onclick="App.startExam('${bankId}')">${Utils.icon('file-text')} 考试</button>`
            );
        }

        // 如果没有任何按钮，显示提示
        if (btns.length === 0) {
            btns.push(
                `<span style="font-size:12px;color:var(--text-tertiary)">暂无可用模式</span>`
            );
        }

        return btns.join('\n');
    },

    /**
     * 排序题库
     */
    sortBanks(sortBy) {
        this.state.bankSort = sortBy;
        localStorage.setItem('quiz_bank_sort', sortBy);
        this.renderBankGrid();
    },

    /**
     * 获取排序后的题库列表
     */
    getSortedBanks() {
        const banks = [...this.state.banks];
        const sortBy = this.state.bankSort || localStorage.getItem('quiz_bank_sort') || 'recent';

        switch (sortBy) {
            case 'recent': {
                const recentIds = Storage.getRecentBanks();
                if (recentIds.length === 0) return banks;
                const recentSet = new Set(recentIds);
                const recent = banks.filter((b) => recentSet.has(b.id));
                const rest = banks.filter((b) => !recentSet.has(b.id));
                // 按最近使用顺序排序
                recent.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
                return [...recent, ...rest];
            }
            case 'name':
                return banks.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            case 'count':
                return banks.sort(
                    (a, b) =>
                        (b.questionCount || b.question_count || b.questions?.length || 0) -
                        (a.questionCount || a.question_count || a.questions?.length || 0)
                );
            case 'progress': {
                // 预计算 progress，避免在比较函数中 O(n log n) 次重复调用
                const progressMap = new Map(
                    banks.map((b) => [b.id, Storage.getBankStats(b.id).progress || 0])
                );
                return banks.sort((a, b) => progressMap.get(b.id) - progressMap.get(a.id));
            }
            default:
                return banks;
        }
    },

    /**
     * 渲染题库网格（瘦身版）
     */
    renderBankGrid() {
        const container = document.getElementById('bank-grid');
        const banks = this.getSortedBanks();

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
                const totalQuestions = bank.questionCount || bank.question_count || questions.length;
                const bankTypes = this.getBankTypes(bank);

                const iconClass = bank.id.includes('c-language') ? 'c-lang' : 'default';
                const iconText = bank.id.includes('c-language') ? 'C' : 'Q';

                return `
                <div class="bank-card card-fade-in" data-id="${bank.id}">
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
                            共 <span class="bank-card-stat-num">${totalQuestions}</span> 题
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
    async searchQuestions() {
        const input = document.getElementById('search-input');
        const keyword = input ? input.value.trim() : '';
        if (!keyword) return;

        if (this.state.banks.some((bank) => bank._metadataOnly)) {
            Utils.showToast('正在加载题库详情用于搜索...', 'info', 1500);
            await this.loadFullBanksInBackground(this.state.banks);
            this.loadData();
        }

        const results = [];
        const banks = this.state.banks;
        for (const bank of banks) {
            if (!Array.isArray(bank.questions) || bank.questions.length === 0) continue;
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
        Utils.showToast('找到 ' + totalCount + ' 道匹配题目', 'success', 2000);
        setTimeout(() => {
            window.location.href =
                'quiz.html?bank=' + firstBank.id + '&mode=review&q=' + encodeURIComponent(keyword);
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
        // 记录题库使用
        Storage.recordBankUsage(bankId);
        const selectedType = this.state.selectedTypes[bankId] || 'all';
        const typeParam = selectedType !== 'all' ? `&type=${selectedType}` : '';
        window.location.href = `quiz.html?bank=${bankId}&mode=${mode}${typeParam}`;
    },

    /**
     * 开始模拟考试
     */
    async startExam(bankId) {
        const bank = await this.ensureBankLoaded(bankId);
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
    async exportBank(bankId) {
        const bank = await this.ensureBankLoaded(bankId);
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

            Storage.setBank(data);
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
    cycleTheme(triggerElement) {
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
        Utils.updateBrowserThemeColor();

        // 旋转动效增强
        const applySpin = (el) => {
            if (el) {
                el.classList.add('theme-spin');
                el.addEventListener(
                    'animationend',
                    () => {
                        el.classList.remove('theme-spin');
                    },
                    { once: true }
                );
            }
        };

        if (triggerElement) {
            applySpin(triggerElement);
        } else {
            document.querySelectorAll('.action-theme-toggle, #btn-theme').forEach(applySpin);
        }

        const themeLabels = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' };
        const themeIconNames = { auto: 'monitor', light: 'sun', dark: 'moon' };
        Utils.showToast(
            `${Utils.icon(themeIconNames[theme] || 'monitor')} 主题：${themeLabels[theme]}`,
            'success',
            1500
        );
    },

    /**
     * 打开主题设置
     */
    showThemePicker() {
        // 记录打开时的初始状态
        const initialTheme = document.documentElement.getAttribute('data-theme') || 'auto';
        const initialColor = document.documentElement.getAttribute('data-color') || 'parchment';
        
        const themes = [
            { value: 'auto', icon: 'monitor', label: '跟随系统' },
            { value: 'light', icon: 'sun', label: '浅色模式' },
            { value: 'dark', icon: 'moon', label: '深色模式' }
        ];

        const colors = [
            { 
                value: 'parchment', 
                label: '暖色羊皮纸', 
                primary: '#155e9c', 
                bg: '#f1e9d2', 
                fg: '#4a3e2a' 
            },
            { 
                value: 'white', 
                label: '白色简洁', 
                primary: '#2563eb', 
                bg: '#ffffff', 
                fg: '#0f172a' 
            }
        ];

        // 拼接全新卡片式 UI
        const content = `
            <div class="theme-picker-section">
                <span class="theme-picker-label">色彩风格</span>
                <div class="theme-picker-grid-2">
                    ${colors.map(c => `
                        <div class="theme-picker-card ${c.value === initialColor ? 'active' : ''}" data-type="color" data-value="${c.value}">
                            <div class="check-badge">✓</div>
                            <div class="color-preview-dots">
                                <span class="color-dot" style="background-color: ${c.primary};" title="主色"></span>
                                <span class="color-dot" style="background-color: ${c.bg};" title="背景色"></span>
                                <span class="color-dot" style="background-color: ${c.fg};" title="文本色"></span>
                            </div>
                            <input type="radio" name="colorScheme" value="${c.value}" ${c.value === initialColor ? 'checked' : ''}>
                            <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">${c.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="theme-picker-section" style="border-top: 1px solid var(--border); padding-top: var(--space-3); margin-top: var(--space-3);">
                <span class="theme-picker-label">亮度模式</span>
                <div class="theme-picker-grid">
                    ${themes.map(t => `
                        <div class="theme-picker-card ${t.value === initialTheme ? 'active' : ''}" data-type="theme" data-value="${t.value}">
                            <div class="check-badge">✓</div>
                            ${Utils.icon(t.icon, 'theme-picker-icon')}
                            <input type="radio" name="theme" value="${t.value}" ${t.value === initialTheme ? 'checked' : ''}>
                            <span style="font-size: 11px; white-space: nowrap; color: var(--text-secondary);">${t.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        let confirmed = false;

        // 应用临时状态辅助函数
        const applyTempState = (theme, color) => {
            if (theme === 'auto') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }

            if (color === 'parchment') {
                document.documentElement.removeAttribute('data-color');
            } else {
                document.documentElement.setAttribute('data-color', color);
            }
            Utils.updateBrowserThemeColor();
        };

        const modal = Utils.showModal({
            title: `${Utils.icon('palette')} 主题设置`,
            content,
            buttons: [
                {
                    label: '确定',
                    class: 'btn-primary',
                    onClick: (overlay) => {
                        confirmed = true;
                        
                        // 获取当前高亮的卡片选项
                        const activeThemeCard = overlay.querySelector('.theme-picker-card[data-type="theme"].active');
                        const activeColorCard = overlay.querySelector('.theme-picker-card[data-type="color"].active');
                        
                        const theme = activeThemeCard ? activeThemeCard.dataset.value : 'auto';
                        const colorScheme = activeColorCard ? activeColorCard.dataset.value : 'parchment';

                        // 持久化保存
                        Storage.updateSettings({ theme, colorScheme });
                        applyTempState(theme, colorScheme);
                        
                        Utils.showToast('主题已更新', 'success');
                        overlay.remove();
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (overlay) => {
                        // 还原初始状态并关闭
                        applyTempState(initialTheme, initialColor);
                        overlay.remove();
                    }
                }
            ],
            size: 'sm',
            onClose: () => {
                // 如果没有点击确定直接关闭弹窗（例如 Esc/遮罩/右上角X），还原状态
                if (!confirmed) {
                    applyTempState(initialTheme, initialColor);
                }
            }
        });

        // 动态绑定卡片点击与实时预览事件
        if (modal) {
            modal.querySelectorAll('.theme-picker-card').forEach(card => {
                card.addEventListener('click', () => {
                    const type = card.dataset.type;

                    // 1. 清除当前类别中所有其他卡片的 active 状态，并取消 radio 选中
                    modal.querySelectorAll(`.theme-picker-card[data-type="${type}"]`).forEach(c => {
                        c.classList.remove('active');
                        const radio = c.querySelector('input[type="radio"]');
                        if (radio) radio.checked = false;
                    });

                    // 2. 激活当前点击的卡片并选中 radio
                    card.classList.add('active');
                    const currentRadio = card.querySelector('input[type="radio"]');
                    if (currentRadio) currentRadio.checked = true;

                    // 3. 读取最新的选择状态
                    const activeThemeCard = modal.querySelector('.theme-picker-card[data-type="theme"].active');
                    const activeColorCard = modal.querySelector('.theme-picker-card[data-type="color"].active');
                    const activeTheme = activeThemeCard ? activeThemeCard.dataset.value : 'auto';
                    const activeColor = activeColorCard ? activeColorCard.dataset.value : 'parchment';

                    // 4. 即时生效（Live Preview）
                    applyTempState(activeTheme, activeColor);
                });
            });
        }
    },

    /**
     * 打开设置面板
     */
    async showSettings() {
        await AIExplain.init();
        const settings = Storage.getSettings();
        const fontSize = settings.fontSize || 16;
        const answerMode = settings.answerMode || 'normal';
        const swipeEnabled = settings.swipeNavigation !== false;
        const aiSettings = AIEngines.normalizeSettings(settings);

        // 检查是否是管理员
        const hasAdminPwd = !!localStorage.getItem('admin_pwd');
        const isAdmin = hasAdminPwd || localStorage.getItem('ks_is_admin') === '1';

        const content = `
            <div class="settings-container">
                <!-- 基础个性化 -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        ${Utils.icon('user', 'settings-group-icon')}
                        <span>基础个性化</span>
                    </div>
                    <div class="settings-group-body">
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <span class="settings-item-title">字体大小</span>
                                <span class="settings-item-desc">调整刷题与解析内容的字体显示大小</span>
                            </div>
                            <div class="settings-item-control">
                                <select id="setting-font-size" class="settings-select">
                                    <option value="14" ${fontSize === 14 ? 'selected' : ''}>14px - 较小</option>
                                    <option value="16" ${fontSize === 16 ? 'selected' : ''}>16px - 标准</option>
                                    <option value="18" ${fontSize === 18 ? 'selected' : ''}>18px - 较大</option>
                                    <option value="20" ${fontSize === 20 ? 'selected' : ''}>20px - 大</option>
                                    <option value="24" ${fontSize === 24 ? 'selected' : ''}>24px - 超大</option>
                                </select>
                            </div>
                        </div>
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <span class="settings-item-title">左右滑动切换</span>
                                <span class="settings-item-desc">在刷题页左右滑动屏幕来切换题目</span>
                            </div>
                            <div class="settings-item-control">
                                <label class="toggle-label">
                                    <input type="checkbox" id="setting-swipe" ${swipeEnabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 答题偏好 -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        ${Utils.icon('check-square', 'settings-group-icon')}
                        <span>答题偏好</span>
                    </div>
                    <div class="settings-group-body">
                        <div class="settings-item vertical">
                            <div class="settings-item-info">
                                <span class="settings-item-title">答题判定模式</span>
                                <span class="settings-item-desc">控制点击选项后的验证逻辑与自动跳转方式</span>
                            </div>
                            <div class="settings-item-control">
                                <select id="setting-answer-mode" class="settings-select">
                                    <option value="normal" ${answerMode === 'normal' ? 'selected' : ''}>普通模式 - 手动提交手动跳题</option>
                                    <option value="autoNext" ${answerMode === 'autoNext' ? 'selected' : ''}>自动跳题 - 手动提交答对自动跳</option>
                                    <option value="lightning" ${answerMode === 'lightning' ? 'selected' : ''}>闪电模式 - 点击即判答对自动跳</option>
                                    <option value="instant" ${answerMode === 'instant' ? 'selected' : ''}>即时判断 - 点击即判不自动跳</option>
                                </select>
                            </div>
                        </div>
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <span class="settings-item-title">日志收集</span>
                                <span class="settings-item-desc">自动收集客户端运行错误以帮助改进产品稳定性</span>
                            </div>
                            <div class="settings-item-control">
                                <label class="toggle-label">
                                    <input type="checkbox" id="setting-log-collection" ${settings.logCollection !== false ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- AI 智能助理 -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        ${Utils.icon('cpu', 'settings-group-icon')}
                        <span>AI 智能助理</span>
                    </div>
                    <div class="settings-group-body">
                        ${AIEngines.renderSettingsFields(aiSettings)}
                        ${AIExplain.renderSettingsFields()}
                    </div>
                </div>

                <!-- 管理入口 -->
                ${
                    isAdmin
                        ? `
                <div style="margin-top: var(--space-2);">
                    <button class="btn-admin-entrance" onclick="window.open('admin.html', '_blank'); this.closest('.modal-overlay').remove();">
                        👑 进入管理后台
                    </button>
                </div>
                `
                        : ''
                }
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
                        const aiForm = AIEngines.readSettingsForm(modal);
                        if (aiForm.error) {
                            Utils.showToast(aiForm.error, 'error');
                            return;
                        }

                        if (size >= 12 && size <= 24) {
                            Storage.updateSettings({ fontSize: size });
                            Utils.applyFontSize(size);
                        }

                        const newSwipe = modal.querySelector('#setting-swipe').checked;
                        const newLogCollection = modal.querySelector('#setting-log-collection').checked;
                        LogCollector.setEnabled(newLogCollection);

                        Storage.updateSettings({
                            answerMode: newAnswerMode,
                            swipeNavigation: newSwipe,
                            logCollection: newLogCollection,
                            ...aiForm
                        });
                        AIExplain.saveSettingsFromModal(modal);

                        // 同步到云端
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
            size: 'lg'
        });

        const settingsModal = document
            .getElementById('setting-ai-engine')
            ?.closest('.modal-overlay');
        AIEngines.bindSettingsUI(settingsModal);
        AIExplain.bindSettingsUI(settingsModal);
    },

    /**
     * 显示键盘快捷键参考
     */
    showShortcuts() {
        Utils.showToast('快捷键：Enter 提交 · A-D 选答案 · Alt+←→ 切换 · 1/0 判断', 'info', 5000);
        localStorage.setItem('quiz_shortcuts_shown', '1');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 移动端：点击按钮后立即 blur，防止焦点高亮粘连
        document.addEventListener('pointerup', (e) => {
            const btn = e.target.closest('button, .btn, .bank-card, .bank-type-btn');
            if (btn) btn.blur();
        });

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

        // 全局顶栏/动作按钮事件委托
        document.addEventListener('click', (e) => {
            // 1. 打开主题设置
            const themeBtn =
                e.target.closest('.action-theme-toggle') || e.target.closest('#btn-theme');
            if (themeBtn) {
                e.preventDefault();
                this.showThemePicker();
                return;
            }

            // 2. 全局设置
            const settingsBtn =
                e.target.closest('.action-settings-toggle') || e.target.closest('#btn-settings');
            if (settingsBtn) {
                e.preventDefault();
                this.showSettings();
                return;
            }

            // 3. 历史记录
            const historyBtn =
                e.target.closest('.action-history-toggle') || e.target.closest('#btn-history');
            if (historyBtn) {
                e.preventDefault();
                window.location.hash = '#/trend';
                setTimeout(() => {
                    const el = document.getElementById('recent-history');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 150);
                return;
            }

            // 4. 多设备云同步
            const syncBtn =
                e.target.closest('.action-sync-toggle') || e.target.closest('#btn-sync');
            if (syncBtn) {
                e.preventDefault();
                if (API.isRegistered()) {
                    API.showAccountPanel();
                } else {
                    API.showRegisterModal().then((ok) => {
                        if (ok) {
                            this.loadData();
                            this.render();
                        }
                    });
                }
                return;
            }

            // 5. 快捷键帮助
            const shortcutsBtn =
                e.target.closest('.action-shortcuts-toggle') || e.target.closest('#btn-shortcuts');
            if (shortcutsBtn) {
                e.preventDefault();
                this.showShortcuts();
                return;
            }
        });

        // 应用字体大小
        const settings = Storage.getSettings();
        if (settings.fontSize) {
            Utils.applyFontSize(settings.fontSize);
        }

        // 应用主题
        if (settings.theme && settings.theme !== 'auto') {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }

        // 应用色彩主题
        if (settings.colorScheme && settings.colorScheme !== 'parchment') {
            document.documentElement.setAttribute('data-color', settings.colorScheme);
        }

        // 首次访问显示快捷键提示
        if (!localStorage.getItem('quiz_shortcuts_shown')) {
            setTimeout(() => {
                Utils.showToast(
                    `${Utils.icon('lightbulb')} 按 Enter 提交 · Alt+←→ 切换 · A-D 选答案`,
                    'info',
                    4000
                );
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
