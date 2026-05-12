/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { PlantBadge } from '../../../app/components/plan/PlanScheduleBadges'
import PlanScheduleFilterDrawer from '../../../app/components/plan/PlanScheduleFilterDrawer'
import PlanScheduleOrderCard from '../../../app/components/plan/PlanScheduleOrderCard'
import PlanScheduleStatStrip from '../../../app/components/plan/PlanScheduleStatStrip'
import PlanScheduleTable from '../../../app/components/plan/PlanScheduleTable'
import JobMapModal from '../../../app/components/schedule/JobMapModal'
import useCloserPlantLookup from '../../../app/hooks/useCloserPlantLookup'
import useLiveMinuteOfDay from '../../../app/hooks/useLiveMinuteOfDay'
import useLiveTravelTimes from '../../../app/hooks/useLiveTravelTimes'
import usePlanTravelPairs from '../../../app/hooks/usePlanTravelPairs'
import { formatOrderAddress } from '../../../utils/AddressUtility'
import {
    applyLoadingPlantReassignment,
    buildHelpRows,
    buildHelpTransfers,
    clean,
    compareOrders,
    evaluateOrderService,
    evaluateScheduleSatisfaction,
    extractCityFromFullAddress,
    getFirstLoadOutMinutes,
    getOrderStatus,
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
    getDayOfWeekForDate,
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
 *  the liveOrders filter (excludes cancelled + test sentinel orders). The
 *  optional `orderPredicate` lets callers reapply the user's active plant /
 *  product / minYards filters so day-over-day comparisons stay apples-to-
 *  apples when the toolbar is filtered. */
const sumDayYardage = (production, orderPredicate) => {
    if (!production || typeof production !== 'object') return 0
    let sum = 0
    Object.entries(production).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY) return
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        list.forEach((o) => {
            if (isExcludedOrder(o)) return
            if (orderPredicate && !orderPredicate(o)) return
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
/** Default-shape sentinel — used only when this view renders standalone (e.g.
 *  in tests or a future preview surface). The real PlanView always supplies
 *  `filters` + `onChangeFilter` so the schedule-tab filters survive the
 *  loading-skeleton swap on every date change. */
const DEFAULT_FILTERS = {
    filtersOpen: true,
    minYards: '',
    /** Multi-select array of plant codes — empty means "all plants".
     *  Lets the dispatcher pick whole districts / arbitrary permutations
     *  via PlantDropdownModal. */
    plantFilters: [],
    productFilter: 'all',
    query: '',
    /** Cancelled (17:00 sentinel) and test (18:00 sentinel) orders are noise
     *  by default — they're real rows in the dispatch report but they
     *  don't represent production. Hidden until the dispatcher explicitly
     *  flips these toggles to inspect them. */
    showCancelled: false,
    showExtraRows: false,
    showTest: false,
    sortKey: 'plantThenTime',
    statusFilter: 'all',
    viewMode: 'table'
}

function PlanScheduleView({
    accentColor,
    adjacentProduction = {},
    assignments = [],
    detailByOrderId = {},
    filters = DEFAULT_FILTERS,
    getTravelTime,
    isMaximized = false,
    isMobile = false,
    onChangeFilter,
    onChangeMaximized,
    onSwitchToPlanner,
    planDate,
    plantAddressByCode,
    plantNameByCode,
    plantProduction: rawPlantProduction,
    /** Plants with district memberships — fed to PlantDropdownModal so the
     *  multi-select plant filter can offer district-level toggling. */
    plants = [],
    stats = []
}) {
    /** Reassign fully-loaded orders to the plant that actually loaded them
     *  (e.g. dispatch parked it on 401 but every ticket came from 402). The
     *  schedule view then renders the order under the working plant. */
    const plantProduction = useMemo(
        () => applyLoadingPlantReassignment(rawPlantProduction, detailByOrderId),
        [rawPlantProduction, detailByOrderId]
    )

    const poolDayMultiplier = getPoolDayMultiplier(planDate)
    const plantsClosed = isClosedDay(planDate)
    const isSaturday = poolDayMultiplier === 0.5
    /* "Same-day" badge gating — the 15:00 sentinel only means "same day" when
     * the schedule being viewed is actually today; on past/future schedules a
     * real 3:00 PM start is legitimate, so suppress the badge there. */
    const isViewingToday = planDate === getTodayDate()
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

    /** Filter / view / sort state is controlled by the parent (`PlanView`)
     *  so it survives the loading-skeleton swap on every date change. We
     *  derive each individual setter here so the rest of this view doesn't
     *  need to know the state lives upstream. */
    const setFilterValue = useCallback(
        (key) => (value) => {
            if (typeof onChangeFilter === 'function') onChangeFilter(key, value)
        },
        [onChangeFilter]
    )
    const setQuery = useMemo(() => setFilterValue('query'), [setFilterValue])
    const setPlantFilters = useMemo(() => setFilterValue('plantFilters'), [setFilterValue])
    const setStatusFilter = useMemo(() => setFilterValue('statusFilter'), [setFilterValue])
    const setProductFilter = useMemo(() => setFilterValue('productFilter'), [setFilterValue])
    const setMinYards = useMemo(() => setFilterValue('minYards'), [setFilterValue])
    const setSortKey = useMemo(() => setFilterValue('sortKey'), [setFilterValue])
    /** When the schedule is filtered to a single plant we interleave synthetic
     *  rows (truck returns, help events, send-home recommendations, open-slot
     *  suggestions, trade-offs). Those rows only make sense chronologically,
     *  so turning them ON forces a time-based sort; turning them OFF lets the
     *  Sort by picker actually reorder the table. Default off so the sort
     *  controls work immediately — dispatchers opt-in to the extras. */
    const setShowExtraRows = useMemo(() => setFilterValue('showExtraRows'), [setFilterValue])
    const setShowCancelled = useMemo(() => setFilterValue('showCancelled'), [setFilterValue])
    const setShowTest = useMemo(() => setFilterValue('showTest'), [setFilterValue])
    // Mobile is always cards (the 12-column table needs hundreds of px to read).
    const setViewMode = useMemo(() => setFilterValue('viewMode'), [setFilterValue])
    // Filter drawer is collapsed by default on mobile so the schedule fills the screen.
    const setFiltersOpen = useMemo(() => setFilterValue('filtersOpen'), [setFilterValue])
    const {
        filtersOpen,
        minYards,
        plantFilters: plantFiltersRaw,
        productFilter,
        query,
        showCancelled,
        showExtraRows,
        showTest,
        sortKey,
        statusFilter,
        viewMode
    } = filters
    /** Array of selected plant codes — empty means "all plants". Memoised
     *  so deps that depend on it stay stable when nothing changed. */
    const plantFilters = useMemo(() => (Array.isArray(plantFiltersRaw) ? plantFiltersRaw : []), [plantFiltersRaw])
    const plantFilterSet = useMemo(() => new Set(plantFilters), [plantFilters])
    /** When exactly one plant is selected, "single-plant" affordances
     *  (copy roster, extras toggle, plant-scope chip, pool-aware
     *  computations) light up. With zero or 2+ plants picked, those
     *  features stay disabled — they don't have a single subject. */
    const singlePlant = plantFilters.length === 1 ? plantFilters[0] : null
    /** Toggle a plant in the multi-select array — used both by the
     *  PlantDropdownModal (per-event) and by code that wants to flip a
     *  single chip on/off. */
    const togglePlantFilter = useCallback(
        (code) => {
            setPlantFilters((prev) => {
                const arr = Array.isArray(prev) ? prev : []
                return arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code]
            })
        },
        [setPlantFilters]
    )
    // mapOrder is the only schedule-local state that genuinely shouldn't
    // persist across date changes — closing this view should drop the open
    // map modal (the order it points at no longer exists in the new day).
    const [mapOrder, setMapOrder] = useState(null)
    /** Maximized = the dispatcher hides the title row, KPI strip, side rail,
     *  and full filter drawer in favor of a single sticky compact toolbar so
     *  the table fills the visible area. Desktop-only (mobile is already
     *  cards-on-a-narrow-screen, so there's nothing to expand into).
     *
     *  The `isMaximized` flag is owned by `PlanView` (parent) so it survives
     *  the loading-skeleton swap that fires on every date change — when the
     *  flag lived here, changing dates unmounted this view and reset it. */
    const setMaximized = useCallback(
        (next) => {
            if (typeof onChangeMaximized === 'function') onChangeMaximized(next)
        },
        [onChangeMaximized]
    )
    const effectiveMaximized = isMaximized && !isMobile

    // Bail out of maximized mode if the viewport drops to mobile so the
    // user isn't stranded with desktop-only chrome on a phone.
    useEffect(() => {
        if (isMobile && isMaximized) setMaximized(false)
    }, [isMobile, isMaximized, setMaximized])

    // Esc exits maximized — same affordance as the JobMapModal so the
    // dispatcher's muscle memory carries over.
    useEffect(() => {
        if (!effectiveMaximized) return undefined
        const onKey = (e) => {
            if (e.key === 'Escape') setMaximized(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [effectiveMaximized, setMaximized])

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
     *  dispatcher. Empty when zero or 2+ plants are selected (the roster
     *  is a per-plant artifact). */
    const operatorRosterText = useMemo(() => {
        if (!singlePlant) return ''
        const sortedTimes = clockInRows
            .filter((r) => r.plantCode === singlePlant)
            .map((r) => (Number.isFinite(r.time) ? Math.round(r.time / 5) * 5 : r.time))
            .sort((a, b) => a - b)
        const rawBase = poolSourceByCode?.[singlePlant]?.rawBase ?? sortedTimes.length
        const slotCount = Math.max(rawBase, sortedTimes.length)
        if (slotCount === 0) return ''
        return Array.from({ length: slotCount }, (_, i) => {
            const time = sortedTimes[i]
            return `Operator ${i + 1}: ${Number.isFinite(time) ? formatMinutesClock(time) : 'off'}`
        }).join('\n')
    }, [clockInRows, singlePlant, poolSourceByCode])

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
                if (plantFilterSet.size > 0 && !plantFilterSet.has(o.plantCode)) return false
                const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind || 'scheduled'
                // Cancelled / test orders are gated by independent toggles
                // — defaulted off so production tables stay clean by
                // default. The Status pill below narrows further but only
                // among the kinds that aren't filtered out here.
                if (kind === 'cancelled' && !showCancelled) return false
                if (kind === 'test' && !showTest) return false
                if (statusFilter !== 'all' && kind !== statusFilter) return false
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
    }, [
        allOrders,
        isViewingToday,
        statusFilter,
        minYards,
        plantFilterSet,
        productFilter,
        query,
        showCancelled,
        showTest,
        sortKey
    ])

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

    /** Most recent NON-CLOSED day before planDate. Skips Sundays (plants
     *  closed). On Mondays we return null instead of snapping to Saturday
     *  — comparing Monday production to a half-crew Saturday is misleading,
     *  so the badge simply hides on Mondays. */
    const previousBusinessDate = useMemo(() => {
        if (!planDate) return null
        const planDayOfWeek = getDayOfWeekForDate(planDate)
        if (planDayOfWeek === 1) return null
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

    /** Predicate that mirrors the toolbar's structural filters (plant /
     *  product / minimum yards) so day-over-day and week totals scope to
     *  the same slice the user is viewing. Free-text search and status
     *  pills are intentionally omitted — they're display filters, not
     *  scoping filters, and applying them to historical days would make
     *  the comparison incoherent. */
    const adjacentDayOrderFilter = useMemo(() => {
        const minYd = parseFloat(minYards) || 0
        const hasPlantFilter = plantFilterSet.size > 0
        const productCode = productFilter !== 'all' ? productFilter : null
        if (!hasPlantFilter && !productCode && minYd <= 0) return null
        return (order) => {
            if (hasPlantFilter && !plantFilterSet.has(order.plantCode)) return false
            if (productCode && clean(order.productCode) !== productCode) return false
            if (minYd > 0 && (parseFloat(order.yardage) || 0) < minYd) return false
            return true
        }
    }, [minYards, plantFilterSet, productFilter])

    const previousBusinessDayYardage = useMemo(() => {
        if (!previousBusinessDate) return 0
        return sumDayYardage(adjacentProduction?.[previousBusinessDate], adjacentDayOrderFilter)
    }, [adjacentDayOrderFilter, adjacentProduction, previousBusinessDate])

    /** Mon–Sat date strings of the week containing planDate. Sunday is
     *  excluded (plants are closed). When planDate is Sunday, the week is
     *  the prior Mon–Sat that just ended. */
    const currentWeekDates = useMemo(() => {
        if (!planDate) return []
        const dow = getDayOfWeekForDate(planDate)
        if (dow == null) return []
        const mondayOffset = dow === 0 ? -6 : -(dow - 1)
        return Array.from({ length: 6 }, (_, i) => getOffsetDate(planDate, mondayOffset + i))
    }, [planDate])

    /** Total yardage for the current Mon–Sat week. Today's yardage comes
     *  from the live `totalYards` (already filtered); every other day is
     *  summed from the adjacent fetch cache with the same structural
     *  filters reapplied so the week total matches the user's view. */
    const weekYardage = useMemo(() => {
        if (currentWeekDates.length === 0) return totalYards
        return currentWeekDates.reduce((sum, date) => {
            if (date === planDate) return sum + totalYards
            return sum + sumDayYardage(adjacentProduction?.[date], adjacentDayOrderFilter)
        }, 0)
    }, [adjacentDayOrderFilter, adjacentProduction, currentWeekDates, planDate, totalYards])

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
        plantFilters.length > 0 ||
        statusFilter !== 'all' ||
        productFilter !== 'all' ||
        (parseFloat(minYards) || 0) > 0 ||
        showCancelled ||
        showTest

    const clearAllFilters = () => {
        setQuery('')
        setPlantFilters([])
        setStatusFilter('all')
        setProductFilter('all')
        setMinYards('')
        setShowCancelled(false)
        setShowTest(false)
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

    /* Anchor for the per-card 14h driver-shift check — computed once per
     * filtered order set and shared across every order card. Card view also
     * consumes this; table view reads its own copy from PlanScheduleTable. */
    const cardFirstLoadOutMin = useMemo(() => getFirstLoadOutMinutes(filtered), [filtered])

    const activeFilterCount =
        (query ? 1 : 0) +
        (plantFilters.length > 0 ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (productFilter !== 'all' ? 1 : 0) +
        ((parseFloat(minYards) || 0) > 0 ? 1 : 0) +
        (showCancelled ? 1 : 0) +
        (showTest ? 1 : 0)

    /** Single-plant affordances (copy roster, extras toggle, plant scope
     *  chip) only light up when exactly one plant is selected. */
    const operatorRosterReady = !!singlePlant && !!operatorRosterText
    const activePlantName = singlePlant ? plantNameByCode?.[singlePlant] || '' : ''

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="flex w-full">
                <div className="flex-1 min-w-0 px-3 sm:px-4 lg:pl-2 lg:pr-6 py-4 sm:py-5 flex flex-col gap-3 sm:gap-4">
                    {/* Plant tools (copy operator roster, extras toggle,
                        plant-scope chip) live in the FilterDrawer's
                        plant-tools section now — see PlanScheduleFilterDrawer.
                        The previous floating bottom-left rail and the
                        mobile inline rail were duplicating the same
                        controls and have been removed. */}
                    {!effectiveMaximized && (plantsClosed || isSaturday) && (
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
                                <div className="text-[13px] font-bold text-text-primary">
                                    {plantsClosed ? 'Sunday — plants closed' : 'Saturday — half crew'}
                                </div>
                                <div className="text-[12px] text-text-secondary">
                                    {plantsClosed
                                        ? 'All plants are assumed closed today. Truck-coverage math treats every plant pool as 0.'
                                        : 'Saturday crews run at half staffing. Every plant’s active mixer count is halved (rounded down) for the coverage math.'}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Title row — hidden in maximized mode; the compact
                        toolbar carries the view toggle and Exit button. */}
                    {!effectiveMaximized && (
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="text-[18px] sm:text-[22px] font-bold leading-tight text-text-primary font-heading">
                                    Schedule
                                </div>
                                <div className="text-[11.5px] sm:text-[12px] text-text-secondary">
                                    {isMobile
                                        ? `${filtered.length} of ${allOrders.length} orders`
                                        : "Pulled from the Daily Order Listing import. Filter, sort, and scan every plant's orders on one page."}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isMobile && (
                                    <div className="flex items-center rounded-lg p-0.5 bg-bg-secondary border border-border-light">
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
                                                filtersOpen || activeFilterCount > 0
                                                    ? accentColor
                                                    : 'var(--bg-secondary)',
                                            color:
                                                filtersOpen || activeFilterCount > 0 ? '#fff' : 'var(--text-secondary)'
                                        }}
                                    >
                                        <i className={`fas fa-filter text-[10px]`} />
                                        Filters
                                        {activeFilterCount > 0 && (
                                            <span
                                                className="inline-flex items-center justify-center rounded-full text-[10px] font-bold bg-[rgba(255,255,255,0.3)] text-white h-[18px]"
                                                style={{ minWidth: 18, padding: '0 5px' }}
                                            >
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </button>
                                )}
                                {!isMobile && hasAnyOrders && (
                                    <button
                                        type="button"
                                        onClick={() => setMaximized(true)}
                                        className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5 bg-bg-secondary border border-border-light text-text-secondary"
                                        title="Maximize the schedule — hide the KPI strip and side rail so the table fills the screen"
                                    >
                                        <i className="fas fa-expand text-[10px]" />
                                        Maximize
                                    </button>
                                )}
                                {onSwitchToPlanner && (
                                    <button
                                        type="button"
                                        onClick={onSwitchToPlanner}
                                        className="px-3 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5 text-white"
                                        style={{ background: accentColor }}
                                    >
                                        <i className="fas fa-project-diagram text-[10px]" /> Planner
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {!hasAnyOrders ? (
                        <div className="rounded-xl p-10 text-center bg-bg-primary border border-border-medium">
                            <i className="fas fa-calendar-xmark text-3xl mb-3 opacity-60 text-text-tertiary" />
                            <div className="text-[15px] font-bold mb-1 text-text-primary font-heading">
                                No schedule yet
                            </div>
                            <div className="text-[12.5px] max-w-[480px] mx-auto text-text-secondary">
                                Import the Daily Order Listing HTML to populate every plant&apos;s orders. Customer,
                                start time, product, yardage, and truck count will all land here.
                            </div>
                        </div>
                    ) : (
                        <>
                            {!effectiveMaximized && (
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
                            )}

                            {/* The same single-row filter drawer is the
                                control surface in BOTH normal and maximized
                                mode. In maximized mode it carries an inline
                                "Exit" button so the dispatcher can drop back
                                without rebuilding a separate compact toolbar.
                                On mobile the dispatcher can collapse it via
                                the Filters button above; desktop always
                                shows it. */}
                            {(!isMobile || filtersOpen) && (
                                <PlanScheduleFilterDrawer
                                    accent={accentColor}
                                    activePlantName={activePlantName}
                                    minYards={minYards}
                                    onChangeMinYards={setMinYards}
                                    onChangeProduct={setProductFilter}
                                    onChangeQuery={setQuery}
                                    onChangeShowCancelled={setShowCancelled}
                                    onChangeShowTest={setShowTest}
                                    onChangeSort={setSortKey}
                                    onChangeStatus={setStatusFilter}
                                    onClearFilters={hasActiveFilters ? clearAllFilters : null}
                                    onCopyRoster={copyOperatorRoster}
                                    onExitMaximized={effectiveMaximized ? () => setMaximized(false) : null}
                                    onToggleExtraRows={() => setShowExtraRows((v) => !v)}
                                    onTogglePlantFilter={togglePlantFilter}
                                    operatorRosterCopied={operatorRosterCopied}
                                    operatorRosterReady={operatorRosterReady}
                                    plantFilters={plantFilters}
                                    plantNameByCode={plantNameByCode}
                                    plantOptions={plantOptions}
                                    plants={plants}
                                    productFilter={productFilter}
                                    productOptions={productOptions}
                                    query={query}
                                    showCancelled={showCancelled}
                                    showExtraRows={showExtraRows}
                                    showTest={showTest}
                                    sortKey={sortKey}
                                    statusCounts={statusCounts}
                                    statusFilter={statusFilter}
                                    totalShown={filtered.length}
                                    totalUnfiltered={allOrders.length}
                                />
                            )}

                            {filtered.length === 0 ? (
                                <div className="rounded-xl p-10 text-center italic bg-bg-primary border border-border-medium text-text-tertiary">
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
                                    filteredPlantCode={singlePlant}
                                    isMaximized={effectiveMaximized}
                                    isPastDay={isPastDay}
                                    isPlantFiltered={!!singlePlant}
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
                                                    onClick={() => togglePlantFilter(code)}
                                                    className="border-none bg-transparent p-0 cursor-pointer"
                                                    title={
                                                        plantFilterSet.has(code)
                                                            ? 'Tap to remove plant from filter'
                                                            : `Filter to plant ${code}`
                                                    }
                                                >
                                                    <PlantBadge
                                                        code={code}
                                                        fallback={accentColor}
                                                        name={plantNameByCode?.[code]}
                                                    />
                                                </button>
                                                <span className="text-text-tertiary">
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
                                                        firstLoadOutMin={cardFirstLoadOutMin}
                                                        isToday={isViewingToday}
                                                        onOpenLocation={setMapOrder}
                                                        onPickPlant={(c) => togglePlantFilter(c)}
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
                />
            )}
        </div>
    )
}

export default PlanScheduleView
