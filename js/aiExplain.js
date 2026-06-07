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
        return this._config || DEFAULT_CONFIG;
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
            return {
                useOverride: raw.useOverride === true,
                provider,
                baseUrl: String(raw.baseUrl || ''),
                model: String(raw.model || ''),
                apiKey: String(raw.apiKey || '')
            };
        } catch {
            return {
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
        const data = {
            useOverride: settings.useOverride === true,
            provider,
            baseUrl: String(settings.baseUrl || '').trim(),
            model: String(settings.model || '').trim(),
            apiKey: String(settings.apiKey || '').trim()
        };
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
        const modeLabel = config.mode === 'inpage' ? '网页内流式解读' : '搜索跳转';
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
                <div class="ai-explain-settings-title">网页内 AI 解读</div>
                <div class="ai-explain-status-grid">
                    <div><span>当前模式</span><strong>${Utils.escapeHtml(modeLabel)}</strong></div>
                    <div><span>后台引擎</span><strong>${Utils.escapeHtml(adminProvider)}</strong></div>
                    <div><span>后台密钥</span><strong>${config.hasGlobalKey ? '已配置' : '未配置'}</strong></div>
                </div>
                ${
                    config.mode !== 'inpage'
                        ? '<p class="ai-explain-note">后台当前使用“搜索跳转”模式，题目 AI 按钮会打开你上方设置的搜索引擎。</p>'
                        : '<p class="ai-explain-note">后台当前使用“网页内流式解读”模式，点击题目 AI 按钮会在当前页面生成解析。</p>'
                }
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
        `;
    },

    bindSettingsUI(modal) {
        if (!modal) return;
        const toggle = modal.querySelector('#ai-explain-use-override');
        const fields = modal.querySelector('#ai-explain-override-fields');
        const providerSelect = modal.querySelector('#ai-explain-provider');
        const baseUrl = modal.querySelector('#ai-explain-base-url');
        const model = modal.querySelector('#ai-explain-model');

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
        if (!config.enabled || !config.allowUserOverride) return null;

        const useOverride = modal.querySelector('#ai-explain-use-override')?.checked || false;
        const provider = modal.querySelector('#ai-explain-provider')?.value || 'openai';
        const baseUrl = modal.querySelector('#ai-explain-base-url')?.value || '';
        const model = modal.querySelector('#ai-explain-model')?.value || '';
        const apiKey = modal.querySelector('#ai-explain-api-key')?.value || '';

        return this.saveLocalSettings({ useOverride, provider, baseUrl, model, apiKey });
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

    buildQuestionPayload({ question, bank, userAnswer, isCorrect }) {
        const qText = this._cleanQuestionText(question.question || '');
        const opts = (question.options || []).map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
        let fullQuestion = qText;
        if (opts) fullQuestion += '\n' + opts;
        if (question.code) fullQuestion += '\n```' + (question.codeLanguage || '') + '\n' + question.code + '\n```';
        if (userAnswer !== undefined) fullQuestion += `\n学生作答：${userAnswer}（${isCorrect ? '正确' : '错误'}）`;

        return {
            question: fullQuestion,
            answer: question.answer || '',
            analysis: question.explanation || '',
            bankName: bank?.name || ''
        };
    },

    _appendText(target, text) {
        target.textContent += text;
        target.scrollTop = target.scrollHeight;
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
                    <button class="ai-explain-close" type="button" aria-label="关闭">×</button>
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
        return overlay;
    },

    async openExplanation({ question, bank, userAnswer, isCorrect }) {
        await this.init();
        const config = this.getConfig();
        if (!config.enabled) {
            Utils.showToast('管理员已关闭 AI 解读功能', 'error');
            return;
        }
        if (config.mode !== 'inpage') return false;

        const overlay = this._createModal(`第 ${question.id || ''} 题`.trim());
        const output = overlay.querySelector('#ai-explain-output');
        const status = overlay.querySelector('#ai-explain-stream-status');
        const cancel = overlay.querySelector('#ai-explain-cancel');
        const controller = new AbortController();
        cancel?.addEventListener('click', () => controller.abort());

        try {
            status.textContent = '连接中...';
            const payload = {
                ...this.buildQuestionPayload({ question, bank, userAnswer, isCorrect }),
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (chunk) {
                    gotAny = true;
                    this._appendText(output, chunk);
                }
            }

            status.textContent = gotAny ? '完成' : '没有收到内容';
            cancel.textContent = '关闭';
            cancel.onclick = () => overlay.remove();
        } catch (e) {
            if (e.name === 'AbortError') {
                status.textContent = '已停止';
                cancel.textContent = '关闭';
                cancel.onclick = () => overlay.remove();
                return true;
            }
            status.textContent = '失败';
            this._appendText(output, `\n\n[错误] ${e.message}`);
            Utils.showToast('AI 解读失败：' + e.message, 'error', 5000);
        }
        return true;
    }
};

export default AIExplain;
