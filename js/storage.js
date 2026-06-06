/**
 * 本地存储管理模块
 * 只管理用户数据（进度、设置、历史、收藏）
 * 题库数据每次都从云端加载，不缓存
 */

import Utils from './utils.js';

const Storage = {
    // 当前加载的题库数据（内存中，不持久化）
    _bankData: new Map(),

    // 存储键名（只保留用户数据）
    KEYS: {
        PROGRESS: 'quiz_progress',
        SETTINGS: 'quiz_settings',
        HISTORY: 'quiz_history',
        BOOKMARKS: 'quiz_bookmarks',
        SESSION: 'quiz_session',
        RECENT_BANKS: 'quiz_recent_banks'
    },

    /**
     * 初始化存储
     */
    init() {
        if (!this.get(this.KEYS.PROGRESS)) {
            this.set(this.KEYS.PROGRESS, {});
        }
        if (!this.get(this.KEYS.SETTINGS)) {
            this.set(this.KEYS.SETTINGS, {
                showAnswer: true,
                autoNext: false,
                randomOrder: false,
                swipeNavigation: true,
                fontSize: 16,
                theme: 'auto',
                aiEngine: 'metaso',
                customAiEngines: []
            });
        }
        if (!this.get(this.KEYS.HISTORY)) {
            this.set(this.KEYS.HISTORY, []);
        }
        if (!this.get(this.KEYS.BOOKMARKS)) {
            this.set(this.KEYS.BOOKMARKS, {});
        }
    },

    /**
     * 获取存储值
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    /**
     * 设置存储值
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                console.error('Storage quota exceeded for key:', key);
                if (key !== this.KEYS.HISTORY) {
                    this._tryFreeSpace();
                    try {
                        localStorage.setItem(key, JSON.stringify(value));
                        return true;
                    } catch (_e2) {
                        this._notifyQuotaExceeded();
                        return false;
                    }
                }
                this._notifyQuotaExceeded();
                return false;
            }
            console.error('Storage set error:', e);
            return false;
        }
    },

    /**
     * 尝试释放空间
     */
    _tryFreeSpace() {
        const history = this.getHistory();
        if (history.length > 20) {
            history.length = 20;
            try {
                localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
            } catch (_e) {
                // 忽略
            }
        }
    },

    /**
     * 通知用户存储空间不足
     */
    _notifyQuotaExceeded() {
        try {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('存储空间不足，部分数据可能无法保存。', 'error', 5000);
            }
        } catch (e) {
            console.error('Failed to notify quota exceeded:', e);
        }
    },

    /**
     * 删除存储值
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },

    // ==================== 题库管理（内存中，不持久化）====================

    /**
     * 获取所有题库（从内存）
     */
    getBanks() {
        return Array.from(this._bankData.values());
    },

    /**
     * 获取单个题库
     */
    getBank(bankId) {
        return this._bankData.get(bankId) || null;
    },

    /**
     * 设置题库（从 API 加载后调用）
     */
    setBank(bank) {
        if (!bank || !bank.id) return false;
        this._bankData.set(bank.id, bank);
        return true;
    },

    /**
     * 清除所有题库（重新加载前调用）
     */
    clearBanks() {
        this._bankData.clear();
    },

    // ==================== 进度管理 ====================

    getProgress() {
        return this.get(this.KEYS.PROGRESS) || {};
    },

    getBankProgress(bankId) {
        const progress = this.getProgress();
        return progress[bankId] || { answered: 0, correct: 0, wrong: 0, questions: {} };
    },

    updateQuestionProgress(bankId, questionId, isCorrect, userAnswer) {
        const progress = this.getProgress();

        if (!progress[bankId]) {
            progress[bankId] = { answered: 0, correct: 0, wrong: 0, questions: {} };
        }

        const bankProgress = progress[bankId];
        const questionProgress = bankProgress.questions[questionId];

        if (!questionProgress) {
            bankProgress.answered++;
            if (isCorrect) bankProgress.correct++;
            else bankProgress.wrong++;
        } else if (!questionProgress.correct && isCorrect) {
            bankProgress.correct++;
            bankProgress.wrong--;
        } else if (questionProgress.correct && !isCorrect) {
            bankProgress.correct--;
            bankProgress.wrong++;
        }

        // SM-2 间隔重复算法
        const prev = questionProgress || {};
        const easeFactor = this._calcEaseFactor(prev.easeFactor || 2.5, isCorrect);
        const interval = this._calcInterval(isCorrect, prev.interval || 0, easeFactor);
        const nextReviewAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();

        bankProgress.questions[questionId] = {
            correct: isCorrect,
            userAnswer: userAnswer,
            answeredAt: new Date().toISOString(),
            attempts: (prev.attempts || 0) + 1,
            easeFactor: easeFactor,
            interval: interval,
            nextReviewAt: nextReviewAt
        };

        this.set(this.KEYS.PROGRESS, progress);
        return bankProgress;
    },

    _calcInterval(isCorrect, prevInterval, easeFactor) {
        if (!isCorrect) return 1;
        if (prevInterval === 0) return 1;
        if (prevInterval === 1) return 3;
        return Math.max(1, Math.round(prevInterval * easeFactor));
    },

    _calcEaseFactor(prevEF, isCorrect) {
        if (isCorrect) return Math.min(3.0, prevEF + 0.1);
        return Math.max(1.3, prevEF - 0.2);
    },

    getDueQuestions(bankId) {
        const bank = this.getBank(bankId);
        if (!bank || !bank.questions) return [];

        const progress = this.getBankProgress(bankId);
        const now = new Date();

        return bank.questions.filter((q) => {
            const qProgress = progress.questions[q.id];
            if (!qProgress) return false;
            if (!qProgress.nextReviewAt) return true;
            return new Date(qProgress.nextReviewAt) <= now;
        });
    },

    getTodayDueCount() {
        let totalDue = 0;
        for (const bank of this._bankData.values()) {
            totalDue += this.getDueQuestions(bank.id).length;
        }
        return totalDue;
    },

    resetBankProgress(bankId) {
        const progress = this.getProgress();
        progress[bankId] = { answered: 0, correct: 0, wrong: 0, questions: {} };
        this.set(this.KEYS.PROGRESS, progress);
        return true;
    },

    getWrongQuestions(bankId) {
        const progress = this.getBankProgress(bankId);
        const wrongIds = [];
        for (const [qId, qProgress] of Object.entries(progress.questions)) {
            if (!qProgress.correct) wrongIds.push(parseInt(qId));
        }
        return wrongIds;
    },

    getGlobalWrongStats() {
        const banks = this.getBanks();
        let totalWrong = 0;
        const details = [];

        for (const bank of banks) {
            const wrongIds = this.getWrongQuestions(bank.id);
            if (wrongIds.length > 0) {
                totalWrong += wrongIds.length;
                details.push({ bankId: bank.id, bankName: bank.name, wrongIds, count: wrongIds.length });
            }
        }

        return { totalWrong, details };
    },

    clearAllWrong() {
        const progress = this.getProgress();
        for (const bankId of Object.keys(progress)) {
            if (progress[bankId] && progress[bankId].questions) {
                const questions = progress[bankId].questions;
                let corrected = 0;
                for (const [qId, qProgress] of Object.entries(questions)) {
                    if (!qProgress.correct) {
                        questions[qId] = { ...qProgress, correct: true };
                        corrected++;
                    }
                }
                progress[bankId].wrong = 0;
                progress[bankId].correct += corrected;
            }
        }
        this.set(this.KEYS.PROGRESS, progress);
    },

    // ==================== 收藏管理 ====================

    getBookmarks() {
        return this.get(this.KEYS.BOOKMARKS) || {};
    },

    getBankBookmarks(bankId) {
        const bookmarks = this.getBookmarks();
        return bookmarks[bankId] || [];
    },

    toggleBookmark(bankId, questionId) {
        const bookmarks = this.getBookmarks();
        if (!bookmarks[bankId]) bookmarks[bankId] = [];

        const index = bookmarks[bankId].indexOf(questionId);
        if (index >= 0) bookmarks[bankId].splice(index, 1);
        else bookmarks[bankId].push(questionId);

        this.set(this.KEYS.BOOKMARKS, bookmarks);
        return index < 0;
    },

    isBookmarked(bankId, questionId) {
        return this.getBankBookmarks(bankId).includes(questionId);
    },

    getBookmarkCount(bankId) {
        return this.getBankBookmarks(bankId).length;
    },

    // ==================== 历史记录 ====================

    addHistory(record) {
        const history = this.getHistory();
        history.unshift({ ...record, timestamp: new Date().toISOString() });
        if (history.length > 100) history.length = 100;
        this.set(this.KEYS.HISTORY, history);

        if (record.duration && record.duration > 0 && record.mode !== 'review') {
            this.addDuration(record.duration);
            this.addBankDuration(record.bankId, record.duration);
        }
    },

    addDuration(seconds) {
        const progress = this.getProgress();
        if (!progress._global) progress._global = {};
        progress._global.totalDuration = (progress._global.totalDuration || 0) + seconds;
        this.set(this.KEYS.PROGRESS, progress);
    },

    addBankDuration(bankId, seconds) {
        if (!bankId || !seconds || seconds <= 0) return;
        const progress = this.getProgress();
        if (!progress[bankId]) {
            progress[bankId] = { answered: 0, correct: 0, wrong: 0, questions: {} };
        }
        progress[bankId].duration = (progress[bankId].duration || 0) + seconds;
        this.set(this.KEYS.PROGRESS, progress);
    },

    getHistory() {
        return this.get(this.KEYS.HISTORY) || [];
    },

    clearHistory() {
        this.set(this.KEYS.HISTORY, []);
    },

    // ==================== 设置管理 ====================

    getSettings() {
        return this.get(this.KEYS.SETTINGS) || {
            showAnswer: true,
            autoNext: false,
            randomOrder: false,
            swipeNavigation: true,
            fontSize: 16,
            theme: 'auto',
            aiEngine: 'metaso',
            customAiEngines: []
        };
    },

    updateSettings(settings) {
        const current = this.getSettings();
        this.set(this.KEYS.SETTINGS, { ...current, ...settings });
    },

    // ==================== 统计信息 ====================

    getGlobalStats() {
        const banks = this.getBanks();
        const progress = this.getProgress();

        let totalQuestions = 0;
        let totalAnswered = 0;
        let totalCorrect = 0;
        let totalWrong = 0;
        const totalDuration = progress._global?.totalDuration || 0;

        banks.forEach((bank) => {
            totalQuestions += bank.questions?.length || bank.questionCount || 0;
            const bankProgress = progress[bank.id] || {};
            totalAnswered += bankProgress.answered || 0;
            totalCorrect += bankProgress.correct || 0;
            totalWrong += bankProgress.wrong || 0;
        });

        return {
            bankCount: banks.length,
            totalQuestions,
            totalAnswered,
            totalCorrect,
            totalWrong,
            totalDuration,
            accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
        };
    },

    getBankStats(bankId) {
        const bank = this.getBank(bankId);
        if (!bank) return null;

        const progress = this.getBankProgress(bankId);
        const totalQuestions = bank.questions?.length || bank.questionCount || 0;

        return {
            totalQuestions,
            answered: progress.answered || 0,
            correct: progress.correct || 0,
            wrong: progress.wrong || 0,
            unanswered: totalQuestions - (progress.answered || 0),
            accuracy: progress.answered > 0 ? Math.round((progress.correct / progress.answered) * 100) : 0,
            progress: totalQuestions > 0 ? Math.round(((progress.answered || 0) / totalQuestions) * 100) : 0
        };
    },

    getCategoryStats(bankId) {
        const bank = this.getBank(bankId);
        if (!bank || !bank.questions) return {};

        const progress = this.getBankProgress(bankId);
        const categoryMap = {};

        bank.questions.forEach((q) => {
            const cat = q.category || '未分类';
            if (!categoryMap[cat]) categoryMap[cat] = { total: 0, answered: 0, correct: 0, wrong: 0 };
            categoryMap[cat].total++;

            const qProgress = progress.questions[q.id];
            if (qProgress) {
                categoryMap[cat].answered++;
                if (qProgress.correct) categoryMap[cat].correct++;
                else categoryMap[cat].wrong++;
            }
        });

        for (const cat of Object.values(categoryMap)) {
            cat.accuracy = cat.answered > 0 ? Math.round((cat.correct / cat.answered) * 100) : -1;
        }

        return categoryMap;
    },

    getWeakCategories(bankId, limit = 5) {
        const stats = this.getCategoryStats(bankId);
        return Object.entries(stats)
            .filter(([_, s]) => s.answered > 0)
            .sort((a, b) => a[1].accuracy - b[1].accuracy)
            .slice(0, limit)
            .map(([name, stats]) => ({ name, ...stats }));
    },

    /**
     * 导出所有数据
     */
    exportData() {
        return {
            banks: this.getBanks(),
            progress: this.getProgress(),
            settings: this.getSettings(),
            history: this.getHistory(),
            bookmarks: this.getBookmarks(),
            exportedAt: new Date().toISOString()
        };
    },

    /**
     * 导入数据
     */
    importData(data) {
        if (data.banks) data.banks.forEach((bank) => this.setBank(bank));
        if (data.progress) this.set(this.KEYS.PROGRESS, data.progress);
        if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
        if (data.history) this.set(this.KEYS.HISTORY, data.history);
        if (data.bookmarks) this.set(this.KEYS.BOOKMARKS, data.bookmarks);
        return true;
    },

    // ==================== 会话状态管理 ====================

    saveSession(bankId, mode, sessionData) {
        const sessions = this.get(this.KEYS.SESSION) || {};
        const key = `${bankId}:${mode}`;
        sessions[key] = { ...sessionData, savedAt: new Date().toISOString() };
        this.set(this.KEYS.SESSION, sessions);
    },

    getSession(bankId, mode) {
        const sessions = this.get(this.KEYS.SESSION) || {};
        const key = `${bankId}:${mode}`;
        return sessions[key] || null;
    },

    clearSession(bankId, mode) {
        const sessions = this.get(this.KEYS.SESSION) || {};
        const key = `${bankId}:${mode}`;
        delete sessions[key];
        this.set(this.KEYS.SESSION, sessions);
    },

    clearAllSessions() {
        this.set(this.KEYS.SESSION, {});
    },

    recordBankUsage(bankId) {
        const recent = this.get(this.KEYS.RECENT_BANKS) || [];
        const filtered = recent.filter((id) => id !== bankId);
        filtered.unshift(bankId);
        this.set(this.KEYS.RECENT_BANKS, filtered.slice(0, 20));
    },

    getRecentBanks() {
        return this.get(this.KEYS.RECENT_BANKS) || [];
    },

    /**
     * 清除所有用户数据
     */
    clearAll() {
        Object.values(this.KEYS).forEach((key) => this.remove(key));
        this._bankData.clear();
        this.init();
    },

    /**
     * 清除旧的缓存数据（迁移用）
     */
    clearLegacyCache() {
        this.remove('quiz_banks_meta');
        this.remove('quiz_cache_versions');
        console.log('[Storage] ✅ 已清除旧缓存数据');
    }
};

// 初始化
Storage.init();

// 启动时清除旧缓存
Storage.clearLegacyCache();

// 导出
window.Storage = Storage;
export default Storage;
