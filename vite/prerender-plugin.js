import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import Beasties from 'beasties'
import { createServer } from 'vite'

const ROOT_PLACEHOLDER = '<div id="root"></div>'
const HEAD_CLOSE_TAG = '</head>'

// Beasties stamps the element it treated as the document; the page does not
// need to carry that.
const CONTAINER_STAMP = ' data-beasties-container'

/**
 * Writes the rules the sign-in screen needs into the page itself.
 *
 * The first paint waits on the stylesheet: a browser will not draw a page whose
 * `<link rel="stylesheet">` is still in flight, and on a phone that link is a
 * round trip and a download before any of the markup after it counts. The
 * screen is rendered whole at build time, so the rules its markup needs are
 * knowable at build time too. They go into a `<style>` in the head, and the
 * sheet itself is asked for on a media query that matches nothing — fetched
 * without holding the paint — and switched on when it lands. What arrives late
 * is only what the page has no element for yet.
 *
 * The exceptions are the states the page takes on after it is served. The theme
 * is a class the head script stamps on the root before the first paint, and no
 * element carries it at build time, so every rule keyed on one of those classes
 * or on a data- or aria- attribute rides along regardless.
 *
 * The font faces ride along too. The template preloads both files, but a
 * preloaded file with no @font-face naming it is text set in the fallback and
 * then reset when the sheet lands.
 */
function inliner(outDir, base) {
    return new Beasties({
        allowRules: [/\[(data|aria)-/, /-mode\b/, /\.accent-/],
        inlineFonts: true,
        logLevel: 'silent',
        mergeStylesheets: false,
        path: outDir,
        preload: 'media',
        preloadFonts: false,
        pruneSource: false,
        reduceInlineStyles: false
    })
}

/**
 * Runs the bundle after the first frame rather than before it.
 *
 * The document written here is a finished screen, so its first frame owes the
 * bundle nothing. A module script is deferred, which only means it waits for
 * the parser: it runs the moment parsing ends, and on a slow phone that moment
 * arrives before the browser has found a frame to paint the document in. The
 * page then sits blank while the bundle adopts markup nobody has been shown,
 * and the whole download is charged to the first paint.
 *
 * The entry keeps its early fetch, as a module preload, and loses its script
 * tag. An inline module in its place asks for the bundle one frame after the
 * first, which is the first frame the document can have been painted in and the
 * earliest the bundle can no longer hold it back.
 *
 * A frame is not always coming. A tab opened in the background paints nothing
 * until somebody looks at it, and waiting on a frame there would leave the
 * drawn screen sitting dead — a sign-in button nothing is listening to. So the
 * wait is only taken where there is a paint to protect, and a timer stands
 * behind it for the throttled cases in between.
 */
function paintFirst(head) {
    const entry = head.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)
    if (!entry) throw new Error('prerender: the built head carries no module entry')
    const [tag, src] = entry
    const preload = `<link rel="modulepreload" crossorigin href="${src}">`
    const source = `let started=false;
const start=()=>{if(!started){started=true;import(${JSON.stringify(src)})}};
if(document.visibilityState==="visible")requestAnimationFrame(()=>requestAnimationFrame(start));
else start();
setTimeout(start,2000)`
    const boot = `<script type="module">${source.replace(/\n/g, '')}</script>`
    return head.replace(tag, `${preload}${boot}`)
}

/**
 * The two decisions the document has to make before the bundle exists, taken in
 * the head so both are settled before the body is parsed.
 *
 * The drawn screen is the front door's, and only a signed-out visitor asking
 * for `/` is owed it. Anyone else — a legal route, or a browser carrying the
 * session flag cookie — is on their way to a screen the bundle renders, and
 * seeing the sign-in screen first would be a screen they never asked for. A
 * marker on the root element set before the body is parsed keeps the drawn
 * markup out of the paint entirely, so those visits look exactly as they did
 * when nothing was drawn ahead of them.
 *
 * The clip behind the sign-in screen is one of four, chosen per visit. The
 * choice is made here rather than by the component because the video element
 * already reached the browser with the document: naming the file this early is
 * the difference between the largest paint landing on the document and landing
 * on the bundle. The bundle reads the same choice back, so what React renders
 * names the file already in hand rather than asking for a second one.
 */
function documentDecisions(clips) {
    const style = `<style>[data-front-door="off"] [data-prerendered]{display:none}</style>`
    const source = `(function(){
var signedIn=document.cookie.split(";").some(function(part){return part.trim().indexOf("smyrna_auth=1")===0});
if(location.pathname!=="/"||signedIn){document.documentElement.setAttribute("data-front-door","off");return}
var clips=${JSON.stringify(clips)};
window.__smyrnaBackgroundVideo=Math.floor(Math.random()*clips.length);
window.__smyrnaBackgroundClips=clips})()`
    return `${style}<script>${source.replace(/\n/g, '')}</script>`
}

/**
 * Hands the chosen clip to the video element the moment the parser has built
 * it.
 *
 * Waiting for the document to finish would be waiting for the analytics script
 * as well, since a deferred script holds DOMContentLoaded back, and the clip is
 * the largest thing the page paints. So this runs inline, immediately after the
 * markup it reaches into, which is the first instant the element exists.
 */
const CLIP_HANDOFF = `<script>(function(){
var pick=window.__smyrnaBackgroundVideo,clips=window.__smyrnaBackgroundClips;
if(pick===undefined||!clips)return;
var el=document.querySelector("source[data-ambient-clip]");
if(!el||el.getAttribute("src"))return;
el.setAttribute("src",clips[pick]);
if(el.parentNode&&el.parentNode.load)el.parentNode.load()})()</script>`.replace(/\n/g, '')

/**
 * Prepares the rendered screen for the document it is written into.
 *
 * React hoists the resources a render asks for to the front of its output — for
 * this screen, a preload of the mark the header paints. The head already
 * preloads the same file, so the hoisted tags are dropped rather than repeated
 * inside the root.
 *
 * What is left is stamped, so the head can hold the whole screen out of the
 * paint on the visits it does not belong to, and so nothing mistakes it for
 * what React drew: React clears the root when it mounts, and the stamp leaves
 * with it.
 */
function prepareScreen(markup) {
    const screen = markup.replace(/^(?:<link\b[^>]*>|<meta\b[^>]*>|<title\b[\s\S]*?<\/title>)+/, '')
    const opening = screen.match(/^<([a-z]+)\b/)
    if (!opening) throw new Error('prerender: the rendered screen has no root element')
    return `${screen.slice(0, opening[0].length)} data-prerendered${screen.slice(opening[0].length)}`
}

/**
 * Renders the signed-out front door into index.html at build time.
 *
 * Uses Vite's SSR module loader in-process rather than a headless browser,
 * which is what lets it run inside Vercel's build sandbox.
 */
export default function prerenderPlugin() {
    let outDir = 'build'
    let base = '/'
    return {
        apply: 'build',
        configResolved(config) {
            outDir = config.build.outDir
            base = config.base
        },
        name: 'smyrna-prerender',
        async closeBundle() {
            const file = join(outDir, 'index.html')
            const template = await readFile(file, 'utf8')
            const ssrServer = await createServer({
                appType: 'custom',
                logLevel: 'silent',
                server: { middlewareMode: true },
                // The router publishes a CommonJS build under Node's own
                // condition, and the SSR loader cannot read named exports off
                // one; asking for the synchronous module build first hands it
                // the same ES modules the browser build gets. The rail ships
                // its JSX unbuilt, so it goes through Vite's pipeline.
                ssr: {
                    noExternal: ['react-router', 'react-router-dom', '@taylorurl/split-rail'],
                    resolve: { conditions: ['module-sync', 'module', 'node', 'development|production'] }
                }
            })

            try {
                const { BACKGROUND_VIDEO_URLS, render } = await ssrServer.ssrLoadModule('/src/entry-server.jsx')
                const head = paintFirst(template.slice(0, template.indexOf(HEAD_CLOSE_TAG)))
                const rendered = template
                    .replace(template.slice(0, template.indexOf(HEAD_CLOSE_TAG)), head)
                    .replace(HEAD_CLOSE_TAG, `${documentDecisions(BACKGROUND_VIDEO_URLS)}${HEAD_CLOSE_TAG}`)
                    .replace(ROOT_PLACEHOLDER, `<div id="root">${prepareScreen(render())}</div>${CLIP_HANDOFF}`)
                const document = (await inliner(outDir, base).process(rendered)).replace(CONTAINER_STAMP, '')
                await writeFile(file, document, 'utf8')
            } finally {
                await ssrServer.close()
            }
        }
    }
}
