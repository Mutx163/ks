import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    plugins: [
        // 只复制非 JS 的静态资源（CSS 由 Vite 处理，JSON 题库需静态复制）
        viteStaticCopy({
            targets: [
                { src: 'banks/*.json', dest: '.' }
            ]
        })
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                quiz: resolve(__dirname, 'quiz.html'),
                trend: resolve(__dirname, 'trend.html'),
                analysis: resolve(__dirname, 'analysis.html')
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, '.'),
        }
    }
});
