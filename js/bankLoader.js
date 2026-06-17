/**
 * 统一题库加载服务
 * 生产环境题库只从 Cloudflare Worker API 加载。
 * banks/*.json 仅作为人工备份文件，不参与前端运行时加载，也不作为兜底来源。
 */

import API from './api.js';
import Storage from './storage.js';

const BankLoader = {
    /**
     * 从云端获取题库列表（不含题目详情）
     * 只返回已启用的题库
     */
    async loadBankList() {
        try {
            // 使用 cacheBust: false 开启 ETag 条件请求
            const data = await API.requestWithRetry('/api/banks', { cacheBust: false }, 2, 1000);

            if (data?.ok && data.banks) {
                const allBanks = data.banks;
                const enabledBanks = allBanks.filter((b) => b.enabled !== false);
                // 缓存最新启用的题库列表
                Storage.set(Storage.KEYS.CACHED_BANK_LIST, enabledBanks);
                return enabledBanks;
            }

            console.warn('[BankLoader] API 返回异常:', data);
        } catch (e) {
            console.error('[BankLoader] 获取题库列表失败:', e.message);
        }

        // 离线/故障降级：读取本地缓存列表
        console.log('[BankLoader] 尝试从本地缓存恢复题库列表...');
        const cached = Storage.get(Storage.KEYS.CACHED_BANK_LIST);
        if (Array.isArray(cached) && cached.length > 0) {
            console.log(`[BankLoader] ✅ 已从本地缓存恢复 ${cached.length} 个题库列表`);
            return cached;
        }
        return [];
    },

    /**
     * 从云端加载单个题库完整数据。
     * 支持 LocalStorage 缓存与 ETag 校验，API 失败时支持离线降级。
     */
    async loadBank(bankId, expectedVersion = null) {
        const startTime = Date.now();
        
        // 1. 尝试从 Storage 读取本地缓存
        const localBank = Storage.getBank(bankId);
        if (
            localBank &&
            expectedVersion !== null &&
            localBank.version === expectedVersion &&
            Array.isArray(localBank.questions) &&
            localBank.questions.length > 0
        ) {
            const elapsed = Date.now() - startTime;
            console.log(
                `[BankLoader] 题库 ${bankId} 本地版本匹配 (${localBank.version})，直接使用缓存 (${elapsed}ms)`
            );
            return localBank;
        }

        try {
            // 2. 发起 ETag 条件请求（cacheBust: false 允许条件请求和浏览器 304）
            const data = await API.requestWithRetry(`/api/bank/${bankId}`, { cacheBust: false }, 2, 1000);

            const elapsed = Date.now() - startTime;

            if (!data?.ok || !data.bank) {
                if (data?.disabled) {
                    console.warn('[BankLoader] 题库已被管理员禁用:', bankId);
                    return null;
                }
                console.error(`[BankLoader] API 返回失败 (${elapsed}ms):`, bankId, data);
                // 接口失败降级
                if (localBank) {
                    console.warn(`[BankLoader] 接口返回失败，降级使用本地缓存: ${bankId}`);
                    return localBank;
                }
                return null;
            }

            const bank = this.normalizeBank(data.bank, bankId);
            Storage.setBank(bank);
            return bank;
        } catch (e) {
            const elapsed = Date.now() - startTime;
            console.error(`[BankLoader] 加载异常 (${elapsed}ms):`, bankId, e.message);
            // 异常/离线降级
            if (localBank) {
                console.warn(`[BankLoader] 加载异常，离线降级返回本地缓存: ${bankId}`);
                return localBank;
            }
            return null;
        }
    },

    /**
     * 加载所有题库：优先使用云端，并传入版本号进行本地缓存版本校验。
     */
    async loadAllBanks() {
        const startTime = Date.now();

        const list = await this.loadBankList();

        if (!list.length) {
            console.warn('[BankLoader] 无可用题库列表，尝试直接从本地缓存加载题库数据...');
            const localBanks = Storage.getBanks();
            if (localBanks.length > 0) {
                console.log(`[BankLoader] ✅ 成功从本地缓存恢复 ${localBanks.length} 个题库数据`);
                return localBanks;
            }
            return [];
        }

        // 传入 b.version 优化本地缓存匹配，跳过不必要的网络传输
        const results = await Promise.all(list.map((b) => this.loadBank(b.id, b.version)));
        const banks = results.filter(Boolean);

        const elapsed = Date.now() - startTime;
        console.log(
            `[BankLoader] 题库加载完成 (${elapsed}ms): ${banks.length}/${results.length} 成功`
        );

        return banks;
    },

    /**
     * 兼容旧命名。
     */
    async loadAllBuiltinBanks() {
        return await this.loadAllBanks();
    },

    /**
     * 按 ID 加载指定题库。
     */
    async loadBankById(bankId) {
        return await this.loadBank(bankId);
    },

    normalizeBank(bank, fallbackId) {
        const normalized = { ...bank };
        normalized.id = normalized.id || fallbackId;
        normalized.name = normalized.name || normalized.title || normalized.id || '未命名题库';
        normalized.questions = Array.isArray(normalized.questions) ? normalized.questions : [];
        normalized.questionCount = normalized.questions.length;
        if (normalized.enabled === undefined) normalized.enabled = true;
        return normalized;
    }
};

export default BankLoader;
