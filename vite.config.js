import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// 获取所有 HTML 文件作为入口
const input = {};
readdirSync('.').filter(f => f.endsWith('.html')).forEach(file => {
    const name = file.replace('.html', '');
    input[name] = resolve(__dirname, file);
});

export default defineConfig({
    build: {
        rollupOptions: {
            input
        }
    }
});
