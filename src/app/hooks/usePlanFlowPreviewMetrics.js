import { useMemo } from 'react'

import {
    buildAssignmentDriverTimes,
    computePlantPoolTimeline,
    getEffectiveBase,
    TARGET_YPH,
    timeToMinutes
} from '../../utils/PlanUtility'

/**
 * Per-plant operator-hours/yph derivation reused for both the ring colour and
 * the leave-off slack calculation. Returns `null` when the inputs don't
 * support a meaningful number (no orders, no time window, zero ops).
 */
function computeYph(stat, prod) {
    const firstMins = timeToMinutes(prod.firstJobTime)
    const lastMins = timeToMinutes(prod.lastJobTime)
    const hours = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yardage = parseFloat(prod.totalYardage) || 0
    if (!hours || !yardage || stat.eff <= 0) return null
    return Math.round((yardage / (hours * stat.eff)) * 10) / 10
}

/**
 * Big-pour-aware pool simulation that the Planner tab uses, replayed for the
 * dashboard preview so its `Needs Help` / `Leave off` badges line up exactly
 * with the full PlanFlowView.
 *
 * Returns:
 *   - `yphByCode`  — yards-per-hour per plant (null when not computable).
 *   - `minPoolByCode` — minimum effective pool size encountered during the day.
 *   - `leaveOffByCode` — number of operators that could safely leave off
 *     while still hitting the day's target yph and peak demand.
 */
export function usePlanFlowPreviewMetrics({ allPlantStats, assignments, plantProduction }) {
    const yphByCode = useMemo(() => {
        const out = {}
        ;(allPlantStats || []).forEach((stat) => {
            out[stat.code] = computeYph(stat, plantProduction[stat.code] || {})
        })
        return out
    }, [allPlantStats, plantProduction])

    const minPoolByCode = useMemo(
        () => deriveMinPoolByCode(allPlantStats, assignments, plantProduction),
        [allPlantStats, assignments, plantProduction]
    )

    const leaveOffByCode = useMemo(() => {
        const out = {}
        ;(allPlantStats || []).forEach((stat) => {
            out[stat.code] = computeLeaveOff(stat, plantProduction[stat.code] || {}, minPoolByCode[stat.code])
        })
        return out
    }, [allPlantStats, plantProduction, minPoolByCode])

    return { leaveOffByCode, minPoolByCode, yphByCode }
}

function deriveMinPoolByCode(allPlantStats, assignments, plantProduction) {
    const flat = []
    ;(allPlantStats || []).forEach((stat) => {
        const orders = Array.isArray(plantProduction?.[stat.code]?.orders) ? plantProduction[stat.code].orders : []
        orders.forEach((order) => flat.push({ ...order, plantCode: stat.code }))
    })
    const initialPool = {}
    ;(allPlantStats || []).forEach((stat) => {
        if (!stat?.code) return
        const base = Number.isFinite(stat.base) ? stat.base : 0
        // Preview doesn't know the plan date, so no weekend adjustment;
        // still honour the missing-operator subtraction so the preview
        // matches the Planner / Schedule truth.
        initialPool[stat.code] = getEffectiveBase(base, stat.code, plantProduction, null)
    })
    const transfers = []
    ;(assignments || []).forEach((assignment) => {
        if (!assignment?.fromPlant || !assignment?.toPlant || assignment.fromPlant === assignment.toPlant) return
        const home = assignment.returnPlant || assignment.fromPlant
        buildAssignmentDriverTimes(assignment).forEach((dt) => {
            if (!Number.isFinite(dt.arriveMin)) return
            transfers.push({ delta: -1, plantCode: assignment.fromPlant, time: dt.arriveMin })
            transfers.push({ delta: 1, plantCode: assignment.toPlant, time: dt.arriveMin })
            if (Number.isFinite(dt.leaveMin) && dt.leaveMin > dt.arriveMin) {
                transfers.push({ delta: -1, plantCode: assignment.toPlant, time: dt.leaveMin })
                transfers.push({ delta: 1, plantCode: home, time: dt.leaveMin })
            }
        })
    })
    const byOrder = computePlantPoolTimeline(flat, initialPool, null, transfers)
    const out = {}
    Object.values(byOrder || {}).forEach((entry) => {
        const value = Number.isFinite(entry?.poolAfterDispatchEffective)
            ? entry.poolAfterDispatchEffective
            : entry?.poolAfterDispatch
        if (!entry?.plantCode || !Number.isFinite(value)) return
        const cur = out[entry.plantCode]
        if (cur == null || value < cur) out[entry.plantCode] = value
    })
    return out
}

function computeLeaveOff(stat, prod, minPool) {
    const firstMins = timeToMinutes(prod.firstJobTime)
    const lastMins = timeToMinutes(prod.lastJobTime)
    const hours = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yardage = parseFloat(prod.totalYardage) || 0
    if (!hours || yardage <= 0 || stat.eff <= 1) return 0
    const yphSlack = Math.max(0, stat.eff - Math.max(1, Math.ceil(yardage / (TARGET_YPH * hours))))
    const peakSlack = Number.isFinite(minPool) ? Math.max(0, minPool) : yphSlack
    return Math.max(0, Math.min(yphSlack, peakSlack))
}
