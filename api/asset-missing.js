// Every file under /assets carries a content hash, so a request for one that
// is not on this deployment is a document from an older build asking for the
// bundle it was built against. Vercel checks the filesystem before it applies
// a rewrite, so a real asset never reaches this handler and only the misses do.
//
// Answering those with the app shell — which is what the catch-all rewrite
// does on its own — hands a stale document a copy of itself under a text/html
// content type. `X-Content-Type-Options: nosniff` then makes the browser
// refuse it, and the failure surfaces as a script or stylesheet that would not
// load rather than as the missing file it is. A 404 says the true thing, and
// it is what the shell's recovery in index.html waits for.
export default function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.status(404).send('Not found');
}
