/**
 * 工具函数模块
 */

const Utils = {
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
        } catch (e) {
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
            placeholders.push(`<pre><code class="language-${language}">${escapedCode}</code></pre>`);
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
            placeholders.push(`<div class="math-block" data-formula="${this.escapeHtml(formula.trim())}"></div>`);
            return `%%PH${id}%%`;
        });

        // 提取行内数学公式 ($...$)
        html = html.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
            const id = placeholders.length;
            placeholders.push(`<span class="math-inline" data-formula="${this.escapeHtml(formula.trim())}"></span>`);
            return `%%PH${id}%%`;
        });

        // 转义普通文本中的 HTML
        html = this.escapeHtml(html);

        // 还原占位符
        html = html.replace(/%%PH(\d+)%%/g, (match, id) => {
            return placeholders[parseInt(id)];
        });

        // 换行
        html = html.replace(/\n/g, '<br>');

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
        return String(text).replace(/[&<>"']/g, c => map[c]);
    },

    /**
     * 渲染数学公式
     */
    renderMath(container) {
        if (!window.katex) return;

        // 渲染行内公式
        container.querySelectorAll('.math-inline').forEach(el => {
            const formula = el.dataset.formula;
            if (formula) {
                try {
                    katex.render(formula, el, {
                        throwOnError: false,
                        displayMode: false
                    });
                } catch (e) {
                    el.textContent = formula;
                    console.error('KaTeX render error:', e);
                }
            }
        });

        // 渲染块级公式
        container.querySelectorAll('.math-block').forEach(el => {
            const formula = el.dataset.formula;
            if (formula) {
                try {
                    katex.render(formula, el, {
                        throwOnError: false,
                        displayMode: true
                    });
                } catch (e) {
                    el.textContent = formula;
                    console.error('KaTeX render error:', e);
                }
            }
        });
    },

    /**
     * 高亮代码块
     */
    highlightCode(container) {
        if (!window.Prism) return;

        container.querySelectorAll('pre code').forEach(el => {
            Prism.highlightElement(el);
        });
    },

    /**
     * 显示Toast提示
     */
    showToast(message, type = 'info', duration = 3000) {
        // 移除现有的toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * 显示确认对话框
     */
    showConfirm(message, title = '确认') {
        return new Promise((resolve) => {
            const confirmed = window.confirm(message);
            resolve(confirmed);
        });
    },

    /**
     * 复制文本到剪贴板
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('已复制到剪贴板', 'success');
            return true;
        } catch (e) {
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
                } catch (err) {
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
            code: '编程题'
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
        return '★'.repeat(level) + '☆'.repeat(5 - level);
    },

    /**
     * 本地存储键名生成
     */
    getStorageKey(...parts) {
        return ['quiz_app', ...parts].join('_');
    }
};

// 导出
window.Utils = Utils;
export default Utils;
