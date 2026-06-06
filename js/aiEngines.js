/**
 * AI 搜索引擎设置工具
 * 支持内置引擎 + 多个自定义引擎。
 */

import Utils from './utils.js';

const CUSTOM_PREFIX = 'custom:';

const BUILTIN_ENGINES = [
    {
        id: 'metaso',
        label: '秘塔搜索 (metaso.cn)',
        buildUrl: (encodedKeyword) => `https://metaso.cn/?q=${encodedKeyword}`
    },
    {
        id: 'felo',
        label: 'Felo AI (felo.ai)',
        buildUrl: (encodedKeyword) => `https://felo.ai/search?q=${encodedKeyword}`
    },
    {
        id: 'andi',
        label: 'Andi Search (andisearch.com)',
        buildUrl: (encodedKeyword) => `https://andisearch.com/?q=${encodedKeyword}`
    },
    {
        id: 'baidu',
        label: '百度搜索 (baidu.com)',
        buildUrl: (encodedKeyword) => `https://www.baidu.com/s?wd=${encodedKeyword}`
    }
];

const AIEngines = {
    CUSTOM_PREFIX,
    BUILTIN_ENGINES,

    createCustomId() {
        return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    },

    isCustomValue(value) {
        return String(value || '').startsWith(CUSTOM_PREFIX);
    },

    getCustomId(value) {
        return this.isCustomValue(value) ? String(value).slice(CUSTOM_PREFIX.length) : '';
    },

    isBuiltin(value) {
        return BUILTIN_ENGINES.some((engine) => engine.id === value);
    },

    _safeId(id) {
        const safe = String(id || '')
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '');
        return safe || this.createCustomId();
    },

    _normalizeCustomEngines(settings = {}) {
        const raw = Array.isArray(settings.customAiEngines) ? settings.customAiEngines : [];
        const seen = new Set();
        const engines = [];

        raw.forEach((item, index) => {
            const url = String(item?.url || '').trim();
            if (!url) return;

            let id = this._safeId(item?.id);
            while (seen.has(id)) {
                id = `${id}-${index + 1}`;
            }
            seen.add(id);

            const name = String(item?.name || '').trim() || `自定义引擎 ${engines.length + 1}`;
            engines.push({ id, name, url });
        });

        const legacyUrl = String(settings.customAiEngine || '').trim();
        if (engines.length === 0 && legacyUrl) {
            engines.push({ id: 'custom-default', name: '自定义引擎', url: legacyUrl });
        }

        return engines;
    },

    _resolveSelected(value, customEngines = []) {
        const selected = String(value || 'metaso');

        if (selected === 'custom') {
            return customEngines.length > 0 ? `${CUSTOM_PREFIX}${customEngines[0].id}` : 'metaso';
        }

        if (this.isCustomValue(selected)) {
            const id = this.getCustomId(selected);
            return customEngines.some((engine) => engine.id === id) ? selected : 'metaso';
        }

        return this.isBuiltin(selected) ? selected : 'metaso';
    },

    normalizeSettings(settings = {}) {
        const customAiEngines = this._normalizeCustomEngines(settings);
        const aiEngine = this._resolveSelected(settings.aiEngine, customAiEngines);
        const selectedCustom = this.isCustomValue(aiEngine)
            ? customAiEngines.find((engine) => engine.id === this.getCustomId(aiEngine))
            : null;

        return {
            ...settings,
            aiEngine,
            customAiEngines,
            customAiEngine: selectedCustom?.url || customAiEngines[0]?.url || ''
        };
    },

    _renderSelectOptions(selected, customEngines = []) {
        const builtins = BUILTIN_ENGINES.map(
            (engine) =>
                `<option value="${engine.id}" ${selected === engine.id ? 'selected' : ''}>${Utils.escapeHtml(engine.label)}</option>`
        ).join('');

        const customs = customEngines
            .filter((engine) => engine.name || engine.url)
            .map((engine, index) => {
                const value = `${CUSTOM_PREFIX}${engine.id}`;
                const label = engine.name || `自定义引擎 ${index + 1}`;
                return `<option value="${Utils.escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${Utils.escapeHtml(label)}</option>`;
            })
            .join('');

        return `${builtins}${customs ? '<option disabled>── 自定义 ──</option>' + customs : ''}`;
    },

    _renderCustomRow(engine = {}, index = 0) {
        const id = this._safeId(engine.id);
        const name = engine.name || `自定义引擎 ${index + 1}`;
        const url = engine.url || '';

        return `
            <div class="custom-ai-row" data-custom-ai-row data-engine-id="${Utils.escapeHtml(id)}">
                <input type="hidden" class="custom-ai-id" value="${Utils.escapeHtml(id)}">
                <div class="custom-ai-field custom-ai-name-field">
                    <label>名称</label>
                    <input type="text" class="custom-ai-name" placeholder="如：Kimi / ChatGPT / Perplexity" value="${Utils.escapeHtml(name)}">
                </div>
                <div class="custom-ai-field custom-ai-url-field">
                    <label>URL</label>
                    <input type="text" class="custom-ai-url" placeholder="https://example.com/search?q={keyword}" value="${Utils.escapeHtml(url)}">
                </div>
                <button type="button" class="custom-ai-delete" data-custom-ai-delete aria-label="删除自定义引擎">删除</button>
            </div>
        `;
    },

    _renderCustomRows(customEngines = []) {
        if (customEngines.length === 0) {
            return '<div class="custom-ai-empty">暂无自定义引擎，点击下方按钮添加。</div>';
        }
        return customEngines.map((engine, index) => this._renderCustomRow(engine, index)).join('');
    },

    renderSettingsFields(settings = {}) {
        const normalized = this.normalizeSettings(settings);

        return `
            <label>AI 搜索引擎</label>
            <select id="setting-ai-engine">
                ${this._renderSelectOptions(normalized.aiEngine, normalized.customAiEngines)}
            </select>
            <div class="custom-ai-manager" id="custom-ai-manager">
                <div class="custom-ai-manager-head">
                    <label>自定义引擎</label>
                    <button type="button" class="custom-ai-add" data-custom-ai-add>+ 添加</button>
                </div>
                <div class="custom-ai-list" id="custom-ai-list">
                    ${this._renderCustomRows(normalized.customAiEngines)}
                </div>
                <p class="custom-ai-help">URL 可使用 <code>{keyword}</code> 表示搜索关键词；不写占位符时会自动追加 <code>?q=关键词</code>。</p>
            </div>
        `;
    },

    _readRows(modal, { requireUrl = false } = {}) {
        const rows = Array.from(modal.querySelectorAll('[data-custom-ai-row]'));
        const seen = new Set();
        const engines = [];

        rows.forEach((row, index) => {
            const name = row.querySelector('.custom-ai-name')?.value.trim() || '';
            const url = row.querySelector('.custom-ai-url')?.value.trim() || '';
            if (!name && !url) return;
            if (requireUrl && !url) return;

            let id = this._safeId(row.querySelector('.custom-ai-id')?.value || row.dataset.engineId);
            while (seen.has(id)) {
                id = `${id}-${index + 1}`;
            }
            seen.add(id);

            engines.push({
                id,
                name: name || `自定义引擎 ${engines.length + 1}`,
                url
            });
        });

        return engines;
    },

    _appendCustomRow(list, engine) {
        const empty = list.querySelector('.custom-ai-empty');
        if (empty) empty.remove();

        const wrapper = document.createElement('div');
        wrapper.innerHTML = this._renderCustomRow(engine, list.querySelectorAll('[data-custom-ai-row]').length).trim();
        list.appendChild(wrapper.firstElementChild);
    },

    bindSettingsUI(modal) {
        if (!modal) return;

        const manager = modal.querySelector('#custom-ai-manager');
        const list = modal.querySelector('#custom-ai-list');
        const select = modal.querySelector('#setting-ai-engine');
        if (!manager || !list || !select) return;

        const refreshSelect = (preferredValue = select.value) => {
            const rows = this._readRows(modal, { requireUrl: false });
            const selected = this._resolveSelected(preferredValue, rows);
            select.innerHTML = this._renderSelectOptions(selected, rows);
            select.value = selected;
        };

        manager.addEventListener('click', (event) => {
            const addButton = event.target.closest('[data-custom-ai-add]');
            if (addButton) {
                const count = list.querySelectorAll('[data-custom-ai-row]').length + 1;
                const engine = {
                    id: this.createCustomId(),
                    name: `自定义引擎 ${count}`,
                    url: ''
                };
                this._appendCustomRow(list, engine);
                const value = `${CUSTOM_PREFIX}${engine.id}`;
                refreshSelect(value);
                const row = list.querySelector(`[data-engine-id="${engine.id}"]`);
                row?.querySelector('.custom-ai-url')?.focus();
                return;
            }

            const deleteButton = event.target.closest('[data-custom-ai-delete]');
            if (deleteButton) {
                const row = deleteButton.closest('[data-custom-ai-row]');
                const deletedValue = `${CUSTOM_PREFIX}${row?.dataset.engineId || ''}`;
                row?.remove();
                if (list.querySelectorAll('[data-custom-ai-row]').length === 0) {
                    list.innerHTML = '<div class="custom-ai-empty">暂无自定义引擎，点击下方按钮添加。</div>';
                }
                refreshSelect(select.value === deletedValue ? 'metaso' : select.value);
            }
        });

        manager.addEventListener('input', (event) => {
            if (event.target.matches('.custom-ai-name, .custom-ai-url')) {
                refreshSelect(select.value);
            }
        });
    },

    readSettingsForm(modal) {
        const select = modal.querySelector('#setting-ai-engine');
        const selectedBefore = select?.value || 'metaso';
        const allRows = this._readRows(modal, { requireUrl: false });
        const selectedCustomId = this.getCustomId(selectedBefore);

        if (this.isCustomValue(selectedBefore)) {
            const selectedRow = allRows.find((engine) => engine.id === selectedCustomId);
            if (selectedRow && !selectedRow.url) {
                return { error: '当前选中的自定义引擎 URL 不能为空' };
            }
        }

        const customAiEngines = allRows.filter((engine) => engine.url);
        let aiEngine = this._resolveSelected(selectedBefore, customAiEngines);
        if (this.isCustomValue(aiEngine) && !customAiEngines.some((engine) => engine.id === this.getCustomId(aiEngine))) {
            aiEngine = customAiEngines.length > 0 ? `${CUSTOM_PREFIX}${customAiEngines[0].id}` : 'metaso';
        }

        const selectedCustom = this.isCustomValue(aiEngine)
            ? customAiEngines.find((engine) => engine.id === this.getCustomId(aiEngine))
            : null;

        return {
            aiEngine,
            customAiEngines,
            customAiEngine: selectedCustom?.url || customAiEngines[0]?.url || ''
        };
    },

    _formatCustomUrl(template, encodedKeyword) {
        let url = String(template || '').trim();
        if (!url) return '';

        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }

        if (!url.includes('{keyword}')) {
            url += url.includes('?') ? '&' : '?';
            url += 'q={keyword}';
        }

        return url.split('{keyword}').join(encodedKeyword);
    },

    buildSearchUrl(settings, keyword) {
        const normalized = this.normalizeSettings(settings);
        const encoded = encodeURIComponent(keyword);

        const builtin = BUILTIN_ENGINES.find((engine) => engine.id === normalized.aiEngine);
        if (builtin) return builtin.buildUrl(encoded);

        if (this.isCustomValue(normalized.aiEngine)) {
            const custom = normalized.customAiEngines.find(
                (engine) => engine.id === this.getCustomId(normalized.aiEngine)
            );
            const url = this._formatCustomUrl(custom?.url, encoded);
            if (url) return url;
        }

        return BUILTIN_ENGINES[0].buildUrl(encoded);
    }
};

export default AIEngines;
