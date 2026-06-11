/**
 * 刷题页面 - 共享状态与常量
 */

export const INPUT_SAVE_DEBOUNCE_MS = 300;
export const FILL_AUTO_FOCUS_DELAY_MS = 100;
export const LIGHTNING_NEXT_DELAY_MS = 300;
export const NAV_UNLOCK_DELAY_MS = 250;
export const SAVE_AND_QUIT_DELAY_MS = 300;
export const SWIPE_THRESHOLD_PX = 70;

const state = {
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
    answerMode: 'normal',
    filterType: 'all',
    isReviewMode: false,
    _reviewDurationSaved: 0,
    isNavigating: false,
    optionOrderCache: {},
    _statsDirty: false,
    _statsTimer: null,
    _lastPushAnswered: 0,
    _lastPushCorrect: 0,
    _lastPushDuration: 0,
    // 临时字段
    _resultStats: null,
    _finishEscHandler: null,
    _beforeUnloadHandler: null,
    autoSaveInterval: null,
    timerInterval: null
};

export default state;
