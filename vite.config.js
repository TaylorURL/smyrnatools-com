/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, loadEnv } from 'vite'

import prerenderPlugin from './vite/prerender-plugin'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    // Browsers have no process.env, so every REACT_APP_* value is substituted
    // at build time for code that reads it through process.env rather than
    // import.meta.env.
    const processEnv = Object.fromEntries(
        Object.entries(env)
            .filter(([key]) => key.startsWith('REACT_APP_'))
            .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
    )

    const plugins = [react(), prerenderPlugin()]

    if (process.env.ANALYZE === 'true') {
        plugins.push(
            visualizer({
                filename: 'build/bundle-stats.html',
                template: 'treemap',
                gzipSize: true,
                brotliSize: true,
                open: false
            })
        )
    }

    if (mode === 'production' && process.env.SENTRY_AUTH_TOKEN) {
        plugins.push(
            sentryVitePlugin({
                authToken: process.env.SENTRY_AUTH_TOKEN,
                org: process.env.SENTRY_ORG,
                project: process.env.SENTRY_PROJECT,
                release: { name: `smyrnatools@${env.npm_package_version}` },
                sourcemaps: { assets: './build/assets/**' }
            })
        )
    }

    return {
        plugins,
        envPrefix: 'REACT_APP_',
        define: {
            ...processEnv,
            'process.env.NODE_ENV': JSON.stringify(mode)
        },
        server: {
            port: 3000,
            open: true
        },
        build: {
            outDir: 'build',
            sourcemap: mode === 'production' ? 'hidden' : false,
            rollupOptions: {
                output: {
                    // The four libraries below change on their own release
                    // cadence, not on ours. Held in the entry chunk they are
                    // re-downloaded on every deploy; held apart they survive
                    // it, and Vite declares them as modulepreload in the
                    // built HTML so the browser fetches the whole entry graph
                    // at once rather than a level per round trip.
                    manualChunks: {
                        react: ['react', 'react-dom', 'react-dom/client', 'scheduler'],
                        router: ['react-router-dom'],
                        sentry: ['@sentry/react'],
                        supabase: ['@supabase/supabase-js']
                    }
                }
            }
        },
        resolve: {
            alias: {
                path: 'path-browserify'
            }
        },
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./src/setupTests.js'],
            css: false,
            // The named test files depend on Jest-only behaviour — jest.doMock
            // plus CommonJS require to re-evaluate a module, and jest.mock
            // hoisting through a deep provider tree — which vitest does not
            // provide.
            exclude: [
                '**/node_modules/**',
                '**/build/**',
                '**/.intelligence/**',
                'src/services/__tests__/DatabaseService.test.js',
                'src/utils/__tests__/APIUtility.test.js',
                'src/views/__tests__/LoginView.test.jsx',
                'src/views/__tests__/MixersView.test.jsx'
            ]
        }
    }
})
