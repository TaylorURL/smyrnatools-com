import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { PlanService } from '../../services/PlanService'
import { PLAN_META_KEY, sumPlanYardage } from '../../utils/PlanDashboardUtility'
import { applyLoadingPlantReassignment } from '../../utils/PlanScheduleUtility'
import { isExcludedOrder } from '../../utils/PlanUtility'
import ReportUtility from '../../utils/ReportUtility'
import { useDetailOrders } from './useDetailOrders'

const PLANT_PRODUCTION_KEYS = (production) =>
    production ? Object.keys(production).filter((code) => code !== PLAN_META_KEY) : []

const normalizePlantCode = (code) => String(code || '').trim()

const buildPlantPredicate = (plantSet) => {
    const isFiltering = plantSet instanceof Set && plantSet.size > 0
    if (!isFiltering) return () => true
    return (code) => plantSet.has(normalizePlantCode(code))
}

/** Per-plant rollup of real (non-excluded) orders only. The dispatch
 *  service's prebuilt `totalYardage` blindly sums every row, including
 *  cancelled (17:00) and test (18:00) sentinels — recompute from the
 *  filtered orders so the dashboard never inflates the day's numbers. */
const summarizePlantSchedule = (block) => {
    const orders = Array.isArray(block?.orders) ? block.orders : []
    const realOrders = orders.filter((o) => !isExcludedOrder(o))
    const yardage = realOrders.reduce((sum, o) => sum + (parseFloat(o?.yardage) || 0), 0)
    const firstJobTime =
        realOrders
            .map((o) => o?.startTime)
            .filter((t) => /^\d{1,2}:\d{2}$/.test(String(t || '')))
            .map((t) => String(t).padStart(5, '0'))
            .sort()[0] || null
    return { firstJobTime, orderCount: realOrders.length, yardage }
}

/**
 * Aggregates today's dispatch plan + schedule into a flat snapshot for the
 * Dashboard. Pulls the saved plan (assignments, plant_production) plus the
 * day's actual order schedule so the dashboard surfaces both the "what's
 * planned" and "what's coming in from dispatch" views. When `plantSet` is
 * provided, totals and rows are restricted to those plants so the section
 * stays in sync with the dashboard's region/plant filter.
 */
export function useDashboardSchedule({ plantSet, refreshKey } = {}) {
    const [loading, setLoading] = useState(true)
    const [planDate, setPlanDate] = useState(() => ReportUtility.getTodayISODate())
    const [plan, setPlan] = useState(null)
    const [schedule, setSchedule] = useState({})
    // Live ticket data — drives the same loading-plant reassignment the
    // Schedule tab applies, so dashboard per-plant totals match once the
    // day's first tickets start loading.
    const { detailByOrderId } = useDetailOrders(planDate)

    useEffect(() => {
        let cancelled = false
        const today = ReportUtility.getTodayISODate()
        setPlanDate(today)
        setLoading(true)
        Promise.all([
            PlanService.fetchPlan(today).catch(() => null),
            DispatchDataService.fetchSchedule(today).catch(() => ({}))
        ])
            .then(([planRow, scheduleByPlant]) => {
                if (cancelled) return
                setPlan(planRow)
                setSchedule(scheduleByPlant || {})
                setLoading(false)
            })
            .catch(() => {
                if (cancelled) return
                setPlan(null)
                setSchedule({})
                setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [refreshKey])

    return useMemo(() => {
        const isPlantAllowed = buildPlantPredicate(plantSet)
        const plantProduction = plan?.plant_production || {}
        const assignments = Array.isArray(plan?.assignments) ? plan.assignments : []
        // Re-bucket fully-loaded orders onto the plant that actually loaded
        // them — mirrors what PlanScheduleView does, so the dashboard's
        // per-plant rollup stays in sync with the Schedule tab as tickets
        // come in. No-op until ticket details have loaded.
        const reassignedSchedule = applyLoadingPlantReassignment(schedule, detailByOrderId)
        const scheduledPlantCodes = PLANT_PRODUCTION_KEYS(reassignedSchedule).filter(isPlantAllowed)

        // Per-plant rollups — exclude cancelled/test orders so totals match
        // what the Schedule tab shows for "real" production.
        const plantSummaries = scheduledPlantCodes.map((code) => ({
            code,
            ...summarizePlantSchedule(reassignedSchedule[code])
        }))
        const orderCount = plantSummaries.reduce((sum, row) => sum + row.orderCount, 0)
        const scheduledYardage = plantSummaries.reduce((sum, row) => sum + row.yardage, 0)

        const filteredPlantProduction = Object.fromEntries(
            Object.entries(plantProduction).filter(([code]) => code === PLAN_META_KEY || isPlantAllowed(code))
        )
        const planYardage = sumPlanYardage(filteredPlantProduction)

        // Movement assignments belong to the schedule slice when either end
        // sits inside the active plant filter — drop transfers that touch
        // neither selected plant so totals reflect the visible scope.
        const validAssignments = assignments.filter(
            (a) => a?.fromPlant && a?.toPlant && a?.time && (isPlantAllowed(a.fromPlant) || isPlantAllowed(a.toPlant))
        )
        const totalOps = validAssignments.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
        const sendingPlants = new Set(validAssignments.map((a) => a.fromPlant)).size
        const receivingPlants = new Set(validAssignments.map((a) => a.toPlant)).size

        const earliestArrival = validAssignments
            .map((a) => a.time)
            .filter(Boolean)
            .sort()[0]
        const earliestFirstJob = plantSummaries
            .map((row) => row.firstJobTime)
            .filter(Boolean)
            .sort()[0]

        const plantRows = plantSummaries
            .map(({ code, firstJobTime, orderCount: rowOrders, yardage }) => ({
                code,
                firstJobTime,
                orderCount: rowOrders,
                yardage
            }))
            .filter((row) => row.yardage > 0 || row.orderCount > 0)
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

        return {
            earliestArrival: earliestArrival || null,
            earliestFirstJob: earliestFirstJob || null,
            hasPlan: !!plan,
            loading,
            orderCount,
            plantRows,
            planDate,
            planYardage,
            receivingPlants,
            routeCount: validAssignments.length,
            scheduledPlants: plantRows.length,
            scheduledYardage,
            sendingPlants,
            totalOps
        }
    }, [detailByOrderId, loading, plan, planDate, plantSet, schedule])
}
