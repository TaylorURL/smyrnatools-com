import { useEffect, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { canonicalNameKey } from '../../utils/OperatorNameLookupUtility'

const enumerateDates = (start, end) => {
    if (!start || !end) return []
    const out = []
    const cursor = new Date(`${start}T00:00:00`)
    const stop = new Date(`${end}T00:00:00`)
    while (cursor.getTime() <= stop.getTime()) {
        const y = cursor.getFullYear()
        const m = String(cursor.getMonth() + 1).padStart(2, '0')
        const d = String(cursor.getDate()).padStart(2, '0')
        out.push(`${y}-${m}-${d}`)
        cursor.setDate(cursor.getDate() + 1)
        if (out.length > 366) break
    }
    return out
}

/**
 * Per-operator yardage aggregator. Pulls every ticket in the active date
 * range from `dispatch_data` via `DispatchDataService.fetchDetailByDateRange`,
 * canonicalizes each ticket's `driverName`, and rolls the loaded yardage
 * into per-operator lookups the Schedules / Efficiency pages use to
 * compute yards-per-hour (YPH) against the Dayforce-side actual hours.
 *
 * Match strategy is name-only — the dispatcher's badge/ID columns aren't
 * on the ticket payload, so the canonicalization above is what holds
 * the two systems together. Tickets whose driverName doesn't resolve to
 * a canon key (blank / "DEFAULT, DEFAULT" placeholders) are simply
 * dropped; they'd show as 0-yardage YPH operators on the page if we
 * surfaced them, and the dispatcher already chases those down in the
 * Plan Operators leaderboard.
 *
 * Returns:
 *   - `yardageByOperator`         — `Map<canon, totalYards>` (all plants)
 *   - `yardageByOperatorByDay`    — `Map<canon, { [dateIso]: yards }>`
 *   - `yardageByOperatorByPlant`  — `Map<canon, { [plantCode]: yards }>`
 *     Plant breakdown of the totals, keyed by `ticket.plantId` (the
 *     loaded_plant_code). Used by plant-filtered views (Efficiency) so
 *     yardage credit follows where it was actually poured, not who
 *     poured it. Tickets with a blank plantId are bucketed under
 *     `'Unassigned'`.
 */
export default function useOperatorYardageByDay({ dateRange }) {
    const [isLoading, setIsLoading] = useState(false)
    const [yardageByOperator, setYardageByOperator] = useState(new Map())
    const [yardageByOperatorByDay, setYardageByOperatorByDay] = useState(new Map())
    const [yardageByOperatorByPlant, setYardageByOperatorByPlant] = useState(new Map())
    const startDateString = dateRange?.start || null
    const endDateString = dateRange?.end || null

    useEffect(() => {
        const dates = enumerateDates(startDateString, endDateString)
        if (dates.length === 0) {
            setYardageByOperator(new Map())
            setYardageByOperatorByDay(new Map())
            setYardageByOperatorByPlant(new Map())
            setIsLoading(false)
            return
        }
        let cancelled = false
        setIsLoading(true)
        DispatchDataService.fetchDetailByDateRange(dates)
            .then((detailByDate) => {
                if (cancelled) return
                const totals = new Map()
                const byDay = new Map()
                const byPlant = new Map()
                /* `detailByDate` shape: `{ [date]: { [orderId]: { tickets } } }`.
                 * Walk each ticket and accrue its loaded yardage into the
                 * driver's canon-name bucket. */
                for (const [dateIso, dayMap] of Object.entries(detailByDate || {})) {
                    if (!dayMap || dateIso < startDateString || dateIso > endDateString) continue
                    for (const detail of Object.values(dayMap)) {
                        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
                        for (const ticket of tickets) {
                            const key = canonicalNameKey(ticket?.driverName)
                            if (!key) continue
                            const yards = parseFloat(ticket?._confirmedQuantity) || parseFloat(ticket?.quantity) || 0
                            if (!Number.isFinite(yards) || yards <= 0) continue
                            totals.set(key, (totals.get(key) || 0) + yards)
                            if (!byDay.has(key)) byDay.set(key, {})
                            const dayBucket = byDay.get(key)
                            dayBucket[dateIso] = (dayBucket[dateIso] || 0) + yards
                            const plantCode = String(ticket?.plantId || '') || 'Unassigned'
                            if (!byPlant.has(key)) byPlant.set(key, {})
                            const plantBucket = byPlant.get(key)
                            plantBucket[plantCode] = (plantBucket[plantCode] || 0) + yards
                        }
                    }
                }
                setYardageByOperator(totals)
                setYardageByOperatorByDay(byDay)
                setYardageByOperatorByPlant(byPlant)
            })
            .catch(() => {
                if (cancelled) return
                setYardageByOperator(new Map())
                setYardageByOperatorByDay(new Map())
                setYardageByOperatorByPlant(new Map())
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [endDateString, startDateString])

    return { isLoading, yardageByOperator, yardageByOperatorByDay, yardageByOperatorByPlant }
}
