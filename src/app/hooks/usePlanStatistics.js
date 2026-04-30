import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { PlanService } from '../../services/PlanService'
import {
    aggregateMetrics,
    buildRange,
    computeScheduleMetrics,
    countWorkingDays,
    isoDate,
    isSundayIso,
    padTrend
} from '../../utils/PlanStatisticsUtility'
import { computeCustomerSatisfaction, PLAN_META_KEY } from '../../utils/PlanUtility'

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
 */
export function usePlanStatistics({ planDate, liveProduction }) {
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
                const [fetchedCurrent, fetchedPrevious] = await Promise.all([
                    PlanService.fetchPlansInRange(range.current.start, range.current.end),
                    range.previous
                        ? PlanService.fetchPlansInRange(range.previous.start, range.previous.end)
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
        if (currentDays.length === 0) return undefined
        let cancelled = false
        const dates = currentDays.map((d) => d.planDate).filter((d) => !(d in detailByDay))
        if (dates.length === 0) return undefined
        setSatisfactionLoading(true)
        Promise.all(dates.map((date) => DispatchDataService.fetchDetailByOrderId(date).catch(() => ({}))))
            .then((results) => {
                if (cancelled) return
                setDetailByDay((prev) => {
                    const next = { ...prev }
                    dates.forEach((date, idx) => {
                        next[date] = results[idx] || {}
                    })
                    return next
                })
            })
            .finally(() => {
                if (!cancelled) setSatisfactionLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [currentDays, detailByDay])

    /** Per-day satisfaction (using the shared `computeCustomerSatisfaction`
     *  with the same inputs as the Schedule tab). Null entries mean we have
     *  no ticket data for that day yet. */
    const satisfactionByDay = useMemo(() => {
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
    }, [currentDays, detailByDay])

    /** Period-aggregated satisfaction. Computed by feeding the FULL flat
     *  order list and the merged detail map into the same shared function
     *  that the Schedule tab uses — the math stays identical. */
    const satisfactionAggregate = useMemo(() => {
        if (!currentDays.length) return null
        const allOrders = []
        const mergedDetail = {}
        let anyDetailFetched = false
        currentDays.forEach((d) => {
            const liveOrders = d.allLiveOrders || []
            liveOrders.forEach((o) => allOrders.push(o))
            const detail = detailByDay[d.planDate]
            if (detail) {
                anyDetailFetched = true
                Object.entries(detail).forEach(([orderId, entry]) => {
                    mergedDetail[orderId] = entry
                })
            }
        })
        if (!anyDetailFetched) return null
        return computeCustomerSatisfaction(allOrders, mergedDetail)
    }, [currentDays, detailByDay])

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
        period,
        previousSummary,
        range,
        satisfactionAggregate,
        satisfactionByDay,
        satisfactionLoading,
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
