/**
 * 仅用于本地预览新题库：
 *   npx vite --config vite.preview.config.js
 * 或 npm run dev -- --config vite.preview.config.js
 *
 * 不修改任何源码、不写入生产环境。做两件事：
 * 1) 仅在本 dev server 的产物里，把 js/api.js 的 BASE_URL 改为同源；
 * 2) 由 dev server 直接提供 /api/banks 与 /api/bank/:id，数据来自 banks/*.json。
 */
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BANKS_DIR = resolve(ROOT, 'banks');

function readBanks() {
    if (!existsSync(BANKS_DIR)) return [];
    return readdirSync(BANKS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
            try {
                const bank = JSON.parse(readFileSync(resolve(BANKS_DIR, f), 'utf8'));
                if (!bank || !bank.id || !Array.isArray(bank.questions)) return null;
                return bank;
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function mockApiPlugin() {
    return {
        name: 'local-bank-preview',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = new URL(req.url, 'http://localhost');
                const json = (body, status = 200) => {
                    res.statusCode = status;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify(body));
                };

                const banks = readBanks();

                if (url.pathname === '/api/banks') {
                    return json({
                        ok: true,
                        banks: banks.map((b) => ({
                            id: b.id,
                            name: b.name,
                            description: b.description || '',
                            category: (b.categories || []).join(', '),
                            categories: b.categories || [],
                            version: b.version || '1.0.0',
                            question_count: b.questions.length,
                            questionCount: b.questions.length,
                            enabled: true,
                            allowed_modes: null
                        }))
                    });
                }

                if (url.pathname.startsWith('/api/bank/')) {
                    const id = decodeURIComponent(url.pathname.slice('/api/bank/'.length));
                    const bank = banks.find((b) => b.id === id);
                    if (!bank) return json({ ok: false, error: '题库不存在' }, 404);
                    return json({
                        ok: true,
                        bank: {
                            id: bank.id,
                            name: bank.name,
                            description: bank.description || '',
                            version: bank.version || '1.0.0',
                            allowed_modes: null,
                            questions: bank.questions
                        }
                    });
                }

                if (url.pathname === '/api/announce') {
                    return json({ ok: true, announcements: [] });
                }

                if (url.pathname.startsWith('/api/leaderboard')) {
                    return json({ ok: true, leaderboard: [], total: 0 });
                }

                // 同步 / 管理类接口不拦截
                next();
            });
        }
    };
}

/** 只在本次 dev 构建里把生产 API 基址换成同源，磁盘源码不变。 */
function sameOriginApiPlugin() {
    return {
        name: 'same-origin-api',
        enforce: 'pre',
        transform(code, id) {
            if (!id.replace(/\\/g, '/').endsWith('/js/api.js')) return null;
            const patched = code.replace(
                /BASE_URL:\s*'https:\/\/ks-api\.mutx\.ccwu\.cc'/,
                'BASE_URL: (typeof window !== "undefined" ? window.location.origin : "")'
            );
            if (patched === code) {
                this.warn('未能在 js/api.js 中找到 BASE_URL，本地预览可能仍请求生产 API');
                return null;
            }
            return { code: patched, map: null };
        }
    };
}

export default defineConfig({
    server: {
        port: 3100,
        host: '0.0.0.0'
    },
    plugins: [sameOriginApiPlugin(), mockApiPlugin()],
    resolve: {
        alias: { '@': ROOT }
    }
});
