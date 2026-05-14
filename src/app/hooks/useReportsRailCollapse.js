import { useEffect, useRef, useState } from 'react'

/**
 * Collapses the right-side rail (fading the column out and letting the main
 * list span full width) once the user has scrolled past the rail. Uses
 * scrollHeight (natural content height) so the trigger point stays stable
 * once collapsed, plus a hysteresis gap so scroll jitter near the boundary
 * doesn't oscillate the state.
 *
 * Returns `{ railRef, railCollapsed }` — attach the ref to the rail slot.
 */
export function useReportsRailCollapse(tabKey) {
    const railRef = useRef(null)
    const [railCollapsed, setRailCollapsed] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return undefined
        const scrollContainer = document.querySelector('[data-content-scroll]') || window
        const isWindow = scrollContainer === window
        const getContainerTop = () => (isWindow ? 0 : scrollContainer.getBoundingClientRect().top)
        const HYSTERESIS = 48
        const update = () => {
            const node = railRef.current
            if (!node) {
                setRailCollapsed(false)
                return
            }
            const rect = node.getBoundingClientRect()
            const naturalBottom = rect.top + node.scrollHeight
            const threshold = getContainerTop()
            setRailCollapsed((prev) => {
                if (prev) return naturalBottom <= threshold + HYSTERESIS
                return naturalBottom <= threshold + 8
            })
        }
        update()
        const target = isWindow ? window : scrollContainer
        target.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)
        const ro = new ResizeObserver(update)
        if (railRef.current) ro.observe(railRef.current)
        return () => {
            target.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
            ro.disconnect()
        }
    }, [tabKey])

    return { railCollapsed, railRef }
}
