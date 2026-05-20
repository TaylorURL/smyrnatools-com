import { useMemo } from 'react'

import { EMPTY_COLOCATION_MAP } from '../../utils/PlantColocationUtility'

/* Help-score thresholds. The ratio is `(given − received) / produced`
 * — positive when a plant contributes more cross-load yardage than it
 * consumes, normalised against its own scheduled production so a small
 * plant carrying a high share doesn't get washed out by larger plants.
 *
 * Scale tuned for typical day-of-week variance: ±3% is "balanced",
 * ±10% is "heavy" in either direction. Plants with no production data
 * (e.g. a satellite that only ever loaded out, never booked orders)
 * fall through to a 3-star "balanced" score so we don't pretend to
 * know more than we do. */
const HELP_SCORE_BANDS = [
    { min: 0.1, score: 5 },
    { min: 0.03, score: 4 },
    { min: -0.03, score: 3 },
    { min: -0.1, score: 2 }
]

function computeHelpScore(givenYardage, receivedYardage, producedYardage) {
    const totalActivity = (givenYardage || 0) + (receivedYardage || 0)
    /* No help in either direction → no score. The renderer surfaces
     * this as an em-dash so a plant that simply didn't participate
     * isn't conflated with a balanced participant. */
    if (totalActivity === 0) return null
    if (!Number.isFinite(producedYardage) || producedYardage <= 0) return 3
    const net = (givenYardage || 0) - (receivedYardage || 0)
    const ratio = net / producedYardage
    for (const band of HELP_SCORE_BANDS) {
        if (ratio >= band.min) return band.score
    }
    return 1
}

/**
 * Derives "how much is each plant helping other plants" — bucketed by the
 * two delivery mechanisms the operation actually uses:
 *
 *   1. **Planned deadhead trips** — drivers the dispatcher routed from
 *      one plant to another WITHOUT loading at the source first. Pulled
 *      from `plans.assignments` where `loadFromPlant !== true`. Direct-
 *      load assignments are not "help" in this sense — they're just a
 *      logistics choice for a single order — so they're excluded.
 *   2. **Actual cross-loaded tickets** — tickets in dispatch data where
 *      the loading plant differs from the order's home plant. Pulled
 *      from the pre-merged `detailByDay` map.
 *
 * Returns one row per giver plant with both methods rolled up, and the
 * per-recipient breakdown inside each row so the table can render "Plant
 * A gave 12 drivers to Baytown + 3 to Freeport, and loaded 245 yd³ for
 * Baytown" without re-pivoting on the consumer side.
 *
 * @param {Object} args
 * @param {Object} args.plansByDate         `{ planDate: planRow }` — for assignments
 * @param {Object} args.detailByDay         `{ planDate: { orderId: detail } }`
 * @param {Array}  args.flatOrders          `[{ order, planDate, plantCode }]` — every live
 *                                          order in the window tagged with its home plant
 *                                          (the plant_production key). Source of truth
 *                                          for "which plant owns this order".
 * @param {Object} args.range               `{ current: { start, end } }`
 * @param {string|null} args.selectedPlant  Plant filter — applies to BOTH sides
 *                                          (a row passes when the giver OR
 *                                          any recipient is the selected plant).
 * @param {Object} [args.colocationMap]     ColocationMap from `usePlanLookups`.
 *                                          Same-site work (e.g. 404 loading a
 *                                          403 order) is collapsed so the
 *                                          numbers reflect real movement.
 *                                          Defaults to a no-op map when omitted.
 * @param {Object} [args.plantNameByCode]   `{ plant_code: name }` lookup
 *                                          from `usePlanLookups`. Used as the
 *                                          authoritative roster of region-
 *                                          scoped plants — every plant in
 *                                          this map gets a row in the result,
 *                                          even if it had no help activity in
 *                                          the window. Without it the table
 *                                          only surfaces plants that actually
 *                                          gave or received help, which makes
 *                                          quiet periods read like missing
 *                                          data.
 */
export function useHelpCrossLoadingStats({
    plansByDate = {},
    detailByDay = {},
    flatOrders = [],
    range,
    selectedPlant = null,
    colocationMap = EMPTY_COLOCATION_MAP,
    plantNameByCode = {}
}) {
    const resolvePrimary = colocationMap?.resolvePrimary || EMPTY_COLOCATION_MAP.resolvePrimary
    /* ── 1. Pair-level facts ─────────────────────────────────────────
     * Walk both sources once each and bucket into a `(giver, recipient)`
     * key. Pair-level aggregation is the natural shape because both
     * methods carry a direction. The plant-level rollup (step 2) just
     * sums these by giver. */
    const pairFacts = useMemo(() => {
        const startIso = range?.current?.start
        const endIso = range?.current?.end
        const map = new Map()
        const key = (giver, recipient) => `${giver}→${recipient}`
        const ensure = (giver, recipient) => {
            const k = key(giver, recipient)
            if (!map.has(k)) {
                map.set(k, {
                    crossLoadOrderIds: new Set(),
                    crossLoadTickets: 0,
                    crossLoadYardage: 0,
                    deadheadDrivers: 0,
                    deadheadPlanDates: new Set(),
                    deadheadTrips: 0,
                    giver,
                    recipient
                })
            }
            return map.get(k)
        }

        /* Deadhead side — `plans.assignments` rows. Each from/to is
         * resolved to its co-location primary first so a 403→404
         * assignment collapses (same site = not real help). */
        Object.entries(plansByDate || {}).forEach(([planDate, planRow]) => {
            const assignments = Array.isArray(planRow?.assignments) ? planRow.assignments : []
            assignments.forEach((a) => {
                if (a?.loadFromPlant === true) return
                const fromPlant = resolvePrimary(a?.fromPlant)
                const toPlant = resolvePrimary(a?.toPlant)
                if (!fromPlant || !toPlant || fromPlant === toPlant) return
                const driverCount = parseInt(a?.driverCount, 10) || 0
                if (driverCount <= 0) return
                const entry = ensure(fromPlant, toPlant)
                entry.deadheadDrivers += driverCount
                entry.deadheadTrips += 1
                entry.deadheadPlanDates.add(planDate)
            })
        })

        /* Cross-load side — actual ticket data. Build the order →
         * home-plant lookup from `flatOrders`, which tags each order
         * with the plant code it lives under in `plant_production` (the
         * order objects themselves don't carry that field). */
        const orderMeta = new Map()
        flatOrders.forEach(({ order, plantCode, planDate }) => {
            if (!order?.orderId) return
            const homePlant = resolvePrimary(plantCode)
            if (!homePlant) return
            orderMeta.set(order.orderId, { homePlant, planDate })
        })

        Object.entries(detailByDay || {}).forEach(([dayIso, dayMap]) => {
            if (!dayMap) return
            if (startIso && endIso && (dayIso < startIso || dayIso > endIso)) return
            Object.entries(dayMap).forEach(([orderId, detail]) => {
                const meta = orderMeta.get(orderId)
                if (!meta?.homePlant) return
                const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
                tickets.forEach((ticket) => {
                    const loaderPlant = resolvePrimary(ticket?.plantId)
                    if (!loaderPlant) return
                    if (loaderPlant === meta.homePlant) return
                    const entry = ensure(loaderPlant, meta.homePlant)
                    entry.crossLoadTickets += 1
                    entry.crossLoadYardage += parseFloat(ticket?.quantity) || 0
                    entry.crossLoadOrderIds.add(orderId)
                })
            })
        })

        return Array.from(map.values()).map((entry) => ({
            ...entry,
            crossLoadOrderIds: undefined,
            crossLoadOrders: entry.crossLoadOrderIds.size,
            deadheadPlanDateCount: entry.deadheadPlanDates.size,
            deadheadPlanDates: undefined
        }))
    }, [plansByDate, detailByDay, flatOrders, range, resolvePrimary])

    /* ── 2a. Plant-level production totals ────────────────────────────
     * Used by the help score so a small plant that gives a lot weighs
     * differently than a large plant giving the same absolute number.
     * Sums every flat-order's yardage to its co-location primary so
     * 403 + 404 → one bucket. */
    const producedYardageByPlant = useMemo(() => {
        const out = new Map()
        flatOrders.forEach(({ order, plantCode }) => {
            const primary = resolvePrimary(plantCode)
            if (!primary) return
            out.set(primary, (out.get(primary) || 0) + (parseFloat(order?.yardage) || 0))
        })
        return out
    }, [flatOrders, resolvePrimary])

    /* ── 2. Roll up to one row per giver plant ───────────────────────
     * The presentation primary key is the plant doing the helping. Each
     * row carries the totals plus the recipient-level breakdown so the
     * UI can read "Plant A → B + C + D" without another pivot. */
    const helpByGiverPlant = useMemo(() => {
        const byGiver = new Map()
        const ensureGiver = (code) => {
            if (!code) return null
            if (!byGiver.has(code)) {
                byGiver.set(code, {
                    code,
                    crossLoadOrders: 0,
                    crossLoadTickets: 0,
                    crossLoadYardage: 0,
                    deadheadDrivers: 0,
                    deadheadPlanDateCount: 0,
                    deadheadTrips: 0,
                    recipients: []
                })
            }
            return byGiver.get(code)
        }
        /* Pre-seed every plant in the region-scoped roster so the
         * table reads as a directory of plants — quiet plants stay
         * visible with zero metrics instead of vanishing. Each code is
         * resolved through the co-location map so 403/404 collapse to
         * one entry keyed on the primary. */
        Object.keys(plantNameByCode || {}).forEach((code) => {
            const primary = resolvePrimary(code)
            if (primary) ensureGiver(primary)
        })

        /* Received-side tally per plant — sum of cross-load yardage
         * other plants loaded for THIS plant's orders. Needed for the
         * help score. */
        const receivedByPlant = new Map()
        pairFacts.forEach((pair) => {
            const entry = ensureGiver(pair.giver)
            if (!entry) return
            entry.crossLoadOrders += pair.crossLoadOrders
            entry.crossLoadTickets += pair.crossLoadTickets
            entry.crossLoadYardage += pair.crossLoadYardage
            entry.deadheadDrivers += pair.deadheadDrivers
            entry.deadheadTrips += pair.deadheadTrips
            entry.deadheadPlanDateCount = Math.max(entry.deadheadPlanDateCount, pair.deadheadPlanDateCount)
            entry.recipients.push({
                code: pair.recipient,
                crossLoadOrders: pair.crossLoadOrders,
                crossLoadTickets: pair.crossLoadTickets,
                crossLoadYardage: pair.crossLoadYardage,
                deadheadDrivers: pair.deadheadDrivers,
                deadheadTrips: pair.deadheadTrips
            })
            receivedByPlant.set(pair.recipient, (receivedByPlant.get(pair.recipient) || 0) + pair.crossLoadYardage)
        })
        return (
            Array.from(byGiver.values())
                .map((entry) => {
                    const receivedYardage = receivedByPlant.get(entry.code) || 0
                    const producedYardage = producedYardageByPlant.get(entry.code) || 0
                    return {
                        ...entry,
                        helpScore: computeHelpScore(entry.crossLoadYardage, receivedYardage, producedYardage),
                        producedYardage,
                        receivedYardage,
                        recipients: entry.recipients
                            .filter((r) => r.deadheadDrivers > 0 || r.crossLoadTickets > 0)
                            /* Sort recipients by combined contribution — yardage
                             * is the dominant signal so it leads, then
                             * deadhead drivers, then code for a stable
                             * tiebreaker. */
                            .sort((a, b) => {
                                if (b.crossLoadYardage !== a.crossLoadYardage)
                                    return b.crossLoadYardage - a.crossLoadYardage
                                if (b.deadheadDrivers !== a.deadheadDrivers)
                                    return b.deadheadDrivers - a.deadheadDrivers
                                return a.code.localeCompare(b.code)
                            })
                    }
                })
                /* Plant filter resolves through the co-location map so
                 * selecting "404" matches the "403" combined row (and
                 * vice versa). The zero-activity filter is intentionally
                 * GONE — quiet plants now stay visible so the dispatcher
                 * sees their full region roster, not just whoever moved
                 * trucks this period. */
                .filter((entry) => {
                    if (!selectedPlant) return true
                    const targetPrimary = resolvePrimary(selectedPlant)
                    if (!targetPrimary) return true
                    if (entry.code === targetPrimary) return true
                    return entry.recipients.some((r) => r.code === targetPrimary)
                })
                /* Sorted by plant code ascending so the table reads in a
                 * predictable order regardless of which plants happen to
                 * have the most activity this period. */
                .sort((a, b) => a.code.localeCompare(b.code))
        )
    }, [pairFacts, selectedPlant, resolvePrimary, producedYardageByPlant, plantNameByCode])

    /* ── 3. Headline KPIs — totals across every giver ─────────────────
     * Same numbers a dispatcher would tally from the table, surfaced at
     * the top so the page reads top-down. Period-scoped via `range` */
    const kpi = useMemo(() => {
        let deadheadDrivers = 0
        let deadheadTrips = 0
        let crossLoadTickets = 0
        let crossLoadYardage = 0
        const giverPlants = new Set()
        const recipientPlants = new Set()
        helpByGiverPlant.forEach((entry) => {
            deadheadDrivers += entry.deadheadDrivers
            deadheadTrips += entry.deadheadTrips
            crossLoadTickets += entry.crossLoadTickets
            crossLoadYardage += entry.crossLoadYardage
            giverPlants.add(entry.code)
            entry.recipients.forEach((r) => recipientPlants.add(r.code))
        })
        return {
            crossLoadTickets,
            crossLoadYardage,
            deadheadDrivers,
            deadheadTrips,
            giverPlantCount: giverPlants.size,
            recipientPlantCount: recipientPlants.size
        }
    }, [helpByGiverPlant])

    return {
        helpByGiverPlant,
        kpi
    }
}

export default useHelpCrossLoadingStats
