import { useMemo } from 'react'

import { flattenPlantOrders } from '../../utils/PlanFlowUtility'
import {
    buildAssignmentDriverTimes,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    getEffectiveBase,
    getOrderPourDurationMinutes,
    MAX_YPH,
    poolAtTime,
    TARGET_YPH,
    timeToMinutes
} from '../../utils/PlanUtility'

/**
 * Per-plant derived metrics for the flow canvas: YPH, pool timelines,
 * leave-off slack, and point-in-time view (active orders, pool, eff)
 * driven by an optional `viewTime` (minutes since midnight; null = all-day).
 */
export function usePlanFlowMetrics({ assignments, planDate, plantProduction, stats, viewTime }) {
    const yphByCode = useMemo(() => {
        const out = {}
        stats.forEach((stat) => {
            const production = plantProduction[stat.code] || {}
            const firstMins = timeToMinutes(production.firstJobTime)
            const lastMins = timeToMinutes(production.lastJobTime)
            const hours =
                firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
            const yardage = parseFloat(production.totalYardage) || 0
            out[stat.code] =
                hours && yardage && stat.eff > 0 ? Math.round((yardage / (hours * stat.eff)) * 10) / 10 : null
        })
        return out
    }, [stats, plantProduction])

    const flatOrders = useMemo(() => flattenPlantOrders(stats, plantProduction), [stats, plantProduction])

    const initialPoolByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((stat) => {
            if (!stat?.code) return
            const base = Number.isFinite(stat.base) ? stat.base : 0
            out[stat.code] = getEffectiveBase(base, stat.code, plantProduction, planDate)
        })
        return out
    }, [stats, plantProduction, planDate])

    const helpTransfers = useMemo(() => {
        const out = []
        ;(assignments || []).forEach((assignment) => {
            if (!assignment?.fromPlant || !assignment?.toPlant || assignment.fromPlant === assignment.toPlant) return
            const home = assignment.returnPlant || assignment.fromPlant
            buildAssignmentDriverTimes(assignment).forEach((driverTime) => {
                if (!Number.isFinite(driverTime.arriveMin)) return
                out.push({ delta: -1, plantCode: assignment.fromPlant, time: driverTime.arriveMin })
                out.push({ delta: 1, plantCode: assignment.toPlant, time: driverTime.arriveMin })
                if (Number.isFinite(driverTime.leaveMin) && driverTime.leaveMin > driverTime.arriveMin) {
                    out.push({ delta: -1, plantCode: assignment.toPlant, time: driverTime.leaveMin })
                    out.push({ delta: 1, plantCode: home, time: driverTime.leaveMin })
                }
            })
        })
        return out
    }, [assignments])

    const poolTimeline = useMemo(
        () => computePlantPoolTimeline(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )

    const poolTimelinesByPlant = useMemo(
        () => computePlantPoolTimelines(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )

    const minPoolByCode = useMemo(() => {
        const out = {}
        Object.values(poolTimeline || {}).forEach((entry) => {
            // Use the effective pool (counts help landing during the pour
            // window) so "needs help" doesn't light up when late-arriving
            // help already covers the deficit.
            const value = Number.isFinite(entry?.poolAfterDispatchEffective)
                ? entry.poolAfterDispatchEffective
                : entry?.poolAfterDispatch
            if (!entry?.plantCode || !Number.isFinite(value)) return
            const cur = out[entry.plantCode]
            if (cur == null || value < cur) out[entry.plantCode] = value
        })
        return out
    }, [poolTimeline])

    const leaveOffByCode = useMemo(() => {
        const out = {}
        stats.forEach((stat) => {
            const production = plantProduction[stat.code] || {}
            const firstMins = timeToMinutes(production.firstJobTime)
            const lastMins = timeToMinutes(production.lastJobTime)
            const hours =
                firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
            const yardage = parseFloat(production.totalYardage) || 0
            if (!hours || yardage <= 0 || stat.eff <= 1) {
                out[stat.code] = { adjustedYph: null, count: 0 }
                return
            }
            const yphSlack = Math.max(0, stat.eff - Math.max(1, Math.ceil(yardage / (TARGET_YPH * hours))))
            const minPool = minPoolByCode[stat.code]
            // If any order overbooked the plant (minPool < 0), can't leave
            // anyone off — plant actually needs more trucks, not fewer.
            // Otherwise cap leave-off at the idle-truck count during peak.
            const peakSlack = Number.isFinite(minPool) ? Math.max(0, minPool) : yphSlack
            const slack = Math.max(0, Math.min(yphSlack, peakSlack))
            const remaining = stat.eff - slack
            const adjustedYph =
                slack > 0 && remaining > 0 ? Math.round((yardage / (hours * remaining)) * 10) / 10 : null
            out[stat.code] = { adjustedYph, count: slack }
        })
        return out
    }, [stats, plantProduction, minPoolByCode])

    const activeOrdersAtTime = useMemo(() => {
        if (!Number.isFinite(viewTime)) return null
        const byPlant = {}
        flatOrders.forEach((order) => {
            const startMin = timeToMinutes(order?.startTime)
            if (!Number.isFinite(startMin)) return
            const key = order.orderId || `${order.plantCode ?? 'unknown'}-${startMin}-${order.orderNum ?? ''}`
            const entry = poolTimeline?.[key]
            const endMin = Number.isFinite(entry?.lastReturnMinutes)
                ? entry.lastReturnMinutes
                : startMin + (getOrderPourDurationMinutes(order) ?? 60)
            if (viewTime < startMin || viewTime > endMin) return
            const list = (byPlant[order.plantCode] ||= [])
            list.push({ endMin, order, startMin })
        })
        return byPlant
    }, [viewTime, flatOrders, poolTimeline])

    const poolAtViewTime = useMemo(() => {
        if (!Number.isFinite(viewTime)) return null
        const out = {}
        Object.entries(poolTimelinesByPlant || {}).forEach(([code, timeline]) => {
            out[code] = poolAtTime(timeline, viewTime)
        })
        return out
    }, [viewTime, poolTimelinesByPlant])

    const effAtViewTime = useMemo(() => {
        if (!Number.isFinite(viewTime)) return null
        const out = {}
        ;(stats || []).forEach((stat) => {
            if (stat?.code) out[stat.code] = Number.isFinite(stat.base) ? stat.base : 0
        })
        ;(assignments || []).forEach((assignment) => {
            if (!assignment?.fromPlant || !assignment?.toPlant || assignment.fromPlant === assignment.toPlant) return
            const home = assignment.returnPlant || assignment.fromPlant
            buildAssignmentDriverTimes(assignment).forEach((driverTime) => {
                if (!Number.isFinite(driverTime.arriveMin) || viewTime < driverTime.arriveMin) return
                const stillOut = !Number.isFinite(driverTime.leaveMin) || viewTime < driverTime.leaveMin
                if (stillOut) {
                    out[assignment.fromPlant] = (out[assignment.fromPlant] ?? 0) - 1
                    out[assignment.toPlant] = (out[assignment.toPlant] ?? 0) + 1
                } else if (home !== assignment.fromPlant) {
                    out[assignment.fromPlant] = (out[assignment.fromPlant] ?? 0) - 1
                    out[home] = (out[home] ?? 0) + 1
                }
            })
        })
        return out
    }, [viewTime, stats, assignments])

    return {
        activeOrdersAtTime,
        effAtViewTime,
        leaveOffByCode,
        minPoolByCode,
        poolAtViewTime,
        thresholds: { MAX_YPH, TARGET_YPH },
        yphByCode
    }
}
