/**
 * 首屏聚合数据（/api/bootstrap）
 *
 * 一次请求拿到「题库元数据 + 赛季列表」，省掉首屏第二次跨云建连。
 * 字段与 /api/banks、/api/seasons 完全一致（后端保证逐字段相同）。
 *
 * 只存在内存里：题库/赛季都可能随时更新，绝不写 localStorage。
 * 聚合端点不可用时返回 null，调用方各自退回老接口（/api/banks、/api/seasons），
 * 两个老接口保留不动，老客户端不受影响。
 */

import API from './api.js';

const Bootstrap = {
    _promise: null,
    _banks: null,
    _seasons: null,
    // 端点不存在（老 Worker 还没部署 /api/bootstrap）时不再反复打它
    _unsupported: false,

    /**
     * 拉取聚合数据（同一页面生命周期内只发一次请求）。
     * @returns {Promise<{banks: Array, seasons: Array}|null>}
     */
    async load() {
        if (this._unsupported) return null;
        if (this._promise) return this._promise;

        this._promise = (async () => {
            // 用带 status 的请求：404 是确定结果，不能像网络错误那样重试 3 次
            const res = await API.requestWithMetaRetry(
                '/api/bootstrap',
                { cacheBust: false },
                2,
                1000
            );

            if (res.status === 404) {
                this._unsupported = true;
                console.warn('[Bootstrap] 服务端没有 /api/bootstrap，回退到 /api/banks');
                return null;
            }

            const data = res.data;
            if (!res.ok || !data?.ok || !Array.isArray(data.banks)) {
                // 失败不缓存，后面还有机会重试
                this._promise = null;
                console.warn('[Bootstrap] 聚合端点不可用，回退到 /api/banks 与 /api/seasons');
                return null;
            }

            this._banks = data.banks;
            this._seasons = Array.isArray(data.seasons) ? data.seasons : [];
            return { banks: this._banks, seasons: this._seasons };
        })();

        return this._promise;
    },

    /** 已就绪的题库元数据；未拉取过返回 null */
    peekBanks() {
        return this._banks;
    },

    /** 已就绪的赛季列表；未拉取过返回 null（空数组是有效结果） */
    peekSeasons() {
        return this._seasons;
    }
};

export default Bootstrap;
