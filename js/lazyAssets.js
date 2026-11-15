/**
 * 重资源按需加载器：KaTeX / Prism / marked
 *
 * 背景（见 docs/基线-页面加载-测试官.md）：这三件套原本被 quiz.js 静态导入，
 * 无论题库里有没有公式、有没有代码块都要付 258 KB（KaTeX JS）+ 28 KB（CSS）
 * + 39 KB（marked）+ 33 KB（Prism）+ 主题 CSS。
 * 现在改成「页面里真的出现对应内容才 import」，且同一页只加载一次。
 */

const pending = {};

function loadOnce(key, importer) {
    if (!pending[key]) {
        pending[key] = importer().catch((e) => {
            // 失败不缓存，下次还能重试
            delete pending[key];
            throw e;
        });
    }
    return pending[key];
}

const hasKatex = () => typeof window !== 'undefined' && !!window.katex;
const hasPrism = () => typeof window !== 'undefined' && !!window.Prism;
const hasMarked = () => typeof globalThis !== 'undefined' && !!globalThis.marked;

export function ensureKatex() {
    if (hasKatex()) return Promise.resolve();
    return loadOnce('katex', () => import('./vendor/katex.js'));
}

export function ensurePrism() {
    if (hasPrism()) return Promise.resolve();
    return loadOnce('prism', () => import('./vendor/prism.js'));
}

export function ensureMarked() {
    if (hasMarked()) return Promise.resolve();
    return loadOnce('marked', () => import('./vendor/marked.js'));
}

export default { ensureKatex, ensurePrism, ensureMarked };
