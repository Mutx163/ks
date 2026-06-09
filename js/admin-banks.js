/**
 * 管理后台 - 题库管理（二级页面版）
 */
import Utils from './utils.js';

export function initBanks(Admin) {
    Admin.viewBank = function (bankId, bankName) {
        return this.showQuestionList(bankId, bankName);
    };

    const MODE_DEFS = [
        { key: 'all', label: '顺序刷题' },
        { key: 'random', label: '随机' },
        { key: 'shuffle_options', label: '选项乱序' },
        { key: 'wrong', label: '错题' },
        { key: 'review', label: '背题' },
        { key: 'spaced', label: '复习' },
        { key: 'bookmark', label: '收藏' },
        { key: 'exam', label: '考试' }
    ];

    const TYPE_LABELS = {
        single: '单选',
        multiple: '多选',
        judge: '判断',
        fill: '填空',
        essay: '简答',
        multi: '多选',
        code: '编程',
        unknown: '未知'
    };

    // ==================== 题库列表页 ====================
    Admin.renderBanks = async function () {
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/banks');
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '题库加载失败',
                    desc: d?.error || '无法获取云端题库列表。'
                });
                return;
            }

            const search = (
                document.getElementById('bank-admin-search')?.value ||
                this.bankSearch ||
                ''
            )
                .trim()
                .toLowerCase();
            const status =
                document.getElementById('bank-status-filter')?.value ||
                this.bankStatusFilter ||
                'all';
            const category =
                document.getElementById('bank-category-filter')?.value ||
                this.bankCategoryFilter ||
                'all';
            this.bankSearch = search;
            this.bankStatusFilter = status;
            this.bankCategoryFilter = category;

            const categories = [
                ...new Set((d.banks || []).map((b) => b.category || '未分类'))
            ].sort();
            let banks = d.banks || [];
            if (search)
                banks = banks.filter((b) =>
                    `${b.id} ${b.name} ${b.category || ''}`.toLowerCase().includes(search)
                );
            if (status === 'enabled') banks = banks.filter((b) => b.enabled !== false);
            else if (status === 'disabled') banks = banks.filter((b) => b.enabled === false);
            if (category !== 'all')
                banks = banks.filter((b) => (b.category || '未分类') === category);

            const rows = banks
                .map((b) => {
                    const id = Utils.jsSafe(b.id);
                    const enabled = b.enabled !== false;
                    return `
                    <tr style="cursor:pointer" onclick="Admin.showBankDetail('${id}')">
                        <td><strong>${Utils.escapeHtml(b.name)}</strong><div class="row-sub">${Utils.escapeHtml(b.id)}</div></td>
                        <td>${Utils.escapeHtml(b.category || '未分类')}</td>
                        <td>${b.question_count || 0}</td>
                        <td>v${b.version || 1}</td>
                        <td>${this.statusPill(enabled, { enabled: '前台可见', disabled: '前台不可见' })}</td>
                        <td>${Admin.fmtTime(b.updated_at) || '-'}</td>
                        <td style="white-space:nowrap" onclick="event.stopPropagation()">
                            <button class="abtn" onclick="Admin.showBankDetail('${id}')">详情</button>
                            <button class="abtn ${enabled ? 'warn' : 'success'}" onclick="Admin.toggleBank('${id}', ${!enabled}, 'list')">${enabled ? '禁用' : '启用'}</button>
                        </td>
                    </tr>`;
                })
                .join('');

            el.innerHTML = `
                ${this.pageHeader({
                    title: '题库管理',
                    description:
                        '管理云端 Worker/D1 题库、前台可见状态、题目内容、做题模式与修改历史。',
                    crumbs: ['管理后台', '题库管理'],
                    actions:
                        '<button class="abtn" onclick="Admin.clearLocalCache()">清除本地数据</button><button class="abtn primary" onclick="Admin.uploadBank()">上传题库</button><button class="abtn primary" onclick="Admin.createBank()">新建题库</button>'
                })}
                <div class="toolbar">
                    <div class="toolbar-group" style="flex:1">
                        <div class="search-box"><span class="ic">${Utils.icon('search')}</span><input id="bank-admin-search" placeholder="搜索题库名称、ID 或分类..." value="${Utils.escapeHtml(search)}" oninput="Admin.setBankFilters()"></div>
                        <select id="bank-status-filter" class="admin-select" style="width:auto" onchange="Admin.setBankFilters()">
                            <option value="all" ${status === 'all' ? 'selected' : ''}>全部状态</option>
                            <option value="enabled" ${status === 'enabled' ? 'selected' : ''}>前台可见</option>
                            <option value="disabled" ${status === 'disabled' ? 'selected' : ''}>前台不可见</option>
                        </select>
                        <select id="bank-category-filter" class="admin-select" style="width:auto" onchange="Admin.setBankFilters()">
                            <option value="all">全部分类</option>
                            ${categories.map((c) => `<option value="${Utils.escapeHtml(c)}" ${category === c ? 'selected' : ''}>${Utils.escapeHtml(c)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="toolbar-group"><span class="status-pill info">${banks.length}/${(d.banks || []).length} 个题库</span></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>题库列表</h3><span class="count">点击行进入详情</span></div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>题库</th><th>分类</th><th>题目数</th><th>版本</th><th>前台状态</th><th>更新时间</th><th>操作</th></tr></thead>
                            <tbody>${rows || `<tr><td colspan="7">${this.emptyState({ title: '没有匹配题库', desc: '请调整搜索词或筛选条件。' })}</td></tr>`}</tbody>
                        </table>
                    </div>
                </div>`;
            Utils.initIcons?.();
        } catch (e) {
            el.innerHTML = this.emptyState({ title: '题库加载失败', desc: e.message });
        }
    };

    Admin.setBankFilters = function () {
        this.bankSearch = (document.getElementById('bank-admin-search')?.value || '')
            .trim()
            .toLowerCase();
        this.bankStatusFilter = document.getElementById('bank-status-filter')?.value || 'all';
        this.bankCategoryFilter = document.getElementById('bank-category-filter')?.value || 'all';
        this.renderBanks();
    };

    // ==================== 题库详情页（二级页面）====================
    Admin.showBankDetail = async function (bankId, { pushHash = true } = {}) {
        if (pushHash) {
            const targetHash = `#/banks/${bankId}`;
            if (location.hash !== targetHash) {
                this.navigate(targetHash);
                return;
            }
        }
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const d = await this.get(`/api/admin/bank/${bankId}`);
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '题库详情加载失败',
                    desc: d?.error || '无法读取题库详情。'
                });
                return;
            }

            const b = d.bank;
            const qs = b.questions || [];
            const allowed = b.allowed_modes;
            const enabled = b.enabled !== false;
            const safeId = Utils.jsSafe(bankId);
            const safeName = Utils.jsSafe(b.name);

            const modesHtml = MODE_DEFS.map((m) => {
                const checked = !allowed || allowed.includes(m.key);
                return `<label class="tag-pill" style="cursor:pointer;${checked ? 'border-color:var(--admin-primary-border);background:var(--admin-primary-weak);color:var(--admin-primary)' : ''}">
                    <input type="checkbox" data-mode="${m.key}" ${checked ? 'checked' : ''} style="margin:0">
                    ${m.label}
                </label>`;
            }).join('');

            const typeCount = {};
            qs.forEach((q) => {
                const t = q.type || 'unknown';
                typeCount[t] = (typeCount[t] || 0) + 1;
            });
            const typeEntries = Object.entries(typeCount);

            el.innerHTML = `
                ${this.pageHeader({
                    title: b.name,
                    description: `${b.description || '管理该题库的基础信息、题目内容、前台可见状态和做题模式。'}`,
                    crumbs: ['管理后台', '题库管理', b.name],
                    actions: `<button class="abtn" onclick="Admin.renderBanks()">返回题库列表</button><button class="abtn primary" onclick="Admin.editBankInfo('${safeId}')">编辑信息</button>`
                })}
                <div class="card">
                    <div class="card-header">
                        <h3>基础信息 <span class="code">${Utils.escapeHtml(b.id)}</span></h3>
                        <div class="page-actions">${this.statusPill(enabled, { enabled: '前台可见', disabled: '前台不可见' })}</div>
                    </div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            <div class="d-item"><div class="dl">题目数</div><div class="dv">${qs.length}</div></div>
                            <div class="d-item"><div class="dl">版本</div><div class="dv">v${b.version || 1}</div></div>
                            <div class="d-item"><div class="dl">分类</div><div class="dv">${Utils.escapeHtml(b.category || '未分类')}</div></div>
                            <div class="d-item"><div class="dl">更新时间</div><div class="dv">${Admin.fmtTime(b.updated_at) || '-'}</div></div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>题型分布</h3><span class="count">${qs.length} 题</span></div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            ${
                                typeEntries.length
                                    ? typeEntries
                                          .map(
                                              ([type, count]) => `
                                <div class="d-item"><div class="dl">${TYPE_LABELS[type] || type}</div><div class="dv">${count}</div></div>
                            `
                                          )
                                          .join('')
                                    : this.emptyState({
                                          title: '暂无题目',
                                          desc: '可以添加题目或批量导入。'
                                      })
                            }
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>题目操作</h3><span class="count">内容管理</span></div>
                    <div class="card-body" style="padding:16px">
                        <div class="toolbar-group">
                            <button class="abtn primary" onclick="Admin.showQuestionList('${safeId}', '${safeName}')">管理题目 (${qs.length})</button>
                            <button class="abtn primary" onclick="Admin.addQuestion('${safeId}')">添加题目</button>
                            <button class="abtn primary" onclick="Admin.importQuestions('${safeId}')">批量导入</button>
                            <button class="abtn" onclick="Admin.viewBankHistory('${safeId}')">修改历史</button>
                            <button class="abtn" onclick="Admin.uploadBank('${safeId}')">替换题库</button>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3>允许的做题模式</h3>
                        <div class="toolbar-group">
                            <label class="tag-pill" style="cursor:pointer"><input type="checkbox" id="modes-select-all" onchange="Admin.toggleAllModes(this.checked)" ${!allowed ? 'checked' : ''}> 全选</label>
                            <button class="abtn primary" onclick="Admin.saveBankModes('${safeId}')">保存模式</button>
                        </div>
                    </div>
                    <div class="card-body" style="padding:16px"><div id="bank-modes-list" class="toolbar-group">${modesHtml}</div></div>
                </div>
                <div class="danger-zone">
                    <h3>前台状态与危险操作</h3>
                    <p>${enabled ? '当前题库在前台可见。禁用后，首页刷新会立即从云端列表隐藏。' : '当前题库在前台不可见。启用后，首页刷新会立即显示。'}</p>
                    <div class="toolbar-group" style="margin-top:12px">
                        <button class="abtn ${enabled ? 'warn' : 'success'}" onclick="Admin.toggleBank('${safeId}', ${!enabled}, 'detail')">${enabled ? '禁用题库' : '启用题库'}</button>
                        <button class="abtn danger" onclick="Admin.confirmDeleteBank('${safeId}', '${safeName}')">删除题库</button>
                    </div>
                </div>`;
        } catch (e) {
            el.innerHTML = `
                ${this.pageHeader({ title: '题库详情', description: '题库详情加载失败。', crumbs: ['管理后台', '题库管理'], actions: '<button class="abtn" onclick="Admin.renderBanks()">返回题库列表</button>' })}
                ${this.emptyState({ title: '加载失败', desc: e.message })}`;
        }
    };

    // ==================== 题目列表页（第三级）====================
    Admin.showQuestionList = async function (bankId, bankName = '', { pushHash = true } = {}) {
        if (pushHash) {
            const targetHash = `#/banks/${bankId}/questions`;
            if (location.hash !== targetHash) {
                this.navigate(targetHash);
                return;
            }
        }
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const d = await this.get(`/api/admin/bank/${bankId}`);
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '题目加载失败',
                    desc: d?.error || '无法获取题目列表。'
                });
                return;
            }

            const qs = d.bank.questions || [];
            const title = bankName || d.bank.name || bankId;

            el.innerHTML = `
                ${this.pageHeader({
                    title: '题目管理',
                    description: `${title} · 共 ${qs.length} 题。支持搜索、按题型筛选和逐题编辑。`,
                    crumbs: ['管理后台', '题库管理', title, '题目管理'],
                    actions: `<button class="abtn" onclick="Admin.showBankDetail('${Utils.jsSafe(bankId)}')">返回题库详情</button><button class="abtn primary" onclick="Admin.addQuestion('${Utils.jsSafe(bankId)}')">添加题目</button>`
                })}
                <div class="card">
                    <div class="card-header"><h3>${Utils.escapeHtml(title)} - 题目列表</h3><span class="count">${qs.length} 题</span></div>
                    <div class="card-body" style="padding:12px">
                        <div class="toolbar">
                            <div class="toolbar-group" style="flex:1">
                                <input class="admin-input" type="text" id="bank-search" placeholder="搜索题目内容..." oninput="Admin.filterBankQuestions('${Utils.jsSafe(bankId)}')">
                                <select class="admin-select" id="bank-type-filter" style="width:auto" onchange="Admin.filterBankQuestions('${Utils.jsSafe(bankId)}')">
                                    <option value="">全部题型</option><option value="single">单选</option><option value="multiple">多选</option><option value="judge">判断</option><option value="fill">填空</option><option value="essay">简答</option><option value="code">编程</option>
                                </select>
                            </div>
                        </div>
                        <div id="bank-questions-list">${this._renderQuestionList(bankId, qs)}</div>
                    </div>
                </div>`;
        } catch (e) {
            el.innerHTML = `
                ${this.pageHeader({ title: '题目管理', description: '题目列表加载失败。', crumbs: ['管理后台', '题库管理'], actions: `<button class="abtn" onclick="Admin.showBankDetail('${Utils.jsSafe(bankId)}')">返回题库详情</button>` })}
                ${this.emptyState({ title: '加载失败', desc: e.message })}`;
        }
    };

    Admin.toggleAllModes = function (checked) {
        document.querySelectorAll('#bank-modes-list input[type=checkbox]').forEach((cb) => {
            cb.checked = checked;
            const label = cb.closest('label');
            if (label) {
                label.style.background = checked ? 'var(--admin-primary-weak)' : '';
                label.style.borderColor = checked ? 'var(--admin-primary-border)' : '';
                label.style.color = checked ? 'var(--admin-primary)' : '';
            }
        });
    };

    Admin.saveBankModes = async function (bankId) {
        const cbs = document.querySelectorAll('#bank-modes-list input[type=checkbox]');
        const allowed = Array.from(cbs)
            .filter((cb) => cb.checked)
            .map((cb) => cb.dataset.mode);
        const r = await this.put(`/api/admin/bank/${bankId}/settings`, {
            allowed_modes: allowed.length === MODE_DEFS.length ? null : allowed
        });
        if (r?.ok) Utils.showToast('做题模式已保存', 'success');
        else Utils.showToast(r?.error || '保存失败', 'error');
    };

    Admin._renderQuestionList = function (bankId, qs) {
        if (!qs.length)
            return this.emptyState({
                title: '暂无题目',
                desc: '可以添加题目或批量导入 JSON 题目。'
            });
        return qs
            .map(
                (q) => `
            <div class="question-item management-row" data-qid="${q.id}" style="margin-bottom:8px" onclick="Admin.editQuestion('${Utils.jsSafe(bankId)}',${q.id})">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                    <div style="flex:1;min-width:0">
                        <span class="code">#${q.id}</span>
                        <span class="tag-pill">${TYPE_LABELS[q.type] || q.type || '未知'}</span>
                        ${q.category ? `<span class="tag-pill">${Utils.escapeHtml(q.category)}</span>` : ''}
                        <div class="row-title" style="margin-top:8px">${Utils.escapeHtml((q.question || '').slice(0, 110))}${(q.question || '').length > 110 ? '...' : ''}</div>
                    </div>
                    <div class="toolbar-group" style="flex-shrink:0" onclick="event.stopPropagation()">
                        <button class="abtn" onclick="Admin.editQuestion('${Utils.jsSafe(bankId)}',${q.id})">编辑</button>
                        <button class="abtn danger" onclick="Admin.deleteQuestion('${Utils.jsSafe(bankId)}',${q.id})">删除</button>
                    </div>
                </div>
            </div>
        `
            )
            .join('');
    };

    Admin.filterBankQuestions = async function (bankId) {
        const search = (document.getElementById('bank-search')?.value || '').toLowerCase();
        const type = document.getElementById('bank-type-filter')?.value || '';
        const d = await this.get(`/api/admin/bank/${bankId}`);
        if (!d?.ok) return;
        let qs = d.bank.questions || [];
        if (type) qs = qs.filter((q) => q.type === type);
        if (search) qs = qs.filter((q) => (q.question || '').toLowerCase().includes(search));
        document.getElementById('bank-questions-list').innerHTML = this._renderQuestionList(
            bankId,
            qs
        );
    };

    // ==================== 弹窗操作 ====================
    Admin.uploadBank = function (existingId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:520px">
                    <h3>${existingId ? '替换题库 ' + Utils.escapeHtml(existingId) : '上传题库'}</h3>
                    <p style="font-size:13px;color:${existingId ? 'var(--admin-danger)' : 'var(--admin-text-secondary)'};margin-bottom:12px">${existingId ? '替换会覆盖当前题库内容，请先确认 JSON 文件来源可靠。' : '上传 JSON 题库到云端 D1。文件需包含 id、name、questions 字段。'}</p>
                    <input type="file" id="upload-bank-file" accept=".json" style="margin:12px 0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doUploadBank('${existingId || ''}')">${existingId ? '确认替换' : '上传'}</button></div>
                </div>
            </div>`;
    };

    Admin.doUploadBank = async function (existingId) {
        const file = document.getElementById('upload-bank-file').files[0];
        if (!file) {
            Utils.showToast('请选择文件', 'error');
            return;
        }
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const r = await this.post('/api/admin/upload-bank', {
                bank: json,
                existingId: existingId || null
            });
            if (r?.ok) {
                Utils.showToast(existingId ? '替换成功' : '上传成功', 'success');
                document.querySelector('.modal-mask')?.remove();
                existingId ? this.showBankDetail(existingId) : this.renderBanks();
            } else Utils.showToast(r?.error || '失败', 'error');
        } catch {
            Utils.showToast('JSON格式错误', 'error');
        }
    };

    Admin.createBank = function () {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:420px">
                    <h3>新建题库</h3>
                    <label>题库 ID</label><input id="new-bank-id" placeholder="英文，如 math-101">
                    <label>题库名称</label><input id="new-bank-name" placeholder="如 高等数学">
                    <label>分类</label><input id="new-bank-category" placeholder="如 数学">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doCreateBank()">创建</button></div>
                </div>
            </div>`;
    };

    Admin.doCreateBank = async function () {
        const id = document.getElementById('new-bank-id').value.trim();
        const name = document.getElementById('new-bank-name').value.trim();
        const category = document.getElementById('new-bank-category').value.trim();
        if (!id || !name) {
            Utils.showToast('请填写ID和名称', 'error');
            return;
        }
        const r = await this.post('/api/admin/create-bank', { id, name, category });
        if (r?.ok) {
            Utils.showToast('创建成功', 'success');
            document.querySelector('.modal-mask')?.remove();
            this.renderBanks();
        } else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.toggleBank = async function (bankId, enable, refresh = 'list') {
        const ok = await this.confirmDanger({
            title: enable ? '启用题库' : '禁用题库',
            targetLabel: bankId,
            message: enable
                ? '启用后题库会重新出现在前台首页。'
                : '禁用后题库会从前台首页隐藏，用户不能再进入该题库。',
            confirmText: enable ? '确认启用' : '确认禁用',
            danger: !enable
        });
        if (!ok) return;
        const r = await this.put(`/api/admin/bank/${bankId}/toggle`, { enabled: enable });
        if (r?.ok) {
            Utils.showToast(
                enable ? '题库已启用，前台刷新后立即可见' : '题库已禁用，前台刷新后立即隐藏',
                'success'
            );
            if (refresh === 'detail') this.showBankDetail(bankId);
            else this.renderBanks();
        } else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.confirmDeleteBank = async function (bankId, name) {
        const ok = await this.confirmDanger({
            title: '永久删除题库',
            targetLabel: `${name} (${bankId})`,
            message: '此操作不可恢复，题库基础信息、题目和相关设置都会被删除。',
            requiredText: bankId,
            confirmText: '永久删除'
        });
        if (ok) this.doDeleteBank(bankId);
    };

    Admin.doDeleteBank = async function (bankId) {
        const r = await this.delete(`/api/admin/bank/${bankId}`);
        if (r?.ok) {
            Utils.showToast('已删除', 'success');
            document.querySelector('.modal-mask')?.remove();
            this.renderBanks();
        } else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.clearLocalCache = async function () {
        const ok = await this.confirmDanger({
            title: '清除本地数据',
            targetLabel: '当前浏览器',
            message: '将清除当前浏览器中的进度、设置、历史和收藏。云端数据不会被删除。',
            requiredText: 'CLEAR',
            confirmText: '确认清除'
        });
        if (ok) this.doClearLocalCache();
    };

    Admin.doClearLocalCache = function () {
        try {
            Storage.clearAll();
            console.log('[Admin] ✅ 本地数据已清除');
            Utils.showToast('本地数据已清除，2秒后刷新页面', 'success');
            document.querySelector('.modal-mask')?.remove();
            setTimeout(() => location.reload(), 2000);
        } catch (e) {
            console.error('[Admin] 清除数据失败:', e);
            Utils.showToast('清除失败: ' + e.message, 'error');
        }
    };

    // ==================== 编辑题库信息 ====================
    Admin.editBankInfo = async function (bankId) {
        const d = await this.get(`/api/admin/bank/${bankId}`);
        if (!d?.ok) {
            Utils.showToast('获取题库信息失败', 'error');
            return;
        }
        const b = d.bank;
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:460px">
                    <h3>编辑题库信息</h3>
                    <p style="font-size:12px;color:var(--admin-text-tertiary);margin-bottom:14px">ID：${Utils.escapeHtml(b.id)}</p>
                    <label>题库名称 *</label>
                    <input id="edit-bank-name" value="${Utils.escapeHtml(b.name)}" placeholder="题库名称">
                    <label>题库描述</label>
                    <textarea id="edit-bank-desc" rows="3" placeholder="题库描述（可选）">${Utils.escapeHtml(b.description || '')}</textarea>
                    <label>分类</label>
                    <input id="edit-bank-category" value="${Utils.escapeHtml(b.category || '')}" placeholder="如：数学、编程、英语">
                    <div class="modal-actions">
                        <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                        <button class="mp" onclick="Admin.doEditBankInfo('${Utils.jsSafe(bankId)}')">保存</button>
                    </div>
                </div>
            </div>`;
    };

    Admin.doEditBankInfo = async function (bankId) {
        const name = document.getElementById('edit-bank-name').value.trim();
        const description = document.getElementById('edit-bank-desc').value.trim();
        const category = document.getElementById('edit-bank-category').value.trim();
        if (!name) {
            Utils.showToast('题库名称不能为空', 'error');
            return;
        }
        const r = await this.put(`/api/admin/bank/${bankId}/settings`, {
            name,
            description,
            category
        });
        if (r?.ok) {
            Utils.showToast('题库信息已更新', 'success');
            document.querySelector('.modal-mask')?.remove();
            this.showBankDetail(bankId);
        } else Utils.showToast(r?.error || '更新失败', 'error');
    };

    Admin.viewBankHistory = async function (bankId) {
        const d = await this.get(`/api/admin/bank/${bankId}/history`);
        if (!d?.ok) {
            Utils.showToast('获取失败', 'error');
            return;
        }
        const usersMap = {};
        if (this.users)
            this.users.forEach((u) => {
                usersMap[u.id] = u.initials;
            });
        const actionLabels = {
            add_question: '添加题目',
            edit_question: '编辑题目',
            delete_question: '删除题目',
            batch_import: '批量导入',
            toggle: '状态变更',
            update_settings: '更新设置',
            create: '创建题库',
            replace: '替换题库'
        };
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:620px;max-height:80vh;overflow-y:auto">
                    <h3>修改历史</h3>
                    <div style="margin-top:12px">${
                        d.history.length
                            ? d.history
                                  .map((h) => {
                                      const operatorName =
                                          usersMap[h.operator] || h.operator || '未知';
                                      return `
                        <div class="management-row" style="cursor:default;margin-bottom:8px">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                                <span class="status-pill info">${actionLabels[h.action] || h.action}</span>
                                <span style="color:var(--admin-text-tertiary);font-size:12px">${Admin.fmtTime(h.created_at)}</span>
                            </div>
                            <div style="margin-top:8px;color:var(--admin-text-secondary);font-size:13px">${Utils.escapeHtml(h.detail)}</div>
                            <div style="margin-top:4px;color:var(--admin-text-tertiary);font-size:12px">操作人：${Utils.escapeHtml(operatorName)} (${Utils.escapeHtml(h.operator || '')})</div>
                        </div>`;
                                  })
                                  .join('')
                            : this.emptyState({ title: '暂无历史' })
                    }</div>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    };

    Admin.importQuestions = function (bankId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:560px">
                    <h3>批量导入题目</h3>
                    <p style="font-size:13px;color:var(--admin-text-secondary);margin-bottom:12px">JSON 数组格式，每题含 question、options、answer 等字段。导入前建议先备份。</p>
                    <textarea id="import-questions-json" rows="10" placeholder='[{"question":"题目","options":["A.","B."],"answer":"A"}]' style="font-family:monospace;font-size:12px"></textarea>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doImportQuestions('${Utils.jsSafe(bankId)}')">导入</button></div>
                </div>
            </div>`;
    };

    Admin.doImportQuestions = async function (bankId) {
        try {
            const questions = JSON.parse(document.getElementById('import-questions-json').value);
            if (!Array.isArray(questions)) throw new Error('需要数组格式');
            const r = await this.post(`/api/admin/bank/${bankId}/import-questions`, { questions });
            if (r?.ok) {
                Utils.showToast(`已导入 ${r.added} 题`, 'success');
                document.querySelector('.modal-mask')?.remove();
                this.showBankDetail(bankId);
            } else Utils.showToast(r?.error || '失败', 'error');
        } catch (e) {
            Utils.showToast('JSON格式错误: ' + e.message, 'error');
        }
    };

    Admin.fmtTime = function (d) {
        if (!d) return '';
        try {
            return new Date(d).toLocaleString('zh-CN');
        } catch {
            return '';
        }
    };
}
