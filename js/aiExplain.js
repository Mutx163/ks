/**
 * 网页内 AI 解读
 * - 公共配置来自 Worker，不暴露后台全局密钥
 * - 用户覆盖配置只保存在当前浏览器 localStorage，不同步到云端
 * - 流式解读通过 Worker 代理，避免暴露后台密钥
 */

import API from './api.js';
import Utils from './utils.js';

const LOCAL_KEY = 'quiz_ai_explain_local';

const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'search',
    provider: 'openai',
    baseUrl: '',
    model: '',
    allowUserOverride: false,
    hasGlobalKey: false
};

const PROVIDERS = {
    openai: {
        label: 'OpenAI 兼容',
        baseUrlPlaceholder: 'https://api.openai.com/v1',
        modelPlaceholder: 'gpt-4o-mini / deepseek-chat'
    },
    gemini: {
        label: 'Gemini API',
        baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
        modelPlaceholder: 'gemini-1.5-flash'
    }
};

const AIExplain = {
    _config: { ...DEFAULT_CONFIG },
    _loaded: false,
    _cache: new Map(), // questionId → { answer, think, hadThink }

    async init({ force = false } = {}) {
        if (this._loaded && !force) return this._config;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const data = await API.request('/api/ai/config', { signal: controller.signal });
            if (data?.ok && data.config) {
                this._config = this.normalizePublicConfig(data.config);
            }
        } catch (e) {
            console.warn('[AIExplain] 获取公共配置失败，使用默认搜索模式:', e.message);
        } finally {
            clearTimeout(timer);
            this._loaded = true;
        }

        return this._config;
    },

    normalizePublicConfig(config = {}) {
        const provider = PROVIDERS[config.provider] ? config.provider : DEFAULT_CONFIG.provider;
        const mode = config.mode === 'inpage' ? 'inpage' : 'search';
        return {
            ...DEFAULT_CONFIG,
            ...config,
            enabled: config.enabled !== false,
            mode,
            provider,
            allowUserOverride: config.allowUserOverride === true,
            hasGlobalKey: config.hasGlobalKey === true,
            baseUrl: String(config.baseUrl || ''),
            model: String(config.model || '')
        };
    },

    getConfig() {
        const base = this._config || DEFAULT_CONFIG;
        // 用户本地设置的 mode 可以覆盖服务端配置
        try {
            const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
            if (raw.mode === 'inpage' || raw.mode === 'search') {
                return { ...base, mode: raw.mode };
            }
        } catch {
            /* ignore */
        }
        return base;
    },

    isEnabled() {
        return this.getConfig().enabled !== false;
    },

    isInPageMode() {
        const config = this.getConfig();
        return config.enabled !== false && config.mode === 'inpage';
    },

    getLocalSettings() {
        try {
            const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
            const provider = PROVIDERS[raw.provider] ? raw.provider : 'openai';
            const mode = raw.mode === 'inpage' || raw.mode === 'search' ? raw.mode : '';
            return {
                mode,
                useOverride: raw.useOverride === true,
                provider,
                baseUrl: String(raw.baseUrl || ''),
                model: String(raw.model || ''),
                apiKey: String(raw.apiKey || '')
            };
        } catch {
            return {
                mode: '',
                useOverride: false,
                provider: 'openai',
                baseUrl: '',
                model: '',
                apiKey: ''
            };
        }
    },

    saveLocalSettings(settings) {
        const provider = PROVIDERS[settings.provider] ? settings.provider : 'openai';
        const mode =
            settings.mode === 'inpage' || settings.mode === 'search' ? settings.mode : undefined;
        const data = {
            useOverride: settings.useOverride === true,
            provider,
            baseUrl: String(settings.baseUrl || '').trim(),
            model: String(settings.model || '').trim(),
            apiKey: String(settings.apiKey || '').trim()
        };
        if (mode) data.mode = mode;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
        return data;
    },

    _providerOptions(selected) {
        return Object.entries(PROVIDERS)
            .map(
                ([id, provider]) =>
                    `<option value="${id}" ${selected === id ? 'selected' : ''}>${Utils.escapeHtml(provider.label)}</option>`
            )
            .join('');
    },

    renderSettingsFields() {
        const config = this.getConfig();
        const local = this.getLocalSettings();
        const provider = PROVIDERS[local.provider] || PROVIDERS.openai;
        const effectiveMode = local.mode || config.mode;
        const adminProvider = PROVIDERS[config.provider]?.label || config.provider;

        if (!config.enabled) {
            return `
                <div class="ai-explain-settings disabled">
                    <div class="ai-explain-settings-title">网页内 AI 解读</div>
                    <p>管理员已关闭 AI 解读功能，题目页不会显示 AI 按钮，也无法调用解读接口。</p>
                </div>
            `;
        }

        return `
            <div class="ai-explain-settings" id="ai-explain-settings">
                <div class="ai-explain-settings-title">AI 解读设置</div>
                <label>AI 按钮行为</label>
                <select id="ai-explain-mode">
                    <option value="inpage" ${effectiveMode === 'inpage' ? 'selected' : ''}>应用内 AI 解读（流式生成）</option>
                    <option value="search" ${effectiveMode === 'search' ? 'selected' : ''}>AI 搜索引擎（跳转外部）</option>
                </select>
                <div id="ai-explain-inpage-section" style="display:${effectiveMode === 'inpage' ? 'block' : 'none'}">
                    <div class="ai-explain-status-grid">
                        <div><span>后台引擎</span><strong>${Utils.escapeHtml(adminProvider)}</strong></div>
                        <div><span>后台密钥</span><strong>${config.hasGlobalKey ? '已配置' : '未配置'}</strong></div>
                    </div>
                    ${
                        config.allowUserOverride
                            ? `
                    <label class="toggle-label ai-explain-override-toggle">
                        <input type="checkbox" id="ai-explain-use-override" ${local.useOverride ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                        <span>使用我自己的 API 配置</span>
                    </label>
                    <div class="ai-explain-override-fields" id="ai-explain-override-fields" style="display:${local.useOverride ? 'block' : 'none'}">
                        <label>协议</label>
                        <select id="ai-explain-provider">
                            ${this._providerOptions(local.provider)}
                        </select>
                        <label>Base URL</label>
                        <input type="text" id="ai-explain-base-url" placeholder="${Utils.escapeHtml(provider.baseUrlPlaceholder)}" value="${Utils.escapeHtml(local.baseUrl)}">
                        <label>模型</label>
                        <input type="text" id="ai-explain-model" placeholder="${Utils.escapeHtml(provider.modelPlaceholder)}" value="${Utils.escapeHtml(local.model)}">
                        <label>API 密钥</label>
                        <input type="password" id="ai-explain-api-key" placeholder="只保存在当前浏览器本地" value="${Utils.escapeHtml(local.apiKey)}">
                        <p class="ai-explain-warning">注意：用户自己的 API 密钥会保存在本机浏览器 localStorage，不会同步到云端；但同一浏览器环境中的前端脚本可读取它。</p>
                    </div>
                `
                            : '<p class="ai-explain-note">管理员未开放用户自定义 API，网页内解读将使用后台统一配置。</p>'
                    }
                </div>
                <div id="ai-explain-search-section" style="display:${effectiveMode === 'search' ? 'block' : 'none'}">
                    <p class="ai-explain-note">点击题目 AI 按钮会打开你上方设置的 AI 搜索引擎。</p>
                </div>
            </div>
        `;
    },

    bindSettingsUI(modal) {
        if (!modal) return;
        const modeSelect = modal.querySelector('#ai-explain-mode');
        const inpageSection = modal.querySelector('#ai-explain-inpage-section');
        const searchSection = modal.querySelector('#ai-explain-search-section');
        const toggle = modal.querySelector('#ai-explain-use-override');
        const fields = modal.querySelector('#ai-explain-override-fields');
        const providerSelect = modal.querySelector('#ai-explain-provider');
        const baseUrl = modal.querySelector('#ai-explain-base-url');
        const model = modal.querySelector('#ai-explain-model');

        modeSelect?.addEventListener('change', () => {
            const isInpage = modeSelect.value === 'inpage';
            if (inpageSection) inpageSection.style.display = isInpage ? 'block' : 'none';
            if (searchSection) searchSection.style.display = isInpage ? 'none' : 'block';
        });

        toggle?.addEventListener('change', () => {
            if (fields) fields.style.display = toggle.checked ? 'block' : 'none';
        });

        providerSelect?.addEventListener('change', () => {
            const provider = PROVIDERS[providerSelect.value] || PROVIDERS.openai;
            if (baseUrl) baseUrl.placeholder = provider.baseUrlPlaceholder;
            if (model) model.placeholder = provider.modelPlaceholder;
        });
    },

    saveSettingsFromModal(modal) {
        if (!modal || !modal.querySelector('#ai-explain-settings')) return null;
        const config = this.getConfig();
        if (!config.enabled) return null;

        const mode = modal.querySelector('#ai-explain-mode')?.value || 'search';
        const useOverride = modal.querySelector('#ai-explain-use-override')?.checked || false;
        const provider = modal.querySelector('#ai-explain-provider')?.value || 'openai';
        const baseUrl = modal.querySelector('#ai-explain-base-url')?.value || '';
        const model = modal.querySelector('#ai-explain-model')?.value || '';
        const apiKey = modal.querySelector('#ai-explain-api-key')?.value || '';

        return this.saveLocalSettings({ mode, useOverride, provider, baseUrl, model, apiKey });
    },

    getRequestOverride() {
        const config = this.getConfig();
        const local = this.getLocalSettings();
        if (!config.allowUserOverride || !local.useOverride) return null;
        return {
            provider: local.provider,
            baseUrl: local.baseUrl,
            model: local.model,
            apiKey: local.apiKey
        };
    },

    _cleanQuestionText(text = '') {
        return String(text)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * 去掉选项文本开头已有的字母前缀，如 "A. G24" → "G24"，"B.G25" → "G25"
     */
    _stripLetterPrefix(text) {
        return String(text)
            .replace(/^[A-Z][.、．\s]+/, '')
            .trim();
    },

    buildQuestionPayload({ question, bank, userAnswer, isCorrect: _isCorrect, displayOptions }) {
        const qText = this._cleanQuestionText(question.question || '');
        const optList =
            displayOptions && displayOptions.length > 0
                ? displayOptions
                : (question.options || []).map((o, i) => ({
                      displayLetter: String.fromCharCode(65 + i),
                      text: typeof o === 'object' ? o.text : o
                  }));
        const opts = optList
            .map((o) => `${o.displayLetter}. ${this._stripLetterPrefix(o.text)}`)
            .join('\n');
        let fullQuestion = qText;
        if (opts) fullQuestion += '\n' + opts;
        if (question.code)
            fullQuestion +=
                '\n```' + (question.codeLanguage || '') + '\n' + question.code + '\n```';

        const type = question.type || 'single';

        // 格式化学生作答，附带选项内容
        if (userAnswer !== undefined && userAnswer !== null) {
            let answerDisplay;

            if (type === 'single' && typeof userAnswer === 'string' && /^[A-Z]$/.test(userAnswer)) {
                const opt = optList.find((o) => o.displayLetter === userAnswer);
                answerDisplay = opt
                    ? `${userAnswer}. ${this._stripLetterPrefix(opt.text)}`
                    : userAnswer;
            } else if (type === 'multiple' && Array.isArray(userAnswer)) {
                answerDisplay = userAnswer
                    .map((letter) => {
                        const opt = optList.find((o) => o.displayLetter === letter);
                        return opt ? `${letter}. ${this._stripLetterPrefix(opt.text)}` : letter;
                    })
                    .join('、');
            } else if (type === 'judge') {
                answerDisplay = userAnswer === true ? '正确' : '错误';
            } else {
                answerDisplay = String(userAnswer);
            }
            fullQuestion += `\n学生作答：${answerDisplay}`;
        }

        // 格式化正确答案，附带选项内容
        const correctAnswer = question.answer;
        if (correctAnswer !== undefined && correctAnswer !== null) {
            let correctDisplay;

            if (
                type === 'single' &&
                typeof correctAnswer === 'string' &&
                /^[A-Z]$/.test(correctAnswer)
            ) {
                const opt = optList.find((o) => o.displayLetter === correctAnswer);
                correctDisplay = opt
                    ? `${correctAnswer}. ${this._stripLetterPrefix(opt.text)}`
                    : correctAnswer;
            } else if (type === 'multiple' && Array.isArray(correctAnswer)) {
                correctDisplay = correctAnswer
                    .map((letter) => {
                        const opt = optList.find((o) => o.displayLetter === letter);
                        return opt ? `${letter}. ${this._stripLetterPrefix(opt.text)}` : letter;
                    })
                    .join('、');
            } else if (type === 'judge') {
                correctDisplay = correctAnswer === true ? '正确' : '错误';
            } else {
                correctDisplay = String(correctAnswer);
            }
            fullQuestion += `\n正确答案：${correctDisplay}`;
        }

        // 附带解析
        if (question.explanation) {
            fullQuestion += `\n参考解析：${question.explanation}`;
        }

        return {
            question: fullQuestion,
            bankName: bank?.name || ''
        };
    },

    /**
     * 将原始 Markdown 文本渲染为 HTML（数学公式 + 代码高亮 + Markdown）
     */
    _renderMarkdown(target, rawText) {
        // 1. 保护数学公式，避免被 marked 解析破坏
        const mathBlocks = [];
        let text = rawText;
        // 块级公式 $$...$$
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
            mathBlocks.push({ tex: tex.trim(), display: true });
            return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
        });
        // 行内公式 $...$
        text = text.replace(/\$([^\n$]*?)\$/g, (_, tex) => {
            mathBlocks.push({ tex: tex.trim(), display: false });
            return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
        });

        // 2. Markdown → HTML
        let html;
        try {
            const m = globalThis.marked;
            const parse = typeof m === 'function' ? m : m?.parse;
            if (typeof parse === 'function') {
                html = parse(text, { breaks: true, gfm: true });
            } else {
                html = this._fallbackMarkdown(text);
            }
        } catch {
            html = this._fallbackMarkdown(text);
        }

        // 3. 恢复并渲染数学公式
        html = html.replace(/%%MATH_BLOCK_(\d+)%%/g, (_, idx) => {
            const m = mathBlocks[Number(idx)];
            if (!m) return '';
            try {
                if (typeof katex !== 'undefined') {
                    return katex.renderToString(m.tex, {
                        displayMode: m.display,
                        throwOnError: false,
                        output: 'htmlAndMathml'
                    });
                }
            } catch {
                /* fallback below */
            }
            return `<code class="math-fallback">${Utils.escapeHtml(m.tex)}</code>`;
        });

        // 4. 写入 DOM
        target.innerHTML = html;

        // 5. 代码高亮（Prism.js）
        try {
            if (typeof Prism !== 'undefined') {
                target.querySelectorAll('pre code').forEach((block) => {
                    Prism.highlightElement(block);
                });
            }
        } catch {
            /* ignore */
        }

        // 6. 自动滚动到底部
        target.scrollTop = target.scrollHeight;
    },

    /**
     * 简易 Markdown 兜底解析（marked 未加载时）
     */
    _fallbackMarkdown(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(
                /```(\w*)\n([\s\S]*?)```/g,
                (_, lang, code) =>
                    `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`
            )
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n{2,}/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    },

    _createModal(questionTitle = '') {
        document.querySelector('.ai-explain-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'ai-explain-overlay';
        overlay.innerHTML = `
            <div class="ai-explain-modal">
                <div class="ai-explain-modal-header">
                    <div>
                        <h3>AI 解读</h3>
                        <p>${Utils.escapeHtml(questionTitle || '正在分析当前题目')}</p>
                    </div>
                    <div class="ai-explain-header-actions">
                        <button class="ai-explain-regenerate" id="ai-explain-regenerate" type="button" title="重新生成" aria-label="重新生成">\u21bb</button>
                        <button class="ai-explain-close" type="button" aria-label="关闭">×</button>
                    </div>
                </div>
                <div class="ai-think-section" id="ai-think-section" style="display:none">
                    <div class="ai-think-header" id="ai-think-header">
                        <span class="ai-think-icon">💭</span>
                        <span class="ai-think-label">思考中...</span>
                        <button class="ai-think-toggle" id="ai-think-toggle" type="button" aria-label="展开/收起思考过程">▼</button>
                    </div>
                    <div class="ai-think-content" id="ai-think-content"></div>
                </div>
                <div class="ai-explain-output" id="ai-explain-output"></div>
                <div class="ai-explain-modal-footer">
                    <span class="ai-explain-stream-status" id="ai-explain-stream-status">准备中...</span>
                    <button class="btn btn-secondary btn-sm" type="button" id="ai-explain-cancel">停止</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.ai-explain-close')?.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });
        // 思考区域展开/收起
        const thinkHeader = overlay.querySelector('#ai-think-header');
        thinkHeader?.addEventListener('click', () => {
            const section = overlay.querySelector('#ai-think-section');
            section?.classList.toggle('collapsed');
        });
        return overlay;
    },

    /**
     * 渲染缓存内容到弹窗
     */
    _renderCached(overlay, cached) {
        const output = overlay.querySelector('#ai-explain-output');
        const status = overlay.querySelector('#ai-explain-stream-status');
        const thinkSection = overlay.querySelector('#ai-think-section');
        const thinkContent = overlay.querySelector('#ai-think-content');
        const thinkLabel = overlay.querySelector('.ai-think-label');
        const cancel = overlay.querySelector('#ai-explain-cancel');

        if (cached.think && thinkContent && thinkSection) {
            thinkSection.style.display = '';
            this._renderMarkdown(thinkContent, cached.think);
            if (thinkLabel) thinkLabel.textContent = '思考过程';
            thinkSection.classList.add('collapsed');
        }
        if (cached.answer) {
            this._renderMarkdown(output, cached.answer);
        }
        status.textContent = '完成 (缓存)';
        cancel.textContent = '关闭';
        cancel.onclick = () => overlay.remove();
    },

    async openExplanation({ question, bank, userAnswer, isCorrect, displayOptions }) {
        await this.init();
        const config = this.getConfig();
        if (!config.enabled) {
            Utils.showToast('管理员已关闭 AI 解读功能', 'error');
            return;
        }
        if (config.mode !== 'inpage') return false;

        const qId = question.id;
        const overlay = this._createModal(`第 ${qId || ''} 题`.trim());
        const cancel = overlay.querySelector('#ai-explain-cancel');
        const regenerateBtn = overlay.querySelector('#ai-explain-regenerate');

        // 存储当前controller，用于取消之前的请求
        let currentController = new AbortController();
        cancel?.addEventListener('click', () => currentController.abort());

        // 重新生成：取消之前的请求，清除缓存并重新请求
        const doFetch = () => {
            // 取消之前的请求
            if (currentController) {
                currentController.abort();
            }
            // 创建新的controller
            currentController = new AbortController();
            // 更新取消按钮的事件
            cancel.onclick = () => currentController.abort();

            // 禁用重新生成按钮防止重复点击
            if (regenerateBtn) {
                regenerateBtn.disabled = true;
                regenerateBtn.textContent = '生成中...';
            }

            this._cache.delete(qId);
            this._doFetchExplanation({
                overlay,
                question,
                bank,
                userAnswer,
                isCorrect,
                displayOptions,
                controller: currentController,
                qId,
                regenerateBtn
            });
        };
        regenerateBtn?.addEventListener('click', doFetch);

        // 有缓存则直接显示
        const cached = this._cache.get(qId);
        if (cached) {
            this._renderCached(overlay, cached);
            return true;
        }

        doFetch();
        return true;
    },

    async _doFetchExplanation({
        overlay,
        question,
        bank,
        userAnswer,
        isCorrect,
        displayOptions,
        controller,
        qId,
        regenerateBtn
    }) {
        const output = overlay.querySelector('#ai-explain-output');
        const status = overlay.querySelector('#ai-explain-stream-status');
        const cancel = overlay.querySelector('#ai-explain-cancel');

        // 清空之前的内容
        output.innerHTML = '';
        const thinkSection = overlay.querySelector('#ai-think-section');
        const thinkContent = overlay.querySelector('#ai-think-content');
        if (thinkSection) {
            thinkSection.style.display = 'none';
            thinkSection.classList.remove('collapsed');
        }
        if (thinkContent) thinkContent.innerHTML = '';

        cancel.textContent = '停止';
        cancel.onclick = () => controller.abort();

        try {
            status.textContent = '连接中...';
            const payload = {
                ...this.buildQuestionPayload({
                    question,
                    bank,
                    userAnswer,
                    isCorrect,
                    displayOptions
                }),
                override: this.getRequestOverride()
            };

            const res = await fetch(`${API.BASE_URL}/api/ai/explain`, {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!res.ok) {
                const text = await res.text();
                let message = text;
                try {
                    message = JSON.parse(text).error || text;
                } catch {
                    // keep raw text
                }
                throw new Error(message || `HTTP ${res.status}`);
            }

            if (!res.body) throw new Error('浏览器不支持流式响应');
            status.textContent = '生成中...';
            const reader = res.body.getReader();
            const decoder = new globalThis.TextDecoder();
            let gotAny = false;

            // 思考/回答分离状态
            const thinkLabel = overlay.querySelector('.ai-think-label');
            let thinkText = '';
            let answerText = '';
            let hadThink = false;
            let rawBuf = '';
            let renderTimer = null;

            const THINK_START = '\x00[THINK]\x00';
            const THINK_END = '\x00[/THINK]\x00';
            const THOUGHT_RE = /<think>([\s\S]*?)<\/think>/;
            const THOUGHT_OPEN_RE = /<think>([\s\S]*)$/;

            const showThink = () => {
                if (!hadThink) {
                    hadThink = true;
                    if (thinkSection) thinkSection.style.display = '';
                    status.textContent = '思考中...';
                }
            };

            const collapseThink = () => {
                if (thinkSection && !thinkSection.classList.contains('collapsed')) {
                    setTimeout(() => thinkSection.classList.add('collapsed'), 600);
                }
            };

            /**
             * 解析原始缓冲区，分离思考/回答
             * 支持两种格式：\x00[THINK]\x00 标记 和 <think> 标签
             */
            const parseBuffer = () => {
                thinkText = '';
                answerText = '';
                let remaining = rawBuf;

                // 先处理 \x00[THINK]\x00 标记
                let parsed = '';
                let cursor = 0;
                while (cursor < remaining.length) {
                    const startIdx = remaining.indexOf(THINK_START, cursor);
                    if (startIdx === -1) {
                        parsed += remaining.slice(cursor);
                        break;
                    }
                    parsed += remaining.slice(cursor, startIdx);
                    const endIdx = remaining.indexOf(THINK_END, startIdx + THINK_START.length);
                    if (endIdx === -1) {
                        // 还在思考中
                        thinkText += remaining.slice(startIdx + THINK_START.length);
                        showThink();
                        break;
                    }
                    thinkText += remaining.slice(startIdx + THINK_START.length, endIdx);
                    cursor = endIdx + THINK_END.length;
                }
                remaining = parsed;

                // 再处理 <think> 标签
                const closedMatch = remaining.match(THOUGHT_RE);
                if (closedMatch) {
                    thinkText += closedMatch[1];
                    remaining = remaining.replace(THOUGHT_RE, '');
                } else {
                    const openMatch = remaining.match(THOUGHT_OPEN_RE);
                    if (openMatch) {
                        thinkText += openMatch[1];
                        remaining = remaining.replace(THOUGHT_OPEN_RE, '');
                    }
                }

                if (thinkText) showThink();
                answerText = remaining;
            };

            const throttledRender = () => {
                if (renderTimer) return;
                renderTimer = requestAnimationFrame(() => {
                    renderTimer = null;
                    parseBuffer();
                    if (thinkText && thinkContent) {
                        this._renderMarkdown(thinkContent, thinkText);
                    }
                    if (answerText) {
                        this._renderMarkdown(output, answerText);
                    }
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (!chunk) continue;
                gotAny = true;
                rawBuf += chunk;
                throttledRender();
            }

            // 最终渲染 + 缓存
            if (renderTimer) cancelAnimationFrame(renderTimer);
            parseBuffer();
            if (thinkText && thinkContent) {
                this._renderMarkdown(thinkContent, thinkText);
                if (thinkLabel) thinkLabel.textContent = '思考过程';
                collapseThink();
            }
            if (answerText) {
                this._renderMarkdown(output, answerText);
            } else if (!answerText && thinkText) {
                this._renderMarkdown(output, '> 模型未生成回答内容');
            }

            // 缓存结果
            this._cache.set(qId, { answer: answerText, think: thinkText, hadThink });

            status.textContent = gotAny ? '完成' : '没有收到内容';
            cancel.textContent = '关闭';
            cancel.onclick = () => overlay.remove();
        } catch (e) {
            if (e.name === 'AbortError') {
                status.textContent = '已停止';
                cancel.textContent = '关闭';
                cancel.onclick = () => overlay.remove();
                return;
            }
            status.textContent = '失败';
            this._renderMarkdown(output, `\n\n> ⚠️ **错误**：${e.message}`);
            Utils.showToast('AI 解读失败：' + e.message, 'error', 5000);
        } finally {
            // 重新启用重新生成按钮
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = '重新生成';
            }
        }
    }
};

export default AIExplain;
