/**
 * 刷题页面模块（Facade）
 * 组合 core / renderer / answers / nav 四个子模块，暴露统一的 Quiz 对象
 */

import Core from './quiz-core.js';
import Renderer from './quiz-renderer.js';
import Answers from './quiz-answers.js';
import Nav from './quiz-nav.js';

const Quiz = {
    // state（共享引用）
    get state() {
        return Core.state;
    },

    // ---- core ----
    init() {
        return Core.init();
    },
    restoreSession() {
        return Core.restoreSession();
    },
    saveSession(immediate = false) {
        return Core.saveSession(immediate);
    },
    loadBankFromJson() {
        return Core.loadBankFromJson();
    },
    prepareQuestions() {
        return Core.prepareQuestions();
    },
    recordQuestionTime() {
        return Core.recordQuestionTime();
    },
    getQuestionTimeDisplay() {
        return Core.getQuestionTimeDisplay();
    },
    startExamTimer() {
        return Core.startExamTimer();
    },
    updateExamTimerDisplay() {
        return Core.updateExamTimerDisplay();
    },
    updateTimerDisplay() {
        return Core.updateTimerDisplay();
    },
    getDisplayOptions(q) {
        return Core.getDisplayOptions(q);
    },
    _saveReviewDuration() {
        return Core._saveReviewDuration();
    },

    // ---- renderer ----
    render() {
        return Renderer.render();
    },
    renderHeader() {
        return Renderer.renderHeader();
    },
    renderQuestion() {
        return Renderer.renderQuestion();
    },
    renderFooter() {
        return Renderer.renderFooter();
    },
    renderSidebarGrid() {
        return Renderer.renderSidebarGrid();
    },
    renderQuestionNav() {
        return Renderer.renderQuestionNav();
    },
    toggleNav() {
        return Renderer.toggleNav();
    },
    updateProgress() {
        return Renderer.updateProgress();
    },
    showFinishModal(t) {
        return Renderer.showFinishModal(t);
    },
    closeFinishModal() {
        return Renderer.closeFinishModal();
    },
    confirmFinish() {
        return Renderer.confirmFinish();
    },
    showResultModal() {
        return Renderer.showResultModal();
    },
    getSubmittedHint(q) {
        return Renderer.getSubmittedHint(q);
    },
    updateSelectedOptionState(a) {
        return Renderer.updateSelectedOptionState(a);
    },
    updateMultipleOptionState(a) {
        return Renderer.updateMultipleOptionState(a);
    },

    // ---- answers ----
    getQuestionCard() {
        return Answers.getQuestionCard();
    },
    bindOptionEvents(q) {
        return Answers.bindOptionEvents(q);
    },
    selectAnswer(id, a) {
        return Answers.selectAnswer(id, a);
    },
    toggleAnswer(id, a) {
        return Answers.toggleAnswer(id, a);
    },
    updateFillAnswer(id) {
        return Answers.updateFillAnswer(id);
    },
    submitEssay(id) {
        return Answers.submitEssay(id);
    },
    selfMarkEssay(id, c) {
        return Answers.selfMarkEssay(id, c);
    },
    submitCurrent() {
        return Answers.submitCurrent();
    },
    hasAnswer(q) {
        return Answers.hasAnswer(q);
    },
    checkAnswer(q) {
        return Answers.checkAnswer(q);
    },
    checkFillAnswer(u, c) {
        return Answers.checkFillAnswer(u, c);
    },
    toggleBookmark(id) {
        return Answers.toggleBookmark(id);
    },
    openAIAnalysis(id) {
        return Answers.openAIAnalysis(id);
    },

    // ---- nav ----
    nextQuestion() {
        return Nav.nextQuestion();
    },
    prevQuestion() {
        return Nav.prevQuestion();
    },
    goToQuestion(i) {
        return Nav.goToQuestion(i);
    },
    finish() {
        return Nav.finish();
    },
    saveAndQuit() {
        return Nav.saveAndQuit();
    },
    restart() {
        return Nav.restart();
    },
    startReview() {
        return Nav.startReview();
    },
    goHome() {
        return Nav.goHome();
    },
    showSettings() {
        return Nav.showSettings();
    },
    bindEvents() {
        return Nav.bindEvents();
    },
    _saveAndTrackStats() {
        return Nav._saveAndTrackStats();
    },
    _markStatsDirty() {
        return Nav._markStatsDirty();
    },
    _flushStatsNow() {
        return Nav._flushStatsNow();
    },
    _flushStatsSync() {
        return Nav._flushStatsSync();
    },
    renderResult() {
        return Nav.renderResult();
    }
};

// 注入 Quiz 引用到各子模块（避免循环依赖）
Core.setQuiz(Quiz);
Renderer.setQuiz(Quiz);
Answers.setQuiz(Quiz);
Nav.setQuiz(Quiz);

document.addEventListener('DOMContentLoaded', () => {
    Quiz.init();
});

window.Quiz = Quiz;
export default Quiz;
