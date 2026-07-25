import { createContext } from 'react'

/**
 * @typedef {object} SundayAnalyticsApi
 * @property {(name: string, props?: Record<string, unknown>) => void} track
 *   Currently a no-op — only pageviews reach the ingest pipeline.
 */

/** @type {import('react').Context<SundayAnalyticsApi | null>} */
export const SundayAnalyticsContext = createContext(null)
