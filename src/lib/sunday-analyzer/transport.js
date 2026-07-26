/**
 * sendBeacon first so the hit survives an unload; the keepalive fetch covers
 * browsers without it as well as beacons the browser refuses to queue.
 *
 * The body goes out as text/plain rather than JSON to keep it a CORS-simple
 * request — a preflight would be dropped during unload. The ingest function
 * parses the text as JSON regardless of content-type.
 *
 * @param {string} apiUrl - the ingest endpoint
 * @param {Record<string, unknown>} payload - the hit payload
 */
export function sendHit(apiUrl, payload) {
  if (typeof window === 'undefined') return
  const body = JSON.stringify(payload)

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
    if (navigator.sendBeacon(apiUrl, blob)) return
  }

  if (typeof fetch === 'function') {
    fetch(apiUrl, {
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      method: 'POST',
    }).catch(() => {
      // Analytics is best-effort; a dropped hit must never surface to the host app.
    })
  }
}
