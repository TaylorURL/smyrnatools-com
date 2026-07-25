import { resolveSessionId } from './session'

// Empty and absent both become null so the server never stores blank strings.
function utm(params, key) {
  const value = params.get(key)
  return value && value.trim() ? value.trim() : null
}

/**
 * The raw user-agent is sent as-is; browser/os/device parsing happens
 * server-side so the client bundle stays free of a UA-parsing table.
 *
 * @param {string} siteKey - the public site key from analytics_sites
 * @returns {Record<string, unknown>} the hit payload
 */
export function collectPageview(siteKey) {
  const { location, document, navigator, screen } = window
  const params = new URLSearchParams(location.search)
  return {
    language: navigator.language || null,
    path: `${location.pathname}${location.search}`,
    referrer: document.referrer || null,
    screen: screen ? `${screen.width}x${screen.height}` : null,
    sessionId: resolveSessionId(),
    siteKey,
    userAgent: navigator.userAgent || null,
    utmCampaign: utm(params, 'utm_campaign'),
    utmContent: utm(params, 'utm_content'),
    utmMedium: utm(params, 'utm_medium'),
    utmSource: utm(params, 'utm_source'),
    utmTerm: utm(params, 'utm_term'),
  }
}
