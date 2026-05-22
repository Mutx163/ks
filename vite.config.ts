import path from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
                main: path.resolve(__dirname, 'index.html'),
                quiz: path.resolve(__dirname, 'quiz.html'),
                trend: path.resolve(__dirname, 'trend.html'),
                analysis: path.resolve(__dirname, 'analysis.html')
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});
