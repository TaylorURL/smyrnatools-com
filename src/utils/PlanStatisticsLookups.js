/**
 * Lookup-Map builders extracted from `PlanStatisticsAggregators`.
 * Translate the mixer / operator rosters into Maps the hook consumes
 * elsewhere (employee id → mixer, name variant → operator, etc.).
 *
 * Each function is a deterministic transformation of its inputs — no
 * React, no refs, no module-level state.
 */
import { nameLookupVariants } from './OperatorNameLookupUtility'

/** Operator roster keyed by every canonical variant of the operator's
 *  name. Active records win on collisions so an inactive namesake
 *  doesn't drag the active entry out of the lookup. */
export function buildOperatorByNormalizedName(operatorRoster) {
    const out = new Map()
    const register = (key, op) => {
        if (!key) return
        const existing = out.get(key)
        if (!existing || (existing.status !== 'Active' && op.status === 'Active')) {
            out.set(key, op)
        }
    }
    ;(operatorRoster || []).forEach((op) => {
        nameLookupVariants(op?.name).forEach((variant) => register(variant, op))
    })
    return out
}

/** Active-mixer roster keyed by `assignedOperator` (operator UUID). */
export function buildMixerByEmployeeId(activeMixers) {
    const out = new Map()
    ;(activeMixers || []).forEach((m) => {
        const key = String(m.assignedOperator || '').trim()
        if (!key) return
        out.set(key, {
            assignedPlant: String(m.assignedPlant || '').trim() || null,
            employeeId: key,
            truckNumber: String(m.truckNumber || '').trim() || null
        })
    })
    return out
}

/** Truck number → assigned-operator employeeId. The primary
 *  disambiguator when two active operators share a name — each is on
 *  their own mixer, so the ticket's `truck_num` plus this map uniquely
 *  identifies which operator drove that load. First-seen wins on
 *  truck-number collisions; those should never happen in clean data. */
export function buildMixerByTruckNumber(activeMixers) {
    const out = new Map()
    ;(activeMixers || []).forEach((m) => {
        const truck = String(m.truckNumber || '').trim()
        if (!truck) return
        const employeeId = String(m.assignedOperator || '').trim()
        if (!employeeId) return
        if (!out.has(truck)) {
            out.set(truck, {
                assignedPlant: String(m.assignedPlant || '').trim() || null,
                employeeId
            })
        }
    })
    return out
}

/** UUID → operator record. */
export function buildOperatorByEmployeeId(operatorRoster) {
    const out = new Map()
    ;(operatorRoster || []).forEach((op) => {
        const id = String(op?.employeeId ?? '').trim()
        if (id) out.set(id, op)
    })
    return out
}

/** Direct lookup: normalized operator name → active mixer assignment.
 *  Joins active-mixer roster against operator records by `employeeId`
 *  and keys the result by uppercased `operator.name`. */
export function buildActiveAssignmentByName(activeMixers, operatorRoster) {
    if (!activeMixers || !operatorRoster) return new Map()
    const opById = new Map()
    operatorRoster.forEach((op) => {
        if (op?.employeeId) opById.set(op.employeeId, op)
    })
    const out = new Map()
    activeMixers.forEach((m) => {
        const op = opById.get(String(m.assignedOperator || '').trim())
        const name = String(op?.name || '')
            .trim()
            .toUpperCase()
        const plant = String(m.assignedPlant || '').trim()
        const truck = String(m.truckNumber || '').trim()
        if (!name || !plant) return
        out.set(name, {
            assignedPlant: plant,
            employeeId: op?.employeeId || null,
            operatorName: op?.name?.trim() || '',
            truckNumber: truck || null
        })
    })
    return out
}
