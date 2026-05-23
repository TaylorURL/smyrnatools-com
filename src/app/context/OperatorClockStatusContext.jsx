/* eslint-disable react/forbid-dom-props */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import OperatorClockStatusService from '../../services/OperatorClockStatusService'

/** Polling interval for the today's-shifts query. Dayforce sync drops new
 *  punches into the table on a few-minute cadence; polling every 90s
 *  keeps the indicator within ~one cycle of reality without hammering the
 *  database. */
const REFRESH_INTERVAL_MS = 90_000

const EMPTY_STATUS_MAP = new Map()

const OperatorClockStatusContext = createContext({
    isLoading: false,
    lastUpdated: null,
    refresh: () => {},
    statusByBadge: EMPTY_STATUS_MAP
})

/**
 * App-wide provider that loads today's Dayforce shifts every ~90s and
 * exposes a `Map<badge → status>` so any operator-name surface across
 * the app can render a "clocked in" / "clocked out" indicator without
 * each consumer re-querying the database. Mounted once near the top of
 * the app tree (inside `AuthProvider`) so every downstream view shares
 * one polling loop.
 */
export function OperatorClockStatusProvider({ children }) {
    const [statusByBadge, setStatusByBadge] = useState(EMPTY_STATUS_MAP)
    const [isLoading, setIsLoading] = useState(false)
    const [lastUpdated, setLastUpdated] = useState(null)
    const cancelledRef = useRef(false)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        try {
            const next = await OperatorClockStatusService.fetchTodayStatuses()
            if (cancelledRef.current) return
            setStatusByBadge(next)
            setLastUpdated(new Date())
        } finally {
            if (!cancelledRef.current) setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        cancelledRef.current = false
        refresh()
        const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
        return () => {
            cancelledRef.current = true
            clearInterval(interval)
        }
    }, [refresh])

    return (
        <OperatorClockStatusContext.Provider value={{ isLoading, lastUpdated, refresh, statusByBadge }}>
            {children}
        </OperatorClockStatusContext.Provider>
    )
}

/** Hook returning the full status map + polling controls. Most consumers
 *  want `useOperatorClockStatus(badge)` instead — that hook handles the
 *  Map lookup + null badge cases for you. */
export function useOperatorClockStatusContext() {
    return useContext(OperatorClockStatusContext)
}

/** Resolves a single operator's clock-in status from the badge key.
 *  Accepts the smyrnatools `employeeId` (Smyrna badge), Dayforce
 *  `employee_badge`, or any string representation thereof — both
 *  systems share the same numeric badge for matched employees. Returns
 *  `{ isClockedIn, actualInAt, actualOutAt, isKnown }`. `isKnown` is
 *  false when the badge has no Dayforce row today, which the indicator
 *  uses to render a neutral "unknown" dot. */
export function useOperatorClockStatus(badge) {
    const { statusByBadge } = useOperatorClockStatusContext()
    if (badge == null) {
        return { actualInAt: null, actualOutAt: null, isClockedIn: false, isKnown: false }
    }
    const key = String(badge).trim()
    if (!key) {
        return { actualInAt: null, actualOutAt: null, isClockedIn: false, isKnown: false }
    }
    const record = statusByBadge.get(key)
    if (!record) {
        return { actualInAt: null, actualOutAt: null, isClockedIn: false, isKnown: false }
    }
    return {
        actualInAt: record.actualInAt,
        actualOutAt: record.actualOutAt,
        isClockedIn: record.isClockedIn,
        isKnown: true
    }
}

export default OperatorClockStatusContext
