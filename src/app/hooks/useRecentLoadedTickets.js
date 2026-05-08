import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { getTodayDate } from '../../utils/PlanUtility'
import useLiveMinuteOfDay from './useLiveMinuteOfDay'

const REFRESH_INTERVAL_MS = 60_000

/** Parse "HH:MM" or "HH:MM:SS" → minute-of-day. Returns null on bad input. */
const parseHhmmToMin = (value) => {
    const parts = String(value || '').split(':')
    if (parts.length < 2) return null
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return h * 60 + m
}

/** Build a sorted feed (newest first) of tickets loaded within the last
 *  `withinMinutes` clock minutes. Filtered to the supplied plant codes
 *  when one is provided so the banner can be region-scoped. */
const buildRecentFeed = (detailByOrderId, { nowMin, plantCodeSet, withinMinutes }) => {
    if (!detailByOrderId || !Number.isFinite(nowMin)) return []
    const cutoff = nowMin - withinMinutes
    const out = []
    Object.values(detailByOrderId).forEach((order) => {
        const tickets = Array.isArray(order?.tickets) ? order.tickets : []
        tickets.forEach((ticket) => {
            const loadedMin = parseHhmmToMin(ticket?.loadedTime)
            if (!Number.isFinite(loadedMin)) return
            if (loadedMin < cutoff || loadedMin > nowMin) return
            const plantCode = String(ticket.plantId || '').trim()
            if (!plantCode) return
            if (plantCodeSet && plantCodeSet.size > 0 && !plantCodeSet.has(plantCode.toUpperCase())) return
            const truckNum = String(ticket.truckNum || '').trim()
            if (!truckNum) return
            out.push({
                customer: ticket.customer || '',
                key: `${order.orderId || order.orderNum || 'order'}-${ticket.ticketId || ticket.ticketNum || ''}-${truckNum}-${ticket.loadedTime || ''}`,
                loadedMin,
                loadedTime: ticket.loadedTime || '',
                orderNum: order.orderNum || '',
                plantCode,
                truckNum
            })
        })
    })
    return out.sort((a, b) => b.loadedMin - a.loadedMin)
}

/**
 * Live "just loaded" feed for the activity ticker. Polls today's
 * dispatch tickets every minute and filters to whatever loaded inside
 * the last `withinMinutes` window — anything older drops off naturally
 * as wall-clock time advances.
 *
 * @param {{ plantCodes?: string[] | Set<string>, withinMinutes?: number, enabled?: boolean }} options
 *   `plantCodes` is the region scope — only tickets whose `plantId`
 *   matches one of these are included. Pass an empty list / Set to mean
 *   "all plants" (used when the user has no region scoping). The hook
 *   uppercases for comparison so the caller doesn't have to.
 */
export default function useRecentLoadedTickets({ enabled = true, plantCodes, withinMinutes = 30 } = {}) {
    const [detailByOrderId, setDetailByOrderId] = useState({})
    const nowMin = useLiveMinuteOfDay(enabled)

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        const refresh = () => {
            DispatchDataService.fetchDetailByOrderId(getTodayDate())
                .then((data) => {
                    if (cancelled) return
                    setDetailByOrderId(data || {})
                })
                .catch(() => {})
        }
        refresh()
        const id = setInterval(refresh, REFRESH_INTERVAL_MS)
        return () => {
            cancelled = true
            clearInterval(id)
        }
    }, [enabled])

    const plantCodeSet = useMemo(() => {
        if (!plantCodes) return null
        const arr = plantCodes instanceof Set ? Array.from(plantCodes) : plantCodes
        if (!Array.isArray(arr) || arr.length === 0) return null
        return new Set(
            arr
                .map((c) =>
                    String(c || '')
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
    }, [plantCodes])

    return useMemo(
        () => buildRecentFeed(detailByOrderId, { nowMin, plantCodeSet, withinMinutes }),
        [detailByOrderId, nowMin, plantCodeSet, withinMinutes]
    )
}
