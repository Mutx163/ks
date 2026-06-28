/**
 * 云同步失败队列（localStorage 持久化）
 * stats 按题库累加增量；progress/settings/bookmarks 只保留最新快照
 */

const STORAGE_KEY = 'ks_sync_queue';

const SyncQueue = {
    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { stats: [], progress: null, settings: null, bookmarks: null };
            const data = JSON.parse(raw);
            return {
                stats: Array.isArray(data.stats) ? data.stats : [],
                progress: data.progress || null,
                settings: data.settings || null,
                bookmarks: data.bookmarks || null
            };
        } catch {
            return { stats: [], progress: null, settings: null, bookmarks: null };
        }
    },

    _save(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('[SyncQueue] 保存队列失败:', e.message);
        }
    },

    isEmpty() {
        const s = this._load();
        return (
            s.stats.length === 0 && !s.progress && !s.settings && !s.bookmarks
        );
    },

    pendingCount() {
        const s = this._load();
        let n = s.stats.length;
        if (s.progress) n++;
        if (s.settings) n++;
        if (s.bookmarks) n++;
        return n;
    },

    enqueueStats(payload) {
        if (!payload?.bankId) return;
        const state = this._load();
        const existing = state.stats.find((s) => s.bankId === payload.bankId);
        if (existing) {
            existing.answered = (existing.answered || 0) + (payload.answered || 0);
            existing.correct = (existing.correct || 0) + (payload.correct || 0);
            existing.duration = (existing.duration || 0) + (payload.duration || 0);
            existing.bankName = payload.bankName || existing.bankName;
        } else {
            state.stats.push({
                bankId: payload.bankId,
                bankName: payload.bankName || '',
                answered: payload.answered || 0,
                correct: payload.correct || 0,
                duration: payload.duration || 0
            });
        }
        this._save(state);
        console.log('[SyncQueue] stats 已入队, 待同步:', this.pendingCount());
    },

    enqueueSnapshot(type, payload) {
        if (!payload || (type !== 'progress' && type !== 'settings' && type !== 'bookmarks')) {
            return;
        }
        const state = this._load();
        state[type] = payload;
        this._save(state);
        console.log(`[SyncQueue] ${type} 已入队, 待同步:`, this.pendingCount());
    },

    /**
     * @param {Function} send - async (type, payload) => 'ok' | 'fail' | 'disabled'
     */
    async flush(send) {
        const state = this._load();
        if (
            state.stats.length === 0 &&
            !state.progress &&
            !state.settings &&
            !state.bookmarks
        ) {
            return { flushed: 0, failed: 0 };
        }

        let flushed = 0;
        let failed = 0;
        let disabled = false;

        const remaining = { stats: [], progress: null, settings: null, bookmarks: null };

        for (const stat of state.stats) {
            if (disabled) {
                remaining.stats.push(stat);
                failed++;
                continue;
            }
            const result = await send('stats', stat);
            if (result === 'ok') flushed++;
            else if (result === 'disabled') {
                disabled = true;
                remaining.stats.push(stat);
                failed++;
            } else {
                remaining.stats.push(stat);
                failed++;
            }
        }

        for (const type of ['progress', 'settings', 'bookmarks']) {
            const payload = state[type];
            if (!payload) continue;
            if (disabled) {
                remaining[type] = payload;
                failed++;
                continue;
            }
            const result = await send(type, payload);
            if (result === 'ok') flushed++;
            else if (result === 'disabled') {
                disabled = true;
                remaining[type] = payload;
                failed++;
            } else {
                remaining[type] = payload;
                failed++;
            }
        }

        this._save(remaining);

        if (flushed > 0) {
            console.log(`[SyncQueue] 已重试成功 ${flushed} 项, 剩余 ${this.pendingCount()} 项`);
        }

        return { flushed, failed, disabled };
    }
};

export default SyncQueue;
