import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'fs';

// 获取所有 HTML 文件作为入口
const input = {};
readdirSync('.').filter(f => f.endsWith('.html')).forEach(file => {
    const name = file.replace('.html', '');
    input[name] = resolve(__dirname, file);
});

// 复制静态资源的插件
function copyStaticFiles() {
    return {
        name: 'copy-static',
        writeBundle() {
            // 复制 debug.js
            if (existsSync('js/debug.js')) {
                mkdirSync('dist/js', { recursive: true });
                copyFileSync('js/debug.js', 'dist/js/debug.js');
            }
            // 复制 banks 目录
            if (existsSync('banks')) {
                mkdirSync('dist/banks', { recursive: true });
                readdirSync('banks').filter(f => f.endsWith('.json')).forEach(f => {
                    copyFileSync(`banks/${f}`, `dist/banks/${f}`);
                });
            }
        }
    };
}

export default defineConfig({
    build: {
        rollupOptions: {
            input
        }
    },
    plugins: [copyStaticFiles()]
});
