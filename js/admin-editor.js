/**
 * 管理后台 - 题目编辑器
 */
import Utils from './utils.js';
import ImageUploader from './imageUploader.js';

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
        const isCode = type === 'code';

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
            const allOpts = opts.map(opt => {
                // 支持字符串或对象格式
                if (typeof opt === 'string') return { text: opt, img: '' };
                return { text: opt.text || '', img: opt.img || '' };
            });
            // 确保至少4个选项
            while (allOpts.length < 4) allOpts.push({ text: '', img: '' });
            optionsHTML = allOpts.map((opt, i) => {
                const letter = letters[i];
                const selected = answerStr.includes(letter);
                const imgPreview = opt.img ? `<img src="${Utils.escapeHtml(opt.img)}" style="max-width:60px;max-height:40px;border-radius:4px;margin-left:4px;vertical-align:middle;border:1px solid var(--border)">` : '';
                const deleteImgBtn = opt.img ? `<button type="button" class="abtn danger" style="padding:1px 4px;font-size:10px" onclick="event.stopPropagation();Admin._removeOptionImage(this)" title="删除选项图片">🗑️</button>` : '';
                return `<div class="qe-opt-item ${selected ? 'selected' : ''}" data-letter="${letter}" onclick="Admin._selectOption('${letter}')">
                    <span class="qe-opt-indicator ${type === 'multiple' || type === 'multi' ? 'checkbox' : 'radio'}">${selected ? (type === 'multiple' || type === 'multi' ? '☑' : '●') : (type === 'multiple' || type === 'multi' ? '☐' : '○')}</span>
                    <span class="qe-opt-letter">${letter}.</span>
                    <input class="qe-opt-input" value="${Utils.escapeHtml(opt.text)}" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
                    <input type="hidden" class="qe-opt-img" value="${Utils.escapeHtml(opt.img)}">
                    ${imgPreview}
                    <button type="button" class="abtn" style="padding:1px 4px;font-size:10px" onclick="event.stopPropagation();Admin._uploadOptionImage(this)" title="添加选项图片">📷</button>
                    ${deleteImgBtn}
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

        // 编程题代码区
        const codeLanguage = q?.codeLanguage || 'c';
        const codeContent = q?.code || '';
        let codeEditorHTML = '';
        if (isCode) {
            codeEditorHTML = `<div class="qe-fill-wrap">
                <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                    <label style="font-size:12px;font-weight:600;">代码语言：</label>
                    <select id="eq-code-lang" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg-card);color:var(--text)">
                        <option value="c" ${codeLanguage==='c'?'selected':''}>C</option>
                        <option value="cpp" ${codeLanguage==='cpp'?'selected':''}>C++</option>
                        <option value="java" ${codeLanguage==='java'?'selected':''}>Java</option>
                        <option value="python" ${codeLanguage==='python'?'selected':''}>Python</option>
                        <option value="javascript" ${codeLanguage==='javascript'?'selected':''}>JavaScript</option>
                        <option value="go" ${codeLanguage==='go'?'selected':''}>Go</option>
                        <option value="rust" ${codeLanguage==='rust'?'selected':''}>Rust</option>
                        <option value="sql" ${codeLanguage==='sql'?'selected':''}>SQL</option>
                    </select>
                </div>
                <textarea id="eq-code" rows="8" placeholder="输入代码..." style="font-family:monospace;font-size:13px;line-height:1.5" oninput="Admin._preview()">${Utils.escapeHtml(codeContent)}</textarea>
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
                            <option value="code" ${type==='code'?'selected':''}>编程题</option>
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
                    <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
                        <button type="button" class="abtn primary" style="padding:4px 10px;font-size:11px" onclick="Admin._uploadQuestionImage()">📷 添加题目图片</button>
                        <input type="text" id="eq-img" value="${Utils.escapeHtml(q?.img||q?.image||'')}" placeholder="或直接输入图片URL" style="flex:1;padding:4px 8px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-card);color:var(--text)">
                    </div>
                    <div id="eq-img-preview" style="${q?.img||q?.image?'':'display:none'};margin-top:6px">
                        <img id="eq-img-thumb" src="${Utils.escapeHtml(q?.img||q?.image||'')}" style="max-width:200px;max-height:100px;border-radius:var(--radius);border:1px solid var(--border)">
                        <button type="button" class="abtn danger" style="padding:2px 6px;font-size:10px;margin-left:4px" onclick="Admin._removeQuestionImage()">删除</button>
                    </div>
                </div>
                <div class="qe-field" id="eq-options-wrap" style="${isChoice?'':'display:none'}">
                    <label>选项 <span class="qe-hint">点击选项设为答案 | 支持选项图片</span></label>
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
                <div class="qe-field" id="eq-code-wrap" style="${isCode?'':'display:none'}">
                    <label>代码 <span class="qe-hint">支持代码高亮</span></label>
                    ${codeEditorHTML}
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
            <input type="hidden" class="qe-opt-img" value="">
            <button type="button" class="abtn" style="padding:1px 4px;font-size:10px" onclick="event.stopPropagation();Admin._uploadOptionImage(this)" title="添加选项图片">📷</button>
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
        const isCode = type === 'code';

        document.getElementById('eq-options-wrap').style.display = isChoice ? '' : 'none';
        document.getElementById('eq-judge-wrap').style.display = isJudge ? '' : 'none';
        document.getElementById('eq-fill-wrap').style.display = isEssay ? '' : 'none';
        document.getElementById('eq-code-wrap').style.display = isCode ? '' : 'none';

        // 重置答案
        document.getElementById('eq-answer').value = '';
        if (isEssay) {
            document.getElementById('eq-fill-answer').value = '';
        }
        if (isCode && !document.getElementById('eq-code')) {
            // 如果切换到编程题但代码编辑器不存在，需要创建
            const codeWrap = document.getElementById('eq-code-wrap');
            codeWrap.innerHTML = `
                <label>代码 <span class="qe-hint">支持代码高亮</span></label>
                <div class="qe-fill-wrap">
                    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                        <label style="font-size:12px;font-weight:600;">代码语言：</label>
                        <select id="eq-code-lang" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg-card);color:var(--text)">
                            <option value="c">C</option>
                            <option value="cpp">C++</option>
                            <option value="java">Java</option>
                            <option value="python">Python</option>
                            <option value="javascript">JavaScript</option>
                            <option value="go">Go</option>
                            <option value="rust">Rust</option>
                            <option value="sql">SQL</option>
                        </select>
                    </div>
                    <textarea id="eq-code" rows="8" placeholder="输入代码..." style="font-family:monospace;font-size:13px;line-height:1.5" oninput="Admin._preview()"></textarea>
                </div>`;
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
        const isCode = type === 'code';

        // 收集选项（支持图片）
        let options = [];
        if (isChoice) {
            document.querySelectorAll('#eq-options-list .qe-opt-item').forEach(item => {
                const text = item.querySelector('.qe-opt-input').value.trim();
                const img = item.querySelector('.qe-opt-img')?.value?.trim() || '';
                if (text || img) {
                    // 始终使用对象格式，方便管理图片
                    options.push({ text, img: img || '' });
                }
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

        // 收集题目图片
        const img = document.getElementById('eq-img')?.value?.trim() || '';

        const question = {
            type,
            category: document.getElementById('eq-category').value.trim(),
            difficulty: parseInt(document.getElementById('eq-difficulty').value) || 1,
            question: document.getElementById('eq-question').value.trim(),
            img: img || '',  // 使用空字符串而不是 undefined
            options,
            answer,
            explanation: document.getElementById('eq-explanation').value.trim()
        };

        // 编程题额外字段
        if (isCode) {
            question.code = document.getElementById('eq-code')?.value || '';
            question.codeLanguage = document.getElementById('eq-code-lang')?.value || 'c';
        }

        if (!question.question) { Utils.showToast('题目内容不能为空', 'error'); return null; }
        return question;
    };

    // 上传题目图片
    Admin._uploadQuestionImage = function() {
        ImageUploader.showDialog((url) => {
            document.getElementById('eq-img').value = url;
            const preview = document.getElementById('eq-img-preview');
            const thumb = document.getElementById('eq-img-thumb');
            thumb.src = url;
            preview.style.display = 'block';
            this._preview();
        });
    };

    // 删除题目图片
    Admin._removeQuestionImage = function() {
        document.getElementById('eq-img').value = '';
        document.getElementById('eq-img-preview').style.display = 'none';
        this._preview();
    };

    // 上传选项图片
    Admin._uploadOptionImage = function(btn) {
        ImageUploader.showDialog((url) => {
            const item = btn.closest('.qe-opt-item');
            const imgInput = item.querySelector('.qe-opt-img');
            imgInput.value = url;
            // 更新预览
            let imgPreview = item.querySelector('img');
            if (!imgPreview) {
                imgPreview = document.createElement('img');
                imgPreview.style.cssText = 'max-width:60px;max-height:40px;border-radius:4px;margin-left:4px;vertical-align:middle;border:1px solid var(--border)';
                btn.parentNode.insertBefore(imgPreview, btn);
            }
            imgPreview.src = url;
            // 添加删除按钮（如果没有）
            let deleteBtn = item.querySelector('.opt-img-delete');
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'abtn danger opt-img-delete';
                deleteBtn.style.cssText = 'padding:1px 4px;font-size:10px';
                deleteBtn.textContent = '🗑️';
                deleteBtn.title = '删除选项图片';
                deleteBtn.onclick = (e) => { e.stopPropagation(); Admin._removeOptionImage(deleteBtn); };
                btn.parentNode.insertBefore(deleteBtn, btn.nextSibling);
            }
            this._preview();
        });
    };

    // 删除选项图片
    Admin._removeOptionImage = function(btn) {
        const item = btn.closest('.qe-opt-item');
        const imgInput = item.querySelector('.qe-opt-img');
        imgInput.value = '';
        // 移除图片预览
        const imgPreview = item.querySelector('img');
        if (imgPreview) imgPreview.remove();
        // 移除删除按钮
        btn.remove();
        this._preview();
    };

    Admin.saveNewQuestion = async function(bankId) {
        const question = this._collectQuestion();
        if (!question) return;
        const btn = document.querySelector('.qe-footer .abtn.primary');
        if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
        const r = await this.post(`/api/admin/bank/${bankId}/question`, { question });
        if (r?.ok) { 
            Utils.showToast('已添加', 'success'); 
            document.querySelector('.modal-mask')?.remove(); 
            // 刷新题目列表
            this.viewBank(bankId);
        } else { 
            Utils.showToast(r?.error || '添加失败', 'error'); 
            if (btn) { btn.disabled = false; btn.textContent = '保存'; }
        }
    };

    Admin.saveEditQuestion = async function(bankId, qid) {
        const question = this._collectQuestion();
        if (!question) return;
        const btn = document.querySelector('.qe-footer .abtn.primary');
        if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
        const r = await this.put(`/api/admin/bank/${bankId}/question/${qid}`, { question });
        if (r?.ok) { 
            Utils.showToast('已保存', 'success'); 
            document.querySelector('.modal-mask')?.remove(); 
            // 更新列表中该题目的显示，而不是重新加载整个列表
            this._updateQuestionInList(bankId, qid, question);
        } else { 
            Utils.showToast(r?.error || '保存失败', 'error'); 
            if (btn) { btn.disabled = false; btn.textContent = '保存'; }
        }
    };

    // 更新列表中单个题目的显示
    Admin._updateQuestionInList = function(bankId, qid, question) {
        const item = document.querySelector(`.question-item[data-qid="${qid}"]`);
        if (!item) return;
        
        // 更新题目预览
        const preview = item.querySelector('.question-preview');
        if (preview) {
            const qText = question.question || '';
            preview.textContent = qText.length > 60 ? qText.substring(0, 60) + '...' : qText;
        }
        
        // 更新题型标签
        const typeTag = item.querySelector('.question-type');
        if (typeTag) {
            const typeLabels = {single:'单选',multiple:'多选',multi:'多选',judge:'判断',fill:'填空',essay:'简答'};
            typeTag.textContent = typeLabels[question.type] || question.type;
        }
        
        // 更新分类
        const catTag = item.querySelector('.question-category');
        if (catTag && question.category) {
            catTag.textContent = question.category;
        }
        
        // 高亮显示已更新
        item.style.background = 'var(--success-light)';
        setTimeout(() => { item.style.background = ''; }, 1500);
    };

    Admin.deleteQuestion = async function(bankId, qid) {
        if (!confirm(`确定删除题目 #${qid}？`)) return;
        const r = await this.post(`/api/admin/bank/${bankId}/question/${qid}`, {});
        if (r?.ok) { 
            Utils.showToast('已删除', 'success'); 
            // 从列表中移除该题目
            const item = document.querySelector(`.question-item[data-qid="${qid}"]`);
            if (item) {
                item.style.opacity = '0';
                item.style.transform = 'translateX(20px)';
                setTimeout(() => item.remove(), 300);
            } else {
                this.viewBank(bankId);
            }
        }
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
        const typeLabel = {single:'单选',multiple:'多选',multi:'多选',judge:'判断',fill:'填空',essay:'简答',code:'编程'}[type] || type;
        const isChoice = type === 'single' || type === 'multiple' || type === 'multi';
        const isJudge = type === 'judge';
        const isEssay = type === 'essay' || type === 'fill';
        const isCode = type === 'code';

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

        // 编程题代码
        let codeContent = '';
        let codeLang = 'c';
        if (isCode) {
            codeContent = document.getElementById('eq-code')?.value || '';
            codeLang = document.getElementById('eq-code-lang')?.value || 'c';
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
        } else if (isCode && codeContent) {
            html += `<div class="qe-preview-answer" style="margin-top:8px">
                <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">代码 (${codeLang})</div>
                <pre style="background:var(--bg-hover);padding:12px;border-radius:var(--radius);font-family:monospace;font-size:13px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;margin:0">${Utils.escapeHtml(codeContent)}</pre>
            </div>`;
        }

        if (answer && !isJudge && !isEssay && !isCode) {
            html += `<div class="qe-preview-answer">答案: <b>${Utils.escapeHtml(String(answer))}</b></div>`;
        }
        if (explanation) {
            html += `<div class="qe-preview-explain"><div class="qe-preview-explain-label">解析</div><div class="qe-preview-explain-text">${Utils.escapeHtml(explanation)}</div></div>`;
        }
        html += '</div>';
        el.innerHTML = html;
    };
}
