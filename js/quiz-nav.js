/**
 * 刷题页面 - 导航、结束、统计同步、事件绑定
 */

import Storage from './storage.js';
import Utils from './utils.js';
import API from './api.js';
import SyncQueue from './syncQueue.js';
import Tracker from './tracker.js';
import AIEngines from './aiEngines.js';
import AIExplain from './aiExplain.js';
import state from './quiz-state.js';
import { NAV_UNLOCK_DELAY_MS, SAVE_AND_QUIT_DELAY_MS, SWIPE_THRESHOLD_PX } from './quiz-state.js';

let Quiz = null;

const Nav = {
    setQuiz(q) {
        Quiz = q;
    },

    _navigateTo(index) {
        if (state.isNavigating) return;
        if (index < 0 || index >= state.questions.length) return;
        state.isNavigating = true;
        Quiz.recordQuestionTime();
        state.currentIndex = index;
        state.questionStartTime = Date.now();
        Quiz.saveSession();
        this._markStatsDirty();
        Quiz.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            state.isNavigating = false;
        }, NAV_UNLOCK_DELAY_MS);
    },

    nextQuestion() {
        this._navigateTo(state.currentIndex + 1);
    },

    prevQuestion() {
        this._navigateTo(state.currentIndex - 1);
    },

    goToQuestion(index) {
        this._navigateTo(index);
    },

    finish() {
        Quiz.showFinishModal();
    },

    async saveAndQuit() {
        Quiz.closeFinishModal();
        Utils.showToast('正在同步进度...', 'info', 2000);
        try {
            await this._flushStatsNow();
            await Quiz.saveSession(true);
            Utils.showToast('进度已安全同步', 'success');
        } catch (e) {
            console.warn('[Quiz] 退出同步异常:', e);
        }
        setTimeout(() => (window.location.href = 'index.html'), SAVE_AND_QUIT_DELAY_MS);
    },

    _calculateStats() {
        const duration = Math.round((Date.now() - state.startTime) / 1000);
        const submittedIds = Object.keys(state.submitted);
        const correctCount = submittedIds.filter((qId) => {
            const q = state.questions.find((q) => q.id == qId);
            return q && Quiz.checkAnswer(q);
        }).length;
        const accuracy =
            submittedIds.length > 0 ? Math.round((correctCount / submittedIds.length) * 100) : 0;
        const isExam = state.mode === 'exam';

        const heatmapData = submittedIds.map((qId) => {
            const q = state.questions.find((q) => q.id == qId);
            return {
                id: qId,
                category: q?.category,
                type: q?.type,
                difficulty: q?.difficulty,
                timeSpent: state.questionTimes[qId] || 0,
                isCorrect: q ? Quiz.checkAnswer(q) : false
            };
        });

        return {
            duration,
            submittedIds,
            correctCount,
            wrongCount: submittedIds.length - correctCount,
            accuracy,
            isExam,
            heatmapData,
            total: state.questions.length
        };
    },

    _saveAndTrackStats() {
        const stats = this._calculateStats();
        const { duration, submittedIds, correctCount, accuracy, isExam, heatmapData, total } =
            stats;

        Quiz._saveReviewDuration();

        Storage.addHistory({
            bankId: state.bankId,
            bankName: state.bank.name,
            mode: state.mode,
            total,
            correct: correctCount,
            duration
        });

        if (isExam) {
            Tracker.finishExam(state.bankId, total, correctCount, accuracy, duration, false);
        } else {
            Tracker.finishQuiz(
                state.bankId,
                state.bank.name,
                state.mode,
                total,
                correctCount,
                submittedIds.length - correctCount,
                accuracy,
                duration
            );
        }

        Tracker.questionHeatmap(state.bankId, state.bank.name, heatmapData);

        if (state._statsTimer) {
            clearTimeout(state._statsTimer);
            state._statsTimer = null;
        }
        state._statsDirty = false;

        const dA = submittedIds.length - (state._lastPushAnswered || 0);
        const dC = correctCount - (state._lastPushCorrect || 0);
        const dD = duration - (state._lastPushDuration || 0);
        if (dA > 0 || dC > 0 || dD > 0) {
            API.pushStats({
                bankId: state.bankId,
                bankName: state.bank.name,
                answered: dA,
                correct: dC,
                duration: dD
            }).then(() => {
                state._lastPushAnswered = submittedIds.length;
                state._lastPushCorrect = correctCount;
                state._lastPushDuration = duration;
            }).catch(() => {
                state._statsDirty = true;
            });
        }

        state._resultStats = stats;
    },

    renderResult() {
        const stats = this._calculateStats();
        const { duration, submittedIds, correctCount, accuracy, isExam, heatmapData, total } =
            stats;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        const passed = isExam ? accuracy >= state.examPassRate : null;
        const resultIconName = isExam && !passed ? 'frown' : 'party-popper';
        const resultIconClass = isExam && !passed ? 'result-icon-danger' : 'result-icon-success';
        const resultTitle = isExam ? (passed ? '考试通过！' : '未通过考试') : '答题完成！';

        Quiz._saveReviewDuration();

        Storage.addHistory({
            bankId: state.bankId,
            bankName: state.bank.name,
            mode: state.mode,
            total,
            correct: correctCount,
            duration
        });

        if (isExam) {
            Tracker.finishExam(state.bankId, total, correctCount, accuracy, duration, false);
        } else {
            Tracker.finishQuiz(
                state.bankId,
                state.bank.name,
                state.mode,
                total,
                correctCount,
                submittedIds.length - correctCount,
                accuracy,
                duration
            );
        }

        Tracker.questionHeatmap(state.bankId, state.bank.name, heatmapData);

        if (state._statsTimer) {
            clearTimeout(state._statsTimer);
            state._statsTimer = null;
        }
        state._statsDirty = false;

        const dAnswered = submittedIds.length - (state._lastPushAnswered || 0);
        const dCorrect = correctCount - (state._lastPushCorrect || 0);
        const dDuration = duration - (state._lastPushDuration || 0);

        if (dAnswered > 0 || dCorrect > 0 || dDuration > 0) {
            API.pushStats({
                bankId: state.bankId,
                bankName: state.bank.name,
                answered: dAnswered,
                correct: dCorrect,
                duration: dDuration
            }).then(() => {
                state._lastPushAnswered = submittedIds.length;
                state._lastPushCorrect = correctCount;
                state._lastPushDuration = duration;
            }).catch(() => {
                state._statsDirty = true;
            });
        }

        const container = document.getElementById('question-container');
        container.innerHTML = `
            <div class="result-page">
                <div class="result-icon ${resultIconClass}">
                    <i data-lucide="${resultIconName}"></i>
                </div>
                <div class="result-title">${resultTitle}</div>
                <div class="result-subtitle">${Utils.escapeHtml(state.bank.name)}</div>
                ${isExam ? `<div class="result-exam-info">及格线 ${state.examPassRate}%，正确率 ${accuracy}%</div>` : ''}
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
                        <div class="result-stat-value ${isExam && !passed ? 'danger' : ''}">${accuracy}%</div>
                        <div class="result-stat-label">正确率</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value">${minutes > 0 ? minutes + '分' : ''}${seconds}秒</div>
                        <div class="result-stat-label">用时</div>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.startReview()">
                        <i data-lucide="file-text"></i> 查看解析
                    </button>
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.restart()">
                        <i data-lucide="rotate-ccw"></i> 重新开始
                    </button>
                    <button class="btn btn-primary btn-lg" onclick="Quiz.goHome()">
                        <i data-lucide="home"></i> 返回首页
                    </button>
                </div>
            </div>
        `;

        Utils.initIcons?.();
        document.querySelector('.quiz-footer').style.display = 'none';
    },

    restart() {
        document.getElementById('finish-modal')?.remove();
        Storage.clearSession(state.bankId, state.mode);

        // 如果是常规练习模式，重置该题库的全局进度，并同步云端，防范刷新复活
        if (state.mode === 'all' || state.mode === 'random' || state.mode === 'shuffle_options') {
            Storage.resetBankProgress(state.bankId);
            API.pushProgress(Storage.getProgress(), true).catch((e) => {
                console.warn('[Quiz] 重置进度同步失败:', e);
            });
        }

        state.currentIndex = 0;
        state.answers = {};
        state.submitted = {};
        state.showExplanation = {};
        state.questionTimes = {};
        state.optionOrderCache = {};
        state.isFinished = false;
        state.startTime = Date.now();
        state.examTimeRemaining = 0;

        if (
            state.mode === 'exam' ||
            state.mode === 'random' ||
            state.mode === 'shuffle_options' ||
            state.mode === 'wrong'
        ) {
            Quiz.prepareQuestions();
        }

        if (state.mode === 'exam') Quiz.startExamTimer();

        if (state.mode === 'review') {
            state.questions.forEach((q) => {
                state.submitted[q.id] = true;
                state.showExplanation[q.id] = true;
                state.answers[q.id] = q.answer;
            });
        }

        document.querySelector('.quiz-footer').style.display = '';
        Quiz.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    startReview() {
        const container = document.getElementById('question-container');
        if (!container) return;

        state.isReviewMode = true;
        state.currentIndex = 0;
        state.isFinished = false;

        Object.keys(state.submitted).forEach((qId) => {
            state.showExplanation[qId] = true;
        });

        document.querySelector('.quiz-footer').style.display = '';
        Quiz.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async goHome() {
        if (!state.isFinished) {
            Utils.showToast('正在同步并退出...', 'info', 1500);
            try {
                await this._flushStatsNow();
                await Quiz.saveSession(true);
            } catch (e) {
                console.warn('[Quiz] 退出同步异常:', e);
            }
        }
        window.location.href = 'index.html';
    },

    _markStatsDirty() {
        state._statsDirty = true;
        if (state._statsTimer) return;
        state._statsTimer = setTimeout(() => {
            this._flushStatsNow();
        }, 5000);
    },

    _flushStatsNow() {
        if (state._statsTimer) {
            clearTimeout(state._statsTimer);
            state._statsTimer = null;
        }
        if (!state._statsDirty) return Promise.resolve(null);
        state._statsDirty = false;

        const submittedIds = Object.keys(state.submitted);
        if (submittedIds.length === 0) return Promise.resolve(null);

        const correctCount = submittedIds.filter((qId) => {
            const q = state.questions.find((q) => q.id == qId);
            return q && Quiz.checkAnswer(q);
        }).length;
        const duration = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;

        const dAnswered = submittedIds.length - (state._lastPushAnswered || 0);
        const dCorrect = correctCount - (state._lastPushCorrect || 0);
        const dDuration = duration - (state._lastPushDuration || 0);

        if (dAnswered <= 0 && dCorrect <= 0 && dDuration <= 0) return Promise.resolve(null);

        const nextPushAnswered = submittedIds.length;
        const nextPushCorrect = correctCount;
        const nextPushDuration = duration;

        return API.pushStats({
            bankId: state.bankId,
            bankName: state.bank?.name || '',
            answered: dAnswered,
            correct: dCorrect,
            duration: dDuration
        }).then((result) => {
            if (result) {
                state._lastPushAnswered = nextPushAnswered;
                state._lastPushCorrect = nextPushCorrect;
                state._lastPushDuration = nextPushDuration;
            } else {
                state._statsDirty = true;
            }
            return result;
        }).catch((err) => {
            console.warn('[QuizNav] pushStats 错误:', err);
            state._statsDirty = true;
            return null;
        });
    },

    _flushStatsSync() {
        if (!state._statsDirty) return;

        const submittedIds = Object.keys(state.submitted);
        if (submittedIds.length === 0) return;

        const correctCount = submittedIds.filter((qId) => {
            const q = state.questions.find((q) => q.id == qId);
            return q && Quiz.checkAnswer(q);
        }).length;
        const duration = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;

        const dAnswered = submittedIds.length - (state._lastPushAnswered || 0);
        const dCorrect = correctCount - (state._lastPushCorrect || 0);
        const dDuration = duration - (state._lastPushDuration || 0);

        if (dAnswered <= 0 && dCorrect <= 0 && dDuration <= 0) {
            state._statsDirty = false;
            return;
        }

        state._statsDirty = false;
        if (state._statsTimer) {
            clearTimeout(state._statsTimer);
            state._statsTimer = null;
        }

        const statsPayload = {
            bankId: state.bankId,
            bankName: state.bank?.name || '',
            answered: dAnswered,
            correct: dCorrect,
            duration: dDuration
        };

        const markStatsSent = () => {
            state._lastPushAnswered = submittedIds.length;
            state._lastPushCorrect = correctCount;
            state._lastPushDuration = duration;
        };

        if (navigator.sendBeacon && API.isRegistered()) {
            try {
                const queued = navigator.sendBeacon(
                    API.BASE_URL + '/api/sync',
                    JSON.stringify({ deviceId: API.getDeviceId(), ...statsPayload })
                );
                if (queued) {
                    markStatsSent();
                    return;
                }
                console.warn('[Quiz] sendBeacon 未入队，写入失败队列');
            } catch (e) {
                console.warn('[Quiz] sendBeacon 失败:', e.message);
            }
            SyncQueue.enqueueStats(statsPayload);
            markStatsSent();
            return;
        }

        API.pushStats(statsPayload)
            .then(() => {
                markStatsSent();
            })
            .catch(() => {
                state._statsDirty = true;
            });
    },

    async showSettings() {
        await AIExplain.init();
        const settings = Storage.getSettings();
        const fontSize = settings.fontSize || 16;
        const answerMode = settings.answerMode || 'normal';
        const swipeEnabled = settings.swipeNavigation !== false;
        const aiSettings = AIEngines.normalizeSettings(settings);

        const content = `
            <div class="settings-container">
                <!-- 基础个性化 -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        ${Utils.icon('user', 'settings-group-icon')}
                        <span>基础个性化</span>
                    </div>
                    <div class="settings-group-body">
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <span class="settings-item-title">字体大小</span>
                                <span class="settings-item-desc">调整刷题与解析内容的字体显示大小</span>
                            </div>
                            <div class="settings-item-control">
                                <select id="setting-font-size" class="settings-select">
                                    <option value="14" ${fontSize === 14 ? 'selected' : ''}>14px - 较小</option>
                                    <option value="16" ${fontSize === 16 ? 'selected' : ''}>16px - 标准</option>
                                    <option value="18" ${fontSize === 18 ? 'selected' : ''}>18px - 较大</option>
                                    <option value="20" ${fontSize === 20 ? 'selected' : ''}>20px - 大</option>
                                    <option value="24" ${fontSize === 24 ? 'selected' : ''}>24px - 超大</option>
                                </select>
                            </div>
                        </div>
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <span class="settings-item-title">左右滑动切换</span>
                                <span class="settings-item-desc">在刷题页左右滑动屏幕来切换题目</span>
                            </div>
                            <div class="settings-item-control">
                                <label class="toggle-label">
                                    <input type="checkbox" id="setting-swipe" ${swipeEnabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 答题偏好 -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        ${Utils.icon('check-square', 'settings-group-icon')}
                        <span>答题偏好</span>
                    </div>
                    <div class="settings-group-body">
                        <div class="settings-item vertical">
                            <div class="settings-item-info">
                                <span class="settings-item-title">答题判定模式</span>
                                <span class="settings-item-desc">控制点击选项后的验证逻辑与自动跳转方式</span>
                            </div>
                            <div class="settings-item-control">
                                <select id="setting-answer-mode" class="settings-select">
                                    <option value="normal" ${answerMode === 'normal' ? 'selected' : ''}>普通模式 - 手动提交手动跳题</option>
                                    <option value="autoNext" ${answerMode === 'autoNext' ? 'selected' : ''}>自动跳题 - 手动提交答对自动跳</option>
                                    <option value="lightning" ${answerMode === 'lightning' ? 'selected' : ''}>闪电模式 - 点击即判答对自动跳</option>
                                    <option value="instant" ${answerMode === 'instant' ? 'selected' : ''}>即时判断 - 点击即判不自动跳</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- AI 智能助理 -->
                <div class="settings-group">
                    <div class="settings-group-header">
                        ${Utils.icon('cpu', 'settings-group-icon')}
                        <span>AI 智能助理</span>
                    </div>
                    <div class="settings-group-body">
                        ${AIEngines.renderSettingsFields(aiSettings)}
                        ${AIExplain.renderSettingsFields()}
                    </div>
                </div>
            </div>
        `;

        Utils.showModal({
            title: `${Utils.icon('settings')} 设置`,
            content,
            buttons: [
                {
                    label: '保存',
                    class: 'btn-primary',
                    onClick: (modal) => {
                        const size = parseInt(modal.querySelector('#setting-font-size').value);
                        const newAnswerMode = modal.querySelector('#setting-answer-mode').value;
                        const aiForm = AIEngines.readSettingsForm(modal);
                        if (aiForm.error) {
                            Utils.showToast(aiForm.error, 'error');
                            return;
                        }

                        if (size >= 12 && size <= 24) {
                            Storage.updateSettings({ fontSize: size });
                            Utils.applyFontSize(size);
                        }

                        const newSwipe = modal.querySelector('#setting-swipe').checked;

                        Storage.updateSettings({
                            answerMode: newAnswerMode,
                            swipeNavigation: newSwipe,
                            ...aiForm
                        });
                        AIExplain.saveSettingsFromModal(modal);

                        state.answerMode = newAnswerMode;
                        API.pushSettings(Storage.getSettings());
                        Utils.showToast('设置已保存', 'success');
                        modal.remove();
                    }
                },
                {
                    label: '取消',
                    class: 'btn-secondary',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'lg'
        });

        const settingsModal = document
            .getElementById('setting-ai-engine')
            ?.closest('.modal-overlay');
        AIEngines.bindSettingsUI(settingsModal);
        AIExplain.bindSettingsUI(settingsModal);
    },

    bindEvents() {
        document.addEventListener('pointerup', (e) => {
            const btn = e.target.closest('button, .btn, .option-item, .judge-option');
            if (btn) btn.blur();
        });

        window.addEventListener('beforeunload', () => Quiz.saveSession());

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') Quiz.saveSession();
        });

        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener(
            'touchstart',
            (e) => {
                touchStartX = e.changedTouches[0].clientX;
                touchStartY = e.changedTouches[0].clientY;
            },
            { passive: true }
        );

        document.addEventListener(
            'touchend',
            (e) => {
                if (document.getElementById('finish-modal')) return;
                const navPanel = document.getElementById('nav-panel');
                if (navPanel && navPanel.classList.contains('show')) return;

                const touchTarget = e.target;
                const scrollableParent = touchTarget.closest(
                    'pre, code, .code-block, .code-wrapper, .explanation-content, [style*="overflow-x"]'
                );
                if (scrollableParent && scrollableParent.scrollWidth > scrollableParent.clientWidth)
                    return;

                const swipeSettings = Storage.getSettings().swipeNavigation;
                if (swipeSettings === false) return;

                const deltaX = e.changedTouches[0].clientX - touchStartX;
                const deltaY = e.changedTouches[0].clientY - touchStartY;

                if (Math.abs(deltaY) > Math.abs(deltaX)) return;
                if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

                if (deltaX < 0) {
                    this.nextQuestion();
                } else {
                    this.prevQuestion();
                }
            },
            { passive: true }
        );

        document.addEventListener('keydown', (e) => {
            if (document.getElementById('finish-modal')) return;

            const activeEl = document.activeElement;
            if (
                activeEl &&
                (activeEl.tagName === 'INPUT' ||
                    activeEl.tagName === 'TEXTAREA' ||
                    activeEl.tagName === 'SELECT')
            ) {
                return;
            }

            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                const question = state.questions[state.currentIndex];
                if (question && !state.submitted[question.id]) {
                    Quiz.submitCurrent();
                } else {
                    this.nextQuestion();
                }
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prevQuestion();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.nextQuestion();
            }

            const question = state.questions[state.currentIndex];
            if (question && !state.submitted[question.id]) {
                if (question.type === 'single' || question.type === 'multiple') {
                    const key = e.key.toUpperCase();
                    const numToLetter = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' };
                    const selectedKey = numToLetter[e.key] || key;
                    if (['A', 'B', 'C', 'D', 'E', 'F'].includes(selectedKey)) {
                        if (question.type === 'single') {
                            Quiz.selectAnswer(question.id, selectedKey);
                        } else {
                            Quiz.toggleAnswer(question.id, selectedKey);
                        }
                    }
                }
                if (question.type === 'judge') {
                    if (e.key === '1' || e.key === 't' || e.key === 'T') {
                        Quiz.selectAnswer(question.id, true);
                    }
                    if (e.key === '0' || e.key === 'f' || e.key === 'F') {
                        Quiz.selectAnswer(question.id, false);
                    }
                }
            }
        });
    }
};

export default Nav;
