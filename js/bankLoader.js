/**
 * 统一题库加载服务
 * 从云端 API 加载题库，支持本地缓存
 */

import Storage from './storage.js';
import API from './api.js';

const CACHE_KEY = 'quiz_cache_versions';

const BankLoader = {
    _getCacheVersions() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {
            return {};
        }
    },

    _saveCacheVersions(versions) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(versions));
    },

    /**
     * 从云端获取题库列表（不含题目详情）
     */
    async loadBankList() {
        try {
            console.log('[BankLoader] 获取题库列表...');
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const data = await API.request('/api/banks', { signal: controller.signal });
            clearTimeout(timer);
            console.log('[BankLoader] 题库列表响应:', data);
            if (data?.ok && data.banks) return data.banks;
        } catch (e) {
            console.warn('[BankLoader] 获取题库列表失败:', e.message);
        }
        return [];
    },

    /**
     * 从云端加载单个题库完整数据（带版本缓存）
     */
    async loadBank(bankId) {
        const cacheVersions = this._getCacheVersions();

        try {
            const existing = Storage.getBank(bankId);
            if (existing && existing.questions && cacheVersions[bankId] === existing.version) {
                console.log('[BankLoader] 使用缓存:', bankId);
                return existing;
            }

            console.log('[BankLoader] 从API加载:', bankId);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const data = await API.request(`/api/bank/${bankId}`, { signal: controller.signal });
            clearTimeout(timer);

            if (!data?.ok || !data.bank) {
                console.error('[BankLoader] API返回失败:', bankId, data);
                // 尝试使用本地缓存
                if (existing && existing.questions) {
                    console.warn('[BankLoader] API失败，使用本地缓存:', bankId);
                    return existing;
                }
                return null;
            }

            const bank = data.bank;
            const localBank = Storage.getBank(bank.id);
            const needsUpdate = !localBank || localBank.version !== bank.version || !localBank.questions;

            if (needsUpdate) {
                Storage.addBank(bank);
                cacheVersions[bank.id] = bank.version;
                this._saveCacheVersions(cacheVersions);
            }

            console.log('[BankLoader] 加载成功:', bankId, bank.questions?.length, '题');
            return bank;
        } catch (e) {
            console.error('[BankLoader] 加载异常:', bankId, e.message);
            // 尝试使用本地缓存
            const existing = Storage.getBank(bankId);
            if (existing && existing.questions) {
                console.warn('[BankLoader] 异常，使用本地缓存:', bankId);
                return existing;
            }
            return null;
        }
    },

    /**
     * 加载所有题库
     */
    async loadAllBuiltinBanks() {
        const list = await this.loadBankList();
        if (!list.length) {
            console.warn('[BankLoader] 无可用题库');
            return [];
        }
        const results = await Promise.all(list.map(b => this.loadBank(b.id)));
        return results.filter(Boolean);
    },

    /**
     * 按 ID 加载指定题库
     */
    async loadBankById(bankId) {
        const existing = Storage.getBank(bankId);
        if (existing && existing.questions) {
            return existing;
        }
        return await this.loadBank(bankId);
    },

    /**
     * 移除废弃题库并清理相关数据
     */
    removeDeprecatedBanks(deprecatedIds) {
        Storage.getBanks().forEach((bank) => {
            if (deprecatedIds.has(bank.id) || deprecatedIds.has(bank.name)) {
                deprecatedIds.add(bank.id);
            }
        });

        deprecatedIds.forEach((bankId) => Storage.removeBank(bankId));

        const history = Storage.getHistory().filter(
            (record) => !deprecatedIds.has(record.bankId) && !deprecatedIds.has(record.bankName)
        );
        Storage.set(Storage.KEYS.HISTORY, history);

        const sessions = Storage.get(Storage.KEYS.SESSION) || {};
        for (const key of Object.keys(sessions)) {
            const [bankId] = key.split(':');
            if (deprecatedIds.has(bankId)) {
                delete sessions[key];
            }
        }
        Storage.set(Storage.KEYS.SESSION, sessions);

        const cacheVersions = this._getCacheVersions();
        deprecatedIds.forEach((bankId) => {
            delete cacheVersions[bankId];
        });
        this._saveCacheVersions(cacheVersions);
    }
};

export default BankLoader;
