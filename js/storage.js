/**
 * 本地存储管理模块
 * 管理题库数据、用户进度、设置等
 *
 * 架构说明：
 * - 题库完整数据（含 questions）仅缓存在内存中，不存入 localStorage
 * - localStorage 只存储：元数据、进度、设置、历史、收藏
 * - 这样避免 localStorage 容量瓶颈（5MB 限制）
 */

import Utils from './utils.js';

const Storage = {
    // 内存缓存：完整题库数据（含 questions）
    _bankData: new Map(),

    // 存储键名
    KEYS: {
        BANKS_META: 'quiz_banks_meta', // 题库元数据（不含 questions）
        PROGRESS: 'quiz_progress',
        SETTINGS: 'quiz_settings',
        HISTORY: 'quiz_history',
        BOOKMARKS: 'quiz_bookmarks',
        SESSION: 'quiz_session' // 刷题会话状态（进度、答案等）
    },

    /**
     * 初始化存储
     */
    init() {
        // 确保所有必要的键存在
        if (!this.get(this.KEYS.BANKS_META)) {
            this.set(this.KEYS.BANKS_META, []);
        }
        if (!this.get(this.KEYS.PROGRESS)) {
            this.set(this.KEYS.PROGRESS, {});
        }
        if (!this.get(this.KEYS.SETTINGS)) {
            this.set(this.KEYS.SETTINGS, {
                showAnswer: true, // 答题后显示答案
                autoNext: false, // 自动下一题
                randomOrder: false, // 随机顺序
                fontSize: 16, // 字体大小
                theme: 'auto' // 主题：auto|light|dark
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
     * 设置存储值（带 QuotaExceededError 专门处理）
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                console.error('Storage quota exceeded for key:', key);
                // 尝试清理历史记录腾出空间
                if (key !== this.KEYS.HISTORY) {
                    this._tryFreeSpace();
                    try {
                        localStorage.setItem(key, JSON.stringify(value));
                        return true;
                    } catch (_e2) {
                        // 仍然失败，通知用户
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
        // 清理历史记录到最近 20 条
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
                Utils.showToast(
                    '存储空间不足，部分数据可能无法保存。建议清理浏览器数据。',
                    'error',
                    5000
                );
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

    // ==================== 题库管理 ====================

    /**
     * 获取所有题库（从内存缓存返回完整数据）
     */
    getBanks() {
        const meta = this.get(this.KEYS.BANKS_META) || [];
        return meta.map((m) => {
            const fullData = this._bankData.get(m.id);
            return fullData || m; // 内存有完整数据就返回完整数据，否则返回元数据
        });
    },

    /**
     * 获取单个题库
     */
    getBank(bankId) {
        // 优先从内存缓存获取完整数据
        if (this._bankData.has(bankId)) {
            return this._bankData.get(bankId);
        }
        // 回退到元数据
        const meta = this.get(this.KEYS.BANKS_META) || [];
        return meta.find((b) => b.id === bankId) || null;
    },

    /**
     * 添加题库
     * 完整数据缓存在内存中，只有元数据存入 localStorage
     */
    addBank(bank) {
        if (!bank || !bank.id) return false;

        // 缓存完整数据到内存
        this._bankData.set(bank.id, bank);

        // 只存储元数据到 localStorage
        const metaList = this.get(this.KEYS.BANKS_META) || [];
        const existingIndex = metaList.findIndex((b) => b.id === bank.id);

        const metaData = {
            id: bank.id,
            name: bank.name,
            description: bank.description,
            version: bank.version,
            author: bank.author,
            categories: bank.categories,
            tags: bank.tags,
            questionCount: bank.questions?.length || 0
        };

        if (existingIndex >= 0) {
            metaList[existingIndex] = {
                ...metaList[existingIndex],
                ...metaData,
                updatedAt: new Date().toISOString()
            };
        } else {
            metaList.push({
                ...metaData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        this.set(this.KEYS.BANKS_META, metaList);
        return true;
    },

    /**
     * 删除题库
     */
    removeBank(bankId) {
        // 从内存中移除
        this._bankData.delete(bankId);

        // 从元数据中移除
        const metaList = this.get(this.KEYS.BANKS_META) || [];
        const filtered = metaList.filter((b) => b.id !== bankId);

        if (filtered.length < metaList.length) {
            this.set(this.KEYS.BANKS_META, filtered);

            // 同时删除该题库的进度和收藏
            const progress = this.getProgress();
            delete progress[bankId];
            this.set(this.KEYS.PROGRESS, progress);

            const bookmarks = this.getBookmarks();
            delete bookmarks[bankId];
            this.set(this.KEYS.BOOKMARKS, bookmarks);

            return true;
        }
        return false;
    },

    /**
     * 检查题库是否存在
     */
    bankExists(bankId) {
        const metaList = this.get(this.KEYS.BANKS_META) || [];
        return metaList.some((b) => b.id === bankId) || this._bankData.has(bankId);
    },

    // ==================== 进度管理 ====================

    /**
     * 获取所有进度
     */
    getProgress() {
        return this.get(this.KEYS.PROGRESS) || {};
    },

    /**
     * 获取题库进度
     */
    getBankProgress(bankId) {
        const progress = this.getProgress();
        return (
            progress[bankId] || {
                answered: 0,
                correct: 0,
                wrong: 0,
                questions: {}
            }
        );
    },

    /**
     * 更新题目进度（含间隔重复调度）
     */
    updateQuestionProgress(bankId, questionId, isCorrect, userAnswer) {
        const progress = this.getProgress();

        if (!progress[bankId]) {
            progress[bankId] = {
                answered: 0,
                correct: 0,
                wrong: 0,
                questions: {}
            };
        }

        const bankProgress = progress[bankId];
        const questionProgress = bankProgress.questions[questionId];

        // 如果是新题目或者之前答错了现在答对了
        if (!questionProgress) {
            bankProgress.answered++;
        } else if (!questionProgress.correct && isCorrect) {
            bankProgress.correct++;
            bankProgress.wrong--;
        } else if (questionProgress.correct && !isCorrect) {
            bankProgress.correct--;
            bankProgress.wrong++;
        }

        if (!questionProgress) {
            if (isCorrect) {
                bankProgress.correct++;
            } else {
                bankProgress.wrong++;
            }
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
            // 间隔重复字段
            easeFactor: easeFactor,
            interval: interval,
            nextReviewAt: nextReviewAt
        };

        this.set(this.KEYS.PROGRESS, progress);
        return bankProgress;
    },

    /**
     * SM-2 简化版：计算下次复习间隔（天数）
     * 答对：间隔 = 上次间隔 * 难度因子，最少 1 天
     * 答错：重置为 1 天
     */
    _calcInterval(isCorrect, prevInterval, easeFactor) {
        if (!isCorrect) return 1;
        if (prevInterval === 0) return 1;
        if (prevInterval === 1) return 3;
        return Math.max(1, Math.round(prevInterval * easeFactor));
    },

    /**
     * SM-2 简化版：计算难度因子
     * 答对：easeFactor 轻微增加
     * 答错：easeFactor 降低，最低 1.3
     */
    _calcEaseFactor(prevEF, isCorrect) {
        if (isCorrect) {
            return Math.min(3.0, prevEF + 0.1);
        } else {
            return Math.max(1.3, prevEF - 0.2);
        }
    },

    /**
     * 获取需要复习的题目（到期的）
     */
    getDueQuestions(bankId) {
        const bank = this.getBank(bankId);
        if (!bank || !bank.questions) return [];

        const progress = this.getBankProgress(bankId);
        const now = new Date();

        return bank.questions.filter((q) => {
            const qProgress = progress.questions[q.id];
            if (!qProgress) return false; // 未答过的不算
            if (!qProgress.nextReviewAt) return true; // 旧数据没有调度的，视为需复习
            return new Date(qProgress.nextReviewAt) <= now;
        });
    },

    /**
     * 获取所有题库的今日待复习数量
     */
    getTodayDueCount() {
        const metaList = this.get(this.KEYS.BANKS_META) || [];
        let totalDue = 0;
        for (const meta of metaList) {
            totalDue += this.getDueQuestions(meta.id).length;
        }
        return totalDue;
    },

    /**
     * 重置题库进度
     */
    resetBankProgress(bankId) {
        const progress = this.getProgress();
        progress[bankId] = {
            answered: 0,
            correct: 0,
            wrong: 0,
            questions: {}
        };
        this.set(this.KEYS.PROGRESS, progress);
        return true;
    },

    /**
     * 获取错题列表
     */
    getWrongQuestions(bankId) {
        const progress = this.getBankProgress(bankId);
        const wrongIds = [];

        for (const [qId, qProgress] of Object.entries(progress.questions)) {
            if (!qProgress.correct) {
                wrongIds.push(parseInt(qId));
            }
        }

        return wrongIds;
    },

    /**
     * 获取全局错题统计
     */
    getGlobalWrongStats() {
        const banks = this.getBanks();
        let totalWrong = 0;
        const details = [];

        for (const bank of banks) {
            const wrongIds = this.getWrongQuestions(bank.id);
            if (wrongIds.length > 0) {
                totalWrong += wrongIds.length;
                details.push({
                    bankId: bank.id,
                    bankName: bank.name,
                    wrongIds,
                    count: wrongIds.length
                });
            }
        }

        return { totalWrong, details };
    },

    /**
     * 清空全局错题本
     */
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

    /**
     * 获取所有收藏
     */
    getBookmarks() {
        return this.get(this.KEYS.BOOKMARKS) || {};
    },

    /**
     * 获取题库的收藏列表
     */
    getBankBookmarks(bankId) {
        const bookmarks = this.getBookmarks();
        return bookmarks[bankId] || [];
    },

    /**
     * 切换收藏状态
     */
    toggleBookmark(bankId, questionId) {
        const bookmarks = this.getBookmarks();
        if (!bookmarks[bankId]) {
            bookmarks[bankId] = [];
        }

        const index = bookmarks[bankId].indexOf(questionId);
        if (index >= 0) {
            bookmarks[bankId].splice(index, 1);
        } else {
            bookmarks[bankId].push(questionId);
        }

        this.set(this.KEYS.BOOKMARKS, bookmarks);
        return index < 0; // 返回 true 表示已收藏，false 表示取消收藏
    },

    /**
     * 检查是否已收藏
     */
    isBookmarked(bankId, questionId) {
        const bookmarks = this.getBankBookmarks(bankId);
        return bookmarks.includes(questionId);
    },

    /**
     * 获取收藏题目数量
     */
    getBookmarkCount(bankId) {
        return this.getBankBookmarks(bankId).length;
    },

    // ==================== 历史记录 ====================

    /**
     * 添加答题历史
     */
    addHistory(record) {
        const history = this.getHistory();
        history.unshift({
            ...record,
            timestamp: new Date().toISOString()
        });

        // 只保留最近100条记录
        if (history.length > 100) {
            history.length = 100;
        }

        this.set(this.KEYS.HISTORY, history);

        // 累加总学习时长（独立于 history 的裁剪）
        if (record.duration && record.duration > 0) {
            this.addDuration(record.duration);
        }
    },

    /**
     * 累加总学习时长
     * @param {number} seconds - 秒数
     */
    addDuration(seconds) {
        const progress = this.getProgress();
        if (!progress._global) progress._global = {};
        progress._global.totalDuration = (progress._global.totalDuration || 0) + seconds;
        this.set(this.KEYS.PROGRESS, progress);
    },

    /**
     * 获取答题历史
     */
    getHistory() {
        return this.get(this.KEYS.HISTORY) || [];
    },

    /**
     * 清空历史记录
     */
    clearHistory() {
        this.set(this.KEYS.HISTORY, []);
    },

    // ==================== 设置管理 ====================

    /**
     * 获取设置
     */
    getSettings() {
        return (
            this.get(this.KEYS.SETTINGS) || {
                showAnswer: true,
                autoNext: false,
                randomOrder: false,
                fontSize: 16
            }
        );
    },

    /**
     * 更新设置
     */
    updateSettings(settings) {
        const current = this.getSettings();
        this.set(this.KEYS.SETTINGS, { ...current, ...settings });
    },

    // ==================== 统计信息 ====================

    /**
     * 获取全局统计
     */
    getGlobalStats() {
        const banks = this.getBanks();
        const progress = this.getProgress();
        const history = this.getHistory();

        let totalQuestions = 0;
        let totalAnswered = 0;
        let totalCorrect = 0;
        let totalWrong = 0;
        let totalDuration = 0;

        banks.forEach((bank) => {
            totalQuestions += bank.questions?.length || bank.questionCount || 0;
            const bankProgress = progress[bank.id] || {};
            totalAnswered += bankProgress.answered || 0;
            totalCorrect += bankProgress.correct || 0;
            totalWrong += bankProgress.wrong || 0;
        });

        // 读取累计学习时长（独立于 history 裁剪）
        totalDuration = progress._global?.totalDuration || 0;

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

    /**
     * 获取题库统计
     */
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
            accuracy:
                progress.answered > 0
                    ? Math.round((progress.correct / progress.answered) * 100)
                    : 0,
            progress:
                totalQuestions > 0
                    ? Math.round(((progress.answered || 0) / totalQuestions) * 100)
                    : 0
        };
    },

    /**
     * 按分类统计正确率（薄弱知识点分析）
     */
    getCategoryStats(bankId) {
        const bank = this.getBank(bankId);
        if (!bank || !bank.questions) return {};

        const progress = this.getBankProgress(bankId);
        const categoryMap = {};

        bank.questions.forEach((q) => {
            const cat = q.category || '未分类';
            if (!categoryMap[cat]) {
                categoryMap[cat] = { total: 0, answered: 0, correct: 0, wrong: 0 };
            }
            categoryMap[cat].total++;

            const qProgress = progress.questions[q.id];
            if (qProgress) {
                categoryMap[cat].answered++;
                if (qProgress.correct) {
                    categoryMap[cat].correct++;
                } else {
                    categoryMap[cat].wrong++;
                }
            }
        });

        // 计算正确率
        for (const cat of Object.values(categoryMap)) {
            cat.accuracy = cat.answered > 0 ? Math.round((cat.correct / cat.answered) * 100) : -1; // -1 表示未作答
        }

        return categoryMap;
    },

    /**
     * 获取薄弱知识点（正确率最低的分类）
     */
    getWeakCategories(bankId, limit = 5) {
        const stats = this.getCategoryStats(bankId);
        return Object.entries(stats)
            .filter(([_, s]) => s.answered > 0) // 只看已作答的
            .sort((a, b) => a[1].accuracy - b[1].accuracy) // 按正确率升序
            .slice(0, limit)
            .map(([name, stats]) => ({ name, ...stats }));
    },

    /**
     * 导出所有数据
     */
    exportData() {
        // 导出时包含内存中的完整题库数据
        const banks = [];
        const metaList = this.get(this.KEYS.BANKS_META) || [];
        for (const meta of metaList) {
            const full = this._bankData.get(meta.id);
            banks.push(full || meta);
        }

        return {
            banks,
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
        if (data.banks) {
            data.banks.forEach((bank) => this.addBank(bank));
        }
        if (data.progress) this.set(this.KEYS.PROGRESS, data.progress);
        if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
        if (data.history) this.set(this.KEYS.HISTORY, data.history);
        if (data.bookmarks) this.set(this.KEYS.BOOKMARKS, data.bookmarks);
        return true;
    },

    // ==================== 会话状态管理 ====================

    /**
     * 保存刷题会话状态
     */
    saveSession(bankId, mode, sessionData) {
        const sessions = this.get(this.KEYS.SESSION) || {};
        const key = `${bankId}:${mode}`;
        sessions[key] = {
            ...sessionData,
            savedAt: new Date().toISOString()
        };
        this.set(this.KEYS.SESSION, sessions);
    },

    /**
     * 获取刷题会话状态
     */
    getSession(bankId, mode) {
        const sessions = this.get(this.KEYS.SESSION) || {};
        const key = `${bankId}:${mode}`;
        return sessions[key] || null;
    },

    /**
     * 清除刷题会话状态
     */
    clearSession(bankId, mode) {
        const sessions = this.get(this.KEYS.SESSION) || {};
        const key = `${bankId}:${mode}`;
        delete sessions[key];
        this.set(this.KEYS.SESSION, sessions);
    },

    /**
     * 清除所有会话状态
     */
    clearAllSessions() {
        this.set(this.KEYS.SESSION, {});
    },

    /**
     * 清除所有数据
     */
    clearAll() {
        Object.values(this.KEYS).forEach((key) => {
            this.remove(key);
        });
        this._bankData.clear();
        this.init();
    }
};

// 初始化
Storage.init();

// 导出
window.Storage = Storage;
export default Storage;
