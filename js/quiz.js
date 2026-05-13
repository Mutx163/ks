/**
 * 刷题页面模块
 * 处理答题逻辑、进度管理等
 */

import Storage from './storage.js';
import Utils from './utils.js';

const Quiz = {
    // 状态
    state: {
        bankId: null,
        bank: null,
        questions: [],
        currentIndex: 0,
        mode: 'all', // all, wrong, random, review, spaced, bookmark, exam
        answers: {},
        submitted: {},
        showExplanation: {},
        isFinished: false,
        startTime: null,
        // 计时相关
        questionStartTime: null,
        questionTimes: {}, // { questionId: seconds }
        // 考试模式
        examTimeLimit: 0, // 总限时（秒），0 表示不限时
        examPassRate: 60, // 及格线（百分比）
        examTimeRemaining: 0,
        examTimer: null,
        // 自动下一题
        autoNext: false
    },

    /**
     * 初始化
     */
    async init() {
        // 获取URL参数
        const params = new URLSearchParams(window.location.search);
        this.state.bankId = params.get('bank');
        this.state.mode = params.get('mode') || 'all';
        this.state.filterType = params.get('type') || 'all';
        this.state.lightningMode = params.get('lightning') === '1';
        // 考试模式参数
        this.state.examTimeLimit = parseInt(params.get('time')) || 0;
        this.state.examPassRate = parseInt(params.get('pass')) || 60;

        if (!this.state.bankId) {
            Utils.showToast('缺少题库参数', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        // 加载题库（先从内存取；如果只有 localStorage 元数据、没有 questions，则继续从 JSON 文件加载完整题库）
        this.state.bank = Storage.getBank(this.state.bankId);
        if (!this.state.bank || !Array.isArray(this.state.bank.questions)) {
            // 尝试从JSON文件加载完整题库
            await this.loadBankFromJson();
        }
        if (!this.state.bank || !Array.isArray(this.state.bank.questions)) {
            Utils.showToast('题库加载失败', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        // 准备题目
        this.prepareQuestions();
        
        // 背题模式：自动标记所有题目为已提交
        if (this.state.mode === 'review') {
            this.state.questions.forEach(q => {
                this.state.submitted[q.id] = true;
                this.state.showExplanation[q.id] = true;
                this.state.answers[q.id] = q.answer;
            });
        }
        
        // 错题模式：检查是否有错题
        if (this.state.mode === 'wrong' && this.state.questions.length === 0) {
            Utils.showToast('没有错题，真棒！', 'success');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        // 智能复习模式：检查是否有到期题目
        if (this.state.mode === 'spaced' && this.state.questions.length === 0) {
            Utils.showToast('没有需要复习的题目', 'info');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        // 收藏模式：检查是否有收藏题目
        if (this.state.mode === 'bookmark' && this.state.questions.length === 0) {
            Utils.showToast('没有收藏的题目', 'info');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }
        
        // 恢复会话状态（进度和答案）
        this.restoreSession();
        
        // 记录开始时间
        this.state.startTime = Date.now();
        this.state.questionStartTime = Date.now();

        // 考试模式：启动倒计时
        if (this.state.mode === 'exam') {
            this.startExamTimer();
        }

        // 渲染页面
        this.render();
        this.bindEvents();
        
        // 初始化自动下一题按钮
        const autoBtn = document.getElementById('btn-auto');
        if (autoBtn) {
            autoBtn.classList.toggle('active', this.state.autoNext);
            autoBtn.title = this.state.autoNext ? '自动下一题：开' : '自动下一题：关';
        }
        
        // 定期自动保存会话
        this.autoSaveInterval = setInterval(() => this.saveSession(), 30000);
        
        // 启动计时器更新
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
        
        console.log('Quiz initialized', this.state);
    },
    
    /**
     * 更新计时器显示
     */
    updateTimerDisplay() {
        const timerEl = document.getElementById('question-timer');
        if (timerEl) {
            timerEl.textContent = this.getQuestionTimeDisplay();
        }
    },
    
    /**
     * 恢复会话状态
     */
    restoreSession() {
        // 考试模式不恢复
        if (this.state.mode === 'exam') return;
        
        const session = Storage.getSession(this.state.bankId, this.state.mode);
        if (session && session.currentIndex < this.state.questions.length) {
            this.state.currentIndex = session.currentIndex || 0;
            this.state.autoNext = session.autoNext || false;
            // 只有URL没有type参数时才恢复session的type
            if (!new URLSearchParams(window.location.search).get('type')) {
                this.state.filterType = session.filterType || 'all';
            }
            // 背题模式只恢复位置，不恢复答案（因为答案是自动填充的）
            if (this.state.mode !== 'review') {
                this.state.answers = session.answers || {};
                this.state.submitted = session.submitted || {};
                this.state.showExplanation = session.showExplanation || {};
            }
            this.state.questionTimes = session.questionTimes || {};
        }
    },
    
    /**
     * 保存会话状态
     */
    saveSession() {
        // 考试模式不保存
        if (this.state.mode === 'exam') return;
        
        Storage.saveSession(this.state.bankId, this.state.mode, {
            currentIndex: this.state.currentIndex,
            filterType: this.state.filterType || 'all',
            autoNext: this.state.autoNext,
            answers: this.state.answers,
            submitted: this.state.submitted,
            showExplanation: this.state.showExplanation,
            questionTimes: this.state.questionTimes
        });
    },

    /**
     * 从JSON文件加载题库
     */
    async loadBankFromJson() {
        const jsonFiles = ['c-language.json', 'engineering-mechanics.json'];
        for (const filename of jsonFiles) {
            try {
                const response = await fetch(`banks/${filename}`);
                if (response.ok) {
                    const bank = await response.json();
                    if (bank.id === this.state.bankId) {
                        Storage.addBank(bank);
                        this.state.bank = bank;
                        return;
                    }
                }
            } catch (e) {
                console.error(`Failed to load ${filename}:`, e);
            }
        }
    },

    /**
     * 准备题目列表
     */
    prepareQuestions() {
        let questions = [...(this.state.bank.questions || [])];

        // 按题型筛选
        if (this.state.filterType && this.state.filterType !== 'all') {
            questions = questions.filter(q => q.type === this.state.filterType);
        }

        switch (this.state.mode) {
            case 'wrong':
                // 错题模式
                const wrongIds = Storage.getWrongQuestions(this.state.bankId);
                questions = questions.filter(q => wrongIds.includes(q.id));
                break;
            case 'random':
                // 随机模式
                questions = Utils.shuffleArray(questions);
                break;
            case 'review':
                // 背题模式 - 直接显示答案
                this.state.isReviewMode = true;
                break;
            case 'spaced':
                // 智能复习模式 - 只显示到期的题目
                const dueQuestions = Storage.getDueQuestions(this.state.bankId);
                questions = dueQuestions;
                break;
            case 'bookmark':
                // 收藏模式 - 只显示收藏的题目
                const bookmarkIds = Storage.getBankBookmarks(this.state.bankId);
                questions = questions.filter(q => bookmarkIds.includes(q.id));
                break;
            case 'exam':
                // 考试模式 - 顺序答题，有时间限制
                break;
            case 'all':
            default:
                break;
        }

        this.state.questions = questions;
    },

    /**
     * 渲染页面
     */
    render() {
        this.renderHeader();
        this.renderQuestionNav();
        this.renderQuestion();
        this.renderFooter();
    },
    
    /**
     * 记录当前题目用时
     */
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

    /**
     * 获取当前题目用时显示
     */
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

    /**
     * 启动考试倒计时
     */
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

    /**
     * 更新考试倒计时显示
     */
    updateExamTimerDisplay() {
        const el = document.getElementById('exam-timer');
        if (!el) return;

        const remaining = this.state.examTimeRemaining;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        el.textContent = display;

        // 最后 5 分钟变红
        if (remaining <= 300) {
            el.classList.add('danger');
        }
    },

    /**
     * 渲染底部栏
     */
    renderFooter() {
        const submitBtn = document.getElementById('btn-submit');
        const hint = document.getElementById('footer-hint');
        
        if (this.state.isReviewMode) {
            // 背题模式：隐藏提交按钮，显示提示
            if (submitBtn) submitBtn.style.display = 'none';
            if (hint) hint.textContent = '📖 背题模式 - 直接查看答案和解析';
        } else if (this.state.lightningMode) {
            // 闪电模式：隐藏提交按钮
            if (submitBtn) submitBtn.style.display = 'none';
            if (hint) hint.textContent = '⚡ 闪电模式 - 点击选项直接判对错';
        } else {
            // 普通模式：显示提交按钮
            if (submitBtn) submitBtn.style.display = '';
            if (hint) hint.textContent = '按 Enter 提交答案，Alt+← → 切换题目';
        }
    },

    /**
     * 渲染头部
     */
    renderHeader() {
        document.getElementById('quiz-title').textContent = this.state.bank.name;
        
        // 显示模式标签
        const modeTag = document.getElementById('quiz-mode-tag');
        if (modeTag) {
            const modeNames = {
                'all': '顺序刷题',
                'random': '随机刷题',
                'wrong': '错题重做',
                'review': '背题模式',
                'spaced': '智能复习',
                'bookmark': '收藏题目',
                'exam': '模拟考试'
            };
            modeTag.textContent = modeNames[this.state.mode] || '刷题';
        }

        // 显示考试计时器
        const timerEl = document.getElementById('exam-timer');
        if (timerEl) {
            timerEl.style.display = this.state.mode === 'exam' ? '' : 'none';
        }
        
        this.updateProgress();
    },

    /**
     * 更新进度
     */
    updateProgress() {
        const current = this.state.currentIndex + 1;
        const total = this.state.questions.length;

        const progressFill = document.getElementById('quiz-progress-fill');
        if (progressFill) {
            const percentage = Math.round((current / total) * 100);
            progressFill.style.width = percentage + '%';
        }
        
        const progressText = document.getElementById('quiz-progress-text');
        if (progressText) {
            progressText.textContent = `${current} / ${total}`;
        }
    },

    /**
     * 切换自动下一题
     */
    toggleAutoNext() {
        this.state.autoNext = !this.state.autoNext;
        const btn = document.getElementById('btn-auto');
        if (btn) {
            btn.classList.toggle('active', this.state.autoNext);
            btn.title = this.state.autoNext ? '自动下一题：开' : '自动下一题：关';
        }
        Utils.showToast(this.state.autoNext ? '已开启自动下一题' : '已关闭自动下一题', 'info', 1500);
    },
    
    /**
     * 切换题目导航面板
     */
    toggleNav() {
        const panel = document.getElementById('nav-panel');
        const overlay = document.getElementById('nav-overlay');
        panel.classList.toggle('show');
        overlay.classList.toggle('show');
        
        // 展开时滚动到当前题
        if (panel.classList.contains('show')) {
            const current = panel.querySelector('.question-nav-item.current');
            if (current) {
                current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    },
    
    /**
     * 渲染题目导航
     */
    renderQuestionNav() {
        const container = document.getElementById('question-nav-grid');
        const questions = this.state.questions;
        
        let html = '';
        questions.forEach((q, index) => {
            let className = 'question-nav-item';
            
            if (index === this.state.currentIndex) {
                className += ' current';
            } else if (this.state.submitted[q.id]) {
                const isCorrect = this.checkAnswer(q);
                className += isCorrect ? ' correct' : ' wrong';
            }
            
            html += `<div class="${className}" data-index="${index}">${index + 1}</div>`;
        });
        
        container.innerHTML = html;
        
        // 绑定点击事件
        container.querySelectorAll('.question-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.goToQuestion(index);
                // 关闭导航面板
                document.getElementById('nav-panel').classList.remove('show');
                document.getElementById('nav-overlay').classList.remove('show');
            });
        });
    },

    /**
     * 渲染当前题目
     */
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
                            <div class="question-difficulty">
                                ${Array.from({length: 5}, (_, i) => 
                                    `<div class="question-difficulty-dot ${i < question.difficulty ? 'active' : ''}"></div>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="question-actions">
                        ${question.category ? `<span class="question-category">${Utils.escapeHtml(question.category)}</span>` : ''}
                        ${!isReviewMode ? `<button class="btn-bookmark ${Storage.isBookmarked(this.state.bankId, question.id) ? 'active' : ''}" onclick="Quiz.toggleBookmark(${question.id})" title="收藏">${Storage.isBookmarked(this.state.bankId, question.id) ? '⭐' : '☆'}</button>` : ''}
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

        // 渲染数学公式和代码高亮
        Utils.renderMath(container);
        Utils.highlightCode(container);

        // 绑定选项事件
        this.bindOptionEvents(question);
    },

    /**
     * 渲染选项
     */
    renderOptions(question, isSubmitted, userAnswer) {
        switch (question.type) {
            case 'single':
                return this.renderSingleOptions(question, isSubmitted, userAnswer);
            case 'multiple':
                return this.renderMultipleOptions(question, isSubmitted, userAnswer);
            case 'judge':
                return this.renderJudgeOptions(question, isSubmitted, userAnswer);
            case 'fill':
                return this.renderFillInput(question, isSubmitted, userAnswer);
            case 'code':
                return this.renderCodeInput(question, isSubmitted, userAnswer);
            default:
                return '';
        }
    },

    /**
     * 渲染单选题选项
     */
    renderSingleOptions(question, isSubmitted, userAnswer) {
        const options = question.options || [];
        
        return `
            <div class="options-list">
                ${options.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    let className = 'option-item';
                    
                    if (isSubmitted) {
                        if (letter === question.answer) {
                            className += ' correct disabled';
                        } else if (letter === userAnswer && letter !== question.answer) {
                            className += ' wrong disabled';
                        } else {
                            className += ' disabled';
                        }
                    } else if (userAnswer === letter) {
                        className += ' selected';
                    }
                    
                    return `
                        <div class="${className}" data-answer="${letter}">
                            <div class="option-marker">${letter}</div>
                            <div class="option-content">${Utils.parseMarkdown(option.replace(/^[A-Z]\.\s*/, ''))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * 渲染多选题选项
     */
    renderMultipleOptions(question, isSubmitted, userAnswer) {
        const options = question.options || [];
        const userAnswers = userAnswer || [];
        const correctAnswers = question.answer || [];
        
        return `
            <div class="options-list">
                ${options.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    let className = 'option-item';
                    
                    if (isSubmitted) {
                        const isCorrectOption = correctAnswers.includes(letter);
                        const isUserSelected = userAnswers.includes(letter);
                        
                        if (isCorrectOption) {
                            className += ' correct disabled';
                        } else if (isUserSelected) {
                            className += ' wrong disabled';
                        } else {
                            className += ' disabled';
                        }
                    } else if (userAnswers.includes(letter)) {
                        className += ' selected';
                    }
                    
                    return `
                        <div class="${className}" data-answer="${letter}">
                            <div class="option-marker">${letter}</div>
                            <div class="option-content">${Utils.parseMarkdown(option.replace(/^[A-Z]\.\s*/, ''))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">💡 多选题，可选择多个选项</div>' : ''}
        `;
    },

    /**
     * 渲染判断题选项
     */
    renderJudgeOptions(question, isSubmitted, userAnswer) {
        return `
            <div class="judge-options">
                <div class="judge-option ${isSubmitted && question.answer === true ? 'correct' : ''} ${isSubmitted && userAnswer === true && question.answer !== true ? 'wrong' : ''} ${!isSubmitted && userAnswer === true ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="true">
                    <span class="judge-option-icon">⭕</span>
                    <span>正确</span>
                </div>
                <div class="judge-option ${isSubmitted && question.answer === false ? 'correct' : ''} ${isSubmitted && userAnswer === false && question.answer !== false ? 'wrong' : ''} ${!isSubmitted && userAnswer === false ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="false">
                    <span class="judge-option-icon">❌</span>
                    <span>错误</span>
                </div>
            </div>
        `;
    },

    /**
     * 渲染填空题输入
     */
    renderFillInput(question, isSubmitted, userAnswer) {
        const answers = userAnswer || [];
        const correctAnswers = question.answer || [];
        
        return `
            <div class="fill-inputs">
                ${correctAnswers.map((_, index) => {
                    let inputClass = 'fill-input';
                    if (isSubmitted) {
                        const isCorrect = this.checkFillAnswer(answers[index], correctAnswers[index]);
                        inputClass += isCorrect ? ' correct' : ' wrong';
                    }
                    
                    return `
                        <div class="fill-input-group">
                            <span class="fill-input-label">空${index + 1}</span>
                            <input type="text" class="${inputClass}" 
                                   data-index="${index}" 
                                   value="${answers[index] || ''}" 
                                   ${isSubmitted ? 'readonly' : ''}
                                   placeholder="请输入答案">
                        </div>
                    `;
                }).join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">💡 填空题，请输入答案</div>' : ''}
        `;
    },

    /**
     * 渲染代码题输入
     */
    renderCodeInput(question, isSubmitted, userAnswer) {
        return `
            <div style="margin-top: 16px;">
                <textarea class="code-editor" id="code-editor" rows="10" 
                          ${isSubmitted ? 'readonly' : ''}
                          placeholder="请输入代码...">${userAnswer || ''}</textarea>
            </div>
            ${!isSubmitted ? '<div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">💡 编程题，请编写代码</div>' : ''}
        `;
    },

    /**
     * 渲染解析
     */
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
                    <div style="margin-top: 16px;">
                        <strong>参考代码：</strong>
                        <pre><code class="language-${question.codeLanguage || 'c'}">${Utils.escapeHtml(question.code)}</code></pre>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * 绑定选项事件
     */
    bindOptionEvents(question) {
        const isSubmitted = this.state.isReviewMode || this.state.submitted[question.id];
        if (isSubmitted) return;

        // 单选题
        if (question.type === 'single') {
            document.querySelectorAll('.option-item').forEach(item => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.selectAnswer(question.id, answer);
                });
            });
        }
        
        // 多选题
        if (question.type === 'multiple') {
            document.querySelectorAll('.option-item').forEach(item => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.toggleAnswer(question.id, answer);
                });
            });
        }
        
        // 判断题
        if (question.type === 'judge') {
            document.querySelectorAll('.judge-option').forEach(item => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer === 'true';
                    this.selectAnswer(question.id, answer);
                });
            });
        }
        
        // 填空题
        if (question.type === 'fill') {
            document.querySelectorAll('.fill-input').forEach(input => {
                input.addEventListener('input', Utils.debounce(() => {
                    this.updateFillAnswer(question.id);
                }, 300));
            });
        }
        
        // 代码题
        if (question.type === 'code') {
            const editor = document.getElementById('code-editor');
            if (editor) {
                editor.addEventListener('input', Utils.debounce(() => {
                    this.state.answers[question.id] = editor.value;
                }, 300));
            }
        }
    },

    /**
     * 选择答案（单选/判断）
     */
    selectAnswer(questionId, answer) {
        // 闪电模式：如果已提交，直接跳下一题
        if (this.state.lightningMode && this.state.submitted[questionId]) {
            this.nextQuestion();
            return;
        }
        
        this.state.answers[questionId] = answer;
        
        // 闪电模式：选择后立即提交
        if (this.state.lightningMode) {
            this.submitCurrent();
            return;
        }
        
        this.saveSession();
        this.renderQuestion();
    },

    /**
     * 切换答案（多选）
     */
    toggleAnswer(questionId, answer) {
        // 闪电模式：如果已提交，直接跳下一题
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
        
        // 闪电模式：选择后立即提交
        if (this.state.lightningMode && this.state.answers[questionId].length > 0) {
            this.submitCurrent();
            return;
        }
        
        this.saveSession();
        this.renderQuestion();
    },

    /**
     * 更新填空题答案
     */
    updateFillAnswer(questionId) {
        const inputs = document.querySelectorAll('.fill-input');
        const answers = [];
        
        inputs.forEach(input => {
            answers.push(input.value.trim());
        });
        
        this.state.answers[questionId] = answers;
        this.saveSession();
    },

    /**
     * 提交当前题目
     */
    submitCurrent() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return;

        // 如果已提交，直接跳下一题
        if (this.state.submitted[question.id]) {
            this.nextQuestion();
            return;
        }

        // 检查是否已作答
        if (!this.hasAnswer(question)) {
            if (!this.state.lightningMode) {
                Utils.showToast('请先作答', 'info');
            }
            return;
        }

        // 记录用时
        this.recordQuestionTime();

        // 提交答案
        this.state.submitted[question.id] = true;
        this.state.showExplanation[question.id] = true;

        // 检查答案
        const isCorrect = this.checkAnswer(question);

        // 更新进度
        Storage.updateQuestionProgress(
            this.state.bankId,
            question.id,
            isCorrect,
            this.state.answers[question.id]
        );

        // 保存会话
        this.saveSession();

        // 刷新显示
        this.renderQuestion();
        this.renderQuestionNav();

        // 闪电模式：答对自动跳下一题
        if (this.state.lightningMode && isCorrect) {
            setTimeout(() => this.nextQuestion(), 300);
            return;
        }

        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * 检查是否有答案
     */
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

    /**
     * 检查答案是否正确
     */
    checkAnswer(question) {
        const userAnswer = this.state.answers[question.id];
        
        switch (question.type) {
            case 'single':
                return userAnswer === question.answer;
            case 'multiple':
                const userSet = new Set(userAnswer || []);
                const correctSet = new Set(question.answer || []);
                return userSet.size === correctSet.size && 
                       [...userSet].every(a => correctSet.has(a));
            case 'judge':
                return userAnswer === question.answer;
            case 'fill':
                return (question.answer || []).every((correct, index) => 
                    this.checkFillAnswer(userAnswer?.[index], correct)
                );
            case 'code':
                // 代码题不自动判断对错
                return true;
            default:
                return false;
        }
    },

    /**
     * 检查填空题答案
     */
    checkFillAnswer(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return false;
        return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    },

    /**
     * 下一题
     */
    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.recordQuestionTime();
            this.state.currentIndex++;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * 切换收藏
     */
    toggleBookmark(questionId) {
        const isBookmarked = Storage.toggleBookmark(this.state.bankId, questionId);
        Utils.showToast(isBookmarked ? '已收藏' : '已取消收藏', 'success', 1500);
        this.renderQuestion();
    },

    /**
     * 上一题
     */
    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.recordQuestionTime();
            this.state.currentIndex--;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * 跳转到指定题目
     */
    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.recordQuestionTime();
            this.state.currentIndex = index;
            this.state.questionStartTime = Date.now();
            this.saveSession();
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * 完成答题
     */
    finish() {
        const total = this.state.questions.length;
        const answered = Object.keys(this.state.submitted).length;
        
        if (answered < total) {
            if (!confirm(`还有 ${total - answered} 题未完成，确定要结束吗？`)) {
                return;
            }
        }

        // 停止考试计时器
        if (this.state.examTimer) {
            clearInterval(this.state.examTimer);
            this.state.examTimer = null;
        }

        // 停止自动保存
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // 记录最后一题用时
        this.recordQuestionTime();

        // 清除会话状态（已完成）
        Storage.clearSession(this.state.bankId, this.state.mode);

        this.state.isFinished = true;
        this.renderResult();
    },

    /**
     * 渲染结果页面
     */
    renderResult() {
        const stats = Storage.getBankStats(this.state.bankId);
        const duration = Math.round((Date.now() - this.state.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        // 计算本次正确率
        const submittedIds = Object.keys(this.state.submitted);
        const correctCount = submittedIds.filter(qId => {
            const q = this.state.questions.find(q => q.id == qId);
            return q && this.checkAnswer(q);
        }).length;
        const thisAccuracy = submittedIds.length > 0 ? Math.round((correctCount / submittedIds.length) * 100) : 0;

        // 考试模式：判断是否及格
        const isExam = this.state.mode === 'exam';
        const passed = isExam ? thisAccuracy >= this.state.examPassRate : null;
        const resultIcon = isExam ? (passed ? '🎉' : '😞') : '🎉';
        const resultTitle = isExam ? (passed ? '考试通过！' : '未通过考试') : '答题完成！';

        // 记录历史
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
                        <div class="result-stat-value green">${correctCount}</div>
                        <div class="result-stat-label">答对</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value red">${submittedIds.length - correctCount}</div>
                        <div class="result-stat-label">答错</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value ${isExam && !passed ? 'red' : ''}">${thisAccuracy}%</div>
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

        // 隐藏底部栏
        document.querySelector('.quiz-footer').style.display = 'none';
    },

    /**
     * 重新开始
     */
    restart() {
        // 清除会话状态
        Storage.clearSession(this.state.bankId, this.state.mode);
        
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.submitted = {};
        this.state.showExplanation = {};
        this.state.questionTimes = {};
        this.state.isFinished = false;
        this.state.startTime = Date.now();
        
        if (this.state.mode === 'random') {
            this.prepareQuestions();
        }
        
        // 背题模式重新标记
        if (this.state.mode === 'review') {
            this.state.questions.forEach(q => {
                this.state.submitted[q.id] = true;
                this.state.showExplanation[q.id] = true;
                this.state.answers[q.id] = q.answer;
            });
        }
        
        document.querySelector('.quiz-footer').style.display = '';
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * 返回首页
     */
    goHome() {
        window.location.href = 'index.html';
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 页面关闭前保存
        window.addEventListener('beforeunload', () => this.saveSession());
        
        // 快捷键
        document.addEventListener('keydown', (e) => {
            // Enter 提交
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                const question = this.state.questions[this.state.currentIndex];
                if (question && !this.state.submitted[question.id]) {
                    this.submitCurrent();
                } else {
                    this.nextQuestion();
                }
            }
            
            // 左右箭头切换题目
            if (e.key === 'ArrowLeft' && e.altKey) {
                this.prevQuestion();
            }
            if (e.key === 'ArrowRight' && e.altKey) {
                this.nextQuestion();
            }
            
            // ABCD 选择答案
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    Quiz.init();
});

// 导出
window.Quiz = Quiz;
export default Quiz;
