import { resolveSessionId } from './session'

/** Read a UTM param, returning null when absent so the server stores null. */
function utm(params, key) {
  const value = params.get(key)
  return value && value.trim() ? value.trim() : null
}

/**
 * Build the pageview payload for the current document state. Captures path
 * (+search), referrer, parsed UTM params, screen size, language, and the raw
 * user-agent (parsed server-side into browser/os/device).
 *
 * @param {string} siteKey - the public site key from analytics_sites
 * @returns {Record<string, unknown>} the hit payload
 */
export function collectPageview(siteKey) {
  const { location, document, navigator, screen } = window
  const params = new URLSearchParams(location.search)
  return {
    siteKey,
    sessionId: resolveSessionId(),
    path: `${location.pathname}${location.search}`,
    referrer: document.referrer || null,
    utmSource: utm(params, 'utm_source'),
    utmMedium: utm(params, 'utm_medium'),
    utmCampaign: utm(params, 'utm_campaign'),
    utmTerm: utm(params, 'utm_term'),
    utmContent: utm(params, 'utm_content'),
    screen: screen ? `${screen.width}x${screen.height}` : null,
    language: navigator.language || null,
    userAgent: navigator.userAgent || null,
  }
}
