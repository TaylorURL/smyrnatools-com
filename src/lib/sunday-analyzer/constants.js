/**
 * Hosted ingest endpoint. The subdomain is a fixed Supabase project ref, so
 * anyone running their own ingest function overrides it via the provider's
 * `apiUrl` prop rather than editing this literal.
 */
export const DEFAULT_API_URL =
  'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-ingest'

export const SESSION_STORAGE_KEY = 'sa_session'

export const SESSION_INACTIVITY_MS = 30 * 60 * 1000
