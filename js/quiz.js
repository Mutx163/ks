/**
 * 刷题页面模块
 * 处理答题逻辑、进度管理等
 */

const Quiz = {
    // 状态
    state: {
        bankId: null,
        bank: null,
        questions: [],
        currentIndex: 0,
        mode: 'all', // all, wrong, random
        answers: {},
        submitted: {},
        showExplanation: {},
        isFinished: false,
        startTime: null
    },

    /**
     * 初始化
     */
    init() {
        // 获取URL参数
        const params = new URLSearchParams(window.location.search);
        this.state.bankId = params.get('bank');
        this.state.mode = params.get('mode') || 'all';

        if (!this.state.bankId) {
            Utils.showToast('缺少题库参数', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        // 加载题库
        this.state.bank = Storage.getBank(this.state.bankId);
        if (!this.state.bank) {
            Utils.showToast('题库不存在', 'error');
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
        
        // 记录开始时间
        this.state.startTime = Date.now();

        // 渲染页面
        this.render();
        this.bindEvents();
        
        console.log('Quiz initialized', this.state);
    },

    /**
     * 准备题目列表
     */
    prepareQuestions() {
        let questions = [...this.state.bank.questions];

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
     * 渲染底部栏
     */
    renderFooter() {
        const submitBtn = document.getElementById('btn-submit');
        const hint = document.getElementById('footer-hint');
        
        if (this.state.isReviewMode) {
            // 背题模式：隐藏提交按钮，显示提示
            if (submitBtn) submitBtn.style.display = 'none';
            if (hint) hint.textContent = '📖 背题模式 - 直接查看答案和解析';
        } else {
            // 非背题模式：显示提交按钮
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
                'review': '背题模式'
            };
            modeTag.textContent = modeNames[this.state.mode] || '刷题';
        }
        
        this.updateProgress();
    },

    /**
     * 更新进度
     */
    updateProgress() {
        const current = this.state.currentIndex + 1;
        const total = this.state.questions.length;
        const percentage = Math.round((current / total) * 100);

        document.getElementById('quiz-progress-fill').style.width = percentage + '%';
        document.getElementById('quiz-progress-text').textContent = `${current} / ${total}`;
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
                        ${question.difficulty ? `
                            <div class="question-difficulty">
                                ${Array.from({length: 5}, (_, i) => 
                                    `<div class="question-difficulty-dot ${i < question.difficulty ? 'active' : ''}"></div>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                    ${question.category ? `<span class="question-category">${question.category}</span>` : ''}
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
        return `
            <div class="result-banner ${isCorrect ? 'correct' : 'wrong'}">
                <span class="result-banner-icon">${isCorrect ? '🎉' : '😔'}</span>
                <span class="result-banner-text">${isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            
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
        this.state.answers[questionId] = answer;
        this.renderQuestion();
    },

    /**
     * 切换答案（多选）
     */
    toggleAnswer(questionId, answer) {
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
    },

    /**
     * 提交当前题目
     */
    submitCurrent() {
        const question = this.state.questions[this.state.currentIndex];
        if (!question) return;

        // 检查是否已作答
        if (!this.hasAnswer(question)) {
            Utils.showToast('请先作答', 'info');
            return;
        }

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

        // 刷新显示
        this.renderQuestion();
        this.renderQuestionNav();

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
            this.state.currentIndex++;
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * 上一题
     */
    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    /**
     * 跳转到指定题目
     */
    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.state.currentIndex = index;
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

        // 记录历史
        Storage.addHistory({
            bankId: this.state.bankId,
            bankName: this.state.bank.name,
            mode: this.state.mode,
            total: this.state.questions.length,
            correct: Object.keys(this.state.submitted).filter(qId => {
                const q = this.state.questions.find(q => q.id == qId);
                return q && this.checkAnswer(q);
            }).length,
            duration: duration
        });

        const container = document.getElementById('question-container');
        container.innerHTML = `
            <div class="result-page">
                <div class="result-icon">🎉</div>
                <div class="result-title">答题完成！</div>
                <div class="result-subtitle">${this.state.bank.name}</div>
                
                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-stat-value green">${stats.correct}</div>
                        <div class="result-stat-label">答对</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value red">${stats.wrong}</div>
                        <div class="result-stat-label">答错</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value">${stats.accuracy}%</div>
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
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.submitted = {};
        this.state.showExplanation = {};
        this.state.isFinished = false;
        this.state.startTime = Date.now();
        
        if (this.state.mode === 'random') {
            this.prepareQuestions();
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
