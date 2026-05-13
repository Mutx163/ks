/**
 * 本地存储管理模块
 * 管理题库数据、用户进度、设置等
 */

const Storage = {
    // 存储键名
    KEYS: {
        BANKS: 'quiz_banks',
        PROGRESS: 'quiz_progress',
        SETTINGS: 'quiz_settings',
        HISTORY: 'quiz_history'
    },

    /**
     * 初始化存储
     */
    init() {
        // 确保所有必要的键存在
        if (!this.get(this.KEYS.BANKS)) {
            this.set(this.KEYS.BANKS, []);
        }
        if (!this.get(this.KEYS.PROGRESS)) {
            this.set(this.KEYS.PROGRESS, {});
        }
        if (!this.get(this.KEYS.SETTINGS)) {
            this.set(this.KEYS.SETTINGS, {
                showAnswer: true,      // 答题后显示答案
                autoNext: false,       // 自动下一题
                randomOrder: false,    // 随机顺序
                fontSize: 16           // 字体大小
            });
        }
        if (!this.get(this.KEYS.HISTORY)) {
            this.set(this.KEYS.HISTORY, []);
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
            console.error('Storage set error:', e);
            return false;
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
     * 获取所有题库
     */
    getBanks() {
        return this.get(this.KEYS.BANKS) || [];
    },

    /**
     * 获取单个题库
     */
    getBank(bankId) {
        const banks = this.getBanks();
        return banks.find(b => b.id === bankId) || null;
    },

    /**
     * 添加题库
     */
    addBank(bank) {
        const banks = this.getBanks();
        const existingIndex = banks.findIndex(b => b.id === bank.id);
        
        if (existingIndex >= 0) {
            // 更新现有题库
            banks[existingIndex] = {
                ...banks[existingIndex],
                ...bank,
                updatedAt: new Date().toISOString()
            };
        } else {
            // 添加新题库
            banks.push({
                ...bank,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        
        this.set(this.KEYS.BANKS, banks);
        return true;
    },

    /**
     * 删除题库
     */
    removeBank(bankId) {
        const banks = this.getBanks();
        const filtered = banks.filter(b => b.id !== bankId);
        
        if (filtered.length < banks.length) {
            this.set(this.KEYS.BANKS, filtered);
            
            // 同时删除该题库的进度
            const progress = this.getProgress();
            delete progress[bankId];
            this.set(this.KEYS.PROGRESS, progress);
            
            return true;
        }
        return false;
    },

    /**
     * 检查题库是否存在
     */
    bankExists(bankId) {
        const banks = this.getBanks();
        return banks.some(b => b.id === bankId);
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
        return progress[bankId] || {
            answered: 0,
            correct: 0,
            wrong: 0,
            questions: {}
        };
    },

    /**
     * 更新题目进度
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
        
        bankProgress.questions[questionId] = {
            correct: isCorrect,
            userAnswer: userAnswer,
            answeredAt: new Date().toISOString(),
            attempts: (questionProgress?.attempts || 0) + 1
        };
        
        this.set(this.KEYS.PROGRESS, progress);
        return bankProgress;
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
        return this.get(this.KEYS.SETTINGS) || {
            showAnswer: true,
            autoNext: false,
            randomOrder: false,
            fontSize: 16
        };
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
        
        let totalQuestions = 0;
        let totalAnswered = 0;
        let totalCorrect = 0;
        let totalWrong = 0;
        
        banks.forEach(bank => {
            totalQuestions += bank.questions?.length || 0;
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
        const totalQuestions = bank.questions?.length || 0;
        
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

    /**
     * 导出所有数据
     */
    exportData() {
        return {
            banks: this.getBanks(),
            progress: this.getProgress(),
            settings: this.getSettings(),
            history: this.getHistory(),
            exportedAt: new Date().toISOString()
        };
    },

    /**
     * 导入数据
     */
    importData(data) {
        if (data.banks) this.set(this.KEYS.BANKS, data.banks);
        if (data.progress) this.set(this.KEYS.PROGRESS, data.progress);
        if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
        if (data.history) this.set(this.KEYS.HISTORY, data.history);
        return true;
    },

    /**
     * 清除所有数据
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            this.remove(key);
        });
        this.init();
    }
};

// 初始化
Storage.init();

// 导出
window.Storage = Storage;
