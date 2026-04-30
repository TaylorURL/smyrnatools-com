import {
    buildHelpTransfers,
    buildInitialPoolByCode,
    cleanString,
    estimatePourMinutes,
    flattenPlanOrders
} from './PlanRuntimeUtility'
import {
    buildAssignmentDriverTimes,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computeSendHomeRows,
    getCalculatedTruckCount,
    poolAtTime,
    timeToMinutes
} from './PlanUtility'

/**
 * Pure helpers for the Plan Realtime view — order-state classification,
 * plant snapshots, KPI rollups, and the upcoming-event feed. Keeps every
 * pool-simulation invocation in one place so the realtime tab and the
 * shared `PlanRuntimeUtility` initial-pool / help-transfer math stay in
 * lockstep.
 */

export const TIME_WINDOW_MIN = 90
const BEHIND_THRESHOLD_YARDS = 1

export const REALTIME_SORT_OPTIONS = [
    { key: 'priority', label: 'Most active first' },
    { key: 'plant', label: 'Plant code' },
    { key: 'pool', label: 'Trucks free (low → high)' },
    { key: 'next', label: 'Soonest next pour' }
]

/** Per-order snapshot. State and progress are cross-referenced with
 *  DetailOrderAnalysis ticket data when available, so "pouring" really
 *  means a truck has loaded for that order — not just that the scheduled
 *  start time has passed.
 *
 *  State transitions on top of the time-based default:
 *    - scheduled-pouring + zero tickets → `not-started`
 *    - scheduled-pouring + loaded ≥ total → `done`
 *    - scheduled-upcoming + tickets exist → `pouring` (started early)
 *    - scheduled-done + tickets exist + loaded < total → kept as `done`
 *      (the dispatch system has moved past the order — flipping it back
 *      to pouring would be noisy)
 */
export const buildOrderSnapshots = ({ flatOrders, poolTimeline, nowMin, detailByOrderId, isToday }) => {
    return flatOrders
        .map((order) => {
            const startMin = timeToMinutes(order?.startTime)
            if (!Number.isFinite(startMin)) return null
            const key = order.orderId || `${order.plantCode ?? 'unknown'}-${startMin}-${order.orderNum ?? ''}`
            const entry = poolTimeline?.[key]
            const endMin = Number.isFinite(entry?.lastReturnMinutes)
                ? entry.lastReturnMinutes
                : startMin + estimatePourMinutes(order)
            const duration = Math.max(1, endMin - startMin)
            const yardage = parseFloat(order.yardage) || 0

            const detail = isToday && order.orderId ? detailByOrderId[order.orderId] : null
            const loaded = detail?.loadedYardage || 0
            const ticketCount = detail?.ticketCount || 0
            const verified = !!detail

            let state = 'upcoming'
            if (nowMin < startMin) state = 'upcoming'
            else if (nowMin >= endMin) state = 'done'
            else state = 'pouring'

            if (verified) {
                if (state === 'pouring' && ticketCount === 0) state = 'not-started'
                else if (state === 'pouring' && yardage > 0 && loaded >= yardage) state = 'done'
                else if (state === 'upcoming' && ticketCount > 0) state = 'pouring'
            }

            let progress = 0
            if (state === 'done') progress = 100
            else if (state === 'pouring') {
                progress =
                    verified && yardage > 0
                        ? Math.min(100, (loaded / yardage) * 100)
                        : Math.min(100, Math.max(0, ((nowMin - startMin) / duration) * 100))
            }

            return {
                customer: cleanString(order.customer),
                endMin,
                loaded,
                order,
                orderKey: key,
                orderNum: cleanString(order.orderNum),
                plantCode: order.plantCode,
                progress,
                startMin,
                state,
                ticketCount,
                truckCount: entry?.truckCount || getCalculatedTruckCount(order) || 0,
                verified,
                yardage
            }
        })
        .filter(Boolean)
}

/** Lift the schedule's pool simulation into the realtime view. Returns
 *  every artifact the view consumes — flat orders, pool timeline, per-
 *  plant timelines, and send-home rows — plus the inputs for downstream
 *  computations. */
export const buildRealtimePoolModel = ({ plantProduction, stats, planDate, assignments }) => {
    const flatOrders = flattenPlanOrders(plantProduction)
    const initialPoolByCode = buildInitialPoolByCode(stats, plantProduction, planDate)
    const helpTransfers = buildHelpTransfers(assignments)
    return {
        flatOrders,
        helpTransfers,
        initialPoolByCode,
        poolTimeline: computePlantPoolTimeline(flatOrders, initialPoolByCode, null, helpTransfers),
        poolTimelinesByPlant: computePlantPoolTimelines(flatOrders, initialPoolByCode, null, helpTransfers),
        sendHomeRows: computeSendHomeRows(flatOrders, initialPoolByCode, null, helpTransfers)
    }
}

/** Per-plant snapshot for the capacity panel. Filters out plants with no
 *  active or upcoming pours and a zero base — they have nothing to render. */
export const buildPlantSnapshots = ({
    stats,
    poolTimelinesByPlant,
    nowMin,
    initialPoolByCode,
    orderSnapshots,
    plantNameByCode,
    sortKey,
    activeFilterCodes,
    filterActive
}) => {
    const out = []
    ;(stats || []).forEach((stat) => {
        if (!stat?.code) return
        if (filterActive && !activeFilterCodes?.has(stat.code)) return
        const timeline = poolTimelinesByPlant?.[stat.code] || []
        const currentPool = poolAtTime(timeline, nowMin)
        const base = initialPoolByCode[stat.code] || 0
        const poolingNow = orderSnapshots.filter((o) => o.state === 'pouring' && o.plantCode === stat.code)
        const dispatched = poolingNow.reduce((acc, order) => acc + (order.truckCount || 0), 0)
        const nextOrder = orderSnapshots
            .filter((o) => o.state === 'upcoming' && o.plantCode === stat.code)
            .sort((a, b) => a.startMin - b.startMin)[0]
        const statusColor =
            currentPool == null ? '#6b7280' : currentPool < 0 ? '#dc2626' : currentPool < 2 ? '#d97706' : '#16a34a'
        if (poolingNow.length === 0 && !nextOrder && base === 0 && dispatched === 0) return
        out.push({
            base,
            code: stat.code,
            dispatched,
            name: plantNameByCode?.[stat.code] || stat.code,
            nextOrder,
            poolNow: currentPool,
            poolingNow,
            statusColor
        })
    })
    return sortPlantSnapshots(out, sortKey)
}

const sortPlantSnapshots = (snapshots, sortKey) => {
    const compareByCode = (a, b) => String(a.code).localeCompare(String(b.code))
    return [...snapshots].sort((a, b) => {
        if (sortKey === 'plant') return compareByCode(a, b)
        if (sortKey === 'pool') {
            const aPool = Number.isFinite(a.poolNow) ? a.poolNow : Infinity
            const bPool = Number.isFinite(b.poolNow) ? b.poolNow : Infinity
            return aPool - bPool || compareByCode(a, b)
        }
        if (sortKey === 'next') {
            const aNext = a.nextOrder ? a.nextOrder.startMin : Infinity
            const bNext = b.nextOrder ? b.nextOrder.startMin : Infinity
            return aNext - bNext || compareByCode(a, b)
        }
        if (a.poolingNow.length !== b.poolingNow.length) return b.poolingNow.length - a.poolingNow.length
        const aHasNext = a.nextOrder ? 1 : 0
        const bHasNext = b.nextOrder ? 1 : 0
        if (aHasNext !== bHasNext) return bHasNext - aHasNext
        return compareByCode(a, b)
    })
}

/** Orders that should have more yards loaded by now than the bridge has
 *  recorded. Only meaningful while looking at today (the bridge only
 *  refreshes today's detail files every cycle) and only for orders that
 *  have actually started. */
export const buildRunningBehindRows = ({ isToday, orderSnapshots, detailByOrderId, nowMin, passesPlant }) => {
    if (!isToday) return []
    const rows = []
    for (const snap of orderSnapshots) {
        if (snap.state !== 'pouring') continue
        if (!passesPlant(snap)) continue
        const total = snap.yardage || 0
        if (total <= 0) continue
        const detail = snap.order.orderId ? detailByOrderId[snap.order.orderId] : null
        const loaded = detail?.loadedYardage || 0
        const elapsed = Math.max(0, nowMin - snap.startMin)
        const duration = Math.max(1, snap.endMin - snap.startMin)
        const expected = Math.min(total, (elapsed / duration) * total)
        const behindBy = expected - loaded
        if (behindBy < BEHIND_THRESHOLD_YARDS) continue
        // Convert the yardage shortfall back into a time delta against the
        // schedule's pour rate so dispatchers see "we're 18 min behind"
        // instead of "we're short 4.2 yd" — much easier to read at a glance.
        const yardsPerMin = total / duration
        const behindMinutes = yardsPerMin > 0 ? Math.round(behindBy / yardsPerMin) : 0
        if (behindMinutes < 1) continue
        rows.push({
            behindMinutes,
            customer: snap.customer,
            expected,
            loaded,
            orderKey: snap.orderKey,
            orderNum: snap.orderNum,
            plantCode: snap.plantCode,
            startMin: snap.startMin,
            ticketCount: detail?.ticketCount || 0,
            total
        })
    }
    return rows.sort((a, b) => b.behindMinutes - a.behindMinutes)
}

/** Top-line numbers for the realtime KPI row — trucks in rotation, yards
 *  done / remaining, day progress, active plants. Uses ticket data when
 *  the day is today; falls back to time-based heuristics otherwise. */
export const buildRealtimeKpis = ({ activeOrders, orderSnapshots, plantSnapshots }) => {
    const trucksOut = activeOrders.reduce((acc, order) => acc + (order.truckCount || 0), 0)
    let yardsDone = 0
    let yardsRemainingFromActive = 0
    for (const snap of orderSnapshots) {
        if (snap.state === 'done') {
            yardsDone += snap.verified ? Math.max(snap.loaded, snap.yardage) : snap.yardage
        } else if (snap.state === 'pouring') {
            if (snap.verified) {
                yardsDone += snap.loaded
                yardsRemainingFromActive += Math.max(0, snap.yardage - snap.loaded)
            } else {
                yardsDone += (snap.yardage || 0) * (snap.progress / 100)
                yardsRemainingFromActive += (snap.yardage || 0) * (1 - snap.progress / 100)
            }
        }
    }
    const yardsUpcoming = orderSnapshots
        .filter((order) => order.state === 'upcoming' || order.state === 'not-started')
        .reduce((acc, order) => acc + (order.yardage || 0), 0)
    const yardsTotal = orderSnapshots.reduce((acc, order) => acc + (order.yardage || 0), 0)
    return {
        activePlants: plantSnapshots.filter((p) => p.poolingNow.length > 0).length,
        activePours: activeOrders.length,
        dayProgressPct: yardsTotal > 0 ? Math.round((yardsDone / yardsTotal) * 100) : 0,
        trucksOut,
        yardsDone: Math.round(yardsDone),
        yardsRemaining: Math.round(yardsRemainingFromActive + yardsUpcoming),
        yardsTotal: Math.round(yardsTotal)
    }
}

/** Upcoming-event feed for the next-90-min stream — start, wrap, help,
 *  and clock-out events sorted by time. */
export const buildUpcomingEventFeed = ({ upcomingOrders, activeOrders, upcomingHelp, upcomingSendHome, nowMin }) => {
    const events = []
    upcomingOrders.forEach((order) => {
        events.push({
            color: '#0ea5e9',
            detail: `${order.customer || 'Pour'} · ${order.yardage} yd / ${order.truckCount} trucks`,
            id: `start-${order.orderKey}`,
            kind: 'Start',
            plantCode: order.plantCode,
            time: order.startMin
        })
    })
    activeOrders.forEach((order) => {
        if (order.endMin - nowMin > TIME_WINDOW_MIN) return
        events.push({
            color: '#16a34a',
            detail: `${order.customer || 'Pour'} · ${order.truckCount} trucks freeing up`,
            id: `end-${order.orderKey}`,
            kind: 'Wrap',
            plantCode: order.plantCode,
            time: order.endMin
        })
    })
    upcomingHelp.forEach((help) => {
        events.push({
            color: '#3b82f6',
            detail: `Help arriving from ${help.fromPlant}`,
            id: help.key,
            kind: 'Help',
            plantCode: help.toPlant,
            time: help.time
        })
    })
    upcomingSendHome.forEach((row) => {
        events.push({
            color: '#64748b',
            detail: `Send ${row.count} home`,
            id: `sh-${row.plantCode}-${row.time}`,
            kind: 'Clock-out',
            plantCode: row.plantCode,
            time: row.time
        })
    })
    return events.sort((a, b) => a.time - b.time)
}

/** Inter-plant help arrivals inside the realtime time window. */
export const buildUpcomingHelpRows = ({ assignments, nowMin, touchesFilter }) => {
    const rows = []
    ;(assignments || []).forEach((assignment, idx) => {
        if (!assignment?.fromPlant || !assignment?.toPlant) return
        if (assignment.fromPlant === assignment.toPlant) return
        const home = assignment.returnPlant || assignment.fromPlant
        if (!touchesFilter([assignment.fromPlant, assignment.toPlant, home])) return
        buildAssignmentDriverTimes(assignment).forEach((dt) => {
            if (!Number.isFinite(dt.arriveMin)) return
            if (dt.arriveMin > nowMin && dt.arriveMin - nowMin <= TIME_WINDOW_MIN) {
                rows.push({
                    fromPlant: assignment.fromPlant,
                    key: `up-${idx}-${dt.driverIndex}`,
                    time: dt.arriveMin,
                    toPlant: assignment.toPlant
                })
            }
        })
    })
    return rows.sort((a, b) => a.time - b.time)
}
