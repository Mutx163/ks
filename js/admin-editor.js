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
        const isChoice = type === 'single' || type === 'multiple' || type === 'multi';
        const isJudge = type === 'judge';
        const isEssay = type === 'essay' || type === 'fill';

        // 规范化答案为字符串
        let answerStr = '';
        if (type === 'judge') {
            answerStr = answer === true ? 'true' : answer === false ? 'false' : '';
        } else if (Array.isArray(answer)) {
            answerStr = answer.join('');
        } else {
            answerStr = String(answer || '');
        }

        // 构建选项列表
        let optionsHTML = '';
        if (isChoice) {
            const letters = 'ABCDEFGH';
            const allOpts = [...opts];
            // 确保至少4个选项
            while (allOpts.length < 4) allOpts('');
            optionsHTML = allOpts.map((opt, i) => {
                const letter = letters[i];
                const selected = answerStr.includes(letter);
                return `<div class="qe-opt-item ${selected ? 'selected' : ''}" data-letter="${letter}" onclick="Admin._selectOption('${letter}')">
                    <span class="qe-opt-indicator ${type === 'multiple' || type === 'multi' ? 'checkbox' : 'radio'}">${selected ? (type === 'multiple' || type === 'multi' ? '☑' : '●') : (type === 'multiple' || type === 'multi' ? '☐' : '○')}</span>
                    <span class="qe-opt-letter">${letter}.</span>
                    <input class="qe-opt-input" value="${Utils.escapeHtml(opt)}" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
                    <button class="qe-opt-del" onclick="event.stopPropagation();Admin._removeOption(this)" title="删除选项">✕</button>
                </div>`;
            }).join('');
        }

        // 填空/简答题答案区
        let fillAnswerHTML = '';
        if (isEssay) {
            fillAnswerHTML = `<div class="qe-fill-wrap">
                <textarea id="eq-fill-answer" rows="3" placeholder="输入参考答案..." oninput="Admin._preview()">${Utils.escapeHtml(answerStr)}</textarea>
            </div>`;
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
                            <option value="multiple" ${type==='multiple'||type==='multi'?'selected':''}>多选题</option>
                            <option value="judge" ${type==='judge'?'selected':''}>判断题</option>
                            <option value="fill" ${type==='fill'?'selected':''}>填空题</option>
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
                <div class="qe-field" id="eq-options-wrap" style="${isChoice?'':'display:none'}">
                    <label>选项 <span class="qe-hint">点击选项设为答案</span></label>
                    <div class="qe-opt-list" id="eq-options-list">${optionsHTML}</div>
                    <button type="button" class="qe-add-opt" onclick="Admin._addOption()">+ 添加选项</button>
                </div>
                <div class="qe-field" id="eq-judge-wrap" style="${isJudge?'':'display:none'}">
                    <label>答案</label>
                    <div class="qe-judge-btns">
                        <button type="button" class="qe-judge-btn ${answerStr==='true'?'active':''}" onclick="Admin._setJudge(true)" id="eq-judge-true">正确</button>
                        <button type="button" class="qe-judge-btn ${answerStr==='false'?'active':''}" onclick="Admin._setJudge(false)" id="eq-judge-false">错误</button>
                    </div>
                </div>
                <div class="qe-field" id="eq-fill-wrap" style="${isEssay?'':'display:none'}">
                    <label>参考答案</label>
                    ${fillAnswerHTML}
                </div>
                <input type="hidden" id="eq-answer" value="${Utils.escapeHtml(answerStr)}">
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

    // 选择/取消选择选项作为答案
    Admin._selectOption = function(letter) {
        const type = document.getElementById('eq-type').value;
        const ansEl = document.getElementById('eq-answer');
        let ans = ansEl.value;

        if (type === 'single') {
            // 单选：点击选中，再次点击取消
            ans = ans === letter ? '' : letter;
        } else {
            // 多选：切换选中状态
            ans = ans.includes(letter) ? ans.replace(letter, '') : (ans + letter);
        }
        // 排序答案
        ans = ans.split('').sort().join('');
        ansEl.value = ans;

        // 更新UI
        document.querySelectorAll('#eq-options-list .qe-opt-item').forEach(item => {
            const l = item.dataset.letter;
            const selected = ans.includes(l);
            item.className = `qe-opt-item ${selected ? 'selected' : ''}`;
            const indicator = item.querySelector('.qe-opt-indicator');
            if (type === 'multiple' || type === 'multi') {
                indicator.textContent = selected ? '☑' : '☐';
            } else {
                indicator.textContent = selected ? '●' : '○';
            }
        });
        this._preview();
    };

    Admin._addOption = function() {
        const list = document.getElementById('eq-options-list');
        const idx = list.children.length;
        const letter = 'ABCDEFGH'[idx] || '?';
        const type = document.getElementById('eq-type').value;
        const isMulti = type === 'multiple' || type === 'multi';
        const row = document.createElement('div');
        row.className = 'qe-opt-item';
        row.dataset.letter = letter;
        row.onclick = () => Admin._selectOption(letter);
        row.innerHTML = `<span class="qe-opt-indicator ${isMulti ? 'checkbox' : 'radio'}">${isMulti ? '☐' : '○'}</span>
            <span class="qe-opt-letter">${letter}.</span>
            <input class="qe-opt-input" value="" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
            <button class="qe-opt-del" onclick="event.stopPropagation();Admin._removeOption(this)" title="删除选项">✕</button>`;
        list.appendChild(row);
        this._preview();
    };

    Admin._removeOption = function(btn) {
        const list = document.getElementById('eq-options-list');
        if (list.children.length <= 2) { Utils.showToast('至少保留2个选项', 'error'); return; }
        btn.closest('.qe-opt-item').remove();
        // 重新编号
        const letters = 'ABCDEFGH';
        Array.from(list.children).forEach((row, i) => {
            row.dataset.letter = letters[i];
            row.querySelector('.qe-opt-letter').textContent = letters[i] + '.';
            row.onclick = () => Admin._selectOption(letters[i]);
            row.querySelector('.qe-opt-del').onclick = (e) => { e.stopPropagation(); Admin._removeOption(row.querySelector('.qe-opt-del')); };
        });
        // 更新答案（移除不存在的字母）
        const ansEl = document.getElementById('eq-answer');
        const maxLetter = letters[list.children.length - 1];
        let ans = ansEl.value.split('').filter(l => l <= maxLetter).join('');
        ansEl.value = ans;
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
        const isChoice = type === 'single' || type === 'multiple' || type === 'multi';
        const isJudge = type === 'judge';
        const isEssay = type === 'essay' || type === 'fill';

        document.getElementById('eq-options-wrap').style.display = isChoice ? '' : 'none';
        document.getElementById('eq-judge-wrap').style.display = isJudge ? '' : 'none';
        document.getElementById('eq-fill-wrap').style.display = isEssay ? '' : 'none';

        // 重置答案
        document.getElementById('eq-answer').value = '';
        if (isEssay) {
            document.getElementById('eq-fill-answer').value = '';
        }

        // 如果切换到选择题，重建选项
        if (isChoice) {
            const list = document.getElementById('eq-options-list');
            const currentOpts = [];
            list.querySelectorAll('.qe-opt-input').forEach(inp => {
                if (inp.value.trim()) currentOpts.push(inp.value.trim());
            });
            // 重新渲染选项
            const letters = 'ABCDEFGH';
            const isMulti = type === 'multiple' || type === 'multi';
            list.innerHTML = currentOpts.map((opt, i) => `
                <div class="qe-opt-item" data-letter="${letters[i]}" onclick="Admin._selectOption('${letters[i]}')">
                    <span class="qe-opt-indicator ${isMulti ? 'checkbox' : 'radio'}">${isMulti ? '☐' : '○'}</span>
                    <span class="qe-opt-letter">${letters[i]}.</span>
                    <input class="qe-opt-input" value="${Utils.escapeHtml(opt)}" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
                    <button class="qe-opt-del" onclick="event.stopPropagation();Admin._removeOption(this)" title="删除选项">✕</button>
                </div>
            `).join('');
            // 确保至少4个选项
            while (list.children.length < 4) this._addOption();
        }

        this._preview();
    };

    Admin._setJudge = function(val) {
        const boolVal = val === true || val === 'true';
        document.getElementById('eq-answer').value = boolVal ? 'true' : 'false';
        document.getElementById('eq-judge-true').className = boolVal ? 'qe-judge-btn active' : 'qe-judge-btn';
        document.getElementById('eq-judge-false').className = !boolVal ? 'qe-judge-btn active' : 'qe-judge-btn';
        this._preview();
    };

    Admin._collectQuestion = function() {
        const type = document.getElementById('eq-type').value;
        const isChoice = type === 'single' || type === 'multiple' || type === 'multi';
        const isJudge = type === 'judge';
        const isEssay = type === 'essay' || type === 'fill';

        // 收集选项
        let options = [];
        if (isChoice) {
            document.querySelectorAll('#eq-options-list .qe-opt-input').forEach(inp => {
                const v = inp.value.trim();
                if (v) options.push(v);
            });
        }

        // 收集答案
        let answer = '';
        if (isJudge) {
            answer = document.getElementById('eq-answer').value === 'true';
        } else if (isEssay) {
            answer = document.getElementById('eq-fill-answer')?.value?.trim() || '';
        } else {
            answer = document.getElementById('eq-answer').value;
        }

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
        const typeLabel = {single:'单选',multiple:'多选',multi:'多选',judge:'判断',fill:'填空',essay:'简答'}[type] || type;
        const isChoice = type === 'single' || type === 'multiple' || type === 'multi';
        const isJudge = type === 'judge';
        const isEssay = type === 'essay' || type === 'fill';

        // 收集选项
        let options = [];
        if (isChoice) {
            document.querySelectorAll('#eq-options-list .qe-opt-input').forEach(inp => {
                const v = inp.value.trim();
                if (v) options.push(v);
            });
        }

        // 填空题答案
        let fillAnswer = '';
        if (isEssay) {
            fillAnswer = document.getElementById('eq-fill-answer')?.value || '';
        }

        let html = '<div class="qe-preview-card">';
        html += '<div class="qe-preview-meta">';
        if (category) html += `<span class="qe-preview-tag">${Utils.escapeHtml(category)}</span>`;
        html += `<span class="qe-preview-tag type">${typeLabel}</span>`;
        html += `<span class="qe-preview-tag">${'★'.repeat(difficulty)}${'☆'.repeat(3-difficulty)}</span>`;
        html += '</div>';
        html += `<div class="qe-preview-question">${Utils.escapeHtml(question) || '<span style="color:var(--text-tertiary)">题目内容...</span>'}</div>`;

        if (isJudge) {
            html += '<div class="qe-preview-opts">';
            html += `<div class="qe-preview-opt ${answer==='true'?'selected':''}">正确</div>`;
            html += `<div class="qe-preview-opt ${answer==='false'?'selected':''}">错误</div>`;
            html += '</div>';
        } else if (isChoice) {
            html += '<div class="qe-preview-opts">';
            options.forEach((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const sel = (answer||'').includes(letter);
                html += `<div class="qe-preview-opt ${sel?'selected':''}"><b>${letter}.</b> ${Utils.escapeHtml(opt)}</div>`;
            });
            html += '</div>';
        } else if (isEssay && fillAnswer) {
            html += `<div class="qe-preview-answer"><b>参考答案：</b>${Utils.escapeHtml(fillAnswer)}</div>`;
        }

        if (answer && !isJudge && !isEssay) {
            html += `<div class="qe-preview-answer">答案: <b>${Utils.escapeHtml(String(answer))}</b></div>`;
        }
        if (explanation) {
            html += `<div class="qe-preview-explain"><div class="qe-preview-explain-label">解析</div><div class="qe-preview-explain-text">${Utils.escapeHtml(explanation)}</div></div>`;
        }
        html += '</div>';
        el.innerHTML = html;
    };
}
