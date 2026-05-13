/** Centralized storage key constants for non-credential cached values.
 *  Session credentials (user id, session id, JWT) live in SessionService and
 *  are intentionally never persisted to sessionStorage. */
export const SESSION_STORAGE_KEYS = {
    CACHED_PLANTS: 'cachedPlants',
    USER_ROLE: 'userRole'
}
