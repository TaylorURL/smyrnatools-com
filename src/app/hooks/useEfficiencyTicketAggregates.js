import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { nameLookupVariants } from '../../utils/OperatorNameLookupUtility'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Pulls dispatch tickets for the single `reportDate` and aggregates them
 * per operator so the Plant Efficiency Report can auto-fill `first_load`
 * and `loads` from live ticket data instead of asking the operator to type
 * them in.
 *
 * Scope is intentionally ONE DAY — the Plant Efficiency Report represents
 * one operational day's data even though the report cadence is weekly.
 * Aggregating across the whole week would double/triple the ticket counts
 * relative to what the operator actually drove that day.
 *
 * Matching strategy (in order):
 *   1. Operator name canonicalization — every operator's display name (from
 *      `operatorOptions`) is fanned out into all the lookup variants
 *      `nameLookupVariants` produces (comma-flip, middle-drop, suffix-strip,
 *      punctuation policies). Each ticket's `driverName` is fanned out the
 *      same way; if any variant overlaps, the ticket attributes to that
 *      operator. Same canonicalization scheme used by the Statistics →
 *      Operators sub-page so the two views agree on who drove what.
 *   2. Truck number — for tickets whose driverName doesn't resolve through
 *      name matching (typos, fill-in drivers, etc.), fall back to
 *      `truckNum === row.truck_number`.
 *
 * Tickets that resolve to neither are simply dropped (they don't belong to
 * any operator on the report). This keeps `loads` honest — only confirmed
 * matches contribute to the count.
 *
 * @param {Object} args
 * @param {boolean} args.enabled - When false, skip fetching entirely.
 *   The Plant Efficiency report passes `false` until rows + operatorOptions
 *   + reportDate are all ready so the hook doesn't fire repeatedly during
 *   form init.
 * @param {string} args.reportDate - The single day this report covers, as
 *   `YYYY-MM-DD`. Sourced from `form.report_date`.
 * @param {Array<{value: string, label: string}>} args.operatorOptions -
 *   Operator dropdown options; `value` = employee_id, `label` = display name.
 * @param {Array<{name: string, truck_number: string}>} args.rows - Current
 *   form rows. `name` = employee_id, `truck_number` = assigned mixer truck.
 *
 * @returns {{
 *   aggregatesByOperatorId: Object<string, {firstLoad: string, loads: number}>,
 *   loading: boolean,
 *   ready: boolean
 * }}
 *   `aggregatesByOperatorId` keys are operator employee_ids; missing keys
 *   mean no tickets matched (caller should fall back to empty values).
 *   `ready` flips true after the first successful fetch — used to gate the
 *   "write into form state" effect so we don't blow away saved values
 *   before tickets arrive.
 */
export function useEfficiencyTicketAggregates({ enabled, reportDate, operatorOptions, rows }) {
    const [ticketsByOrderId, setTicketsByOrderId] = useState(null)
    const [loading, setLoading] = useState(false)

    const normalizedDate = useMemo(() => {
        if (!reportDate || !ISO_DATE.test(reportDate)) return null
        return reportDate
    }, [reportDate])

    useEffect(() => {
        if (!enabled || !normalizedDate) {
            setTicketsByOrderId(null)
            return undefined
        }
        let cancelled = false
        setLoading(true)
        DispatchDataService.fetchDetailByOrderId(normalizedDate)
            .then((data) => {
                if (cancelled) return
                setTicketsByOrderId(data || {})
            })
            .catch((err) => {
                if (cancelled) return
                console.warn('[useEfficiencyTicketAggregates] fetch error', err?.message || err)
                setTicketsByOrderId({})
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [enabled, normalizedDate])

    const aggregatesByOperatorId = useMemo(() => {
        if (!ticketsByOrderId || !Array.isArray(rows) || !Array.isArray(operatorOptions)) return {}

        // Build name-variant → operatorId and truck-number → operatorId
        // indexes from the report's rows. Indexes are keyed by row's
        // employee_id (`row.name`) so aggregates map cleanly back to the
        // row when the consumer writes them into form state.
        const variantToOperatorId = new Map()
        const truckToOperatorId = new Map()
        for (const row of rows) {
            const operatorId = row?.name
            if (!operatorId) continue
            const displayName = operatorOptions.find((opt) => opt.value === operatorId)?.label || ''
            for (const variant of nameLookupVariants(displayName)) {
                // First registration wins — protects against two operators
                // canonicalizing to the same key (rare but possible with
                // very common names).
                if (!variantToOperatorId.has(variant)) variantToOperatorId.set(variant, operatorId)
            }
            const truck = String(row.truck_number || '').trim()
            if (truck) truckToOperatorId.set(truck, operatorId)
        }

        // Walk every ticket on the report's single day, attribute to one
        // operator, accumulate.
        const buckets = {} // operatorId → { loadedTimes: string[], loads: number }
        for (const order of Object.values(ticketsByOrderId)) {
            for (const ticket of order.tickets || []) {
                if (!ticket.loadedTime) continue
                let operatorId = null
                const driverVariants = nameLookupVariants(ticket.driverName)
                for (const variant of driverVariants) {
                    if (variantToOperatorId.has(variant)) {
                        operatorId = variantToOperatorId.get(variant)
                        break
                    }
                }
                if (!operatorId) {
                    const truckNum = String(ticket.truckNum || '').trim()
                    if (truckNum && truckToOperatorId.has(truckNum)) {
                        operatorId = truckToOperatorId.get(truckNum)
                    }
                }
                if (!operatorId) continue
                if (!buckets[operatorId]) buckets[operatorId] = { loadedTimes: [], loads: 0 }
                buckets[operatorId].loadedTimes.push(ticket.loadedTime)
                buckets[operatorId].loads += 1
            }
        }

        // Reduce buckets to the shape the form needs: earliest load time +
        // total ticket count. Sort the times lexicographically — they're
        // already zero-padded HH:MM from the dispatch report so string
        // sort matches numeric sort exactly.
        const out = {}
        for (const [operatorId, data] of Object.entries(buckets)) {
            const sortedTimes = [...data.loadedTimes].sort()
            out[operatorId] = {
                firstLoad: sortedTimes[0] || '',
                loads: data.loads
            }
        }
        return out
    }, [ticketsByOrderId, rows, operatorOptions])

    return {
        aggregatesByOperatorId,
        loading,
        ready: ticketsByOrderId !== null
    }
}
