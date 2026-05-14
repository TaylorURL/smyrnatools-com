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
