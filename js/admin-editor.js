/**
 * 管理后台 - 题目编辑器
 */
import Utils from './utils.js';

export function initEditor(Admin) {

    Admin.addQuestion = function(bankId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="qe-modal">
                    <div class="qe-header"><h3>添加题目</h3><button class="close-btn" onclick="this.closest('.modal-mask').remove()">✕</button></div>
                    ${this._editorHTML(bankId, null, true)}
                </div>
            </div>`;
        this._preview();
    };

    Admin.editQuestion = async function(bankId, qid) {
        const d = await this.get(`/api/admin/bank/${bankId}`);
        if (!d?.ok) return;
        const q = (d.bank.questions || []).find(x => x.id === qid);
        if (!q) { Utils.showToast('题目不存在', 'error'); return; }
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="qe-modal">
                    <div class="qe-header"><h3>编辑题目 #${qid}</h3><button class="close-btn" onclick="this.closest('.modal-mask').remove()">✕</button></div>
                    ${this._editorHTML(bankId, q, false)}
                </div>
            </div>`;
        this._preview();
    };

    Admin._editorHTML = function(bankId, q, isNew) {
        const type = q?.type || 'single';
        const answer = q?.answer;
        const opts = q?.options || [];
        const diff = q?.difficulty || 1;

        // 构建选项输入框
        let optionsHTML = '';
        if (type !== 'judge' && type !== 'essay') {
            const letters = 'ABCDEFGH';
            optionsHTML = opts.map((opt, i) => `
                <div class="qe-opt-row" data-idx="${i}">
                    <span class="qe-opt-letter">${letters[i] || '?'}</span>
                    <input class="qe-opt-input" value="${Utils.escapeHtml(opt)}" placeholder="选项${letters[i] || (i+1)}" oninput="Admin._preview()">
                    <button class="qe-opt-del" onclick="Admin._removeOption(${i})" title="删除">✕</button>
                </div>
            `).join('');
            // 至少显示4个空选项
            for (let i = opts.length; i < 4; i++) {
                optionsHTML += `
                    <div class="qe-opt-row" data-idx="${i}">
                        <span class="qe-opt-letter">${letters[i]}</span>
                        <input class="qe-opt-input" value="" placeholder="选项${letters[i]}" oninput="Admin._preview()">
                        <button class="qe-opt-del" onclick="Admin._removeOption(${i})" title="删除">✕</button>
                    </div>`;
            }
        }

        // 答案显示
        let answerDisplay = '';
        if (type === 'judge') {
            answerDisplay = `<div class="qe-judge-btns" id="eq-judge-wrap">
                <button type="button" class="qe-judge-btn ${answer===true?'active':''}" onclick="Admin._setJudge(true)" id="eq-judge-true">✓ 正确</button>
                <button type="button" class="qe-judge-btn ${answer===false?'active':''}" onclick="Admin._setJudge(false)" id="eq-judge-false">✗ 错误</button>
            </div>`;
        } else if (type !== 'essay') {
            const letters = 'ABCDEFGH';
            answerDisplay = `<div class="qe-answer-btns" id="eq-answer-btns">
                ${letters.split('').map(l => `<button type="button" class="qe-ans-btn ${(answer||[]).join('').includes(l) || answer===l?'active':''}" onclick="Admin._toggleAnswer('${l}')" id="eq-ans-${l}">${l}</button>`).join('')}
            </div>`;
        }

        // 规范化答案为字符串
        let answerStr = '';
        if (type === 'judge') {
            answerStr = answer === true ? 'true' : answer === false ? 'false' : '';
        } else if (Array.isArray(answer)) {
            answerStr = answer.join('');
        } else {
            answerStr = String(answer || '');
        }

        return `
        <div class="qe-tabs">
            <button class="qe-tab active" onclick="Admin._switchEditorTab('edit')" id="qe-tab-edit">编辑</button>
            <button class="qe-tab" onclick="Admin._switchEditorTab('preview')" id="qe-tab-preview">预览</button>
        </div>
        <div class="qe-body">
            <div class="qe-panel active" id="qe-panel-edit">
                <div class="qe-row">
                    <div class="qe-field">
                        <label>题型</label>
                        <select id="eq-type" onchange="Admin._onTypeChange()">
                            <option value="single" ${type==='single'?'selected':''}>单选题</option>
                            <option value="multi" ${type==='multi'?'selected':''}>多选题</option>
                            <option value="judge" ${type==='judge'?'selected':''}>判断题</option>
                            <option value="essay" ${type==='essay'?'selected':''}>简答题</option>
                        </select>
                    </div>
                    <div class="qe-field">
                        <label>难度</label>
                        <div class="qe-stars" id="eq-diff-stars">
                            ${[1,2,3].map(i => `<span class="qe-star ${i<=diff?'on':''}" onclick="Admin._setDiff(${i})">★</span>`).join('')}
                        </div>
                        <input type="hidden" id="eq-difficulty" value="${diff}">
                    </div>
                </div>
                <div class="qe-field">
                    <label>分类</label>
                    <input id="eq-category" value="${Utils.escapeHtml(q?.category||'')}" placeholder="如: 编程指令">
                </div>
                <div class="qe-field">
                    <label>题目内容</label>
                    <textarea id="eq-question" rows="3" placeholder="输入题目内容..." oninput="Admin._preview()">${Utils.escapeHtml(q?.question||'')}</textarea>
                </div>
                <div class="qe-field" id="eq-options-wrap" style="${type==='judge'||type==='essay'?'display:none':''}">
                    <label>选项</label>
                    <div id="eq-options-list">${optionsHTML}</div>
                    <button type="button" class="qe-add-opt" onclick="Admin._addOption()">+ 添加选项</button>
                </div>
                <div class="qe-field">
                    <label>答案</label>
                    ${answerDisplay}
                    <input type="hidden" id="eq-answer" value="${Utils.escapeHtml(answerStr)}">
                </div>
                <div class="qe-field">
                    <label>解析 <span class="qe-hint">可选</span></label>
                    <textarea id="eq-explanation" rows="3" placeholder="答案解析..." oninput="Admin._preview()">${Utils.escapeHtml(q?.explanation||'')}</textarea>
                </div>
            </div>
            <div class="qe-panel" id="qe-panel-preview"><div id="eq-preview"></div></div>
        </div>
        <div class="qe-footer">
            <span class="qe-info">${isNew ? '新题目' : 'ID: ' + q.id}</span>
            <div class="qe-actions">
                <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                <button class="mp" onclick="${isNew ? `Admin.saveNewQuestion('${bankId}')` : `Admin.saveEditQuestion('${bankId}',${q.id})`}">${isNew ? '添加' : '保存'}</button>
            </div>
        </div>`;
    };

    Admin._addOption = function() {
        const list = document.getElementById('eq-options-list');
        const idx = list.children.length;
        const letter = 'ABCDEFGH'[idx] || '?';
        const row = document.createElement('div');
        row.className = 'qe-opt-row';
        row.dataset.idx = idx;
        row.innerHTML = `<span class="qe-opt-letter">${letter}</span><input class="qe-opt-input" value="" placeholder="选项${letter}" oninput="Admin._preview()"><button class="qe-opt-del" onclick="Admin._removeOption(${idx})" title="删除">✕</button>`;
        list.appendChild(row);
        this._preview();
    };

    Admin._removeOption = function(idx) {
        const list = document.getElementById('eq-options-list');
        if (list.children.length <= 2) { Utils.showToast('至少保留2个选项', 'error'); return; }
        list.children[idx]?.remove();
        // 重新编号
        Array.from(list.children).forEach((row, i) => {
            row.dataset.idx = i;
            row.querySelector('.qe-opt-letter').textContent = 'ABCDEFGH'[i] || '?';
            row.querySelector('.qe-opt-input').placeholder = `选项${'ABCDEFGH'[i] || (i+1)}`;
            row.querySelector('.qe-opt-del').onclick = () => Admin._removeOption(i);
        });
        this._preview();
    };

    Admin._switchEditorTab = function(tab) {
        document.getElementById('qe-tab-edit').className = tab === 'edit' ? 'qe-tab active' : 'qe-tab';
        document.getElementById('qe-tab-preview').className = tab === 'preview' ? 'qe-tab active' : 'qe-tab';
        document.getElementById('qe-panel-edit').className = tab === 'edit' ? 'qe-panel active' : 'qe-panel';
        document.getElementById('qe-panel-preview').className = tab === 'preview' ? 'qe-panel active' : 'qe-panel';
        if (tab === 'preview') this._preview();
    };

    Admin._setDiff = function(n) {
        document.getElementById('eq-difficulty').value = n;
        document.querySelectorAll('#eq-diff-stars .qe-star').forEach((s, i) => {
            s.className = i < n ? 'qe-star on' : 'qe-star';
        });
        this._preview();
    };

    Admin._onTypeChange = function() {
        const type = document.getElementById('eq-type').value;
        document.getElementById('eq-options-wrap').style.display = type === 'judge' || type === 'essay' ? 'none' : '';
        document.getElementById('eq-answer-btns') && (document.getElementById('eq-answer-btns').style.display = type === 'judge' || type === 'essay' ? 'none' : '');
        document.getElementById('eq-judge-wrap') && (document.getElementById('eq-judge-wrap').style.display = type === 'judge' ? 'flex' : 'none');
        document.getElementById('eq-answer').value = '';
        this._preview();
    };

    Admin._toggleAnswer = function(letter) {
        const type = document.getElementById('eq-type').value;
        const ansEl = document.getElementById('eq-answer');
        let ans = ansEl.value;
        if (type === 'single') { ans = letter; }
        else { ans = ans.includes(letter) ? ans.replace(letter, '') : (ans + letter); }
        ansEl.value = ans;
        'ABCDEFGH'.split('').forEach(l => {
            const btn = document.getElementById('eq-ans-' + l);
            if (btn) btn.className = ans.includes(l) ? 'qe-ans-btn active' : 'qe-ans-btn';
        });
        this._preview();
    };

    Admin._setJudge = function(val) {
        document.getElementById('eq-answer').value = val;
        document.getElementById('eq-judge-true').className = val === true ? 'qe-judge-btn active' : 'qe-judge-btn';
        document.getElementById('eq-judge-false').className = val === false ? 'qe-judge-btn active' : 'qe-judge-btn';
        this._preview();
    };

    Admin._collectQuestion = function() {
        const type = document.getElementById('eq-type').value;
        // 从输入框收集选项
        let options = [];
        if (type !== 'judge' && type !== 'essay') {
            document.querySelectorAll('#eq-options-list .qe-opt-input').forEach(inp => {
                const v = inp.value.trim();
                if (v) options.push(v);
            });
        }
        let answer = document.getElementById('eq-answer').value;
        if (type === 'judge') answer = answer === 'true' || answer === true;

        const question = {
            type,
            category: document.getElementById('eq-category').value.trim(),
            difficulty: parseInt(document.getElementById('eq-difficulty').value) || 1,
            question: document.getElementById('eq-question').value.trim(),
            options,
            answer,
            explanation: document.getElementById('eq-explanation').value.trim()
        };
        if (!question.question) { Utils.showToast('题目内容不能为空', 'error'); return null; }
        return question;
    };

    Admin.saveNewQuestion = async function(bankId) {
        const question = this._collectQuestion();
        if (!question) return;
        const r = await this.post(`/api/admin/bank/${bankId}/question`, { question });
        if (r?.ok) { Utils.showToast('已添加', 'success'); document.querySelector('.modal-mask')?.remove(); this.viewBank(bankId); }
        else { Utils.showToast(r?.error || '添加失败', 'error'); }
    };

    Admin.saveEditQuestion = async function(bankId, qid) {
        const question = this._collectQuestion();
        if (!question) return;
        const r = await this.put(`/api/admin/bank/${bankId}/question/${qid}`, { question });
        if (r?.ok) { Utils.showToast('已保存', 'success'); document.querySelector('.modal-mask')?.remove(); this.viewBank(bankId); }
        else { Utils.showToast(r?.error || '保存失败', 'error'); }
    };

    Admin.deleteQuestion = async function(bankId, qid) {
        if (!confirm(`确定删除题目 #${qid}？`)) return;
        const r = await this.post(`/api/admin/bank/${bankId}/question/${qid}`, {});
        if (r?.ok) { Utils.showToast('已删除', 'success'); this.viewBank(bankId); }
    };

    Admin._preview = function() {
        const el = document.getElementById('eq-preview');
        if (!el) return;
        const type = document.getElementById('eq-type').value;
        const question = document.getElementById('eq-question').value;
        const answer = document.getElementById('eq-answer').value;
        const explanation = document.getElementById('eq-explanation').value;
        const difficulty = parseInt(document.getElementById('eq-difficulty').value) || 1;
        const category = document.getElementById('eq-category').value;
        const typeLabel = {single:'单选',multi:'多选',judge:'判断',essay:'简答'}[type] || type;

        // 收集选项
        let options = [];
        if (type !== 'judge' && type !== 'essay') {
            document.querySelectorAll('#eq-options-list .qe-opt-input').forEach(inp => {
                const v = inp.value.trim();
                if (v) options.push(v);
            });
        }

        let html = '<div class="qe-preview-card">';
        html += '<div class="qe-preview-meta">';
        if (category) html += `<span class="qe-preview-tag">${Utils.escapeHtml(category)}</span>`;
        html += `<span class="qe-preview-tag type">${typeLabel}</span>`;
        html += `<span class="qe-preview-tag">${'★'.repeat(difficulty)}${'☆'.repeat(3-difficulty)}</span>`;
        html += '</div>';
        html += `<div class="qe-preview-question">${Utils.escapeHtml(question) || '<span style="color:var(--text-tertiary)">题目内容...</span>'}</div>`;

        if (type === 'judge') {
            html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
            html += `<div class="qe-preview-opt ${answer===true?'selected':''}">✓ 正确</div>`;
            html += `<div class="qe-preview-opt ${answer===false?'selected':''}">✗ 错误</div>`;
            html += '</div>';
        } else if (type !== 'essay') {
            options.forEach((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const sel = (answer||'').includes(letter);
                html += `<div class="qe-preview-opt ${sel?'selected':''}"><b>${letter}.</b> ${Utils.escapeHtml(opt)}</div>`;
            });
        }

        if (answer && type !== 'judge') {
            html += `<div class="qe-preview-answer">答案: <b>${Utils.escapeHtml(String(answer))}</b></div>`;
        }
        if (explanation) {
            html += `<div class="qe-preview-explain"><div class="qe-preview-explain-label">解析</div><div class="qe-preview-explain-text">${Utils.escapeHtml(explanation)}</div></div>`;
        }
        html += '</div>';
        el.innerHTML = html;
    };
}
