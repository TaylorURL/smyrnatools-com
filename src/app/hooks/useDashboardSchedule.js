import { useCallback, useEffect, useRef, useState } from 'react'

import { ScheduleBucketService } from '../../services/ScheduleBucketService'
import { parseDailyOrderHtml } from '../../utils/DailyOrderParser'

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const LOCAL_DATE_STR = () => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/**
 * Fetches today's dispatch schedule HTML from the shared bucket, parses it,
 * and returns a `{ [plantCode]: { firstJobTime, lastJobTime, orders, totalYardage } }`
 * production map. Polls every 5 minutes to stay in sync with dispatch re-uploads.
 *
 * Consumers filter the resulting map by plant code (single plant view) or by
 * the set of plant codes in the active region (region view).
 *
 * @param {Array} plants - Full plants list used to resolve HTML header codes to DB codes.
 * @param {boolean} enabled - Gates fetching until plants are loaded.
 */
export function useDashboardSchedule({ plants, enabled = true }) {
    const [production, setProduction] = useState({})
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastSyncedAt, setLastSyncedAt] = useState(null)
    const [hasSchedule, setHasSchedule] = useState(false)
    const plantsRef = useRef(plants)
    plantsRef.current = plants
    const cancelledRef = useRef(false)

    const sync = useCallback(async () => {
        const date = LOCAL_DATE_STR()
        setIsSyncing(true)
        try {
            const html = await ScheduleBucketService.fetchScheduleByDate(date)
            if (cancelledRef.current) return
            if (!html) {
                setHasSchedule(false)
                return
            }
            const parsed = parseDailyOrderHtml(html, plantsRef.current)
            if (cancelledRef.current) return
            setProduction(parsed || {})
            setHasSchedule(Object.keys(parsed || {}).length > 0)
            setLastSyncedAt(new Date())
        } finally {
            if (!cancelledRef.current) setIsSyncing(false)
        }
    }, [])

    useEffect(() => {
        if (!enabled) return undefined
        cancelledRef.current = false
        sync()
        const interval = setInterval(sync, SYNC_INTERVAL_MS)
        return () => {
            cancelledRef.current = true
            clearInterval(interval)
        }
    }, [enabled, sync])

    return { hasSchedule, isSyncing, lastSyncedAt, production, refresh: sync, scheduleDate: LOCAL_DATE_STR() }
}

/**
 * Derives a compact summary from a production map. When `plantCodes` is set,
 * only those plants contribute; otherwise every plant in the map is aggregated.
 * Returns `{ plantsWithOrders, totalYards, totalOrders, firstTicket, lastTicket, topPlants, orders }`.
 */
export function summarizeSchedule(production, plantCodes = null) {
    const entries = Object.entries(production || {})
    const filtered = plantCodes ? entries.filter(([code]) => plantCodes.has(code)) : entries
    let totalYards = 0
    let totalOrders = 0
    let firstTicket = ''
    let lastTicket = ''
    const plantRows = []
    const aggregatedOrders = []
    for (const [code, data] of filtered) {
        const yards = parseFloat(data.totalYardage) || 0
        const count = (data.orders || []).length
        totalYards += yards
        totalOrders += count
        if (data.firstJobTime && (!firstTicket || data.firstJobTime < firstTicket)) firstTicket = data.firstJobTime
        if (data.lastJobTime && (!lastTicket || data.lastJobTime > lastTicket)) lastTicket = data.lastJobTime
        plantRows.push({
            firstJobTime: data.firstJobTime || '',
            lastJobTime: data.lastJobTime || '',
            orderCount: count,
            plantCode: code,
            yards
        })
        ;(data.orders || []).forEach((o) => aggregatedOrders.push({ ...o, plantCode: code }))
    }
    plantRows.sort((a, b) => b.yards - a.yards)
    aggregatedOrders.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    return {
        firstTicket,
        lastTicket,
        orders: aggregatedOrders,
        plantsWithOrders: plantRows.length,
        topPlants: plantRows,
        totalOrders,
        totalYards
    }
}
