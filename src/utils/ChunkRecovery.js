import { lazy } from 'react'

/**
 * What the app does when a chunk a deploy deleted is asked for.
 *
 * Every built file carries a content hash in its name, so a deploy replaces
 * the whole set and a document naming the previous set can reach none of it.
 * A tab left open across a release is the ordinary way to arrive here: the
 * shell is still running, and the first thing it reaches for that it has not
 * already loaded is gone.
 *
 * There is no second address to ask at. A dynamic import that fails is
 * recorded as failed in the document's module map, and every later import of
 * that specifier rejects straight out of the map with no request leaving the
 * browser, so calling the same importer again cannot succeed however long it
 * waits. Importing the same file under a changed query string does reach the
 * network, but it arrives as a second copy of the module rather than the one
 * the rest of the graph is bound to — two database clients, two realtime
 * sockets — and its own imports still name the addresses that are gone.
 *
 * So the recovery is the document. The shell's `__recoverStaleShell` re-fetches
 * it past the cache, which is the only thing that yields the current hashes,
 * and it holds the limits that keep a file missing for some other reason from
 * cycling the page. Everything here routes into that one path, because two
 * recoveries racing means the careless one wins.
 */

/**
 * Asks the shell to replace the document.
 *
 * @returns {boolean} Whether the document is being replaced. False means the
 * shell declined — its allowance is spent, or storage is unavailable — and the
 * caller owns what the reader sees next.
 */
export function recoverStaleDocument() {
    const recover = typeof window !== 'undefined' && window.__recoverStaleShell
    if (typeof recover !== 'function') return false
    try {
        return recover() === true
    } catch {
        return false
    }
}

/**
 * A promise that never settles, for the moment the document is on its way out.
 *
 * The alternative is rejecting, which puts the error boundary's screen in front
 * of a reader for the half second before the new document arrives. Suspense
 * holds its fallback instead, and the page the reader is already looking at
 * stays until it is replaced.
 */
const untilTheDocumentIsReplaced = () => new Promise(() => {})

/**
 * Runs a dynamic import, and answers a chunk that is not there by replacing the
 * document rather than by asking again.
 *
 * When the shell declines to recover, the rejection is passed on so the caller
 * decides: a lazy component surfaces it to the error boundary, which offers the
 * reader a reload they can take themselves, and a service loader falls back to
 * whatever it does without that service.
 *
 * @param {() => Promise<any>} importer The dynamic import to run.
 * @returns {Promise<any>} The module, or a promise that never settles.
 */
export function importChunk(importer) {
    return importer().catch((error) => {
        if (recoverStaleDocument()) return untilTheDocumentIsReplaced()
        throw error
    })
}

/**
 * `React.lazy` over `importChunk`, for every component the app code-splits.
 *
 * @param {() => Promise<any>} importer The dynamic import to run.
 * @returns {React.LazyExoticComponent} The lazy component.
 */
export function lazyWithRecovery(importer) {
    return lazy(() => importChunk(importer))
}
