import Utils from './utils.js';

const PROVIDERS = {
    openai: 'OpenAI 兼容',
    gemini: 'Gemini API'
};

export function initAI(Admin) {
    Admin.renderAI = async function () {
        const el = document.getElementById('sec-ai');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/admin/ai-config');
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: 'AI 配置加载失败',
                    desc: d?.error || '无法读取 AI 解读配置。'
                });
                return;
            }

            const c = d.config || {};
            el.innerHTML = `
                ${this.pageHeader({
                    title: 'AI 解读配置',
                    description: '控制前台 AI 按钮显示、网页内流式解读、全站默认模型和用户自定义权限。',
                    crumbs: ['管理后台', 'AI 解读'],
                    actions: '<button class="abtn" onclick="Admin.renderAI()">刷新</button>'
                })}
                <div class="system-notice"><span class="notice-dot"></span><div>后台 API 密钥不会返回到前端。API 密钥留空表示保留原密钥；勾选清除密钥才会删除。</div></div>
                <div class="card">
                    <div class="card-header">
                        <h3>功能开关</h3>
                        <span class="count">${c.enabled ? '当前启用' : '当前关闭'}</span>
                    </div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            <label class="d-item" style="cursor:pointer">
                                <div class="dl">启用 AI 解读</div>
                                <div class="dv"><input type="checkbox" id="ai-enabled" ${c.enabled ? 'checked' : ''}></div>
                            </label>
                            <label class="d-item" style="cursor:pointer">
                                <div class="dl">允许用户自定义 API</div>
                                <div class="dv"><input type="checkbox" id="ai-allow-user" ${c.allowUserOverride ? 'checked' : ''}></div>
                            </label>
                            <div class="d-item"><div class="dl">后台密钥</div><div class="dv">${c.hasGlobalKey ? '已配置' : '未配置'}</div></div>
                            <div class="d-item"><div class="dl">最后更新</div><div class="dv">${this.fmtTime(c.updatedAt) || '-'}</div></div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>默认解读引擎</h3><span class="count">全站默认</span></div>
                    <div class="card-body" style="padding:16px">
                        <div class="ai-admin-grid">
                            <label>
                                <span>前台模式</span>
                                <select class="admin-select" id="ai-mode">
                                    <option value="search" ${c.mode !== 'inpage' ? 'selected' : ''}>搜索跳转</option>
                                    <option value="inpage" ${c.mode === 'inpage' ? 'selected' : ''}>网页内流式解读</option>
                                </select>
                            </label>
                            <label>
                                <span>协议</span>
                                <select class="admin-select" id="ai-provider">
                                    ${Object.entries(PROVIDERS).map(([id, label]) => `<option value="${id}" ${c.provider === id ? 'selected' : ''}>${label}</option>`).join('')}
                                </select>
                            </label>
                            <label>
                                <span>Base URL</span>
                                <input class="admin-input" id="ai-base-url" value="${Utils.escapeHtml(c.baseUrl || '')}" placeholder="OpenAI: https://api.openai.com/v1 / Gemini: https://generativelanguage.googleapis.com/v1beta">
                            </label>
                            <label>
                                <span>模型</span>
                                <input class="admin-input" id="ai-model" value="${Utils.escapeHtml(c.model || '')}" placeholder="gpt-4o-mini / deepseek-chat / gemini-1.5-flash">
                            </label>
                            <label>
                                <span>API 密钥</span>
                                <input class="admin-input" id="ai-api-key" type="password" value="" placeholder="留空保留当前密钥">
                            </label>
                            <label class="ai-admin-clear-key">
                                <span>清除当前密钥</span>
                                <input type="checkbox" id="ai-clear-key">
                            </label>
                        </div>
                        <label class="ai-admin-prompt-label">系统提示词</label>
                        <textarea class="admin-input ai-admin-prompt" id="ai-system-prompt" rows="6" placeholder="请输入 AI 解读风格和要求">${Utils.escapeHtml(c.systemPrompt || '')}</textarea>
                        <div class="modal-actions" style="margin-top:16px">
                            <button class="ms" onclick="Admin.renderAI()">取消</button>
                            <button class="mp" onclick="Admin.saveAIConfig()">保存配置</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            el.innerHTML = this.emptyState({ title: 'AI 配置加载失败', desc: e.message });
        }
    };

    Admin.saveAIConfig = async function () {
        const config = {
            enabled: document.getElementById('ai-enabled')?.checked || false,
            allowUserOverride: document.getElementById('ai-allow-user')?.checked || false,
            mode: document.getElementById('ai-mode')?.value || 'search',
            provider: document.getElementById('ai-provider')?.value || 'openai',
            baseUrl: document.getElementById('ai-base-url')?.value.trim() || '',
            model: document.getElementById('ai-model')?.value.trim() || '',
            apiKey: document.getElementById('ai-api-key')?.value.trim() || '',
            clearApiKey: document.getElementById('ai-clear-key')?.checked || false,
            systemPrompt: document.getElementById('ai-system-prompt')?.value.trim() || ''
        };

        const r = await this.put('/api/admin/ai-config', { config });
        if (r?.ok) {
            Utils.showToast('AI 解读配置已保存', 'success');
            await this.renderAI();
        } else {
            Utils.showToast(r?.error || '保存失败', 'error');
        }
    };
}
