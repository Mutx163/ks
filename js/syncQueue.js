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
        return s.stats.length === 0 && !s.progress && !s.settings && !s.bookmarks;
    },

    /** 清空队列（切换账号时使用，避免旧账号增量被推给新账号） */
    clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('[SyncQueue] 清空队列失败:', e.message);
        }
    },

    pendingCount() {
        const s = this._load();
        let n = s.stats.length;
        if (s.progress) n++;
        if (s.settings) n++;
        if (s.bookmarks) n++;
        return n;
    },

    /**
     * 归一单条 stats 增量：后端要求 correct ≤ answered，
     * 非法增量会导致 400 并在队列里永久残留，所以入队与发送前都夹一遍。
     * 已知限制（本批不修）：HEAD 版 Worker 对单次增量用
     * Math.min(...,500) / Math.min(...,36000) 静默截断（worker/src/index.js:753-761），
     * 超出的积压部分会被服务端丢弃且客户端拿到 200 后不重试，也就是永久不入账。
     * 不做分片是有意的：队列没有幂等键，分片会出现「部分成功」，
     * 重发时重复计数；精确记账留给 F-2 的 roundId 幂等改造。
     * @returns {object|null} 归一后的条目；全零则返回 null（没有可发的量）
     */
    _normalizeStats(stat) {
        if (!stat || !stat.bankId) return null;
        const toDelta = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n) || n <= 0) return 0;
            return Math.trunc(n);
        };
        const answered = toDelta(stat.answered);
        const correct = Math.min(toDelta(stat.correct), answered);
        const duration = toDelta(stat.duration);
        if (answered === 0 && correct === 0 && duration === 0) return null;
        return { ...stat, answered, correct, duration };
    },

    enqueueStats(payload) {
        const normalized = this._normalizeStats(payload);
        if (!normalized) return;
        const state = this._load();
        const existing = state.stats.find((s) => s.bankId === normalized.bankId);
        if (existing) {
            existing.answered = (existing.answered || 0) + normalized.answered;
            existing.correct = (existing.correct || 0) + normalized.correct;
            existing.duration = (existing.duration || 0) + normalized.duration;
            // 累加后仍要保证 correct ≤ answered，别把两条合法的拼成一条非法的
            existing.correct = Math.min(existing.correct, existing.answered);
            existing.bankName = normalized.bankName || existing.bankName;
        } else {
            state.stats.push({
                bankId: normalized.bankId,
                bankName: normalized.bankName || '',
                answered: normalized.answered,
                correct: normalized.correct,
                duration: normalized.duration
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
        if (state.stats.length === 0 && !state.progress && !state.settings && !state.bookmarks) {
            return { flushed: 0, failed: 0 };
        }

        let flushed = 0;
        let failed = 0;
        let disabled = false;

        const remaining = { stats: [], progress: null, settings: null, bookmarks: null };

        for (const stat of state.stats) {
            // 发送前再归一：旧版本残留的非法条目（负数 / correct>answered）在这一步被修正，
            // 全零条目直接丢弃，避免永久残留。
            // 注意：这里整条发送、不分片 —— HEAD 版 Worker 对超限只静默截断（返 200），
            // 分片会在没有幂等键的情况下引入「部分成功→重发重复计数」，留待 F-2。
            const payload = this._normalizeStats(stat);
            if (!payload) continue;
            if (disabled) {
                remaining.stats.push(payload);
                failed++;
                continue;
            }
            const result = await send('stats', payload);
            if (result === 'ok') flushed++;
            else if (result === 'disabled') {
                disabled = true;
                remaining.stats.push(payload);
                failed++;
            } else {
                remaining.stats.push(payload);
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
