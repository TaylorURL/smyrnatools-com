import * as Sentry from '@sentry/react'

/** Thin facade over Sentry — call `ErrorReporterUtility.reportError(error, metadata)` from feature code. */
const ErrorReporterUtility = {
    reportError(error: unknown, metadata?: Record<string, unknown>) {
        Sentry.captureException(error, { extra: metadata })
    }
}

export default ErrorReporterUtility
