import { useCallback, useEffect, useMemo, useRef } from 'react'

import { collectPageview } from './collect'
import { DEFAULT_API_URL } from './constants'
import { SundayAnalyticsContext } from './context'
import { subscribeToRouteChanges } from './history'
import { sendHit } from './transport'

/**
 * Router-agnostic pageview tracking: mounting is enough, no route hook needed.
 * Cookieless — the session id lives in sessionStorage, never a cookie.
 *
 * @param {object} props
 * @param {string} props.siteKey - public site key from analytics_sites
 * @param {string} [props.apiUrl] - ingest endpoint; defaults to the hosted function
 * @param {import('react').ReactNode} props.children
 */
export function SundayAnalyticsProvider({ siteKey, apiUrl = DEFAULT_API_URL, children }) {
  // Dedupe consecutive hits for the same path — replaceState often fires for
  // in-place state updates that aren't real navigations.
  const lastPathRef = useRef(null)

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined') return undefined

    const trackPageview = () => {
      const path = `${window.location.pathname}${window.location.search}`
      if (path === lastPathRef.current) return
      lastPathRef.current = path
      sendHit(apiUrl, collectPageview(siteKey))
    }

    trackPageview()
    return subscribeToRouteChanges(trackPageview)
  }, [siteKey, apiUrl])

  // Deliberate no-op: the ingest pipeline only stores pageviews, but consumers
  // can wire up track() calls now without breaking when custom events land.
  const track = useCallback(() => {}, [])

  const api = useMemo(() => ({ track }), [track])

  return <SundayAnalyticsContext.Provider value={api}>{children}</SundayAnalyticsContext.Provider>
}

export default SundayAnalyticsProvider
