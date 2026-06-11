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
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const data = await API.request('/api/banks', { signal: controller.signal });
            clearTimeout(timer);

            if (data?.ok && data.banks) {
                const allBanks = data.banks;
                return allBanks.filter((b) => b.enabled !== false);
            }

            console.warn('[BankLoader] API 返回异常:', data);
        } catch (e) {
            console.error('[BankLoader] 获取题库列表失败:', e.message);
            if (e.name === 'AbortError') {
                console.error('[BankLoader] 请求超时 (15秒)');
            }
        }
        return [];
    },

    /**
     * 从云端加载单个题库完整数据。
     * 注意：API 失败时返回 null，不读取 banks/*.json。
     */
    async loadBank(bankId) {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const data = await API.request(`/api/bank/${bankId}`, { signal: controller.signal });
            clearTimeout(timer);

            const elapsed = Date.now() - startTime;

            if (!data?.ok || !data.bank) {
                if (data?.disabled) {
                    console.warn('[BankLoader] 题库已被管理员禁用:', bankId);
                    return null;
                }
                console.error(`[BankLoader] API 返回失败 (${elapsed}ms):`, bankId, data);
                return null;
            }

            const bank = this.normalizeBank(data.bank, bankId);
            Storage.setBank(bank);
            return bank;
        } catch (e) {
            const elapsed = Date.now() - startTime;
            console.error(`[BankLoader] 加载异常 (${elapsed}ms):`, bankId, e.message);
            if (e.name === 'AbortError') {
                console.error('[BankLoader] 请求超时 (15秒)');
            }
            return null;
        }
    },

    /**
     * 加载所有题库：只使用云端 API。
     */
    async loadAllBanks() {
        const startTime = Date.now();

        const list = await this.loadBankList();

        if (!list.length) {
            console.warn('[BankLoader] 云端无可用题库');
            return [];
        }

        const results = await Promise.all(list.map((b) => this.loadBank(b.id)));
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
