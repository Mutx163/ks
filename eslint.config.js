import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';

export default [
    js.configs.recommended,
    {
        plugins: {
            prettier
        },
        rules: {
            'prettier/prettier': 'warn',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off'
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
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
                FileReader: 'readonly'
            }
        }
    },
    {
        ignores: ['dist/', 'node_modules/', 'gclx/', '*.bak']
    }
];
