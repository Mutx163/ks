/**
 * 前端控制台日志自动收集模块
 *
 * 功能：
 * 1. 拦截 console.log/warn/error 并本地缓存
 * 2. 捕获 window.onerror 和 unhandledrejection
 * 3. 批量防抖上报到 Worker API
 * 4. 页面关闭前通过 sendBeacon 上报剩余日志
 * 5. 可通过 Settings 开关控制
 *
 * 隐私策略：
 * - 不记录题目内容、选项、答案
 * - 只记录：日志级别、消息摘要、堆栈、页面 URL、User-Agent、时间戳
 * - 用户可在设置中关闭此功能
 */

const LogCollector = {
    /** 获取 API 基础地址 */
    _getBaseUrl() {
        return window.__API_BASE__ || localStorage.getItem('ks_api_base') || 'https://a.mutx.ccwu.cc';
    },

    /** 配置 */
    config: {
        enabled: true, // 总开关（从 localStorage 读取）
        maxBufferSize: 50, // 本地最多缓存条数
        flushInterval: 15000, // 自动上报间隔（毫秒）
        rateLimit: 100, // 每小时最多上报条数
        warnOnly: true // 只上报 warn 及以上级别（warn, error）
    },

    /** 内部状态 */
    _buffer: [],
    _flushTimer: null,
    _originalConsole: null,
    _initialized: false,
    _rateCount: 0,
    _rateResetTime: 0,
    _deviceId: null,
    _pageUrl: '',

    /**
     * 初始化日志收集
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // 从 localStorage 读取开关设置
        try {
            const settingsRaw = localStorage.getItem('quiz_settings');
            if (settingsRaw) {
                const settings = JSON.parse(settingsRaw);
                if (settings.logCollection === false) {
                    this.config.enabled = false;
                }
            }
        } catch {
            // 忽略
        }

        this._pageUrl = window.location.href;
        this._deviceId = this._getDeviceId();

        // 每小时重置计数
        this._rateResetTime = Date.now();
        this._rateCount = 0;
        setInterval(() => {
            this._rateCount = 0;
            this._rateResetTime = Date.now();
        }, 3600000);

        // 拦截 console 方法
        this._interceptConsole();

        // 捕获未处理 JS 错误
        this._captureErrors();

        // 接管页面加载早期（模块加载前）捕获的错误
        if (window._earlyLogs && window._earlyLogs.length > 0) {
            for (const entry of window._earlyLogs) {
                this._addToBuffer(entry);
            }
            window._earlyLogs = [];
        }

        // 页面关闭前上报剩余日志
        this._captureUnload();

        // 定期自动上报
        this._startAutoFlush();

        console.log('[LogCollector] ✅ 日志收集已初始化, 启用:', this.config.enabled);
    },

    /**
     * 启用/禁用日志收集
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (enabled) {
            console.log('[LogCollector] ✅ 日志收集已启用');
        } else {
            console.log('[LogCollector] ⏸️ 日志收集已禁用');
            this._buffer = [];
        }
    },

    /**
     * 获取设备 ID（复用 API 模块或生成 UUID）
     */
    _getDeviceId() {
        // 优先复用现有设备 ID
        let id = localStorage.getItem('ks_device_id');
        if (id) return id;

        // 生成 UUID
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            id = crypto.randomUUID();
        } else {
            id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
        }
        localStorage.setItem('ks_device_id', id);
        return id;
    },

    /**
     * 截获 console 方法
     */
    _interceptConsole() {
        if (typeof console === 'undefined') return;

        const self = this;
        this._originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
        };

        console.log = function (...args) {
            self._originalConsole.log.apply(console, args);
            self._capture('log', args);
        };

        console.warn = function (...args) {
            self._originalConsole.warn.apply(console, args);
            self._capture('warn', args);
        };

        console.error = function (...args) {
            self._originalConsole.error.apply(console, args);
            self._capture('error', args);
        };

        console.info = function (...args) {
            self._originalConsole.info.apply(console, args);
            self._capture('info', args);
        };

        console.debug = function (...args) {
            self._originalConsole.debug.apply(console, args);
            self._capture('debug', args);
        };
    },

    /**
     * 捕获未处理错误和 Promise 拒绝
     */
    _captureErrors() {
        const self = this;

        // JS 运行时错误
        window.onerror = function (message, source, lineno, colno, error) {
            const stack = error && error.stack ? error.stack : '';
            self._addToBuffer({
                level: 'error',
                type: 'uncaught',
                message: String(message),
                source: source || '',
                line: lineno || 0,
                col: colno || 0,
                stack: stack.slice(0, 1000),
                pageUrl: self._pageUrl,
                ts: new Date().toISOString()
            });
        };

        // 未处理的 Promise 拒绝
        window.addEventListener('unhandledrejection', function (event) {
            let message;
            let stack = '';
            if (event.reason instanceof Error) {
                message = event.reason.message;
                stack = event.reason.stack || '';
            } else {
                message = String(event.reason);
            }
            self._addToBuffer({
                level: 'error',
                type: 'unhandledrejection',
                message: message.slice(0, 500),
                stack: stack.slice(0, 1000),
                pageUrl: self._pageUrl,
                ts: new Date().toISOString()
            });
        });

        // 资源加载失败
        window.addEventListener(
            'error',
            function (event) {
                // 只处理元素事件（图片、脚本等资源加载失败）
                if (
                    event.target &&
                    (event.target instanceof HTMLImageElement ||
                        event.target instanceof HTMLScriptElement ||
                        event.target instanceof HTMLLinkElement ||
                        event.target instanceof HTMLIFrameElement)
                ) {
                    const el = event.target;
                    self._addToBuffer({
                        level: 'error',
                        type: 'resource',
                        message: '资源加载失败: ' + (el.tagName || 'unknown'),
                        source: el.src || el.href || '',
                        pageUrl: self._pageUrl,
                        ts: new Date().toISOString()
                    });
                }
            },
            true
        );
    },

    /**
     * 页面关闭前上报剩余日志
     */
    _captureUnload() {
        const self = this;
        const sendRemaining = () => {
            if (self._buffer.length > 0 && self.config.enabled) {
                const logs = self._buffer.splice(0);
                const baseUrl = self._getBaseUrl ? self._getBaseUrl() : (window.__API_BASE__ || localStorage.getItem('ks_api_base') || 'https://a.mutx.ccwu.cc');
                navigator.sendBeacon(
                    `${baseUrl}/api/logs`,
                    JSON.stringify({ logs, deviceId: self._deviceId })
                );
            }
        };

        window.addEventListener('beforeunload', sendRemaining);
        window.addEventListener('pagehide', sendRemaining);
    },

    /**
     * 捕获控制台调用
     */
    _capture(level, args) {
        if (!this.config.enabled) return;

        // 如果是 log/info/debug 级别且设置了仅 warn+，则跳过
        if (this.config.warnOnly && (level === 'log' || level === 'info' || level === 'debug')) {
            return;
        }

        // 如果是 LogCollector 自身产生的日志，不捕获，避免死循环
        if (this._isOwnLog(args)) return;

        // 序列化参数
        const message = this._formatArgs(args);

        // 从实际 Error 对象中提取堆栈（仅 error 级别，避免昂贵的 new Error()）
        let stack = '';
        if (level === 'error') {
            for (const a of args) {
                if (a instanceof Error && a.stack) {
                    stack = a.stack.slice(0, 1000);
                    break;
                }
            }
        }

        this._addToBuffer({
            level,
            type: 'console',
            message: message.slice(0, 500),
            stack,
            pageUrl: this._pageUrl,
            ts: new Date().toISOString()
        });
    },

    /**
     * 检查是否是 LogCollector 自身输出的日志
     */
    _isOwnLog(args) {
        if (args.length === 0) return false;
        const first = String(args[0]);
        return first.startsWith('[LogCollector]');
    },

    /**
     * 将参数序列化为字符串
     */
    _formatArgs(args) {
        try {
            return args
                .map((a) => {
                    if (a === null) return 'null';
                    if (a === undefined) return 'undefined';
                    if (a instanceof Error) return a.message;
                    if (typeof a === 'object') {
                        try {
                            return JSON.stringify(a);
                        } catch {
                            return String(a);
                        }
                    }
                    return String(a);
                })
                .join(' ');
        } catch {
            return '无法序列化日志参数';
        }
    },

    /**
     * 添加日志到缓冲区，达到阈值时自动上报
     */
    _addToBuffer(entry) {
        if (!this.config.enabled) return;

        this._buffer.push(entry);

        // 限制缓冲区大小
        if (this._buffer.length > this.config.maxBufferSize) {
            this._buffer.shift();
        }

        // 累积到一定数量立即上报
        if (this._buffer.length >= 10) {
            this.flush();
        }
    },

    /**
     * 启动定时刷新
     */
    _startAutoFlush() {
        const self = this;
        this._flushTimer = setInterval(() => {
            self.flush();
        }, this.config.flushInterval);
    },

    /**
     * 上报日志到服务端
     */
    async flush() {
        if (this._buffer.length === 0 || !this.config.enabled) return;

        // 速率限制
        if (this._rateCount >= this.config.rateLimit) {
            // 超出限制，丢弃
            this._buffer = [];
            return;
        }

        const logs = this._buffer.splice(0);
        const remaining = this.config.rateLimit - this._rateCount;
        const batch = logs.slice(0, Math.min(logs.length, remaining));
        this._rateCount += batch.length;

        try {
            const payload = JSON.stringify({ logs: batch, deviceId: this._deviceId });
            await fetch(`${this._getBaseUrl()}/api/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                // 不关心的响应，fire-and-forget
                keepalive: true
            });
        } catch {
            // 上报失败不产生新日志，直接放回缓冲区
            this._buffer = [...batch, ...this._buffer].slice(0, this.config.maxBufferSize);
            // 自身日志不上报
        }
    },

    /**
     * 获取缓冲区中的日志（用于调试）
     */
    getBuffer() {
        return [...this._buffer];
    },

    /**
     * 向管理后台发送一条手动反馈/错误报告
     * @param {string} type - 反馈类型
     * @param {string} message - 反馈内容
     * @param {string} [extra] - 额外信息
     */
    async report(type, message, extra = '') {
        if (!this.config.enabled) return;

        const entry = {
            level: 'error',
            type: 'user_report',
            reportType: type,
            message: String(message).slice(0, 1000),
            extra: String(extra).slice(0, 2000),
            pageUrl: this._pageUrl,
            ua: navigator.userAgent || '',
            ts: new Date().toISOString()
        };

        try {
            await fetch(`${this._getBaseUrl()}/api/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: [entry], deviceId: this._deviceId })
            });
        } catch {
            // 静默失败
        }
    }
};

// 自动初始化（在 DOMContentLoaded 之前尽早执行）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LogCollector.init());
} else {
    LogCollector.init();
}

window.LogCollector = LogCollector;
export default LogCollector;
