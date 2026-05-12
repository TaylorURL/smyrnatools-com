import { Component, ReactNode } from 'react'

/**
 * Thin shim that preserves the legacy ErrorReporterUtility public API but
 * delegates all work to the TaylorURL beacon (window.__taylorURL).
 *
 * The beacon is loaded via the <script src="...analytics-service/beacon.js">
 * tag in public/index.html — it installs window.onerror, fetch/XHR wrappers,
 * and unhandledrejection handlers once and exposes window.__taylorURL for
 * React ErrorBoundary wiring.
 *
 * Keeping this shim means existing imports (`ErrorReporterUtility`,
 * `ErrorBoundary`) keep compiling unchanged while the actual reporter lives
 * in a single place (TaylorURL's beacon) that every site shares.
 *
 * Canonical copy lives in taylorurl-com/supabase/functions/analytics-service/beacon-source.js.
 * All sites should mirror THIS shim verbatim.
 */

interface TaylorURLBeacon {
    flush?: () => void
    reportError?: (error: unknown, metadata?: Record<string, unknown>) => void
}

declare global {
    interface Window {
        __taylorURL?: TaylorURLBeacon
    }
}

const PENDING_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 100

const pendingCalls: Array<(beacon: TaylorURLBeacon) => void> = []
let drainTimer: ReturnType<typeof setInterval> | null = null

function getBeacon(): TaylorURLBeacon | null {
    return typeof window !== 'undefined' ? window.__taylorURL ?? null : null
}

function runOrDefer(call: (beacon: TaylorURLBeacon) => void): void {
    const beacon = getBeacon()
    if (beacon) {
        call(beacon)
        return
    }
    pendingCalls.push(call)
    scheduleDrain()
}

function scheduleDrain(): void {
    if (drainTimer !== null) return
    const startedAt = Date.now()
    drainTimer = setInterval(() => {
        const beacon = getBeacon()
        if (beacon) {
            clearInterval(drainTimer!)
            drainTimer = null
            while (pendingCalls.length) pendingCalls.shift()!(beacon)
        } else if (Date.now() - startedAt > PENDING_TIMEOUT_MS) {
            clearInterval(drainTimer!)
            drainTimer = null
            pendingCalls.length = 0
        }
    }, POLL_INTERVAL_MS)
}

const ErrorReporterUtility = {
    /**
     * No-op: the beacon auto-initializes from its <script data-project="..."> tag.
     * Accepted for backwards compatibility with older call sites.
     */
    init(): void {},

    /** Manually report an error. Delegates to the beacon once it's available. */
    reportError(error: unknown, metadata?: Record<string, unknown>): void {
        runOrDefer((beacon) => beacon.reportError?.(error, metadata))
    },

    /** Force-flush queued errors. */
    flush(): void {
        runOrDefer((beacon) => beacon.flush?.())
    },

    /** No-op: the beacon handlers are installed for the page's lifetime. */
    destroy(): void {}
}

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
}

/**
 * React ErrorBoundary that captures render errors and forwards them to the
 * beacon. Wrap your top-level <App /> with this.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: { componentStack?: string }): void {
        runOrDefer((beacon) => beacon.reportError?.(error, { component_stack: info?.componentStack }))
    }

    render(): ReactNode {
        if (this.state.hasError) return this.props.fallback ?? null
        return this.props.children
    }
}

export default ErrorReporterUtility
export { ErrorBoundary }
