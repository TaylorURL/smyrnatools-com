import * as Sentry from '@sentry/react'

/**
 * Thin facade over Sentry that preserves the legacy ErrorReporterUtility API.
 * Existing consumers (e.g. ReportsSubmitView) continue to call
 * `ErrorReporterUtility.reportError(error, metadata)` unchanged.
 */
const ErrorReporterUtility = {
    /** No-op — Sentry lifecycle is tied to the page. */
    destroy() {},

    /** No-op — Sentry manages its own transport flush. */
    flush() {},

    /** No-op — Sentry.init() is called in src/index.js. */
    init() {},

    /** Captures an error in Sentry with optional extra metadata. */
    reportError(error, metadata) {
        Sentry.captureException(error, { extra: metadata })
    }
}

export default ErrorReporterUtility
