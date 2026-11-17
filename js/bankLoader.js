/**
 * 统一题库加载服务
 * 生产环境题库只从 Cloudflare Worker API 加载。
 * banks/*.json 仅作为人工备份文件，不参与前端运行时加载，也不作为兜底来源。
 */

import API from './api.js';
import Storage from './storage.js';
import Bootstrap from './bootstrap.js';

// 条件请求用的内存表（只活在本页面生命周期，不落 localStorage）：
// no-store 下浏览器不会自己存响应，也就不可能自动发 If-None-Match，
// 所以 ETag 和整库数据都得由前端自己按 bankId 记住。
const bankEtags = new Map(); // bankId -> ETag
const fullBankCache = new Map(); // bankId -> 归一化后的整库数据（含 questions）

const BankLoader = {
    /**
     * 从云端获取题库列表（不含题目详情）
     * 只返回已启用的题库
     */
    async loadBankList() {
        try {
            // 首选首屏聚合端点：题库元数据 + 赛季列表一次拿回（少一次跨云建连）
            const boot = await Bootstrap.load();
            const data = boot
                ? { ok: true, banks: boot.banks }
                : await API.requestWithRetry('/api/banks', { cacheBust: false }, 2, 1000);

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
     * 发一次题库详情请求。带 If-None-Match 时只试一次（304 很快，失败也要快速降级），
     * 不带条件头时保留原来的 2 次重试。
     */
    _requestBank(bankId, headers) {
        const hasCondition = !!headers['If-None-Match'];
        return API.requestWithMetaRetry(
            `/api/bank/${encodeURIComponent(bankId)}`,
            { cacheBust: false, headers },
            hasCondition ? 0 : 2,
            1000
        );
    },

    /**
     * 从云端加载单个题库完整数据。
     * 注意：API 失败时返回 null，不读取 banks/*.json。
     *
     * 服务端已改成 no-store + ETag（改题立刻生效）：本页之前拉过同一个库时，
     * 带上 If-None-Match，内容没变就收 304（0 字节），直接复用内存里的整库数据。
     */
    async loadBank(bankId) {
        const startTime = Date.now();
        const cacheKey = String(bankId);
        const cached = fullBankCache.get(cacheKey);
        const etag = bankEtags.get(cacheKey);
        const headers = {};
        if (cached && etag) headers['If-None-Match'] = etag;

        try {
            let res = await this._requestBank(bankId, headers);

            // If-None-Match 不是 CORS 安全头，Worker 必须在
            // Access-Control-Allow-Headers 里放行，否则预检失败、fetch 直接抛错。
            // 放行之前宁可退回普通请求（多下一次正文），也不能让题库打不开。
            if (res.status === 0 && headers['If-None-Match']) {
                console.warn('[BankLoader] 条件请求不可用，退回普通请求:', bankId);
                res = await this._requestBank(bankId, {});
            }

            const elapsed = Date.now() - startTime;

            // 304：内容未变，不再下载正文
            if (res.status === 304 && cached) {
                console.log(`[BankLoader] 304 复用内存题库 (${elapsed}ms):`, bankId);
                Storage.setBank(cached);
                return cached;
            }

            // 403 = 题库被管理员禁用（老接口的 disabled 标记语义保持一致）
            if (res.status === 403) {
                console.warn('[BankLoader] 题库已被管理员禁用:', bankId);
                return null;
            }

            const data = res.data;
            if (!data?.ok || !data.bank) {
                if (data?.disabled) {
                    console.warn('[BankLoader] 题库已被管理员禁用:', bankId);
                    return null;
                }
                console.error(`[BankLoader] API 返回失败 (${elapsed}ms):`, bankId, data);
                return null;
            }

            const bank = this.normalizeBank(data.bank, bankId);

            // ETag 只在有整库数据时才有意义：没有缓存就不能拿它发条件请求
            if (res.etag) bankEtags.set(cacheKey, res.etag);
            else bankEtags.delete(cacheKey);
            fullBankCache.set(cacheKey, bank);

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
