const path = require('path')

module.exports = function override(config, env) {
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

    return config
}
