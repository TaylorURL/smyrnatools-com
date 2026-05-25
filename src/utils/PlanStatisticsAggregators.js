/**
 * Pure aggregator + lookup-builder functions extracted from
 * `usePlanStatistics`. Each function is a deterministic transformation
 * of its inputs — no React, no refs, no module-level state. The hook
 * keeps the `useMemo(() => fn(...), [...])` wrapper so dependency
 * tracking stays at the call site.
 *
 * Three families live here:
 *   1. Lookup-Map builders — translate the mixer / operator rosters into
 *      Maps the hook consumes elsewhere (employee id → mixer, name
 *      variant → operator, etc.).
 *   2. Schedule-derived collections — flat per-order schedule lookups,
 *      per-day satisfaction details, per-plant load attribution.
 *   3. Satisfaction aggregators — per-day, per-plant, per-weekday,
 *      per-window, plus momentum + scored-order list.
 *
 * The `buildLoadsByOperator` function at the bottom is the big one —
 * walks every detail ticket in the active range, attributes it to an
 * operator via the truck / name bridges, and emits a sorted row list
 * with mismatch classifications. Inputs travel as a single config
 * object to keep the call site readable.
 */
import { formatPersonName, nameLookupVariants } from './OperatorNameLookupUtility'
import { enrichDetailEntryWithSchedule } from './PlanDetailEnrichment'
import { parseIsoLocal } from './PlanStatisticsFormatUtility'
import { computeScheduleMetrics, isoDate, isSundayIso } from './PlanStatisticsUtility'
import { computeCustomerSatisfaction, PLAN_META_KEY } from './PlanUtility'

const TRAJECTORY_DELTA_THRESHOLD = 2

const classifyTrajectory = (delta) => {
    if (delta == null) return 'stable'
    if (delta > TRAJECTORY_DELTA_THRESHOLD) return 'improving'
    if (delta < -TRAJECTORY_DELTA_THRESHOLD) return 'declining'
    return 'stable'
}

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

/** Compute per-day metrics for the current window, with a synthetic
 *  row injected for `planDate` when the server hasn't persisted that
 *  day yet but the in-memory `liveProduction` has values. */
export function buildCurrentDays({ currentRows, selectedPlant, planDate, liveProduction, range }) {
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
}

/** Distinct plant codes present in the loaded window. The selected
 *  plant is kept in the list even if the new range has no rows for it
 *  so the dropdown still shows what's currently filtered. */
export function collectAvailablePlantCodes(currentRows, selectedPlant) {
    const codes = new Set()
    ;(currentRows || []).forEach((row) => {
        const production = row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
        Object.keys(production).forEach((code) => {
            if (code !== PLAN_META_KEY) codes.add(code)
        })
    })
    if (selectedPlant) codes.add(selectedPlant)
    return [...codes].sort()
}

/** Per-date Map<orderId, {scheduledYardage, loadSize}> derived from the
 *  merged plan rows. Plans-data wins on yardage when both sources have
 *  it (merge already enforced this); we just walk and take the max. */
export function buildScheduleMetaByDate(currentRows, previousRows) {
    const out = new Map()
    const ingest = (rows) => {
        ;(rows || []).forEach((row) => {
            const date = row?.plan_date
            if (!date) return
            const production =
                row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
            let dateMap = out.get(date)
            Object.values(production).forEach((block) => {
                if (!block || typeof block !== 'object') return
                const orders = Array.isArray(block.orders) ? block.orders : []
                orders.forEach((o) => {
                    if (!o?.orderId) return
                    const sy = parseFloat(o?.yardage) || 0
                    const ls = parseFloat(o?.loadSize) || 0
                    if (sy <= 0 && ls <= 0) return
                    if (!dateMap) {
                        dateMap = new Map()
                        out.set(date, dateMap)
                    }
                    const existing = dateMap.get(o.orderId)
                    if (!existing) {
                        dateMap.set(o.orderId, { loadSize: ls, scheduledYardage: sy })
                    } else {
                        dateMap.set(o.orderId, {
                            loadSize: Math.max(existing.loadSize, ls),
                            scheduledYardage: Math.max(existing.scheduledYardage, sy)
                        })
                    }
                })
            })
        })
    }
    ingest(currentRows)
    ingest(previousRows)
    return out
}

/** Flat `orderId → {scheduledYardage, loadSize}` lookup derived from
 *  the flat-orders walk. */
export function buildOrderScheduleByOrderId(flatOrders) {
    const map = new Map()
    flatOrders.forEach(({ order }) => {
        if (!order?.orderId) return
        const sy = parseFloat(order?.yardage) || 0
        const ls = parseFloat(order?.loadSize) || 0
        if (sy <= 0 && ls <= 0) return
        const existing = map.get(order.orderId)
        if (!existing) {
            map.set(order.orderId, { loadSize: ls, scheduledYardage: sy })
        } else {
            map.set(order.orderId, {
                loadSize: Math.max(existing.loadSize, ls),
                scheduledYardage: Math.max(existing.scheduledYardage, sy)
            })
        }
    })
    return map
}

/** Merged detail map across every loaded date — flattened by orderId
 *  with belt-and-suspenders schedule backfill applied per entry. */
export function buildMergedDetail(detailByDay, orderScheduleByOrderId) {
    const out = {}
    Object.values(detailByDay).forEach((map) => {
        if (!map) return
        Object.entries(map).forEach(([orderId, entry]) => {
            out[orderId] = enrichDetailEntryWithSchedule(entry, orderScheduleByOrderId.get(orderId))
        })
    })
    return out
}

/** Per-plant load attribution — splits each plant's slice into ordered,
 *  loaded, selfLoaded, crossInYards (help received), and crossOutYards
 *  (help given). Plant codes normalise through `colocationMap.resolvePrimary`
 *  so sibling-site aliases collapse to the same physical plant. */
export function buildPerPlantLoadAttribution(flatOrders, mergedDetail, colocationMap) {
    const resolvePrimary =
        typeof colocationMap?.resolvePrimary === 'function' ? colocationMap.resolvePrimary : (code) => code
    const out = {}
    const getEntry = (code) => {
        if (!out[code]) {
            out[code] = {
                code,
                crossInYards: 0,
                crossOutYards: 0,
                loaded: 0,
                ordered: 0,
                selfLoaded: 0
            }
        }
        return out[code]
    }
    const hasDetail = Object.keys(mergedDetail).length > 0
    flatOrders.forEach(({ order, plantCode }) => {
        const homePlant = resolvePrimary(plantCode)
        if (!homePlant) return
        getEntry(homePlant).ordered += parseFloat(order?.yardage) || 0
        if (!hasDetail || !order?.orderId) return
        const detail = mergedDetail[order.orderId]
        if (!detail || typeof detail.byPlant !== 'object') return
        Object.entries(detail.byPlant).forEach(([rawLoaderPlant, slice]) => {
            const loadedYards = parseFloat(slice?.loadedYardage) || 0
            if (loadedYards <= 0) return
            const loaderPlant = resolvePrimary(rawLoaderPlant)
            const home = getEntry(homePlant)
            home.loaded += loadedYards
            if (loaderPlant === homePlant) {
                home.selfLoaded += loadedYards
            } else {
                home.crossInYards += loadedYards
                getEntry(loaderPlant).crossOutYards += loadedYards
            }
        })
    })
    return out
}

/** Per-day satisfaction. Walks each day's orders once and hits the
 *  shared detail map. Null entries mean we have no ticket data for
 *  that day. */
export function buildSatisfactionByDay(currentDays, detailByDay) {
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
}

/** Period-aggregated satisfaction across all current days. */
export function buildSatisfactionAggregate(currentDays, mergedDetail) {
    if (!currentDays.length) return null
    const orders = []
    currentDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
    if (!orders.length) return null
    return computeCustomerSatisfaction(orders, mergedDetail)
}

/** Same as `buildSatisfactionAggregate` but for the comparison window. */
export function buildPreviousSatisfactionAggregate(previousDays, mergedDetail, comparison) {
    if (comparison === 'none' || !previousDays.length) return null
    const orders = []
    previousDays.forEach((d) => (d.allLiveOrders || []).forEach((o) => orders.push(o)))
    if (!orders.length) return null
    return computeCustomerSatisfaction(orders, mergedDetail)
}

/** Per-day satisfaction trend across the entire range, padded so
 *  missing days show as gaps. Each entry carries the raw score plus a
 *  trailing 7-working-day rolling good-rate. */
export function buildSatisfactionTrend(currentDays, detailByDay, range) {
    if (!currentDays.length) return []
    const cursor = parseIsoLocal(range.current.start)
    const endDate = parseIsoLocal(range.current.end)
    if (!cursor || !endDate) return []

    const dayByDate = new Map(currentDays.map((d) => [d.planDate, d]))

    const dailyStats = []
    let safety = 366 * 5
    while (cursor <= endDate && safety > 0) {
        if (cursor.getDay() !== 0) {
            const iso = isoDate(cursor)
            const day = dayByDate.get(iso) || null
            const detail = detailByDay[iso]
            const result = day && detail ? computeCustomerSatisfaction(day.allLiveOrders || [], detail) : null
            dailyStats.push({
                badService: result ? result.badService : 0,
                date: iso,
                goodService: result ? result.goodService : 0,
                samples: result ? result.samples : 0,
                score: result ? Math.round(result.score * 100) : null
            })
        }
        cursor.setDate(cursor.getDate() + 1)
        safety -= 1
    }

    return dailyStats.map((stat, idx) => {
        const sliceStart = Math.max(0, idx - 6)
        let rollingGood = 0
        let rollingSamples = 0
        for (let i = sliceStart; i <= idx; i += 1) {
            rollingGood += dailyStats[i].goodService
            rollingSamples += dailyStats[i].samples
        }
        return {
            ...stat,
            rollingSamples,
            rollingScore: rollingSamples > 0 ? Math.round((rollingGood / rollingSamples) * 100) : null
        }
    })
}

/** ISO date midway through the active window. */
export function computeWindowMidpointIso(range) {
    if (!range?.current?.start || !range?.current?.end) return null
    const start = new Date(`${range.current.start}T00:00:00`)
    const end = new Date(`${range.current.end}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return isoDate(new Date((start.getTime() + end.getTime()) / 2))
}

/** Per-plant satisfaction with first-half vs second-half trajectory. */
export function buildPerPlantSatisfaction(flatOrders, mergedDetail, windowMidpointIso) {
    if (!flatOrders.length) return []
    const byPlant = new Map()
    flatOrders.forEach(({ order, plantCode, planDate }) => {
        if (!byPlant.has(plantCode)) {
            byPlant.set(plantCode, { firstHalf: [], orders: [], secondHalf: [], yardage: 0 })
        }
        const bucket = byPlant.get(plantCode)
        bucket.orders.push(order)
        bucket.yardage += parseFloat(order?.yardage) || 0
        if (windowMidpointIso && planDate < windowMidpointIso) bucket.firstHalf.push(order)
        else bucket.secondHalf.push(order)
    })
    const out = []
    byPlant.forEach((entry, code) => {
        const aggregate = computeCustomerSatisfaction(entry.orders, mergedDetail)
        if (!aggregate) return
        const first = entry.firstHalf.length ? computeCustomerSatisfaction(entry.firstHalf, mergedDetail) : null
        const second = entry.secondHalf.length ? computeCustomerSatisfaction(entry.secondHalf, mergedDetail) : null
        const delta = first && second ? Math.round(second.score * 100) - Math.round(first.score * 100) : null
        out.push({
            badService: aggregate.badService,
            code,
            delta,
            goodService: aggregate.goodService,
            samples: aggregate.samples,
            score: Math.round(aggregate.score * 100),
            tierCounts: aggregate.tierCounts,
            trajectory: classifyTrajectory(delta),
            yardage: Math.round(entry.yardage)
        })
    })
    return out.sort((a, b) => a.score - b.score)
}

/** Day-of-week satisfaction breakdown — average score Mon–Sat across
 *  the active window. */
export function buildSatisfactionByWeekday(currentDays, detailByDay) {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const buckets = labels.map((label) => ({ count: 0, label, samples: 0, scoreSum: 0 }))
    currentDays.forEach((d) => {
        const detail = detailByDay[d.planDate]
        if (!detail) return
        const result = computeCustomerSatisfaction(d.allLiveOrders || [], detail)
        if (!result) return
        const date = d.planDate ? new Date(`${d.planDate}T00:00:00`) : null
        if (!date || Number.isNaN(date.getTime())) return
        const dow = date.getDay()
        if (dow === 0) return
        const bucket = buckets[dow - 1]
        bucket.scoreSum += result.score * 100
        bucket.count += 1
        bucket.samples += result.samples
    })
    return buckets.map((b) => ({
        label: b.label,
        samples: b.samples,
        score: b.count > 0 ? Math.round(b.scoreSum / b.count) : null
    }))
}

/** Per-order scored list — the hottest single pass on the page. */
export function buildScoredOrders(flatOrders, mergedDetail, selectedPlant) {
    if (!flatOrders.length) return []
    const out = []
    flatOrders.forEach(({ order, plantCode, planDate: orderDate }) => {
        if (selectedPlant && plantCode !== selectedPlant) return
        const detail = order?.orderId ? mergedDetail[order.orderId] : null
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        if (!tickets.length) return
        const result = computeCustomerSatisfaction([order], { [order.orderId]: detail })
        if (!result || result.samples === 0) return
        out.push({
            customer: (order.customer || '').trim() || 'Unknown',
            isBad: result.badService > 0,
            orderNum: order.orderNum || '',
            planDate: orderDate,
            plantCode,
            productCode: (order.productCode || '').trim() || '',
            score: Math.round(result.score * 100),
            yardage: parseFloat(order.yardage) || 0
        })
    })
    return out
}

/** Worst orders surfaced for follow-up — bad orders sorted by yardage
 *  desc, capped at 8. */
export function buildSatisfactionWorstOrders(scoredOrders) {
    return scoredOrders
        .filter((row) => row.isBad)
        .sort((a, b) => b.yardage - a.yardage)
        .slice(0, 8)
}

/** Customers with any bad service in the window, capped at 6. */
export function buildSatisfactionWorstCustomers(scoredOrders) {
    if (!scoredOrders.length) return []
    const byCustomer = new Map()
    scoredOrders.forEach((row) => {
        if (!byCustomer.has(row.customer)) {
            byCustomer.set(row.customer, {
                badOrders: 0,
                customer: row.customer,
                samples: 0,
                yardage: 0
            })
        }
        const bucket = byCustomer.get(row.customer)
        bucket.samples += 1
        if (row.isBad) {
            bucket.badOrders += 1
            bucket.yardage += row.yardage
        }
    })
    const out = []
    byCustomer.forEach((entry) => {
        if (entry.badOrders === 0) return
        out.push({
            badOrders: entry.badOrders,
            customer: entry.customer,
            samples: entry.samples,
            yardage: Math.round(entry.yardage)
        })
    })
    return out.sort((a, b) => b.badOrders - a.badOrders || b.yardage - a.yardage).slice(0, 6)
}

/** Momentum — last 7 working days inside the window vs the 7 before. */
export function buildSatisfactionMomentum(currentDays, mergedDetail) {
    if (!currentDays.length) return null
    const sorted = [...currentDays].sort((a, b) => (a.planDate || '').localeCompare(b.planDate || ''))
    if (sorted.length < 4) return null
    const recent = sorted.slice(-7)
    const prior = sorted.slice(-14, -7)
    const collectOrders = (days) => {
        const out = []
        days.forEach((d) => (d.allLiveOrders || []).forEach((o) => out.push(o)))
        return out
    }
    const recentResult = computeCustomerSatisfaction(collectOrders(recent), mergedDetail)
    const priorResult = computeCustomerSatisfaction(collectOrders(prior), mergedDetail)
    if (!recentResult && !priorResult) return null
    const recentScore = recentResult ? Math.round(recentResult.score * 100) : null
    const priorScore = priorResult ? Math.round(priorResult.score * 100) : null
    const delta = recentScore != null && priorScore != null ? recentScore - priorScore : null
    return {
        delta,
        prior: priorResult ? { samples: priorResult.samples, score: priorScore } : { samples: 0, score: null },
        recent: recentResult ? { samples: recentResult.samples, score: recentScore } : { samples: 0, score: null },
        trajectory: classifyTrajectory(delta)
    }
}

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
