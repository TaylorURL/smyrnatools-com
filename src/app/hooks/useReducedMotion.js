import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Whether the OS is currently asking for reduced motion, read outside React. */
function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(QUERY).matches
}

/**
 * Tracks the OS reduced-motion preference and re-renders when it changes.
 *
 * CSS animations answer to `motion-reduce:` utilities on their own; this
 * covers the loops driven from JavaScript, which the media query cannot
 * reach. A frame loop reading this stops requesting frames rather than
 * running invisibly.
 */
export function useReducedMotion() {
    const [reduced, setReduced] = useState(prefersReducedMotion)
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
        const mql = window.matchMedia(QUERY)
        const handleChange = (event) => setReduced(event.matches)
        setReduced(mql.matches)
        // Safari below 14 exposes only the deprecated listener pair.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handleChange)
            return () => mql.removeEventListener('change', handleChange)
        }
        mql.addListener(handleChange)
        return () => mql.removeListener(handleChange)
    }, [])
    return reduced
}

export default useReducedMotion
