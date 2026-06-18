/**
 * 工具函数模块
 */

const Utils = {
    /**
     * 创建 Lucide 图标 HTML
     * @param {string} name - 图标名称
     * @param {string} [extraClass] - 额外 CSS 类
     * @returns {string} 图标 HTML
     */
    icon(name, extraClass = '') {
        if (typeof lucide === 'undefined') {
            // Lucide 未加载时返回空字符串
            return '';
        }
        return `<i data-lucide="${name}" class="icon ${extraClass}"></i>`;
    },

    /**
     * 初始化页面上的 Lucide 图标
     */
    initIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * 安全转义字符串，用于 onclick="handler('VALUE')" 上下文
     * 同时保护 HTML 属性边界和 JS 字符串字面量
     * @param {string} str - 原始用户输入
     * @returns {string} 安全字符串
     */
    jsSafe(str) {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\u0022')
            .replace(/&/g, '\\u0026')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    },
    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * 防抖函数
     */
    debounce(fn, delay = 300) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * 节流函数
     */
    throttle(fn, delay = 100) {
        let lastTime = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastTime >= delay) {
                lastTime = now;
                fn.apply(this, args);
            }
        };
    },

    /**
     * 深拷贝
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch {
            return obj;
        }
    },

    /**
     * 格式化日期
     */
    formatDate(date, format = 'YYYY-MM-DD HH:mm') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    /**
     * 格式化相对时间（例如：刚刚，5分钟前，1小时前，1天前）
     */
    formatRelativeTime(dateStr) {
        if (!dateStr) return '未知';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return '刚刚';
        if (diffMin < 60) return `${diffMin}分钟前`;
        if (diffHour < 24) return `${diffHour}小时前`;
        if (diffDay < 7) return `${diffDay}天前`;
        return date.toLocaleDateString();
    },

    /**
     * 格式化数字（添加千位分隔符）
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * 计算百分比
     */
    percentage(part, total) {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    },

    /**
     * 随机打乱数组
     */
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    },

    /**
     * 解析Markdown风格的文本
     * 支持代码块、行内代码、数学公式等
     * 安全策略：先提取特殊区块，再转义普通文本，最后还原区块
     */
    parseMarkdown(text) {
        if (!text) return '';

        let html = text;
        const placeholders = [];

        // 提取代码块 (```...```) 并用占位符替换
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const escapedCode = this.escapeHtml(code.trim());
            const id = placeholders.length;
            placeholders.push(
                `<pre><code class="language-${language}">${escapedCode}</code></pre>`
            );
            return `%%PH${id}%%`;
        });

        // 提取行内代码 (`...`)
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            const id = placeholders.length;
            placeholders.push(`<code>${this.escapeHtml(code)}</code>`);
            return `%%PH${id}%%`;
        });

        // 提取数学公式块 ($$...$$)
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const id = placeholders.length;
            placeholders.push(
                `<div class="math-block" data-formula="${this.escapeHtml(formula.trim())}"></div>`
            );
            return `%%PH${id}%%`;
        });

        // 提取行内数学公式 ($...$)
        html = html.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
            const id = placeholders.length;
            placeholders.push(
                `<span class="math-inline" data-formula="${this.escapeHtml(formula.trim())}"></span>`
            );
            return `%%PH${id}%%`;
        });

        // 提取图片 (![alt](url))
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            const id = placeholders.length;
            placeholders.push(
                `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img src="${this.escapeHtml(url.trim())}" alt="${this.escapeHtml(alt)}" class="markdown-image" loading="lazy" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>`
            );
            return `%%PH${id}%%`;
        });

        // 转义普通文本中的 HTML
        html = this.escapeHtml(html);

        // 换行（先处理普通文本的换行，再还原占位符，避免代码块里的\n被转成<br>）
        html = html.replace(/\n/g, '<br>');

        // 还原占位符
        html = html.replace(/%%PH(\d+)%%/g, (match, id) => {
            return placeholders[parseInt(id)];
        });

        // 加粗 (**...**) — 需要在转义后匹配
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // 斜体 (*...*)
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        return html;
    },

    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(text).replace(/[&<>"']/g, (c) => map[c]);
    },

    /**
     * 应用字体大小设置，按比例缩放所有字体变量
     * @param {number} size - 基础字体大小（px）
     */
    applyFontSize(size) {
        const root = document.documentElement.style;
        const base = size || 16;
        root.setProperty('--font-size-base', base + 'px');
        root.setProperty('--font-size-xs', Math.round(base * 0.75) + 'px');
        root.setProperty('--font-size-sm', Math.round(base * 0.8125) + 'px');
        root.setProperty('--font-size-lg', Math.round(base * 0.9375) + 'px');
        root.setProperty('--font-size-xl', Math.round(base * 1.125) + 'px');
        root.setProperty('--font-size-2xl', Math.round(base * 1.5) + 'px');
        root.setProperty('--font-size-3xl', Math.round(base * 1.75) + 'px');
    },

    /**
     * 更新浏览器地址栏/底栏主题色以适配当前网页
     */
    updateBrowserThemeColor() {
        try {
            // 获取当前页面计算后的 --bg-card 颜色值（底栏/卡片背景色）
            const bgCard = window
                .getComputedStyle(document.documentElement)
                .getPropertyValue('--bg-card')
                .trim();
            const meta = document.getElementById('meta-theme-color');
            if (meta && bgCard) {
                meta.setAttribute('content', bgCard);
            }
        } catch (e) {
            console.warn('[Utils] 更新浏览器主题色失败:', e.message);
        }
    },

    /**
     * 渲染数学公式
     */
    renderMath(container) {
        if (!container) return;
        try {
            if (typeof window.katex === 'undefined' || !window.katex) return;

            container.querySelectorAll('.math-inline').forEach((el) => {
                const formula = el.dataset.formula;
                if (formula) {
                    try {
                        katex.render(formula, el, {
                            throwOnError: false,
                            displayMode: false
                        });
                    } catch (e) {
                        el.textContent = formula;
                        console.warn('KaTeX inline render error:', e.message);
                    }
                }
            });

            container.querySelectorAll('.math-block').forEach((el) => {
                const formula = el.dataset.formula;
                if (formula) {
                    try {
                        katex.render(formula, el, {
                            throwOnError: false,
                            displayMode: true
                        });
                    } catch (e) {
                        el.textContent = formula;
                        console.warn('KaTeX block render error:', e.message);
                    }
                }
            });
        } catch (e) {
            console.warn('renderMath error:', e.message);
        }
    },

    /**
     * 高亮代码块
     */
    highlightCode(container) {
        if (!container) return;
        try {
            if (typeof window.Prism === 'undefined' || !window.Prism) return;

            container.querySelectorAll('pre code').forEach((el) => {
                try {
                    Prism.highlightElement(el);
                } catch (e) {
                    console.warn('Prism highlight error:', e.message);
                }
            });
        } catch (e) {
            console.warn('highlightCode error:', e.message);
        }
    },

    /**
     * 显示Toast提示
     */
    showToast(message, type = 'info', duration = 3000) {
        // 1. 移除现有的toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // 2. 创建 Toast 容器
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // 3. 自动映射不同类型对应的图标
        const iconMap = {
            success: 'check-circle',
            error: 'alert-triangle',
            warning: 'alert-circle',
            info: 'info'
        };
        const defaultIcon = iconMap[type] || 'info';
        
        // 4. 健壮的“双重图标判定”：判断调用者传入的 message 是否已经包含定制图标
        const hasIcon = message.includes('data-lucide') || message.includes('<svg') || message.includes('class="icon"');
        
        if (hasIcon) {
            toast.innerHTML = `<div class="toast-content">${message}</div>`;
        } else {
            const iconHtml = this.icon(defaultIcon, `toast-icon toast-icon-${type}`);
            toast.innerHTML = `${iconHtml}<div class="toast-content">${message}</div>`;
        }
        
        // 5. 渲染进入 DOM 并渲染图标
        document.body.appendChild(toast);
        this.initIcons();

        // 6. 自动移除定时器与平滑切出过渡
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    },

    /**
     * 复制文本到剪贴板
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('已复制到剪贴板', 'success');
            return true;
        } catch {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('已复制到剪贴板', 'success');
            return true;
        }
    },

    /**
     * 下载JSON文件
     */
    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * 选择文件
     */
    pickFile(accept = '*') {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = () => resolve(input.files[0] || null);
            input.click();
        });
    },

    /**
     * 读取JSON文件
     */
    readJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch {
                    reject(new Error('文件格式错误，请确保是有效的JSON文件'));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    },

    /**
     * 验证题库格式
     */
    validateBank(data) {
        const errors = [];

        if (!data.id) {
            errors.push('缺少题库ID (id)');
        }
        if (!data.name) {
            errors.push('缺少题库名称 (name)');
        }
        if (!data.questions || !Array.isArray(data.questions)) {
            errors.push('缺少题目列表 (questions)');
        } else {
            data.questions.forEach((q, index) => {
                if (!q.id) {
                    errors.push(`题目 ${index + 1}: 缺少ID`);
                }
                if (!q.type) {
                    errors.push(`题目 ${index + 1}: 缺少题型 (type)`);
                }
                if (!q.question) {
                    errors.push(`题目 ${index + 1}: 缺少题目内容 (question)`);
                }
                if (q.type === 'single' && (!q.options || q.options.length < 2)) {
                    errors.push(`题目 ${index + 1}: 单选题至少需要2个选项`);
                }
                if (q.type === 'multiple' && (!q.options || q.options.length < 2)) {
                    errors.push(`题目 ${index + 1}: 多选题至少需要2个选项`);
                }
                if (q.answer === undefined || q.answer === null) {
                    errors.push(`题目 ${index + 1}: 缺少答案 (answer)`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * 获取题型名称
     */
    getTypeName(type) {
        const typeNames = {
            single: '单选题',
            multiple: '多选题',
            judge: '判断题',
            fill: '填空题',
            code: '编程题',
            essay: '简答题'
        };
        return typeNames[type] || type;
    },

    /**
     * 获取难度文本
     */
    getDifficultyText(level) {
        const texts = ['', '简单', '中等', '困难', '很难', '极难'];
        return texts[level] || '';
    },

    /**
     * 获取难度星级
     */
    getDifficultyStars(level) {
        const filled = '<i data-lucide="star" class="icon filled"></i>'.repeat(level);
        const empty = '<i data-lucide="star" class="icon"></i>'.repeat(5 - level);
        return filled + empty;
    },

    /**
     * 本地存储键名生成
     */
    getStorageKey(...parts) {
        return ['quiz_app', ...parts].join('_');
    },

    /**
     * 通用模态框
     * @param {object} options
     * @param {string} options.title - 标题
     * @param {string} options.content - HTML 内容
     * @param {Array<{label: string, class?: string, onClick: Function}>} options.buttons - 按钮配置
     * @param {string} [options.size] - 尺寸：'sm' | 'md' | 'lg'
     * @returns {HTMLElement} 模态框元素
     */
    showModal({ title, content, buttons = [], size = 'md', closable = true, onClose }) {
        const id = 'modal-' + this.generateId();
        const sizeClass = size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : '';

        const buttonsHtml = buttons
            .map((btn, i) => {
                const cls = btn.class || (i === 0 ? 'btn-primary' : 'btn-secondary');
                return `<button class="btn ${cls}" data-modal-btn="${i}">${btn.label}</button>`;
            })
            .join('');

        const closeBtnHtml = closable
            ? '<button class="modal-close" data-modal-close aria-label="关闭">×</button>'
            : '';

        const modalHtml = `
            <div class="modal-overlay show" id="${id}">
                <div class="modal-content ${sizeClass}">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        ${closeBtnHtml}
                    </div>
                    <div class="modal-body">${content}</div>
                    <div class="modal-footer">${buttonsHtml}</div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        const overlay = div.firstElementChild;
        document.body.appendChild(overlay);
        this.initIcons();

        // 关闭处理
        const close = () => {
            overlay.remove();
            if (onClose) onClose();
        };

        // 绑定按钮事件
        buttons.forEach((btn, i) => {
            const btnEl = overlay.querySelector(`[data-modal-btn="${i}"]`);
            if (btnEl && btn.onClick) {
                btnEl.addEventListener('click', () => btn.onClick(overlay));
            }
        });

        // 关闭按钮（仅 closable 模式）
        if (closable) {
            const closeBtn = overlay.querySelector('[data-modal-close]');
            if (closeBtn) closeBtn.addEventListener('click', close);

            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });

            // Escape 键关闭
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEscape);
                    close();
                }
            };
            document.addEventListener('keydown', handleEscape);
        }

        return overlay;
    },

    // ==================== 网络状态检测 ====================

    _networkListeners: null,

    /**
     * 初始化网络状态监听
     * 在线时显示成功提示，离线时显示错误提示
     */
    initNetworkMonitor() {
        if (this._networkListeners) return;

        const onOnline = () => {
            this.showToast('网络已恢复', 'success', 3000);
            // 触发自定义事件，方便其他模块监听
            window.dispatchEvent(new CustomEvent('network-restored'));
        };

        const onOffline = () => {
            this.showToast('网络连接已断开，请检查网络后重试', 'error', 5000);
            // 触发自定义事件
            window.dispatchEvent(new CustomEvent('network-lost'));
        };

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        this._networkListeners = { onOnline, onOffline };
    },

    /**
     * 检查当前是否在线
     * @returns {boolean}
     */
    isOnline() {
        return navigator.onLine !== false;
    },

    /**
     * 显示网络错误提示（带重试按钮）
     * @param {string} message - 错误消息
     * @param {Function} onRetry - 重试回调
     */
    showNetworkError(message, onRetry) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-error toast-network';
        toast.innerHTML = `
            <div class="toast-content">
                <span>${this.escapeHtml(message)}</span>
                ${onRetry ? '<button class="btn btn-sm btn-retry" onclick="this.closest(\'.toast\').remove()">重试</button>' : ''}
            </div>
        `;

        if (onRetry) {
            toast.querySelector('.btn-retry')?.addEventListener('click', () => {
                onRetry();
            });
        }

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 8000);
    },

    /**
     * 初始化响应式双模导航栏
     */
    initNavigation() {
        // 老多页面自动重定向为 SPA 路由
        const currentFilename = window.location.pathname.split('/').pop() || 'index.html';
        const oldPages = ['leaderboard.html', 'analysis.html', 'trend.html'];
        if (oldPages.includes(currentFilename)) {
            const pageName = currentFilename.replace('.html', '');
            window.location.replace('index.html#/' + pageName);
            return;
        }

        // 全屏沉浸答题态时不渲染导航
        if (document.body.classList.contains('layout-fullscreen')) return;

        const hash = window.location.hash || '#/home';

        // 动态同步管理员权限状态
        const hasAdminPwd = !!localStorage.getItem('admin_pwd');
        const isAdmin = hasAdminPwd || localStorage.getItem('ks_is_admin') === '1';

        // 1. 桌面端顶部水平导航栏 DOM
        const headerHTML = `
            <header class="global-header">
                <div class="header-brand title-gradient">城科卷王</div>
                <nav class="desktop-nav">
                    <a href="#/home" class="${hash.includes('home') ? 'active' : ''}">首页</a>
                    <a href="#/leaderboard" class="${hash.includes('leaderboard') ? 'active' : ''}">排行榜</a>
                    <a href="#/analysis" class="${hash.includes('analysis') ? 'active' : ''}">学习分析</a>
                    <a href="#/trend" class="${hash.includes('trend') ? 'active' : ''}">答题趋势</a>
                    ${isAdmin ? '<a href="admin.html">管理后台</a>' : ''}
                </nav>
                <div class="header-actions">
                    <button class="btn btn-header btn-sm action-history-toggle" aria-label="答题历史" title="答题历史">
                        <i data-lucide="clipboard-list" class="icon"></i> <span>历史</span>
                    </button>
                    <div class="header-divider"></div>
                    <button class="btn btn-header-icon btn-sm action-sync-toggle" aria-label="多设备同步" title="多设备同步">
                        <i data-lucide="smartphone" class="icon"></i>
                    </button>
                    <button class="btn btn-header-icon btn-sm action-shortcuts-toggle" aria-label="快捷键" title="快捷键参考">
                        <i data-lucide="keyboard" class="icon"></i>
                    </button>
                    <button class="btn btn-header-icon btn-sm action-theme-toggle" aria-label="切换主题" title="切换主题">
                        <i data-lucide="sun-moon" class="icon"></i>
                    </button>
                    <button class="btn btn-header-icon btn-sm action-settings-toggle" aria-label="设置" title="设置">
                        <i data-lucide="settings" class="icon"></i>
                    </button>
                </div>
            </header>
        `;

        // 2. 移动端底部固定标签栏 DOM (全面屏安全区自适应)
        const tabbarHTML = `
            <nav class="global-tabbar">
                <a href="#/home" class="tabbar-item ${hash.includes('home') ? 'active' : ''}">
                    <span class="label">首页</span>
                </a>
                <a href="#/leaderboard" class="tabbar-item ${hash.includes('leaderboard') ? 'active' : ''}">
                    <span class="label">排行</span>
                </a>
                <a href="#/analysis" class="tabbar-item ${hash.includes('analysis') ? 'active' : ''}">
                    <span class="label">分析</span>
                </a>
                <a href="#/trend" class="tabbar-item ${hash.includes('trend') ? 'active' : ''}">
                    <span class="label">趋势</span>
                </a>
            </nav>
        `;

        // 插入到 body (存在旧的则替换，支持动态状态重载)
        const oldHeader = document.querySelector('.global-header');
        if (oldHeader) {
            oldHeader.outerHTML = headerHTML;
        } else {
            document.body.insertAdjacentHTML('afterbegin', headerHTML);
        }

        const oldTabbar = document.querySelector('.global-tabbar');
        if (oldTabbar) {
            oldTabbar.outerHTML = tabbarHTML;
        } else {
            document.body.insertAdjacentHTML('beforeend', tabbarHTML);
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
};

/**
 * 轻量级原生 Hash 路由器
 */
const Router = {
    routes: {
        home: () => {
            if (window.App && typeof window.App.loadData === 'function') {
                window.App.loadData();
                if (typeof window.App.render === 'function') {
                    window.App.render();
                }
            }
        },
        leaderboard: () => {
            if (window.LB && typeof window.LB.init === 'function') {
                window.LB.init();
            }
        },
        analysis: () => {
            if (window.Insights && typeof window.Insights.init === 'function') {
                window.Insights.init('analysis');
            }
        },
        trend: () => {
            if (window.Insights && typeof window.Insights.init === 'function') {
                window.Insights.init('trend');
            }
        }
    },

    init() {
        // 全屏模式下不加载路由控制
        if (document.body.classList.contains('layout-fullscreen')) return;

        window.addEventListener('hashchange', () => this.handleRouting());
        window.addEventListener('load', () => this.handleRouting());

        // 设备锁屏/切后台唤醒：静默云同步并刷新数据
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // 静默云同步（不显示加载状态）
                if (typeof API !== 'undefined' && API.autoSync) {
                    API.autoSync().then(() => {
                        // 同步完成后静默刷新数据和视图
                        if (typeof App !== 'undefined') {
                            if (App.loadData) App.loadData();
                            if (App.render) App.render();
                        }
                    }).catch(() => {});
                }
            }
        });
    },

    handleRouting() {
        if (document.body.classList.contains('layout-fullscreen')) return;

        const hash = window.location.hash || '#/home';
        const route = hash.replace('#/', '') || 'home';

        const validRoutes = ['home', 'leaderboard', 'analysis', 'trend'];
        if (!validRoutes.includes(route)) return;

        // 1. 切换包装显隐
        document.querySelectorAll('.view-wrapper').forEach((el) => {
            el.classList.toggle('active', el.id === `${route}-view`);
        });

        // 2. 更新高亮
        document.querySelectorAll('.desktop-nav a, .global-tabbar a').forEach((a) => {
            const href = a.getAttribute('href');
            a.classList.toggle('active', href.includes(route));
        });

        // 3. 执行渲染生命周期
        if (this.routes[route]) {
            this.routes[route]();
        }
    }
};

window.Router = Router;

// 自动初始化导航、路由和浏览器主题色
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Utils.initNavigation();
        Router.init();
        setTimeout(() => Utils.updateBrowserThemeColor(), 100);
    });
} else {
    Utils.initNavigation();
    Router.init();
    setTimeout(() => Utils.updateBrowserThemeColor(), 100);
}

// 监听系统主题变化，自动刷新浏览器地址栏/底栏颜色
try {
    const mediaQueryDark = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSchemeChange = () => {
        setTimeout(() => Utils.updateBrowserThemeColor(), 150);
    };
    mediaQueryDark.addEventListener('change', handleSchemeChange);
} catch (e) {
    console.warn('[Utils] 无法为 prefers-color-scheme 添加监听:', e.message);
}

// 跨标签页实时同步主题设置
window.addEventListener('storage', (e) => {
    if (e.key === 'quiz_settings') {
        try {
            const settings = JSON.parse(e.newValue || '{}');
            const theme = settings.theme || 'auto';
            const colorScheme = settings.colorScheme || 'parchment';
            
            if (theme === 'auto') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            
            if (colorScheme === 'parchment') {
                document.documentElement.removeAttribute('data-color');
            } else {
                document.documentElement.setAttribute('data-color', colorScheme);
            }
            Utils.updateBrowserThemeColor();
        } catch (err) {
            console.error('Failed to sync theme from storage event:', err);
        }
    }
});

// 导出
window.Utils = Utils;
export default Utils;
