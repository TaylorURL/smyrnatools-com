const js = require('@eslint/js')
const globals = require('globals')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const security = require('eslint-plugin-security')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const sortKeysFix = require('eslint-plugin-sort-keys-fix')
const unusedImports = require('eslint-plugin-unused-imports')

const SOURCE_FILES = ['**/*.{js,jsx,mjs,cjs}']

module.exports = [
    {
        ignores: ['build/**', 'coverage/**', 'dist/**', 'node_modules/**', 'supabase/**']
    },
    {
        files: SOURCE_FILES,
        linterOptions: {
            reportUnusedDisableDirectives: 'off'
        },
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node
            },
            parserOptions: {
                ecmaFeatures: { jsx: true }
            },
            sourceType: 'module'
        },
        settings: {
            react: { version: 'detect' }
        }
    },
    js.configs.recommended,
    react.configs.flat.recommended,
    {
        plugins: { 'react-hooks': reactHooks },
        rules: reactHooks.configs.recommended.rules
    },
    security.configs.recommended,
    {
        files: SOURCE_FILES,
        plugins: {
            'simple-import-sort': simpleImportSort,
            'sort-keys-fix': sortKeysFix,
            'unused-imports': unusedImports
        },
        rules: {
            'no-empty': 'off',
            'no-unused-vars': 'off',
            'no-useless-catch': 'off',
            'react/forbid-dom-props': ['warn', { forbid: ['style'] }],
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'security/detect-object-injection': 'off',
            'simple-import-sort/exports': 'error',
            'simple-import-sort/imports': 'error',
            'sort-keys-fix/sort-keys-fix': 'warn',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    varsIgnorePattern: '^_'
                }
            ]
        }
    },
    {
        files: ['src/views/**/*.jsx', 'src/app/components/**/*.jsx'],
        rules: {
            'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }]
        }
    },
    {
        files: ['src/**/*.{js,jsx}'],
        ignores: ['src/services/DatabaseService.js'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            message: 'Use DatabaseService instead of importing @supabase/supabase-js directly',
                            name: '@supabase/supabase-js'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/**/__tests__/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}', 'src/setupTests.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node,
                vi: 'readonly'
            }
        },
        rules: {
            'max-lines': 'off',
            'no-undef': 'off'
        }
    }
]
