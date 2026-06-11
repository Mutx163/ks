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
    init: () => Core.init(),
    restoreSession: () => Core.restoreSession(),
    saveSession: () => Core.saveSession(),
    loadBankFromJson: () => Core.loadBankFromJson(),
    prepareQuestions: () => Core.prepareQuestions(),
    recordQuestionTime: () => Core.recordQuestionTime(),
    getQuestionTimeDisplay: () => Core.getQuestionTimeDisplay(),
    startExamTimer: () => Core.startExamTimer(),
    updateExamTimerDisplay: () => Core.updateExamTimerDisplay(),
    updateTimerDisplay: () => Core.updateTimerDisplay(),
    getDisplayOptions: (q) => Core.getDisplayOptions(q),
    _saveReviewDuration: () => Core._saveReviewDuration(),

    // ---- renderer ----
    render: () => Renderer.render(),
    renderHeader: () => Renderer.renderHeader(),
    renderQuestion: () => Renderer.renderQuestion(),
    renderFooter: () => Renderer.renderFooter(),
    renderSidebarGrid: () => Renderer.renderSidebarGrid(),
    renderQuestionNav: () => Renderer.renderQuestionNav(),
    toggleNav: () => Renderer.toggleNav(),
    updateProgress: () => Renderer.updateProgress(),
    showFinishModal: (t) => Renderer.showFinishModal(t),
    closeFinishModal: () => Renderer.closeFinishModal(),
    confirmFinish: () => Renderer.confirmFinish(),
    showResultModal: () => Renderer.showResultModal(),
    getSubmittedHint: (q) => Renderer.getSubmittedHint(q),
    updateSelectedOptionState: (a) => Renderer.updateSelectedOptionState(a),
    updateMultipleOptionState: (a) => Renderer.updateMultipleOptionState(a),

    // ---- answers ----
    getQuestionCard: () => Answers.getQuestionCard(),
    bindOptionEvents: (q) => Answers.bindOptionEvents(q),
    selectAnswer: (id, a) => Answers.selectAnswer(id, a),
    toggleAnswer: (id, a) => Answers.toggleAnswer(id, a),
    updateFillAnswer: (id) => Answers.updateFillAnswer(id),
    submitEssay: (id) => Answers.submitEssay(id),
    selfMarkEssay: (id, c) => Answers.selfMarkEssay(id, c),
    submitCurrent: () => Answers.submitCurrent(),
    hasAnswer: (q) => Answers.hasAnswer(q),
    checkAnswer: (q) => Answers.checkAnswer(q),
    checkFillAnswer: (u, c) => Answers.checkFillAnswer(u, c),
    toggleBookmark: (id) => Answers.toggleBookmark(id),
    openAIAnalysis: (id) => Answers.openAIAnalysis(id),

    // ---- nav ----
    nextQuestion: () => Nav.nextQuestion(),
    prevQuestion: () => Nav.prevQuestion(),
    goToQuestion: (i) => Nav.goToQuestion(i),
    finish: () => Nav.finish(),
    saveAndQuit: () => Nav.saveAndQuit(),
    restart: () => Nav.restart(),
    startReview: () => Nav.startReview(),
    goHome: () => Nav.goHome(),
    showSettings: () => Nav.showSettings(),
    bindEvents: () => Nav.bindEvents(),
    _saveAndTrackStats: () => Nav._saveAndTrackStats(),
    _markStatsDirty: () => Nav._markStatsDirty(),
    _flushStatsNow: () => Nav._flushStatsNow(),
    _flushStatsSync: () => Nav._flushStatsSync(),
    renderResult: () => Nav.renderResult(),

    // 供子模块写入的临时字段
    _resultStats: null,
    _finishEscHandler: null,
    _beforeUnloadHandler: null,
    autoSaveInterval: null,
    timerInterval: null
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
