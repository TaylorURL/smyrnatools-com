import { useEffect, useState } from 'react'

import { AUTOPLAY_STEP_MINUTES, AUTOPLAY_TICK_MS, MINUTES_IN_DAY } from './flowMapShared'

/** Autoplay: cycle viewTime through the day on a loop.
 *
 *  Runs only while `isPlaying` is true. Every tick advances by
 *  `AUTOPLAY_STEP_MINUTES` and wraps from 23:45 back to 00:00 so the
 *  cycle is genuinely continuous. Pauses automatically if the editor
 *  opens (so the user isn't fighting a moving scrubber). Lands on
 *  midnight + autoplay so the tab loads with the day already cycling —
 *  the user sees activity light up plant by plant without having to find
 *  the Play button first. */
export function useAutoplay(panelMode) {
    const [viewTime, setViewTime] = useState(0)
    const [isPlaying, setIsPlaying] = useState(true)

    useEffect(() => {
        if (!isPlaying) return undefined
        if (panelMode === 'add' || panelMode === 'edit') {
            setIsPlaying(false)
            return undefined
        }
        const id = window.setInterval(() => {
            setViewTime((prev) => {
                const current = Number.isFinite(prev) ? prev : 0
                const next = current + AUTOPLAY_STEP_MINUTES
                return next >= MINUTES_IN_DAY ? next - MINUTES_IN_DAY : next
            })
        }, AUTOPLAY_TICK_MS)
        return () => window.clearInterval(id)
    }, [isPlaying, panelMode])

    const handlePlayToggle = () => setIsPlaying((prev) => !prev)

    return { handlePlayToggle, isPlaying, setViewTime, viewTime }
}
