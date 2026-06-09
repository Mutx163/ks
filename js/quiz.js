/**
 * 刷题页面模块
 * 处理答题逻辑、进度管理等
 */

import Storage from './storage.js';
import Utils from './utils.js';
import BankLoader from './bankLoader.js';
import Tracker from './tracker.js';
import API from './api.js';
import Perf from './perf.js';
import AIEngines from './aiEngines.js';
import AIExplain from './aiExplain.js';

const INPUT_SAVE_DEBOUNCE_MS = 300;
const FILL_AUTO_FOCUS_DELAY_MS = 100;
const LIGHTNING_NEXT_DELAY_MS = 300;
const NAV_UNLOCK_DELAY_MS = 250;
const SAVE_AND_QUIT_DELAY_MS = 300;
const SWIPE_THRESHOLD_PX = 70;

const Quiz = {
    state: {
        bankId: null,
        bank: null,
        questions: [],
        currentIndex: 0,
        mode: 'all',
        answers: {},
        submitted: {},
        showExplanation: {},
        isFinished: false,
        startTime: null,
        questionStartTime: null,
        questionTimes: {},
        examTimeLimit: 0,
        examPassRate: 60,
        examTimeRemaining: 0,
        examTimer: null,
        answerMode: 'normal',
        filterType: 'all',
        isReviewMode: false,
        _reviewDurationSaved: 0, // 背题模式已记录的学习时长（秒）
        isNavigating: false,
        optionOrderCache: {},
        _statsDirty: false,       // 是否有待上报的答题数据
        _statsTimer: null,        // 防抖上报定时器
        _lastPushAnswered: 0,     // 上次已推送的答题数（用于计算增量）
        _lastPushCorrect: 0,      // 上次已推送的正确数
        _lastPushDuration: 0      // 上次已推送的时长
    },

    async init() {
        Perf.init('刷题页');
        console.log('[Quiz] ========== 刷题页面初始化开始 ==========');
        
        const params = new URLSearchParams(window.location.search);
        this.state.bankId = params.get('bank');
        this.state.mode = params.get('mode') || 'all';
        this.state.filterType = params.get('type') || 'all';
        this.state.examTimeLimit = parseInt(params.get('time')) || 0;
        this.state.examPassRate = parseInt(params.get('pass')) || 60;
        this.state.examCount = parseInt(params.get('count')) || 0;

        console.log('[Quiz] 📋 URL 参数:', {
            bank: this.state.bankId,
            mode: this.state.mode,
            type: this.state.filterType,
            time: this.state.examTimeLimit,
            pass: this.state.examPassRate,
            count: this.state.examCount
        });

        // 搜索模式关键词（从首页搜索进入时，mode=review 且带 q 参数）
        if (params.get('q')) {
            this.state.searchKeyword = params.get('q') || '';
            console.log('[Quiz] 🔍 搜索关键词:', this.state.searchKeyword);
        }

        // 从设置读取答题模式
        const settings = Storage.getSettings();
        this.state.answerMode = settings.answerMode || 'normal';
        const aiConfigPromise = AIExplain.init().catch((e) => {
            console.warn('[Quiz] AI 解读配置加载失败:', e.message);
        });
        console.log('[Quiz] ⚙️ 用户设置:', settings);

        // 应用字体大小
        if (settings.fontSize) {
            Utils.applyFontSize(settings.fontSize);
        }

        if (!this.state.bankId) {
            console.error('[Quiz] ❌ 缺少题库参数');
            Utils.showToast('缺少题库参数', 'error');
            setTimeout(() => (window.location.href = 'index.html'), 1000);
            return;
        }

        // 加载题库数据
        Perf.mark('开始加载题库');
        console.log('[Quiz] 📚 开始加载题库:', this.state.bankId);
        this.state.bank = Storage.getBank(this.state.bankId);
        
        if (this.state.bank) {
            console.log('[Quiz] ⚡ 从本地缓存加载题库:', {
                id: this.state.bank.id,
                name: this.state.bank.name,
                version: this.state.bank.version,
                questionCount: this.state.bank.questions?.length
            });
        } else {
            console.log('[Quiz] 📡 本地无缓存，从 JSON 文件加载...');
        }
        
        if (!this.state.bank || !Array.isArray(this.state.bank.questions)) {
            console.log('[Quiz] 📡 尝试从云端加载题库...');
            await this.loadBankFromJson();
        }
        
        if (!this.state.bank || !Array.isArray(this.state.bank.questions)) {
            console.error('[Quiz] ❌ 题库加载失败');
            this.showOverlayError('题库加载失败', '即将返回首页…');
            setTimeout(() => (window.location.href = 'index.html'), 1500);
            return;
        }

        // 检查题库是否已被禁用
        if (this.state.bank.enabled === false) {
            console.warn('[Quiz] 🚫 题库已被管理员禁用:', this.state.bankId);
            this.showOverlayError('该题库已被管理员禁用', '即将返回首页…');
            setTimeout(() => (window.location.href = 'index.html'), 1500);
            return;
        }
        
        Perf.mark('题库加载完成');
        console.log('[Quiz] ✅ 题库加载成功:', {
            id: this.state.bank.id,
            name: this.state.bank.name,
            version: this.state.bank.version,
            questionCount: this.state.bank.questions.length
        });

        Perf.mark('准备题目');
        console.log('[Quiz] 🔄 准备题目列表...');
        this.prepareQuestions();
        Perf.mark('题目准备完成');
        console.log('[Quiz] ✅ 题目准备完成:', this.state.questions.length, '题');

        if (this.state.mode === 'review') {
            console.log('[Quiz] 📖 背题模式：自动显示所有答案');
            this.state.questions.forEach((q) => {
                this.state.submitted[q.id] = true;
                this.state.showExplanation[q.id] = true;
                this.state.answers[q.id] = q.answer;
            });
        }

        if (this.state.mode === 'wrong' && this.state.questions.length === 0) {
            console.log('[Quiz] ✨ 没有错题');
            Utils.showToast('没有错题，真棒！', 'success');
            setTimeout(() => (window.location.href = 'index.html'), 1000);
            return;
        }

        if (this.state.mode === 'spaced' && this.state.questions.length === 0) {
            console.log('[Quiz] 📅 没有需要复习的题目');
            Utils.showToast('没有需要复习的题目', 'info');
            setTimeout(() => (window.location.href = 'index.html'), 1000);
            return;
        }

        if (this.state.mode === 'bookmark' && this.state.questions.length === 0) {
            console.log('[Quiz] ⭐ 没有收藏的题目');
            Utils.showToast('没有收藏的题目', 'info');
            setTimeout(() => (window.location.href = 'index.html'), 1000);
            return;
        }

        // 检查注册状态，未注册跳回首页
        if (!API.isRegistered()) {
            console.log('[Quiz] 👤 未注册用户');
            Utils.showToast('请先在首页注册后再刷题', 'error');
            setTimeout(() => window.location.href = 'index.html', 1500);
            return;
        }

        Perf.mark('恢复会话');
        console.log('[Quiz] 📂 恢复会话状态...');
        this.restoreSession();
        this.state.startTime = Date.now();
        this.state.questionStartTime = Date.now();

        if (this.state.mode === 'exam') {
            console.log('[Quiz] ⏱️ 考试模式：启动计时器');
            this.startExamTimer();
        }

        await aiConfigPromise;

        Perf.mark('开始渲染');
        console.log('[Quiz] 🎨 开始渲染页面...');
        this.render();
        this.showBankWelcome();
        this.bindEvents();
        Perf.mark('渲染完成');

        this.autoSaveInterval = setInterval(() => this.saveSession(), 30000);
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);

        // 追踪：开始刷题
        Tracker.startQuiz(this.state.bankId, this.state.bank?.name || '', this.state.mode, this.state.questions.length);

        // 页面关闭/刷新前刷新待上报数据
        this._beforeUnloadHandler = () => this._flushStatsSync();
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
        
        console.log('[Quiz] ========== 刷题页面初始化完成 ==========');
        
        // 输出性能汇总
        Perf.done({
            bankId: this.state.bankId,
            bankName: this.state.bank?.name,
            mode: this.state.mode,
            questionCount: this.state.questions.length
        });
    },

    updateTimerDisplay() {
        const timerEl = document.getElementById('question-timer');
        if (timerEl) {
            timerEl.textContent = this.getQuestionTimeDisplay();
        }
    },

    restoreSession() {
        const session = Storage.getSession(this.state.bankId, this.state.mode);
        console.log('[Quiz] 📂 恢复会话:', {
            bankId: this.state.bankId,
            mode: this.state.mode,
            found: !!session,
            answers: session ? Object.keys(session.answers || {}).length : 0,
            submitted: session ? Object.keys(session.submitted || {}).length : 0
        });
        if (!session) {
            // 考试模式、随机模式等首次进入时保存题目顺序
            if (this.state.mode === 'exam' || this.state.mode === 'random' || this.state.mode === 'shuffle_options') {
                this.state.savedOrderIds = this.state.questions.map((q) => q.id);
            }
            return;
        }

        this.state.currentIndex = session.currentIndex || 0;
        // 边界检查：防止 currentIndex 超出题目列表范围
        if (this.state.currentIndex >= this.state.questions.length) {
            this.state.currentIndex = 0;
        }
        if (this.state.mode !== 'review') {
            this.state.answers = session.answers || {};
            this.state.submitted = session.submitted || {};
            this.state.showExplanation = session.showExplanation || {};
        }
        this.state.questionTimes = session.questionTimes || {};
        this.state.optionOrderCache = session.optionOrderCache || {};
        this.state.savedOrderIds = session.questionOrderIds || null;

        // 恢复题目顺序（考试/随机/选项乱序模式）
        if (this.state.savedOrderIds &&
            (this.state.mode === 'exam' || this.state.mode === 'random' || this.state.mode === 'shuffle_options')) {
            if (this.state.mode === 'exam') {
                // 考试模式：用保存的题目 ID 从原始题库重建题目列表
                // 防止 prepareQuestions() 抽了不同题导致 ID 对不上
                const bankQuestions = this.state.bank?.questions || [];
                const idMap = new Map(bankQuestions.map(q => [q.id, q]));
                const restored = this.state.savedOrderIds
                    .map(id => idMap.get(id))
                    .filter(Boolean);
                if (restored.length > 0) {
                    this.state.questions = restored;
                }
            } else {
                const orderMap = new Map(
                    this.state.savedOrderIds.map((id, i) => [id, i])
                );
                this.state.questions.sort((a, b) => {
                    const oa = orderMap.get(a.id);
                    const ob = orderMap.get(b.id);
                    if (oa !== undefined && ob !== undefined) return oa - ob;
                    return 0;
                });
            }
        }

        // 恢复考试剩余时间
        if (this.state.mode === 'exam' && session.examTimeRemaining > 0) {
            this.state.examTimeRemaining = session.examTimeRemaining;
        }

        // 恢复已上报位置，防止页面刷新后重复计数
        this.state._lastPushAnswered = session.lastPushAnswered || 0;
        this.state._lastPushCorrect = session.lastPushCorrect || 0;
        this.state._lastPushDuration = session.lastPushDuration || 0;
    },

    saveSession() {
        // 考试/答题已结束后不再保存，防止 beforeunload 恢复已清除的会话
        if (this.state.isFinished) return;

        // 保存乱序/随机的题目顺序（含考试模式的随机抽题）
        const questionOrderIds =
            this.state.mode === 'random' || this.state.mode === 'shuffle_options' || this.state.mode === 'exam'
                ? this.state.questions.map((q) => q.id)
                : undefined;

        const extra = this.state.mode === 'exam' ? { examTimeRemaining: this.state.examTimeRemaining } : {};

        Storage.saveSession(this.state.bankId, this.state.mode, {
            currentIndex: this.state.currentIndex,
            filterType: this.state.filterType || 'all',
            answerMode: this.state.answerMode,
            answers: this.state.answers,
            submitted: this.state.submitted,
            showExplanation: this.state.showExplanation,
            questionTimes: this.state.questionTimes,
            optionOrderCache: this.state.optionOrderCache,
            questionOrderIds,
            // 已上报位置，页面刷新后避免重复计数
            lastPushAnswered: this.state._lastPushAnswered,
            lastPushCorrect: this.state._lastPushCorrect,
            lastPushDuration: this.state._lastPushDuration,
            ...extra
        });

        // 云同步：推送进度（防抖）
        API.pushProgress(Storage.getProgress());

        // 背题模式：每30秒自动保存一次学习时长
        this._saveReviewDuration();
    },

    /**
     * 背题模式：保存当前已积累的学习时长到总时长（增量）
     * 每页切换/每30秒自动调用，确保不点完成直接关页面也不会丢时长
     */
    _saveReviewDuration() {
        if (!this.state.isReviewMode || !this.state.startTime) return;

        const elapsed = Math.round((Date.now() - this.state.startTime) / 1000);
        const lastSaved = this.state._reviewDurationSaved || 0;

        if (elapsed > lastSaved) {
            Storage.addDuration(elapsed - lastSaved);
            this.state._reviewDurationSaved = elapsed;
        }
    },

    async loadBankFromJson() {
        // 更新遮罩文案
        const subEl = document.getElementById('quiz-loading-sub');
        if (subEl) subEl.textContent = '正在从云端获取题库数据…';

        const bank = await BankLoader.loadBankById(this.state.bankId);
        if (bank) {
            this.state.bank = bank;
            this._bankFromCloud = true;
        }
    },

    /**
     * 题库加载成功后显示欢迎过渡
     * 缓存命中 → 快速闪过(300ms)；云端加载 → 正常展示(800ms)
     */
    showBankWelcome() {
        const overlay = document.getElementById('quiz-loading-overlay');
        if (!overlay) return;

        const card = document.getElementById('quiz-loading-card');
        const titleEl = document.getElementById('quiz-loading-title');
        const subEl = document.getElementById('quiz-loading-sub');
        const bank = this.state.bank;
        const count = this.state.questions.length;

        const modeLabels = {
            all: '全部题目', wrong: '错题重练', review: '背题模式',
            exam: '考试模式', random: '随机练习', bookmark: '收藏题目',
            spaced: '间隔复习', shuffle_options: '选项乱序'
        };

        // 进入欢迎状态
        card.classList.add('welcome');
        titleEl.textContent = bank.name;
        subEl.textContent = `${count} 道题目 · ${modeLabels[this.state.mode] || '练习模式'}`;
        subEl.classList.add('bank-info');

        // 缓存命中快速闪过，云端加载正常展示
        const delay = this._bankFromCloud ? 800 : 300;
        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 450);
        }, delay);
    },

    /**
     * 加载失败时在遮罩上显示错误状态
     */
    showOverlayError(title, sub) {
        const overlay = document.getElementById('quiz-loading-overlay');
        if (!overlay) return;

        const card = document.getElementById('quiz-loading-card');
        const titleEl = document.getElementById('quiz-loading-title');
        const subEl = document.getElementById('quiz-loading-sub');

        card.classList.add('error');
        titleEl.textContent = title;
        subEl.textContent = sub;
    },

    prepareQuestions() {
        // 搜索模式：从 URL 参数或 sessionStorage 读取关键词
        if (this.state.searchKeyword) {
            const keyword = this.state.searchKeyword.toLowerCase();
            const allQuestions = [...(this.state.bank.questions || [])];
            const matched = allQuestions.filter((q) => {
                const searchText = [
                    q.question,
                    q.explanation,
                    q.category,
                    ...(q.options || []),
                    q.answer
                ].join(' ');
                return searchText.toLowerCase().includes(keyword);
            });
            if (matched.length === 0) {
                Utils.showToast(`未找到匹配题目：「${this.state.searchKeyword}」`, 'info', 3000);
            }
            this.state.questions = matched;
            // 搜索进入时使用背题模式
            this.state.isReviewMode = true;
            return;
        }
        let questions = [...(this.state.bank.questions || [])];

        if (this.state.filterType && this.state.filterType !== 'all') {
            questions = questions.filter((q) => q.type === this.state.filterType);
        }

        switch (this.state.mode) {
            case 'wrong': {
                const wrongIds = Storage.getWrongQuestions(this.state.bankId);
                questions = questions.filter((q) => wrongIds.includes(q.id));
                break;
            }
            case 'random':
            case 'shuffle_options':
                questions = Utils.shuffleArray(questions);
                break;
            case 'review':
                this.state.isReviewMode = true;
                break;
            case 'spaced': {
                const dueQuestions = Storage.getDueQuestions(this.state.bankId);
                questions = dueQuestions;
                break;
            }
            case 'bookmark': {
                const bookmarkIds = Storage.getBankBookmarks(this.state.bankId);
                questions = questions.filter((q) => bookmarkIds.includes(q.id));
                break;
            }
            case 'exam':
                // 按指定数量随机抽取题目
                if (this.state.examCount > 0 && this.state.examCount < questions.length) {
                    questions = Utils.shuffleArray(questions).slice(0, this.state.examCount);
                }
                break;
            case 'all':
            default:
                break;
        }

        this.state.questions = questions;
    },

    render() {
        this.renderHeader();
        this.renderQuestion();
        this.renderFooter();
        this.renderSidebarGrid();
    },

    /**
     * 渲染桌面端侧边栏题号网格
     */
    renderSidebarGrid() {
        const grid = document.getElementById('sidebar-grid');
        if (!grid) return;

        const questions = this.state.questions;
        const countEl = document.getElementById('sidebar-count');
        if (countEl) countEl.textContent = questions.length + ' 题';

        grid.innerHTML = questions
            .map((q, i) => {
                let cls = 'sidebar-grid-item';
                if (i === this.state.currentIndex) cls += ' current';
                else if (this.state.submitted[q.id]) {
                    cls += this.checkAnswer(q) ? ' correct' : ' wrong';
                }
                return `<div class="${cls}" data-index="${i}">${i + 1}</div>`;
            })
            .join('');

        // 绑定点击跳转
        grid.querySelectorAll('.sidebar-grid-item').forEach((item) => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                if (!isNaN(index)) this.goToQuestion(index);
            });
        });

        // 滚动当前项到可视区域
        const current = grid.querySelector('.sidebar-grid-item.current');
        if (current) {
            current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },

    recordQuestionTime() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question || !this.state.questionStartTime) return;

        const elapsed = Math.round((Date.now() - this.state.questionStartTime) / 1000);
        if (!this.state.questionTimes[question.id]) {
            this.state.questionTimes[question.id] = 0;
        }
        this.state.questionTimes[question.id] += elapsed;
        this.state.questionStartTime = Date.now();
    },

    getQuestionTimeDisplay() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return '';

        const saved = this.state.questionTimes[question.id] || 0;
        const current = this.state.questionStartTime
            ? Math.round((Date.now() - this.state.questionStartTime) / 1000)
            : 0;
        const total = saved + current;

        if (total < 60) return `${total}秒`;
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}分${seconds}秒`;
    },

    startExamTimer() {
        // 如果已恢复进度（刷新后），保留已恢复的剩余时间
        if (!this.state.examTimeRemaining || this.state.examTimeRemaining <= 0) {
            this.state.examTimeRemaining = this.state.examTimeLimit;
        }
        this.state.examTimer = setInterval(() => {
            this.state.examTimeRemaining--;
            this.updateExamTimerDisplay();

            if (this.state.examTimeRemaining <= 0) {
                clearInterval(this.state.examTimer);
                this.state.examTimer = null;
                Utils.showToast('考试时间到！', 'error');
                this.showFinishModal(true);
            }
        }, 1000);
    },

    updateExamTimerDisplay() {
        const el = document.getElementById('exam-timer');
        if (!el) return;

        const remaining = this.state.examTimeRemaining;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (remaining <= 300) {
            el.classList.add('danger');
        }
    },

    renderFooter() {
        const submitBtn = document.getElementById('btn-submit');
        const hint = document.getElementById('footer-hint');
        const footerActions = document.querySelector('.quiz-footer-actions');
        const question = this.state.questions[this.state.currentIndex];
        const isLightning = this.state.answerMode === 'lightning';
        const isInstant = this.state.answerMode === 'instant';
        const isAutoSubmit = isLightning || isInstant; // 闪电模式或即时模式
        const isAutoSubmitMultiple = isAutoSubmit && question?.type === 'multiple';
        const isSubmitted = question && this.state.submitted[question.id];
        const hasAns = question && this.hasAnswer(question);

        const setSubmitHidden = (hidden) => {
            if (submitBtn) submitBtn.style.display = hidden ? 'none' : '';
            if (footerActions) footerActions.classList.toggle('submit-hidden', hidden);
        };
        const setHint = (text) => {
            if (hint) hint.textContent = text;
        };

        if (!question || this.state.isFinished) {
            setSubmitHidden(true);
            setHint('');
            return;
        }

        if (this.state.isReviewMode) {
            setSubmitHidden(true);
            setHint('📖 背题模式 - 直接查看答案和解析');
        } else if (isSubmitted) {
            setSubmitHidden(true);
            setHint(this.getSubmittedHint(question));
        } else if (isAutoSubmit && !isAutoSubmitMultiple && question.type !== 'fill' && question.type !== 'code' && question.type !== 'essay') {
            // 单选/判断题：隐藏提交按钮，点击即判
            setSubmitHidden(true);
            setHint(isLightning 
                ? `闪电模式 - 点击选项直接判对错，答对自动跳题`
                : `即时判断 - 点击选项直接判对错，不自动跳题`);
        } else {
            // 普通模式、或闪电/即时模式的多选题
            setSubmitHidden(false);
            if (submitBtn) {
                submitBtn.disabled = !hasAns;
                submitBtn.title = hasAns ? '' : '请先作答';
            }
            setHint(
                isAutoSubmitMultiple
                    ? (isLightning 
                        ? `闪电模式 · 多选题请选择完整答案后提交，答对自动跳题`
                        : `即时判断 · 多选题请选择完整答案后提交，不自动跳题`)
                    : '按 Enter 提交 · A-D 选答案 · Alt+←→ 切换'
            );
        }

        // 最后一道题：下一题按钮变为完成
        const nextBtn = document.querySelector('.quiz-footer-actions .btn-secondary:nth-child(2)');
        if (nextBtn) {
            const isLast = this.state.currentIndex >= this.state.questions.length - 1;
            if (isLast) {
                nextBtn.textContent = '完成';
                nextBtn.onclick = () => this.finish();
            } else {
                nextBtn.textContent = '下一题';
                nextBtn.onclick = () => this.nextQuestion();
            }
        }
    },

    getSubmittedHint(question) {
        const answer = this.state.answers[question.id];
        const isEssay = question.type === 'essay' || question.type === '简答题';
        if (isEssay && answer?.selfCorrect === undefined) {
            return '已显示参考答案，请完成自评';
        }

        return this.checkAnswer(question) ? '回答正确，可进入下一题' : '回答错误，查看解析后继续';
    },

    renderHeader() {
        document.getElementById('quiz-title').textContent = this.state.bank.name;

        const timerEl = document.getElementById('exam-timer');
        if (timerEl) {
            timerEl.style.display = this.state.mode === 'exam' ? '' : 'none';
        }

        this.updateProgress();
    },

    updateProgress() {
        const current = this.state.currentIndex + 1;
        const total = this.state.questions.length;

        const progressFill = document.getElementById('quiz-progress-fill');
        if (progressFill) {
            progressFill.style.width = Math.round((current / total) * 100) + '%';
        }

        const progressText = document.getElementById('quiz-progress-text');
        if (progressText) {
            progressText.textContent = `${current} / ${total}`;
        }
    },

    /**
     * 渲染导航面包屑（固定在题目上方）
     */

    toggleNav() {
        const panel = document.getElementById('nav-panel');
        const overlay = document.getElementById('nav-overlay');
        panel.classList.toggle('show');
        overlay.classList.toggle('show');

        if (panel.classList.contains('show')) {
            this.renderQuestionNav();
            const current = panel.querySelector('.question-nav-item.current');
            if (current) {
                current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    },

    renderQuestionNav() {
        const container = document.getElementById('question-nav-grid');
        const questions = this.state.questions;

        container.innerHTML = questions
            .map((q, index) => {
                let cls = 'question-nav-item';
                if (index === this.state.currentIndex) {
                    cls += ' current';
                } else if (this.state.submitted[q.id]) {
                    cls += this.checkAnswer(q) ? ' correct' : ' wrong';
                }
                return `<div class="${cls}" data-index="${index}">${index + 1}</div>`;
            })
            .join('');

        container.querySelectorAll('.question-nav-item').forEach((item) => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.goToQuestion(index);
                document.getElementById('nav-panel').classList.remove('show');
                document.getElementById('nav-overlay').classList.remove('show');
            });
        });
    },

    renderQuestion() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) {
            console.warn('[Quiz] 没有题目可渲染', { currentIndex: this.state.currentIndex, questionsLength: this.state.questions.length });
            return;
        }

        const container = document.getElementById('question-container');
        const isReviewMode = this.state.isReviewMode;
        const isSubmitted = isReviewMode || this.state.submitted[question.id];
        const userAnswer = isReviewMode ? question.answer : this.state.answers[question.id];
        const isCorrect = isReviewMode ? true : isSubmitted ? this.checkAnswer(question) : null;
        const showExplanation = isReviewMode || this.state.showExplanation[question.id];

        const canUseAI = isSubmitted && AIExplain.isEnabled();

        let html = `
            <div class="question-card" data-question-id="${Utils.escapeHtml(question.id)}">
                <div class="question-header">
                    <div class="question-meta">
                        <span class="question-number">第 ${this.state.currentIndex + 1} 题</span>
                        <span class="question-type ${question.type}">${Utils.getTypeName(question.type)}</span>
                        <span class="question-timer" id="question-timer">${this.getQuestionTimeDisplay()}</span>
                        ${
                            question.difficulty
                                ? `
                            <div class="question-difficulty" aria-label="难度 ${question.difficulty}/5">
                                ${Array.from(
                                    { length: 5 },
                                    (_, i) =>
                                        `<div class="question-difficulty-dot ${i < question.difficulty ? 'active' : ''}"></div>`
                                ).join('')}
                            </div>
                        `
                                : ''
                        }
                    </div>
                    <div class="question-actions">
                        ${question.category ? `<span class="question-category">${Utils.escapeHtml(question.category)}</span>` : ''}
                        ${canUseAI ? `<button class="btn-ai" onclick="Quiz.openAIAnalysis(${question.id})" title="AI解析" aria-label="AI解析">${Utils.icon('sparkles')} AI</button>` : ''}
                        ${!isReviewMode ? `<button class="btn-bookmark ${Storage.isBookmarked(this.state.bankId, question.id) ? 'active' : ''}" onclick="Quiz.toggleBookmark(${question.id})" title="收藏" aria-label="收藏此题">${Storage.isBookmarked(this.state.bankId, question.id) ? Utils.icon('star', 'filled') : Utils.icon('star')}</button>` : ''}
                    </div>
                </div>

                <div class="question-body">
                    <div class="question-text">
                        ${Utils.parseMarkdown(question.question)}
                    </div>

                    ${question.img || question.image ? `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img class="question-image" src="${Utils.escapeHtml(question.img || question.image)}" alt="题目图片" loading="lazy" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>` : ''}

                    ${this.renderOptions(question, isSubmitted, userAnswer)}

                    ${isSubmitted && showExplanation ? this.renderExplanation(question, isCorrect) : ''}
                </div>
            </div>
        `;

        container.innerHTML = html;
        Utils.renderMath(container);
        Utils.highlightCode(container);
        Utils.initIcons();
        this.bindOptionEvents(question);
    },

    renderOptions(question, isSubmitted, userAnswer) {
        switch (question.type) {
            case 'single':
                return this.renderSingleOptions(question, isSubmitted, userAnswer);
            case 'multiple':
                return this.renderMultipleOptions(question, isSubmitted, userAnswer);
            case 'judge':
                return this.renderJudgeOptions(question, isSubmitted, userAnswer);
            case 'fill':
                return this.renderFillInput(question, isSubmitted, userAnswer);
            case 'code':
                return this.renderCodeInput(question, isSubmitted, userAnswer);
            case 'essay':
            case '简答题':
                return this.renderEssayInput(question, isSubmitted, userAnswer);
            default:
                return '';
        }
    },

    /**
     * 获取选项的显示列表（支持选项乱序）
     * 每个选项格式：{ displayLetter, originalLetter, text, img }
     * data-answer 始终存 originalLetter，checkAnswer 无需修改
     */
    getDisplayOptions(question) {
        const options = question.options || [];
        const normal = options.map((option, index) => {
            // 支持字符串或对象格式
            const text = typeof option === 'string' ? option : (option.text || '');
            const img = typeof option === 'object' ? (option.img || '') : '';
            return {
                displayLetter: String.fromCharCode(65 + index),
                originalLetter: String.fromCharCode(65 + index),
                text,
                img
            };
        });

        if (this.state.mode !== 'shuffle_options' && this.state.mode !== 'exam') return normal;

        // 缓存乱序顺序，保证同一题目刷新/切换后顺序不变
        if (!this.state.optionOrderCache[question.id]) {
            const indices = options.map((_, i) => i);
            this.state.optionOrderCache[question.id] = Utils.shuffleArray(indices);
        }

        return this.state.optionOrderCache[question.id].map((origIdx, displayIdx) => {
            const opt = options[origIdx];
            // 支持字符串或对象格式
            const text = typeof opt === 'string' ? opt : (opt.text || '');
            const img = typeof opt === 'object' ? (opt.img || '') : '';
            return {
                displayLetter: String.fromCharCode(65 + displayIdx),
                originalLetter: String.fromCharCode(65 + origIdx),
                text,
                img
            };
        });
    },

    renderSingleOptions(question, isSubmitted, userAnswer) {
        const displayOpts = this.getDisplayOptions(question);
        return `
            <div class="options-list" role="radiogroup" aria-label="选项">
                ${displayOpts
                    .map((opt) => {
                        const letter = opt.displayLetter;
                        const origLetter = opt.originalLetter;
                        const isCorrect = origLetter === question.answer;
                        const isUserSel = origLetter === userAnswer;
                        let cls = 'option-item';
                        let markerHtml = `<div class="option-marker">${letter}</div>`;
                        if (isSubmitted) {
                            if (isCorrect) {
                                cls += ' correct disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('check')}</div>`;
                            } else if (isUserSel && !isCorrect) {
                                cls += ' wrong disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('x')}</div>`;
                            } else {
                                cls += ' disabled';
                            }
                        } else if (isUserSel) {
                            cls += ' selected';
                        }
                        return `
                        <div class="${cls}" data-answer="${origLetter}" role="radio" aria-checked="${isUserSel}" tabindex="0">
                            ${markerHtml}
                            <div class="option-content">
                                ${Utils.parseMarkdown(opt.text.replace(/^[A-Z]\.\s*/, ''))}
                                ${opt.img ? `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img src="${Utils.escapeHtml(opt.img)}" class="option-image" loading="lazy" alt="选项图片" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>` : ''}
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    renderMultipleOptions(question, isSubmitted, userAnswer) {
        const displayOpts = this.getDisplayOptions(question);
        const userAnswers = userAnswer || [];
        const correctAnswers = question.answer || [];
        return `
            <div class="options-list" role="group" aria-label="选项">
                ${displayOpts
                    .map((opt) => {
                        const letter = opt.displayLetter;
                        const origLetter = opt.originalLetter;
                        let cls = 'option-item';
                        let markerHtml = `<div class="option-marker">${letter}</div>`;
                        if (isSubmitted) {
                            const isCorrectOption = correctAnswers.includes(origLetter);
                            const isUserSelected = userAnswers.includes(origLetter);
                            if (isCorrectOption) {
                                cls += ' correct disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('check')}</div>`;
                            } else if (isUserSelected) {
                                cls += ' wrong disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('x')}</div>`;
                            } else {
                                cls += ' disabled';
                            }
                        } else if (userAnswers.includes(origLetter)) {
                            cls += ' selected';
                        }
                        return `
                        <div class="${cls}" data-answer="${origLetter}" role="checkbox" aria-checked="${userAnswers.includes(origLetter)}" tabindex="0">
                            ${markerHtml}
                            <div class="option-content">
                                ${Utils.parseMarkdown(opt.text.replace(/^[A-Z]\.\s*/, ''))}
                                ${opt.img ? `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img src="${Utils.escapeHtml(opt.img)}" class="option-image" loading="lazy" alt="选项图片" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>` : ''}
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 多选题，可选择多个选项</div>' : ''}
        `;
    },

    renderJudgeOptions(question, isSubmitted, userAnswer) {
        return `
            <div class="judge-options" role="radiogroup" aria-label="判断选项">
                <div class="judge-option ${isSubmitted && question.answer === true ? 'correct' : ''} ${isSubmitted && userAnswer === true && question.answer !== true ? 'wrong' : ''} ${!isSubmitted && userAnswer === true ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="true" role="radio" aria-checked="${userAnswer === true}" tabindex="0">
                    <span class="judge-option-icon"></span>
                    <span>正确</span>
                </div>
                <div class="judge-option ${isSubmitted && question.answer === false ? 'correct' : ''} ${isSubmitted && userAnswer === false && question.answer !== false ? 'wrong' : ''} ${!isSubmitted && userAnswer === false ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="false" role="radio" aria-checked="${userAnswer === false}" tabindex="0">
                    <span class="judge-option-icon"></span>
                    <span>错误</span>
                </div>
            </div>
        `;
    },

    renderFillInput(question, isSubmitted, userAnswer) {
        const answers = userAnswer || [];
        const correctAnswers = question.answer || [];
        return `
            <div class="fill-inputs">
                ${correctAnswers
                    .map((correct, index) => {
                        let inputClass = 'fill-input';
                        if (isSubmitted) {
                            const isCorrect = this.checkFillAnswer(answers[index], correct);
                            inputClass += isCorrect ? ' correct' : ' wrong';
                        }
                        return `
                        <div class="fill-input-group">
                            <span class="fill-input-label">空${index + 1}</span>
                            <input type="text" class="${inputClass}" 
                                   data-index="${index}" 
                                   value="${answers[index] || ''}" 
                                   ${isSubmitted ? 'readonly' : ''}
                                   placeholder="请输入答案"
                                   aria-label="填空 ${index + 1}">
                        </div>
                    `;
                    })
                    .join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 填空题，输入后按 Enter 跳到下一空</div>' : ''}
        `;
    },

    renderCodeInput(question, isSubmitted, userAnswer) {
        const text = userAnswer?.text || userAnswer || '';
        return `
            <div style="margin-top:var(--space-4)">
                <div class="code-editor" id="code-editor" 
                     ${isSubmitted ? 'contenteditable="false"' : 'contenteditable="true"'}
                     role="textbox" aria-multiline="true" aria-label="代码编辑器"
                     data-placeholder="请输入代码...">${Utils.escapeHtml(text)}</div>
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 编程题，请编写代码</div>' : ''}
        `;
    },

    renderEssayInput(question, isSubmitted, userAnswer) {
        const answerText = (userAnswer?.text || '').trim();
        const selfCorrect = userAnswer?.selfCorrect;
        const isReviewMode = this.state.isReviewMode;

        // 背题模式：默认不显示输入区，由 renderExplanation 显示答案
        if (isReviewMode) return '';

        // 已自评：结果横幅由 renderExplanation 显示，这里只展示用户回答文本
        if (isSubmitted && selfCorrect !== undefined) {
            return answerText ? `
                <div style="margin-top:var(--space-4);padding:12px;background:var(--bg-hover);border-radius:var(--radius-sm)">
                    <strong>你的回答：</strong><br>${Utils.escapeHtml(answerText)}
                </div>
            ` : '';
        }

        // 已提交但未自评：显示自评按钮
        if (isSubmitted) {
            return `
                <div style="margin-top:var(--space-4)">
                    <div style="margin-bottom:12px">
                        <button class="btn btn-success btn-sm" onclick="Quiz.selfMarkEssay(${question.id}, true)">${Utils.icon('check-circle')} 我答对了</button>
                        <button class="btn btn-danger btn-sm" style="margin-left:8px" onclick="Quiz.selfMarkEssay(${question.id}, false)">${Utils.icon('x-circle')} 我答错了</button>
                    </div>
                </div>
            `;
        }

        return `
            <div style="margin-top:var(--space-4);text-align:center">
                <button class="btn btn-primary" style="padding:10px 32px;font-size:15px" onclick="Quiz.submitEssay(${question.id})">
                    📖 一键查看答案
                </button>
                <div style="margin-top:6px;font-size:12px;color:var(--text-tertiary)">点击按钮查看参考答案与解析</div>
            </div>
        `;
    },

    renderExplanation(question, isCorrect) {
        const isReviewMode = this.state.isReviewMode;
        const isEssay = question.type === 'essay' || question.type === '简答题';
        const essaySelfMarked =
            !isEssay || this.state.answers[question.id]?.selfCorrect !== undefined;
        const showResultBanner = !isReviewMode && essaySelfMarked;
        const essayAnswer =
            isEssay && question.answer
                ? `
            <div style="margin-bottom:var(--space-4)">
                <strong>参考答案：</strong>
                <div style="margin-top:8px">${Utils.parseMarkdown(question.answer)}</div>
                ${question.answerImg ? `<div style="margin-top:8px"><img src="${Utils.escapeHtml(question.answerImg)}" style="max-width:100%;max-height:300px;border-radius:var(--radius);border:1px solid var(--border)" alt="答案图片"></div>` : ''}
            </div>
        `
                : '';
        const essayAnswerImgOnly =
            isEssay && !question.answer && question.answerImg
                ? `
            <div style="margin-bottom:var(--space-4)">
                <strong>参考答案：</strong>
                <div style="margin-top:8px"><img src="${Utils.escapeHtml(question.answerImg)}" style="max-width:100%;max-height:300px;border-radius:var(--radius);border:1px solid var(--border)" alt="答案图片"></div>
            </div>
        `
                : '';
        return `
            ${
                showResultBanner
                    ? `
            <div class="result-banner ${isCorrect ? 'correct' : 'wrong'}">
                <span class="result-banner-icon">${isCorrect ? '🎉' : '😔'}</span>
                <span class="result-banner-text">${isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            `
                    : ''
            }

            <div class="explanation">
                <div class="explanation-header">
                    <span class="explanation-icon">💡</span>
                    <span>答案解析</span>
                </div>
                <div class="explanation-content">
                    ${essayAnswer}
                    ${essayAnswerImgOnly}
                    ${Utils.parseMarkdown(question.explanation || '暂无解析')}
                </div>
                ${
                    question.memoryAid
                        ? `
                    <div class="memory-aid">
                        <span class="memory-aid-icon">🧠</span>
                        <span class="memory-aid-text">${Utils.escapeHtml(question.memoryAid)}</span>
                    </div>
                `
                        : ''
                }
                ${
                    question.code
                        ? `
                    <div style="margin-top:var(--space-4)">
                        <strong>参考代码：</strong>
                        <pre><code class="language-${question.codeLanguage || 'c'}">${Utils.escapeHtml(question.code)}</code></pre>
                    </div>
                `
                        : ''
                }
            </div>
        `;
    },

    getQuestionCard() {
        return document.querySelector('#question-container .question-card');
    },

    updateSelectedOptionState(answer) {
        const card = this.getQuestionCard();
        if (!card) return;

        card.querySelectorAll('.option-item, .judge-option').forEach((item) => {
            const selected = item.dataset.answer === String(answer);
            item.classList.toggle('selected', selected);
            item.setAttribute('aria-checked', String(selected));
        });
    },

    updateMultipleOptionState(answers) {
        const card = this.getQuestionCard();
        if (!card) return;

        card.querySelectorAll('.option-item').forEach((item) => {
            const selected = answers.includes(item.dataset.answer);
            item.classList.toggle('selected', selected);
            item.setAttribute('aria-checked', String(selected));
        });
    },

    bindOptionEvents(question) {
        const isSubmitted = this.state.isReviewMode || this.state.submitted[question.id];
        if (isSubmitted) return;

        const card = this.getQuestionCard();
        if (!card) return;

        if (question.type === 'single') {
            card.querySelectorAll('.option-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.selectAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'multiple') {
            card.querySelectorAll('.option-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.toggleAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'judge') {
            card.querySelectorAll('.judge-option').forEach((item) => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer === 'true';
                    this.selectAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'fill') {
            card.querySelectorAll('.fill-input').forEach((input) => {
                input.addEventListener(
                    'input',
                    Utils.debounce(() => {
                        this.updateFillAnswer(question.id);
                    }, INPUT_SAVE_DEBOUNCE_MS)
                );
                // Enter 跳到下一空
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const inputs = [...card.querySelectorAll('.fill-input')];
                        const idx = inputs.indexOf(input);
                        if (idx < inputs.length - 1) {
                            inputs[idx + 1].focus();
                        } else {
                            this.submitCurrent();
                        }
                    }
                });
            });
            // 自动聚焦第一个空
            const firstInput = card.querySelector('.fill-input');
            if (firstInput) setTimeout(() => firstInput.focus(), FILL_AUTO_FOCUS_DELAY_MS);
        }

        if (question.type === 'code') {
            const editor = card.querySelector('#code-editor');
            if (editor) {
                const getText = () => editor.innerText || '';
                // 立即更新答案状态（用于判断提交按钮）
                const updateAnswer = () => {
                    this.state.answers[question.id] = getText();
                    this.renderFooter();
                };
                editor.addEventListener('input', updateAnswer);
                editor.addEventListener('paste', () => {
                    setTimeout(() => {
                        editor.textContent = getText();
                        updateAnswer();
                    }, 10);
                });
            }
        }
    },

    selectAnswer(questionId, answer) {
        const isLightning = this.state.answerMode === 'lightning';
        const isInstant = this.state.answerMode === 'instant';
        if ((isLightning || isInstant) && this.state.submitted[questionId]) {
            this.nextQuestion();
            return;
        }
        this.state.answers[questionId] = answer;
        if (isLightning || isInstant) {
            this.submitCurrent();
            return;
        }
        this.saveSession();
        // 只更新选中状态，不重绘整个题目
        this.updateSelectedOptionState(answer);
        this.renderFooter();
    },

    toggleAnswer(questionId, answer) {
        const isLightning = this.state.answerMode === 'lightning';
        const isInstant = this.state.answerMode === 'instant';
        if ((isLightning || isInstant) && this.state.submitted[questionId]) {
            this.nextQuestion();
            return;
        }
        if (!this.state.answers[questionId]) {
            this.state.answers[questionId] = [];
        }
        const answers = this.state.answers[questionId];
        const index = answers.indexOf(answer);
        if (index >= 0) {
            answers.splice(index, 1);
        } else {
            answers.push(answer);
            answers.sort();
        }
        this.saveSession();
        // 只更新选中状态，不重绘整个题目
        this.updateMultipleOptionState(answers);
        this.renderFooter();
    },

    updateFillAnswer(questionId) {
        const card = this.getQuestionCard();
        const inputs = card ? card.querySelectorAll('.fill-input') : [];
        const answers = [];
        inputs.forEach((input) => {
            answers.push(input.value.trim());
        });
        this.state.answers[questionId] = answers;
        this.saveSession();
        this.renderFooter();
    },

    submitEssay(questionId) {
        const question = this.state.questions.find((q) => q.id === questionId);
        if (!question) return;

        this.recordQuestionTime();
        this.state.answers[questionId] = { text: '' };
        this.state.submitted[questionId] = true;
        this.state.showExplanation[questionId] = true;
        this.saveSession();
        this.renderQuestion();
        this.renderFooter();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    selfMarkEssay(questionId, isCorrect) {
        const question = this.state.questions.find((q) => q.id === questionId);
        if (!question) return;

        const previous = this.state.answers[questionId] || {};
        const answer = {
            text: previous.text || '',
            selfCorrect: isCorrect
        };
        this.state.answers[questionId] = answer;
        this.state.submitted[questionId] = true;
        this.state.showExplanation[questionId] = true;
        Storage.updateQuestionProgress(this.state.bankId, questionId, isCorrect, answer);
        this.saveSession();
        this.renderQuestion();
        this.renderFooter();
    },

    submitCurrent() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return;

        if (this.state.submitted[question.id]) {
            this.nextQuestion();
            return;
        }

        if (!this.hasAnswer(question)) {
            if (this.state.answerMode !== 'lightning') {
                Utils.showToast('请先作答', 'info');
            }
            return;
        }

        this.recordQuestionTime();
        this.state.submitted[question.id] = true;
        this.state.showExplanation[question.id] = true;

        const isCorrect = this.checkAnswer(question);
        Storage.updateQuestionProgress(
            this.state.bankId,
            question.id,
            isCorrect,
            this.state.answers[question.id]
        );
        this.saveSession();

        // 追踪：提交答案
        Tracker.submitAnswer(this.state.bankId, question.type, isCorrect, question.difficulty);

        // 追踪：题目停留时间（热力图）
        const timeSpent = this.state.questionTimes[question.id] || 0;
        Tracker.questionTime(
            this.state.bankId,
            this.state.bank?.name || '',
            question.id,
            question.category,
            question.type,
            question.difficulty,
            timeSpent,
            isCorrect
        );

        // 云端上报：防抖 5s，累积后统一推送
        this._markStatsDirty();

        this.renderQuestion();
        this.renderFooter();

        const isLightning = this.state.answerMode === 'lightning';
        const isAutoNext = this.state.answerMode === 'autoNext';

        if (isLightning && isCorrect) {
            // 答对时添加闪烁动画
            const questionCard = this.getQuestionCard();
            if (questionCard) {
                questionCard.classList.add('correct-flash');
                setTimeout(
                    () => questionCard.classList.remove('correct-flash'),
                    LIGHTNING_NEXT_DELAY_MS
                );
            }
            setTimeout(() => this.nextQuestion(), LIGHTNING_NEXT_DELAY_MS);
            return;
        }

        // 自动跳题模式：答对后自动跳到下一题
        if (isAutoNext && isCorrect) {
            setTimeout(() => this.nextQuestion(), 500);
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    hasAnswer(question) {
        const answer = this.state.answers[question.id];
        switch (question.type) {
            case 'single':
            case 'judge':
                return answer !== undefined && answer !== null;
            case 'multiple':
                return Array.isArray(answer) && answer.length > 0;
            case 'fill':
                return Array.isArray(answer) && answer.some((a) => a.trim() !== '');
            case 'code':
                return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
            case 'essay':
            case '简答题':
                return answer && answer.selfCorrect !== undefined;
            default:
                return false;
        }
    },

    checkAnswer(question) {
        const userAnswer = this.state.answers[question.id];
        switch (question.type) {
            case 'single':
                return userAnswer === question.answer;
            case 'multiple': {
                const userSet = new Set(userAnswer || []);
                const correctSet = new Set(question.answer || []);
                return (
                    userSet.size === correctSet.size && [...userSet].every((a) => correctSet.has(a))
                );
            }
            case 'judge':
                return userAnswer === question.answer;
            case 'fill':
                return (question.answer || []).every((correct, index) =>
                    this.checkFillAnswer(userAnswer?.[index], correct)
                );
            case 'code':
                return true;
            case 'essay':
            case '简答题': {
                const eAns = this.state.answers[question.id];
                return eAns && eAns.selfCorrect === true;
            }
            default:
                return false;
        }
    },

    checkFillAnswer(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return false;
        return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    },

    nextQuestion() {
        if (this.state.isNavigating) return;
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.state.isNavigating = true;
            this.recordQuestionTime();
            this.state.currentIndex++;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this._markStatsDirty();
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                this.state.isNavigating = false;
            }, NAV_UNLOCK_DELAY_MS);
        }
    },

    toggleBookmark(questionId) {
        const isBookmarked = Storage.toggleBookmark(this.state.bankId, questionId);
        Utils.showToast(isBookmarked ? '已收藏' : '已取消收藏', 'success', 1500);
        this.renderQuestion();
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

            ${AIEngines.renderSettingsFields(aiSettings)}
            ${AIExplain.renderSettingsFields()}
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

                        Storage.updateSettings({
                            answerMode: newAnswerMode,
                            swipeNavigation: newSwipe,
                            ...aiForm
                        });
                        AIExplain.saveSettingsFromModal(modal);

                        // 更新当前答题模式
                        this.state.answerMode = newAnswerMode;

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
            size: 'lg'
        });

        const settingsModal = document.getElementById('setting-ai-engine')?.closest('.modal-overlay');
        AIEngines.bindSettingsUI(settingsModal);
        AIExplain.bindSettingsUI(settingsModal);
    },

    /**
     * 清理 markdown 标记，保留文本内容
     * @param {string} text - 原始文本
     * @returns {string} 清理后的文本
     */
    _cleanMarkdown(text) {
        return text
            .replace(/```(\w*)\n/g, '')
            .replace(/```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\$([^$]+)\$/g, '$1')
            .replace(/[#*_~[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * 构建 AI 搜索关键词
     * @param {object} question - 题目对象
     * @returns {string} 搜索关键词
     */
    _buildSearchKeyword(question) {
        let keyword = this._cleanMarkdown(question.question);

        // 补充选项（优先于代码，信息密度更高）— 使用乱序后的显示顺序
        const displayOpts = this.getDisplayOptions(question);
        if (displayOpts && displayOpts.length > 0) {
            keyword += ' ' + displayOpts.map(o => `${o.displayLetter}.${o.text}`).join(' ');
        }

        // 先截断文本部分
        if (keyword.length > 300) {
            keyword = keyword.substring(0, 300);
        }

        // 补充 code 字段（单独控制长度）
        if (question.code) {
            keyword += ' ' + question.code.substring(0, 200);
        }

        return keyword;
    },

    /**
     * 根据用户设置构建 AI 搜索 URL
     * @param {string} keyword - 搜索关键词
     * @returns {string} 完整的搜索 URL
     */
    _buildSearchUrl(keyword) {
        const settings = Storage.getSettings();
        const url = AIEngines.buildSearchUrl(settings, keyword);
        console.log('[AI] ✅ 使用搜索引擎:', {
            aiEngine: AIEngines.normalizeSettings(settings).aiEngine,
            keyword,
            url
        });
        return url;
    },

    /**
     * 打开 AI 解析页面
     * @param {number} questionId - 题目 ID
     */
    async openAIAnalysis(questionId) {
        const question = this.state.questions.find((q) => q.id === questionId);
        if (!question) return;

        await AIExplain.init();
        if (!AIExplain.isEnabled()) {
            Utils.showToast('管理员已关闭 AI 解读功能', 'error');
            return;
        }

        const isSubmitted = this.state.isReviewMode || this.state.submitted[question.id];
        const userAnswer = this.state.isReviewMode ? question.answer : this.state.answers[question.id];
        const isCorrect = this.state.isReviewMode ? true : isSubmitted ? this.checkAnswer(question) : null;

        if (AIExplain.isInPageMode()) {
            await AIExplain.openExplanation({
                question,
                bank: this.state.bank,
                userAnswer,
                isCorrect,
                displayOptions: this.getDisplayOptions(question)
            });
            return;
        }

        const keyword = this._buildSearchKeyword(question);
        const url = this._buildSearchUrl(keyword);
        window.open(url, '_blank');
    },

    prevQuestion() {
        if (this.state.isNavigating) return;
        if (this.state.currentIndex > 0) {
            this.state.isNavigating = true;
            this.recordQuestionTime();
            this.state.currentIndex--;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this._markStatsDirty();
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                this.state.isNavigating = false;
            }, NAV_UNLOCK_DELAY_MS);
        }
    },

    goToQuestion(index) {
        if (this.state.isNavigating) return;
        if (index >= 0 && index < this.state.questions.length) {
            this.state.isNavigating = true;
            this.recordQuestionTime();
            this.state.currentIndex = index;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                this.state.isNavigating = false;
            }, NAV_UNLOCK_DELAY_MS);
        }
    },

    /**
     * 滚动导航面包屑到当前题目
     */

    showFinishModal(isTimeout = false) {
        const total = this.state.questions.length;
        const answered = Object.keys(this.state.submitted).length;
        const unanswered = total - answered;

        // 计算正确数
        let correctCount = 0;
        const submittedIds = Object.keys(this.state.submitted);
        submittedIds.forEach((qId) => {
            const q = this.state.questions.find((q) => q.id == qId);
            if (q && this.checkAnswer(q)) correctCount++;
        });

        const hasUnanswered = unanswered > 0;
        const iconName = isTimeout ? 'clock' : hasUnanswered ? 'alert-circle' : 'check-circle-2';
        const iconColor = isTimeout ? 'warning' : hasUnanswered ? 'warning' : 'success';
        const wrongCount = answered - correctCount;

        const modalHtml = `
            <div class="finish-modal-overlay show" id="finish-modal">
                <div class="finish-modal" role="dialog" aria-modal="true" aria-label="答题完成确认">
                    <div class="finish-modal-icon-wrap ${iconColor}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <h3 class="finish-modal-title">${isTimeout ? '考试时间到' : hasUnanswered ? '还有题目未完成' : '全部答完！'}</h3>
                    <p class="finish-modal-desc">${isTimeout ? '时间已耗尽，请确认结束考试' : hasUnanswered ? `还有 ${unanswered} 题未答，确定要结束吗？` : '确认后查看答题结果'}</p>
                    <div class="finish-modal-stats">
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${answered}</div>
                            <div class="finish-modal-stat-label">已答</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value success">${correctCount}</div>
                            <div class="finish-modal-stat-label">正确</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value ${wrongCount > 0 ? 'danger' : ''}">${wrongCount}</div>
                            <div class="finish-modal-stat-label">错误</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${unanswered}</div>
                            <div class="finish-modal-stat-label">未答</div>
                        </div>
                    </div>
                    <div class="finish-modal-actions">
                        ${!isTimeout && hasUnanswered ? `<button class="btn btn-primary" onclick="Quiz.closeFinishModal()"><i data-lucide="book-open"></i> 继续答题</button>` : ''}
                        <button class="btn ${hasUnanswered ? 'btn-warning' : 'btn-primary'}" onclick="Quiz.confirmFinish()"><i data-lucide="check-circle-2"></i> 确认结束</button>
                    </div>
                    ${!isTimeout ? `
                    <div class="finish-modal-secondary">
                        <button class="btn btn-outline btn-sm" onclick="Quiz.saveAndQuit()"><i data-lucide="save"></i> 保存退出</button>
                    </div>` : ''}
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
        Utils.initIcons?.();

        // 绑定关闭事件
        const overlay = document.getElementById('finish-modal');
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeFinishModal(); });
        this._finishEscHandler = (e) => { if (e.key === 'Escape') this.closeFinishModal(); };
        document.addEventListener('keydown', this._finishEscHandler);
    },

    closeFinishModal() {
        if (this._finishEscHandler) {
            document.removeEventListener('keydown', this._finishEscHandler);
            this._finishEscHandler = null;
        }
        document.getElementById('finish-modal')?.remove();
    },

    /**
     * 保存进度并退出（不显示结果页）
     */
    saveAndQuit() {
        this.closeFinishModal();
        this.saveSession();
        Utils.showToast('进度已保存', 'success');
        setTimeout(() => (window.location.href = 'index.html'), SAVE_AND_QUIT_DELAY_MS);
    },

    /**
     * 确认结束答题 — 结果在弹窗内展示
     */
    confirmFinish() {
        this.closeFinishModal();

        if (this.state.examTimer) {
            clearInterval(this.state.examTimer);
            this.state.examTimer = null;
        }
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.recordQuestionTime();
        Storage.clearSession(this.state.bankId, this.state.mode);
        this.state.isFinished = true;

        // 保存历史 + 推送统计 + 追踪
        this._saveAndTrackStats();

        // 隐藏底部栏
        const footer = document.querySelector('.quiz-footer');
        if (footer) footer.style.display = 'none';

        // 弹窗内显示结果
        this.showResultModal();
    },

    /**
     * 保存历史记录、推送统计数据、发送追踪事件
     * 从原 renderResult 中抽离，供 confirmFinish 和 renderResult 共用
     */
    _saveAndTrackStats() {
        const duration = Math.round((Date.now() - this.state.startTime) / 1000);
        const submittedIds = Object.keys(this.state.submitted);
        const correctCount = submittedIds.filter((qId) => {
            const q = this.state.questions.find((q) => q.id == qId);
            return q && this.checkAnswer(q);
        }).length;
        const isExam = this.state.mode === 'exam';

        // 背题模式：结束前补齐剩余时长
        this._saveReviewDuration();

        Storage.addHistory({
            bankId: this.state.bankId,
            bankName: this.state.bank.name,
            mode: this.state.mode,
            total: this.state.questions.length,
            correct: correctCount,
            duration
        });

        if (isExam) {
            Tracker.finishExam(this.state.bankId, this.state.questions.length, correctCount,
                submittedIds.length > 0 ? Math.round((correctCount / submittedIds.length) * 100) : 0,
                duration, false);
        } else {
            Tracker.finishQuiz(this.state.bankId, this.state.bank.name, this.state.mode,
                this.state.questions.length, correctCount, submittedIds.length - correctCount,
                submittedIds.length > 0 ? Math.round((correctCount / submittedIds.length) * 100) : 0,
                duration);
        }

        // 热力图
        const heatmapData = submittedIds.map(qId => {
            const q = this.state.questions.find(q => q.id == qId);
            return { id: qId, category: q?.category, type: q?.type, difficulty: q?.difficulty,
                timeSpent: this.state.questionTimes[qId] || 0, isCorrect: q ? this.checkAnswer(q) : false };
        });
        Tracker.questionHeatmap(this.state.bankId, this.state.bank.name, heatmapData);

        // 清除防抖定时器，推送增量
        if (this.state._statsTimer) { clearTimeout(this.state._statsTimer); this.state._statsTimer = null; }
        this.state._statsDirty = false;
        const dA = submittedIds.length - (this.state._lastPushAnswered || 0);
        const dC = correctCount - (this.state._lastPushCorrect || 0);
        const dD = duration - (this.state._lastPushDuration || 0);
        if (dA > 0 || dC > 0 || dD > 0) {
            this.state._lastPushAnswered = submittedIds.length;
            this.state._lastPushCorrect = correctCount;
            this.state._lastPushDuration = duration;
            API.pushStats({ bankId: this.state.bankId, bankName: this.state.bank.name,
                answered: dA, correct: dC, duration: dD });
        }

        // 存到 state 供弹窗读取
        this._resultStats = { duration, correctCount, wrongCount: submittedIds.length - correctCount,
            total: this.state.questions.length, submittedCount: submittedIds.length };
    },

    /**
     * 弹窗内显示结果（替代原 renderResult 的结果页）
     */
    showResultModal() {
        const { duration, correctCount, wrongCount, total, submittedCount } = this._resultStats || {};
        const minutes = Math.floor((duration || 0) / 60);
        const seconds = (duration || 0) % 60;
        const accuracy = submittedCount > 0 ? Math.round((correctCount / submittedCount) * 100) : 0;
        const isExam = this.state.mode === 'exam';
        const passed = isExam ? accuracy >= this.state.examPassRate : null;
        const iconClass = isExam && !passed ? 'warning' : 'success';
        const iconName = isExam && !passed ? 'frown' : 'party-popper';
        const title = isExam ? (passed ? '考试通过！' : '未通过考试') : '答题完成！';
        const desc = isExam ? `及格线 ${this.state.examPassRate}%，正确率 ${accuracy}%`
            : `${this.state.bank.name}`;

        const modalHtml = `
            <div class="finish-modal-overlay show" id="finish-modal">
                <div class="finish-modal" role="dialog" aria-modal="true" aria-label="答题结果">
                    <div class="finish-modal-icon-wrap ${iconClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <h3 class="finish-modal-title">${title}</h3>
                    <p class="finish-modal-desc">${Utils.escapeHtml(desc)}</p>
                    <div class="finish-modal-stats">
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value success">${correctCount}</div>
                            <div class="finish-modal-stat-label">答对</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value danger">${wrongCount}</div>
                            <div class="finish-modal-stat-label">答错</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${accuracy}%</div>
                            <div class="finish-modal-stat-label">正确率</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${minutes > 0 ? minutes + '分' : ''}${seconds}秒</div>
                            <div class="finish-modal-stat-label">用时</div>
                        </div>
                    </div>
                    <div class="finish-modal-actions">
                        <button class="btn btn-primary" onclick="Quiz.goHome()"><i data-lucide="home"></i> 返回首页</button>
                    </div>
                    <div class="finish-modal-secondary">
                        <button class="btn btn-outline btn-sm" onclick="Quiz.startReview()"><i data-lucide="file-text"></i> 查看解析</button>
                        <button class="btn btn-outline btn-sm" onclick="Quiz.restart()"><i data-lucide="rotate-ccw"></i> 重新开始</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
        Utils.initIcons?.();

        // 禁止 ESC 关闭结果弹窗（必须点按钮）
    },

    finish() {
        // 使用自定义模态框替代原生 confirm
        this.showFinishModal();
    },

    renderResult() {
        const duration = Math.round((Date.now() - this.state.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        const submittedIds = Object.keys(this.state.submitted);
        const correctCount = submittedIds.filter((qId) => {
            const q = this.state.questions.find((q) => q.id == qId);
            return q && this.checkAnswer(q);
        }).length;
        const thisAccuracy =
            submittedIds.length > 0 ? Math.round((correctCount / submittedIds.length) * 100) : 0;

        const isExam = this.state.mode === 'exam';
        const passed = isExam ? thisAccuracy >= this.state.examPassRate : null;
        const resultIconName = isExam && !passed ? 'frown' : 'party-popper';
        const resultIconClass = isExam && !passed ? 'result-icon-danger' : 'result-icon-success';
        const resultTitle = isExam ? (passed ? '考试通过！' : '未通过考试') : '答题完成！';

        // 背题模式：结束前补齐剩余时长
        this._saveReviewDuration();

        Storage.addHistory({
            bankId: this.state.bankId,
            bankName: this.state.bank.name,
            mode: this.state.mode,
            total: this.state.questions.length,
            correct: correctCount,
            duration: duration
        });

        // 追踪：完成答题
        if (isExam) {
            Tracker.finishExam(
                this.state.bankId,
                this.state.questions.length,
                correctCount,
                thisAccuracy,
                duration,
                false
            );
        } else {
            Tracker.finishQuiz(
                this.state.bankId,
                this.state.bank.name,
                this.state.mode,
                this.state.questions.length,
                correctCount,
                submittedIds.length - correctCount,
                thisAccuracy,
                duration
            );
        }

        // 追踪：答题热力图汇总
        const heatmapData = submittedIds.map(qId => {
            const q = this.state.questions.find(q => q.id == qId);
            return {
                id: qId,
                category: q?.category,
                type: q?.type,
                difficulty: q?.difficulty,
                timeSpent: this.state.questionTimes[qId] || 0,
                isCorrect: q ? this.checkAnswer(q) : false
            };
        });
        Tracker.questionHeatmap(this.state.bankId, this.state.bank.name, heatmapData);

        // 清除防抖定时器，标记已清理
        if (this.state._statsTimer) {
            clearTimeout(this.state._statsTimer);
            this.state._statsTimer = null;
        }
        this.state._statsDirty = false;

        // 仅推送尚未上报过的增量（防抖可能已推送部分数据）
        const dAnswered = submittedIds.length - (this.state._lastPushAnswered || 0);
        const dCorrect = correctCount - (this.state._lastPushCorrect || 0);
        const dDuration = duration - (this.state._lastPushDuration || 0);

        if (dAnswered > 0 || dCorrect > 0 || dDuration > 0) {
            this.state._lastPushAnswered = submittedIds.length;
            this.state._lastPushCorrect = correctCount;
            this.state._lastPushDuration = duration;

            API.pushStats({
                bankId: this.state.bankId,
                bankName: this.state.bank.name,
                answered: dAnswered,
                correct: dCorrect,
                duration: dDuration
            });
        }

        const container = document.getElementById('question-container');
        container.innerHTML = `
            <div class="result-page">
                <div class="result-icon ${resultIconClass}">
                    <i data-lucide="${resultIconName}"></i>
                </div>
                <div class="result-title">${resultTitle}</div>
                <div class="result-subtitle">${Utils.escapeHtml(this.state.bank.name)}</div>
                ${isExam ? `<div class="result-exam-info">及格线 ${this.state.examPassRate}%，正确率 ${thisAccuracy}%</div>` : ''}

                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-stat-value success">${correctCount}</div>
                        <div class="result-stat-label">答对</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value danger">${submittedIds.length - correctCount}</div>
                        <div class="result-stat-label">答错</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value ${isExam && !passed ? 'danger' : ''}">${thisAccuracy}%</div>
                        <div class="result-stat-label">正确率</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value">${minutes > 0 ? minutes + '分' : ''}${seconds}秒</div>
                        <div class="result-stat-label">用时</div>
                    </div>
                </div>

                <div class="result-actions">
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.startReview()">
                        <i data-lucide="file-text"></i> 查看解析
                    </button>
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.restart()">
                        <i data-lucide="rotate-ccw"></i> 重新开始
                    </button>
                    <button class="btn btn-primary btn-lg" onclick="Quiz.goHome()">
                        <i data-lucide="home"></i> 返回首页
                    </button>
                </div>
            </div>
        `;

        Utils.initIcons?.();
        document.querySelector('.quiz-footer').style.display = 'none';
    },

    restart() {
        document.getElementById('finish-modal')?.remove();
        Storage.clearSession(this.state.bankId, this.state.mode);

        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.submitted = {};
        this.state.showExplanation = {};
        this.state.questionTimes = {};
        this.state.optionOrderCache = {};
        this.state.isFinished = false;
        this.state.startTime = Date.now();
        this.state.examTimeRemaining = 0;

        if (this.state.mode === 'exam' || this.state.mode === 'random' || this.state.mode === 'shuffle_options' || this.state.mode === 'wrong') {
            this.prepareQuestions();
        }

        if (this.state.mode === 'exam') {
            this.startExamTimer();
        }

        if (this.state.mode === 'review') {
            this.state.questions.forEach((q) => {
                this.state.submitted[q.id] = true;
                this.state.showExplanation[q.id] = true;
                this.state.answers[q.id] = q.answer;
            });
        }

        document.querySelector('.quiz-footer').style.display = '';

        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * 考试复盘：返回答题视图，显示所有题目和解析
     */
    startReview() {
        const container = document.getElementById('question-container');
        if (!container) return;

        // 设置复盘模式
        this.state.isReviewMode = true;
        this.state.currentIndex = 0;
        this.state.isFinished = false;

        // 确保所有已答题都显示解析
        Object.keys(this.state.submitted).forEach((qId) => {
            this.state.showExplanation[qId] = true;
        });

        // 恢复底部栏
        document.querySelector('.quiz-footer').style.display = '';

        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * 标记有脏数据，启动防抖定时器（5s）
     */
    _markStatsDirty() {
        this.state._statsDirty = true;
        if (this.state._statsTimer) return; // 已有定时器等待
        this.state._statsTimer = setTimeout(() => {
            this._flushStatsNow();
        }, 5000);
    },

    /**
     * 立即推送累积的脏数据，清除定时器
     * 使用 fetch 的 keepalive 确保页面关闭时请求也能发出
     */
    _flushStatsNow() {
        if (this.state._statsTimer) {
            clearTimeout(this.state._statsTimer);
            this.state._statsTimer = null;
        }
        if (!this.state._statsDirty) return;
        this.state._statsDirty = false;

        const submittedIds = Object.keys(this.state.submitted);
        if (submittedIds.length === 0) return;

        const correctCount = submittedIds.filter((qId) => {
            const q = this.state.questions.find((q) => q.id == qId);
            return q && this.checkAnswer(q);
        }).length;
        const duration = this.state.startTime
            ? Math.round((Date.now() - this.state.startTime) / 1000)
            : 0;

        // 计算增量：Worker 端是累加逻辑，只能发送新增的部分
        const dAnswered = submittedIds.length - (this.state._lastPushAnswered || 0);
        const dCorrect = correctCount - (this.state._lastPushCorrect || 0);
        const dDuration = duration - (this.state._lastPushDuration || 0);

        if (dAnswered <= 0 && dCorrect <= 0 && dDuration <= 0) return;

        this.state._lastPushAnswered = submittedIds.length;
        this.state._lastPushCorrect = correctCount;
        this.state._lastPushDuration = duration;

        API.pushStats({
            bankId: this.state.bankId,
            bankName: this.state.bank?.name || '',
            answered: dAnswered,
            correct: dCorrect,
            duration: dDuration
        });
    },

    /**
     * 同步刷新（用于 beforeunload 场景，不能用 fetch
     * 因为现代浏览器在 unload 时可能丢弃 fetch Promise）
     */
    _flushStatsSync() {
        if (!this.state._statsDirty) return;

        const submittedIds = Object.keys(this.state.submitted);
        if (submittedIds.length === 0) return;

        const correctCount = submittedIds.filter((qId) => {
            const q = this.state.questions.find((q) => q.id == qId);
            return q && this.checkAnswer(q);
        }).length;
        const duration = this.state.startTime
            ? Math.round((Date.now() - this.state.startTime) / 1000)
            : 0;

        // 计算增量
        const dAnswered = submittedIds.length - (this.state._lastPushAnswered || 0);
        const dCorrect = correctCount - (this.state._lastPushCorrect || 0);
        const dDuration = duration - (this.state._lastPushDuration || 0);

        if (dAnswered <= 0 && dCorrect <= 0 && dDuration <= 0) {
            this.state._statsDirty = false;
            return;
        }

        this.state._lastPushAnswered = submittedIds.length;
        this.state._lastPushCorrect = correctCount;
        this.state._lastPushDuration = duration;

        this.state._statsDirty = false;
        if (this.state._statsTimer) {
            clearTimeout(this.state._statsTimer);
            this.state._statsTimer = null;
        }

        // 优先用 sendBeacon（保证页面关闭时请求发出）
        if (navigator.sendBeacon && API.isRegistered()) {
            const data = JSON.stringify({
                deviceId: API.getDeviceId(),
                bankId: this.state.bankId,
                bankName: this.state.bank?.name || '',
                answered: dAnswered,
                correct: dCorrect,
                duration: dDuration
            });
            try {
                navigator.sendBeacon(API.BASE_URL + '/api/sync', data);
                return;
            } catch (e) {
                console.warn('[Quiz] sendBeacon 失败:', e.message);
            }
        }

        // fallback: 走普通 fetch
        API.pushStats({
            bankId: this.state.bankId,
            bankName: this.state.bank?.name || '',
            answered: dAnswered,
            correct: dCorrect,
            duration: dDuration
        });
    },

    goHome() {
        window.location.href = 'index.html';
    },

    bindEvents() {
        // 移动端：点击按钮后立即 blur，防止焦点高亮粘连
        document.addEventListener('pointerup', (e) => {
            const btn = e.target.closest('button, .btn, .option-item, .judge-option');
            if (btn) btn.blur();
        });

        window.addEventListener('beforeunload', () => this.saveSession());

        // 移动端 beforeunload 不可靠，visibilitychange 作为备份保存触发器
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.saveSession();
        });

        // 左右滑动手势支持（移动端）
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener(
            'touchstart',
            (e) => {
                touchStartX = e.changedTouches[0].clientX;
                touchStartY = e.changedTouches[0].clientY;
            },
            { passive: true }
        );

        document.addEventListener(
            'touchend',
            (e) => {
                // 模态框打开时不处理
                if (document.getElementById('finish-modal')) return;
                // 导航面板打开时不处理
                const navPanel = document.getElementById('nav-panel');
                if (navPanel && navPanel.classList.contains('show')) return;

                // 检查触摸目标是否在可滚动的代码块或水平滚动容器内
                const touchTarget = e.target;
                const scrollableParent = touchTarget.closest('pre, code, .code-block, .code-wrapper, .explanation-content, [style*="overflow-x"]');
                if (scrollableParent && scrollableParent.scrollWidth > scrollableParent.clientWidth) {
                    // 元素有水平滚动，不触发题目切换
                    return;
                }

                // 检查设置：是否开启滑动切换
                const swipeSettings = Storage.getSettings().swipeNavigation;
                if (swipeSettings === false) return;

                const deltaX = e.changedTouches[0].clientX - touchStartX;
                const deltaY = e.changedTouches[0].clientY - touchStartY;

                // 忽略垂直滑动（用户在滚动页面）
                if (Math.abs(deltaY) > Math.abs(deltaX)) return;
                // 未达到阈值
                if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

                if (deltaX < 0) {
                    // 左滑 → 下一题
                    this.nextQuestion();
                } else {
                    // 右滑 → 上一题
                    this.prevQuestion();
                }
            },
            { passive: true }
        );

        document.addEventListener('keydown', (e) => {
            // 如果模态框开着不处理快捷键
            if (document.getElementById('finish-modal')) return;
            
            // 如果焦点在输入框中，不处理方向键
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
                return;
            }

            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                const question = this.state.questions[this.state.currentIndex];
                if (question && !this.state.submitted[question.id]) {
                    this.submitCurrent();
                } else {
                    this.nextQuestion();
                }
            }

            // 方向键切换题目
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prevQuestion();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.nextQuestion();
            }

            const question = this.state.questions[this.state.currentIndex];
            if (question && !this.state.submitted[question.id]) {
                if (question.type === 'single' || question.type === 'multiple') {
                    const key = e.key.toUpperCase();
                    // 字母键 A-F 或数字键 1-6 选择选项
                    const numToLetter = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F' };
                    const selectedKey = numToLetter[e.key] || key;
                    if (['A', 'B', 'C', 'D', 'E', 'F'].includes(selectedKey)) {
                        if (question.type === 'single') {
                            this.selectAnswer(question.id, selectedKey);
                        } else {
                            this.toggleAnswer(question.id, selectedKey);
                        }
                    }
                }
                if (question.type === 'judge') {
                    if (e.key === '1' || e.key === 't' || e.key === 'T') {
                        this.selectAnswer(question.id, true);
                    }
                    if (e.key === '0' || e.key === 'f' || e.key === 'F') {
                        this.selectAnswer(question.id, false);
                    }
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Quiz.init();
});

window.Quiz = Quiz;
export default Quiz;
