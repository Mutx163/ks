/**
 * 管理后台 - 题库管理（二级页面版）
 */
import Utils from './utils.js';

export function initBanks(Admin) {

    // ==================== 题库列表页 ====================
    Admin.renderBanks = async function() {
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/banks');
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="font-size:16px;font-weight:700">题库管理</h3>
                    <div style="display:flex;gap:8px">
                        <button class="abtn primary" onclick="Admin.uploadBank()">上传题库</button>
                        <button class="abtn primary" onclick="Admin.createBank()">新建题库</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
                    ${d.banks.map(b => `
                        <div class="card" style="cursor:pointer;transition:all 0.2s;${b.enabled === false ? 'opacity:0.6;' : ''}" onclick="Admin.showBankDetail('${Utils.jsSafe(b.id)}')">
                            <div class="card-body" style="padding:16px">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                                    <div>
                                        <h4 style="font-size:15px;font-weight:600;margin-bottom:4px">${Utils.escapeHtml(b.name)}</h4>
                                        <p style="font-size:11px;color:var(--text-tertiary)">${b.id}</p>
                                    </div>
                                    <span class="badge ${b.enabled !== false ? 'b-admin' : 'b-ban'}">${b.enabled !== false ? '启用' : '禁用'}</span>
                                </div>
                                <div style="display:flex;gap:16px;font-size:13px;color:var(--text-secondary)">
                                    <span>📝 ${b.question_count}题</span>
                                    <span>📂 ${Utils.escapeHtml(b.category||'未分类')}</span>
                                    <span>🔄 v${b.version}</span>
                                </div>
                                <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">
                                    更新: ${Admin.fmtTime(b.updated_at)||'-'}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        } catch (e) { el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    };

    // 做题模式定义
    const MODE_DEFS = [
        { key: 'all', label: '顺序刷题', icon: 'list' },
        { key: 'random', label: '随机', icon: 'shuffle' },
        { key: 'shuffle_options', label: '选项乱序', icon: 'refresh-cw' },
        { key: 'wrong', label: '错题', icon: 'alert-circle' },
        { key: 'review', label: '背题', icon: 'book-open' },
        { key: 'spaced', label: '复习', icon: 'brain' },
        { key: 'bookmark', label: '收藏', icon: 'star' },
        { key: 'exam', label: '考试', icon: 'file-text' }
    ];

    // ==================== 题库详情页（二级页面）====================
    Admin.showBankDetail = async function(bankId) {
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';
        
        try {
            const d = await this.get(`/api/admin/bank/${bankId}`);
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            
            const b = d.bank;
            const qs = b.questions || [];
            const allowed = b.allowed_modes;
            
            const modesHtml = MODE_DEFS.map(m => {
                const checked = !allowed || allowed.includes(m.key);
                return `<label style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;${checked?'background:var(--primary-light);border-color:var(--primary);':''}">
                    <input type="checkbox" data-mode="${m.key}" ${checked?'checked':''} style="margin:0">
                    ${m.label}
                </label>`;
            }).join(' ');
            
            el.innerHTML = `
                <!-- 返回按钮 -->
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderBanks()" style="display:flex;align-items:center;gap:6px">
                        ← 返回题库列表
                    </button>
                </div>
                
                <!-- 题库信息 -->
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${Utils.escapeHtml(b.name)} <span style="font-size:11px;color:var(--text-tertiary)">${qs.length}题 · v${b.version}</span></h3>
                        <div style="display:flex;gap:6px">
                            <button class="abtn ${b.enabled !== false ? 'success' : ''}" onclick="Admin.toggleBank('${Utils.jsSafe(bankId)}', ${b.enabled === false})">${b.enabled !== false ? '已启用' : '已禁用'}</button>
                            <button class="abtn" onclick="Admin.uploadBank('${Utils.jsSafe(bankId)}')">替换题库</button>
                            <button class="abtn danger" onclick="Admin.confirmDeleteBank('${Utils.jsSafe(bankId)}', '${Utils.jsSafe(b.name)}')">删除题库</button>
                        </div>
                    </div>
                    <div class="card-body" style="padding:16px">
                        <!-- 做题模式设置 -->
                        <div style="margin-bottom:16px">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                                <b style="font-size:13px">允许的做题模式</b>
                                <div style="display:flex;gap:8px;align-items:center">
                                    <label style="font-size:12px;color:var(--text-tertiary);cursor:pointer"><input type="checkbox" id="modes-select-all" onchange="Admin.toggleAllModes(this.checked)" ${!allowed?'checked':''}> 全选</label>
                                    <button class="abtn primary" style="padding:4px 12px;font-size:11px" onclick="Admin.saveBankModes('${Utils.jsSafe(bankId)}')">保存模式</button>
                                </div>
                            </div>
                            <div id="bank-modes-list" style="display:flex;flex-wrap:wrap;gap:6px">${modesHtml}</div>
                        </div>
                        
                        <!-- 题目操作 -->
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button class="abtn primary" onclick="Admin.addQuestion('${Utils.jsSafe(bankId)}')">添加题目</button>
                            <button class="abtn primary" onclick="Admin.importQuestions('${Utils.jsSafe(bankId)}')">批量导入</button>
                            <button class="abtn" onclick="Admin.viewBankHistory('${Utils.jsSafe(bankId)}')">修改历史</button>
                        </div>
                    </div>
                </div>
                
                <!-- 搜索和筛选 -->
                <div class="card">
                    <div class="card-header">
                        <h3>题目列表</h3>
                        <span class="count">${qs.length}题</span>
                    </div>
                    <div class="card-body" style="padding:12px">
                        <div style="display:flex;gap:8px;margin-bottom:12px">
                            <input type="text" id="bank-search" placeholder="搜索题目..." style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-card);color:var(--text)" oninput="Admin.filterBankQuestions('${Utils.jsSafe(bankId)}')">
                            <select id="bank-type-filter" style="padding:8px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg-card);color:var(--text)" onchange="Admin.filterBankQuestions('${Utils.jsSafe(bankId)}')">
                                <option value="">全部题型</option><option value="single">单选</option><option value="multiple">多选</option><option value="judge">判断</option><option value="fill">填空</option><option value="essay">简答</option>
                            </select>
                        </div>
                        <div id="bank-questions-list" style="max-height:500px;overflow-y:auto">${this._renderQuestionList(bankId, qs)}</div>
                    </div>
                </div>
            `;
        } catch (e) { 
            el.innerHTML = `
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderBanks()">← 返回题库列表</button>
                </div>
                <div class="empty-state">加载失败: ${e.message}</div>
            `; 
        }
    };

    Admin.toggleAllModes = function(checked) {
        document.querySelectorAll('#bank-modes-list input[type=checkbox]').forEach(cb => {
            cb.checked = checked;
            cb.closest('label').style.background = checked ? 'var(--primary-light)' : '';
            cb.closest('label').style.borderColor = checked ? 'var(--primary)' : '';
        });
    };

    Admin.saveBankModes = async function(bankId) {
        const cbs = document.querySelectorAll('#bank-modes-list input[type=checkbox]');
        const allowed = Array.from(cbs).filter(cb => cb.checked).map(cb => cb.dataset.mode);
        const r = await this.post(`/api/admin/bank/${bankId}/modes`, { allowedModes: allowed.length === MODE_DEFS.length ? null : allowed });
        if (r?.ok) Utils.showToast('已保存', 'success');
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin._renderQuestionList = function(bankId, qs) {
        const typeLabels = {single:'单选',multiple:'多选',judge:'判断',fill:'填空',essay:'简答',multi:'多选'};
        return qs.map(q => `
            <div class="question-item" data-qid="${q.id}" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:all 0.2s" onclick="Admin.editQuestion('${Utils.jsSafe(bankId)}',${q.id})">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="flex:1;min-width:0">
                        <span style="color:var(--text-tertiary);font-size:11px">#${q.id}</span>
                        <span class="question-type" style="background:var(--bg-hover);padding:2px 8px;border-radius:10px;font-size:10px;margin-left:6px">${typeLabels[q.type]||q.type||'?'}</span>
                        ${q.category ? `<span class="question-category" style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:10px;font-size:10px;margin-left:4px">${Utils.escapeHtml(q.category)}</span>` : ''}
                        <span class="question-preview" style="margin-left:6px;font-size:13px">${Utils.escapeHtml((q.question||'').slice(0,80))}${(q.question||'').length>80?'...':''}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button class="abtn" style="padding:3px 10px;font-size:11px" onclick="event.stopPropagation();Admin.editQuestion('${Utils.jsSafe(bankId)}',${q.id})">编辑</button>
                        <button class="abtn danger" style="padding:3px 10px;font-size:11px" onclick="event.stopPropagation();Admin.deleteQuestion('${Utils.jsSafe(bankId)}',${q.id})">删除</button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    Admin.filterBankQuestions = async function(bankId) {
        const search = (document.getElementById('bank-search')?.value || '').toLowerCase();
        const type = document.getElementById('bank-type-filter')?.value || '';
        const d = await this.get(`/api/admin/bank/${bankId}`);
        if (!d?.ok) return;
        let qs = d.bank.questions || [];
        if (type) qs = qs.filter(q => q.type === type);
        if (search) qs = qs.filter(q => (q.question||'').toLowerCase().includes(search));
        document.getElementById('bank-questions-list').innerHTML = this._renderQuestionList(bankId, qs);
    };

    // ==================== 弹窗操作 ====================
    
    Admin.uploadBank = function(existingId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px">
                    <h3>${existingId ? '替换题库 ' + existingId : '上传题库'}</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">JSON格式，含 id, name, questions 字段</p>
                    <input type="file" id="upload-bank-file" accept=".json" style="margin:12px 0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doUploadBank('${existingId||''}')">上传</button></div>
                </div>
            </div>`;
    };

    Admin.doUploadBank = async function(existingId) {
        const file = document.getElementById('upload-bank-file').files[0];
        if (!file) { Utils.showToast('请选择文件', 'error'); return; }
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const r = await this.post('/api/admin/upload-bank', { bank: json, existingId: existingId || null });
            if (r?.ok) { Utils.showToast('上传成功', 'success'); document.querySelector('.modal-mask')?.remove(); this.renderBanks(); }
            else Utils.showToast(r?.error || '失败', 'error');
        } catch (e) { Utils.showToast('JSON格式错误', 'error'); }
    };

    Admin.createBank = function() {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>新建题库</h3>
                    <label>题库ID</label><input id="new-bank-id" placeholder="英文，如 math-101">
                    <label>题库名称</label><input id="new-bank-name" placeholder="如 高等数学">
                    <label>分类</label><input id="new-bank-category" placeholder="如 数学">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doCreateBank()">创建</button></div>
                </div>
            </div>`;
    };

    Admin.doCreateBank = async function() {
        const id = document.getElementById('new-bank-id').value.trim();
        const name = document.getElementById('new-bank-name').value.trim();
        const category = document.getElementById('new-bank-category').value.trim();
        if (!id || !name) { Utils.showToast('请填写ID和名称', 'error'); return; }
        const r = await this.post('/api/admin/create-bank', { id, name, category });
        if (r?.ok) { Utils.showToast('创建成功', 'success'); document.querySelector('.modal-mask')?.remove(); this.renderBanks(); }
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.toggleBank = async function(bankId, enable) {
        const r = await this.put(`/api/admin/bank/${bankId}/toggle`, { enabled: enable });
        if (r?.ok) { Utils.showToast(enable?'已启用':'已禁用', 'success'); this.renderBanks(); }
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.confirmDeleteBank = function(bankId, name) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>确认删除题库？</h3>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">题库: ${Utils.escapeHtml(name)} (${bankId})</p>
                    <p style="font-size:12px;color:var(--danger)">⚠️ 此操作不可恢复，所有题目数据将被删除！</p>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="abtn danger" onclick="Admin.doDeleteBank('${Utils.jsSafe(bankId)}')">确认删除</button></div>
                </div>
            </div>`;
    };

    Admin.doDeleteBank = async function(bankId) {
        const r = await this.delete(`/api/admin/bank/${bankId}`);
        if (r?.ok) { Utils.showToast('已删除', 'success'); document.querySelector('.modal-mask')?.remove(); this.renderBanks(); }
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.viewBankHistory = async function(bankId) {
        const d = await this.get(`/api/admin/bank/${bankId}/history`);
        if (!d?.ok) { Utils.showToast('获取失败', 'error'); return; }
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px;max-height:80vh;overflow-y:auto">
                    <h3>修改历史</h3>
                    <div style="margin-top:12px">${d.history.length ? d.history.map(h => `
                        <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
                            <div style="color:var(--text-tertiary);font-size:11px">${Admin.fmtTime(h.created_at)}</div>
                            <div style="margin-top:4px">${Utils.escapeHtml(h.detail)}</div>
                        </div>
                    `).join('') : '<div class="empty-state">暂无历史</div>'}</div>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    };

    Admin.importQuestions = function(bankId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px">
                    <h3>批量导入题目</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">JSON数组格式，每题含 question, options, answer 等字段</p>
                    <textarea id="import-questions-json" rows="10" placeholder='[{"question":"题目","options":["A.","B."],"answer":"A"}]' style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:monospace"></textarea>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doImportQuestions('${Utils.jsSafe(bankId)}')">导入</button></div>
                </div>
            </div>`;
    };

    Admin.doImportQuestions = async function(bankId) {
        try {
            const questions = JSON.parse(document.getElementById('import-questions-json').value);
            if (!Array.isArray(questions)) throw new Error('需要数组格式');
            const r = await this.post(`/api/admin/bank/${bankId}/import`, { questions });
            if (r?.ok) { Utils.showToast(`已导入 ${r.added} 题`, 'success'); document.querySelector('.modal-mask')?.remove(); this.showBankDetail(bankId); }
            else Utils.showToast(r?.error || '失败', 'error');
        } catch (e) { Utils.showToast('JSON格式错误: ' + e.message, 'error'); }
    };

    // 工具函数
    Admin.fmtTime = function(d) { if (!d) return ''; try { return new Date(d).toLocaleString('zh-CN'); } catch { return ''; } };
}
