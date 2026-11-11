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
            const data = await API.requestWithRetry('/api/banks', { cacheBust: false }, 2, 1000);

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
            const data = await API.requestWithRetry(
                `/api/bank/${encodeURIComponent(bankId)}`,
                { cacheBust: false },
                2,
                1000
            );

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
        const rawQuestions = Array.isArray(normalized.questions) ? normalized.questions : [];
        // 逐题归一化：题型别名、答案类型、缺失字段都在这里收敛，
        // 避免渲染器/判分器各自兼容一套（multi 别名曾导致整题不渲染）
        normalized.questions = rawQuestions.map((q) => this.normalizeQuestion(q));
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
    },

    normalizeQuestion(question) {
        if (!question || typeof question !== 'object') return question;
        const TYPE_ALIASES = {
            multi: 'multiple',
            单选题: 'single',
            多选题: 'multiple',
            判断题: 'judge',
            填空题: 'fill',
            简答题: 'essay',
            编程题: 'code'
        };
        const q = { ...question };
        q.type = TYPE_ALIASES[q.type] || q.type || 'single';

        // 代码块等正文若不是字符串，后续 Markdown 解析会直接抛错
        if (typeof q.question !== 'string') q.question = String(q.question ?? '');
        if (q.explanation !== undefined && typeof q.explanation !== 'string') {
            q.explanation = String(q.explanation ?? '');
        }

        if (q.type === 'judge') {
            const v = q.answer;
            q.answer =
                v === true || v === 'true' || v === '对' || v === '正确' || v === 'A' || v === 1;
        } else if (q.type === 'single' && typeof q.answer === 'string') {
            q.answer = q.answer.trim().toUpperCase();
        } else if (q.type === 'multiple' && typeof q.answer === 'string') {
            // "A,B" / "AB" 都归一成数组
            q.answer = q.answer
                .split(/[,，\s]+/)
                .filter(Boolean)
                .map((s) => s.trim().toUpperCase());
        } else if (q.type === 'fill' && typeof q.answer === 'string') {
            q.answer = [q.answer];
        }

        if (q.options !== undefined && !Array.isArray(q.options)) q.options = [];
        return q;
    }
};

export default BankLoader;
