import { useCallback, useEffect, useRef, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'

const SYNC_INTERVAL_MS = 30 * 1000
const UPDATE_CHECK_INTERVAL_MS = 10 * 1000

const META_KEY = '_meta'

/** Stable per-order key for dedup. Prefers `orderId` (the dispatch URL id,
 *  always populated for parsed orders) and falls back to `orderNum` for
 *  the rare hand-built rows. Returns an empty string for unkeyable rows so
 *  the merge keeps them as-is rather than collapsing them. */
const orderKey = (order) => String(order?.orderId || order?.orderNum || '').trim()

/**
 * Union-merge of the previous `plant_production` blob with a fresh
 * `dispatch_data` snapshot. The dispatch import is the most current source
 * but it isn't always the most COMPLETE — if one of the two ticket parsers
 * (DetailOrderAnalysis / DetailDriver) hasn't finished uploading for the
 * day, fresh can come back with fewer orders than the snapshot already
 * has. Replacing wholesale would briefly hide those orders. Merging instead
 * keeps the schedule from flickering empty rows and keeps everything any
 * source has ever seen for this date.
 *
 * Per plant:
 *   - Orders are unioned by `orderId` (fallback `orderNum`).
 *     Fresh fields win on conflict so a cancelled / retimed order's latest
 *     state still propagates.
 *   - Non-orders block fields (totals, helpers) come from fresh when
 *     present, prev otherwise — same precedence the wholesale replace had.
 *
 * `_meta` is always preserved from prev (user-authored overrides /
 * Saturday counts / missing-operator marks).
 */
function mergePlantProduction(prev, fresh) {
    const prevSafe = prev && typeof prev === 'object' ? prev : {}
    const freshSafe = fresh && typeof fresh === 'object' ? fresh : {}
    const codes = new Set()
    for (const k of Object.keys(prevSafe)) if (k !== META_KEY) codes.add(k)
    for (const k of Object.keys(freshSafe)) if (k !== META_KEY) codes.add(k)

    const out = {}
    for (const code of codes) {
        const a = prevSafe[code] && typeof prevSafe[code] === 'object' ? prevSafe[code] : {}
        const b = freshSafe[code] && typeof freshSafe[code] === 'object' ? freshSafe[code] : {}
        const aOrders = Array.isArray(a.orders) ? a.orders : []
        const bOrders = Array.isArray(b.orders) ? b.orders : []

        const byKey = new Map()
        const unkeyed = []
        for (const order of aOrders) {
            const key = orderKey(order)
            if (key) byKey.set(key, order)
            else unkeyed.push(order)
        }
        for (const order of bOrders) {
            const key = orderKey(order)
            if (!key) {
                unkeyed.push(order)
                continue
            }
            const existing = byKey.get(key)
            byKey.set(key, existing ? { ...existing, ...order } : order)
        }

        out[code] = { ...a, ...b, orders: [...byKey.values(), ...unkeyed] }
    }

    if (prevSafe[META_KEY] !== undefined) out[META_KEY] = prevSafe[META_KEY]
    return out
}

/**
 * Keeps `plantProduction` in lockstep with the `dispatch_data` table — the
 * canonical source for parsed dispatch report data. The bucket's HTML files
 * are uploaded by the bridge userscript, parsed server-side by the
 * `dispatch-import` edge function, and written to `dispatch_data`.
 *
 *   1. Pulls schedule rows for `planDate` on mount / date change.
 *   2. Polls `fetchLastUpdatedAt` every 10s; a newer timestamp triggers a
 *      re-pull immediately (cheap "is there anything new?" check that
 *      replaces the realtime postgres_changes subscription, which can no
 *      longer reach the locked-down `dispatch_data` table from the anon role).
 *   3. Re-pulls every 30s as a safety net even if the timestamp probe
 *      misses (clock skew, dropped requests).
 *   4. Exposes `refresh()` for manual user-driven refreshes.
 *
 * Fresh dispatch_data snapshots are UNIONED into the previous plant_production
 * blob rather than replacing it wholesale, so an in-flight ticket parser
 * (DetailOrderAnalysis arriving before DetailDriver, or vice versa) can never
 * cause orders the saved snapshot already had to disappear from the schedule
 * mid-day. See `mergePlantProduction` above for the merge rules. The `_meta`
 * blob (special/QC jobs, formatted notes, Saturday counts) is preserved
 * across every sync so user-authored plan metadata isn't wiped.
 */
// eslint-disable-next-line no-unused-vars
export function useScheduleSync({ planDate, plants: _plants, setPlantProduction, enabled = true }) {
    const [lastSyncedAt, setLastSyncedAt] = useState(null)
    const [fileUpdatedAt, setFileUpdatedAt] = useState(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const setPlantProductionRef = useRef(setPlantProduction)
    setPlantProductionRef.current = setPlantProduction
    const planDateRef = useRef(planDate)
    planDateRef.current = planDate
    const cancelledRef = useRef(false)
    const lastSeenUpdatedAtRef = useRef(null)

    const sync = useCallback(async () => {
        const date = planDateRef.current
        if (!date) return false
        setIsSyncing(true)
        try {
            const [production, updatedAt] = await Promise.all([
                DispatchDataService.fetchSchedule(date),
                DispatchDataService.fetchLastUpdatedAt(date)
            ])
            if (cancelledRef.current) return false
            if (updatedAt) {
                setFileUpdatedAt(updatedAt)
                lastSeenUpdatedAtRef.current = updatedAt.getTime()
            }
            if (!production || Object.keys(production).length === 0) return false
            setPlantProductionRef.current((prev) => {
                const next = mergePlantProduction(prev, production)
                if (JSON.stringify(prev) === JSON.stringify(next)) return prev
                return next
            })
            setLastSyncedAt(new Date())
            return true
        } catch (err) {
            if (!cancelledRef.current) console.warn('[useScheduleSync]', err)
            return false
        } finally {
            if (!cancelledRef.current) setIsSyncing(false)
        }
    }, [])

    useEffect(() => {
        if (!enabled || !planDate) return undefined
        cancelledRef.current = false
        lastSeenUpdatedAtRef.current = null
        sync()
        const safetyInterval = setInterval(sync, SYNC_INTERVAL_MS)
        const updateCheckInterval = setInterval(async () => {
            try {
                const updatedAt = await DispatchDataService.fetchLastUpdatedAt(planDateRef.current)
                if (cancelledRef.current || !updatedAt) return
                const ts = updatedAt.getTime()
                if (lastSeenUpdatedAtRef.current == null || ts > lastSeenUpdatedAtRef.current) {
                    sync()
                }
            } catch {
                // Network blips fall back to the next safety interval tick.
            }
        }, UPDATE_CHECK_INTERVAL_MS)
        return () => {
            cancelledRef.current = true
            clearInterval(safetyInterval)
            clearInterval(updateCheckInterval)
        }
    }, [planDate, enabled, sync])

    return { fileUpdatedAt, isSyncing, lastSyncedAt, refresh: sync }
}
