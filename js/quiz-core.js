/**
 * 刷题页面 - 核心初始化与会话管理
 */

import Storage from './storage.js';
import Utils from './utils.js';
import BankLoader from './bankLoader.js';
import Tracker from './tracker.js';
import API from './api.js';
import Perf from './perf.js';
import AIExplain from './aiExplain.js';
import state from './quiz-state.js';

let Quiz = null;

function redirectAfter(msg, type = 'info', delay = 1000) {
    Utils.showToast(msg, type);
    setTimeout(() => (window.location.href = 'index.html'), delay);
}

const Core = {
    state,

    setQuiz(q) {
        Quiz = q;
    },

    async init() {
        Perf.init('刷题页');

        const params = new URLSearchParams(window.location.search);
        state.bankId = params.get('bank');
        state.mode = params.get('mode') || 'all';
        state.filterType = params.get('type') || 'all';
        state.examTimeLimit = parseInt(params.get('time')) || 0;
        state.examPassRate = parseInt(params.get('pass')) || 60;
        state.examCount = parseInt(params.get('count')) || 0;

        if (params.get('q')) {
            state.searchKeyword = params.get('q') || '';
        }

        const settings = Storage.getSettings();
        state.answerMode = settings.answerMode || 'normal';
        const aiConfigPromise = AIExplain.init().catch((e) => {
            console.warn('[Quiz] AI 解读配置加载失败:', e.message);
        });

        if (settings.fontSize) Utils.applyFontSize(settings.fontSize);

        if (!state.bankId) {
            console.error('[Quiz] 缺少题库参数');
            Utils.showToast('缺少题库参数', 'error');
            setTimeout(() => (window.location.href = 'index.html'), 1000);
            return;
        }

        Perf.mark('开始加载题库');
        state.bank = Storage.getBank(state.bankId);

        if (!state.bank || !Array.isArray(state.bank.questions)) {
            await this.loadBankFromJson();
        }

        if (!state.bank || !Array.isArray(state.bank.questions)) {
            console.error('[Quiz] ❌ 题库加载失败');
            this.showOverlayError('题库加载失败', '即将返回首页…');
            setTimeout(() => (window.location.href = 'index.html'), 1500);
            return;
        }

        if (state.bank.enabled === false) {
            console.warn('[Quiz] 🚫 题库已被管理员禁用:', state.bankId);
            this.showOverlayError('该题库已被管理员禁用', '即将返回首页…');
            setTimeout(() => (window.location.href = 'index.html'), 1500);
            return;
        }

        Perf.mark('题库加载完成');

        Perf.mark('准备题目');
        this.prepareQuestions();
        Perf.mark('题目准备完成');

        if (state.mode === 'review') {
            state.questions.forEach((q) => {
                state.submitted[q.id] = true;
                state.showExplanation[q.id] = true;
                state.answers[q.id] = q.answer;
            });
        }

        if (state.mode === 'wrong' && state.questions.length === 0) {
            redirectAfter('没有错题，真棒！', 'success');
            return;
        }

        if (state.mode === 'spaced' && state.questions.length === 0) {
            redirectAfter('没有需要复习的题目');
            return;
        }

        if (state.mode === 'bookmark' && state.questions.length === 0) {
            redirectAfter('没有收藏的题目');
            return;
        }

        if (!API.isRegistered()) {
            redirectAfter('请先在首页注册后再刷题', 'error', 1500);
            return;
        }

        // 刷题前拉取云端数据，确保获取最新进度
        try {
            await API.pullCloudData();
        } catch (e) {
            console.warn('[Quiz] 拉取云端数据失败:', e.message);
        }

        Perf.mark('恢复会话');
        this.restoreSession();
        state.startTime = Date.now();
        state.questionStartTime = Date.now();

        if (state.mode === 'exam') {
            Quiz.startExamTimer();
        }

        await aiConfigPromise;

        Perf.mark('开始渲染');
        Quiz.render();
        this.showBankWelcome();
        Quiz.bindEvents();
        Perf.mark('渲染完成');

        state.autoSaveInterval = setInterval(() => Quiz.saveSession(), 30000);
        state.timerInterval = setInterval(() => Quiz.updateTimerDisplay(), 1000);

        Tracker.startQuiz(state.bankId, state.bank?.name || '', state.mode, state.questions.length);

        state._beforeUnloadHandler = () => Quiz._flushStatsSync();
        window.addEventListener('beforeunload', state._beforeUnloadHandler);

        Perf.done({
            bankId: state.bankId,
            bankName: state.bank?.name,
            mode: state.mode,
            questionCount: state.questions.length
        });
    },

    restoreSession() {
        // 1. 考试模式以外的常规模式下，先从已同步的全局 progress 中恢复答题状态
        if (state.mode !== 'exam') {
            const progress = Storage.getBankProgress(state.bankId);
            if (progress && progress.questions) {
                for (const [qid, cq] of Object.entries(progress.questions)) {
                    if (cq && cq.userAnswer !== undefined) {
                        state.answers[qid] = cq.userAnswer;
                        state.submitted[qid] = true;
                        state.showExplanation[qid] = true;
                    }
                }
            }
        }

        // 2. 尝试从本地保存的 session (草稿) 中恢复
        const session = Storage.getSession(state.bankId, state.mode);
        if (!session) {
            if (
                state.mode === 'exam' ||
                state.mode === 'random' ||
                state.mode === 'shuffle_options'
            ) {
                state.savedOrderIds = state.questions.map((q) => q.id);
            }
            return;
        }

        state.currentIndex = session.currentIndex || 0;
        if (state.currentIndex >= state.questions.length) state.currentIndex = 0;
        if (state.mode !== 'review') {
            // 用活跃 session (草稿) 数据覆盖/合并
            state.answers = { ...state.answers, ...(session.answers || {}) };
            state.submitted = { ...state.submitted, ...(session.submitted || {}) };
            state.showExplanation = { ...state.showExplanation, ...(session.showExplanation || {}) };
        }
        state.questionTimes = session.questionTimes || {};
        state.optionOrderCache = session.optionOrderCache || {};
        state.savedOrderIds = session.questionOrderIds || null;

        if (
            state.savedOrderIds &&
            (state.mode === 'exam' || state.mode === 'random' || state.mode === 'shuffle_options')
        ) {
            if (state.mode === 'exam') {
                const bankQuestions = state.bank?.questions || [];
                const idMap = new Map(bankQuestions.map((q) => [q.id, q]));
                const restored = state.savedOrderIds.map((id) => idMap.get(id)).filter(Boolean);
                if (restored.length > 0) state.questions = restored;
            } else {
                const orderMap = new Map(state.savedOrderIds.map((id, i) => [id, i]));
                state.questions.sort((a, b) => {
                    const oa = orderMap.get(a.id);
                    const ob = orderMap.get(b.id);
                    if (oa !== undefined && ob !== undefined) return oa - ob;
                    return 0;
                });
            }
        }

        if (state.mode === 'exam' && session.examTimeRemaining > 0) {
            state.examTimeRemaining = session.examTimeRemaining;
        }

        state._lastPushAnswered = session.lastPushAnswered || 0;
        state._lastPushCorrect = session.lastPushCorrect || 0;
        state._lastPushDuration = session.lastPushDuration || 0;
    },

    saveSession(immediate = false) {
        if (state.isFinished) return Promise.resolve();

        const questionOrderIds =
            state.mode === 'random' || state.mode === 'shuffle_options' || state.mode === 'exam'
                ? state.questions.map((q) => q.id)
                : undefined;

        const extra = state.mode === 'exam' ? { examTimeRemaining: state.examTimeRemaining } : {};

        Storage.saveSession(state.bankId, state.mode, {
            currentIndex: state.currentIndex,
            filterType: state.filterType || 'all',
            answerMode: state.answerMode,
            answers: state.answers,
            submitted: state.submitted,
            showExplanation: state.showExplanation,
            questionTimes: state.questionTimes,
            optionOrderCache: state.optionOrderCache,
            questionOrderIds,
            lastPushAnswered: state._lastPushAnswered,
            lastPushCorrect: state._lastPushCorrect,
            lastPushDuration: state._lastPushDuration,
            ...extra
        });

        return API.pushProgress(Storage.getProgress(), immediate).then((data) => {
            this._saveReviewDuration();
            return data;
        });
    },

    _saveReviewDuration() {
        if (!state.isReviewMode || !state.startTime) return;
        const elapsed = Math.round((Date.now() - state.startTime) / 1000);
        const lastSaved = state._reviewDurationSaved || 0;
        if (elapsed > lastSaved) {
            Storage.addDuration(elapsed - lastSaved);
            state._reviewDurationSaved = elapsed;
        }
    },

    async loadBankFromJson() {
        const subEl = document.getElementById('quiz-loading-sub');
        if (subEl) subEl.textContent = '正在从云端获取题库数据…';
        const bank = await BankLoader.loadBankById(state.bankId);
        if (bank) {
            state.bank = bank;
            this._bankFromCloud = true;
        }
    },

    showBankWelcome() {
        const overlay = document.getElementById('quiz-loading-overlay');
        if (!overlay) return;
        const card = document.getElementById('quiz-loading-card');
        const titleEl = document.getElementById('quiz-loading-title');
        const subEl = document.getElementById('quiz-loading-sub');
        const bank = state.bank;
        const count = state.questions.length;

        const modeLabels = {
            all: '全部题目',
            wrong: '错题重练',
            review: '背题模式',
            exam: '考试模式',
            random: '随机练习',
            bookmark: '收藏题目',
            spaced: '间隔复习',
            shuffle_options: '选项乱序'
        };

        card.classList.add('welcome');
        titleEl.textContent = bank.name;
        subEl.textContent = `${count} 道题目 · ${modeLabels[state.mode] || '练习模式'}`;
        subEl.classList.add('bank-info');

        const delay = this._bankFromCloud ? 800 : 300;
        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 450);
        }, delay);
    },

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
        if (state.searchKeyword) {
            const keyword = state.searchKeyword.toLowerCase();
            const allQuestions = [...(state.bank.questions || [])];
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
                Utils.showToast(`未找到匹配题目：「${state.searchKeyword}」`, 'info', 3000);
            }
            state.questions = matched;
            state.isReviewMode = true;
            return;
        }
        let questions = [...(state.bank.questions || [])];

        if (state.filterType && state.filterType !== 'all') {
            questions = questions.filter((q) => q.type === state.filterType);
        }

        switch (state.mode) {
            case 'wrong': {
                const wrongIds = Storage.getWrongQuestions(state.bankId);
                questions = questions.filter((q) => wrongIds.includes(q.id));
                break;
            }
            case 'random':
            case 'shuffle_options':
                questions = Utils.shuffleArray(questions);
                break;
            case 'review':
                state.isReviewMode = true;
                break;
            case 'spaced': {
                const dueQuestions = Storage.getDueQuestions(state.bankId);
                questions = dueQuestions;
                break;
            }
            case 'bookmark': {
                const bookmarkIds = Storage.getBankBookmarks(state.bankId);
                questions = questions.filter((q) => bookmarkIds.includes(q.id));
                break;
            }
            case 'exam':
                if (state.examCount > 0 && state.examCount < questions.length) {
                    questions = Utils.shuffleArray(questions).slice(0, state.examCount);
                }
                break;
            case 'all':
            default:
                break;
        }

        state.questions = questions;
    },

    recordQuestionTime() {
        const question = state.questions[state.currentIndex];
        if (!question || !state.questionStartTime) return;
        const elapsed = Math.round((Date.now() - state.questionStartTime) / 1000);
        if (!state.questionTimes[question.id]) state.questionTimes[question.id] = 0;
        state.questionTimes[question.id] += elapsed;
        state.questionStartTime = Date.now();
    },

    getQuestionTimeDisplay() {
        const question = state.questions[state.currentIndex];
        if (!question) return '';
        const saved = state.questionTimes[question.id] || 0;
        const current = state.questionStartTime
            ? Math.round((Date.now() - state.questionStartTime) / 1000)
            : 0;
        const total = saved + current;
        if (total < 60) return `${total}秒`;
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}分${seconds}秒`;
    },

    startExamTimer() {
        if (!state.examTimeRemaining || state.examTimeRemaining <= 0) {
            state.examTimeRemaining = state.examTimeLimit;
        }
        state.examTimer = setInterval(() => {
            state.examTimeRemaining--;
            this.updateExamTimerDisplay();
            if (state.examTimeRemaining <= 0) {
                clearInterval(state.examTimer);
                state.examTimer = null;
                Utils.showToast('考试时间到！', 'error');
                Quiz.showFinishModal(true);
            }
        }, 1000);
    },

    updateExamTimerDisplay() {
        const el = document.getElementById('exam-timer');
        if (!el) return;
        const remaining = state.examTimeRemaining;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (remaining <= 300) el.classList.add('danger');
    },

    updateTimerDisplay() {
        const timerEl = document.getElementById('question-timer');
        if (timerEl) timerEl.textContent = this.getQuestionTimeDisplay();
    },

    getDisplayOptions(question) {
        const options = question.options || [];
        const normal = options.map((option, index) => {
            const text = typeof option === 'string' ? option : option.text || '';
            const img = typeof option === 'object' ? option.img || '' : '';
            return {
                displayLetter: String.fromCharCode(65 + index),
                originalLetter: String.fromCharCode(65 + index),
                text,
                img
            };
        });

        if (state.mode !== 'shuffle_options' && state.mode !== 'exam') return normal;

        if (!state.optionOrderCache[question.id]) {
            const indices = options.map((_, i) => i);
            state.optionOrderCache[question.id] = Utils.shuffleArray(indices);
        }

        return state.optionOrderCache[question.id].map((origIdx, displayIdx) => {
            const opt = options[origIdx];
            const text = typeof opt === 'string' ? opt : opt.text || '';
            const img = typeof opt === 'object' ? opt.img || '' : '';
            return {
                displayLetter: String.fromCharCode(65 + displayIdx),
                originalLetter: String.fromCharCode(65 + origIdx),
                text,
                img
            };
        });
    }
};

export default Core;
