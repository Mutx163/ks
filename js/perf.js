/**
 * 性能监控模块
 * 记录页面加载时间、各阶段耗时、资源加载等
 */

const Perf = {
    _marks: {},
    _pageName: '',
    _startTime: 0,

    /**
     * 初始化性能监控
     * @param {string} pageName - 页面名称（如 '首页'、'刷题页'）
     */
    init(pageName) {
        this._pageName = pageName;
        this._startTime = performance.now();
        this._marks = {};

        console.log(`[Perf] ========== ${pageName} 性能监控开始 ==========`);
        console.log(`[Perf] 📅 页面开始时间: ${new Date().toLocaleTimeString()}`);
        console.log(`[Perf] 🌐 User-Agent: ${navigator.userAgent.slice(0, 100)}...`);

        // 记录 Navigation Timing
        this._logNavigationTiming();
    },

    /**
     * 记录导航时间
     */
    _logNavigationTiming() {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return;

        console.log(`[Perf] 📊 Navigation Timing:`, {
            'DNS查询': this._fmtMs(nav.domainLookupEnd - nav.domainLookupStart),
            'TCP连接': this._fmtMs(nav.connectEnd - nav.connectStart),
            'TLS握手': this._fmtMs(nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0),
            '请求响应': this._fmtMs(nav.responseEnd - nav.requestStart),
            'DOM解析': this._fmtMs(nav.domInteractive - nav.responseEnd),
            'DOM完成': this._fmtMs(nav.domContentLoadedEventEnd - nav.startTime),
            '页面完全加载': this._fmtMs(nav.loadEventEnd - nav.startTime)
        });
    },

    /**
     * 标记时间点
     * @param {string} name - 标记名称
     */
    mark(name) {
        const now = performance.now();
        this._marks[name] = now;
        const elapsed = this._fmtMs(now - this._startTime);
        console.log(`[Perf] ⏱️ ${name}: ${elapsed}`);
    },

    /**
     * 测量两个时间点之间的耗时
     * @param {string} name - 测量名称
     * @param {string} startMark - 开始标记
     * @param {string} endMark - 结束标记
     */
    measure(name, startMark, endMark) {
        const start = this._marks[startMark];
        const end = this._marks[endMark];
        if (start && end) {
            const duration = this._fmtMs(end - start);
            console.log(`[Perf] 📏 ${name}: ${duration}`);
        }
    },

    /**
     * 记录加载完成并输出汇总
     * @param {object} extra - 额外信息
     */
    done(extra = {}) {
        const totalTime = performance.now() - this._startTime;
        
        console.log(`[Perf] ========== ${this._pageName} 性能汇总 ==========`);
        console.log(`[Perf] ⏱️ 总加载时间: ${this._fmtMs(totalTime)}`);
        
        // 计算各阶段耗时
        const marks = Object.entries(this._marks).sort((a, b) => a[1] - b[1]);
        if (marks.length > 1) {
            console.log(`[Perf] 📊 各阶段耗时:`);
            for (let i = 1; i < marks.length; i++) {
                const duration = marks[i][1] - marks[i - 1][1];
                const percent = ((duration / totalTime) * 100).toFixed(1);
                const bar = '█'.repeat(Math.min(Math.round(percent / 5), 20));
                console.log(`[Perf]   ${marks[i - 1][0]} → ${marks[i][0]}: ${this._fmtMs(duration)} (${percent}%) ${bar}`);
            }
        }

        // 输出额外信息
        if (Object.keys(extra).length > 0) {
            console.log(`[Perf] 📋 附加信息:`, extra);
        }

        // 性能评级
        const rating = this._getRating(totalTime);
        console.log(`[Perf] 🏆 性能评级: ${rating}`);

        // 记录资源加载
        this._logResources();
        
        console.log(`[Perf] ========== 性能监控结束 ==========`);
    },

    /**
     * 获取性能评级
     */
    _getRating(ms) {
        if (ms < 1000) return '🟢 优秀 (< 1秒)';
        if (ms < 2000) return '🟡 良好 (< 2秒)';
        if (ms < 3000) return '🟠 一般 (< 3秒)';
        return '🔴 较慢 (> 3秒)';
    },

    /**
     * 记录资源加载情况
     */
    _logResources() {
        const resources = performance.getEntriesByType('resource');
        if (resources.length === 0) return;

        console.log(`[Perf] 📦 资源加载统计 (共 ${resources.length} 个):`);

        // 按类型分组
        const byType = {};
        resources.forEach(r => {
            const type = this._getResourceType(r.name);
            if (!byType[type]) byType[type] = { count: 0, totalSize: 0, totalDuration: 0 };
            byType[type].count++;
            byType[type].totalDuration += r.duration;
            byType[type].totalSize += r.transferSize || 0;
        });

        Object.entries(byType).forEach(([type, data]) => {
            console.log(`[Perf]   ${type}: ${data.count} 个, ${this._fmtMs(data.totalDuration)}, ${this._fmtSize(data.totalSize)}`);
        });

        // 最慢的 5 个资源
        const slowest = [...resources].sort((a, b) => b.duration - a.duration).slice(0, 5);
        if (slowest.length > 0) {
            console.log(`[Perf] 🐢 最慢的资源:`);
            slowest.forEach(r => {
                const name = r.name.split('/').pop().slice(0, 40);
                console.log(`[Perf]   ${name}: ${this._fmtMs(r.duration)} (${this._fmtSize(r.transferSize)})`);
            });
        }
    },

    /**
     * 获取资源类型
     */
    _getResourceType(url) {
        if (url.includes('.js')) return '📜 JavaScript';
        if (url.includes('.css')) return '🎨 CSS';
        if (url.includes('.json')) return '📋 JSON';
        if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) return '🖼️ 图片';
        if (url.includes('/api/')) return '🔌 API';
        return '📄 其他';
    },

    /**
     * 格式化毫秒
     */
    _fmtMs(ms) {
        if (ms < 1) return '< 1ms';
        if (ms < 1000) return Math.round(ms) + 'ms';
        return (ms / 1000).toFixed(2) + 's';
    },

    /**
     * 格式化文件大小
     */
    _fmtSize(bytes) {
        if (!bytes || bytes === 0) return '0B';
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    },

    /**
     * 测量异步函数的执行时间
     * @param {string} name - 名称
     * @param {Function} fn - 异步函数
     * @returns {*} 函数返回值
     */
    async measureAsync(name, fn) {
        const start = performance.now();
        console.log(`[Perf] ⏳ 开始: ${name}`);
        try {
            const result = await fn();
            const duration = performance.now() - start;
            console.log(`[Perf] ✅ 完成: ${name} (${this._fmtMs(duration)})`);
            return result;
        } catch (e) {
            const duration = performance.now() - start;
            console.error(`[Perf] ❌ 失败: ${name} (${this._fmtMs(duration)}):`, e.message);
            throw e;
        }
    }
};

export default Perf;
