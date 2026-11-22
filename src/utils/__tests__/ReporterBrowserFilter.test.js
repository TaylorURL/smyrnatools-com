// The reporter that files browser errors lives inline in index.html, so it is
// not importable. These tests read the function out of the document and run it,
// which is what keeps the filter honest: the page is the only place it exists.
//
// What it has to get right is the difference between the site failing and the
// visitor's browser failing inside the page. DuckDuckGo's content-scope runtime
// is injected under WebKit's "user-script" scheme, logs its own start-up
// timeout through console.error, and puts its frames in the message because a
// console override is handed no stack. Reported as a site fault it is noise;
// dropped too eagerly it would hide a real error, so both directions are pinned.

import { readFileSync } from 'node:fs'

function loadBrowserOnly() {
    // Relative to the vitest root, which is the repository root.
    const html = readFileSync('index.html', 'utf8')
    const start = html.indexOf('function browserOnly(')
    if (start === -1) throw new Error('browserOnly is no longer in index.html')
    let depth = 0
    let end = -1
    for (let i = html.indexOf('{', start); i < html.length; i += 1) {
        if (html[i] === '{') depth += 1
        else if (html[i] === '}') {
            depth -= 1
            if (depth === 0) {
                end = i + 1
                break
            }
        }
    }
    if (end === -1) throw new Error('browserOnly is not a closed function in index.html')
    // eslint-disable-next-line no-new-func
    return new Function(`${html.slice(start, end)}; return browserOnly`)()
}

const browserOnly = loadBrowserOnly()

// The exact text of the report that reached the queue as issue 1797.
const DUCKDUCKGO_SETUP_FAILURE = [
    'Failed to get initial setup request@user-script:37:2329:23',
    'async init@user-script:37:7827:51',
    'async callInit@user-script:37:4908:24',
    '@user-script:37:14076:42',
    'async init@user-script:37:14069:29'
].join('\n')

describe('reporter browser-owned filter', () => {
    it('holds back a user-script frame carried in the message', () => {
        expect(browserOnly(DUCKDUCKGO_SETUP_FAILURE)).toBe(true)
    })

    it('holds back the single-frame form of the same failure', () => {
        expect(browserOnly('Failed to get initial setup request@user-script:18:2247:23')).toBe(true)
    })

    it('holds back extension frames, which carry an authority after the scheme', () => {
        expect(
            browserOnly('at a (chrome-extension://abc/content.js:1:1)\nat b (chrome-extension://abc/c.js:2:2)')
        ).toBe(true)
        expect(browserOnly('handler@safari-web-extension://1234/x.js:5:6')).toBe(true)
    })

    it('reports anything carrying a frame of the site', () => {
        expect(
            browserOnly('TypeError: x is not a function\n    at https://www.smyrnatools.com/assets/i.js:10:20')
        ).toBe(false)
        expect(browserOnly('at chrome-extension://a/c.js:1:1\n at https://www.smyrnatools.com/assets/i.js:2:2')).toBe(
            false
        )
        expect(browserOnly('at blob:https://www.smyrnatools.com/uuid:1:1')).toBe(false)
    })

    it('reports a plain message, which names no frame at all', () => {
        expect(browserOnly('Failed to load operators')).toBe(false)
        expect(browserOnly('Minified React error #418; visit react.dev/errors/418')).toBe(false)
        expect(browserOnly('Script failed to load: https://gujgtjqqurildqurpffh.supabase.co/x.js')).toBe(false)
        expect(browserOnly('')).toBe(false)
        expect(browserOnly(undefined)).toBe(false)
    })
})
