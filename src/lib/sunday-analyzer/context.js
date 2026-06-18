import { createContext, useContext } from 'react'

/**
 * @typedef {object} SundayAnalyticsApi
 * @property {(name: string, props?: Record<string, unknown>) => void} track
 *   Reserved for future custom events. Exposed in v1 but intentionally a no-op
 *   — the ingest pipeline only stores pageviews for now (YAGNI).
 */

/** @type {import('react').Context<SundayAnalyticsApi | null>} */
export const SundayAnalyticsContext = createContext(null)

/**
 * Access the analytics API. Returns a `track()` function reserved for future
 * custom events. Must be called inside a <SundayAnalyticsProvider>.
 *
 * @returns {SundayAnalyticsApi}
 */
export function useSundayAnalytics() {
  const api = useContext(SundayAnalyticsContext)
  if (!api) {
    throw new Error('useSundayAnalytics must be used within a <SundayAnalyticsProvider>')
  }
  return api
}
