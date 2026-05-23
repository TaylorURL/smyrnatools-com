import { useEffect, useMemo, useState } from 'react'

import { ScheduleSnapshotService } from '../../services/ScheduleSnapshotService'
import { EMPTY_COLOCATION_MAP } from '../../utils/PlantColocationUtility'
import { isCancelledOrder } from '../../utils/PlanUtility'
import { diffScheduleAgainstSnapshot } from '../../utils/ScheduleDiffUtility'

/* Fields that count as a "move" — startTime is the headline, but a plant
 * reassignment or a same-time bump from one plant to another reads the same
 * way operationally (the customer's pour got shuffled). Everything else
 * is an "edit" (yardage tweak, address fix, contact change, etc.). */
const MOVE_FIELDS = new Set(['startTime', 'plantCode'])

const EMPTY_RESULT = {
    customers: [],
    daysAnalyzed: 0,
    daysWithSnapshot: 0,
    isLoading: false,
    kpi: {
        cancelCount: 0,
        cancelRate: 0,
        churnRate: 0,
        customersTracked: 0,
        editCount: 0,
        moveCount: 0,
        totalOrders: 0
    }
}

const trim = (value) => (value == null ? '' : String(value).trim())

/** Distinguish a move that pulled the start earlier from one that pushed it
 *  later. Returns `null` when the time can't be parsed on either side or the
 *  field didn't actually shift in real terms. */
function classifyTimeShift(change) {
    if (!change || change.field !== 'startTime') return null
    const toMinutes = (value) => {
        const match = String(value || '')
            .trim()
            .match(/^(\d{1,2}):(\d{2})$/)
        if (!match) return null
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
    }
    const before = toMinutes(change.before)
    const after = toMinutes(change.after)
    if (before == null || after == null || before === after) return null
    return after < before ? 'earlier' : 'later'
}

/** Anchor every event to a customer. Job number is the strongest stable
 *  identifier across moves (the dispatcher renames things less often than
 *  they change the customer label) — fall back to customer name when no
 *  job number is set. Empty / missing keys are skipped by callers. */
function buildCustomerKey(order) {
    const name = trim(order?.customer)
    if (!name) return null
    return { display: name, key: name.toUpperCase() }
}

function ensureBucket(map, customer) {
    if (!map.has(customer.key)) {
        map.set(customer.key, {
            cancelCount: 0,
            displayName: customer.display,
            editCount: 0,
            events: [],
            lastEventDate: '',
            moveCount: 0,
            moveDirection: { earlier: 0, later: 0 },
            orderIds: new Set()
        })
    }
    return map.get(customer.key)
}

/**
 * Derives per-customer churn statistics for the Statistics → Moves &
 * Cancels sub-page. Compares each day's 5:30 PM schedule snapshot against
 * the live schedule for the same day, then rolls every move / cancel /
 * edit up to the customer that owned the order.
 *
 * Three event kinds drive the leaderboard:
 *
 *   - **cancel** — order was present in the 5:30 PM snapshot and is no
 *     longer on the live schedule, OR the live order ended up parked at
 *     the cancellation sentinel start time. Both shapes are the same
 *     operational outcome (the truck never rolled).
 *   - **move** — order is on both sides, but the start time or the plant
 *     code shifted. The move direction (earlier / later) is captured for
 *     start-time changes so dispatch can see who keeps pulling up vs.
 *     who keeps pushing back.
 *   - **edit** — order is on both sides and the snapshot disagrees on a
 *     non-move field (yardage, address, contact, etc.). Tracked for
 *     context but does not drive the headline ranking.
 *
 * Attribution lands on the **customer** — moves and cancels are
 * customer-side behaviours, not a plant / driver failure.
 *
 * @param {Object}   args
 * @param {Object}   args.colocationMap   Plant alias resolver (currently
 *                                        unused — kept for parity with the
 *                                        other stats hooks so callers can
 *                                        pass the shared map.)
 * @param {Array}    args.currentRows     `plans` rows for the active range
 *                                        — each is `{ plan_date,
 *                                        plant_production }`.
 * @param {boolean}  args.enabled         Hook is a no-op until the
 *                                        sub-page mounts.
 * @param {string|null} args.selectedPlant Plant filter applied at the
 *                                         event level — only orders whose
 *                                         live OR snapshot plant code
 *                                         matches the filter contribute.
 */
export function useMovesCancelsStats({
    colocationMap = EMPTY_COLOCATION_MAP,
    currentRows = [],
    enabled = false,
    selectedPlant = null
}) {
    const dateKeys = useMemo(() => {
        if (!enabled) return []
        return (currentRows || [])
            .map((row) => trim(row?.plan_date))
            .filter(Boolean)
            .sort()
    }, [currentRows, enabled])

    const dateKeysSerialized = dateKeys.join('|')

    const [snapshotsByDate, setSnapshotsByDate] = useState({})
    const [isLoading, setIsLoading] = useState(false)

    /* Fan out snapshot fetches in parallel — the service caches per-page so
     * re-mounting the tab or shifting the range doesn't re-hit the edge
     * function for days we've already seen. `null` results (no snapshot
     * for that date) are stored so we don't retry them. */
    useEffect(() => {
        if (!enabled || dateKeys.length === 0) {
            setSnapshotsByDate({})
            setIsLoading(false)
            return undefined
        }
        let cancelled = false
        setIsLoading(true)
        ;(async () => {
            const entries = await Promise.all(
                dateKeys.map(async (date) => [date, await ScheduleSnapshotService.getSnapshot(date)])
            )
            if (cancelled) return
            const next = {}
            for (const [date, snapshot] of entries) next[date] = snapshot
            setSnapshotsByDate(next)
            setIsLoading(false)
        })()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateKeysSerialized, enabled])

    return useMemo(() => {
        if (!enabled) return EMPTY_RESULT
        if (!dateKeys.length) return { ...EMPTY_RESULT, isLoading }

        const resolvePrimary = colocationMap?.resolvePrimary || EMPTY_COLOCATION_MAP.resolvePrimary
        const plantMatches = (rawCode) => {
            if (!selectedPlant) return true
            return resolvePrimary(rawCode) === resolvePrimary(selectedPlant)
        }

        const customerBuckets = new Map()
        let totalOrders = 0
        let cancelCount = 0
        let moveCount = 0
        let editCount = 0
        let daysWithSnapshot = 0

        for (const row of currentRows) {
            const date = trim(row?.plan_date)
            if (!date) continue
            const snapshot = snapshotsByDate[date]
            if (!snapshot) continue
            daysWithSnapshot += 1

            const diff = diffScheduleAgainstSnapshot(snapshot, row.plant_production || {})

            /* Removed since snapshot — pure cancel. */
            for (const entry of diff.removed) {
                const order = entry.snapshotOrder
                if (!plantMatches(entry.plantCode || order?.plantCode)) continue
                const customer = buildCustomerKey(order)
                if (!customer) continue
                const bucket = ensureBucket(customerBuckets, customer)
                bucket.cancelCount += 1
                bucket.events.push({
                    date,
                    kind: 'cancel',
                    orderId: trim(order?.orderId),
                    orderNum: trim(order?.orderNum),
                    plantCode: resolvePrimary(entry.plantCode || order?.plantCode),
                    snapshotPlant: resolvePrimary(order?.plantCode),
                    snapshotTime: trim(order?.startTime),
                    yardage: parseFloat(order?.yardage) || 0
                })
                if (date > bucket.lastEventDate) bucket.lastEventDate = date
                bucket.orderIds.add(trim(order?.orderId))
                cancelCount += 1
            }

            /* Changed — bucket time/plant shifts as moves, other tracked
             * field changes as edits. */
            for (const entry of diff.changed) {
                const order = entry.liveOrder
                if (!plantMatches(entry.plantCode || order?.plantCode)) continue
                const customer = buildCustomerKey(order)
                if (!customer) continue
                const bucket = ensureBucket(customerBuckets, customer)

                const moveChanges = entry.changes.filter((c) => MOVE_FIELDS.has(c.field))
                const editChanges = entry.changes.filter((c) => !MOVE_FIELDS.has(c.field))

                if (moveChanges.length > 0) {
                    bucket.moveCount += 1
                    moveCount += 1
                    const timeChange = moveChanges.find((c) => c.field === 'startTime')
                    const direction = classifyTimeShift(timeChange)
                    if (direction === 'earlier') bucket.moveDirection.earlier += 1
                    else if (direction === 'later') bucket.moveDirection.later += 1
                    bucket.events.push({
                        date,
                        edits: editChanges,
                        kind: 'move',
                        moves: moveChanges,
                        orderId: trim(order?.orderId),
                        orderNum: trim(order?.orderNum),
                        plantCode: resolvePrimary(entry.plantCode || order?.plantCode),
                        snapshotPlant: resolvePrimary(entry.snapshotOrder?.plantCode),
                        snapshotTime: trim(entry.snapshotOrder?.startTime),
                        timeDirection: direction,
                        yardage: parseFloat(order?.yardage) || 0
                    })
                } else if (editChanges.length > 0) {
                    bucket.editCount += 1
                    editCount += 1
                    bucket.events.push({
                        date,
                        edits: editChanges,
                        kind: 'edit',
                        orderId: trim(order?.orderId),
                        orderNum: trim(order?.orderNum),
                        plantCode: resolvePrimary(entry.plantCode || order?.plantCode),
                        yardage: parseFloat(order?.yardage) || 0
                    })
                }
                if (date > bucket.lastEventDate) bucket.lastEventDate = date
                bucket.orderIds.add(trim(order?.orderId))
            }

            /* Live-side cancellation sentinel — order is on both sides but
             * the dispatcher parked the start time at the cancel marker.
             * Counts as a cancel too, layered on top of any move/edit. */
            for (const entry of [...diff.changed, ...diff.unchanged]) {
                const order = entry.liveOrder
                if (!isCancelledOrder(order)) continue
                if (!plantMatches(entry.plantCode || order?.plantCode)) continue
                const customer = buildCustomerKey(order)
                if (!customer) continue
                const bucket = ensureBucket(customerBuckets, customer)
                bucket.cancelCount += 1
                bucket.events.push({
                    date,
                    kind: 'cancel',
                    orderId: trim(order?.orderId),
                    orderNum: trim(order?.orderNum),
                    plantCode: resolvePrimary(entry.plantCode || order?.plantCode),
                    snapshotPlant: resolvePrimary(entry.snapshotOrder?.plantCode || order?.plantCode),
                    snapshotTime: trim(entry.snapshotOrder?.startTime || order?.startTime),
                    yardage: parseFloat(order?.yardage) || 0
                })
                if (date > bucket.lastEventDate) bucket.lastEventDate = date
                bucket.orderIds.add(trim(order?.orderId))
                cancelCount += 1
            }

            /* Total-order denominator — every live order owned by a known
             * customer that survives the plant filter, plus snapshot-only
             * (i.e. removed) orders so customers who got 100% wiped still
             * have a positive denominator. */
            for (const entry of [...diff.added, ...diff.changed, ...diff.unchanged]) {
                const order = entry.liveOrder
                if (!plantMatches(entry.plantCode || order?.plantCode)) continue
                const customer = buildCustomerKey(order)
                if (!customer) continue
                const bucket = ensureBucket(customerBuckets, customer)
                bucket.orderIds.add(trim(order?.orderId))
                totalOrders += 1
            }
            for (const entry of diff.removed) {
                const order = entry.snapshotOrder
                if (!plantMatches(entry.plantCode || order?.plantCode)) continue
                const customer = buildCustomerKey(order)
                if (!customer) continue
                const bucket = ensureBucket(customerBuckets, customer)
                bucket.orderIds.add(trim(order?.orderId))
                totalOrders += 1
            }
        }

        const customers = [...customerBuckets.entries()]
            .map(([key, bucket]) => {
                const orderCount = bucket.orderIds.size || 1
                const churnEvents = bucket.cancelCount + bucket.moveCount
                return {
                    cancelCount: bucket.cancelCount,
                    cancelRate: orderCount > 0 ? bucket.cancelCount / orderCount : 0,
                    churnEvents,
                    churnRate: orderCount > 0 ? churnEvents / orderCount : 0,
                    editCount: bucket.editCount,
                    events: bucket.events.sort((a, b) => b.date.localeCompare(a.date)),
                    key,
                    lastEventDate: bucket.lastEventDate,
                    moveCount: bucket.moveCount,
                    moveDirection: bucket.moveDirection,
                    moveRate: orderCount > 0 ? bucket.moveCount / orderCount : 0,
                    name: bucket.displayName,
                    orderCount
                }
            })
            .filter((c) => c.cancelCount + c.moveCount + c.editCount > 0)

        return {
            customers,
            daysAnalyzed: dateKeys.length,
            daysWithSnapshot,
            isLoading,
            kpi: {
                cancelCount,
                cancelRate: totalOrders > 0 ? cancelCount / totalOrders : 0,
                churnRate: totalOrders > 0 ? (cancelCount + moveCount) / totalOrders : 0,
                customersTracked: customers.length,
                editCount,
                moveCount,
                totalOrders
            }
        }
    }, [enabled, dateKeys, currentRows, snapshotsByDate, selectedPlant, colocationMap, isLoading])
}

export default useMovesCancelsStats
