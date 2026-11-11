import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';

// 浏览器端全局（js/ 下的模块与内联脚本）
const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    localStorage: 'readonly',
    sessionStorage: 'readonly',
    fetch: 'readonly',
    setTimeout: 'readonly',
    setInterval: 'readonly',
    clearTimeout: 'readonly',
    clearInterval: 'readonly',
    alert: 'readonly',
    confirm: 'readonly',
    prompt: 'readonly',
    KaTeX: 'readonly',
    Prism: 'readonly',
    katex: 'readonly',
    console: 'readonly',
    Blob: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    FileReader: 'readonly',
    location: 'readonly',
    crypto: 'readonly',
    AbortController: 'readonly',
    requestAnimationFrame: 'readonly',
    cancelAnimationFrame: 'readonly',
    XMLHttpRequest: 'readonly',
    FormData: 'readonly',
    performance: 'readonly',
    HTMLImageElement: 'readonly',
    HTMLScriptElement: 'readonly',
    HTMLLinkElement: 'readonly',
    HTMLIFrameElement: 'readonly',
    CustomEvent: 'readonly',
    LA: 'readonly',
    lucide: 'readonly',
    eruda: 'readonly',
    Storage: 'readonly',
    DOMParser: 'readonly',
    Node: 'readonly',
    createImageBitmap: 'readonly',
    File: 'readonly',
    CanvasRenderingContext2D: 'readonly'
};

// Cloudflare Workers 运行时全局（worker/ 下）
const workerGlobals = {
    Response: 'readonly',
    Request: 'readonly',
    Headers: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    ReadableStream: 'readonly',
    WritableStream: 'readonly',
    TransformStream: 'readonly',
    AbortSignal: 'readonly',
    caches: 'readonly',
    crypto: 'readonly',
    fetch: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    console: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly'
};

export default [
    js.configs.recommended,
    {
        plugins: {
            prettier
        },
        rules: {
            'prettier/prettier': 'warn',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'off'
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: browserGlobals
        }
    },
    {
        files: ['worker/**/*.js'],
        languageOptions: {
            globals: workerGlobals
        }
    },
    {
        // 第三方打包产物不做风格检查
        ignores: ['dist/', 'node_modules/', 'gclx/', '*.bak', 'js/vendor/**']
    }
];
