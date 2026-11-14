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
                colorScheme: 'parchment',
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
        let raw;
        try {
            raw = localStorage.getItem(key);
        } catch (e) {
            // 隐私模式 / 被禁用：读都失败时只能返回空
            console.error('Storage get error:', e);
            return null;
        }
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            // 数据损坏：先备份原始串再返回 null，
            // 否则 init() 会直接用默认值覆盖，用户数据永久丢失
            console.error('Storage parse error:', key, e);
            try {
                localStorage.setItem(`${key}.corrupt.${Date.now()}`, raw.slice(0, 200000));
            } catch {
                /* 备份失败也不影响主流程 */
            }
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
                    } catch {
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
            } catch {
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
        const p = progress[bankId];
        if (!p) return { answered: 0, correct: 0, wrong: 0, questions: {} };
        // 结构归一：老数据/云端合并可能缺少 questions，直接访问会 TypeError
        if (!p.questions || typeof p.questions !== 'object' || Array.isArray(p.questions)) {
            p.questions = {};
        }
        return p;
    },

    // ==================== 上报游标 ====================
    // 记录「已经推送到云端的累计量」，按题库持久化。
    // 只放在 session 里会在完成/换模式后归零，导致历史作答被整批重推。
    getStatsCursor(bankId) {
        const p = this.getProgress()[bankId];
        const c = p && p.statsCursor;
        if (!c || typeof c !== 'object') return { answered: 0, correct: 0, duration: 0 };
        return {
            answered: Math.max(0, Number(c.answered) || 0),
            correct: Math.max(0, Number(c.correct) || 0),
            duration: Math.max(0, Number(c.duration) || 0)
        };
    },

    setStatsCursor(bankId, cursor) {
        const progress = this.getProgress();
        if (!progress[bankId]) {
            progress[bankId] = { answered: 0, correct: 0, wrong: 0, questions: {} };
        }
        progress[bankId].statsCursor = {
            answered: Math.max(0, Number(cursor.answered) || 0),
            correct: Math.max(0, Number(cursor.correct) || 0),
            duration: Math.max(0, Number(cursor.duration) || 0)
        };
        this.set(this.KEYS.PROGRESS, progress);
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
        // 重置本地进度的同时把上报游标归零（本地已答从 0 重新计），
        // 否则后续增量会算成负数而不再上报
        progress[bankId] = {
            answered: 0,
            correct: 0,
            wrong: 0,
            questions: {},
            statsCursor: { answered: 0, correct: 0, duration: 0 }
        };
        this.set(this.KEYS.PROGRESS, progress);
        return true;
    },

    getWrongQuestions(bankId) {
        const progress = this.getBankProgress(bankId);
        const wrongIds = [];
        for (const [qId, qProgress] of Object.entries(progress.questions)) {
            if (!qProgress || qProgress.correct) continue;
            // 保留原始 key 类型：题目 id 可能是字符串，parseInt 会变 NaN
            wrongIds.push(/^\d+$/.test(qId) ? Number(qId) : qId);
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

    clearAllWrong() {
        // 语义是「移除错题记录」，不是「把错题改判为正确」。
        // 后者会把正确率凭空抬高并同步到云端排行榜，与按钮文案不符。
        const progress = this.getProgress();
        for (const bankId of Object.keys(progress)) {
            const bp = progress[bankId];
            if (!bp || !bp.questions) continue;
            const questions = bp.questions;
            let removed = 0;
            for (const [qId, qProgress] of Object.entries(questions)) {
                if (!qProgress || !qProgress.correct) {
                    delete questions[qId];
                    removed++;
                }
            }
            bp.wrong = 0;
            bp.answered = Math.max(0, (Number(bp.answered) || 0) - removed);
            bp.correct = Math.max(0, Math.min(Number(bp.correct) || 0, bp.answered));
        }
        this.set(this.KEYS.PROGRESS, progress);
    },

    // ==================== 收藏管理 ====================

    getBookmarks() {
        return this.get(this.KEYS.BOOKMARKS) || {};
    },

    getBankBookmarks(bankId) {
        const bookmarks = this.getBookmarks();
        const ids = bookmarks[bankId];
        if (!Array.isArray(ids)) return [];
        // 严格归一成字符串：题库 JSON 的 question.id 是数字（Int64），
        // 而 onload/inline 事件与云端同步带回来的多是字符串，
        // 不归一就会出现「已收藏但高亮不亮、收藏模式 0 题」。
        return ids.map((id) => String(id));
    },

    toggleBookmark(bankId, questionId) {
        // 读写两端必须是同一种类型，否则同一个题会在数组里出现 "1" 和 1 两份
        const id = String(questionId);
        const bookmarks = this.getBookmarks();
        const ids = Array.isArray(bookmarks[bankId]) ? bookmarks[bankId].map((v) => String(v)) : [];

        const index = ids.indexOf(id);
        if (index >= 0) ids.splice(index, 1);
        else ids.push(id);

        bookmarks[bankId] = ids;
        this.set(this.KEYS.BOOKMARKS, bookmarks);
        return index < 0;
    },

    isBookmarked(bankId, questionId) {
        return this.getBankBookmarks(bankId).includes(String(questionId));
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
        return (
            this.get(this.KEYS.SETTINGS) || {
                showAnswer: true,
                autoNext: false,
                randomOrder: false,
                swipeNavigation: true,
                fontSize: 16,
                theme: 'auto',
                colorScheme: 'parchment',
                aiEngine: 'metaso',
                customAiEngines: []
            }
        );
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

    getCategoryStats(bankId) {
        const bank = this.getBank(bankId);
        if (!bank || !bank.questions) return {};

        const progress = this.getBankProgress(bankId);
        const categoryMap = {};

        bank.questions.forEach((q) => {
            const cat = q.category || '未分类';
            if (!categoryMap[cat])
                categoryMap[cat] = { total: 0, answered: 0, correct: 0, wrong: 0 };
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
        // 账号相关与缓存类 key 不在 KEYS 里，必须显式清理，
        // 否则「清空本地数据」后旧队列仍会把增量补推回云端
        [
            'ks_sync_queue',
            'quiz_ai_explain_local',
            'ks_cached_announce',
            'ks_is_admin',
            'ks_last_pull',
            'quiz_search_results'
        ].forEach((key) => this.remove(key));
        this._bankData.clear();
        this.init();
    },

    /**
     * 清除旧的缓存数据（迁移用）
     */
    clearLegacyCache() {
        this.remove('quiz_banks_meta');
        this.remove('quiz_cache_versions');
        // 更早版本把整份题库写进 localStorage，现在没有任何读取方，
        // 留着只会白占配额
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('ks_bank_data_') || key === 'ks_api_base')) {
                    localStorage.removeItem(key);
                }
            }
        } catch {
            /* localStorage 不可用时忽略 */
        }
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
