/**
 * 刷题页面模块
 * 处理答题逻辑、进度管理等
 */

import Storage from './storage.js';
import Utils from './utils.js';

const Quiz = {
    state: {
        bankId: null,
        bank: null,
        questions: [],
        currentIndex: 0,
        mode: 'all',
        answers: {},
        submitted: {},
        showExplanation: {},
        isFinished: false,
        startTime: null,
        questionStartTime: null,
        questionTimes: {},
        examTimeLimit: 0,
        examPassRate: 60,
        examTimeRemaining: 0,
        examTimer: null,
        autoNext: false,
        filterType: 'all',
        lightningMode: false,
        isReviewMode: false,
        optionOrderCache: {}
    },

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.state.bankId = params.get('bank');
        this.state.mode = params.get('mode') || 'all';
        this.state.filterType = params.get('type') || 'all';
        this.state.lightningMode = params.get('lightning') === '1';
        this.state.examTimeLimit = parseInt(params.get('time')) || 0;
        this.state.examPassRate = parseInt(params.get('pass')) || 60;

        // 搜索模式关键词
        if (this.state.mode === 'search') {
            this.state.searchKeyword = params.get('q') || '';
        }

        // 从设置读取 autoNext
        const settings = Storage.getSettings();
        this.state.autoNext = settings.autoNext || false;

        if (!this.state.bankId) {
            Utils.showToast('缺少题库参数', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        this.state.bank = Storage.getBank(this.state.bankId);
        if (!this.state.bank || !Array.isArray(this.state.bank.questions)) {
            await this.loadBankFromJson();
        }
        if (!this.state.bank || !Array.isArray(this.state.bank.questions)) {
            Utils.showToast('题库加载失败', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        this.prepareQuestions();

        if (this.state.mode === 'review') {
            this.state.questions.forEach(q => {
                this.state.submitted[q.id] = true;
                this.state.showExplanation[q.id] = true;
                this.state.answers[q.id] = q.answer;
            });
        }

        if (this.state.mode === 'wrong' && this.state.questions.length === 0) {
            Utils.showToast('没有错题，真棒！', 'success');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        if (this.state.mode === 'spaced' && this.state.questions.length === 0) {
            Utils.showToast('没有需要复习的题目', 'info');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        if (this.state.mode === 'bookmark' && this.state.questions.length === 0) {
            Utils.showToast('没有收藏的题目', 'info');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        this.restoreSession();
        this.state.startTime = Date.now();
        this.state.questionStartTime = Date.now();

        if (this.state.mode === 'exam') {
            this.startExamTimer();
        }

        this.render();
        this.bindEvents();
        this.updateNavDots();

        this.autoSaveInterval = setInterval(() => this.saveSession(), 30000);
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);

        console.log('Quiz initialized', this.state);
    },

    updateTimerDisplay() {
        const timerEl = document.getElementById('question-timer');
        if (timerEl) {
            timerEl.textContent = this.getQuestionTimeDisplay();
        }
    },

    restoreSession() {
        if (this.state.mode === 'exam') return;

        const session = Storage.getSession(this.state.bankId, this.state.mode);
        if (session && session.currentIndex < this.state.questions.length) {
            this.state.currentIndex = session.currentIndex || 0;
            this.state.autoNext = session.autoNext || this.state.autoNext;
            if (this.state.mode !== 'review') {
                this.state.answers = session.answers || {};
                this.state.submitted = session.submitted || {};
                this.state.showExplanation = session.showExplanation || {};
            }
            this.state.questionTimes = session.questionTimes || {};
            this.state.optionOrderCache = session.optionOrderCache || {};
        }
    },

    saveSession() {
        if (this.state.mode === 'exam') return;

        Storage.saveSession(this.state.bankId, this.state.mode, {
            currentIndex: this.state.currentIndex,
            filterType: this.state.filterType || 'all',
            autoNext: this.state.autoNext,
            answers: this.state.answers,
            submitted: this.state.submitted,
            showExplanation: this.state.showExplanation,
            questionTimes: this.state.questionTimes,
            optionOrderCache: this.state.optionOrderCache
        });
    },

    async loadBankFromJson() {
        const jsonFiles = ['c-language.json', 'engineering-mechanics.json'];
        let lastError = '';
        for (const filename of jsonFiles) {
            try {
                const response = await fetch(`banks/${filename}`);
                if (!response.ok) {
                    lastError = `HTTP ${response.status}: ${response.statusText}`;
                    continue;
                }
                const bank = await response.json();
                if (bank.id === this.state.bankId) {
                    Storage.addBank(bank);
                    this.state.bank = bank;
                    Utils.showToast(`题库 "${bank.name}" 加载成功`, 'success', 1500);
                    return;
                }
            } catch (e) {
                lastError = e.message || '网络错误';
                console.error(`Failed to load ${filename}:`, e);
            }
        }
        Utils.showToast(`题库加载失败：${lastError || '题库文件未找到'}`, 'error', 5000);
    },

    prepareQuestions() {
        // 搜索模式：从 URL 参数或 sessionStorage 读取关键词
        if (this.state.mode === 'search' && this.state.searchKeyword) {
            const keyword = this.state.searchKeyword.toLowerCase();
            const allQuestions = [...(this.state.bank.questions || [])];
            const matched = allQuestions.filter(q => {
                const searchText = [q.question, q.explanation, q.category, ...(q.options || []), q.answer].join(' ');
                return searchText.toLowerCase().includes(keyword);
            });
            if (matched.length === 0) {
                Utils.showToast(`未找到匹配题目：「${this.state.searchKeyword}」`, 'info', 3000);
            }
            this.state.questions = matched;
            return;
        }
        let questions = [...(this.state.bank.questions || [])];

        if (this.state.filterType && this.state.filterType !== 'all') {
            questions = questions.filter(q => q.type === this.state.filterType);
        }

        switch (this.state.mode) {
            case 'wrong':
                const wrongIds = Storage.getWrongQuestions(this.state.bankId);
                questions = questions.filter(q => wrongIds.includes(q.id));
                break;
            case 'random':
            case 'shuffle_options':
                questions = Utils.shuffleArray(questions);
                break;
            case 'review':
                this.state.isReviewMode = true;
                break;
            case 'spaced':
                const dueQuestions = Storage.getDueQuestions(this.state.bankId);
                questions = dueQuestions;
                break;
            case 'bookmark':
                const bookmarkIds = Storage.getBankBookmarks(this.state.bankId);
                questions = questions.filter(q => bookmarkIds.includes(q.id));
                break;
            case 'exam':
            case 'all':
            default:
                break;
        }

        this.state.questions = questions;
    },

    render() {
        this.renderHeader();
        this.renderQuestionNavDots();
        this.renderQuestion();
        this.renderFooter();
    },

    recordQuestionTime() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question || !this.state.questionStartTime) return;

        const elapsed = Math.round((Date.now() - this.state.questionStartTime) / 1000);
        if (!this.state.questionTimes[question.id]) {
            this.state.questionTimes[question.id] = 0;
        }
        this.state.questionTimes[question.id] += elapsed;
        this.state.questionStartTime = Date.now();
    },

    getQuestionTimeDisplay() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return '';

        const saved = this.state.questionTimes[question.id] || 0;
        const current = this.state.questionStartTime ? Math.round((Date.now() - this.state.questionStartTime) / 1000) : 0;
        const total = saved + current;

        if (total < 60) return `${total}秒`;
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}分${seconds}秒`;
    },

    startExamTimer() {
        this.state.examTimeRemaining = this.state.examTimeLimit;
        this.state.examTimer = setInterval(() => {
            this.state.examTimeRemaining--;
            this.updateExamTimerDisplay();

            if (this.state.examTimeRemaining <= 0) {
                clearInterval(this.state.examTimer);
                Utils.showToast('考试时间到！', 'error');
                this.finish();
            }
        }, 1000);
    },

    updateExamTimerDisplay() {
        const el = document.getElementById('exam-timer');
        if (!el) return;

        const remaining = this.state.examTimeRemaining;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (remaining <= 300) {
            el.classList.add('danger');
        }
    },

    renderFooter() {
        const submitBtn = document.getElementById('btn-submit');
        const hint = document.getElementById('footer-hint');

        if (this.state.isReviewMode) {
            if (submitBtn) submitBtn.style.display = 'none';
            if (hint) hint.textContent = '📖 背题模式 - 直接查看答案和解析';
        } else if (this.state.lightningMode) {
            if (submitBtn) submitBtn.style.display = 'none';
            if (hint) hint.textContent = '⚡ 闪电模式 - 点击选项直接判对错';
        } else {
            if (submitBtn) submitBtn.style.display = '';
            if (hint) hint.textContent = '按 Enter 提交 · A-D 选答案 · Alt+←→ 切换';
        }
    },

    renderHeader() {
        document.getElementById('quiz-title').textContent = this.state.bank.name;

        const modeNames = {
            'all': '顺序刷题', 'random': '随机刷题', 'wrong': '错题重做',
            'review': '背题模式', 'spaced': '智能复习', 'bookmark': '收藏题目', 'exam': '模拟考试'
        };

        const timerEl = document.getElementById('exam-timer');
        if (timerEl) {
            timerEl.style.display = this.state.mode === 'exam' ? '' : 'none';
        }

        this.updateProgress();
    },

    updateProgress() {
        const current = this.state.currentIndex + 1;
        const total = this.state.questions.length;

        const progressFill = document.getElementById('quiz-progress-fill');
        if (progressFill) {
            progressFill.style.width = Math.round((current / total) * 100) + '%';
        }

        const progressText = document.getElementById('quiz-progress-text');
        if (progressText) {
            progressText.textContent = `${current} / ${total}`;
        }
    },

    /**
     * 渲染导航面包屑（固定在题目上方）
     */
    renderQuestionNavDots() {
        const bar = document.getElementById('question-nav-bar');
        if (!bar) return;

        const questions = this.state.questions;
        const visibleCount = Math.min(questions.length, 50); // 最多显示 50 个点

        let html = '';
        for (let i = 0; i < visibleCount; i++) {
            const q = questions[i];
            let cls = 'question-nav-dot';

            if (i === this.state.currentIndex) {
                cls += ' current';
            } else if (this.state.submitted[q.id]) {
                cls += this.checkAnswer(q) ? ' correct' : ' wrong';
            }

            html += `<div class="${cls}" data-index="${i}" title="第 ${i+1} 题">${i + 1}</div>`;
        }

        if (questions.length > 50) {
            html += `<div class="question-nav-dot" style="border-style:dashed;cursor:default" title="还有 ${questions.length - 50} 题">+${questions.length - 50}</div>`;
        }

        bar.innerHTML = html;

        // 绑定点击事件
        bar.querySelectorAll('.question-nav-dot').forEach(item => {
            const idx = parseInt(item.dataset.index);
            if (!isNaN(idx)) {
                item.addEventListener('click', () => this.goToQuestion(idx));
            }
        });

        // 滚动当前点到可视区域
        const currentDot = bar.querySelector('.question-nav-dot.current');
        if (currentDot) {
            currentDot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },

    toggleNav() {
        const panel = document.getElementById('nav-panel');
        const overlay = document.getElementById('nav-overlay');
        panel.classList.toggle('show');
        overlay.classList.toggle('show');

        if (panel.classList.contains('show')) {
            this.renderQuestionNav();
            const current = panel.querySelector('.question-nav-item.current');
            if (current) {
                current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    },

    renderQuestionNav() {
        const container = document.getElementById('question-nav-grid');
        const questions = this.state.questions;

        container.innerHTML = questions.map((q, index) => {
            let cls = 'question-nav-item';
            if (index === this.state.currentIndex) {
                cls += ' current';
            } else if (this.state.submitted[q.id]) {
                cls += this.checkAnswer(q) ? ' correct' : ' wrong';
            }
            return `<div class="${cls}" data-index="${index}">${index + 1}</div>`;
        }).join('');

        container.querySelectorAll('.question-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.goToQuestion(index);
                document.getElementById('nav-panel').classList.remove('show');
                document.getElementById('nav-overlay').classList.remove('show');
            });
        });
    },

    renderQuestion() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return;

        const container = document.getElementById('question-container');
        const isReviewMode = this.state.isReviewMode;
        const isSubmitted = isReviewMode || this.state.submitted[question.id];
        const userAnswer = isReviewMode ? question.answer : this.state.answers[question.id];
        const isCorrect = isReviewMode ? true : (isSubmitted ? this.checkAnswer(question) : null);
        const showExplanation = isReviewMode || this.state.showExplanation[question.id];

        let html = `
            <div class="question-card">
                <div class="question-header">
                    <div class="question-meta">
                        <span class="question-number">第 ${this.state.currentIndex + 1} 题</span>
                        <span class="question-type ${question.type}">${Utils.getTypeName(question.type)}</span>
                        <span class="question-timer" id="question-timer">${this.getQuestionTimeDisplay()}</span>
                        ${question.difficulty ? `
                            <div class="question-difficulty" aria-label="难度 ${question.difficulty}/5">
                                ${Array.from({length: 5}, (_, i) => 
                                    `<div class="question-difficulty-dot ${i < question.difficulty ? 'active' : ''}"></div>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="question-actions">
                        ${question.category ? `<span class="question-category">${Utils.escapeHtml(question.category)}</span>` : ''}
                        ${!isReviewMode ? `<button class="btn-bookmark ${Storage.isBookmarked(this.state.bankId, question.id) ? 'active' : ''}" onclick="Quiz.toggleBookmark(${question.id})" title="收藏" aria-label="收藏此题">${Storage.isBookmarked(this.state.bankId, question.id) ? '⭐' : '☆'}</button>` : ''}
                    </div>
                </div>

                <div class="question-body">
                    <div class="question-text">
                        ${Utils.parseMarkdown(question.question)}
                    </div>

                    ${this.renderOptions(question, isSubmitted, userAnswer)}

                    ${isSubmitted && showExplanation ? this.renderExplanation(question, isCorrect) : ''}
                </div>
            </div>
        `;

        container.innerHTML = html;
        Utils.renderMath(container);
        Utils.highlightCode(container);
        this.bindOptionEvents(question);
    },

    renderOptions(question, isSubmitted, userAnswer) {
        switch (question.type) {
            case 'single': return this.renderSingleOptions(question, isSubmitted, userAnswer);
            case 'multiple': return this.renderMultipleOptions(question, isSubmitted, userAnswer);
            case 'judge': return this.renderJudgeOptions(question, isSubmitted, userAnswer);
            case 'fill': return this.renderFillInput(question, isSubmitted, userAnswer);
            case 'code': return this.renderCodeInput(question, isSubmitted, userAnswer);
            default: return '';
        }
    },

    /**
     * 获取选项的显示列表（支持选项乱序）
     * 每个选项格式：{ displayLetter, originalLetter, text }
     * data-answer 始终存 originalLetter，checkAnswer 无需修改
     */
    getDisplayOptions(question) {
        const options = question.options || [];
        const normal = options.map((option, index) => ({
            displayLetter: String.fromCharCode(65 + index),
            originalLetter: String.fromCharCode(65 + index),
            text: option
        }));

        if (this.state.mode !== 'shuffle_options') return normal;

        // 缓存乱序顺序，保证同一题目刷新/切换后顺序不变
        if (!this.state.optionOrderCache[question.id]) {
            const indices = options.map((_, i) => i);
            this.state.optionOrderCache[question.id] = Utils.shuffleArray(indices);
        }

        return this.state.optionOrderCache[question.id].map((origIdx, displayIdx) => ({
            displayLetter: String.fromCharCode(65 + displayIdx),
            originalLetter: String.fromCharCode(65 + origIdx),
            text: options[origIdx]
        }));
    },

    renderSingleOptions(question, isSubmitted, userAnswer) {
        const displayOpts = this.getDisplayOptions(question);
        return `
            <div class="options-list" role="radiogroup" aria-label="选项">
                ${displayOpts.map(opt => {
                    const letter = opt.displayLetter;
                    const origLetter = opt.originalLetter;
                    const isCorrect = origLetter === question.answer;
                    const isUserSel = origLetter === userAnswer;
                    let cls = 'option-item';
                    if (isSubmitted) {
                        if (isCorrect) {
                            cls += ' correct disabled';
                        } else if (isUserSel && !isCorrect) {
                            cls += ' wrong disabled';
                        } else {
                            cls += ' disabled';
                        }
                    } else if (isUserSel) {
                        cls += ' selected';
                    }
                    return `
                        <div class="${cls}" data-answer="${origLetter}" role="radio" aria-checked="${isUserSel}" tabindex="0">
                            <div class="option-marker">${letter}</div>
                            <div class="option-content">${Utils.parseMarkdown(opt.text.replace(/^[A-Z]\.\s*/, ''))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderMultipleOptions(question, isSubmitted, userAnswer) {
        const displayOpts = this.getDisplayOptions(question);
        const userAnswers = userAnswer || [];
        const correctAnswers = question.answer || [];
        return `
            <div class="options-list" role="group" aria-label="选项">
                ${displayOpts.map(opt => {
                    const letter = opt.displayLetter;
                    const origLetter = opt.originalLetter;
                    let cls = 'option-item';
                    if (isSubmitted) {
                        const isCorrectOption = correctAnswers.includes(origLetter);
                        const isUserSelected = userAnswers.includes(origLetter);
                        if (isCorrectOption) {
                            cls += ' correct disabled';
                        } else if (isUserSelected) {
                            cls += ' wrong disabled';
                        } else {
                            cls += ' disabled';
                        }
                    } else if (userAnswers.includes(origLetter)) {
                        cls += ' selected';
                    }
                    return `
                        <div class="${cls}" data-answer="${origLetter}" role="checkbox" aria-checked="${userAnswers.includes(origLetter)}" tabindex="0">
                            <div class="option-marker">${letter}</div>
                            <div class="option-content">${Utils.parseMarkdown(opt.text.replace(/^[A-Z]\.\s*/, ''))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 多选题，可选择多个选项</div>' : ''}
        `;
    },

    renderJudgeOptions(question, isSubmitted, userAnswer) {
        return `
            <div class="judge-options" role="radiogroup" aria-label="判断选项">
                <div class="judge-option ${isSubmitted && question.answer === true ? 'correct' : ''} ${isSubmitted && userAnswer === true && question.answer !== true ? 'wrong' : ''} ${!isSubmitted && userAnswer === true ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="true" role="radio" aria-checked="${userAnswer === true}" tabindex="0">
                    <span class="judge-option-icon">⭕</span>
                    <span>正确</span>
                </div>
                <div class="judge-option ${isSubmitted && question.answer === false ? 'correct' : ''} ${isSubmitted && userAnswer === false && question.answer !== false ? 'wrong' : ''} ${!isSubmitted && userAnswer === false ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="false" role="radio" aria-checked="${userAnswer === false}" tabindex="0">
                    <span class="judge-option-icon">❌</span>
                    <span>错误</span>
                </div>
            </div>
        `;
    },

    renderFillInput(question, isSubmitted, userAnswer) {
        const answers = userAnswer || [];
        const correctAnswers = question.answer || [];
        return `
            <div class="fill-inputs">
                ${correctAnswers.map((correct, index) => {
                    let inputClass = 'fill-input';
                    if (isSubmitted) {
                        const isCorrect = this.checkFillAnswer(answers[index], correct);
                        inputClass += isCorrect ? ' correct' : ' wrong';
                    }
                    return `
                        <div class="fill-input-group">
                            <span class="fill-input-label">空${index + 1}</span>
                            <input type="text" class="${inputClass}" 
                                   data-index="${index}" 
                                   value="${answers[index] || ''}" 
                                   ${isSubmitted ? 'readonly' : ''}
                                   placeholder="请输入答案"
                                   aria-label="填空 ${index + 1}">
                        </div>
                    `;
                }).join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 填空题，输入后按 Enter 跳到下一空</div>' : ''}
        `;
    },

    renderCodeInput(question, isSubmitted, userAnswer) {
        return `
            <div style="margin-top:var(--space-4)">
                <textarea class="code-editor" id="code-editor" rows="10" 
                          ${isSubmitted ? 'readonly' : ''}
                          placeholder="请输入代码..."
                          aria-label="代码编辑器">${Utils.escapeHtml(userAnswer || '')}</textarea>
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 编程题，请编写代码</div>' : ''}
        `;
    },

    renderExplanation(question, isCorrect) {
        const isReviewMode = this.state.isReviewMode;
        return `
            ${!isReviewMode ? `
            <div class="result-banner ${isCorrect ? 'correct' : 'wrong'}">
                <span class="result-banner-icon">${isCorrect ? '🎉' : '😔'}</span>
                <span class="result-banner-text">${isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            ` : ''}

            <div class="explanation">
                <div class="explanation-header">
                    <span class="explanation-icon">💡</span>
                    <span>答案解析</span>
                </div>
                <div class="explanation-content">
                    ${Utils.parseMarkdown(question.explanation || '暂无解析')}
                </div>
                ${question.code ? `
                    <div style="margin-top:var(--space-4)">
                        <strong>参考代码：</strong>
                        <pre><code class="language-${question.codeLanguage || 'c'}">${Utils.escapeHtml(question.code)}</code></pre>
                    </div>
                ` : ''}
            </div>
        `;
    },

    bindOptionEvents(question) {
        const isSubmitted = this.state.isReviewMode || this.state.submitted[question.id];
        if (isSubmitted) return;

        if (question.type === 'single') {
            document.querySelectorAll('.option-item').forEach(item => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.selectAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'multiple') {
            document.querySelectorAll('.option-item').forEach(item => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.toggleAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'judge') {
            document.querySelectorAll('.judge-option').forEach(item => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer === 'true';
                    this.selectAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'fill') {
            document.querySelectorAll('.fill-input').forEach(input => {
                input.addEventListener('input', Utils.debounce(() => {
                    this.updateFillAnswer(question.id);
                }, 300));
                // Enter 跳到下一空
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const inputs = [...document.querySelectorAll('.fill-input')];
                        const idx = inputs.indexOf(input);
                        if (idx < inputs.length - 1) {
                            inputs[idx + 1].focus();
                        } else {
                            this.submitCurrent();
                        }
                    }
                });
            });
            // 自动聚焦第一个空
            const firstInput = document.querySelector('.fill-input');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        }

        if (question.type === 'code') {
            const editor = document.getElementById('code-editor');
            if (editor) {
                editor.addEventListener('input', Utils.debounce(() => {
                    this.state.answers[question.id] = editor.value;
                }, 300));
            }
        }
    },

    selectAnswer(questionId, answer) {
        if (this.state.lightningMode && this.state.submitted[questionId]) {
            this.nextQuestion();
            return;
        }
        this.state.answers[questionId] = answer;
        if (this.state.lightningMode) {
            this.submitCurrent();
            return;
        }
        this.saveSession();
        this.renderQuestion();
        this.renderQuestionNavDots();
    },

    toggleAnswer(questionId, answer) {
        if (this.state.lightningMode && this.state.submitted[questionId]) {
            this.nextQuestion();
            return;
        }
        if (!this.state.answers[questionId]) {
            this.state.answers[questionId] = [];
        }
        const answers = this.state.answers[questionId];
        const index = answers.indexOf(answer);
        if (index >= 0) {
            answers.splice(index, 1);
        } else {
            answers.push(answer);
            answers.sort();
        }
        if (this.state.lightningMode && this.state.answers[questionId].length > 0) {
            this.submitCurrent();
            return;
        }
        this.saveSession();
        this.renderQuestion();
        this.renderQuestionNavDots();
    },

    updateFillAnswer(questionId) {
        const inputs = document.querySelectorAll('.fill-input');
        const answers = [];
        inputs.forEach(input => { answers.push(input.value.trim()); });
        this.state.answers[questionId] = answers;
        this.saveSession();
    },

    submitCurrent() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return;

        if (this.state.submitted[question.id]) {
            this.nextQuestion();
            return;
        }

        if (!this.hasAnswer(question)) {
            if (!this.state.lightningMode) {
                Utils.showToast('请先作答', 'info');
            }
            return;
        }

        this.recordQuestionTime();
        this.state.submitted[question.id] = true;
        this.state.showExplanation[question.id] = true;

        const isCorrect = this.checkAnswer(question);
        Storage.updateQuestionProgress(this.state.bankId, question.id, isCorrect, this.state.answers[question.id]);
        this.saveSession();

        this.renderQuestion();
        this.renderQuestionNavDots();

        if (this.state.lightningMode && isCorrect) {
            setTimeout(() => this.nextQuestion(), 300);
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    hasAnswer(question) {
        const answer = this.state.answers[question.id];
        switch (question.type) {
            case 'single':
            case 'judge':
                return answer !== undefined && answer !== null;
            case 'multiple':
                return Array.isArray(answer) && answer.length > 0;
            case 'fill':
                return Array.isArray(answer) && answer.some(a => a.trim() !== '');
            case 'code':
                return answer && answer.trim() !== '';
            default:
                return false;
        }
    },

    checkAnswer(question) {
        const userAnswer = this.state.answers[question.id];
        switch (question.type) {
            case 'single':
                return userAnswer === question.answer;
            case 'multiple':
                const userSet = new Set(userAnswer || []);
                const correctSet = new Set(question.answer || []);
                return userSet.size === correctSet.size && [...userSet].every(a => correctSet.has(a));
            case 'judge':
                return userAnswer === question.answer;
            case 'fill':
                return (question.answer || []).every((correct, index) =>
                    this.checkFillAnswer(userAnswer?.[index], correct)
                );
            case 'code':
                return true;
            default:
                return false;
        }
    },

    checkFillAnswer(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return false;
        return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    },

    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.recordQuestionTime();
            this.state.currentIndex++;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            this.updateNavDots();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    toggleBookmark(questionId) {
        const isBookmarked = Storage.toggleBookmark(this.state.bankId, questionId);
        Utils.showToast(isBookmarked ? '已收藏' : '已取消收藏', 'success', 1500);
        this.renderQuestion();
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.recordQuestionTime();
            this.state.currentIndex--;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            this.updateNavDots();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.recordQuestionTime();
            this.state.currentIndex = index;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            this.updateNavDots();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * 滚动导航面包屑到当前题目
     */
    updateNavDots() {
        const bar = document.getElementById('question-nav-bar');
        if (!bar) return;
        const currentDot = bar.querySelector('.question-nav-dot.current');
        if (currentDot) {
            currentDot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },

    /**
     * 自定义结束确认——替代原生 confirm
     */
    showFinishModal() {
        const total = this.state.questions.length;
        const answered = Object.keys(this.state.submitted).length;
        const unanswered = total - answered;

        // 计算正确数
        let correctCount = 0;
        const submittedIds = Object.keys(this.state.submitted);
        submittedIds.forEach(qId => {
            const q = this.state.questions.find(q => q.id == qId);
            if (q && this.checkAnswer(q)) correctCount++;
        });

        const modalHtml = `
            <div class="finish-modal-overlay show" id="finish-modal">
                <div class="finish-modal">
                    <div class="finish-modal-icon">${unanswered > 0 ? '📝' : '🎯'}</div>
                    <div class="finish-modal-title">${unanswered > 0 ? '还有题目未完成' : '全部答完！'}</div>
                    <div class="finish-modal-desc">${unanswered > 0 ? `还有 ${unanswered} 题未答，确定要结束吗？` : '点击确认查看结果'}</div>
                    <div class="finish-modal-stats">
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${answered}</div>
                            <div class="finish-modal-stat-label">已答</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value success">${correctCount}</div>
                            <div class="finish-modal-stat-label">正确</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value ${answered - correctCount > 0 ? 'danger' : ''}">${answered - correctCount}</div>
                            <div class="finish-modal-stat-label">错误</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${unanswered}</div>
                            <div class="finish-modal-stat-label">未答</div>
                        </div>
                    </div>
                    <div class="finish-modal-actions">
                        ${unanswered > 0 ? `<button class="btn btn-primary" onclick="Quiz.closeFinishModal()">📖 继续答题</button>` : ''}
                        <button class="btn ${unanswered > 0 ? 'btn-secondary' : 'btn-primary'}" onclick="Quiz.confirmFinish()">✅ 确认结束</button>
                        <button class="btn btn-ghost" onclick="Quiz.saveAndQuit()">💾 保存进度退出</button>
                    </div>
                </div>
            </div>
        `;

        // 插入到 body
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
    },

    closeFinishModal() {
        const modal = document.getElementById('finish-modal');
        if (modal) modal.remove();
    },

    /**
     * 保存进度并退出（不显示结果页）
     */
    saveAndQuit() {
        this.closeFinishModal();
        this.saveSession();
        Utils.showToast('进度已保存', 'success');
        setTimeout(() => window.location.href = 'index.html', 300);
    },

    /**
     * 确认结束答题
     */
    confirmFinish() {
        this.closeFinishModal();

        if (this.state.examTimer) {
            clearInterval(this.state.examTimer);
            this.state.examTimer = null;
        }
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.recordQuestionTime();
        Storage.clearSession(this.state.bankId, this.state.mode);
        this.state.isFinished = true;
        this.renderResult();
    },

    finish() {
        // 使用自定义模态框替代原生 confirm
        this.showFinishModal();
    },

    renderResult() {
        const stats = Storage.getBankStats(this.state.bankId);
        const duration = Math.round((Date.now() - this.state.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        const submittedIds = Object.keys(this.state.submitted);
        const correctCount = submittedIds.filter(qId => {
            const q = this.state.questions.find(q => q.id == qId);
            return q && this.checkAnswer(q);
        }).length;
        const thisAccuracy = submittedIds.length > 0 ? Math.round((correctCount / submittedIds.length) * 100) : 0;

        const isExam = this.state.mode === 'exam';
        const passed = isExam ? thisAccuracy >= this.state.examPassRate : null;
        const resultIcon = isExam ? (passed ? '🎉' : '😞') : '🎉';
        const resultTitle = isExam ? (passed ? '考试通过！' : '未通过考试') : '答题完成！';

        Storage.addHistory({
            bankId: this.state.bankId,
            bankName: this.state.bank.name,
            mode: this.state.mode,
            total: this.state.questions.length,
            correct: correctCount,
            duration: duration
        });

        const container = document.getElementById('question-container');
        container.innerHTML = `
            <div class="result-page">
                <div class="result-icon">${resultIcon}</div>
                <div class="result-title">${resultTitle}</div>
                <div class="result-subtitle">${Utils.escapeHtml(this.state.bank.name)}</div>
                ${isExam ? `<div class="result-exam-info">及格线 ${this.state.examPassRate}%，正确率 ${thisAccuracy}%</div>` : ''}

                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-stat-value success">${correctCount}</div>
                        <div class="result-stat-label">答对</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value danger">${submittedIds.length - correctCount}</div>
                        <div class="result-stat-label">答错</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value ${isExam && !passed ? 'danger' : ''}">${thisAccuracy}%</div>
                        <div class="result-stat-label">正确率</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value">${minutes > 0 ? minutes + '分' : ''}${seconds}秒</div>
                        <div class="result-stat-label">用时</div>
                    </div>
                </div>

                <div class="result-actions">
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.restart()">
                        🔄 重新开始
                    </button>
                    <button class="btn btn-primary btn-lg" onclick="Quiz.goHome()">
                        🏠 返回首页
                    </button>
                </div>
            </div>
        `;

        document.querySelector('.quiz-footer').style.display = 'none';
        document.getElementById('question-nav-bar').style.display = 'none';
    },

    restart() {
        Storage.clearSession(this.state.bankId, this.state.mode);

        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.submitted = {};
        this.state.showExplanation = {};
        this.state.questionTimes = {};
        this.state.optionOrderCache = {};
        this.state.isFinished = false;
        this.state.startTime = Date.now();

        if (this.state.mode === 'random' || this.state.mode === 'shuffle_options') {
            this.prepareQuestions();
        }

        if (this.state.mode === 'review') {
            this.state.questions.forEach(q => {
                this.state.submitted[q.id] = true;
                this.state.showExplanation[q.id] = true;
                this.state.answers[q.id] = q.answer;
            });
        }

        document.querySelector('.quiz-footer').style.display = '';
        document.getElementById('question-nav-bar').style.display = '';
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    goHome() {
        window.location.href = 'index.html';
    },

    bindEvents() {
        window.addEventListener('beforeunload', () => this.saveSession());

        document.addEventListener('keydown', (e) => {
            // 如果模态框开着不处理快捷键
            if (document.getElementById('finish-modal')) return;

            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                const question = this.state.questions[this.state.currentIndex];
                if (question && !this.state.submitted[question.id]) {
                    this.submitCurrent();
                } else {
                    this.nextQuestion();
                }
            }

            if (e.key === 'ArrowLeft' && e.altKey) {
                e.preventDefault();
                this.prevQuestion();
            }
            if (e.key === 'ArrowRight' && e.altKey) {
                e.preventDefault();
                this.nextQuestion();
            }

            const question = this.state.questions[this.state.currentIndex];
            if (question && !this.state.submitted[question.id]) {
                if (question.type === 'single' || question.type === 'multiple') {
                    const key = e.key.toUpperCase();
                    if (['A', 'B', 'C', 'D', 'E', 'F'].includes(key)) {
                        if (question.type === 'single') {
                            this.selectAnswer(question.id, key);
                        } else {
                            this.toggleAnswer(question.id, key);
                        }
                    }
                }
                if (question.type === 'judge') {
                    if (e.key === '1' || e.key === 't' || e.key === 'T') {
                        this.selectAnswer(question.id, true);
                    }
                    if (e.key === '0' || e.key === 'f' || e.key === 'F') {
                        this.selectAnswer(question.id, false);
                    }
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Quiz.init();
});

window.Quiz = Quiz;
export default Quiz;
