import React, { useCallback, useMemo, useState } from 'react'

import { PlantBadge } from '../../../app/components/plan/PlanScheduleBadges'
import PlanScheduleFilterDrawer from '../../../app/components/plan/PlanScheduleFilterDrawer'
import PlanScheduleOrderCard from '../../../app/components/plan/PlanScheduleOrderCard'
import PlanScheduleSideRail from '../../../app/components/plan/PlanScheduleSideRail'
import PlanScheduleStatStrip from '../../../app/components/plan/PlanScheduleStatStrip'
import PlanScheduleTable from '../../../app/components/plan/PlanScheduleTable'
import JobMapModal from '../../../app/components/schedule/JobMapModal'
import useCloserPlantLookup from '../../../app/hooks/useCloserPlantLookup'
import { useDetailOrders } from '../../../app/hooks/useDetailOrders'
import useLiveMinuteOfDay from '../../../app/hooks/useLiveMinuteOfDay'
import useLiveTravelTimes from '../../../app/hooks/useLiveTravelTimes'
import usePlanTravelPairs from '../../../app/hooks/usePlanTravelPairs'
import { formatOrderAddress } from '../../../utils/AddressUtility'
import {
    buildHelpRows,
    buildHelpTransfers,
    clean,
    compareOrders,
    evaluateOrderService,
    evaluateScheduleSatisfaction,
    extractCityFromFullAddress,
    getOrderStatus,
    parseHhmmToMinutes,
    sumField,
    VIEW_MODES
} from '../../../utils/PlanScheduleUtility'
import {
    computeClockInRows,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computePullUpRows,
    computeSendHomeRows,
    computeSuggestedSlots,
    formatMinutesClock,
    getCalculatedTruckCount,
    getEffectiveBase,
    getMissingOperators,
    getOffsetDate,
    getPoolDayMultiplier,
    getTodayDate,
    isClosedDay,
    isExcludedOrder,
    PLAN_META_KEY,
    timeToMinutes
} from '../../../utils/PlanUtility'

const composeAddress = (order) => formatOrderAddress(order, ', ')

/** Sum real-pour yardage across a day's `plant_production` object — mirrors
 *  the liveOrders filter (excludes cancelled + test sentinel orders). */
const sumDayYardage = (production) => {
    if (!production || typeof production !== 'object') return 0
    let sum = 0
    Object.entries(production).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY) return
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        list.forEach((o) => {
            if (isExcludedOrder(o)) return
            sum += parseFloat(o?.yardage) || 0
        })
    })
    return sum
}

/**
 * Schedule view — flat, filterable, sortable table (or grouped cards) of every
 * order pulled from the Daily Order Listing HTML import. Dispatchers can
 * narrow by plant, customer, product, time bucket, truck class, minimum
 * yardage, and a free-text search across customer/address/PO.
 */
function PlanScheduleView({
    accentColor,
    adjacentProduction = {},
    assignments = [],
    getTravelTime,
    isMobile = false,
    onSwitchToPlanner,
    planDate,
    plantAddressByCode,
    plantNameByCode,
    plantProduction,
    stats = []
}) {
    const poolDayMultiplier = getPoolDayMultiplier(planDate)
    const plantsClosed = isClosedDay(planDate)
    const isSaturday = poolDayMultiplier === 0.5
    /* "Same-day" badge gating — the 15:00 sentinel only means "same day" when
     * the schedule being viewed is actually today; on past/future schedules a
     * real 3:00 PM start is legitimate, so suppress the badge there. */
    const isViewingToday = planDate === getTodayDate()
    /** Per-order ticket data from DetailOrderAnalysis reports. Keyed by
     *  orderId; values are merged across all plant files for the date. */
    const detailByOrderId = useDetailOrders(planDate, plantProduction)
    /** Fallback city lookup: when an order's city is blank, we use the plant's
     *  city so the map/geocoder still lands near the right area. */
    const plantCityByCode = useMemo(() => {
        const out = {}
        Object.entries(plantAddressByCode || {}).forEach(([code, addr]) => {
            const city = extractCityFromFullAddress(addr)
            if (city) out[code] = city
        })
        return out
    }, [plantAddressByCode])

    const plantOptionsForMap = useMemo(() => {
        const codes = new Set([...Object.keys(plantAddressByCode || {}), ...Object.keys(plantNameByCode || {})])
        return Array.from(codes).map((code) => ({
            address: plantAddressByCode?.[code] || '',
            code,
            name: plantNameByCode?.[code] || ''
        }))
    }, [plantAddressByCode, plantNameByCode])

    const [query, setQuery] = useState('')
    const [plantFilter, setPlantFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [productFilter, setProductFilter] = useState('all')
    const [minYards, setMinYards] = useState('')
    const [sortKey, setSortKey] = useState('plantThenTime')
    /** When the schedule is filtered to a single plant we interleave synthetic
     *  rows (truck returns, help events, send-home recommendations, open-slot
     *  suggestions, trade-offs). Those rows only make sense chronologically,
     *  so turning them ON forces a time-based sort; turning them OFF lets the
     *  Sort by picker actually reorder the table. Default off so the sort
     *  controls work immediately — dispatchers opt-in to the extras. */
    const [showExtraRows, setShowExtraRows] = useState(false)
    // Mobile is always cards (the 12-column table needs hundreds of px to read).
    const [viewMode, setViewMode] = useState(isMobile ? 'cards' : 'table')
    const [mapOrder, setMapOrder] = useState(null)
    // Filter drawer is collapsed by default on mobile so the schedule fills the screen.
    const [filtersOpen, setFiltersOpen] = useState(!isMobile)

    /** Flat list of every order with plantCode attached. */
    const allOrders = useMemo(() => {
        const out = []
        Object.entries(plantProduction || {}).forEach(([code, data]) => {
            if (code === PLAN_META_KEY) return
            if (!Array.isArray(data?.orders)) return
            data.orders.forEach((o) => out.push({ ...o, plantCode: code }))
        })
        return out
    }, [plantProduction])

    const plantOptions = useMemo(() => {
        const codes = new Set(allOrders.map((o) => o.plantCode))
        return Array.from(codes).sort()
    }, [allOrders])

    /* Live travel + closer-plant chain. Each hook only reads what it needs;
     * the pair list comes first (no live data required), then the prefetch
     * hook turns it into a `getMinutes` lookup, then the closer-plant memo
     * compares per-job. Linear, no circular call, no stub callbacks. */
    const closerPlantInputs = useMemo(
        () => ({ allOrders, plantCityByCode, plantOptionsForMap }),
        [allOrders, plantCityByCode, plantOptionsForMap]
    )
    const travelPairs = usePlanTravelPairs(closerPlantInputs)
    const { getMinutes: getLiveTravelMinutes } = useLiveTravelTimes(travelPairs)
    const { getCloserPlantForOrder } = useCloserPlantLookup({ ...closerPlantInputs, getLiveTravelMinutes })

    /** Travel overrides for an order — pulls live Google minutes when we have
     *  them, otherwise falls back to letting the helper use the order's own
     *  `toJobTime` field from the dispatch report. */
    const getTravelOverrides = useCallback(
        (order) => {
            // Match the travel-pair key which uses the plant's city as a
            // fallback when dispatch didn't enter one on the order.
            const fallbackCity = clean(order.city) ? '' : plantCityByCode?.[order.plantCode] || ''
            const orderForKey = fallbackCity ? { ...order, city: fallbackCity } : order
            const key = `${order.plantCode}::${composeAddress(orderForKey)}`
            const mins = getLiveTravelMinutes(key)
            if (!Number.isFinite(mins)) return undefined
            return { toJobMin: mins, toPlantMin: mins }
        },
        [getLiveTravelMinutes, plantCityByCode]
    )

    /** Canonical orderKey, mirroring what `computePlantPoolTimeline` builds. */
    const keyForOrder = useCallback((order) => {
        if (order.orderId) return order.orderId
        const mins = timeToMinutes(order?.startTime)
        return `${order.plantCode ?? 'unknown'}-${mins}-${order.orderNum ?? ''}`
    }, [])

    /** Per-plant pool breakdown — surfaced in the Trucks column tooltip so the
     *  dispatcher can see where a plant's starting number comes from.
     *  `starting` is still the effective count (base − send + recv) because
     *  that's what reads cleanly in the tooltip; actual pool timing is now
     *  driven by help-transfer events below. */
    const poolSourceByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const rawBase = Number.isFinite(s.base) ? s.base : 0
            const missing = getMissingOperators(plantProduction, s.code)
            const base = getEffectiveBase(rawBase, s.code, plantProduction, planDate)
            const send = Number.isFinite(s.send) ? s.send : 0
            const recv = Number.isFinite(s.recv) ? s.recv : 0
            out[s.code] = { base, missing, rawBase, recv, send, starting: base - send + recv }
        })
        return out
    }, [stats, plantProduction, planDate])

    /** Effective base operator count per plant — accounts for day-of-week
     *  multiplier and any missing-operator markers. Used as both the cap on
     *  clock-ins and the historical "starts at full" pool for plants that
     *  don't have any orders to model clock-in timing against. */
    const baseByPlant = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const base = Number.isFinite(s.base) ? s.base : 0
            out[s.code] = getEffectiveBase(base, s.code, plantProduction, planDate)
        })
        return out
    }, [stats, plantProduction, planDate])

    /** Operator clock-in events per plant. Operators don't sit in the pool
     *  at midnight — they clock in just-in-time for the orders that need
     *  them, staggered by each order's truck-spacing. The simulator treats
     *  these as positive-delta inbound transfers, and the schedule renders
     *  them as `clockIn` rows when extras are enabled. */
    const clockInRows = useMemo(
        () => computeClockInRows(allOrders, baseByPlant, getTravelOverrides),
        [allOrders, baseByPlant, getTravelOverrides]
    )

    /** Operator clock-in roster for the currently filtered plant — sorted
     *  earliest first, then padded out to the plant's raw base count with
     *  "off" rows so removed/unneeded operators stay visible to the
     *  dispatcher. Empty when no plant is selected. */
    const operatorRosterText = useMemo(() => {
        if (plantFilter === 'all') return ''
        // Round each clock-in to the nearest 5-minute mark — dispatchers
        // expect 06:00 / 07:50, never 07:48. Rounding happens BEFORE the
        // sort so two operators that round to the same slot keep a stable
        // ascending order in the output.
        const sortedTimes = clockInRows
            .filter((r) => r.plantCode === plantFilter)
            .map((r) => (Number.isFinite(r.time) ? Math.round(r.time / 5) * 5 : r.time))
            .sort((a, b) => a - b)
        const rawBase = poolSourceByCode?.[plantFilter]?.rawBase ?? sortedTimes.length
        const slotCount = Math.max(rawBase, sortedTimes.length)
        if (slotCount === 0) return ''
        return Array.from({ length: slotCount }, (_, i) => {
            const time = sortedTimes[i]
            return `Operator ${i + 1}: ${Number.isFinite(time) ? formatMinutesClock(time) : 'off'}`
        }).join('\n')
    }, [clockInRows, plantFilter, poolSourceByCode])

    const [operatorRosterCopied, setOperatorRosterCopied] = useState(false)
    const copyOperatorRoster = useCallback(async () => {
        if (!operatorRosterText) return
        try {
            await navigator.clipboard.writeText(operatorRosterText)
            setOperatorRosterCopied(true)
            setTimeout(() => setOperatorRosterCopied(false), 1500)
        } catch {
            // Clipboard write can fail in insecure contexts — silently no-op.
        }
    }, [operatorRosterText])

    /** Plants whose pool ramps up via clock-ins start the simulation at 0;
     *  plants with no orders today keep their effective base so suggested
     *  slots and send-home math still work for idle yards. */
    const initialPoolByCode = useMemo(() => {
        const plantsWithClockIns = new Set(clockInRows.map((r) => r.plantCode))
        const out = {}
        Object.entries(baseByPlant).forEach(([code, base]) => {
            out[code] = plantsWithClockIns.has(code) ? 0 : base
        })
        return out
    }, [baseByPlant, clockInRows])

    /** Per-driver help rows — grouped into 30-minute buckets per assignment +
     *  direction so a staggered crew arriving over an hour reads as two rows
     *  ("5 between 08:00–08:30, 5 between 08:30–09:00") rather than one row
     *  per driver. Return rows honor the assignment's `returnPlant` so trucks
     *  can be sent back to a different plant after pouring. */
    const helpRows = useMemo(
        () => buildHelpRows(assignments, plantProduction, getTravelTime),
        [assignments, plantProduction, getTravelTime]
    )

    /** Help transfers in the format expected by `computePlantPoolTimeline`. */
    const helpTransfers = useMemo(() => buildHelpTransfers(helpRows, clockInRows), [helpRows, clockInRows])

    /** Simulate the day — get poolAtDispatch + return times per order. */
    const poolTimeline = useMemo(
        () => computePlantPoolTimeline(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Per-plant pool timelines — used to recommend a better start time when
     *  an order is overbooked ("move this to 11:00 when the plant has trucks"). */
    const poolTimelinesByPlant = useMemo(
        () => computePlantPoolTimelines(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Moments throughout the day when operators can be sent home because the
     *  plant's pool has reached a level it never drops below again. Surfaced
     *  as dedicated "send home" rows in the schedule so the dispatcher knows
     *  exactly when to release operators. */
    const sendHomeRows = useMemo(
        () => computeSendHomeRows(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** One suggested slot per pour size (120+ / 50 / 10 yd) pointing the
     *  dispatcher to the earliest window where the plant has idle capacity
     *  for that job size — so they know where a new order would fit without
     *  disrupting the current plan. */
    const suggestedSlotRows = useMemo(
        () => computeSuggestedSlots(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Pull-up recommendations — later orders that could be moved earlier into
     *  surplus windows so the schedule compacts instead of trucks sitting idle. */
    const pullUpRows = useMemo(
        () => computePullUpRows(allOrders, initialPoolByCode, getTravelOverrides, helpTransfers),
        [allOrders, initialPoolByCode, getTravelOverrides, helpTransfers]
    )

    /** Status counts (Scheduled / Same-day / Cancelled / Test) for the status filter. */
    const statusCounts = useMemo(() => {
        const out = { all: allOrders.length, cancelled: 0, sameDay: 0, scheduled: 0, test: 0 }
        allOrders.forEach((o) => {
            const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind
            if (kind === 'cancelled') out.cancelled += 1
            else if (kind === 'sameDay') out.sameDay += 1
            else if (kind === 'test') out.test += 1
            else out.scheduled += 1
        })
        return out
    }, [allOrders, isViewingToday])

    const productOptions = useMemo(() => {
        const set = new Set()
        allOrders.forEach((o) => {
            const c = clean(o.productCode)
            if (c) set.add(c)
        })
        return Array.from(set).sort()
    }, [allOrders])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const minYd = parseFloat(minYards) || 0
        return allOrders
            .filter((o) => {
                if (plantFilter !== 'all' && o.plantCode !== plantFilter) return false
                if (statusFilter !== 'all') {
                    const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind || 'scheduled'
                    if (kind !== statusFilter) return false
                }
                if (productFilter !== 'all' && clean(o.productCode) !== productFilter) return false
                if (minYd > 0 && (parseFloat(o.yardage) || 0) < minYd) return false
                if (q) {
                    const haystack = [
                        o.orderNum,
                        o.customer,
                        o.customerNum,
                        o.address,
                        o.city,
                        o.productCode,
                        o.description,
                        o.contact,
                        o.phone,
                        o.poNumber,
                        o.jobNumber,
                        o.plantCode
                    ]
                        .filter(Boolean)
                        .map((v) => String(v).toLowerCase())
                        .join(' | ')
                    if (!haystack.includes(q)) return false
                }
                return true
            })
            .sort((a, b) => compareOrders(a, b, sortKey))
    }, [allOrders, isViewingToday, statusFilter, minYards, plantFilter, productFilter, query, sortKey])

    /* ── KPI numbers — non-production rows (cancelled at 17:00, test at 18:00)
       stay in the table for transparency but are excluded from yardage /
       truck totals. */
    const liveOrders = useMemo(
        () =>
            filtered.filter((o) => {
                const kind = getOrderStatus(o.startTime)?.kind
                return kind !== 'cancelled' && kind !== 'test'
            }),
        [filtered]
    )
    const totalYards = sumField(liveOrders, 'yardage')

    /** Most recent NON-CLOSED day before planDate. On Mondays this snaps to
     *  Saturday so the comparison reflects an actual production day, not the
     *  Sunday closure. Walks back up to 7 days before giving up. */
    const previousBusinessDate = useMemo(() => {
        if (!planDate) return null
        for (let offset = -1; offset >= -7; offset--) {
            const candidate = getOffsetDate(planDate, offset)
            if (!isClosedDay(candidate)) return candidate
        }
        return null
    }, [planDate])

    const previousBusinessDayLabel = useMemo(() => {
        if (!previousBusinessDate) return ''
        return new Date(previousBusinessDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    }, [previousBusinessDate])

    const previousBusinessDayYardage = useMemo(() => {
        if (!previousBusinessDate) return 0
        return sumDayYardage(adjacentProduction?.[previousBusinessDate])
    }, [adjacentProduction, previousBusinessDate])

    /** Mon–Sat date strings of the week containing planDate. Sunday is
     *  excluded (plants are closed). When planDate is Sunday, the week is
     *  the prior Mon–Sat that just ended. */
    const currentWeekDates = useMemo(() => {
        if (!planDate) return []
        const dow = new Date(planDate + 'T00:00:00').getDay()
        const mondayOffset = dow === 0 ? -6 : -(dow - 1)
        return Array.from({ length: 6 }, (_, i) => getOffsetDate(planDate, mondayOffset + i))
    }, [planDate])

    /** Total yardage for the current Mon–Sat week. Today's yardage comes
     *  from the live `totalYards` (already filtered for cancellations);
     *  every other day is summed from the adjacent fetch cache. */
    const weekYardage = useMemo(() => {
        if (currentWeekDates.length === 0) return totalYards
        return currentWeekDates.reduce((sum, date) => {
            if (date === planDate) return sum + totalYards
            return sum + sumDayYardage(adjacentProduction?.[date])
        }, 0)
    }, [adjacentProduction, currentWeekDates, planDate, totalYards])

    /** Percent change vs the previous business day. Null when that day has
     *  no data so the badge renders nothing instead of a misleading "+∞%". */
    const yardageDeltaPct = useMemo(() => {
        if (!(previousBusinessDayYardage > 0)) return null
        const delta = totalYards - previousBusinessDayYardage
        return Math.round((delta / previousBusinessDayYardage) * 1000) / 10
    }, [totalYards, previousBusinessDayYardage])
    // Sum our canonical per-order truck count (excludes cancelled). Falls back
    // to `truckCount` only when we can't compute — same rule as the table cell.
    const totalTrucks = liveOrders.reduce((sum, o) => {
        const n = getCalculatedTruckCount(o, getTravelOverrides ? getTravelOverrides(o) : undefined)
        return sum + (Number.isFinite(n) ? n : 0)
    }, 0)

    /* Customer Satisfaction — blends pour-pace adherence and first-truck
     * on-time using actual ticket load times. Live for today, all-day for
     * past days, null otherwise. */
    const today = getTodayDate()
    const isPastDay = planDate && planDate < today
    const isToday = planDate && planDate === today
    /* Current minute-of-day for today, null for past/future. Drives per-row
     * service badges (ongoing vs completed) on the schedule. */
    const nowMin = useLiveMinuteOfDay(isToday)
    const customerSatisfaction = useMemo(
        () => evaluateScheduleSatisfaction({ detailByOrderId, isPastDay, isToday, liveOrders, nowMin }),
        [detailByOrderId, isPastDay, isToday, liveOrders, nowMin]
    )

    /* Headline KPIs always reflect REAL production — cancelled (17:00) and
     * test (18:00) sentinel rows are dropped before counting plants /
     * customers / orders / start-window so a wave of cancellations doesn't
     * silently inflate the day's numbers. The table itself still renders
     * them for transparency. */
    const uniquePlants = new Set(liveOrders.map((o) => o.plantCode)).size
    const uniqueCustomers = new Set(liveOrders.map((o) => (clean(o.customer) || '').toLowerCase()).filter(Boolean)).size
    const startMinutes = liveOrders.map((o) => timeToMinutes(o.startTime)).filter((t) => t != null)
    const earliest = startMinutes.length ? Math.min(...startMinutes) : null
    const latest = startMinutes.length ? Math.max(...startMinutes) : null
    const earliestTime = earliest != null ? formatMinutesClock(earliest) : null
    const latestTime = latest != null ? formatMinutesClock(latest) : null

    const hasAnyOrders = allOrders.length > 0
    const hasActiveFilters =
        query ||
        plantFilter !== 'all' ||
        statusFilter !== 'all' ||
        productFilter !== 'all' ||
        (parseFloat(minYards) || 0) > 0

    const clearAllFilters = () => {
        setQuery('')
        setPlantFilter('all')
        setStatusFilter('all')
        setProductFilter('all')
        setMinYards('')
    }

    const groupedByPlant = useMemo(() => {
        const groups = new Map()
        filtered.forEach((o) => {
            if (!groups.has(o.plantCode)) groups.set(o.plantCode, [])
            groups.get(o.plantCode).push(o)
        })
        return Array.from(groups.entries())
            .map(([code, orders]) => ({ code, orders }))
            .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    }, [filtered])

    const activeFilterCount =
        (query ? 1 : 0) +
        (plantFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (productFilter !== 'all' ? 1 : 0) +
        ((parseFloat(minYards) || 0) > 0 ? 1 : 0)

    const plantNotSelected = plantFilter === 'all'
    const operatorRosterReady = !plantNotSelected && !!operatorRosterText
    const activePlantName = plantNotSelected ? '' : plantNameByCode?.[plantFilter] || ''

    const sideRailProps = {
        accentColor,
        activePlantName,
        onCopyRoster: copyOperatorRoster,
        onToggleExtraRows: () => setShowExtraRows((v) => !v),
        operatorRosterCopied,
        operatorRosterReady,
        plantFilter,
        showExtraRows
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="flex w-full">
                {/* Side rail only matters once a plant is filtered. The outer
                    wrapper animates `width` from 0 → 56 while the inner
                    content keeps its fixed size and gets clipped during
                    transit — animates more reliably than transitioning
                    width/padding on the same element. */}
                <aside
                    aria-hidden={plantNotSelected}
                    className="hidden lg:block sticky top-0 self-start overflow-hidden"
                    style={{
                        // Flex items default to `min-width: auto`, which would
                        // let the inner content force the aside open even
                        // when width is 0. Pin it explicitly so the collapsed
                        // state really is 0.
                        flexShrink: 0,
                        height: 'fit-content',
                        minWidth: 0,
                        transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                        width: plantNotSelected ? 0 : 56
                    }}
                >
                    <div
                        style={{
                            opacity: plantNotSelected ? 0 : 1,
                            padding: '14px 4px 14px 10px',
                            transform: plantNotSelected ? 'translateX(-8px)' : 'translateX(0)',
                            transition: 'opacity 200ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                            width: 48
                        }}
                    >
                        <div
                            className="rounded-xl overflow-hidden shadow-sm"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)'
                            }}
                        >
                            <PlanScheduleSideRail {...sideRailProps} direction="col" />
                        </div>
                    </div>
                </aside>
                <div className="flex-1 min-w-0 px-3 sm:px-4 lg:pl-2 lg:pr-6 py-4 sm:py-5 flex flex-col gap-3 sm:gap-4">
                    {/* Mobile inline card — same content, animated via
                        max-height + opacity since vertical collapse is the
                        natural fit on narrow screens. */}
                    <div
                        aria-hidden={plantNotSelected}
                        className="lg:hidden overflow-hidden"
                        style={{
                            maxHeight: plantNotSelected ? 0 : 120,
                            opacity: plantNotSelected ? 0 : 1,
                            transition: 'max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease'
                        }}
                    >
                        <div
                            className="rounded-xl overflow-hidden shadow-sm inline-block"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                        >
                            <PlanScheduleSideRail {...sideRailProps} direction="row" />
                        </div>
                    </div>
                    {(plantsClosed || isSaturday) && (
                        <div
                            className="rounded-lg px-4 py-3 flex items-start gap-3"
                            style={{
                                background: plantsClosed ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                                border: `1px solid ${plantsClosed ? 'rgba(220, 38, 38, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`
                            }}
                        >
                            <i
                                className={`fas ${plantsClosed ? 'fa-ban' : 'fa-calendar-day'} mt-0.5`}
                                style={{ color: plantsClosed ? '#dc2626' : '#d97706', fontSize: 14 }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {plantsClosed ? 'Sunday — plants closed' : 'Saturday — half crew'}
                                </div>
                                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                    {plantsClosed
                                        ? 'All plants are assumed closed today. Truck-coverage math treats every plant pool as 0.'
                                        : 'Saturday crews run at half staffing. Every plant’s active mixer count is halved (rounded down) for the coverage math.'}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Title row */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                            <div
                                className="text-[18px] sm:text-[22px] font-bold leading-tight"
                                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                            >
                                Schedule
                            </div>
                            <div className="text-[11.5px] sm:text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                {isMobile
                                    ? `${filtered.length} of ${allOrders.length} orders`
                                    : "Pulled from the Daily Order Listing import. Filter, sort, and scan every plant's orders on one page."}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isMobile && (
                                <div
                                    className="flex items-center rounded-lg p-0.5"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    {VIEW_MODES.map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setViewMode(m)}
                                            className="px-3 py-1.5 rounded-md text-[11.5px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                                            style={{
                                                background: viewMode === m ? accentColor : 'transparent',
                                                color: viewMode === m ? '#fff' : 'var(--text-secondary)'
                                            }}
                                        >
                                            <i
                                                className={`fas ${m === 'table' ? 'fa-table' : 'fa-grip'} text-[10px]`}
                                            />
                                            {m === 'table' ? 'Table' : 'Cards'}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {isMobile && hasAnyOrders && (
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen((v) => !v)}
                                    className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                                    style={{
                                        background:
                                            filtersOpen || activeFilterCount > 0 ? accentColor : 'var(--bg-secondary)',
                                        color: filtersOpen || activeFilterCount > 0 ? '#fff' : 'var(--text-secondary)'
                                    }}
                                >
                                    <i className={`fas fa-filter text-[10px]`} />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span
                                            className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                                            style={{
                                                background: 'rgba(255,255,255,0.3)',
                                                color: '#fff',
                                                height: 18,
                                                minWidth: 18,
                                                padding: '0 5px'
                                            }}
                                        >
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                            )}
                            {onSwitchToPlanner && (
                                <button
                                    type="button"
                                    onClick={onSwitchToPlanner}
                                    className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                                    style={{ background: accentColor, color: '#fff' }}
                                >
                                    <i className="fas fa-project-diagram text-[10px]" /> Planner
                                </button>
                            )}
                        </div>
                    </div>

                    {!hasAnyOrders ? (
                        <div
                            className="rounded-xl p-10 text-center"
                            style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-medium)' }}
                        >
                            <i
                                className="fas fa-calendar-xmark text-3xl mb-3 opacity-60"
                                style={{ color: 'var(--text-tertiary)' }}
                            />
                            <div
                                className="text-[15px] font-bold mb-1"
                                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                            >
                                No schedule yet
                            </div>
                            <div
                                className="text-[12.5px] max-w-[480px] mx-auto"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Import the Daily Order Listing HTML to populate every plant&apos;s orders. Customer,
                                start time, product, yardage, and truck count will all land here.
                            </div>
                        </div>
                    ) : (
                        <>
                            <PlanScheduleStatStrip
                                allOrdersCount={allOrders.length}
                                customerSatisfaction={customerSatisfaction}
                                earliestTime={earliestTime}
                                filteredCount={filtered.length}
                                hasActiveFilters={hasActiveFilters}
                                latestTime={latestTime}
                                liveOrdersCount={liveOrders.length}
                                previousBusinessDayLabel={previousBusinessDayLabel}
                                previousBusinessDayYardage={previousBusinessDayYardage}
                                totalTrucks={totalTrucks}
                                totalYards={totalYards}
                                uniqueCustomers={uniqueCustomers}
                                uniquePlants={uniquePlants}
                                weekYardage={weekYardage}
                                yardageDeltaPct={yardageDeltaPct}
                            />

                            {filtersOpen && (
                                <PlanScheduleFilterDrawer
                                    minYards={minYards}
                                    onChangeMinYards={setMinYards}
                                    onChangePlant={setPlantFilter}
                                    onChangeProduct={setProductFilter}
                                    onChangeQuery={setQuery}
                                    onChangeSort={setSortKey}
                                    onChangeStatus={setStatusFilter}
                                    plantFilter={plantFilter}
                                    plantNameByCode={plantNameByCode}
                                    plantOptions={plantOptions}
                                    productFilter={productFilter}
                                    productOptions={productOptions}
                                    query={query}
                                    sortKey={sortKey}
                                    statusCounts={statusCounts}
                                    statusFilter={statusFilter}
                                />
                            )}

                            {hasActiveFilters && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                                        {filtered.length} of {allOrders.length} orders match your filters.
                                    </span>
                                    <button
                                        type="button"
                                        onClick={clearAllFilters}
                                        className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold border-none cursor-pointer"
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        <i className="fas fa-rotate-left mr-1" /> Reset filters
                                    </button>
                                </div>
                            )}

                            {filtered.length === 0 ? (
                                <div
                                    className="rounded-xl p-10 text-center italic"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px dashed var(--border-medium)',
                                        color: 'var(--text-tertiary)'
                                    }}
                                >
                                    No orders match the current filters.
                                </div>
                            ) : viewMode === 'table' && !isMobile ? (
                                <PlanScheduleTable
                                    accentColor={accentColor}
                                    clockInRows={clockInRows}
                                    detailByOrderId={detailByOrderId}
                                    getCloserPlantForOrder={getCloserPlantForOrder}
                                    getTravelOverrides={getTravelOverrides}
                                    helpRows={helpRows}
                                    filteredPlantCode={plantFilter !== 'all' ? plantFilter : null}
                                    isPlantFiltered={plantFilter !== 'all'}
                                    isToday={isViewingToday}
                                    nowMin={nowMin}
                                    showExtraRows={showExtraRows}
                                    keyForOrder={keyForOrder}
                                    onOpenLocation={setMapOrder}
                                    orders={filtered}
                                    plantCityByCode={plantCityByCode}
                                    plantNameByCode={plantNameByCode}
                                    poolSourceByCode={poolSourceByCode}
                                    poolTimeline={poolTimeline}
                                    poolTimelinesByPlant={poolTimelinesByPlant}
                                    pullUpRows={pullUpRows}
                                    sendHomeRows={sendHomeRows}
                                    suggestedSlotRows={suggestedSlotRows}
                                />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {groupedByPlant.map(({ code, orders }) => (
                                        <div key={code} className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 px-1 text-[13px]">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPlantFilter((prev) => (prev === code ? 'all' : code))
                                                    }
                                                    className="border-none bg-transparent p-0 cursor-pointer"
                                                    title={
                                                        plantFilter === code
                                                            ? 'Tap to clear plant filter'
                                                            : `Filter to plant ${code}`
                                                    }
                                                >
                                                    <PlantBadge
                                                        code={code}
                                                        fallback={accentColor}
                                                        name={plantNameByCode?.[code]}
                                                    />
                                                </button>
                                                <span style={{ color: 'var(--text-tertiary)' }}>
                                                    {orders.length} order{orders.length === 1 ? '' : 's'} ·{' '}
                                                    {sumField(orders, 'yardage').toLocaleString()} yd
                                                </span>
                                            </div>
                                            <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                                                {orders.map((o, idx) => (
                                                    <PlanScheduleOrderCard
                                                        key={`${code}-${o.orderId || idx}`}
                                                        accentColor={accentColor}
                                                        closerPlant={getCloserPlantForOrder(o)}
                                                        isToday={isViewingToday}
                                                        onOpenLocation={setMapOrder}
                                                        onPickPlant={(c) =>
                                                            setPlantFilter((prev) => (prev === c ? 'all' : c))
                                                        }
                                                        onPickProduct={(p) =>
                                                            setProductFilter((prev) => (prev === p ? 'all' : p))
                                                        }
                                                        onPickStatus={(s) =>
                                                            setStatusFilter((prev) => (prev === s ? 'all' : s))
                                                        }
                                                        order={o}
                                                        plantCode={code}
                                                        plantName={plantNameByCode?.[code]}
                                                        service={evaluateOrderService(
                                                            o,
                                                            o.orderId ? detailByOrderId[o.orderId] : null,
                                                            nowMin
                                                        )}
                                                        travelOverrides={getTravelOverrides(o)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {mapOrder && (
                <JobMapModal
                    accentColor={accentColor}
                    onClose={() => setMapOrder(null)}
                    order={mapOrder}
                    plantAddress={plantAddressByCode?.[mapOrder?.plantCode] || ''}
                    plantCode={mapOrder?.plantCode}
                    plantName={plantNameByCode?.[mapOrder?.plantCode] || ''}
                    plants={plantOptionsForMap}
                    travelMinutes={parseHhmmToMinutes(mapOrder?.toJobTime)}
                />
            )}
        </div>
    )
}

export default PlanScheduleView
