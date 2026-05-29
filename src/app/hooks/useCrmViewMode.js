import { useCallback, useState } from 'react'

const STORAGE_PREFIX = 'crm.viewmode.'

/**
 * Per-surface list/cards view-mode state, persisted to localStorage so a
 * user's preference sticks between visits. Defaults to `'list'` everywhere
 * (the CRM's default view), falling back gracefully when storage is
 * unavailable (private mode / SSR).
 *
 * @param {string} key - Stable surface id (e.g. 'accounts', 'pipeline').
 * @param {'list'|'cards'} [fallback='list']
 * @returns {[string, (mode: string) => void]}
 */
export function useCrmViewMode(key, fallback = 'list') {
    const storageKey = `${STORAGE_PREFIX}${key}`
    const [mode, setModeState] = useState(() => {
        try {
            return localStorage.getItem(storageKey) || fallback
        } catch {
            return fallback
        }
    })
    const setMode = useCallback(
        (next) => {
            setModeState(next)
            try {
                localStorage.setItem(storageKey, next)
            } catch {
                /* storage unavailable — keep the in-memory value */
            }
        },
        [storageKey]
    )
    return [mode, setMode]
}
