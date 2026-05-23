/**
 * 统一题库加载服务
 * 解决 app.js、quiz.js、insights.js 各自独立实现题库加载的问题
 */

import Storage from './storage.js';
import { builtinBanks } from './config.js';

const CACHE_KEY = 'quiz_cache_versions';

const BankLoader = {
    /**
     * 获取缓存的版本信息
     */
    _getCacheVersions() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {
            return {};
        }
    },

    /**
     * 保存版本缓存
     */
    _saveCacheVersions(versions) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(versions));
    },

    /**
     * 清除指定题库的版本缓存
     */
    clearCache(bankId) {
        const versions = this._getCacheVersions();
        delete versions[bankId];
        this._saveCacheVersions(versions);
    },

    /**
     * 清除所有版本缓存
     */
    clearAllCache() {
        localStorage.removeItem(CACHE_KEY);
    },

    /**
     * 加载单个题库（带版本缓存）
     * @param {string} filename - 题库文件名，如 'c-language.json'
     * @returns {Promise<object|null>} - 返回题库数据或 null
     */
    async loadBank(filename) {
        const cacheVersions = this._getCacheVersions();

        try {
            const bankId = filename.replace('.json', '');
            const existing = Storage.getBank(bankId);

            // 如果已有完整数据且版本匹配，直接返回缓存
            if (existing && existing.questions && cacheVersions[bankId] === existing.version) {
                return existing;
            }

            const response = await fetch(`banks/${filename}`);
            if (!response.ok) {
                console.error(`Failed to load ${filename}: HTTP ${response.status}`);
                return null;
            }

            const bank = await response.json();

            // 检查是否需要更新：无此题库、版本不同、或内存中没有完整题目
            const localBank = Storage.getBank(bank.id);
            const needsUpdate = !localBank || localBank.version !== bank.version || !localBank.questions;

            if (needsUpdate) {
                Storage.addBank(bank);
                cacheVersions[bank.id] = bank.version;
                this._saveCacheVersions(cacheVersions);
            }

            return bank;
        } catch (e) {
            console.error(`Failed to load ${filename}:`, e);
            return null;
        }
    },

    /**
     * 加载所有内置题库（带版本缓存）
     * @returns {Promise<object[]>} - 返回成功加载的题库数组
     */
    async loadAllBuiltinBanks() {
        const results = [];
        const cacheVersions = this._getCacheVersions();

        for (const filename of builtinBanks) {
            try {
                const bankId = filename.replace('.json', '');
                const existing = Storage.getBank(bankId);

                // 如果已有完整数据且版本匹配，跳过 fetch
                if (existing && existing.questions && cacheVersions[bankId] === existing.version) {
                    results.push(existing);
                    continue;
                }

                const response = await fetch(`banks/${filename}`);
                if (!response.ok) {
                    console.error(`Failed to load ${filename}: HTTP ${response.status}`);
                    continue;
                }

                const bank = await response.json();
                const localBank = Storage.getBank(bank.id);
                const needsUpdate = !localBank || localBank.version !== bank.version || !localBank.questions;

                if (needsUpdate) {
                    Storage.addBank(bank);
                    cacheVersions[bank.id] = bank.version;
                }

                results.push(bank);
            } catch (e) {
                console.error(`Failed to load ${filename}:`, e);
            }
        }

        this._saveCacheVersions(cacheVersions);
        return results;
    },

    /**
     * 按 ID 加载指定题库
     * @param {string} bankId - 题库 ID
     * @returns {Promise<object|null>} - 返回题库数据或 null
     */
    async loadBankById(bankId) {
        // 先检查内存缓存
        const existing = Storage.getBank(bankId);
        if (existing && existing.questions) {
            return existing;
        }

        // 在内置题库中查找对应文件
        const filename = builtinBanks.find(f => f.replace('.json', '') === bankId);
        if (filename) {
            return await this.loadBank(filename);
        }

        console.error(`Bank not found: ${bankId}`);
        return null;
    },

    /**
     * 移除废弃题库并清理相关数据
     * @param {Set<string>} deprecatedIds - 废弃题库 ID 集合
     */
    removeDeprecatedBanks(deprecatedIds) {
        // 清除 Storage 中的题库数据
        Storage.getBanks().forEach(bank => {
            if (deprecatedIds.has(bank.id) || deprecatedIds.has(bank.name)) {
                deprecatedIds.add(bank.id);
            }
        });

        deprecatedIds.forEach(bankId => Storage.removeBank(bankId));

        // 清除历史记录
        const history = Storage.getHistory().filter(record =>
            !deprecatedIds.has(record.bankId) && !deprecatedIds.has(record.bankName)
        );
        Storage.set(Storage.KEYS.HISTORY, history);

        // 清除会话状态
        const sessions = Storage.get(Storage.KEYS.SESSION) || {};
        for (const key of Object.keys(sessions)) {
            const [bankId] = key.split(':');
            if (deprecatedIds.has(bankId)) {
                delete sessions[key];
            }
        }
        Storage.set(Storage.KEYS.SESSION, sessions);

        // 清除版本缓存
        const cacheVersions = this._getCacheVersions();
        deprecatedIds.forEach(bankId => {
            delete cacheVersions[bankId];
        });
        this._saveCacheVersions(cacheVersions);
    }
};

export default BankLoader;
