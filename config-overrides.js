const { sentryWebpackPlugin } = require('@sentry/webpack-plugin')
const path = require('path')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const { version } = require('./package.json')

module.exports = function override(config, env) {
    if (process.env.ANALYZE === 'true') {
        config.plugins.push(
            new BundleAnalyzerPlugin({
                analyzerMode: 'json',
                reportFilename: path.resolve(__dirname, 'build/bundle-stats.json'),
                generateStatsFile: true,
                statsFilename: path.resolve(__dirname, 'build/webpack-stats.json')
            })
        )
    }

    // Allow importing CHANGELOG.md from the project root (outside src/)
    config.resolve.plugins = config.resolve.plugins.filter(
        (plugin) => plugin.constructor.name !== 'ModuleScopePlugin'
    )

    config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: require.resolve('path-browserify'),
        util: false,
        crypto: false,
        stream: false,
        buffer: false,
        process: false,
        zlib: false,
        querystring: false
    }

    config.module.rules.forEach((rule) => {
        if (rule.oneOf) {
            rule.oneOf.forEach((oneOfRule) => {
                if (oneOfRule.test && oneOfRule.test.toString().includes('mp4|webm|ogg')) {
                    if (oneOfRule.options && oneOfRule.options.name) {
                        oneOfRule.options.name = 'static/media/[name].[ext]'
                    }
                }
            })

            // Import .md files as raw text strings
            rule.oneOf.unshift({
                test: /\.md$/,
                type: 'asset/source'
            })
        }
    })

    /* Source maps: generate hidden maps (not served to clients) and upload
     * them to Sentry during production builds. Requires SENTRY_AUTH_TOKEN
     * and SENTRY_ORG / SENTRY_PROJECT env vars in CI. */
    if (env === 'production') {
        config.devtool = 'hidden-source-map'

        if (process.env.SENTRY_AUTH_TOKEN) {
            config.plugins.push(
                sentryWebpackPlugin({
                    authToken: process.env.SENTRY_AUTH_TOKEN,
                    org: process.env.SENTRY_ORG,
                    project: process.env.SENTRY_PROJECT,
                    release: { name: `smyrnatools@${version}` },
                    sourcemaps: { assets: './build/static/js/**' }
                })
            )
        }
    }

    return config
}
