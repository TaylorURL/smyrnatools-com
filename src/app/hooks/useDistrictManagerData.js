import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { PlanService } from '../../services/PlanService'
import { buildColocationMap, EMPTY_COLOCATION_MAP } from '../../utils/PlantColocationUtility'
import { isExcludedOrder } from '../../utils/PlanUtility'
import { ReportUtility } from '../../utils/ReportUtility'
import { useHelpCrossLoadingStats } from './useHelpCrossLoadingStats'

const PLAN_META_KEY = '_meta'

/** ISO date strings (Mon–Sat) for the report's selected week. Mirrors the
 *  Plan-tab Mon–Sat window so the side-column totals line up exactly with
 *  what the Schedule view shows. */
export function getWeekDateStrings(weekIso) {
    const { monday } = ReportUtility.getWeekDatesFromIso(weekIso)
    if (!monday) return []
    const out = []
    for (let i = 0; i < 6; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        out.push(d.toISOString().slice(0, 10))
    }
    return out
}

/** Pull plant production for every Mon–Sat date in the week and return a
 *  `plantCode → totalYards` map. Uses the same shape and filter rules as
 *  PlanScheduleView (`plant_production[code].orders[]`, excluding test +
 *  cancelled sentinels). */
export function useWeeklyYardageByPlant(weekIso, allowedCodes) {
    const [yardageByPlant, setYardageByPlant] = useState({})
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        let cancelled = false
        const dates = getWeekDateStrings(weekIso)
        const codes = Array.isArray(allowedCodes) ? allowedCodes : []
        if (dates.length === 0 || codes.length === 0) {
            setYardageByPlant({})
            setLoading(false)
            return undefined
        }
        setLoading(true)
        const allowedSet = new Set(codes)
        Promise.allSettled(dates.map((d) => PlanService.fetchPlan(d))).then((results) => {
            if (cancelled) return
            const totals = {}
            for (const code of codes) totals[code] = 0
            results.forEach((res) => {
                if (res.status !== 'fulfilled' || !res.value?.plant_production) return
                Object.entries(res.value.plant_production).forEach(([code, prod]) => {
                    if (code === PLAN_META_KEY || !allowedSet.has(code)) return
                    const orders = Array.isArray(prod?.orders) ? prod.orders : []
                    orders.forEach((o) => {
                        if (isExcludedOrder(o)) return
                        totals[code] += parseFloat(o?.yardage) || 0
                    })
                })
            })
            setYardageByPlant(totals)
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [weekIso, allowedCodes])
    return { loading, yardageByPlant }
}

/** Fetches everything the Statistics-tab "Help breakdown by plant" table
 *  needs and scopes it to the report's Mon–Sat week + the DM's district.
 *  Pulls the same saved-plan + ticket-detail pair the Plan-tab uses, runs
 *  them through the shared `useHelpCrossLoadingStats` so the numbers
 *  match exactly, and trims the giver-plant list to the DM's district
 *  primaries (so an outside-district plant that loaded for a district
 *  plant's order doesn't show as a giver row, but recipients still surface
 *  the cross-district flow). */
export function useDistrictHelpBreakdown({ districtPlantCodes, plants, weekIso }) {
    const [plansByDate, setPlansByDate] = useState({})
    const [detailByDay, setDetailByDay] = useState({})
    const [loading, setLoading] = useState(false)

    const weekDates = useMemo(() => getWeekDateStrings(weekIso), [weekIso])
    const startIso = weekDates[0] || ''
    const endIso = weekDates[weekDates.length - 1] || ''
    const range = useMemo(() => ({ current: { end: endIso, start: startIso } }), [startIso, endIso])

    useEffect(() => {
        if (!startIso || !endIso || weekDates.length === 0) {
            setPlansByDate({})
            setDetailByDay({})
            setLoading(false)
            return undefined
        }
        let cancelled = false
        setLoading(true)
        Promise.allSettled([
            PlanService.fetchPlansInRange(startIso, endIso),
            DispatchDataService.fetchDetailByDateRange(weekDates)
        ])
            .then(([plansResult, detailResult]) => {
                if (cancelled) return
                const plansMap = {}
                if (plansResult.status === 'fulfilled') {
                    (plansResult.value || []).forEach((row) => {
                        if (row?.plan_date) plansMap[row.plan_date] = row
                    })
                }
                setPlansByDate(plansMap)
                setDetailByDay(detailResult.status === 'fulfilled' ? detailResult.value || {} : {})
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [startIso, endIso, weekDates])

    const colocationMap = useMemo(() => buildColocationMap(plants) || EMPTY_COLOCATION_MAP, [plants])

    /* District primaries — district codes resolved through the co-location
     * map so 403/404 collapse to one bucket. Used to filter the
     * pre-seeded plantNameByCode AND to trim the hook's output to just
     * the DM's plants. */
    const districtPrimarySet = useMemo(() => {
        const out = new Set()
        const resolve = colocationMap?.resolvePrimary || EMPTY_COLOCATION_MAP.resolvePrimary
        ;(districtPlantCodes || []).forEach((code) => {
            const primary = resolve(code)
            if (primary) out.add(primary)
        })
        return out
    }, [districtPlantCodes, colocationMap])

    /* Restrict the pre-seed roster the hook uses to mint zero-activity
     * rows. Only district plants get a row by default; outside plants
     * still show in the recipient column when district plants helped
     * them, but never as their own giver row. */
    const plantNameByCode = useMemo(() => {
        const allowed = new Set(districtPlantCodes || [])
        const out = {}
        ;(plants || []).forEach((p) => {
            const code = p?.plant_code
            if (!code || !allowed.has(code)) return
            out[code] = p.plant_name || p.name || null
        })
        return out
    }, [plants, districtPlantCodes])

    const flatOrders = useMemo(() => {
        const out = []
        Object.entries(plansByDate).forEach(([planDate, row]) => {
            const production = row?.plant_production || {}
            Object.entries(production).forEach(([plantCode, prod]) => {
                if (plantCode === PLAN_META_KEY) return
                const orders = Array.isArray(prod?.orders) ? prod.orders : []
                orders.forEach((order) => {
                    if (isExcludedOrder(order)) return
                    out.push({ order, planDate, plantCode })
                })
            })
        })
        return out
    }, [plansByDate])

    const stats = useHelpCrossLoadingStats({
        colocationMap,
        detailByDay,
        flatOrders,
        plansByDate,
        plantNameByCode,
        range,
        selectedPlant: null
    })

    /* Final district scope filter — guards against the hook's
     * `ensureGiver` minting rows for outside-district plants when they
     * appear in `pairFacts` as a giver (e.g. a non-district plant
     * loading for a district plant's order). */
    const helpByGiverPlant = useMemo(
        () => (stats.helpByGiverPlant || []).filter((row) => districtPrimarySet.has(row.code)),
        [stats.helpByGiverPlant, districtPrimarySet]
    )

    return { colocationMap, helpByGiverPlant, loading, plantNameByCode, range }
}
