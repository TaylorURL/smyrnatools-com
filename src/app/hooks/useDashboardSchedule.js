import { useEffect, useMemo, useState } from 'react'

import { DispatchDataService } from '../../services/DispatchDataService'
import { PlanService } from '../../services/PlanService'
import { PLAN_META_KEY, sumPlanYardage } from '../../utils/PlanDashboardUtility'
import ReportUtility from '../../utils/ReportUtility'

const PLANT_PRODUCTION_KEYS = (production) =>
    production ? Object.keys(production).filter((code) => code !== PLAN_META_KEY) : []

/**
 * Aggregates today's dispatch plan + schedule into a flat snapshot for the
 * Dashboard. Pulls the saved plan (assignments, plant_production) plus the
 * day's actual order schedule so the dashboard surfaces both the "what's
 * planned" and "what's coming in from dispatch" views.
 */
export function useDashboardSchedule({ refreshKey } = {}) {
    const [loading, setLoading] = useState(true)
    const [planDate, setPlanDate] = useState(() => ReportUtility.getTodayISODate())
    const [plan, setPlan] = useState(null)
    const [schedule, setSchedule] = useState({})

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
        const plantProduction = plan?.plant_production || {}
        const assignments = Array.isArray(plan?.assignments) ? plan.assignments : []
        const scheduledPlantCodes = PLANT_PRODUCTION_KEYS(schedule)
        const orderCount = scheduledPlantCodes.reduce(
            (sum, code) => sum + (Array.isArray(schedule[code]?.orders) ? schedule[code].orders.length : 0),
            0
        )
        const scheduledYardage = scheduledPlantCodes.reduce(
            (sum, code) => sum + (Number(schedule[code]?.totalYardage) || 0),
            0
        )
        const planYardage = sumPlanYardage(plantProduction)

        const validAssignments = assignments.filter((a) => a?.fromPlant && a?.toPlant && a?.time)
        const totalOps = validAssignments.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
        const sendingPlants = new Set(validAssignments.map((a) => a.fromPlant)).size
        const receivingPlants = new Set(validAssignments.map((a) => a.toPlant)).size

        const earliestArrival = validAssignments
            .map((a) => a.time)
            .filter(Boolean)
            .sort()[0]
        const earliestFirstJob = scheduledPlantCodes
            .map((code) => schedule[code]?.firstJobTime)
            .filter(Boolean)
            .sort()[0]

        const plantRows = scheduledPlantCodes
            .map((code) => ({
                code,
                firstJobTime: schedule[code]?.firstJobTime || null,
                orderCount: Array.isArray(schedule[code]?.orders) ? schedule[code].orders.length : 0,
                yardage: Number(schedule[code]?.totalYardage) || 0
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
            scheduledPlants: scheduledPlantCodes.length,
            scheduledYardage,
            sendingPlants,
            totalOps
        }
    }, [loading, plan, planDate, schedule])
}
