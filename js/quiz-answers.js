/**
 * 刷题页面 - 答案选择、提交、判定
 */

import Storage from './storage.js';
import Utils from './utils.js';
import Tracker from './tracker.js';
import AIEngines from './aiEngines.js';
import AIExplain from './aiExplain.js';
import state from './quiz-state.js';
import {
    LIGHTNING_NEXT_DELAY_MS,
    FILL_AUTO_FOCUS_DELAY_MS,
    INPUT_SAVE_DEBOUNCE_MS
} from './quiz-state.js';

let Quiz = null;

const Answers = {
    setQuiz(q) {
        Quiz = q;
    },

    getQuestionCard() {
        return document.querySelector('#question-container .question-card');
    },

    bindOptionEvents(question) {
        const isSubmitted = state.isReviewMode || state.submitted[question.id];
        if (isSubmitted) return;

        const card = this.getQuestionCard();
        if (!card) return;

        if (question.type === 'single') {
            card.querySelectorAll('.option-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.selectAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'multiple') {
            card.querySelectorAll('.option-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer;
                    this.toggleAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'judge') {
            card.querySelectorAll('.judge-option').forEach((item) => {
                item.addEventListener('click', () => {
                    const answer = item.dataset.answer === 'true';
                    this.selectAnswer(question.id, answer);
                });
            });
        }

        if (question.type === 'fill') {
            card.querySelectorAll('.fill-input').forEach((input) => {
                input.addEventListener(
                    'input',
                    Utils.debounce(() => {
                        this.updateFillAnswer(question.id);
                    }, INPUT_SAVE_DEBOUNCE_MS)
                );
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const inputs = [...card.querySelectorAll('.fill-input')];
                        const idx = inputs.indexOf(input);
                        if (idx < inputs.length - 1) {
                            inputs[idx + 1].focus();
                        } else {
                            this.submitCurrent();
                        }
                    }
                });
            });
            const firstInput = card.querySelector('.fill-input');
            if (firstInput) setTimeout(() => firstInput.focus(), FILL_AUTO_FOCUS_DELAY_MS);
        }

        if (question.type === 'code') {
            const editor = card.querySelector('#code-editor');
            if (editor) {
                const getText = () => editor.innerText || '';
                const updateAnswer = () => {
                    state.answers[question.id] = getText();
                    Quiz.renderFooter();
                };
                editor.addEventListener('input', updateAnswer);
                editor.addEventListener('paste', () => {
                    setTimeout(() => {
                        editor.textContent = getText();
                        updateAnswer();
                    }, 10);
                });
            }
        }
    },

    selectAnswer(questionId, answer) {
        const isLightning = state.answerMode === 'lightning';
        const isInstant = state.answerMode === 'instant';
        if ((isLightning || isInstant) && state.submitted[questionId]) {
            Quiz.nextQuestion();
            return;
        }
        state.answers[questionId] = answer;
        if (isLightning || isInstant) {
            this.submitCurrent();
            return;
        }
        Quiz.saveSession();
        Quiz.updateSelectedOptionState(answer);
        Quiz.renderFooter();
    },

    toggleAnswer(questionId, answer) {
        const isLightning = state.answerMode === 'lightning';
        const isInstant = state.answerMode === 'instant';
        if ((isLightning || isInstant) && state.submitted[questionId]) {
            Quiz.nextQuestion();
            return;
        }
        if (!state.answers[questionId]) {
            state.answers[questionId] = [];
        }
        const answers = state.answers[questionId];
        const index = answers.indexOf(answer);
        if (index >= 0) {
            answers.splice(index, 1);
        } else {
            answers.push(answer);
            answers.sort();
        }
        Quiz.saveSession();
        Quiz.updateMultipleOptionState(answers);
        Quiz.renderFooter();
    },

    updateFillAnswer(questionId) {
        const card = this.getQuestionCard();
        const inputs = card ? card.querySelectorAll('.fill-input') : [];
        const answers = [];
        inputs.forEach((input) => {
            answers.push(input.value.trim());
        });
        state.answers[questionId] = answers;
        Quiz.saveSession();
        Quiz.renderFooter();
    },

    submitEssay(questionId) {
        const question = state.questions.find((q) => q.id === questionId);
        if (!question) return;
        Quiz.recordQuestionTime();
        state.answers[questionId] = { text: '' };
        state.submitted[questionId] = true;
        state.showExplanation[questionId] = true;
        Quiz.saveSession();
        Quiz.renderQuestion();
        Quiz.renderFooter();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    selfMarkEssay(questionId, isCorrect) {
        const question = state.questions.find((q) => q.id === questionId);
        if (!question) return;
        const previous = state.answers[questionId] || {};
        const answer = { text: previous.text || '', selfCorrect: isCorrect };
        state.answers[questionId] = answer;
        state.submitted[questionId] = true;
        state.showExplanation[questionId] = true;
        Storage.updateQuestionProgress(state.bankId, questionId, isCorrect, answer);
        Quiz.saveSession();
        Quiz.renderQuestion();
        Quiz.renderFooter();
    },

    submitCurrent() {
        const question = state.questions[state.currentIndex];
        if (!question) return;

        if (state.submitted[question.id]) {
            Quiz.nextQuestion();
            return;
        }

        if (!this.hasAnswer(question)) {
            if (state.answerMode !== 'lightning') {
                Utils.showToast('请先作答', 'info');
            }
            return;
        }

        Quiz.recordQuestionTime();
        state.submitted[question.id] = true;
        state.showExplanation[question.id] = true;

        const isCorrect = this.checkAnswer(question);
        Storage.updateQuestionProgress(
            state.bankId,
            question.id,
            isCorrect,
            state.answers[question.id]
        );
        Quiz.saveSession();

        Tracker.submitAnswer(state.bankId, question.type, isCorrect, question.difficulty);

        const timeSpent = state.questionTimes[question.id] || 0;
        Tracker.questionTime(
            state.bankId,
            state.bank?.name || '',
            question.id,
            question.category,
            question.type,
            question.difficulty,
            timeSpent,
            isCorrect
        );

        Quiz._markStatsDirty();

        Quiz.renderQuestion();
        Quiz.renderFooter();

        const isLightning = state.answerMode === 'lightning';
        const isAutoNext = state.answerMode === 'autoNext';

        if (isLightning && isCorrect) {
            const questionCard = this.getQuestionCard();
            if (questionCard) {
                questionCard.classList.add('correct-flash');
                setTimeout(
                    () => questionCard.classList.remove('correct-flash'),
                    LIGHTNING_NEXT_DELAY_MS
                );
            }
            setTimeout(() => Quiz.nextQuestion(), LIGHTNING_NEXT_DELAY_MS);
            return;
        }

        if (isAutoNext && isCorrect) {
            setTimeout(() => Quiz.nextQuestion(), 500);
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    hasAnswer(question) {
        const answer = state.answers[question.id];
        switch (question.type) {
            case 'single':
            case 'judge':
                return answer !== undefined && answer !== null;
            case 'multiple':
                return Array.isArray(answer) && answer.length > 0;
            case 'fill':
                return Array.isArray(answer) && answer.some((a) => a.trim() !== '');
            case 'code':
                return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
            case 'essay':
            case '简答题':
                return answer && answer.selfCorrect !== undefined;
            default:
                return false;
        }
    },

    checkAnswer(question) {
        const userAnswer = state.answers[question.id];
        switch (question.type) {
            case 'single':
                return userAnswer === question.answer;
            case 'multiple': {
                const userSet = new Set(userAnswer || []);
                const correctSet = new Set(question.answer || []);
                return (
                    userSet.size === correctSet.size && [...userSet].every((a) => correctSet.has(a))
                );
            }
            case 'judge':
                return userAnswer === question.answer;
            case 'fill':
                return (question.answer || []).every((correct, index) =>
                    this.checkFillAnswer(userAnswer?.[index], correct)
                );
            case 'code':
                return true;
            case 'essay':
            case '简答题': {
                const eAns = state.answers[question.id];
                return eAns && eAns.selfCorrect === true;
            }
            default:
                return false;
        }
    },

    checkFillAnswer(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return false;
        return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    },

    _cleanMarkdown(text) {
        return text
            .replace(/```(\w*)\n/g, '')
            .replace(/```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\$([^$]+)\$/g, '$1')
            .replace(/[#*_~[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    _buildSearchKeyword(question) {
        let keyword = this._cleanMarkdown(question.question);
        const displayOpts = Quiz.getDisplayOptions(question);
        if (displayOpts && displayOpts.length > 0) {
            keyword += ' ' + displayOpts.map((o) => `${o.displayLetter}.${o.text}`).join(' ');
        }
        if (keyword.length > 300) keyword = keyword.substring(0, 300);
        if (question.code) keyword += ' ' + question.code.substring(0, 200);
        return keyword;
    },

    _buildSearchUrl(keyword) {
        const settings = Storage.getSettings();
        const url = AIEngines.buildSearchUrl(settings, keyword);
        console.log('[AI] ✅ 使用搜索引擎:', {
            aiEngine: AIEngines.normalizeSettings(settings).aiEngine,
            keyword,
            url
        });
        return url;
    },

    async openAIAnalysis(questionId) {
        const question = state.questions.find((q) => q.id === questionId);
        if (!question) return;

        await AIExplain.init();
        if (!AIExplain.isEnabled()) {
            Utils.showToast('管理员已关闭 AI 解读功能', 'error');
            return;
        }

        const isSubmitted = state.isReviewMode || state.submitted[question.id];
        const userAnswer = state.isReviewMode ? question.answer : state.answers[question.id];
        const isCorrect = state.isReviewMode
            ? true
            : isSubmitted
              ? this.checkAnswer(question)
              : null;

        if (AIExplain.isInPageMode()) {
            await AIExplain.openExplanation({
                question,
                bank: state.bank,
                userAnswer,
                isCorrect,
                displayOptions: Quiz.getDisplayOptions(question)
            });
            return;
        }

        const keyword = this._buildSearchKeyword(question);
        const url = this._buildSearchUrl(keyword);
        window.open(url, '_blank');
    },

    toggleBookmark(questionId) {
        const isBookmarked = Storage.toggleBookmark(state.bankId, questionId);
        Utils.showToast(isBookmarked ? '已收藏' : '已取消收藏', 'success', 1500);
        Quiz.renderQuestion();
    }
};

export default Answers;
