import { Component } from 'react'

/**
 * Thin shim that preserves the legacy ErrorReporterUtility public API but
 * delegates all work to the TaylorURL beacon (window.__taylorURL).
 *
 * The beacon is loaded via the <script src="…/analytics-service/beacon.js">
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

const PENDING_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 100

const pendingCalls = []
let drainTimer = null

function getBeacon() {
  return typeof window !== 'undefined' ? window.__taylorURL : null
}

function runOrDefer(call) {
  const beacon = getBeacon()
  if (beacon) {
    call(beacon)
    return
  }
  pendingCalls.push(call)
  scheduleDrain()
}

function scheduleDrain() {
  if (drainTimer !== null) return
  const startedAt = Date.now()
  drainTimer = setInterval(() => {
    const beacon = getBeacon()
    if (beacon) {
      clearInterval(drainTimer)
      drainTimer = null
      while (pendingCalls.length) pendingCalls.shift()(beacon)
    } else if (Date.now() - startedAt > PENDING_TIMEOUT_MS) {
      clearInterval(drainTimer)
      drainTimer = null
      pendingCalls.length = 0
    }
  }, POLL_INTERVAL_MS)
}

const ErrorReporterUtility = {
  /**
   * No-op: the beacon auto-initializes from its <script data-project="…"> tag.
   * Accepted for backwards compatibility with older call sites.
   */
  init() {},

  /** Manually report an error. Delegates to the beacon once it's available. */
  reportError(error, metadata) {
    runOrDefer(beacon => beacon.reportError?.(error, metadata))
  },

  /** Force-flush queued errors. */
  flush() {
    runOrDefer(beacon => beacon.flush?.())
  },

  /** No-op: the beacon handlers are installed for the page's lifetime. */
  destroy() {},
}

/**
 * React ErrorBoundary that captures render errors and forwards them to the
 * beacon. Wrap your top-level <App /> with this.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    runOrDefer(beacon =>
      beacon.reportError?.(error, { component_stack: info?.componentStack })
    )
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}

export default ErrorReporterUtility
export { ErrorBoundary }
