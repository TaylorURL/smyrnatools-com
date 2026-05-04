import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { parseIsoLocal } from '../../utils/PlanStatisticsFormatUtility'
import {
    aggregateMetrics,
    buildRange,
    computeScheduleMetrics,
    countWorkingDays,
    isoDate,
    isSundayIso,
    listWorkingDaysInRange,
    padTrend
} from '../../utils/PlanStatisticsUtility'
import { computeCustomerSatisfaction, isExcludedOrder, PLAN_META_KEY } from '../../utils/PlanUtility'

/**
 * Walk every plan row once, emitting a flat `{ planDate, plantCode, order }`
 * record for each live order. Used to build per-plant order buckets without
 * re-running `computeScheduleMetrics` for every (row, plant) pair — the
 * old approach was O(days × plants × orders) and crashed the page on big
 * windows. This pass is O(days × orders).
 */
const flattenLiveOrders = (rows) => {
    const out = []
    if (!Array.isArray(rows)) return out
    rows.forEach((row) => {
        const date = row?.plan_date
        if (!date || isSundayIso(date)) return
        const production = row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
        Object.entries(production).forEach(([plantCode, block]) => {
            if (plantCode === PLAN_META_KEY) return
            const orders = Array.isArray(block?.orders) ? block.orders : []
            orders.forEach((o) => {
                if (isExcludedOrder(o)) return
                out.push({ order: o, planDate: date, plantCode })
            })
        })
    })
    return out
}

/**
 * Orchestrates every async + derived state slice for `PlanStatisticsView`.
 *
 * Owns the period/comparison/anchor/plant-filter selectors, fetches plan
 * rows for the active range (and its comparison window), derives per-day
 * + period-aggregate schedule metrics, fetches detail-order ticket data
 * for the satisfaction score, and pre-pads trend data for the chart.
 *
 * Pure orchestration — no rendering, no DOM. Returns a flat object that
 * the view destructures into its presentation components.
 *
 * @param {Object} args
 * @param {string} args.planDate - Active plan date.
 * @param {Object} args.liveProduction - Latest in-memory plant_production
 *   used as a synthetic row when the active range covers `planDate` but
 *   the server doesn't have a saved row for it yet.
 * @param {boolean} [args.satisfactionEnabled=true] - When false, the
 *   satisfaction-side computations (per-plant rank, trend, aggregate, ticket
 *   fetches) skip work entirely and return null/empty. Lets the view defer
 *   the most expensive memos until the satisfaction sub-page is actually
 *   visible — without it, "Statistics → Overview" would re-run thousands of
 *   ops every render even though no chart was reading the result.
 */
export function usePlanStatistics({ planDate, liveProduction, satisfactionEnabled = true }) {
    const [period, setPeriod] = useState('week')
    const [comparison, setComparison] = useState('none')
    const [anchor, setAnchor] = useState(planDate || isoDate(new Date()))
    const [customStart, setCustomStart] = useState(planDate || isoDate(new Date()))
    const [customEnd, setCustomEnd] = useState(planDate || isoDate(new Date()))
    const [loading, setLoading] = useState(true)
    /** Raw plan rows from the database — kept un-aggregated so the plant
     *  filter can re-derive every metric without a re-fetch. */
    const [currentRows, setCurrentRows] = useState([])
    const [previousRows, setPreviousRows] = useState([])
    /** null = all plants; otherwise a plant_code that scopes every
     *  aggregation, chart, and table on the page. */
    const [selectedPlant, setSelectedPlant] = useState(null)
    /** Per-day detail-order maps (orderId → ticket data) fetched from the
     *  dispatch storage bucket. Feeds `computeCustomerSatisfaction` so this
     *  page produces the EXACT same score the Schedule tab shows for the
     *  current day. Days with no detail data are scored as null. */
    const [detailByDay, setDetailByDay] = useState({})
    const [satisfactionLoading, setSatisfactionLoading] = useState(false)

    useEffect(() => {
        if (planDate) setAnchor(planDate)
    }, [planDate])

    const range = useMemo(
        () => buildRange(period, anchor, comparison, customStart, customEnd),
        [period, anchor, comparison, customStart, customEnd]
    )

    /** True when the user is looking at a single calendar day — unlocks
     *  truck-utilization status pills that need a per-day shift span. */
    const isSingleDay = useMemo(
        () => period === 'day' || (period === 'custom' && customStart === customEnd),
        [period, customStart, customEnd]
    )

    /** Working-day count for the current window (Sundays excluded), used as
     *  the denominator for "X of Y days" KPI hints. */
    const workingDayCount = useMemo(() => countWorkingDays(range.current.start, range.current.end), [range])

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                // Stats read directly from `dispatch_data` — the imported
                // order + ticket rows are the source of truth for yardage,
                // orders, loads, customers, products, and plants. The
                // `plans` table is the dispatcher's saved scheduling state
                // (assignments, notes); it isn't authoritative for raw
                // production counts and isn't required to exist for a
                // given date. `fetchPlanRowsByDateRange` shapes the
                // dispatch_data order headers into the same
                // `{ plan_date, plant_production }` records the rest of
                // this hook expects.
                const currentDates = listWorkingDaysInRange(range.current.start, range.current.end)
                const previousDates = range.previous
                    ? listWorkingDaysInRange(range.previous.start, range.previous.end)
                    : []
                const [fetchedCurrent, fetchedPrevious] = await Promise.all([
                    DispatchDataService.fetchPlanRowsByDateRange(currentDates),
                    previousDates.length
                        ? DispatchDataService.fetchPlanRowsByDateRange(previousDates)
                        : Promise.resolve([])
                ])
                if (cancelled) return
                setCurrentRows(fetchedCurrent || [])
                setPreviousRows(fetchedPrevious || [])
            } catch {
                if (cancelled) return
                setCurrentRows([])
                setPreviousRows([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [range])

    /** Derive per-day metrics from the raw rows. Re-runs cheaply when the
     *  plant filter changes — no re-fetch needed. The live-production
     *  fallback runs here so it picks up the same plant filter. */
    const currentDays = useMemo(() => {
        let mapped = (currentRows || [])
            .map((row) => computeScheduleMetrics(row, selectedPlant))
            .filter((d) => !isSundayIso(d.planDate))
        const hasPlanDateRow = mapped.some((d) => d.planDate === planDate)
        const planDateInRange = planDate && planDate >= range.current.start && planDate <= range.current.end
        if (!hasPlanDateRow && planDateInRange && liveProduction && !isSundayIso(planDate)) {
            const synthetic = computeScheduleMetrics(
                { plan_date: planDate, plant_production: liveProduction },
                selectedPlant
            )
            if (synthetic.totalYardage > 0 || synthetic.totalLoads > 0 || synthetic.totalOrders > 0) {
                mapped = [...mapped, synthetic].sort((a, b) => a.planDate.localeCompare(b.planDate))
            }
        }
        return mapped
    }, [currentRows, selectedPlant, planDate, liveProduction, range])

    const previousDays = useMemo(
        () =>
            (previousRows || [])
                .map((row) => computeScheduleMetrics(row, selectedPlant))
                .filter((d) => !isSundayIso(d.planDate)),
        [previousRows, selectedPlant]
    )

    /** Distinct plant codes present in the loaded window (not the global
     *  plant directory). Sorted alphabetically. The selected plant is kept
     *  in the list even if the new range has no rows for it so the dropdown
     *  still shows what's currently filtered. */
    const availablePlantCodes = useMemo(() => {
        const codes = new Set()
        ;(currentRows || []).forEach((row) => {
            const production =
                row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
            Object.keys(production).forEach((code) => {
                if (code !== PLAN_META_KEY) codes.add(code)
            })
        })
        if (selectedPlant) codes.add(selectedPlant)
        return [...codes].sort()
    }, [currentRows, selectedPlant])

    /** Fetch detail-order ticket data for every working day in the current
     *  range whose schedule we already loaded. Per-day fetches run in
     *  parallel; cached entries are skipped so changing window/comparison
     *  doesn't redo work. The bucket only retains a few weeks of history
     *  reliably — older days will return empty maps and silently drop out
     *  of the satisfaction score (as expected). */
    useEffect(() => {
        if (!satisfactionEnabled) return undefined
        const allDays = [...currentDays, ...previousDays]
        if (allDays.length === 0) return undefined
        let cancelled = false
        // Defensive filter: drop empty/falsy plan_dates so a malformed row
        // can't fan out to a request storm.
        const dates = [...new Set(allDays.map((d) => d.planDate).filter(Boolean))].filter((d) => !(d in detailByDay))
        if (dates.length === 0) return undefined
        setSatisfactionLoading(true)
        // ONE chunked range request instead of N per-date round-trips. For a
        // year window this drops from ~313 fetches to ~11. Empty entries
        // come back keyed by date so re-renders don't re-fetch them.
        DispatchDataService.fetchDetailByDateRange(dates)
            .then((rangeMap) => {
                if (cancelled) return
                setDetailByDay((prev) => {
                    const next = { ...prev }
                    dates.forEach((date) => {
                        next[date] = rangeMap?.[date] || {}
                    })
                    return next
                })
            })
            .catch((err) => {
                if (!cancelled) console.warn('[usePlanStatistics] satisfaction range fetch failed', err)
            })
            .finally(() => {
                if (!cancelled) setSatisfactionLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [currentDays, previousDays, detailByDay, satisfactionEnabled])

    /** Flat list of every live order in the active window, tagged with its
     *  plant + date. Built ONCE so per-plant memos can bucket without
     *  re-walking rows or calling `computeScheduleMetrics`. Always covers
     *  all plants — the plant comparison chart needs the unfiltered set. */
    const flatOrders = useMemo(
        () => (satisfactionEnabled ? flattenLiveOrders(currentRows) : []),
        [currentRows, satisfactionEnabled]
    )

    /** Merged detail map across every loaded date — built once and reused
     *  by every aggregate. `computeCustomerSatisfaction` looks orders up by
     *  orderId so the keys are flat across dates. */
    const mergedDetail = useMemo(() => {
        if (!satisfactionEnabled) return {}
        const out = {}
        Object.values(detailByDay).forEach((map) => {
            if (!map) return
            Object.entries(map).forEach(([orderId, entry]) => {
                out[orderId] = entry
            })
        })
        return out
    }, [detailByDay, satisfactionEnabled])

    /** Per-plant load attribution — splits each plant's slice into:
     *
     *    ordered     = sum of order yardage where this plant is the home plant
     *                  (ie. the plant that owns / scheduled the order). Pulled
     *                  from the schedule HTML, not from tickets — represents
     *                  the demand assigned to this plant.
     *    loaded      = sum of TICKET yardage for those same orders, regardless
     *                  of which plant actually loaded the truck. This is what
     *                  the customer ultimately got delivered toward this
     *                  plant's orders.
     *    selfLoaded  = ticket yardage where the loading plant matches the
     *                  order's home plant.
     *    crossInYards = loaded − selfLoaded. Help RECEIVED — sibling plants
     *                  loaded these trucks for this plant's orders.
     *    crossOutYards = ticket yardage where this plant LOADED a truck for
     *                  another plant's order. Help GIVEN.
     *
     *  Returns a map keyed by plant code so the scorecard table can join in
     *  O(1). Empty map when ticket data isn't available for the window. */
    const perPlantLoadAttribution = useMemo(() => {
        const out = {}
        const getEntry = (code) => {
            if (!out[code]) {
                out[code] = {
                    code,
                    crossInYards: 0,
                    crossOutYards: 0,
                    loaded: 0,
                    ordered: 0,
                    selfLoaded: 0
                }
            }
            return out[code]
        }
        // Ordered side — runs even when detail data isn't loaded yet so
        // the table can show ordered yardage as soon as the schedule
        // arrives, then back-fill loaded/cross numbers when tickets land.
        currentDays.forEach((day) => {
            const dayOrders = day.allLiveOrders || []
            dayOrders.forEach((order) => {
                const homePlant = order?.plantCode
                if (!homePlant) return
                getEntry(homePlant).ordered += parseFloat(order?.yardage) || 0
            })
        })
        // Loaded + cross-loaded side — only when we have ticket data.
        if (Object.keys(mergedDetail).length > 0) {
            currentDays.forEach((day) => {
                const dayOrders = day.allLiveOrders || []
                dayOrders.forEach((order) => {
                    const homePlant = order?.plantCode
                    if (!homePlant || !order?.orderId) return
                    const detail = mergedDetail[order.orderId]
                    if (!detail || typeof detail.byPlant !== 'object') return
                    Object.entries(detail.byPlant).forEach(([loaderPlant, slice]) => {
                        const loadedYards = parseFloat(slice?.loadedYardage) || 0
                        if (loadedYards <= 0) return
                        // Attribute the loaded yards to the order's home plant.
                        const home = getEntry(homePlant)
                        home.loaded += loadedYards
                        if (loaderPlant === homePlant) {
                            home.selfLoaded += loadedYards
                        } else {
                            home.crossInYards += loadedYards
                            // The loader plant gave help to another plant.
                            getEntry(loaderPlant).crossOutYards += loadedYards
                        }
                    })
                })
            })
        }
        return out
    }, [currentDays, mergedDetail])

    /** Per-day satisfaction. Walks each day's orders ONCE, hits the shared
     *  detail map. Null entries mean we have no ticket data for that day. */
    const satisfactionByDay = useMemo(() => {
        if (!satisfactionEnabled) return {}
        const out = {}
        currentDays.forEach((d) => {
            const detail = detailByDay[d.planDate]
            if (!detail) {
                out[d.planDate] = null
                return
            }
            out[d.planDate] = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
        })
        return out
    }, [currentDays, detailByDay, satisfactionEnabled])

    /** Period-aggregated satisfaction — single call across the entire
     *  active window, using each day's plant-filtered allLiveOrders so
     *  the aggregate respects `selectedPlant`. */
    const satisfactionAggregate = useMemo(() => {
        if (!satisfactionEnabled || !currentDays.length) return null
        const orders = []
        currentDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
        if (!orders.length) return null
        return computeCustomerSatisfaction(orders, mergedDetail)
    }, [currentDays, mergedDetail, satisfactionEnabled])

    /** Same shape, computed against the comparison window. Also respects
     *  the active plant filter via `previousDays`. */
    const previousSatisfactionAggregate = useMemo(() => {
        if (!satisfactionEnabled || comparison === 'none') return null
        if (!previousDays.length) return null
        const orders = []
        previousDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
        if (!orders.length) return null
        return computeCustomerSatisfaction(orders, mergedDetail)
    }, [previousDays, mergedDetail, comparison, satisfactionEnabled])

    /** Per-day satisfaction trend across the entire active range, padded so
     *  missing days show as gaps in the chart instead of compressing the
     *  X axis. Each entry carries:
     *    - `score` — that day's good-rate (binary good/bad, can be 0/100)
     *    - `rollingScore` — trailing 7-working-day good-rate (smoother
     *      signal that doesn't whiplash on tiny sample sizes)
     *    - `samples` / `goodService` / `badService` — raw counts the chart
     *      tooltip surfaces
     *
     *  The cursor walk uses `parseIsoLocal` instead of `new Date(iso)` so
     *  the loop actually advances in negative-UTC timezones (a string ISO
     *  date parsed by `new Date` is interpreted as UTC midnight, which
     *  rolls back a day in local time on the western hemisphere — the
     *  previous walk got stuck on `range.current.start`). */
    const satisfactionTrend = useMemo(() => {
        if (!satisfactionEnabled) return []
        if (!currentDays.length) return []
        const cursor = parseIsoLocal(range.current.start)
        const endDate = parseIsoLocal(range.current.end)
        if (!cursor || !endDate) return []

        const dayByDate = new Map(currentDays.map((d) => [d.planDate, d]))

        // Phase 1: walk every working day in range, scoring each individually.
        const dailyStats = []
        let safety = 366 * 5
        while (cursor <= endDate && safety > 0) {
            if (cursor.getDay() !== 0) {
                const iso = isoDate(cursor)
                const day = dayByDate.get(iso) || null
                const detail = detailByDay[iso]
                const result = day && detail ? computeCustomerSatisfaction(day.allLiveOrders || [], detail) : null
                dailyStats.push({
                    badService: result ? result.badService : 0,
                    date: iso,
                    goodService: result ? result.goodService : 0,
                    samples: result ? result.samples : 0,
                    score: result ? Math.round(result.score * 100) : null
                })
            }
            cursor.setDate(cursor.getDate() + 1)
            safety -= 1
        }

        // Phase 2: stamp each row with the trailing 7-working-day good-rate
        // so the chart can render a smooth secondary line. Same totals,
        // just summed across the rolling window — much more stable than
        // single-day binary scores when a day only has a couple orders.
        return dailyStats.map((stat, idx) => {
            const sliceStart = Math.max(0, idx - 6)
            let rollingGood = 0
            let rollingSamples = 0
            for (let i = sliceStart; i <= idx; i += 1) {
                rollingGood += dailyStats[i].goodService
                rollingSamples += dailyStats[i].samples
            }
            return {
                ...stat,
                rollingSamples,
                rollingScore: rollingSamples > 0 ? Math.round((rollingGood / rollingSamples) * 100) : null
            }
        })
    }, [currentDays, detailByDay, satisfactionEnabled, range])

    /** ISO date midway through the active window — used to split each
     *  plant's order set into "first half" vs "second half" so we can show
     *  whether each plant is improving / declining within the period. */
    const windowMidpointIso = useMemo(() => {
        if (!range?.current?.start || !range?.current?.end) return null
        const start = new Date(`${range.current.start}T00:00:00`)
        const end = new Date(`${range.current.end}T00:00:00`)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
        return isoDate(new Date((start.getTime() + end.getTime()) / 2))
    }, [range])

    /** Per-plant satisfaction with first-half vs second-half trajectory.
     *  Single pass over `flatOrders` to bucket by plant + half, then one
     *  satisfaction calc per plant + per-half. Includes a "trajectory" tag
     *  ("improving" / "declining" / "stable") + the delta in points so the
     *  redesigned page can render an arrow next to each plant card. */
    const perPlantSatisfaction = useMemo(() => {
        if (!satisfactionEnabled) return []
        if (!flatOrders.length) return []
        const byPlant = new Map()
        flatOrders.forEach(({ order, plantCode, planDate }) => {
            if (!byPlant.has(plantCode)) {
                byPlant.set(plantCode, { firstHalf: [], orders: [], secondHalf: [], yardage: 0 })
            }
            const bucket = byPlant.get(plantCode)
            bucket.orders.push(order)
            bucket.yardage += parseFloat(order?.yardage) || 0
            if (windowMidpointIso && planDate < windowMidpointIso) bucket.firstHalf.push(order)
            else bucket.secondHalf.push(order)
        })
        const out = []
        byPlant.forEach((entry, code) => {
            const aggregate = computeCustomerSatisfaction(entry.orders, mergedDetail)
            if (!aggregate) return
            const first = entry.firstHalf.length ? computeCustomerSatisfaction(entry.firstHalf, mergedDetail) : null
            const second = entry.secondHalf.length ? computeCustomerSatisfaction(entry.secondHalf, mergedDetail) : null
            const delta = first && second ? Math.round(second.score * 100) - Math.round(first.score * 100) : null
            const trajectory = delta == null ? 'stable' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'
            out.push({
                badService: aggregate.badService,
                code,
                delta,
                goodService: aggregate.goodService,
                samples: aggregate.samples,
                score: Math.round(aggregate.score * 100),
                trajectory,
                yardage: Math.round(entry.yardage)
            })
        })
        return out.sort((a, b) => a.score - b.score)
    }, [flatOrders, mergedDetail, windowMidpointIso, satisfactionEnabled])

    /** Day-of-week satisfaction breakdown — average score Mon–Sat across
     *  the active window. */
    const satisfactionByWeekday = useMemo(() => {
        if (!satisfactionEnabled) return []
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const buckets = labels.map((label) => ({ count: 0, label, samples: 0, scoreSum: 0 }))
        currentDays.forEach((d) => {
            const detail = detailByDay[d.planDate]
            if (!detail) return
            const result = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
            if (!result) return
            const date = d.planDate ? new Date(`${d.planDate}T00:00:00`) : null
            if (!date || Number.isNaN(date.getTime())) return
            const dow = date.getDay() // 0 Sun … 6 Sat
            if (dow === 0) return
            const bucket = buckets[dow - 1]
            bucket.scoreSum += result.score * 100
            bucket.count += 1
            bucket.samples += result.samples
        })
        return buckets.map((b) => ({
            label: b.label,
            samples: b.samples,
            score: b.count > 0 ? Math.round(b.scoreSum / b.count) : null
        }))
    }, [currentDays, detailByDay, satisfactionEnabled])

    /** Per-order scored list — the hottest single pass on the page. Used by
     *  worst-orders, worst-customers, and the score-distribution histogram.
     *  Filters by `selectedPlant` when active. */
    const scoredOrders = useMemo(() => {
        if (!satisfactionEnabled || !flatOrders.length) return []
        const out = []
        flatOrders.forEach(({ order, plantCode, planDate: orderDate }) => {
            if (selectedPlant && plantCode !== selectedPlant) return
            const detail = order?.orderId ? mergedDetail[order.orderId] : null
            const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
            if (!tickets.length) return
            const result = computeCustomerSatisfaction([order], { [order.orderId]: detail })
            if (!result || result.samples === 0) return
            out.push({
                customer: (order.customer || '').trim() || 'Unknown',
                isBad: result.badService > 0,
                orderNum: order.orderNum || '',
                planDate: orderDate,
                plantCode,
                productCode: (order.productCode || '').trim() || '',
                score: Math.round(result.score * 100),
                yardage: parseFloat(order.yardage) || 0
            })
        })
        return out
    }, [flatOrders, mergedDetail, selectedPlant, satisfactionEnabled])

    /** Bad orders surfaced for follow-up — every order flagged "bad" by
     *  the shared late-or-slow rule, sorted by yardage desc so the largest
     *  pours float to the top. The list is now a strict good/bad split,
     *  not a weighted ranking. */
    const satisfactionWorstOrders = useMemo(
        () =>
            scoredOrders
                .filter((row) => row.isBad)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, 8),
        [scoredOrders]
    )

    /** Customers with any bad service in the window. Each row is the count
     *  + yardage of bad orders for that customer; surfaced only when the
     *  customer has at least one bad order. */
    const satisfactionWorstCustomers = useMemo(() => {
        if (!scoredOrders.length) return []
        const byCustomer = new Map()
        scoredOrders.forEach((row) => {
            if (!byCustomer.has(row.customer)) {
                byCustomer.set(row.customer, {
                    badOrders: 0,
                    customer: row.customer,
                    samples: 0,
                    yardage: 0
                })
            }
            const bucket = byCustomer.get(row.customer)
            bucket.samples += 1
            if (row.isBad) {
                bucket.badOrders += 1
                bucket.yardage += row.yardage
            }
        })
        const out = []
        byCustomer.forEach((entry) => {
            if (entry.badOrders === 0) return
            out.push({
                badOrders: entry.badOrders,
                customer: entry.customer,
                samples: entry.samples,
                yardage: Math.round(entry.yardage)
            })
        })
        return out.sort((a, b) => b.badOrders - a.badOrders || b.yardage - a.yardage).slice(0, 6)
    }, [scoredOrders])

    /** Momentum — last 7 working days inside the window vs the 7 before
     *  that, so the user can see whether things are heading the right way
     *  even on a long period. Returns null when the window is too short. */
    const satisfactionMomentum = useMemo(() => {
        if (!satisfactionEnabled || !currentDays.length) return null
        const sorted = [...currentDays].sort((a, b) => (a.planDate || '').localeCompare(b.planDate || ''))
        if (sorted.length < 4) return null
        const recent = sorted.slice(-7)
        const prior = sorted.slice(-14, -7)
        const collectOrders = (days) => {
            const out = []
            days.forEach((d) => (d.allLiveOrders || []).forEach((o) => out.push(o)))
            return out
        }
        const recentResult = computeCustomerSatisfaction(collectOrders(recent), mergedDetail)
        const priorResult = computeCustomerSatisfaction(collectOrders(prior), mergedDetail)
        if (!recentResult && !priorResult) return null
        const recentScore = recentResult ? Math.round(recentResult.score * 100) : null
        const priorScore = priorResult ? Math.round(priorResult.score * 100) : null
        const delta = recentScore != null && priorScore != null ? recentScore - priorScore : null
        return {
            delta,
            prior: priorResult ? { samples: priorResult.samples, score: priorScore } : { samples: 0, score: null },
            recent: recentResult ? { samples: recentResult.samples, score: recentScore } : { samples: 0, score: null },
            trajectory: delta == null ? 'stable' : delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'
        }
    }, [currentDays, mergedDetail, satisfactionEnabled])

    const currentSummary = useMemo(() => aggregateMetrics(currentDays), [currentDays])
    const previousSummary = useMemo(
        () => (comparison === 'none' ? null : aggregateMetrics(previousDays)),
        [previousDays, comparison]
    )

    const trendData = useMemo(
        () => (currentDays.length === 0 ? [] : padTrend(range.current.start, range.current.end, currentDays)),
        [currentDays, range]
    )
    const trendComparison = useMemo(
        () =>
            comparison !== 'none' && range.previous && previousDays.length > 0
                ? padTrend(range.previous.start, range.previous.end, previousDays)
                : null,
        [previousDays, range, comparison]
    )

    return {
        anchor,
        availablePlantCodes,
        comparison,
        currentDays,
        currentSummary,
        customEnd,
        customStart,
        isSingleDay,
        loading,
        perPlantLoadAttribution,
        perPlantSatisfaction,
        period,
        previousSatisfactionAggregate,
        previousSummary,
        range,
        satisfactionAggregate,
        satisfactionByDay,
        satisfactionByWeekday,
        satisfactionLoading,
        satisfactionMomentum,
        satisfactionTrend,
        satisfactionWorstCustomers,
        satisfactionWorstOrders,
        selectedPlant,
        setAnchor,
        setComparison,
        setCustomEnd,
        setCustomStart,
        setPeriod,
        setSelectedPlant,
        trendComparison,
        trendData,
        workingDayCount
    }
}

export default usePlanStatistics
