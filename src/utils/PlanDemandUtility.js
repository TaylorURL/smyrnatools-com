import { cleanString, estimatePourMinutes } from './PlanRuntimeUtility'
import {
    getCalculatedTruckCount,
    getEffectiveBase,
    isBigPourOrder,
    isExcludedOrder,
    PLAN_META_KEY
} from './PlanUtility'

/**
 * Pure aggregation helpers for the Plan Demand view. Builds every chart's
 * underlying data set once so totals stay consistent across the KPI row,
 * hourly demand, top-customers, product mix, and per-plant breakdown.
 */

/** Fallback palette for plants that aren't in the shared plant-badge map.
 *  Real plants use the canonical color from `plantBadgeColor` so every view
 *  (Schedule badges, Planner nodes, Demand charts) renders them the same. */
export const FALLBACK_SERIES_COLORS = [
    '#0ea5e9',
    '#8b5cf6',
    '#16a34a',
    '#d97706',
    '#dc2626',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1'
]

/** Separate palette for product mix — products don't map to the plant
 *  color space, so use distinct hues. */
export const PRODUCT_COLORS = [
    '#0ea5e9',
    '#f97316',
    '#8b5cf6',
    '#16a34a',
    '#ec4899',
    '#eab308',
    '#06b6d4',
    '#dc2626',
    '#6366f1',
    '#84cc16',
    '#d97706',
    '#14b8a6'
]

/** Verdict pill thresholds: coverage = supply / demand. */
const COVERAGE_COMFORTABLE = 110
const COVERAGE_ON_TARGET = 100
const COVERAGE_TIGHT = 80
const UTILIZATION_CAP_PCT = 200

const TIME_OF_DAY_BUCKETS = {
    afternoonEnd: 18,
    morningEnd: 12,
    overnightEnd: 6
}

const parseHourMinute = (value) => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null
    return h * 60 + min
}

/** Rolling-sum helper: returns prefix sums of `arr` without mutating it. */
const toCumulative = (arr) => {
    let running = 0
    return arr.map((x) => {
        running += x
        return running
    })
}

/** Initialize the per-plant accumulator with starting-pool math that
 *  matches the Schedule tab (date/holiday adjustments + missing-operator
 *  shortfalls + help sent/received). */
const buildPlantAccumulators = ({ stats, plantProduction, plantNameByCode, planDate, passesPlantFilter }) => {
    const plants = new Map()
    ;(stats || []).forEach((s) => {
        if (!s?.code || !passesPlantFilter(s.code)) return
        const rawBase = Number.isFinite(s.base) ? s.base : 0
        const effectiveBase = getEffectiveBase(rawBase, s.code, plantProduction, planDate)
        const send = Number.isFinite(s.send) ? s.send : 0
        const recv = Number.isFinite(s.recv) ? s.recv : 0
        plants.set(s.code, {
            adjustedBase: Math.max(0, effectiveBase - send + recv),
            base: rawBase,
            code: s.code,
            helpRecv: recv,
            helpSend: send,
            name: plantNameByCode?.[s.code] || s.code,
            orders: 0,
            totalTrucks: 0,
            totalYardage: 0
        })
    })
    return plants
}

/** Cumulate per-order numbers onto each plant's accumulator. Plants seen
 *  in `plantProduction` but missing from `stats` are auto-added with a
 *  zero base so the breakdown still includes them. */
const accumulateOrdersByPlant = ({ plants, plantProduction, plantNameByCode, passesPlantFilter }) => {
    Object.entries(plantProduction || {}).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY || !passesPlantFilter(code)) return
        if (!plants.has(code)) {
            plants.set(code, {
                adjustedBase: 0,
                base: 0,
                code,
                helpRecv: 0,
                helpSend: 0,
                name: plantNameByCode?.[code] || code,
                orders: 0,
                totalTrucks: 0,
                totalYardage: 0
            })
        }
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        const record = plants.get(code)
        list.forEach((order) => {
            if (isExcludedOrder(order)) return
            record.totalYardage += parseFloat(order?.yardage) || 0
            record.totalTrucks += getCalculatedTruckCount(order) || 0
            record.orders += 1
        })
    })
}

/** Walk every order to fill the per-hour matrices, time-of-day buckets,
 *  and KPI aggregates. Returns the raw payload the Demand view needs to
 *  render every chart. */
const collectHourlyAndKpis = ({ plantProduction, passesPlantFilter }) => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${String(i).padStart(2, '0')}:00`,
        total: 0,
        yardage: 0
    }))
    const stackedHourly = hours.map((h) => ({ hour: h.hour, label: h.label }))
    const customerYardage = new Map()
    const productYardage = new Map()
    let biggestOrder = null
    let bigPourCount = 0
    let totalLoadSizeSum = 0
    let totalLoadSizeCount = 0

    Object.entries(plantProduction || {}).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY || !passesPlantFilter(code)) return
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        list.forEach((order) => {
            if (isExcludedOrder(order)) return
            const yardage = parseFloat(order?.yardage) || 0
            const trucks = getCalculatedTruckCount(order) || 0
            const loadSize = parseFloat(order?.loadSize) || 0

            if (yardage > 0) {
                const customer = cleanString(order?.customer) || 'Unknown'
                customerYardage.set(customer, (customerYardage.get(customer) || 0) + yardage)
                const product = cleanString(order?.productCode) || '—'
                productYardage.set(product, (productYardage.get(product) || 0) + yardage)
                if (!biggestOrder || yardage > biggestOrder.yardage) {
                    biggestOrder = {
                        customer,
                        orderNum: cleanString(order?.orderNum),
                        plantCode: code,
                        startTime: cleanString(order?.startTime),
                        yardage
                    }
                }
            }
            if (loadSize > 0) {
                const trips = Math.max(1, Math.ceil(yardage / loadSize))
                totalLoadSizeSum += loadSize * trips
                totalLoadSizeCount += trips
            }
            if (isBigPourOrder(order)) bigPourCount += 1

            const startMin = parseHourMinute(order?.startTime)
            if (!Number.isFinite(startMin) || trucks <= 0) return
            const duration = estimatePourMinutes(order)
            const endMin = startMin + duration
            const startHour = Math.max(0, Math.floor(startMin / 60))
            const endHour = Math.min(23, Math.floor((endMin - 1) / 60))
            for (let h = startHour; h <= endHour; h++) {
                hours[h].total += trucks
                stackedHourly[h][code] = (stackedHourly[h][code] || 0) + trucks
            }
            // Yardage goes into the hour the pour STARTS (dispatcher-friendly
            // rather than spread across the rotation).
            const startH = Math.max(0, Math.min(23, Math.floor(startMin / 60)))
            hours[startH].yardage += yardage
        })
    })

    return {
        bigPourCount,
        biggestOrder,
        customerYardage,
        hours,
        productYardage,
        stackedHourly,
        totalLoadSizeCount,
        totalLoadSizeSum
    }
}

/** Bucket cumulative yardage into the dispatcher-relevant time-of-day
 *  splits. */
const summarizeTimeOfDay = (hours) => {
    const totals = { afternoon: 0, evening: 0, morning: 0, overnight: 0 }
    hours.forEach((h) => {
        if (h.hour < TIME_OF_DAY_BUCKETS.overnightEnd) totals.overnight += h.yardage
        else if (h.hour < TIME_OF_DAY_BUCKETS.morningEnd) totals.morning += h.yardage
        else if (h.hour < TIME_OF_DAY_BUCKETS.afternoonEnd) totals.afternoon += h.yardage
        else totals.evening += h.yardage
    })
    return totals
}

/** Build the entire Demand view payload — KPIs, hourly + cumulative
 *  matrices, top-customers / product-mix lists, capacity table, peak
 *  totals, and time-of-day splits. When `allowedCodes` is a Set, every
 *  aggregate is narrowed to just those plants. */
export const buildDemandData = ({ plantProduction, stats, plantNameByCode, planDate, allowedCodes }) => {
    const filterActive = allowedCodes instanceof Set
    const passesPlantFilter = (code) => !filterActive || allowedCodes.has(code)

    const plants = buildPlantAccumulators({ passesPlantFilter, planDate, plantNameByCode, plantProduction, stats })
    accumulateOrdersByPlant({ passesPlantFilter, plantNameByCode, plantProduction, plants })

    const perPlant = Array.from(plants.values()).sort((a, b) => b.totalTrucks - a.totalTrucks)
    const hourly = collectHourlyAndKpis({ passesPlantFilter, plantProduction })
    const { hours, stackedHourly, customerYardage, productYardage, biggestOrder, bigPourCount } = hourly

    const peakByPlant = {}
    perPlant.forEach((plant) => {
        let peak = 0
        for (let h = 0; h < hours.length; h++) {
            const value = stackedHourly[h][plant.code] || 0
            if (value > peak) peak = value
        }
        peakByPlant[plant.code] = peak
    })

    const totals = perPlant.reduce(
        (acc, p) => ({
            orders: acc.orders + p.orders,
            trucks: acc.trucks + p.totalTrucks,
            yardage: acc.yardage + p.totalYardage
        }),
        { orders: 0, trucks: 0, yardage: 0 }
    )

    const peakHour = hours.reduce((best, h) => (h.total > best.total ? h : best), {
        hour: null,
        label: '—',
        total: 0
    })

    const cumulativeYardage = toCumulative(hours.map((h) => h.yardage))
    const cumulativeHourly = hours.map((h, i) => ({
        hour: h.hour,
        label: h.label,
        yardage: Math.round(cumulativeYardage[i])
    }))

    const capacityByPlant = perPlant
        .map((p) => ({
            base: p.adjustedBase,
            code: p.code,
            label: p.code,
            peak: peakByPlant[p.code] || 0,
            rawBase: p.base,
            slack: Math.max(0, (p.adjustedBase || 0) - (peakByPlant[p.code] || 0))
        }))
        .sort((a, b) => b.peak - a.peak)

    const topCustomers = Array.from(customerYardage.entries())
        .map(([customer, yardage]) => ({ customer, yardage: Math.round(yardage) }))
        .sort((a, b) => b.yardage - a.yardage)
        .slice(0, 10)

    const productMix = Array.from(productYardage.entries())
        .map(([product, yardage]) => ({ product, yardage: Math.round(yardage) }))
        .sort((a, b) => b.yardage - a.yardage)

    const avgLoadSize =
        hourly.totalLoadSizeCount > 0 ? Math.round((totals.yardage / hourly.totalLoadSizeCount) * 10) / 10 : 0

    const totalBase = perPlant.reduce((acc, p) => acc + (p.adjustedBase || 0), 0)
    const capacityUtilization =
        totalBase > 0 ? Math.min(UTILIZATION_CAP_PCT, Math.round((peakHour.total / totalBase) * 100)) : 0

    return {
        avgLoadSize,
        bigPourCount,
        biggestOrder,
        capacityByPlant,
        capacityUtilization,
        cumulativeHourly,
        hours,
        peakByPlant,
        peakHour,
        perPlant,
        productMix,
        stackedHourly,
        timeOfDay: summarizeTimeOfDay(hours),
        topCustomers,
        totalBase,
        totals
    }
}

/**
 * Verdict pill for how supply (effective truck pool) compares to peak
 * demand. No-demand plants render a neutral "Idle" pill so the row still
 * says something useful.
 */
export const supplyVerdict = (supply, demand) => {
    if (!demand) return { color: 'var(--text-tertiary)', label: 'Idle', tone: 'idle' }
    const coverage = supply > 0 ? (supply / demand) * 100 : 0
    if (coverage >= COVERAGE_COMFORTABLE) return { color: '#16a34a', coverage, label: 'Comfortable', tone: 'good' }
    if (coverage >= COVERAGE_ON_TARGET) return { color: '#0ea5e9', coverage, label: 'On target', tone: 'good' }
    if (coverage >= COVERAGE_TIGHT) return { color: '#d97706', coverage, label: 'Tight', tone: 'warn' }
    return { color: '#dc2626', coverage, label: 'Overbooked', tone: 'bad' }
}

/** Escape a value for CSV output (RFC 4180 quoting for commas, quotes,
 *  and newlines). */
const csvCell = (value) => {
    const str = String(value ?? '')
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Build the per-plant CSV string for export download. */
export const buildPerPlantCsv = ({ perPlant, peakByPlant, totals }) => {
    const header = ['Plant', 'Name', 'Orders', 'Yardage (yd)', 'Trucks', 'Share %', 'Base', 'Peak']
    const rows = perPlant.map((p) => {
        const share = totals.trucks > 0 ? (p.totalTrucks / totals.trucks) * 100 : 0
        return [
            p.code,
            p.name,
            p.orders,
            Math.round(p.totalYardage),
            p.totalTrucks,
            share.toFixed(1),
            p.adjustedBase,
            peakByPlant[p.code] || 0
        ]
    })
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

/** Trigger a CSV file download in the browser. Idempotent — caller can
 *  invoke from any click handler without managing object URLs. */
export const downloadCsvFile = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}
