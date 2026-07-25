const LOCATION_CHANGE_EVENT = 'sa:locationchange'

/**
 * Patching the History API is what keeps this router-agnostic — pushState and
 * replaceState fire no native event. The patches broadcast a synthetic event
 * rather than calling onChange directly so several subscribers can coexist on
 * one set of patched methods.
 *
 * @param {() => void} onChange - invoked after every navigation
 * @returns {() => void} unsubscribe — restores the original History methods
 */
export function subscribeToRouteChanges(onChange) {
  if (typeof window === 'undefined') return () => {}

  const originalPushState = window.history.pushState
  const originalReplaceState = window.history.replaceState

  const emit = () => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args)
    emit()
    return result
  }
  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args)
    emit()
    return result
  }

  window.addEventListener('popstate', onChange)
  window.addEventListener(LOCATION_CHANGE_EVENT, onChange)

  return () => {
    window.history.pushState = originalPushState
    window.history.replaceState = originalReplaceState
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(LOCATION_CHANGE_EVENT, onChange)
  }
}
