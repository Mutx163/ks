/**
 * 51.la 事件追踪模块
 * 统计用户学习行为
 */

const Tracker = {
    /**
     * 检查 LA 是否可用
     */
    _isReady() {
        return typeof LA !== 'undefined' && LA.track;
    },

    /**
     * 通用追踪方法
     */
    track(eventName, props = {}) {
        if (!this._isReady()) return;
        try {
            LA.track(eventName, props);
            console.log('[Tracker]', eventName, props);
        } catch (e) {
            console.warn('[Tracker] error:', e);
        }
    },

    // ========== 答题行为 ==========

    /**
     * 开始刷题
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     * @param {string} mode - 刷题模式 (all/random/shuffle_options/wrong/review/spaced/bookmark)
     * @param {number} questionCount - 题目数量
     */
    startQuiz(bankId, bankName, mode, questionCount) {
        this.track('开始刷题', {
            题库ID: bankId,
            题库名称: bankName,
            刷题模式: mode,
            题目数量: questionCount
        });
    },

    /**
     * 提交单题答案
     * @param {string} bankId - 题库ID
     * @param {string} type - 题型 (single/multiple/judge/fill/code/essay)
     * @param {boolean} isCorrect - 是否正确
     * @param {number} difficulty - 难度 (1-5)
     */
    submitAnswer(bankId, type, isCorrect, difficulty) {
        this.track('提交答案', {
            题库ID: bankId,
            题型: type,
            是否正确: isCorrect ? '正确' : '错误',
            难度: difficulty || 1
        });
    },

    /**
     * 完成答题
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     * @param {string} mode - 刷题模式
     * @param {number} total - 总题数
     * @param {number} correct - 正确数
     * @param {number} wrong - 错误数
     * @param {number} accuracy - 正确率 (%)
     * @param {number} duration - 用时 (秒)
     */
    finishQuiz(bankId, bankName, mode, total, correct, wrong, accuracy, duration) {
        this.track('完成答题', {
            题库ID: bankId,
            题库名称: bankName,
            刷题模式: mode,
            总题数: total,
            正确数: correct,
            错误数: wrong,
            正确率: accuracy + '%',
            用时秒: duration,
            用时分: Math.round(duration / 60) + '分钟'
        });
    },

    // ========== 考试模式 ==========

    /**
     * 开始考试
     * @param {string} bankId - 题库ID
     * @param {number} questionCount - 题目数量
     * @param {number} timeLimit - 时间限制 (分钟)
     */
    startExam(bankId, questionCount, timeLimit) {
        this.track('开始考试', {
            题库ID: bankId,
            题目数量: questionCount,
            时间限制: timeLimit + '分钟'
        });
    },

    /**
     * 完成考试
     * @param {string} bankId - 题库ID
     * @param {number} total - 总题数
     * @param {number} correct - 正确数
     * @param {number} accuracy - 正确率 (%)
     * @param {number} duration - 用时 (秒)
     * @param {boolean} timeout - 是否超时
     */
    finishExam(bankId, total, correct, accuracy, duration, timeout) {
        this.track('完成考试', {
            题库ID: bankId,
            总题数: total,
            正确数: correct,
            正确率: accuracy + '%',
            用时秒: duration,
            是否超时: timeout ? '是' : '否'
        });
    },

    // ========== 题库操作 ==========

    /**
     * 导入题库
     * @param {string} bankName - 题库名称
     * @param {number} questionCount - 题目数量
     */
    importBank(bankName, questionCount) {
        this.track('导入题库', {
            题库名称: bankName,
            题目数量: questionCount
        });
    },

    /**
     * 导出题库
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     */
    exportBank(bankId, bankName) {
        this.track('导出题库', {
            题库ID: bankId,
            题库名称: bankName
        });
    },

    /**
     * 重置进度
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     */
    resetProgress(bankId, bankName) {
        this.track('重置进度', {
            题库ID: bankId,
            题库名称: bankName
        });
    },

    /**
     * 删除题库
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     */
    deleteBank(bankId, bankName) {
        this.track('删除题库', {
            题库ID: bankId,
            题库名称: bankName
        });
    },

    // ========== 学习行为 ==========

    /**
     * 搜索题目
     * @param {string} keyword - 搜索关键词
     * @param {number} resultCount - 结果数量
     */
    searchQuestions(keyword, resultCount) {
        this.track('搜索题目', {
            关键词: keyword,
            结果数量: resultCount
        });
    },

    /**
     * 收藏/取消收藏题目
     * @param {string} bankId - 题库ID
     * @param {number} questionId - 题目ID
     * @param {boolean} isBookmarked - 是否收藏
     */
    toggleBookmark(bankId, questionId, isBookmarked) {
        this.track(isBookmarked ? '收藏题目' : '取消收藏', {
            题库ID: bankId,
            题目ID: questionId
        });
    },

    /**
     * 清空错题本
     * @param {number} count - 清空的错题数
     */
    clearWrongBook(count) {
        this.track('清空错题本', {
            错题数量: count
        });
    },

    /**
     * 切换题型筛选
     * @param {string} bankId - 题库ID
     * @param {string} type - 题型
     */
    selectType(bankId, type) {
        this.track('筛选题型', {
            题库ID: bankId,
            题型: type
        });
    },

    // ========== 题目停留时间（热力图） ==========

    /**
     * 记录单题停留时间
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     * @param {number} questionId - 题目ID
     * @param {string} category - 题目分类
     * @param {string} type - 题型
     * @param {number} difficulty - 难度
     * @param {number} timeSpent - 停留秒数
     * @param {boolean} isCorrect - 是否正确
     */
    questionTime(bankId, bankName, questionId, category, type, difficulty, timeSpent, isCorrect) {
        // 只追踪停留超过3秒的题目，过滤快速翻页
        if (timeSpent < 3) return;
        this.track('题目停留', {
            题库ID: bankId,
            题库名称: bankName,
            题目ID: questionId,
            分类: category || '未分类',
            题型: type,
            难度: difficulty || 1,
            停留秒: timeSpent,
            停留分: timeSpent >= 60 ? Math.round(timeSpent / 60) + '分钟' : '',
            是否正确: isCorrect ? '正确' : '错误',
            耗时等级: timeSpent >= 120 ? '超长' : timeSpent >= 60 ? '较长' : timeSpent >= 30 ? '正常' : '快速'
        });
    },

    /**
     * 记录完成答题后的热力图汇总
     * @param {string} bankId - 题库ID
     * @param {string} bankName - 题库名称
     * @param {Array} questionTimes - [{id, category, type, difficulty, timeSpent, isCorrect}]
     */
    questionHeatmap(bankId, bankName, questionTimes) {
        if (!questionTimes || questionTimes.length === 0) return;

        // 找出耗时最长的前5题
        const sorted = [...questionTimes].sort((a, b) => b.timeSpent - a.timeSpent);
        const top5 = sorted.slice(0, 5);

        // 按分类统计平均耗时
        const categoryMap = {};
        questionTimes.forEach(q => {
            const cat = q.category || '未分类';
            if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
            categoryMap[cat].total += q.timeSpent;
            categoryMap[cat].count++;
        });
        const categoryStats = Object.entries(categoryMap)
            .map(([cat, data]) => `${cat}:${Math.round(data.total / data.count)}秒`)
            .join(', ');

        // 按难度统计平均耗时
        const diffMap = {};
        questionTimes.forEach(q => {
            const d = q.difficulty || 1;
            if (!diffMap[d]) diffMap[d] = { total: 0, count: 0 };
            diffMap[d].total += q.timeSpent;
            diffMap[d].count++;
        });
        const diffStats = Object.entries(diffMap)
            .sort(([a], [b]) => a - b)
            .map(([d, data]) => `D${d}:${Math.round(data.total / data.count)}秒`)
            .join(', ');

        this.track('答题热力图', {
            题库ID: bankId,
            题库名称: bankName,
            总题数: questionTimes.length,
            平均耗时: Math.round(questionTimes.reduce((s, q) => s + q.timeSpent, 0) / questionTimes.length) + '秒',
            最长耗时: sorted[0].timeSpent + '秒',
            最长题目ID: sorted[0].id,
            最长分类: sorted[0].category || '未分类',
            TOP5题目: top5.map(q => `Q${q.id}(${q.timeSpent}s)`).join(', '),
            分类耗时: categoryStats,
            难度耗时: diffStats
        });
    },

    // ========== 页面访问 ==========

    /**
     * 访问分析页面
     */
    viewAnalysis() {
        this.track('访问分析页', {});
    },

    /**
     * 访问趋势页面
     */
    viewTrend() {
        this.track('访问趋势页', {});
    }
};

export default Tracker;
