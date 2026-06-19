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
            const data = await API.requestWithRetry('/api/banks', {}, 2, 1000);

            if (data?.ok && data.banks) {
                const allBanks = data.banks;
                return allBanks
                    .filter((b) => b.enabled !== false)
                    .map((b) => this.normalizeBankListItem(b));
            }

            console.warn('[BankLoader] API 返回异常:', data);
        } catch (e) {
            console.error('[BankLoader] 获取题库列表失败:', e.message);
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
            const data = await API.requestWithRetry(`/api/bank/${bankId}`, {}, 2, 1000);

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
            return null;
        }
    },

    /**
     * 加载所有题库：只使用云端 API。
     */
    async loadAllBanks(preloadedList = null) {
        const startTime = Date.now();

        const list = Array.isArray(preloadedList) ? preloadedList : await this.loadBankList();

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

    normalizeBankListItem(bank = {}) {
        const questionCount = Number(bank.questionCount ?? bank.question_count ?? 0) || 0;
        const category = bank.category || '';
        return {
            ...bank,
            id: bank.id,
            name: bank.name || bank.title || bank.id || '未命名题库',
            description: bank.description || '',
            category,
            categories: Array.isArray(bank.categories)
                ? bank.categories
                : category
                  ? [category]
                  : [],
            questionCount,
            question_count: questionCount,
            questions: [],
            enabled: bank.enabled !== false,
            allowed_modes: Array.isArray(bank.allowed_modes) ? bank.allowed_modes : null,
            _metadataOnly: true
        };
    },

    normalizeBank(bank, fallbackId) {
        const normalized = { ...bank };
        normalized.id = normalized.id || fallbackId;
        normalized.name = normalized.name || normalized.title || normalized.id || '未命名题库';
        normalized.description = normalized.description || '';
        normalized.questions = Array.isArray(normalized.questions) ? normalized.questions : [];
        normalized.questionCount = normalized.questions.length;
        normalized.question_count = normalized.questionCount;
        normalized.categories = Array.isArray(normalized.categories)
            ? normalized.categories
            : normalized.category
              ? [normalized.category]
              : [];
        normalized._metadataOnly = false;
        if (normalized.enabled === undefined) normalized.enabled = true;
        return normalized;
    }
};

export default BankLoader;
