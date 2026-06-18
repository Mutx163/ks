import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// 获取所有 HTML 文件作为入口，确保 Cloudflare Pages 构建时包含管理页/排行榜等多页面入口
const input = {};
readdirSync('.')
    .filter((file) => file.endsWith('.html'))
    .forEach((file) => {
        const name = file.replace('.html', '');
        input[name] = resolve(__dirname, file);
    });

export default defineConfig(({ mode }) => {
    const outDir = process.env.VITE_OUT_DIR || 'dist';

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            // 本地开发代理 API 请求到宝塔服务器
            proxy: {
                '/api': {
                    target: 'http://8.135.36.100',
                    changeOrigin: true,
                    secure: false
                }
            }
        },
        build: {
            outDir,
            rollupOptions: {
                input,
                output: {
                    // 将 vendor 模块单独打包
                    manualChunks: {
                        'vendor-prism': ['./js/vendor/prism.js'],
                        'vendor-lucide': ['./js/vendor/lucide.js'],
                        'vendor-katex': ['./js/vendor/katex.js'],
                        'vendor-marked': ['./js/vendor/marked.js']
                    }
                }
            }
        },
        define: {
            __APP_MODE__: JSON.stringify(mode)
        },
        resolve: {
            alias: {
                '@': resolve(__dirname, '.')
            }
        }
    };
});
