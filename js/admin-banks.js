/**
 * 管理后台 - 题库管理
 */
import Utils from './utils.js';

export function initBanks(Admin) {

    Admin.renderBanks = async function() {
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/banks');
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            el.innerHTML = `
                <div id="bank-detail-panel"></div>
                <div class="card">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>题库列表</h3>
                        <div style="display:flex;gap:6px">
                            <button class="abtn primary" style="padding:4px 12px" onclick="Admin.uploadBank()">上传题库</button>
                            <button class="abtn primary" style="padding:4px 12px" onclick="Admin.createBank()">新建题库</button>
                        </div>
                    </div>
                    <div class="card-body" style="overflow-x:auto"><table>
                        <thead><tr><th>题库</th><th>题数</th><th>分类</th><th>版本</th><th>更新时间</th><th>操作</th></tr></thead>
                        <tbody>${d.banks.map(b => `
                            <tr>
                                <td><b>${Utils.escapeHtml(b.name)}</b><br><span style="font-size:10px;color:var(--text-tertiary)">${b.id}</span></td>
                                <td>${b.question_count}</td>
                                <td>${Utils.escapeHtml(b.category||'-')}</td>
                                <td>v${b.version}</td>
                                <td style="font-size:11px">${Admin.fmtTime(b.updated_at)||'-'}</td>
                                <td>
                                    <button class="abtn primary" style="padding:2px 8px;font-size:10px" onclick="Admin.viewBank('${b.id}')">管理</button>
                                    <button class="abtn primary" style="padding:2px 8px;font-size:10px" onclick="Admin.uploadBank('${b.id}')">替换</button>
                                </td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                </div>`;
        } catch (e) { el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    };

    Admin.viewBank = async function(bankId) {
        const p = document.getElementById('bank-detail-panel');
        p.innerHTML = '<div class="loading">加载中...</div>';
        p.scrollIntoView({ behavior: 'smooth' });
        try {
            const d = await this.get(`/api/admin/bank/${bankId}`);
            if (!d?.ok) { p.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            const b = d.bank, qs = b.questions || [];
            p.innerHTML = `
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${Utils.escapeHtml(b.name)} <span style="font-size:11px;color:var(--text-tertiary)">${qs.length}题 · v${b.version}</span></h3>
                        <div style="display:flex;gap:6px">
                            <button class="abtn primary" style="padding:4px 12px" onclick="Admin.addQuestion('${bankId}')">添加题目</button>
                            <button class="abtn" style="padding:4px 12px" onclick="Admin.importQuestions('${bankId}')">批量导入</button>
                            <button class="abtn" style="padding:4px 12px" onclick="Admin.viewBankHistory('${bankId}')">修改历史</button>
                            <button class="abtn" style="padding:4px 12px" onclick="document.getElementById('bank-detail-panel').innerHTML=''">收起</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div style="margin-bottom:8px;display:flex;gap:6px;align-items:center">
                            <input type="text" id="bank-search" placeholder="搜索题目..." style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;background:var(--bg-card);color:var(--text)" oninput="Admin.filterBankQuestions('${bankId}')">
                            <select id="bank-type-filter" style="padding:4px;border:1px solid var(--border);border-radius:var(--radius);font-size:11px;background:var(--bg-card);color:var(--text)" onchange="Admin.filterBankQuestions('${bankId}')">
                                <option value="">全部题型</option><option value="single">单选</option><option value="multiple">多选</option><option value="judge">判断</option><option value="fill">填空</option><option value="essay">简答</option>
                            </select>
                        </div>
                        <div id="bank-questions-list" style="max-height:500px;overflow-y:auto">${this._renderQuestionList(bankId, qs)}</div>
                    </div>
                </div>`;
        } catch (e) { p.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    };

    Admin._renderQuestionList = function(bankId, qs) {
        const typeLabels = {single:'单选',multiple:'多选',judge:'判断',fill:'填空',essay:'简答',multi:'多选'};
        return qs.map(q => `
            <div style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer" onclick="Admin.editQuestion('${bankId}',${q.id})">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="flex:1;min-width:0">
                        <span style="color:var(--text-tertiary);font-size:10px">#${q.id}</span>
                        <span style="background:var(--bg-hover);padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px">${typeLabels[q.type]||q.type||'?'}</span>
                        <span style="margin-left:4px">${Utils.escapeHtml((q.question||'').slice(0,80))}${(q.question||'').length>80?'...':''}</span>
                    </div>
                    <button class="abtn danger" style="padding:1px 6px;font-size:10px;flex-shrink:0" onclick="event.stopPropagation();Admin.deleteQuestion('${bankId}',${q.id})">删除</button>
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

    Admin.uploadBank = function(existingId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px">
                    <h3>${existingId ? '替换题库 ' + existingId : '上传题库'}</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">JSON格式，含 id, name, questions 字段</p>
                    <input type="file" id="upload-bank-file" accept=".json" style="margin:12px 0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doUploadBank('${existingId||''}')">上传</button></div>
                </div>
            </div>`;
    };

    Admin.doUploadBank = async function(existingId) {
        const file = document.getElementById('upload-bank-file').files[0];
        if (!file) { Utils.showToast('请选择文件', 'error'); return; }
        try {
            const data = JSON.parse(await file.text());
            if (!data.id || !data.name || !data.questions) { Utils.showToast('JSON格式错误', 'error'); return; }
            const r = await this.post('/api/admin/import-bank', { id: existingId || data.id, name: data.name, description: data.description || '', category: data.category || '', questions: data.questions });
            if (r?.ok) { Utils.showToast(`已导入 ${r.count} 题`, 'success', 3000); document.querySelector('.modal-mask')?.remove(); this.renderBanks(); }
            else { Utils.showToast(r?.error || '导入失败', 'error'); }
        } catch (e) { Utils.showToast('文件解析失败: ' + e.message, 'error'); }
    };

    Admin.createBank = function() {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>新建题库</h3>
                    <label>题库ID</label><input id="cb-id" placeholder="如 math-basic">
                    <label>题库名称</label><input id="cb-name" placeholder="如 高等数学">
                    <label>描述</label><input id="cb-desc" placeholder="可选">
                    <label>分类</label><input id="cb-cat" placeholder="如: 数学">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doCreateBank()">创建</button></div>
                </div>
            </div>`;
    };

    Admin.doCreateBank = async function() {
        const id = document.getElementById('cb-id').value.trim();
        const name = document.getElementById('cb-name').value.trim();
        if (!id || !name) { Utils.showToast('ID和名称必填', 'error'); return; }
        const r = await this.post('/api/admin/import-bank', { id, name, description: document.getElementById('cb-desc').value.trim(), category: document.getElementById('cb-cat').value.trim(), questions: [] });
        if (r?.ok) { Utils.showToast('题库已创建', 'success'); document.querySelector('.modal-mask')?.remove(); this.renderBanks(); }
    };

    Admin.viewBankHistory = async function(bankId) {
        const d = await this.get(`/api/admin/bank/${bankId}/history`);
        if (!d?.ok) { Utils.showToast('获取失败', 'error'); return; }
        const rows = d.history || [];
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px;max-height:70vh;overflow-y:auto">
                    <h3>修改历史 - ${bankId}</h3>
                    ${rows.length === 0 ? '<div class="empty-state">暂无记录</div>' : rows.map(r => `
                        <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
                            <div style="display:flex;justify-content:space-between">
                                <span>${r.action}: ${Utils.escapeHtml(r.detail||'')}</span>
                                <span style="color:var(--text-tertiary);font-size:10px">${Admin.fmtTime(r.created_at)||''}</span>
                            </div>
                            <div style="font-size:10px;color:var(--text-tertiary)">操作人: ${r.operator||'-'}</div>
                        </div>
                    `).join('')}
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    };

    // 批量导入题目
    Admin.importQuestions = function(bankId) {
        const example = JSON.stringify([
            {
                type: "single",
                question: "题目内容？",
                options: ["选项A", "选项B", "选项C", "选项D"],
                answer: "A",
                explanation: "解析内容",
                category: "分类",
                difficulty: 1
            },
            {
                type: "multiple",
                question: "多选题内容？",
                options: ["选项A", "选项B", "选项C"],
                answer: "AB",
                explanation: "解析",
                category: "分类",
                difficulty: 2
            },
            {
                type: "judge",
                question: "判断题内容？",
                answer: true,
                explanation: "解析",
                category: "分类",
                difficulty: 1
            },
            {
                type: "fill",
                question: "填空题：___是正确的。",
                answer: "答案内容",
                explanation: "解析",
                category: "分类",
                difficulty: 2
            }
        ], null, 2);

        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:600px">
                    <h3>批量导入题目</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">
                        粘贴JSON数组格式的题目数据。支持题型：single/multiple/judge/fill/essay<br>
                        选项可带字母前缀（如 "A. xxx"），会自动去除。答案可用字符串（"AB"）或数组（["A","B"]）。
                    </p>
                    <textarea id="import-json" rows="15" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-card);color:var(--text);font-size:12px;font-family:monospace;resize:vertical;box-sizing:border-box" placeholder='${example}'></textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
                        <span style="font-size:11px;color:var(--text-tertiary)" id="import-status"></span>
                        <div class="modal-actions" style="margin:0">
                            <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                            <button class="mp" onclick="Admin.doImportQuestions('${bankId}')">导入</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.getElementById('import-json').focus();
    };

    Admin.doImportQuestions = async function(bankId) {
        const textarea = document.getElementById('import-json');
        const statusEl = document.getElementById('import-status');
        let questions;

        try {
            questions = JSON.parse(textarea.value.trim());
            if (!Array.isArray(questions)) {
                statusEl.textContent = '❌ 请输入JSON数组格式';
                return;
            }
        } catch (e) {
            statusEl.textContent = '❌ JSON格式错误: ' + e.message;
            return;
        }

        statusEl.textContent = '导入中...';
        const r = await this.post(`/api/admin/bank/${bankId}/import-questions`, { questions });
        if (r?.ok) {
            Utils.showToast(`成功导入 ${r.added} 题，题库共 ${r.total} 题`, 'success', 3000);
            document.querySelector('.modal-mask')?.remove();
            this.viewBank(bankId);
        } else {
            statusEl.textContent = '❌ ' + (r?.error || '导入失败');
        }
    };
}
