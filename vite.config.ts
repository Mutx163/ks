import path from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    plugins: [
        viteStaticCopy({
            targets: [
                { src: 'css/*.css', dest: 'css' },
                { src: 'js/*.js', dest: 'js' },
                { src: 'banks/*.json', dest: 'banks' }
            ]
        })
    ],
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                quiz: path.resolve(__dirname, 'quiz.html')
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});
