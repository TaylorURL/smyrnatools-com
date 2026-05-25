/**
 * Per-operator load tally extracted from `PlanStatisticsAggregators`.
 *
 * Walks every ticket in `detailByDay` (clipped to the current range),
 * attributes it to an operator via the truck / name bridges, and emits
 * a sorted row list with mismatch classifications. Inputs travel as a
 * single config object to keep the call site readable.
 *
 * Each function is a deterministic transformation of its inputs — no
 * React, no refs, no module-level state.
 */
import { formatPersonName, nameLookupVariants } from './OperatorNameLookupUtility'

/** Fresh unmatched-bucket factory — owned by `buildLoadsByOperator`
 *  but kept here as a private helper so the main function stays
 *  readable. Each call to `buildLoadsByOperator` gets its own mutable
 *  bucket so nothing leaks across renders. */
const createUnmatchedBucket = () => ({
    driverNum: null,
    employeeId: null,
    key: '__unmatched__',
    loads: 0,
    loadsByPlant: new Map(),
    name: 'Unmatched operators',
    namesByKey: new Map(),
    operatorHomePlant: null,
    operatorStatus: null,
    trucksDriven: new Set(),
    unmatched: true,
    yardage: 0
})

/** Resolve a ticket's driver against the operator roster, preferring
 *  the truck-number bridge (each operator has their own mixer, so
 *  `ticket.truck_num` uniquely identifies the driver when the
 *  resolved-operator's name also matches the ticket's `driver_name`),
 *  falling back to the name-variant lookup for spares. */
const resolveTicketOperator = ({
    truckNum,
    nameVariants,
    mixerByTruckNumber,
    operatorByEmployeeId,
    operatorByNormalizedName
}) => {
    if (truckNum) {
        const mixerHit = mixerByTruckNumber.get(truckNum)
        if (mixerHit?.employeeId) {
            const opByTruck = operatorByEmployeeId.get(mixerHit.employeeId)
            if (opByTruck) {
                const truckOpVariants = nameLookupVariants(opByTruck.name)
                if (nameVariants.some((v) => truckOpVariants.includes(v))) return opByTruck
            }
        }
    }
    for (const variant of nameVariants) {
        const hit = operatorByNormalizedName.get(variant)
        if (hit) return hit
    }
    return null
}

/** Track one unmatched ticket against the unmatched bucket — both the
 *  bucket-level totals AND the per-unique-name sub-bucket so dispatch
 *  can see exactly which spelling needs fixing. */
const trackUnmatchedTicket = (bucket, { rawName, driverNum, truckNum, loaderPlant, yardage }) => {
    bucket.loads += 1
    bucket.yardage += yardage
    if (truckNum) bucket.trucksDriven.add(truckNum)
    if (loaderPlant) {
        bucket.loadsByPlant.set(loaderPlant, (bucket.loadsByPlant.get(loaderPlant) || 0) + 1)
    }
    const sampleLabel = rawName || (driverNum ? `Operator #${driverNum}` : 'Unknown')
    const dedupeKey = (rawName || `__num__:${driverNum || '__unknown__'}`).toUpperCase()
    let entry = bucket.namesByKey.get(dedupeKey)
    if (!entry) {
        entry = {
            driverNums: new Set(),
            key: dedupeKey,
            loads: 0,
            name: sampleLabel,
            plants: new Set(),
            trucks: new Set(),
            yardage: 0
        }
        bucket.namesByKey.set(dedupeKey, entry)
    }
    entry.loads += 1
    entry.yardage += yardage
    if (driverNum) entry.driverNums.add(driverNum)
    if (truckNum) entry.trucks.add(truckNum)
    if (loaderPlant) entry.plants.add(loaderPlant)
}

/** Track one resolved ticket against the per-operator map. */
const trackResolvedTicket = (
    byOperator,
    operator,
    { rawName, driverNum, truckNum, loaderPlant, yardage, nameVariants }
) => {
    const canonicalName = operator.name?.trim() || rawName
    const name = formatPersonName(canonicalName)
    const fallbackKeySource = nameVariants[0] || rawName.toUpperCase()
    const key = operator.employeeId || `op:${fallbackKeySource}`
    if (!byOperator.has(key)) {
        byOperator.set(key, {
            driverNum: driverNum || null,
            employeeId: operator.employeeId || null,
            key,
            loads: 0,
            loadsByPlant: new Map(),
            name,
            operatorHomePlant: operator.plantCode || null,
            operatorStatus: operator.status || null,
            trucksDriven: new Set(),
            unmatched: false,
            yardage: 0
        })
    }
    const entry = byOperator.get(key)
    entry.loads += 1
    entry.yardage += yardage
    if (truckNum) entry.trucksDriven.add(truckNum)
    if (loaderPlant) {
        entry.loadsByPlant.set(loaderPlant, (entry.loadsByPlant.get(loaderPlant) || 0) + 1)
    }
}

/** Materialise the unmatched per-name buckets into a sorted array
 *  (busiest first) so the UI can render an actionable table without
 *  any further reshape. */
const materialiseUnmatchedNames = (namesByKey) =>
    [...namesByKey.values()]
        .map((b) => ({
            driverNums: [...b.driverNums].sort(),
            key: b.key,
            loads: b.loads,
            name: b.name,
            plants: [...b.plants].sort(),
            trucks: [...b.trucks].sort(),
            yardage: b.yardage
        }))
        .sort((a, b) => b.loads - a.loads || a.name.localeCompare(b.name))

/** Classify mismatches on a resolved-operator row and decorate it
 *  with `assignedPlant`, `assignedTruck`, `homePlant`, `mismatches`,
 *  `plantLoads`, `plantsLoaded`, and `trucksDriven`. */
const decorateOperatorRow = (entry, { rosterReady, mixerByEmployeeId, activeAssignmentByName }) => {
    const trucksDriven = [...entry.trucksDriven].sort()
    const plantLoads = [...entry.loadsByPlant.entries()]
        .map(([plant, loads]) => ({ loads, plant }))
        .sort((a, b) => b.loads - a.loads || a.plant.localeCompare(b.plant))
    const plantsLoaded = plantLoads.map((p) => p.plant)
    if (entry.unmatched) {
        return {
            ...entry,
            assignedPlant: null,
            assignedTruck: null,
            homePlant: null,
            mismatches: [],
            plantLoads,
            plantsLoaded,
            trucksDriven
        }
    }
    const fromMixerId = entry.employeeId ? mixerByEmployeeId.get(entry.employeeId) : null
    const normalizedNameForLookup = String(entry.name || '')
        .trim()
        .toUpperCase()
    const fromMixerName = normalizedNameForLookup ? activeAssignmentByName.get(normalizedNameForLookup) : null
    const assigned = fromMixerId || fromMixerName || null
    const homePlant = assigned?.assignedPlant || entry.operatorHomePlant || null
    const mismatches = []
    if (trucksDriven.length > 1) mismatches.push('multiTruck')
    if (rosterReady) {
        if (!assigned) {
            mismatches.push('unassigned')
        } else {
            if (assigned.truckNumber && trucksDriven.length > 0 && !trucksDriven.includes(assigned.truckNumber)) {
                mismatches.push('wrongTruck')
            }
            if (assigned.assignedPlant && plantsLoaded.length > 0 && !plantsLoaded.includes(assigned.assignedPlant)) {
                mismatches.push('wrongPlant')
            }
        }
    }
    return {
        ...entry,
        assignedPlant: homePlant,
        assignedTruck: assigned?.truckNumber || null,
        homePlant,
        mismatches,
        plantLoads,
        plantsLoaded,
        trucksDriven
    }
}

/** Per-operator load tally across the active window.
 *
 *  Walks every ticket in `detailByDay` (clipped to the current range),
 *  resolves each driver to an operator via the truck-number bridge with
 *  a name-variant fallback, then aggregates loads / yardage / trucks /
 *  load-plants per operator. Tickets that can't be resolved collapse
 *  into a single synthetic "Unmatched operators" row that still tracks
 *  per-unique-spelling aggregates for actionable dispatcher fixes.
 *
 *  Plant filter (`selectedPlant`) scopes by where the work happened OR
 *  by the operator's active-mixer home plant — matching the rest of the
 *  Statistics tab's "match the load OR the assignment" rule.
 *
 *  The unmatched bucket always sorts to the bottom; everything else
 *  sorts by loads desc, then yardage desc.
 */
export function buildLoadsByOperator({
    detailByDay,
    range,
    selectedPlant,
    activeMixers,
    operatorRoster,
    operatorByNormalizedName,
    operatorByEmployeeId,
    mixerByEmployeeId,
    mixerByTruckNumber,
    activeAssignmentByName
}) {
    const startIso = range?.current?.start
    const endIso = range?.current?.end
    if (!startIso || !endIso) return []
    const byOperator = new Map()
    const unmatchedBucket = createUnmatchedBucket()
    Object.entries(detailByDay).forEach(([dayIso, dayMap]) => {
        if (!dayMap) return
        if (dayIso < startIso || dayIso > endIso) return
        Object.values(dayMap).forEach((detail) => {
            const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
            tickets.forEach((ticket) => {
                const loaderPlant = (ticket?.plantId || '').toString().trim()
                const rawName = (ticket?.driverName || '').toString().trim()
                const driverNum = (ticket?.driverNum || '').toString().trim()
                const truckNum = (ticket?.truckNum || '').toString().trim()
                const nameVariants = nameLookupVariants(rawName)
                const operator = resolveTicketOperator({
                    mixerByTruckNumber,
                    nameVariants,
                    operatorByEmployeeId,
                    operatorByNormalizedName,
                    truckNum
                })
                const yardage = parseFloat(ticket?._confirmedQuantity) || parseFloat(ticket?.quantity) || 0
                const meta = { driverNum, loaderPlant, nameVariants, rawName, truckNum, yardage }
                if (!operator) {
                    trackUnmatchedTicket(unmatchedBucket, meta)
                    return
                }
                trackResolvedTicket(byOperator, operator, meta)
            })
        })
    })
    if (unmatchedBucket.loads > 0) {
        byOperator.set('__unmatched__', {
            ...unmatchedBucket,
            unmatchedNames: materialiseUnmatchedNames(unmatchedBucket.namesByKey)
        })
    }
    const rosterReady = activeMixers !== null && operatorRoster !== null
    return [...byOperator.values()]
        .map((entry) => decorateOperatorRow(entry, { activeAssignmentByName, mixerByEmployeeId, rosterReady }))
        .filter((row) => {
            if (!selectedPlant) return true
            const target = String(selectedPlant).trim()
            if (!target) return true
            const loadedAtTarget = (row.plantsLoaded || []).some((code) => String(code).trim() === target)
            if (loadedAtTarget) return true
            if (row.homePlant && String(row.homePlant).trim() === target) return true
            return false
        })
        .sort((a, b) => {
            if (a.unmatched && !b.unmatched) return 1
            if (!a.unmatched && b.unmatched) return -1
            return b.loads - a.loads || b.yardage - a.yardage
        })
}
