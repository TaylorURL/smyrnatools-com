import { useCallback, useEffect, useRef, useState } from 'react'

import { INITIAL_STATS } from '../constants/dashboardConstants'
import { useReducedMotion } from './useReducedMotion'

/**
 * Counts the dashboard's stats up from zero to their real values.
 *
 * The count-up runs once per region: switching regions replays it, and every
 * other stat update after it lands applies immediately, so ordinary refreshes
 * do not restart the animation. Until the region's plants are loaded there is
 * nothing meaningful to count toward, so the animation is held and the caller
 * gets the zeroed baseline. Under reduced motion the figures land at their
 * real values in one step and no frame loop starts.
 */
export function useAnimatedStats(stats, regionPlantsLoaded, dashboardRegionCode) {
    const [animatedStats, setAnimatedStats] = useState(null)
    const animationRef = useRef(null)
    const animationStateRef = useRef({ hasAnimated: false })
    const statsRef = useRef(stats)
    const reducedMotion = useReducedMotion()
    useEffect(() => {
        statsRef.current = stats
    }, [stats])
    // Keyed on what should replay the count-up, never on `stats` itself: a
    // refresh landing mid-run is picked up through statsRef by the frame that
    // is already running, so restarting the loop would send the figures back
    // to zero on every poll.
    useEffect(() => {
        const state = animationStateRef.current
        if (!regionPlantsLoaded) {
            state.hasAnimated = false
            setAnimatedStats(null)
            return undefined
        }
        if (reducedMotion) {
            state.hasAnimated = true
            setAnimatedStats(statsRef.current)
            return undefined
        }
        state.hasAnimated = false
        const duration = 1200
        const startTime = performance.now()
        // Scales every number anywhere in the stats tree by the eased progress,
        // rebuilding the same nested shape so consumers can read the animated
        // value at whatever path they already use. Arrays pass through
        // untouched — they carry list contents, not countable figures.
        const animateFromZero = (target, eased) => {
            if (target === null || target === undefined) return target
            if (typeof target !== 'object') {
                return typeof target === 'number' ? Math.round(target * eased) : target
            }
            if (Array.isArray(target)) return target
            const result = {}
            for (const key in target) {
                result[key] = animateFromZero(target[key], eased)
            }
            return result
        }
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setAnimatedStats(animateFromZero(statsRef.current, eased))
            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate)
            } else {
                state.hasAnimated = true
                animationRef.current = null
                setAnimatedStats(statsRef.current)
            }
        }
        animationRef.current = requestAnimationFrame(animate)
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
                animationRef.current = null
            }
        }
    }, [regionPlantsLoaded, dashboardRegionCode, reducedMotion])
    // Once the count-up has landed, later refreshes apply straight through.
    useEffect(() => {
        if (animationStateRef.current.hasAnimated && regionPlantsLoaded) setAnimatedStats(stats)
    }, [stats, regionPlantsLoaded])
    return animatedStats || INITIAL_STATS
}
/**
 * Owns the date range for the status history chart.
 *
 * The range is held as two `YYYY-MM-DD` strings. Quick-select presets resolve
 * to a concrete range rather than a symbolic one, so the chart never has to
 * interpret a preset name. The `all` preset needs `oldestHistoryDate`, which
 * only the history fetch can supply; before it arrives, `all` collapses to
 * today.
 */
export function useDateFilter() {
    const [historyStartDate, setHistoryStartDate] = useState('')
    const [historyEndDate, setHistoryEndDate] = useState('')
    const [oldestHistoryDate, setOldestHistoryDate] = useState('')
    const handleQuickDateFilter = useCallback(
        (filter) => {
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]
            const filters = {
                all: () => {
                    setHistoryStartDate(oldestHistoryDate || todayStr)
                    setHistoryEndDate(todayStr)
                },
                'last-month': () => {
                    const start = new Date(today)
                    start.setMonth(today.getMonth() - 1)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(todayStr)
                },
                'last-quarter': () => {
                    const currentMonth = today.getMonth()
                    const lastQuarterStartMonth = Math.floor(currentMonth / 3) * 3 - 3
                    let year = today.getFullYear()
                    let month = lastQuarterStartMonth
                    if (month < 0) {
                        month = 9
                        year -= 1
                    }
                    const start = new Date(year, month, 1)
                    const end = new Date(year, month + 3, 0)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(end.toISOString().split('T')[0])
                },
                'last-week': () => {
                    const start = new Date(today)
                    start.setDate(today.getDate() - 7)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(todayStr)
                },
                'last-year': () => {
                    const start = new Date(today.getFullYear() - 1, 0, 1)
                    const end = new Date(today.getFullYear() - 1, 11, 31)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(end.toISOString().split('T')[0])
                },
                'this-month': () => {
                    const start = new Date(today.getFullYear(), today.getMonth(), 1)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(todayStr)
                },
                'this-quarter': () => {
                    const currentMonth = today.getMonth()
                    const quarterStartMonth = Math.floor(currentMonth / 3) * 3
                    const start = new Date(today.getFullYear(), quarterStartMonth, 1)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(todayStr)
                },
                'this-week': () => {
                    const start = new Date(today)
                    start.setDate(today.getDate() - today.getDay())
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(todayStr)
                },
                'this-year': () => {
                    const start = new Date(today.getFullYear(), 0, 1)
                    setHistoryStartDate(start.toISOString().split('T')[0])
                    setHistoryEndDate(todayStr)
                }
            }
            filters[filter]?.()
        },
        [oldestHistoryDate]
    )
    return {
        handleQuickDateFilter,
        historyEndDate,
        historyStartDate,
        oldestHistoryDate,
        setHistoryEndDate,
        setHistoryStartDate,
        setOldestHistoryDate
    }
}
