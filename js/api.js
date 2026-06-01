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
    BASE_URL: 'https://ks-api.mutx.ccwu.cc',

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
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
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
        try {
            const url = this.BASE_URL + path;
            console.log('[API] 请求:', url);
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            console.log('[API] 响应:', res.status, res.ok);
            const data = await res.json();
            if (!res.ok) {
                console.warn('[API] 错误:', data.error || '请求失败');
                return null;
            }
            return data;
        } catch (e) {
            console.warn('[API] 网络错误:', e.message);
            return null;
        }
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
        if (!this.isRegistered()) {
            // 尝试从服务端恢复同步码
            const recovered = await this.checkRegistered();
            if (!recovered) return false;
        }

        // 拉取云端设置和进度
        await this.pullCloudData();
        // 推送本地最新数据到云端
        await this.pushAll();
        return true;
    },

    /**
     * 拉取云端设置和进度，合并到本地
     */
    async pullCloudData() {
        const data = await this.request(`/api/cloud-data/${this.getDeviceId()}`);
        if (!data || !data.ok) return;

        const Storage = StorageMod;
        if (!Storage) return;

        // 同步用户名（云端为准）
        if (data.user?.initials) {
            const localInitials = localStorage.getItem(this.KEYS.INITIALS);
            if (localInitials !== data.user.initials) {
                localStorage.setItem(this.KEYS.INITIALS, data.user.initials);
                console.log('[Sync] 用户名已同步:', data.user.initials);
            }
        }

        // 合并设置（云端优先，但保留本地特有的字段）
        if (data.settings && Object.keys(data.settings).length > 0) {
            const localSettings = Storage.getSettings();
            const merged = { ...localSettings, ...data.settings };
            Storage.updateSettings(merged);
        }

        // 合并进度（取各 bankId 的最大值）
        if (data.progress && Object.keys(data.progress).length > 0) {
            this._mergeProgress(data.progress);
        }

        localStorage.setItem(this.KEYS.LAST_PULL, Date.now().toString());
    },

    /**
     * 推送所有本地数据到云端
     */
    async pushAll() {
        const Storage = StorageMod;
        if (!Storage) return;

        // 推送设置
        this.pushSettings(Storage.getSettings());

        // 推送进度
        this.pushProgress(Storage.getProgress());
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
        });
    },

    /**
     * 推送进度到云端（防抖 5 秒）
     */
    pushProgress(progress) {
        if (!this.isRegistered() || !progress) return;
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => {
            this.request('/api/progress', {
                method: 'POST',
                body: JSON.stringify({
                    deviceId: this.getDeviceId(),
                    progress
                })
            });
        }, 5000);
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
        }).catch(e => {
            console.warn('[API] pushStats 失败:', e.message);
            return null;
        });
    },

    // ==================== 排行榜 ====================

    async getLeaderboard(sort = 'answered', limit = 50) {
        return await this.request(
            `/api/leaderboard?sort=${sort}&limit=${limit}&deviceId=${this.getDeviceId()}`
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
                // 取各字段较大值
                if ((cloud.answered || 0) > (l.answered || 0)) {
                    local[bankId] = { ...l, ...cloud };
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
            if (!Utils) { resolve(false); return; }

            Utils.showModal({
                title: '🏆 加入排行榜',
                closable: false,
                content: `
                    <div style="margin-bottom: 16px;">
                        <p style="color: var(--text-secondary); margin-bottom: 12px;">
                            输入姓名首字母注册，支持多设备同步！
                        </p>
                        <input type="text" id="reg-initials"
                            placeholder="如: ZS（张三）"
                            maxlength="4"
                            style="text-transform: uppercase; text-align: center; font-size: 18px; letter-spacing: 4px; width: 100%;"
                            autocomplete="off">
                    </div>
                    <div style="border-top: 1px solid var(--border); padding-top: 12px;">
                        <p style="color: var(--text-tertiary); font-size: 12px; margin-bottom: 8px;">
                            已有同步码？在其他设备绑定：
                        </p>
                        <input type="text" id="reg-sync-code"
                            placeholder="输入6位同步码"
                            maxlength="6"
                            style="text-transform: uppercase; text-align: center; font-size: 16px; letter-spacing: 3px; width: 100%;"
                            autocomplete="off">
                    </div>
                `,
                buttons: [
                    {
                        label: '注册新账号',
                        class: 'btn-primary',
                        onClick: (modal) => {
                            const input = modal.querySelector('#reg-initials');
                            const initials = (input?.value || '').trim().toUpperCase();
                            if (initials.length < 1 || initials.length > 4) {
                                Utils.showToast('请输入1-4个字符', 'error');
                                return;
                            }
                            Utils.showToast('注册中...', 'info');
                            API.register(initials).then(result => {
                                if (result && result.ok) {
                                    Utils.showToast(`注册成功！同步码: ${result.syncCode}`, 'success', 5000);
                                    modal.remove();
                                    resolve(true);
                                } else {
                                    Utils.showToast('注册失败，请重试', 'error');
                                }
                            }).catch(e => {
                                console.error('[Register]', e);
                                Utils.showToast('网络错误，请重试', 'error');
                            });
                        }
                    },
                    {
                        label: '绑定同步码',
                        class: 'btn-secondary',
                        onClick: (modal) => {
                            const input = modal.querySelector('#reg-sync-code');
                            const code = (input?.value || '').trim().toUpperCase();
                            if (code.length !== 6) {
                                Utils.showToast('请输入6位同步码', 'error');
                                return;
                            }
                            Utils.showToast('绑定中...', 'info');
                            API.bindDevice(code).then(result => {
                                if (result && result.ok) {
                                    Utils.showToast(`绑定成功！欢迎 ${result.initials}`, 'success');
                                    modal.remove();
                                    resolve(true);
                                } else {
                                    Utils.showToast(result?.error || '绑定失败', 'error');
                                }
                            }).catch(e => {
                                console.error('[Bind]', e);
                                Utils.showToast('网络错误，请重试', 'error');
                            });
                        }
                    },
                    // 无跳过按钮，必须注册或绑定
                ],
                size: 'sm'
            });

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
            } catch {}
        }

        const content = code ? `
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
        ` : `
            <div style="text-align: center; padding: 16px 0;">
                <p style="color: var(--text-secondary); margin-bottom: 12px;">你还没有注册</p>
                <button class="btn btn-primary" onclick="API.showRegisterModal(); this.closest('.modal-overlay').remove();">注册 / 绑定</button>
            </div>
        `;

        Utils.showModal({
            title: '⚙️ 账号管理',
            content,
            buttons: [
                ...(code ? [{
                    label: '复制同步码',
                    class: 'btn-primary',
                    onClick: () => {
                        navigator.clipboard?.writeText(code);
                        Utils.showToast('已复制', 'success');
                    }
                }] : []),
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
        } else {
            Utils.showToast(result?.error || '绑定失败', 'error');
        }
    }
};

window.API = API;
export default API;
