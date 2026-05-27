/**
 * Schedule-derived collections extracted from `PlanStatisticsAggregators`.
 * Flat per-order schedule lookups, per-day mapped rows, and per-plant
 * load attribution.
 *
 * Each function is a deterministic transformation of its inputs — no
 * React, no refs, no module-level state.
 */
import { enrichDetailEntryWithSchedule } from './PlanDetailEnrichment'
import { computeScheduleMetrics, isSundayIso } from './PlanStatisticsUtility'
import { PLAN_META_KEY } from './PlanUtility'

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
        (rows || []).forEach((row) => {
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
