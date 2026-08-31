import { useEffect, useState } from 'react'

/**
 * Tracks a `min-width` media query. Where `matchMedia` is unavailable the
 * result stays true, so layouts that gate rich desktop chrome on it degrade
 * to the full experience rather than the narrow one.
 *
 * @param {number} [minWidth=1024] Pixel width that flips the result to true.
 * @returns {boolean}
 */
export default function useIsWideViewport(minWidth = 1024) {
    const query = `(min-width: ${minWidth}px)`
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia(query).matches
            : true
    )

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
        const mq = window.matchMedia(query)
        const handler = (event) => setMatches(event.matches)
        setMatches(mq.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [query])

    return matches
}
