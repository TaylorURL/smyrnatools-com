import { useCallback, useEffect } from 'react'

/**
 * Maximized = the dispatcher hides the title row, KPI strip, side rail,
 * and full filter drawer in favor of a single sticky compact toolbar so
 * the table fills the visible area. Desktop-only (mobile is already
 * cards-on-a-narrow-screen, so there's nothing to expand into).
 *
 * The `isMaximized` flag is owned by `PlanView` (parent) so it survives
 * the loading-skeleton swap that fires on every date change — when the
 * flag lived inside PlanScheduleView, changing dates unmounted the view
 * and reset it.
 *
 * Also wires up:
 *   - mobile bailout so the user isn't stranded with desktop-only chrome
 *   - Escape key to exit maximized — same affordance as JobMapModal so
 *     the dispatcher's muscle memory carries over.
 *
 * @returns {{ effectiveMaximized: boolean, setMaximized: (next: boolean) => void }}
 */
export function usePlanScheduleMaximize({ isMaximized, isMobile, onChangeMaximized }) {
    const setMaximized = useCallback(
        (next) => {
            if (typeof onChangeMaximized === 'function') onChangeMaximized(next)
        },
        [onChangeMaximized]
    )
    const effectiveMaximized = isMaximized && !isMobile

    useEffect(() => {
        if (isMobile && isMaximized) setMaximized(false)
    }, [isMobile, isMaximized, setMaximized])

    useEffect(() => {
        if (!effectiveMaximized) return undefined
        const onKey = (e) => {
            if (e.key === 'Escape') setMaximized(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [effectiveMaximized, setMaximized])

    return { effectiveMaximized, setMaximized }
}
