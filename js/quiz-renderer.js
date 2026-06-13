/**
 * 刷题页面 - DOM 渲染
 */

import Storage from './storage.js';
import Utils from './utils.js';
import AIExplain from './aiExplain.js';
import state from './quiz-state.js';

let Quiz = null;

const Renderer = {
    setQuiz(q) {
        Quiz = q;
    },

    render() {
        this.renderHeader();
        this.renderQuestion();
        this.renderFooter();
        this.renderSidebarGrid();
    },

    renderSidebarGrid() {
        const grid = document.getElementById('sidebar-grid');
        if (!grid) return;

        const questions = state.questions;
        const countEl = document.getElementById('sidebar-count');
        if (countEl) countEl.textContent = questions.length + ' 题';

        grid.innerHTML = questions
            .map((q, i) => {
                let cls = 'sidebar-grid-item';
                if (i === state.currentIndex) cls += ' current';
                else if (state.submitted[q.id]) {
                    cls += Quiz.checkAnswer(q) ? ' correct' : ' wrong';
                }
                return `<div class="${cls}" data-index="${i}">${i + 1}</div>`;
            })
            .join('');

        grid.querySelectorAll('.sidebar-grid-item').forEach((item) => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                if (!isNaN(index)) Quiz.goToQuestion(index);
            });
        });

        const current = grid.querySelector('.sidebar-grid-item.current');
        if (current) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    renderHeader() {
        document.getElementById('quiz-title').textContent = state.bank.name;
        const timerEl = document.getElementById('exam-timer');
        if (timerEl) timerEl.style.display = state.mode === 'exam' ? '' : 'none';
        this.updateProgress();
    },

    updateProgress() {
        const current = state.currentIndex + 1;
        const total = state.questions.length;
        const progressFill = document.getElementById('quiz-progress-fill');
        if (progressFill) progressFill.style.width = Math.round((current / total) * 100) + '%';
        const progressText = document.getElementById('quiz-progress-text');
        if (progressText) progressText.textContent = `${current} / ${total}`;
    },

    toggleNav() {
        const panel = document.getElementById('nav-panel');
        const overlay = document.getElementById('nav-overlay');
        panel.classList.toggle('show');
        overlay.classList.toggle('show');
        if (panel.classList.contains('show')) {
            this.renderQuestionNav();
            const current = panel.querySelector('.question-nav-item.current');
            if (current) current.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    },

    renderQuestionNav() {
        const container = document.getElementById('question-nav-grid');
        const questions = state.questions;

        container.innerHTML = questions
            .map((q, index) => {
                let cls = 'question-nav-item';
                if (index === state.currentIndex) cls += ' current';
                else if (state.submitted[q.id]) {
                    cls += Quiz.checkAnswer(q) ? ' correct' : ' wrong';
                }
                return `<div class="${cls}" data-index="${index}">${index + 1}</div>`;
            })
            .join('');

        container.querySelectorAll('.question-nav-item').forEach((item) => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                Quiz.goToQuestion(index);
                document.getElementById('nav-panel').classList.remove('show');
                document.getElementById('nav-overlay').classList.remove('show');
            });
        });
    },

    renderQuestion() {
        const question = state.questions[state.currentIndex];
        if (!question) {
            console.warn('[Quiz] 没有题目可渲染', {
                currentIndex: state.currentIndex,
                questionsLength: state.questions.length
            });
            return;
        }

        const container = document.getElementById('question-container');
        const isReviewMode = state.isReviewMode;
        const isSubmitted = isReviewMode || state.submitted[question.id];
        const userAnswer = isReviewMode ? question.answer : state.answers[question.id];
        const isCorrect = isReviewMode ? true : isSubmitted ? Quiz.checkAnswer(question) : null;
        const showExplanation = isReviewMode || state.showExplanation[question.id];

        const canUseAI = isSubmitted && AIExplain.isEnabled();

        let html = `
            <div class="question-card" data-question-id="${Utils.escapeHtml(question.id)}">
                <div class="question-header">
                    <div class="question-meta">
                        <span class="question-number">第 ${state.currentIndex + 1} 题</span>
                        <span class="question-type ${question.type}">${Utils.getTypeName(question.type)}</span>
                        <span class="question-timer" id="question-timer">${Quiz.getQuestionTimeDisplay()}</span>
                        ${
                            question.difficulty
                                ? `
                            <div class="question-difficulty" aria-label="难度 ${question.difficulty}/5">
                                ${Array.from(
                                    { length: 5 },
                                    (_, i) =>
                                        `<div class="question-difficulty-dot ${i < question.difficulty ? 'active' : ''}"></div>`
                                ).join('')}
                            </div>
                        `
                                : ''
                        }
                    </div>
                    <div class="question-actions">
                        ${question.category ? `<span class="question-category">${Utils.escapeHtml(question.category)}</span>` : ''}
                        ${canUseAI ? `<button class="btn-ai" onclick="Quiz.openAIAnalysis(${question.id})" title="AI解析" aria-label="AI解析">${Utils.icon('sparkles')} AI</button>` : ''}
                        ${!isReviewMode ? `<button class="btn-bookmark ${Storage.isBookmarked(state.bankId, question.id) ? 'active' : ''}" onclick="Quiz.toggleBookmark(${question.id})" title="收藏" aria-label="收藏此题">${Storage.isBookmarked(state.bankId, question.id) ? Utils.icon('star', 'filled') : Utils.icon('star')}</button>` : ''}
                    </div>
                </div>

                <div class="question-body">
                    <div class="question-text">
                        ${Utils.parseMarkdown(question.question)}
                    </div>

                    ${question.img || question.image ? `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img class="question-image" src="${Utils.escapeHtml(question.img || question.image)}" alt="题目图片" loading="lazy" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>` : ''}

                    ${this.renderOptions(question, isSubmitted, userAnswer)}

                    ${isSubmitted && showExplanation ? this.renderExplanation(question, isCorrect) : ''}
                </div>
            </div>
        `;

        container.innerHTML = html;
        Utils.renderMath(container);
        Utils.highlightCode(container);
        Utils.initIcons();
        Quiz.bindOptionEvents(question);
    },

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
            case 'essay':
            case '简答题':
                return this.renderEssayInput(question, isSubmitted, userAnswer);
            default:
                return '';
        }
    },

    renderSingleOptions(question, isSubmitted, userAnswer) {
        const displayOpts = Quiz.getDisplayOptions(question);
        return `
            <div class="options-list" role="radiogroup" aria-label="选项">
                ${displayOpts
                    .map((opt) => {
                        const letter = opt.displayLetter;
                        const origLetter = opt.originalLetter;
                        const isCorrect = origLetter === question.answer;
                        const isUserSel = origLetter === userAnswer;
                        let cls = 'option-item';
                        let markerHtml = `<div class="option-marker">${letter}</div>`;
                        if (isSubmitted) {
                            if (isCorrect) {
                                cls += ' correct disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('check')}</div>`;
                            } else if (isUserSel && !isCorrect) {
                                cls += ' wrong disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('x')}</div>`;
                            } else {
                                cls += ' disabled';
                            }
                        } else if (isUserSel) {
                            cls += ' selected';
                        }
                        return `
                        <div class="${cls}" data-answer="${origLetter}" role="radio" aria-checked="${isUserSel}" tabindex="0">
                            ${markerHtml}
                            <div class="option-content">
                                ${Utils.parseMarkdown(opt.text.replace(/^[A-Z]\.\s*/, ''))}
                                ${opt.img ? `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img src="${Utils.escapeHtml(opt.img)}" class="option-image" loading="lazy" alt="选项图片" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>` : ''}
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    renderMultipleOptions(question, isSubmitted, userAnswer) {
        const displayOpts = Quiz.getDisplayOptions(question);
        const userAnswers = userAnswer || [];
        const correctAnswers = question.answer || [];
        return `
            <div class="options-list" role="group" aria-label="选项">
                ${displayOpts
                    .map((opt) => {
                        const letter = opt.displayLetter;
                        const origLetter = opt.originalLetter;
                        let cls = 'option-item';
                        let markerHtml = `<div class="option-marker">${letter}</div>`;
                        if (isSubmitted) {
                            const isCorrectOption = correctAnswers.includes(origLetter);
                            const isUserSelected = userAnswers.includes(origLetter);
                            if (isCorrectOption) {
                                cls += ' correct disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('check')}</div>`;
                            } else if (isUserSelected) {
                                cls += ' wrong disabled';
                                markerHtml = `<div class="option-marker">${Utils.icon('x')}</div>`;
                            } else {
                                cls += ' disabled';
                            }
                        } else if (userAnswers.includes(origLetter)) {
                            cls += ' selected';
                        }
                        return `
                        <div class="${cls}" data-answer="${origLetter}" role="checkbox" aria-checked="${userAnswers.includes(origLetter)}" tabindex="0">
                            ${markerHtml}
                            <div class="option-content">
                                ${Utils.parseMarkdown(opt.text.replace(/^[A-Z]\.\s*/, ''))}
                                ${opt.img ? `<div class="img-loading-wrap"><div class="img-loading-icon"></div><img src="${Utils.escapeHtml(opt.img)}" class="option-image" loading="lazy" alt="选项图片" onload="this.parentElement.classList.add('img-loaded')" onerror="this.parentElement.classList.add('img-loaded')"></div>` : ''}
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 多选题，可选择多个选项</div>' : ''}
        `;
    },

    renderJudgeOptions(question, isSubmitted, userAnswer) {
        return `
            <div class="judge-options" role="radiogroup" aria-label="判断选项">
                <div class="judge-option ${isSubmitted && question.answer === true ? 'correct' : ''} ${isSubmitted && userAnswer === true && question.answer !== true ? 'wrong' : ''} ${!isSubmitted && userAnswer === true ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="true" role="radio" aria-checked="${userAnswer === true}" tabindex="0">
                    <span class="judge-option-icon"></span>
                    <span>正确</span>
                </div>
                <div class="judge-option ${isSubmitted && question.answer === false ? 'correct' : ''} ${isSubmitted && userAnswer === false && question.answer !== false ? 'wrong' : ''} ${!isSubmitted && userAnswer === false ? 'selected' : ''} ${isSubmitted ? 'disabled' : ''}" data-answer="false" role="radio" aria-checked="${userAnswer === false}" tabindex="0">
                    <span class="judge-option-icon"></span>
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
                ${correctAnswers
                    .map((correct, index) => {
                        let inputClass = 'fill-input';
                        if (isSubmitted) {
                            const isCorrect = Quiz.checkFillAnswer(answers[index], correct);
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
                    })
                    .join('')}
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 填空题，输入后按 Enter 跳到下一空</div>' : ''}
        `;
    },

    renderCodeInput(question, isSubmitted, userAnswer) {
        const text = userAnswer?.text || userAnswer || '';
        return `
            <div style="margin-top:var(--space-4)">
                <div class="code-editor" id="code-editor" 
                     ${isSubmitted ? 'contenteditable="false"' : 'contenteditable="true"'}
                     role="textbox" aria-multiline="true" aria-label="代码编辑器"
                     data-placeholder="请输入代码...">${Utils.escapeHtml(text)}</div>
            </div>
            ${!isSubmitted ? '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 编程题，请编写代码</div>' : ''}
        `;
    },

    renderEssayInput(question, isSubmitted, userAnswer) {
        const answerText = (userAnswer?.text || '').trim();
        const selfCorrect = userAnswer?.selfCorrect;
        const isReviewMode = state.isReviewMode;

        if (isReviewMode) return '';

        if (isSubmitted && selfCorrect !== undefined) {
            return answerText
                ? `
                <div style="margin-top:var(--space-4);padding:12px;background:var(--bg-hover);border-radius:var(--radius-sm)">
                    <strong>你的回答：</strong><br>${Utils.escapeHtml(answerText)}
                </div>
            `
                : '';
        }

        if (isSubmitted) {
            return `
                <div style="margin-top:var(--space-4)">
                    <div style="margin-bottom:12px">
                        <button class="btn btn-success btn-sm" onclick="Quiz.selfMarkEssay(${question.id}, true)">${Utils.icon('check-circle')} 我答对了</button>
                        <button class="btn btn-danger btn-sm" style="margin-left:8px" onclick="Quiz.selfMarkEssay(${question.id}, false)">${Utils.icon('x-circle')} 我答错了</button>
                    </div>
                </div>
            `;
        }

        return `
            <div style="margin-top:var(--space-4);text-align:center">
                <button class="btn btn-primary" style="padding:10px 32px;font-size:15px" onclick="Quiz.submitEssay(${question.id})">
                    📖 一键查看答案
                </button>
                <div style="margin-top:6px;font-size:12px;color:var(--text-tertiary)">点击按钮查看参考答案与解析</div>
            </div>
        `;
    },

    renderExplanation(question, isCorrect) {
        const isReviewMode = state.isReviewMode;
        const isEssay = question.type === 'essay' || question.type === '简答题';
        const essaySelfMarked = !isEssay || state.answers[question.id]?.selfCorrect !== undefined;
        const showResultBanner = !isReviewMode && essaySelfMarked;

        // 获取当前题目的显示选项（处理了乱序）
        const displayOpts =
            typeof Quiz !== 'undefined' && typeof Quiz.getDisplayOptions === 'function'
                ? Quiz.getDisplayOptions(question)
                : [];

        let answerBody;

        switch (question.type) {
            case 'single': {
                const correctOpt = displayOpts.find(
                    (opt) => opt.originalLetter === question.answer
                );
                answerBody = correctOpt
                    ? `<span class="answer-badge">${correctOpt.displayLetter}</span>. ${Utils.escapeHtml(correctOpt.text.replace(/^[A-Z][.\s、]*/, ''))}`
                    : `<span class="answer-badge">${Utils.escapeHtml(question.answer)}</span>`;
                break;
            }
            case 'multiple': {
                const correctLetters = Array.isArray(question.answer)
                    ? question.answer
                    : (question.answer || '').split(/,\s*/);
                const correctOpts = displayOpts.filter((opt) =>
                    correctLetters.includes(opt.originalLetter)
                );
                answerBody =
                    correctOpts.length > 0
                        ? correctOpts
                              .map(
                                  (opt) =>
                                      `<span class="answer-badge">${opt.displayLetter}</span>. ${Utils.escapeHtml(opt.text.replace(/^[A-Z][.\s、]*/, ''))}`
                              )
                              .join('<span class="answer-divider">|</span>')
                        : `<span class="answer-badge">${Utils.escapeHtml(correctLetters.join(', '))}</span>`;
                break;
            }
            case 'judge': {
                let text;
                if (
                    question.answer === true ||
                    question.answer === 'true' ||
                    question.answer === '对' ||
                    question.answer === '正确' ||
                    question.answer === 'A'
                ) {
                    text = '正确';
                } else if (
                    question.answer === false ||
                    question.answer === 'false' ||
                    question.answer === '错' ||
                    question.answer === '错误' ||
                    question.answer === 'B'
                ) {
                    text = '错误';
                } else {
                    text = question.answer;
                }
                answerBody = `<span class="answer-badge text">${Utils.escapeHtml(text)}</span>`;
                break;
            }
            case 'fill': {
                let ansList = [];
                if (Array.isArray(question.answer)) {
                    ansList = question.answer;
                } else if (typeof question.answer === 'string') {
                    ansList = question.answer.split(/\||,\s*/);
                }
                answerBody =
                    ansList.length > 0
                        ? ansList
                              .map(
                                  (ans, idx) => `
                        <div class="fill-answer-item">
                            <span class="fill-answer-index">(空 ${idx + 1})：</span>
                            <strong class="fill-answer-text">${Utils.escapeHtml(ans)}</strong>
                        </div>
                    `
                              )
                              .join('')
                        : `<span class="answer-badge text">${Utils.escapeHtml(question.answer || '暂无答案')}</span>`;
                break;
            }
            case 'essay':
            case '简答题': {
                answerBody = `
                    <div class="essay-answer-content">
                        ${Utils.parseMarkdown(question.answer || '请参考解析')}
                    </div>
                    ${question.answerImg ? `<div class="essay-answer-image-wrapper"><img src="${Utils.escapeHtml(question.answerImg)}" alt="答案图片"></div>` : ''}
                `;
                break;
            }
            case 'code': {
                answerBody = `
                    <pre class="code-answer-wrapper"><code class="language-${question.codeLanguage || 'c'}">${Utils.escapeHtml(question.answer || '')}</code></pre>
                `;
                break;
            }
            default:
                answerBody = Utils.escapeHtml(question.answer || '暂无答案');
        }

        const correctAnswerCardHTML = `
            <div class="correct-answer-card">
                <div class="correct-answer-header">
                    <span class="correct-answer-icon">${Utils.icon('key-round')}</span>
                    <span>正确答案</span>
                </div>
                <div class="correct-answer-content">
                    ${answerBody}
                </div>
            </div>
        `;

        const memoryAidHtml = question.memoryAid
            ? `
            <div class="memory-aid">
                <span class="memory-aid-icon">${Utils.icon('brain')}</span>
                <span class="memory-aid-text">${Utils.escapeHtml(question.memoryAid)}</span>
            </div>
            `
            : '';

        const codeHtml = question.code
            ? `
            <div class="code-reference-wrapper">
                <strong>参考代码：</strong>
                <pre><code class="language-${question.codeLanguage || 'c'}">${Utils.escapeHtml(question.code)}</code></pre>
            </div>
            `
            : '';

        return `
            ${
                showResultBanner
                    ? `
            <div class="result-banner ${isCorrect ? 'correct' : 'wrong'}">
                <span class="result-banner-icon">${isCorrect ? '🎉' : '😔'}</span>
                <span class="result-banner-text">${isCorrect ? '回答正确！' : '回答错误'}</span>
            </div>
            `
                    : ''
            }

            ${correctAnswerCardHTML}

            <div class="explanation">
                <div class="explanation-header">
                    <span class="explanation-icon">${Utils.icon('lightbulb')}</span>
                    <span>答案解析</span>
                </div>
                <div class="explanation-content">
                    ${Utils.parseMarkdown(question.explanation || '暂无解析')}
                </div>
                ${memoryAidHtml}
                ${codeHtml}
            </div>
        `;
    },

    renderFooter() {
        const submitBtn = document.getElementById('btn-submit');
        const hint = document.getElementById('footer-hint');
        const footerActions = document.querySelector('.quiz-footer-actions');
        const question = state.questions[state.currentIndex];
        const isLightning = state.answerMode === 'lightning';
        const isInstant = state.answerMode === 'instant';
        const isAutoSubmit = isLightning || isInstant;
        const isAutoSubmitMultiple = isAutoSubmit && question?.type === 'multiple';
        const isSubmitted = question && state.submitted[question.id];
        const hasAns = question && Quiz.hasAnswer(question);

        const setSubmitHidden = (hidden) => {
            if (submitBtn) submitBtn.style.display = hidden ? 'none' : '';
            if (footerActions) footerActions.classList.toggle('submit-hidden', hidden);
        };
        const setHint = (text) => {
            if (hint) hint.textContent = text;
        };

        if (!question || state.isFinished) {
            setSubmitHidden(true);
            setHint('');
            return;
        }

        if (state.isReviewMode) {
            setSubmitHidden(true);
            setHint('📖 背题模式 - 直接查看答案和解析');
        } else if (isSubmitted) {
            setSubmitHidden(true);
            setHint(Quiz.getSubmittedHint(question));
        } else if (
            isAutoSubmit &&
            !isAutoSubmitMultiple &&
            question.type !== 'fill' &&
            question.type !== 'code' &&
            question.type !== 'essay'
        ) {
            setSubmitHidden(true);
            setHint(
                isLightning
                    ? `闪电模式 - 点击选项直接判对错，答对自动跳题`
                    : `即时判断 - 点击选项直接判对错，不自动跳题`
            );
        } else {
            setSubmitHidden(false);
            if (submitBtn) {
                submitBtn.disabled = !hasAns;
                submitBtn.title = hasAns ? '' : '请先作答';
            }
            setHint(
                isAutoSubmitMultiple
                    ? isLightning
                        ? `闪电模式 · 多选题请选择完整答案后提交，答对自动跳题`
                        : `即时判断 · 多选题请选择完整答案后提交，不自动跳题`
                    : '按 Enter 提交 · A-D 选答案 · Alt+←→ 切换'
            );
        }

        const nextBtn = document.querySelector('.quiz-footer-actions .btn-secondary:nth-child(2)');
        if (nextBtn) {
            const isLast = state.currentIndex >= state.questions.length - 1;
            if (isLast) {
                nextBtn.textContent = '完成';
                nextBtn.onclick = () => Quiz.finish();
            } else {
                nextBtn.textContent = '下一题';
                nextBtn.onclick = () => Quiz.nextQuestion();
            }
        }
    },

    getSubmittedHint(question) {
        const answer = state.answers[question.id];
        const isEssay = question.type === 'essay' || question.type === '简答题';
        if (isEssay && answer?.selfCorrect === undefined) {
            return '已显示参考答案，请完成自评';
        }
        return Quiz.checkAnswer(question) ? '回答正确，可进入下一题' : '回答错误，查看解析后继续';
    },

    showFinishModal(isTimeout = false) {
        const total = state.questions.length;
        const answered = Object.keys(state.submitted).length;
        const unanswered = total - answered;

        let correctCount = 0;
        const submittedIds = Object.keys(state.submitted);
        submittedIds.forEach((qId) => {
            const q = state.questions.find((q) => q.id == qId);
            if (q && Quiz.checkAnswer(q)) correctCount++;
        });

        const hasUnanswered = unanswered > 0;
        const iconName = isTimeout ? 'clock' : hasUnanswered ? 'alert-circle' : 'check-circle-2';
        const iconColor = isTimeout ? 'warning' : hasUnanswered ? 'warning' : 'success';
        const wrongCount = answered - correctCount;

        const modalHtml = `
            <div class="finish-modal-overlay show" id="finish-modal">
                <div class="finish-modal" role="dialog" aria-modal="true" aria-label="答题完成确认">
                    <div class="finish-modal-icon-wrap ${iconColor}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <h3 class="finish-modal-title">${isTimeout ? '考试时间到' : hasUnanswered ? '还有题目未完成' : '全部答完！'}</h3>
                    <p class="finish-modal-desc">${isTimeout ? '时间已耗尽，请确认结束考试' : hasUnanswered ? `还有 ${unanswered} 题未答，确定要结束吗？` : '确认后查看答题结果'}</p>
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
                            <div class="finish-modal-stat-value ${wrongCount > 0 ? 'danger' : ''}">${wrongCount}</div>
                            <div class="finish-modal-stat-label">错误</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${unanswered}</div>
                            <div class="finish-modal-stat-label">未答</div>
                        </div>
                    </div>
                    <div class="finish-modal-actions">
                        ${!isTimeout && hasUnanswered ? `<button class="btn btn-primary" onclick="Quiz.closeFinishModal()"><i data-lucide="book-open"></i> 继续答题</button>` : ''}
                        <button class="btn ${hasUnanswered ? 'btn-warning' : 'btn-primary'}" onclick="Quiz.confirmFinish()"><i data-lucide="check-circle-2"></i> 确认结束</button>
                    </div>
                    ${
                        !isTimeout
                            ? `
                    <div class="finish-modal-secondary">
                        <button class="btn btn-outline btn-sm" onclick="Quiz.saveAndQuit()"><i data-lucide="save"></i> 保存退出</button>
                    </div>`
                            : ''
                    }
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
        Utils.initIcons?.();

        const overlay = document.getElementById('finish-modal');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) Quiz.closeFinishModal();
        });
        state._finishEscHandler = (e) => {
            if (e.key === 'Escape') Quiz.closeFinishModal();
        };
        document.addEventListener('keydown', state._finishEscHandler);
    },

    closeFinishModal() {
        if (state._finishEscHandler) {
            document.removeEventListener('keydown', state._finishEscHandler);
            state._finishEscHandler = null;
        }
        document.getElementById('finish-modal')?.remove();
    },

    confirmFinish() {
        this.closeFinishModal();

        if (state.examTimer) {
            clearInterval(state.examTimer);
            state.examTimer = null;
        }
        if (state.autoSaveInterval) clearInterval(state.autoSaveInterval);

        Quiz.recordQuestionTime();
        Storage.clearSession(state.bankId, state.mode);
        state.isFinished = true;

        Quiz._saveAndTrackStats();

        const footer = document.querySelector('.quiz-footer');
        if (footer) footer.style.display = 'none';

        this.showResultModal();
    },

    showResultModal() {
        const { duration, correctCount, wrongCount, submittedCount } = state._resultStats || {};
        const minutes = Math.floor((duration || 0) / 60);
        const seconds = (duration || 0) % 60;
        const accuracy = submittedCount > 0 ? Math.round((correctCount / submittedCount) * 100) : 0;
        const isExam = state.mode === 'exam';
        const passed = isExam ? accuracy >= state.examPassRate : null;
        const iconClass = isExam && !passed ? 'warning' : 'success';
        const iconName = isExam && !passed ? 'frown' : 'party-popper';
        const title = isExam ? (passed ? '考试通过！' : '未通过考试') : '答题完成！';
        const desc = isExam
            ? `及格线 ${state.examPassRate}%，正确率 ${accuracy}%`
            : `${state.bank.name}`;

        const modalHtml = `
            <div class="finish-modal-overlay show" id="finish-modal">
                <div class="finish-modal" role="dialog" aria-modal="true" aria-label="答题结果">
                    <div class="finish-modal-icon-wrap ${iconClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <h3 class="finish-modal-title">${title}</h3>
                    <p class="finish-modal-desc">${Utils.escapeHtml(desc)}</p>
                    <div class="finish-modal-stats">
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value success">${correctCount}</div>
                            <div class="finish-modal-stat-label">答对</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value danger">${wrongCount}</div>
                            <div class="finish-modal-stat-label">答错</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${accuracy}%</div>
                            <div class="finish-modal-stat-label">正确率</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${minutes > 0 ? minutes + '分' : ''}${seconds}秒</div>
                            <div class="finish-modal-stat-label">用时</div>
                        </div>
                    </div>
                    <div class="finish-modal-actions">
                        <button class="btn btn-primary" onclick="Quiz.goHome()"><i data-lucide="home"></i> 返回首页</button>
                    </div>
                    <div class="finish-modal-secondary">
                        <button class="btn btn-outline btn-sm" onclick="Quiz.startReview()"><i data-lucide="file-text"></i> 查看解析</button>
                        <button class="btn btn-outline btn-sm" onclick="Quiz.restart()"><i data-lucide="rotate-ccw"></i> 重新开始</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
        Utils.initIcons?.();
    },

    updateSelectedOptionState(answer) {
        const card = Quiz.getQuestionCard();
        if (!card) return;
        card.querySelectorAll('.option-item, .judge-option').forEach((item) => {
            const selected = item.dataset.answer === String(answer);
            item.classList.toggle('selected', selected);
            item.setAttribute('aria-checked', String(selected));
        });
    },

    updateMultipleOptionState(answers) {
        const card = Quiz.getQuestionCard();
        if (!card) return;
        card.querySelectorAll('.option-item').forEach((item) => {
            const selected = answers.includes(item.dataset.answer);
            item.classList.toggle('selected', selected);
            item.setAttribute('aria-checked', String(selected));
        });
    }
};

export default Renderer;
