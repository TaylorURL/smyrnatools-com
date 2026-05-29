import { DEFAULT_STAGGER_MINUTES } from '../../app/constants/planConstants'
import { timeToMinutes } from './planTime'

/**
 * Per-driver arrive + leave times for a planner assignment. Respects both
 * scheduling modes:
 *   - `timeMode: 'stagger'` — each driver lands `staggerMinutes` after the
 *     previous one, starting from `time`. Leave time applies to all.
 *   - `timeMode: 'custom'` — arrive and leave come from `customTimes[i]`.
 *
 * Every downstream consumer (pool simulation, help rows, flow-view time
 * scrubber) should build events from this function so the whole app treats
 * staggered crew arrivals/returns identically.
 *
 * @returns {Array<{ driverIndex, arriveMin, leaveMin }>}
 */
export const buildAssignmentDriverTimes = (assignment) => {
    const count = parseInt(assignment?.driverCount, 10) || 0
    if (count <= 0) return []
    const stagger = parseInt(assignment?.staggerMinutes, 10) || 0
    const isCustom = assignment?.timeMode === 'custom' && Array.isArray(assignment?.customTimes)
    const baseArrive = timeToMinutes(assignment?.time)
    const baseLeave = timeToMinutes(assignment?.leaveTime)
    const result = []
    for (let i = 0; i < count; i++) {
        let arriveMin = null
        let leaveMin = null
        if (isCustom) {
            const ct = assignment.customTimes[i] || {}
            arriveMin = timeToMinutes(ct.time)
            leaveMin = timeToMinutes(ct.leaveTime)
        } else {
            if (Number.isFinite(baseArrive)) arriveMin = baseArrive + i * stagger
            leaveMin = baseLeave
        }
        result.push({
            arriveMin: Number.isFinite(arriveMin) ? arriveMin : null,
            driverIndex: i,
            leaveMin: Number.isFinite(leaveMin) ? leaveMin : null
        })
    }
    return result
}

/**
 * True when an assignment supplies a finite arrival AND leave time for every
 * operator it sends — across both stagger and custom modes. Sending help
 * requires both ends of each operator's trip: without them the pool
 * simulation and flow view can't place the operator on the timeline, so the
 * route editor blocks the save.
 */
export const isAssignmentTimingComplete = (assignment) => {
    const driverTimes = buildAssignmentDriverTimes(assignment)
    if (driverTimes.length === 0) return false
    return driverTimes.every((dt) => Number.isFinite(dt.arriveMin) && Number.isFinite(dt.leaveMin))
}

/**
 * Minutes for a help crew's drive home: the destination→home leg when the
 * travel table knows it, otherwise the outbound home→destination leg (travel
 * tables are usually symmetric), otherwise 0.
 *
 * Shared by every help-transfer builder so the home plant is credited back at
 * the same moment across the Schedule, Flow, and Dashboard pools — they used
 * to compute this inline and drifted (Flow/Dashboard credited the home plant
 * the instant the crew left the destination, ignoring the drive home).
 *
 * `getTravelTime(fromPlant, toPlant)` returns minutes between plants, or any
 * non-finite value when unknown.
 */
export const resolveReturnTravelMinutes = (getTravelTime, fromPlant, toPlant, returnPlant) => {
    if (typeof getTravelTime !== 'function') return 0
    const returnLeg = getTravelTime(toPlant, returnPlant)
    if (Number.isFinite(returnLeg)) return returnLeg
    const outboundLeg = getTravelTime(fromPlant, toPlant)
    return Number.isFinite(outboundLeg) ? outboundLeg : 0
}

let assignmentIdCounter = Date.now()
export const nextAssignmentId = () => ++assignmentIdCounter

export const createEmptyAssignment = () => ({
    customTimes: [],
    driverCount: 1,
    fromPlant: '',
    id: nextAssignmentId(),
    leaveTime: '',
    staggerMinutes: DEFAULT_STAGGER_MINUTES,
    time: '',
    timeMode: 'stagger',
    toPlant: ''
})

export const ensureUniqueIds = (assignments) => {
    const seen = new Set()
    return assignments.map((a) => {
        if (!a.id || seen.has(a.id)) {
            return { ...a, id: nextAssignmentId() }
        }
        seen.add(a.id)
        return a
    })
}
