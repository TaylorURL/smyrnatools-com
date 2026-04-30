import { useEffect, useRef, useState } from 'react'

import { AIService } from '../../services/AIService'

const FORMAT_DEBOUNCE_MS = 1500

/**
 * Debounced AI-formatting effect for plan notes. When the raw notes diverge
 * from what's cached in the plan's `_meta` blob, it schedules a Grok call to
 * produce a polished markdown rendering and reports the result back through
 * `onFormattedChange`. Repeats are skipped when the cache already matches the
 * source, and stale responses (user kept typing) are dropped via a ref.
 */
export function usePlanNotesFormatter({ notes, cachedFormatted, cachedSource, onFormattedChange }) {
    const trimmed = (notes || '').trim()
    const cacheMatches = cachedSource === notes && !!cachedFormatted
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const debounceTimerRef = useRef(null)
    const activeSourceRef = useRef(null)

    useEffect(() => {
        if (!trimmed) {
            if (cachedFormatted || cachedSource) onFormattedChange?.(null, null)
            return undefined
        }
        if (cacheMatches) return undefined
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = window.setTimeout(async () => {
            const source = notes
            activeSourceRef.current = source
            setLoading(true)
            setError(null)
            try {
                const formatted = await AIService.formatPlanNotes(source)
                if (activeSourceRef.current !== source) return
                if (formatted) onFormattedChange?.(formatted, source)
                else setError('Could not format notes — showing raw text.')
            } catch {
                if (activeSourceRef.current === source) setError('Could not format notes — showing raw text.')
            } finally {
                if (activeSourceRef.current === source) setLoading(false)
            }
        }, FORMAT_DEBOUNCE_MS)
        return () => window.clearTimeout(debounceTimerRef.current)
    }, [notes, trimmed, cacheMatches, cachedFormatted, cachedSource, onFormattedChange])

    return { cacheMatches, error, loading, trimmed }
}
