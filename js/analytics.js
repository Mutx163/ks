/**
 * 统计脚本：Microsoft Clarity（会话回放 / 热图）
 *
 * 原则（与 51.la 一致）：
 * 1. 不在首屏关键路径：首次用户交互（指针/键盘/触摸/滚动）或 8 秒兜底后才注入；
 * 2. 只在生产域加载：本地 dev / 预览域一律不加载，避免污染线上数据；
 * 3. 不阻塞渲染：脚本 async 插入 head 尾部，官方片段原样保留（window.clarity 队列函数）；
 * 4. 敏感输入框由各模板自带的 data-clarity-mask="true" 屏蔽（同步码、口令、API Key 等）。
 */

const CLARITY_PROJECT_ID = 'zewxqxz8vh';

// 只在这些主机上启用（新增生产域名时记得加）
const PRODUCTION_HOSTS = new Set(['ks.mutx.ccwu.cc']);

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
const FALLBACK_DELAY_MS = 8000;

let scheduled = false;
let injected = false;

export function isProductionHost() {
    try {
        return PRODUCTION_HOSTS.has(location.hostname);
    } catch {
        return false;
    }
}

/**
 * 注入 Clarity 官方片段（等价于把官方 script 放进页面，只是延后执行）
 */
export function injectClarity() {
    if (injected) return;
    injected = true;
    try {
        if (window.clarity || document.getElementById('clarity-script')) return;
        (function (c, l, a, r, i) {
            c[a] =
                c[a] ||
                function () {
                    (c[a].q = c[a].q || []).push(arguments);
                };
            const t = l.createElement(r);
            t.async = 1;
            t.id = 'clarity-script';
            t.src = 'https://www.clarity.ms/tag/' + i;
            const y = l.getElementsByTagName(r)[0];
            if (y && y.parentNode) y.parentNode.insertBefore(t, y);
            else l.head.appendChild(t);
        })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID);
    } catch (e) {
        console.warn('[Analytics] Clarity 注入失败:', e.message);
    }
}

/**
 * 安排延迟加载：首次交互立即加载，无交互则 8 秒兜底；非生产域直接不排期
 */
export function scheduleClarity() {
    if (scheduled) return;
    scheduled = true;
    if (!isProductionHost()) {
        scheduled = false;
        return;
    }

    const trigger = () => {
        INTERACTION_EVENTS.forEach((evt) =>
            window.removeEventListener(evt, trigger, { passive: true })
        );
        injectClarity();
    };

    INTERACTION_EVENTS.forEach((evt) =>
        window.addEventListener(evt, trigger, { passive: true, once: true })
    );
    // 没有任何交互的访客也要计入，但不能抢首屏带宽
    setTimeout(injectClarity, FALLBACK_DELAY_MS);
}

export default { scheduleClarity, injectClarity, isProductionHost };
