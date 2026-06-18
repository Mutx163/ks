/**
 * 排行榜 & 多端云同步 API 模块
 *
 * 自动同步策略：
 *   页面加载 → 拉取云端设置+进度，合并到本地
 *   答题完成 → 推送答题数据到云端
 *   设置变更 → 推送设置到云端
 *   进度变更 → 定时推送进度到云端（防抖 5 秒）
 */

import StorageMod from './storage.js';

const API = {
    // API 地址优先级：
    //   1. window.__API_BASE__ (可在 HTML 中注入)
    //   2. localStorage ks_api_base (用户/管理员设置)
    //   3. 本地开发时使用相对路径（由 Vite proxy 转发）
    //   4. 生产环境使用宝塔服务器
    BASE_URL:
        window.__API_BASE__ ||
        localStorage.getItem('ks_api_base') ||
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? ''
            : window.location.origin),

    // localStorage 键名
    KEYS: {
        SYNC_CODE: 'ks_sync_code',
        INITIALS: 'ks_initials',
        DEVICE_ID: 'ks_device_id',
        LAST_PULL: 'ks_last_pull'
    },

    _syncTimer: null,
    _deviceId: null,
    _syncCode: null,

    // ==================== 设备标识 ====================

    /**
     * 获取或生成设备ID（持久化 UUID）
     */
    _generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // HTTP 环境降级
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    },

    getDeviceId() {
        if (this._deviceId) return this._deviceId;
        let id = localStorage.getItem(this.KEYS.DEVICE_ID);
        if (!id) {
            id = this._generateId();
            localStorage.setItem(this.KEYS.DEVICE_ID, id);
        }
        this._deviceId = id;
        return id;
    },

    /**
     * 获取同步码
     */
    getSyncCode() {
        if (this._syncCode) return this._syncCode;
        this._syncCode = localStorage.getItem(this.KEYS.SYNC_CODE) || '';
        return this._syncCode;
    },

    /**
     * 获取姓名首字母
     */
    getInitials() {
        return localStorage.getItem(this.KEYS.INITIALS) || '';
    },

    /**
     * 是否已注册（有同步码）
     */
    isRegistered() {
        return !!this.getSyncCode();
    },

    // ==================== 网络请求 ====================

    async request(path, options = {}) {
        const startTime = Date.now();
        const { cacheBust: _cacheBust, ...fetchOptions } = options;
        const method = fetchOptions.method || 'GET';
        try {
            // 处理 BASE_URL 为空的情况（本地开发 Vite 代理）
            const base = this.BASE_URL || window.location.origin;
            const urlObj = new URL(path, base);
            if (method === 'GET' && options.cacheBust !== false) {
                urlObj.searchParams.set('_ts', Date.now().toString());
            }
            const url = urlObj.toString();

            const fetchCache = options.cacheBust === false ? 'default' : 'no-store';
            const res = await fetch(url, {
                cache: fetchCache,
                headers: { 'Content-Type': 'application/json' },
                ...fetchOptions
            });

            const elapsed = Date.now() - startTime;

            const text = await res.text();
            let data = null;
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    console.warn(`[API] 非 JSON 响应: ${text.slice(0, 200)}`);
                    if (!res.ok) {
                        if (res.status === 403)
                            return { ok: false, disabled: true, error: '资源不可用' };
                        return null;
                    }
                    return null;
                }
            }

            if (!res.ok) {
                console.warn(`[API] 请求失败 (${elapsed}ms): ${data?.error || '未知错误'}`);
                // 403 表示资源被禁用，返回特殊标记以区分网络错误
                if (res.status === 403)
                    return { ok: false, disabled: true, error: data?.error || '资源不可用' };
                return null;
            }
            return data;
        } catch (e) {
            const elapsed = Date.now() - startTime;
            console.error(`[API] ${method} ${path} 异常 (${elapsed}ms):`, e.message);
            return null;
        }
    },

    /**
     * 带重试的请求方法
     * @param {string} path - API 路径
     * @param {object} options - 请求选项
     * @param {number} maxRetries - 最大重试次数（默认 2）
     * @param {number} baseDelay - 基础延迟毫秒数（默认 1000）
     * @returns {Promise<object|null>}
     */
    async requestWithRetry(path, options = {}, maxRetries = 2, baseDelay = 1000) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.request(path, options);
                // 成功获取数据（包括 403 禁用标记）
                if (result !== null) return result;
            } catch {
                // 继续重试
            }

            // 最后一次尝试失败，不再重试
            if (attempt === maxRetries) break;

            // 检查网络状态，离线时不重试
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                console.warn('[API] 离线状态，跳过重试');
                break;
            }

            // 指数退避延迟
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`[API] 第 ${attempt + 1} 次重试，等待 ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        console.error(`[API] ${path} 重试 ${maxRetries} 次后仍然失败`);
        return null;
    },

    // ==================== 注册 / 绑定 ====================

    /**
     * 注册新用户（生成同步码）
     */
    async register(initials) {
        const data = await this.request('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: this.getDeviceId(),
                initials: initials.trim().toUpperCase()
            })
        });
        if (data && data.ok && data.syncCode) {
            localStorage.setItem(this.KEYS.SYNC_CODE, data.syncCode);
            localStorage.setItem(this.KEYS.INITIALS, data.initials);
            this._syncCode = data.syncCode;
        }
        return data;
    },

    /**
     * 绑定到已有同步码（多设备同步）
     */
    async bindDevice(syncCode) {
        // 收集本地待合并数据
        const localStats = this._collectLocalStats();
        const data = await this.request('/api/bind', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: this.getDeviceId(),
                syncCode: syncCode.trim().toUpperCase(),
                localStats
            })
        });
        if (data && data.ok) {
            localStorage.setItem(this.KEYS.SYNC_CODE, data.syncCode);
            localStorage.setItem(this.KEYS.INITIALS, data.initials);
            this._syncCode = data.syncCode;
            // 绑定后拉取云端数据
            await this.pullCloudData();
        }
        return data;
    },

    /**
     * 查询当前设备是否已注册
     */
    async checkRegistered() {
        const data = await this.request(`/api/user/${this.getDeviceId()}`);
        if (data && data.ok && data.registered) {
            localStorage.setItem(this.KEYS.SYNC_CODE, data.user.syncCode);
            localStorage.setItem(this.KEYS.INITIALS, data.user.initials);
            this._syncCode = data.user.syncCode;
            return true;
        }
        return false;
    },

    // ==================== 自动同步 ====================

    /**
     * 页面加载时自动同步（拉取云端 → 合并 → 静默执行）
     */
    async autoSync() {
        console.log('[API] ========== 自动同步开始 ==========');
        const startTime = Date.now();

        if (!this.isRegistered()) {
            console.log('[API] 👤 未注册，尝试恢复同步码...');
            const recovered = await this.checkRegistered();
            if (!recovered) {
                console.log('[API] ❌ 无法恢复同步码，跳过同步');
                return false;
            }
            console.log('[API] ✅ 同步码已恢复');
        }

        // 检查封禁状态
        const isBanned = await this.checkBanStatus();
        if (isBanned) {
            console.log('[API] 🚫 用户已被封禁');
            return false;
        }

        console.log('[API] ☁️ 拉取云端数据...');
        await this.pullCloudData();

        console.log('[API] 📤 推送本地数据到云端...');
        await this.pushAll();

        const elapsed = Date.now() - startTime;
        console.log(`[API] ========== 自动同步完成 (${elapsed}ms) ==========`);
        return true;
    },

    // 检查封禁状态（无缓存，实时检查）
    async checkBanStatus() {
        try {
            const data = await this.request(`/api/cloud-data/${this.getDeviceId()}`);
            const banned = data && data.user && data.user.banned === 1;
            if (banned) this._showBanNotice();
            return !!banned;
        } catch (e) {
            console.warn('[API] 检查封禁状态失败:', e.message);
            return false;
        }
    },

    /**
     * 拉取云端设置和进度，合并到本地
     */
    async pullCloudData() {
        console.log('[API] 📥 开始拉取云端数据...');
        const startTime = Date.now();

        const data = await this.request(`/api/cloud-data/${this.getDeviceId()}`);
        if (!data || !data.ok) {
            console.log('[API] ⚠️ 云端数据拉取失败或无数据');
            return;
        }

        console.log('[API] 📥 云端数据响应:', {
            hasUser: !!data.user,
            hasSettings: !!data.settings && Object.keys(data.settings).length > 0,
            hasProgress: !!data.progress && Object.keys(data.progress).length > 0
        });

        const Storage = StorageMod;
        if (!Storage) return;

        // 同步用户名（云端为准）
        if (data.user?.initials) {
            const localInitials = localStorage.getItem(this.KEYS.INITIALS);
            if (localInitials !== data.user.initials) {
                localStorage.setItem(this.KEYS.INITIALS, data.user.initials);
                console.log('[API] 👤 用户名已同步:', localInitials, '->', data.user.initials);
            }
        }

        // 保存管理员状态
        if (data.user?.is_admin !== undefined) {
            localStorage.setItem('ks_is_admin', data.user.is_admin ? '1' : '0');
        }

        // 合并设置（云端优先，但保留本地特有的字段）
        if (data.settings && Object.keys(data.settings).length > 0) {
            const localSettings = Storage.getSettings();
            const merged = { ...localSettings, ...data.settings };
            Storage.updateSettings(merged);
            console.log('[API] ⚙️ 设置已合并');
        }

        // 合并进度（取各 bankId 的最大值）
        if (data.progress && Object.keys(data.progress).length > 0) {
            console.log('[API] 📊 合并进度数据...');
            this._mergeProgress(data.progress);
        }

        // 合并收藏
        if (data.bookmarks && Object.keys(data.bookmarks).length > 0) {
            const localBookmarks = Storage.getBookmarks();
            const merged = { ...localBookmarks, ...data.bookmarks };
            Storage.set(Storage.KEYS.BOOKMARKS, merged);
            console.log('[API] 📁 收藏数据已合并');
        }

        localStorage.setItem(this.KEYS.LAST_PULL, Date.now().toString());
        const elapsed = Date.now() - startTime;
        console.log(`[API] ✅ 云端数据拉取完成 (${elapsed}ms)`);
    },

    /**
     * 推送所有本地数据到云端
     */
    async pushAll() {
        console.log('[API] 📤 开始推送本地数据...');
        const Storage = StorageMod;
        if (!Storage) return;

        // 推送设置
        console.log('[API] 📤 推送设置...');
        this.pushSettings(Storage.getSettings());

        // 推送进度
        console.log('[API] 📤 推送进度...');
        this.pushProgress(Storage.getProgress());

        // 推送收藏
        console.log('[API] 📤 推送收藏...');
        this.pushBookmarks(Storage.getBookmarks());
        console.log('[API] ✅ 本地数据推送完成');
    },

    /**
     * 推送收藏到云端
     */
    pushBookmarks(bookmarks) {
        if (!this.isRegistered() || !bookmarks) return;
        this.request('/api/bookmarks', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: this.getDeviceId(),
                bookmarks
            })
        }).then((data) => {
            if (data && data.disabled) {
                this._showBanNotice();
            }
        });
    },

    /**
     * 推送设置到云端
     */
    pushSettings(settings) {
        if (!this.isRegistered() || !settings) return;
        this.request('/api/settings', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: this.getDeviceId(),
                settings
            })
        }).then((data) => {
            if (data && data.disabled) {
                this._showBanNotice();
            }
        });
    },

    /**
     * 推送进度到云端（防抖 5 秒）
     * @param {object} progress - 进度数据
     * @param {boolean} immediate - 是否立即推送
     * @returns {Promise} 包含请求结果的 Promise
     */
    pushProgress(progress, immediate = false) {
        if (!this.isRegistered() || !progress) return Promise.resolve(null);
        clearTimeout(this._syncTimer);

        const pushTask = () => {
            return this.request('/api/progress', {
                method: 'POST',
                body: JSON.stringify({
                    deviceId: this.getDeviceId(),
                    progress
                })
            })
                .then((data) => {
                    if (!data) {
                        console.warn(
                            '[API] pushProgress 同步失败，响应为空，将在下次数据变动时重试'
                        );
                    } else if (data.disabled) {
                        this._showBanNotice();
                    }
                    return data;
                })
                .catch((err) => {
                    console.warn('[API] pushProgress 同步异常:', err.message);
                    return null;
                });
        };

        if (immediate) {
            return pushTask();
        }

        return new Promise((resolve) => {
            this._syncTimer = setTimeout(() => {
                pushTask().then(resolve);
            }, 5000);
        });
    },

    /**
     * 立即推送答题数据到云端
     * @param {object} stats - { bankId, bankName, answered, correct, duration }
     * @returns {Promise|null} 请求结果，异常时不会抛出（内部 catch）
     */
    pushStats(stats) {
        if (!this.isRegistered()) return null;
        return this.request('/api/sync', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: this.getDeviceId(),
                ...stats
            })
        })
            .then((data) => {
                // 检查是否被封禁
                if (data && data.disabled) {
                    this._showBanNotice();
                }
                return data;
            })
            .catch((e) => {
                console.warn('[API] pushStats 失败:', e.message);
                return null;
            });
    },

    // 显示封禁通知
    _banNoticeShown: false,
    _showBanNotice() {
        if (this._banNoticeShown) return;
        this._banNoticeShown = true;

        // 创建封禁提示（无关闭按钮，必须联系管理员）
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
            pointer-events: all;
        `;
        notice.innerHTML = `
            <div style="
                background: #fff; border-radius: 16px; padding: 32px;
                max-width: 360px; text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            ">
                <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
                <h3 style="font-size: 20px; margin-bottom: 12px; color: #1f2937;">账号已被封禁</h3>
                <p style="font-size: 15px; color: #6b7280; line-height: 1.6;">
                    您的账号已被管理员封禁<br>
                    无法使用刷题功能<br><br>
                    <strong>如有疑问，请联系管理员</strong>
                </p>
            </div>
        `;
        document.body.appendChild(notice);

        // 阻止页面滚动
        document.body.style.overflow = 'hidden';
    },

    // ==================== 排行榜 ====================

    async getLeaderboard(sort = 'answered', limit = 50, stats = false) {
        return await this.request(
            `/api/leaderboard?sort=${sort}&limit=${limit}&deviceId=${this.getDeviceId()}${stats ? '&stats=1' : ''}`
        );
    },

    // ==================== 内部工具 ====================

    /**
     * 收集本地答题统计数据（用于绑定时合并到云端）
     */
    _collectLocalStats() {
        const Storage = StorageMod;
        if (!Storage) return [];
        const progress = Storage.getProgress();
        const banks = Storage.getBanks();
        const result = [];
        for (const bank of banks) {
            const p = progress[bank.id];
            if (p && (p.answered > 0 || p.duration > 0)) {
                result.push({
                    bankId: bank.id,
                    bankName: bank.name || '',
                    answered: p.answered || 0,
                    correct: p.correct || 0,
                    duration: p.duration || 0
                });
            }
        }
        return result;
    },

    /**
     * 合并云端进度到本地（取各 bankId 的较大值）
     */
    _mergeProgress(cloudProgress) {
        const Storage = StorageMod;
        if (!Storage) return;
        const local = Storage.getProgress();
        let changed = false;

        for (const [bankId, cloud] of Object.entries(cloudProgress)) {
            if (bankId === '_global') {
                // 合并累计时长
                const localGlobal = local._global || {};
                const cloudDur = cloud.totalDuration || 0;
                const localDur = localGlobal.totalDuration || 0;
                if (cloudDur > localDur) {
                    local._global = { ...localGlobal, totalDuration: cloudDur };
                    changed = true;
                }
                continue;
            }
            const l = local[bankId];
            if (!l) {
                local[bankId] = cloud;
                changed = true;
            } else {
                // 合并每题库累计时长（取较大值，避免多设备旧数据覆盖新数据）
                const cloudDuration = cloud.duration || 0;
                const localDuration = l.duration || 0;
                if (cloudDuration > localDuration) {
                    l.duration = cloudDuration;
                    changed = true;
                }

                // 合并逐题数据（取最新时间戳）
                const localQ = l.questions || {};
                const cloudQ = cloud.questions || {};
                const hasLocalQ = Object.keys(localQ).length > 0;
                const hasCloudQ = Object.keys(cloudQ).length > 0;

                if (hasCloudQ) {
                    if (!hasLocalQ) {
                        // 本地无逐题数据，直接用云端的
                        l.questions = cloudQ;
                        changed = true;
                    } else {
                        // 两边都有逐题数据，按题目合并（最新时间戳胜出）
                        for (const [qid, cq] of Object.entries(cloudQ)) {
                            const lq = localQ[qid];
                            if (!lq) {
                                // 本地没有这道题，直接用云端的
                                localQ[qid] = cq;
                                changed = true;
                            } else {
                                const cloudTime = cq.answeredAt
                                    ? new Date(cq.answeredAt).getTime()
                                    : 0;
                                const localTime = lq.answeredAt
                                    ? new Date(lq.answeredAt).getTime()
                                    : 0;
                                if (cloudTime > localTime) {
                                    // 云端更新，但保留本地更高的 attempts
                                    localQ[qid] = {
                                        ...cq,
                                        attempts: Math.max(cq.attempts || 0, lq.attempts || 0)
                                    };
                                    changed = true;
                                } else if (
                                    cloudTime === localTime &&
                                    (cq.attempts || 0) > (lq.attempts || 0)
                                ) {
                                    // 同一时间，取更高的 attempts
                                    localQ[qid].attempts = cq.attempts;
                                    changed = true;
                                }
                            }
                        }
                        l.questions = localQ;
                    }

                    // 从逐题数据重新计算汇总数字
                    let answered = 0,
                        correct = 0,
                        wrong = 0;
                    for (const q of Object.values(l.questions)) {
                        answered++;
                        if (q.correct) correct++;
                        else wrong++;
                    }
                    l.answered = answered;
                    l.correct = correct;
                    l.wrong = wrong;
                } else if ((cloud.answered || 0) > (l.answered || 0)) {
                    // 云端无逐题数据但汇总更大（旧版客户端），只更新汇总
                    l.answered = cloud.answered || l.answered;
                    l.correct = cloud.correct || l.correct;
                    l.wrong = cloud.wrong || l.wrong;
                    changed = true;
                }
            }
        }

        if (changed) {
            Storage.set(Storage.KEYS.PROGRESS, local);
        }
    },

    // ==================== UI ====================

    /**
     * 显示注册/绑定弹窗
     */
    showRegisterModal() {
        return new Promise((resolve) => {
            const Utils = window.Utils;
            if (!Utils) {
                resolve(false);
                return;
            }

            const renderContent = () => {
                return `
                    <div style="display: flex; gap: 0; margin-bottom: 20px; background: var(--bg-hover); border-radius: 10px; padding: 4px;">
                        <button id="tab-register" style="flex:1; padding: 10px; border: none; background: #fff; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s;">✨ 新用户注册</button>
                        <button id="tab-bind" style="flex:1; padding: 10px; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">🔗 绑定同步码</button>
                    </div>
                    
                    <div id="register-form">
                        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px; text-align: center;">
                            输入姓名首字母，即可开始刷题！
                        </p>
                        <input type="text" id="reg-initials"
                            placeholder="输入你的代号"
                            maxlength="4"
                            style="text-transform: uppercase; text-align: center; font-size: 24px; letter-spacing: 8px; width: 100%; padding: 16px; border: 2px solid var(--border); border-radius: 12px; background: var(--bg);"
                            autocomplete="off">
                        <p style="color: var(--text-tertiary); font-size: 22px; margin-top: 8px; text-align: center;">
                            1-4个字母，随意组合
                        </p>
                    </div>
                    
                    <div id="bind-form" style="display: none;">
                        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px; text-align: center;">
                            在其他设备已有账号？输入同步码继续
                        </p>
                        <input type="text" id="reg-sync-code"
                            placeholder="输入6位同步码"
                            maxlength="6"
                            style="text-transform: uppercase; text-align: center; font-size: 24px; letter-spacing: 6px; width: 100%; padding: 16px; border: 2px solid var(--border); border-radius: 12px; background: var(--bg);"
                            autocomplete="off">
                        <p style="color: var(--text-tertiary); font-size: 12px; margin-top: 8px; text-align: center;">
                            同步码可在已登录设备的"我的"页面查看
                        </p>
                    </div>
                `;
            };

            const modal = Utils.showModal({
                title: '🏆 欢迎使用城科卷王',
                closable: false,
                content: renderContent(),
                buttons: [
                    {
                        label: '开始刷题',
                        class: 'btn-primary',
                        onClick: (modal) => {
                            // 判断当前是注册还是绑定
                            const registerForm = modal.querySelector('#register-form');
                            const isRegister = registerForm.style.display !== 'none';

                            if (isRegister) {
                                const input = modal.querySelector('#reg-initials');
                                const initials = (input?.value || '').trim().toUpperCase();
                                if (initials.length < 1 || initials.length > 4) {
                                    Utils.showToast('请输入1-4个字母', 'error');
                                    return;
                                }
                                Utils.showToast('注册中...', 'info');
                                API.register(initials)
                                    .then((result) => {
                                        if (result && result.ok) {
                                            Utils.showToast(`注册成功！`, 'success');
                                            modal.remove();
                                            resolve(true);
                                        } else {
                                            Utils.showToast('注册失败，请重试', 'error');
                                        }
                                    })
                                    .catch((e) => {
                                        console.error('[Register]', e);
                                        Utils.showToast('网络错误，请重试', 'error');
                                    });
                            } else {
                                const input = modal.querySelector('#reg-sync-code');
                                const code = (input?.value || '').trim().toUpperCase();
                                if (code.length !== 6) {
                                    Utils.showToast('请输入6位同步码', 'error');
                                    return;
                                }
                                Utils.showToast('绑定中...', 'info');
                                API.bindDevice(code)
                                    .then((result) => {
                                        if (result && result.ok) {
                                            Utils.showToast(
                                                `绑定成功！欢迎 ${result.initials}`,
                                                'success'
                                            );
                                            modal.remove();
                                            resolve(true);
                                        } else {
                                            Utils.showToast(result?.error || '绑定失败', 'error');
                                        }
                                    })
                                    .catch((e) => {
                                        console.error('[Bind]', e);
                                        Utils.showToast('网络错误，请重试', 'error');
                                    });
                            }
                        }
                    }
                    // 无跳过按钮，必须注册或绑定
                ],
                size: 'sm'
            });

            // 动态绑定 Tab 切换事件，避免全局 ID 冲突和行内 script 限制
            const tabRegister = modal.querySelector('#tab-register');
            const tabBind = modal.querySelector('#tab-bind');
            const registerForm = modal.querySelector('#register-form');
            const bindForm = modal.querySelector('#bind-form');

            if (tabRegister && tabBind && registerForm && bindForm) {
                tabRegister.addEventListener('click', () => {
                    registerForm.style.display = 'block';
                    bindForm.style.display = 'none';
                    tabRegister.style.background = '#fff';
                    tabRegister.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    tabRegister.style.fontWeight = '600';
                    tabRegister.style.color = '';
                    tabBind.style.background = 'transparent';
                    tabBind.style.boxShadow = 'none';
                    tabBind.style.fontWeight = '500';
                    tabBind.style.color = 'var(--text-secondary)';
                });

                tabBind.addEventListener('click', () => {
                    registerForm.style.display = 'none';
                    bindForm.style.display = 'block';
                    tabBind.style.background = '#fff';
                    tabBind.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    tabBind.style.fontWeight = '600';
                    tabBind.style.color = '';
                    tabRegister.style.background = 'transparent';
                    tabRegister.style.boxShadow = 'none';
                    tabRegister.style.fontWeight = '500';
                    tabRegister.style.color = 'var(--text-secondary)';
                });
            }

            setTimeout(() => document.getElementById('reg-initials')?.focus(), 100);
        });
    },

    /**
     * 显示同步码面板（查看/复制同步码）
     */
    async showAccountPanel() {
        const Utils = window.Utils;
        if (!Utils) return;
        const code = this.getSyncCode();
        let initials = this.getInitials();

        // 实时从云端获取最新用户名
        if (code) {
            try {
                const data = await this.request(`/api/cloud-data/${this.getDeviceId()}`);
                if (data?.ok && data.user?.initials) {
                    initials = data.user.initials;
                    localStorage.setItem(this.KEYS.INITIALS, initials);
                }
            } catch (e) {
                console.warn('[API] 获取云端用户名失败:', e.message);
            }
        }

        const content = code
            ? `
            <div style="text-align: center; margin-bottom: 16px;">
                <p style="color: var(--text-secondary); margin-bottom: 8px;">${Utils.escapeHtml(initials)}，你的同步码：</p>
                <div id="sync-code-display" style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: var(--primary); font-family: monospace; padding: 12px; background: var(--bg-hover); border-radius: var(--radius);">
                    ${code}
                </div>
            </div>
            <div style="border-top: 1px solid var(--border); padding-top: 12px;">
                <label>修改姓名首字母</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="change-initials" value="${Utils.escapeHtml(initials)}" maxlength="4" style="text-transform: uppercase; flex: 1;">
                    <button class="btn btn-secondary btn-sm" onclick="API.changeInitials()">保存</button>
                </div>
            </div>
            <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
                <label>绑定其他同步码（切换账号）</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="rebind-code" placeholder="输入新的6位同步码" maxlength="6" style="text-transform: uppercase; flex: 1;">
                    <button class="btn btn-secondary btn-sm" onclick="API.rebindDevice()">绑定</button>
                </div>
                <p style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">⚠️ 绑定后本设备数据将关联到新同步码</p>
            </div>
        `
            : `
            <div style="text-align: center; padding: 16px 0;">
                <p style="color: var(--text-secondary); margin-bottom: 12px;">你还没有注册</p>
                <button class="btn btn-primary" onclick="API.showRegisterModal(); this.closest('.modal-overlay').remove();">注册 / 绑定</button>
            </div>
        `;

        Utils.showModal({
            title: '⚙️ 账号管理',
            content,
            buttons: [
                ...(code
                    ? [
                          {
                              label: '复制同步码',
                              class: 'btn-primary',
                              onClick: () => {
                                  Utils.copyToClipboard(code);
                              }
                          }
                      ]
                    : []),
                {
                    label: '关闭',
                    class: 'btn-ghost',
                    onClick: (modal) => modal.remove()
                }
            ],
            size: 'sm'
        });
    },

    /**
     * 修改姓名首字母
     */
    async changeInitials() {
        const Utils = window.Utils;
        const input = document.getElementById('change-initials');
        const newInitials = (input?.value || '').trim().toUpperCase();
        if (newInitials.length < 1 || newInitials.length > 4) {
            Utils.showToast('请输入1-4个字符', 'error');
            return;
        }
        // 重新注册（同步码不变，只更新名字）
        const data = await this.request('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: this.getDeviceId(),
                initials: newInitials
            })
        });
        if (data && data.ok) {
            localStorage.setItem(this.KEYS.INITIALS, data.initials);
            Utils.showToast('姓名已更新', 'success');
            // 关闭弹窗重新打开刷新显示
            document.querySelector('.modal-overlay')?.remove();
            setTimeout(() => this.showAccountPanel(), 300);
        } else {
            Utils.showToast('更新失败', 'error');
        }
    },

    /**
     * 重新绑定到其他同步码
     */
    async rebindDevice() {
        const Utils = window.Utils;
        const input = document.getElementById('rebind-code');
        const code = (input?.value || '').trim().toUpperCase();
        if (code.length !== 6) {
            Utils.showToast('请输入6位同步码', 'error');
            return;
        }
        Utils.showToast('绑定中...', 'info');
        const result = await this.bindDevice(code);
        if (result && result.ok) {
            Utils.showToast(`已切换到 ${result.initials}`, 'success');
            document.querySelector('.modal-overlay')?.remove();
            setTimeout(() => {
                location.reload();
            }, 500);
        } else {
            Utils.showToast(result?.error || '绑定失败', 'error');
        }
    }
};

window.API = API;
export default API;
