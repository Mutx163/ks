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
            const versions = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            console.log('[BankLoader] 📦 缓存版本号:', versions);
            return versions;
        } catch {
            console.warn('[BankLoader] ⚠️ 缓存版本号解析失败，返回空对象');
            return {};
        }
    },

    _saveCacheVersions(versions) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(versions));
        console.log('[BankLoader] 💾 已保存缓存版本号:', versions);
    },

    /**
     * 从云端获取题库列表（不含题目详情）
     * 只返回已启用的题库
     */
    async loadBankList() {
        console.log('[BankLoader] ========== 获取题库列表 ==========');
        try {
            const startTime = Date.now();
            console.log('[BankLoader] 📡 请求 /api/banks ...');
            
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const data = await API.request('/api/banks', { signal: controller.signal });
            clearTimeout(timer);
            
            const elapsed = Date.now() - startTime;
            console.log(`[BankLoader] ✅ 题库列表响应 (${elapsed}ms):`, data);
            
            if (data?.ok && data.banks) {
                const allBanks = data.banks;
                const enabledBanks = allBanks.filter(b => b.enabled !== false);
                const disabledCount = allBanks.length - enabledBanks.length;
                
                console.log(`[BankLoader] 📚 题库统计: 总计 ${allBanks.length} 个, 启用 ${enabledBanks.length} 个, 禁用 ${disabledCount} 个`);
                
                if (disabledCount > 0) {
                    const disabledNames = allBanks.filter(b => b.enabled === false).map(b => b.name || b.id);
                    console.log('[BankLoader] 🚫 已禁用的题库:', disabledNames);
                }
                
                console.log('[BankLoader] ✅ 返回启用的题库列表:', enabledBanks.map(b => b.id));
                return enabledBanks;
            } else {
                console.warn('[BankLoader] ⚠️ API 返回异常:', data);
            }
        } catch (e) {
            console.error('[BankLoader] ❌ 获取题库列表失败:', e.message);
            if (e.name === 'AbortError') {
                console.error('[BankLoader] ⏱️ 请求超时 (15秒)');
            }
        }
        console.log('[BankLoader] ========== 题库列表加载结束 ==========');
        return [];
    },

    /**
     * 从云端加载单个题库完整数据（带版本缓存）
     */
    async loadBank(bankId) {
        console.log(`[BankLoader] ========== 加载题库: ${bankId} ==========`);
        const cacheVersions = this._getCacheVersions();
        const startTime = Date.now();

        try {
            // 检查本地缓存
            const existing = Storage.getBank(bankId);
            const cachedVersion = cacheVersions[bankId];
            
            console.log(`[BankLoader] 📦 本地缓存状态:`, {
                bankId,
                hasLocalData: !!existing,
                hasQuestions: existing?.questions?.length > 0,
                localVersion: existing?.version,
                cachedVersion: cachedVersion,
                versionMatch: cachedVersion === existing?.version
            });

            // 如果本地有完整数据且版本匹配，直接使用缓存
            if (existing && existing.questions && cachedVersion === existing.version) {
                const elapsed = Date.now() - startTime;
                console.log(`[BankLoader] ⚡ 使用本地缓存 (${elapsed}ms):`, bankId, `(${existing.questions.length} 题)`);
                return existing;
            }

            // 从 API 加载
            console.log(`[BankLoader] 📡 从 API 加载题库: ${bankId} ...`);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const data = await API.request(`/api/bank/${bankId}`, { signal: controller.signal });
            clearTimeout(timer);

            const elapsed = Date.now() - startTime;

            if (!data?.ok || !data.bank) {
                console.error(`[BankLoader] ❌ API 返回失败 (${elapsed}ms):`, bankId, data);
                // 尝试使用本地缓存
                if (existing && existing.questions) {
                    console.warn(`[BankLoader] ⚠️ API 失败，降级使用本地缓存:`, bankId, `(${existing.questions.length} 题)`);
                    return existing;
                }
                console.log(`[BankLoader] ========== 题库加载失败: ${bankId} ==========`);
                return null;
            }

            const bank = data.bank;
            console.log(`[BankLoader] ✅ API 返回题库数据 (${elapsed}ms):`, {
                id: bank.id,
                name: bank.name,
                version: bank.version,
                questionCount: bank.questions?.length,
                enabled: bank.enabled
            });

            // 检查是否需要更新本地缓存
            const localBank = Storage.getBank(bank.id);
            const needsUpdate = !localBank || localBank.version !== bank.version || !localBank.questions;

            console.log(`[BankLoader] 🔄 缓存更新检查:`, {
                hasLocal: !!localBank,
                localVersion: localBank?.version,
                remoteVersion: bank.version,
                needsUpdate: needsUpdate
            });

            if (needsUpdate) {
                console.log(`[BankLoader] 💾 更新本地缓存:`, bank.id);
                Storage.addBank(bank);
                cacheVersions[bank.id] = bank.version;
                this._saveCacheVersions(cacheVersions);
                console.log(`[BankLoader] ✅ 缓存已更新`);
            } else {
                console.log(`[BankLoader] ⏭️ 缓存无需更新`);
            }

            console.log(`[BankLoader] ✅ 题库加载成功:`, bankId, `(${bank.questions?.length || 0} 题)`);
            console.log(`[BankLoader] ========== 题库加载完成: ${bankId} ==========`);
            return bank;
        } catch (e) {
            const elapsed = Date.now() - startTime;
            console.error(`[BankLoader] ❌ 加载异常 (${elapsed}ms):`, bankId, e.message);
            if (e.name === 'AbortError') {
                console.error(`[BankLoader] ⏱️ 请求超时 (15秒)`);
            }
            // 尝试使用本地缓存
            const existing = Storage.getBank(bankId);
            if (existing && existing.questions) {
                console.warn(`[BankLoader] ⚠️ 异常，降级使用本地缓存:`, bankId, `(${existing.questions.length} 题)`);
                return existing;
            }
            console.log(`[BankLoader] ========== 题库加载失败: ${bankId} ==========`);
            return null;
        }
    },

    /**
     * 加载所有题库
     */
    async loadAllBuiltinBanks() {
        console.log('[BankLoader] ========== 开始加载所有题库 ==========');
        const startTime = Date.now();
        
        const list = await this.loadBankList();
        if (!list.length) {
            console.warn('[BankLoader] ⚠️ 无可用题库');
            console.log('[BankLoader] ========== 所有题库加载结束 ==========');
            return [];
        }

        console.log(`[BankLoader] 📚 开始加载 ${list.length} 个题库...`);
        const results = await Promise.all(list.map(b => this.loadBank(b.id)));
        const successCount = results.filter(Boolean).length;
        const failCount = results.length - successCount;
        
        const elapsed = Date.now() - startTime;
        console.log(`[BankLoader] ========== 所有题库加载完成 (${elapsed}ms) ==========`);
        console.log(`[BankLoader] 📊 加载统计: 成功 ${successCount} 个, 失败 ${failCount} 个`);
        
        return results.filter(Boolean);
    },

    /**
     * 按 ID 加载指定题库
     */
    async loadBankById(bankId) {
        console.log(`[BankLoader] 📡 按 ID 加载题库: ${bankId}`);
        const existing = Storage.getBank(bankId);
        if (existing && existing.questions) {
            console.log(`[BankLoader] ⚡ 从本地缓存加载:`, bankId, `(${existing.questions.length} 题)`);
            return existing;
        }
        console.log(`[BankLoader] 📡 本地无缓存，从 API 加载:`, bankId);
        return await this.loadBank(bankId);
    },

    /**
     * 移除废弃题库并清理相关数据
     */
    removeDeprecatedBanks(deprecatedIds) {
        console.log('[BankLoader] ========== 移除废弃题库 ==========');
        console.log('[BankLoader] 🗑️ 待移除的题库 ID:', Array.from(deprecatedIds));

        Storage.getBanks().forEach((bank) => {
            if (deprecatedIds.has(bank.id) || deprecatedIds.has(bank.name)) {
                deprecatedIds.add(bank.id);
                console.log('[BankLoader] 🗑️ 标记移除:', bank.id, bank.name);
            }
        });

        deprecatedIds.forEach((bankId) => {
            console.log('[BankLoader] 🗑️ 移除题库:', bankId);
            Storage.removeBank(bankId);
        });

        const history = Storage.getHistory().filter(
            (record) => !deprecatedIds.has(record.bankId) && !deprecatedIds.has(record.bankName)
        );
        Storage.set(Storage.KEYS.HISTORY, history);
        console.log('[BankLoader] 🗑️ 已清理答题历史');

        const sessions = Storage.get(Storage.KEYS.SESSION) || {};
        let cleanedSessions = 0;
        for (const key of Object.keys(sessions)) {
            const [bankId] = key.split(':');
            if (deprecatedIds.has(bankId)) {
                delete sessions[key];
                cleanedSessions++;
            }
        }
        Storage.set(Storage.KEYS.SESSION, sessions);
        console.log(`[BankLoader] 🗑️ 已清理 ${cleanedSessions} 个会话`);

        const cacheVersions = this._getCacheVersions();
        deprecatedIds.forEach((bankId) => {
            delete cacheVersions[bankId];
        });
        this._saveCacheVersions(cacheVersions);
        console.log('[BankLoader] ========== 废弃题库移除完成 ==========');
    }
};

export default BankLoader;
