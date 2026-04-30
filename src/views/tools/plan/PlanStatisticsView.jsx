import React, { useEffect, useMemo, useState } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import { DetailOrderBucketService } from '../../../services/DetailOrderBucketService'
import { PlanService } from '../../../services/PlanService'
import {
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    computeCustomerSatisfaction,
    isExcludedOrder,
    MAX_YPH,
    parseDurationMinutes,
    plantBadgeColor,
    TARGET_YPH,
    timeToMinutes
} from '../../../utils/PlanUtility'

const ONE_DAY_MS = 86_400_000
const PLAN_META_KEY = '_meta'
const FALLBACK_SERIES_COLORS = [
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
const PERIODS = [
    { id: 'day', label: 'Day', span: 1 },
    { id: 'week', label: 'Week', span: 7 },
    { id: 'month', label: 'Month', span: 30 },
    { id: 'quarter', label: 'Quarter', span: 90 },
    { id: 'year', label: 'Year', span: 365 },
    { id: 'custom', label: 'Custom', span: null }
]
const COMPARISONS = [
    { id: 'none', label: 'Off' },
    { id: 'previous', label: 'Previous period' },
    { id: 'lastYear', label: 'Last year' }
]

/* ── Date helpers ──────────────────────────────────────────────────────── */

const isoDate = (date) => {
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

const parseIsoLocal = (iso) => {
    if (!iso) return null
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
}

const offsetIso = (iso, days) => {
    const base = parseIsoLocal(iso)
    if (!base) return iso
    base.setDate(base.getDate() + days)
    return isoDate(base)
}

const daysBetween = (startIso, endIso) => {
    const a = parseIsoLocal(startIso)
    const b = parseIsoLocal(endIso)
    if (!a || !b) return 0
    return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS) + 1
}

/** Sundays are non-operating days for the plant — exclude them from every
 *  metric, chart, and totals row so a 7-day "Week" reads as 6 working days. */
const isSundayIso = (iso) => {
    const d = parseIsoLocal(iso)
    return d ? d.getDay() === 0 : false
}

/** Returns the Monday of the calendar week containing `date`. Sunday rolls
 *  back to the prior Monday so the work-week is always Mon–Sat. */
const mondayOf = (date) => {
    const d = new Date(date)
    const day = d.getDay() // 0 Sun … 6 Sat
    const offset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    return d
}

const startOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1)
    d.setHours(0, 0, 0, 0)
    return d
}

const endOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

const startOfQuarter = (date) => {
    const q = Math.floor(date.getMonth() / 3)
    const d = new Date(date.getFullYear(), q * 3, 1)
    d.setHours(0, 0, 0, 0)
    return d
}

const endOfQuarter = (date) => {
    const q = Math.floor(date.getMonth() / 3)
    const d = new Date(date.getFullYear(), q * 3 + 3, 0)
    d.setHours(0, 0, 0, 0)
    return d
}

const startOfYear = (date) => {
    const d = new Date(date.getFullYear(), 0, 1)
    d.setHours(0, 0, 0, 0)
    return d
}

const endOfYear = (date) => {
    const d = new Date(date.getFullYear(), 11, 31)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * Build the period range (current + comparison) given the selector state.
 * Periods are CALENDAR-aligned, not rolling: Week is Mon–Sat of the anchor's
 * week, Month is the 1st through the last day of the anchor's month, etc.
 * Comparisons hop to the previous calendar period (or same calendar slot
 * one year prior) so deltas always compare like-for-like windows.
 */
const buildRange = (period, anchorIso, comparison, customStart, customEnd) => {
    const anchor = parseIsoLocal(anchorIso) || new Date()
    let startD
    let endD
    if (period === 'custom') {
        startD = parseIsoLocal(customStart || anchorIso) || anchor
        endD = parseIsoLocal(customEnd || anchorIso) || anchor
    } else if (period === 'day') {
        startD = new Date(anchor)
        endD = new Date(anchor)
    } else if (period === 'week') {
        startD = mondayOf(anchor) // Monday of this week
        endD = new Date(startD)
        endD.setDate(endD.getDate() + 5) // Saturday — Sunday excluded everywhere
    } else if (period === 'month') {
        startD = startOfMonth(anchor)
        endD = endOfMonth(anchor)
    } else if (period === 'quarter') {
        startD = startOfQuarter(anchor)
        endD = endOfQuarter(anchor)
    } else if (period === 'year') {
        startD = startOfYear(anchor)
        endD = endOfYear(anchor)
    } else {
        startD = new Date(anchor)
        endD = new Date(anchor)
    }
    const start = isoDate(startD)
    const end = isoDate(endD)
    const span = daysBetween(start, end)

    let prevStart = null
    let prevEnd = null
    if (comparison === 'previous') {
        if (period === 'day') {
            const d = new Date(startD)
            d.setDate(d.getDate() - 1)
            prevStart = isoDate(d)
            prevEnd = isoDate(d)
        } else if (period === 'week') {
            const ps = new Date(startD)
            ps.setDate(ps.getDate() - 7)
            const pe = new Date(ps)
            pe.setDate(pe.getDate() + 5)
            prevStart = isoDate(ps)
            prevEnd = isoDate(pe)
        } else if (period === 'month') {
            const ps = new Date(startD.getFullYear(), startD.getMonth() - 1, 1)
            const pe = new Date(startD.getFullYear(), startD.getMonth(), 0)
            prevStart = isoDate(ps)
            prevEnd = isoDate(pe)
        } else if (period === 'quarter') {
            const ps = new Date(startD.getFullYear(), startD.getMonth() - 3, 1)
            const pe = new Date(startD.getFullYear(), startD.getMonth(), 0)
            prevStart = isoDate(ps)
            prevEnd = isoDate(pe)
        } else if (period === 'year') {
            const ps = new Date(startD.getFullYear() - 1, 0, 1)
            const pe = new Date(startD.getFullYear() - 1, 11, 31)
            prevStart = isoDate(ps)
            prevEnd = isoDate(pe)
        } else {
            // Custom — match the same span just before the start.
            prevEnd = offsetIso(start, -1)
            prevStart = offsetIso(prevEnd, -(span - 1))
        }
    } else if (comparison === 'lastYear') {
        const ps = new Date(startD)
        const pe = new Date(endD)
        ps.setFullYear(ps.getFullYear() - 1)
        pe.setFullYear(pe.getFullYear() - 1)
        prevStart = isoDate(ps)
        prevEnd = isoDate(pe)
    }
    return {
        current: { end, start },
        previous: prevStart && prevEnd ? { end: prevEnd, start: prevStart } : null,
        span
    }
}

/* ── Per-day schedule metrics ─────────────────────────────────────────── */

/** Max yards a single concrete truck can physically haul. Used as both a
 *  per-order load-size cap and the upper bound on every yards-per-load
 *  metric — anything above this is a data inconsistency, not a real number. */
const FLEET_MAX_LOAD_SIZE = 10

/**
 * Reduce a single day's stored `plant_production` (the dispatch schedule
 * snapshot) into a flat metrics object the dashboard can sum / chart. This
 * is purely schedule-side data — order counts, yardage, loads, customers,
 * products, shift spans — with no dispatch-plan / help-route mixing.
 *
 * @param {Object} row - Plan row with `plan_date` + `plant_production`.
 * @param {string|null} [plantFilter] - When set to a plant code, scopes
 *  every aggregation (totals, perCustomer/perProduct, hourBuckets,
 *  bigPours, allLiveOrders) to orders from that plant only. perPlant is
 *  reduced to a single entry. Use null/undefined for an all-plants view.
 */
const computeScheduleMetrics = (row, plantFilter = null) => {
    const production = row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
    const perPlant = {}
    const perCustomer = {}
    const perProduct = {}
    const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, loads: 0, yardage: 0 }))
    const bigPours = []
    // Dedup big pours by (orderNum / customer-yardage-time) so an order that
    // appears in more than one plant block in the parsed schedule isn't
    // double-counted in the day's total.
    const bigPourSeen = new Set()
    // Live orders for the day, captured here so we can later compute the
    // shared `computeCustomerSatisfaction` score against fetched detail-
    // order ticket data without re-walking the production blob.
    const allLiveOrders = []
    let totalYardage = 0
    let totalLoads = 0
    let totalOrders = 0
    let earliestStart = null
    let latestEnd = null
    let activePlants = 0

    /** Loads (truck deliveries) for an order = yardage / loadSize — NOT
     *  `truckCount`, which is the trucks-in-rotation count and is often
     *  smaller than the delivery count (one truck does multiple trips).
     *  When loadSize is missing from the parsed dispatch HTML, fall back to
     *  the fleet maximum (10 yd³) so the yards/load average can never
     *  exceed physical truck capacity. */
    const loadsForOrder = (o) => {
        const yards = parseFloat(o?.yardage) || 0
        if (yards <= 0) return 0
        const rawLoadSize = parseFloat(o?.loadSize)
        const loadSize =
            Number.isFinite(rawLoadSize) && rawLoadSize > 0
                ? Math.min(rawLoadSize, FLEET_MAX_LOAD_SIZE)
                : FLEET_MAX_LOAD_SIZE
        return yards / loadSize
    }

    Object.keys(production).forEach((plantCode) => {
        if (plantCode === PLAN_META_KEY) return
        if (plantFilter && plantCode !== plantFilter) return
        const block = production[plantCode] || {}
        const orders = Array.isArray(block.orders) ? block.orders : []
        const liveOrders = orders.filter((o) => !isExcludedOrder(o))
        liveOrders.forEach((o) => allLiveOrders.push(o))
        const orderYardage = liveOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
        const fallbackYardage = parseFloat(block.totalYardage) || 0
        // Fall back to the parsed-summary yardage only when there are no
        // per-order rows to read from. We need to estimate loads for that
        // fallback yardage too — otherwise the day-level totalYardage
        // includes summary-only yardage while totalLoads stays at 0, and the
        // resulting yards-per-load ratio mathematically exceeds the truck
        // capacity (impossible for real pours).
        const usingFallback = liveOrders.length === 0 && orderYardage <= 0 && fallbackYardage > 0
        const yardage = usingFallback ? fallbackYardage : orderYardage
        const orderLoads = liveOrders.reduce((sum, o) => sum + loadsForOrder(o), 0)
        const loads = usingFallback ? fallbackYardage / FLEET_MAX_LOAD_SIZE : orderLoads
        const startMin = timeToMinutes(block.firstJobTime)
        const endMin = timeToMinutes(block.lastJobTime)
        if (yardage > 0 || loads > 0 || liveOrders.length > 0) activePlants += 1
        if (startMin != null && (earliestStart == null || startMin < earliestStart)) earliestStart = startMin
        if (endMin != null && (latestEnd == null || endMin > latestEnd)) latestEnd = endMin
        perPlant[plantCode] = {
            code: plantCode,
            loads,
            orderCount: liveOrders.length,
            yardage,
            yardsPerOrder: liveOrders.length > 0 ? Math.round((yardage / liveOrders.length) * 10) / 10 : null
        }
        totalYardage += yardage
        totalLoads += loads
        totalOrders += liveOrders.length

        liveOrders.forEach((o) => {
            const orderYards = parseFloat(o.yardage) || 0
            const orderLoads = loadsForOrder(o)
            const customer = (o.customer || 'Unknown').trim() || 'Unknown'
            if (!perCustomer[customer]) perCustomer[customer] = { customer, loads: 0, orders: 0, yardage: 0 }
            perCustomer[customer].yardage += orderYards
            perCustomer[customer].loads += orderLoads
            perCustomer[customer].orders += 1

            const product = (o.productCode || '—').trim() || '—'
            if (!perProduct[product]) perProduct[product] = { loads: 0, orders: 0, product, yardage: 0 }
            perProduct[product].yardage += orderYards
            perProduct[product].loads += orderLoads
            perProduct[product].orders += 1

            const startMins = timeToMinutes(o.startTime)
            if (startMins != null) {
                const hour = Math.max(0, Math.min(23, Math.floor(startMins / 60)))
                hourBuckets[hour].yardage += orderYards
                hourBuckets[hour].loads += orderLoads
            }

            // Big pour = yardage > 120 yd³ AND spacing < 10 min between
            // trucks (back-to-back loading). Anything that fails either
            // condition is a normal order — yardage alone isn't enough.
            // Dedup against the same order showing up under multiple plant
            // blocks so the count matches what's on the dispatch sheet.
            const orderSpacingMin = parseDurationMinutes(o.rate)
            const isBigPour =
                orderYards > BIG_POUR_YARDAGE_THRESHOLD &&
                orderSpacingMin != null &&
                orderSpacingMin < BIG_POUR_SPACING_THRESHOLD_MIN
            if (isBigPour) {
                const key = o.orderNum
                    ? `${row.plan_date}|${o.orderNum}`
                    : `${row.plan_date}|${plantCode}|${customer}|${orderYards}|${o.startTime || ''}`
                if (!bigPourSeen.has(key)) {
                    bigPourSeen.add(key)
                    bigPours.push({
                        customer,
                        loads: orderLoads,
                        orderNum: o.orderNum || '',
                        plantCode,
                        planDate: row.plan_date,
                        productCode: product,
                        startTime: o.startTime || '',
                        yardage: orderYards
                    })
                }
            }
        })
    })

    const shiftSpanHours =
        earliestStart != null && latestEnd != null && latestEnd > earliestStart
            ? Math.round(((latestEnd - earliestStart) / 60) * 10) / 10
            : null

    // Peak hour — the hour with the most loads (ties broken by yardage).
    let peakHour = null
    let peakHourLoads = 0
    hourBuckets.forEach((b) => {
        if (b.loads > peakHourLoads || (b.loads === peakHourLoads && b.yardage > (peakHour?.yardage || 0))) {
            peakHourLoads = b.loads
            peakHour = b
        }
    })

    // Snap per-day totals + bucket tallies to one decimal so summed floats
    // (yardage / loadSize, etc.) never bubble up as 208.39999999999998 in
    // the UI or when re-aggregated across multiple days.
    const snapTenth = (n) => Math.round(n * 10) / 10
    Object.values(perPlant).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
    })
    Object.values(perCustomer).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
    })
    Object.values(perProduct).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
    })
    hourBuckets.forEach((b) => {
        b.yardage = snapTenth(b.yardage)
        b.loads = snapTenth(b.loads)
    })

    return {
        activePlants,
        allLiveOrders,
        bigPours,
        firstJobMinutes: earliestStart,
        hourBuckets,
        lastJobMinutes: latestEnd,
        peakHour,
        perCustomer,
        perPlant,
        perProduct,
        planDate: row.plan_date,
        shiftSpanHours,
        totalLoads: snapTenth(totalLoads),
        totalOrders,
        totalYardage: snapTenth(totalYardage),
        yardagePerLoad: totalLoads > 0 ? Math.round((totalYardage / totalLoads) * 10) / 10 : null
    }
}

/** Aggregate an array of per-day schedule metrics into a single summary. */
const aggregateMetrics = (days) => {
    const summary = {
        activePlantSet: new Set(),
        avgShiftSpanHours: null,
        avgYardagePerActiveDay: 0,
        bestDay: null,
        bigPours: [],
        dayCount: days.length,
        daysWithProduction: 0,
        hourBuckets: Array.from({ length: 24 }, (_, i) => ({ hour: i, loads: 0, yardage: 0 })),
        peakHour: null,
        perCustomer: {},
        perPlant: {},
        perProduct: {},
        topCustomerShare: null,
        topPlantShare: null,
        totalLoads: 0,
        totalOrders: 0,
        totalYardage: 0,
        worstDay: null
    }
    let shiftSpanSum = 0
    let shiftSpanCount = 0
    days.forEach((p) => {
        summary.totalLoads += p.totalLoads
        summary.totalOrders += p.totalOrders
        summary.totalYardage += p.totalYardage
        if (p.totalYardage > 0 || p.totalLoads > 0 || p.totalOrders > 0) summary.daysWithProduction += 1
        if (!summary.bestDay || p.totalYardage > summary.bestDay.totalYardage) summary.bestDay = p
        if (p.totalYardage > 0 && (!summary.worstDay || p.totalYardage < summary.worstDay.totalYardage)) {
            summary.worstDay = p
        }
        if (p.shiftSpanHours != null) {
            shiftSpanSum += p.shiftSpanHours
            shiftSpanCount += 1
        }
        if (Array.isArray(p.bigPours)) summary.bigPours.push(...p.bigPours)
        Object.values(p.perPlant).forEach((block) => {
            summary.activePlantSet.add(block.code)
            if (!summary.perPlant[block.code]) {
                summary.perPlant[block.code] = { code: block.code, activeDays: 0, loads: 0, orderCount: 0, yardage: 0 }
            }
            summary.perPlant[block.code].loads += block.loads
            summary.perPlant[block.code].orderCount += block.orderCount
            summary.perPlant[block.code].yardage += block.yardage
            if (block.yardage > 0 || block.loads > 0) summary.perPlant[block.code].activeDays += 1
        })
        Object.values(p.perCustomer).forEach((block) => {
            if (!summary.perCustomer[block.customer]) {
                summary.perCustomer[block.customer] = { customer: block.customer, loads: 0, orders: 0, yardage: 0 }
            }
            summary.perCustomer[block.customer].yardage += block.yardage
            summary.perCustomer[block.customer].loads += block.loads
            summary.perCustomer[block.customer].orders += block.orders
        })
        Object.values(p.perProduct).forEach((block) => {
            if (!summary.perProduct[block.product]) {
                summary.perProduct[block.product] = { product: block.product, loads: 0, orders: 0, yardage: 0 }
            }
            summary.perProduct[block.product].yardage += block.yardage
            summary.perProduct[block.product].loads += block.loads
            summary.perProduct[block.product].orders += block.orders
        })
        p.hourBuckets.forEach((b, i) => {
            summary.hourBuckets[i].loads += b.loads
            summary.hourBuckets[i].yardage += b.yardage
        })
    })
    // Snap accumulated totals to a single decimal place so float-summation
    // artifacts (e.g. 208.39999999999998) never reach the UI. Per-bucket
    // tallies are rounded too — they feed charts and scorecard tables.
    const snapTenth = (n) => Math.round(n * 10) / 10
    summary.totalYardage = snapTenth(summary.totalYardage)
    summary.totalLoads = snapTenth(summary.totalLoads)
    summary.totalOrders = snapTenth(summary.totalOrders)
    Object.values(summary.perPlant).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
        block.orderCount = snapTenth(block.orderCount)
    })
    Object.values(summary.perCustomer).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
        block.orders = snapTenth(block.orders)
    })
    Object.values(summary.perProduct).forEach((block) => {
        block.yardage = snapTenth(block.yardage)
        block.loads = snapTenth(block.loads)
        block.orders = snapTenth(block.orders)
    })
    summary.hourBuckets.forEach((b) => {
        b.loads = snapTenth(b.loads)
        b.yardage = snapTenth(b.yardage)
    })
    summary.avgYardagePerActiveDay =
        summary.daysWithProduction > 0 ? Math.round(summary.totalYardage / summary.daysWithProduction) : 0
    summary.avgShiftSpanHours = shiftSpanCount > 0 ? Math.round((shiftSpanSum / shiftSpanCount) * 10) / 10 : null
    // Clamp the yards-per-load ratio at the fleet's physical truck capacity
    // (10 yd³). Real concrete trucks can't haul more, so any computed value
    // above that signals a yardage/loads mismatch upstream rather than a
    // real number. The clamp is a safety net — the per-plant fallback path
    // already keeps the inputs consistent.
    summary.yardagePerLoad =
        summary.totalLoads > 0
            ? Math.min(FLEET_MAX_LOAD_SIZE, Math.round((summary.totalYardage / summary.totalLoads) * 10) / 10)
            : null

    // Peak hour across the whole window.
    let peakLoads = 0
    summary.hourBuckets.forEach((b) => {
        if (b.loads > peakLoads || (b.loads === peakLoads && b.yardage > (summary.peakHour?.yardage || 0))) {
            peakLoads = b.loads
            summary.peakHour = b
        }
    })

    // Concentration — top customer / top plant share of yardage.
    const topCustomer = Object.values(summary.perCustomer).sort((a, b) => b.yardage - a.yardage)[0]
    if (topCustomer && summary.totalYardage > 0) {
        summary.topCustomerShare = {
            customer: topCustomer.customer,
            share: topCustomer.yardage / summary.totalYardage,
            yardage: topCustomer.yardage
        }
    }
    const topPlant = Object.values(summary.perPlant).sort((a, b) => b.yardage - a.yardage)[0]
    if (topPlant && summary.totalYardage > 0) {
        summary.topPlantShare = {
            code: topPlant.code,
            share: topPlant.yardage / summary.totalYardage,
            yardage: topPlant.yardage
        }
    }

    return summary
}

/* ── Formatting helpers ───────────────────────────────────────────────── */

const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '—')
const fmtFloat = (n, dp = 1) => (Number.isFinite(n) ? n.toFixed(dp) : '—')
const fmtPct = (n) => (Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—')
const fmtDate = (iso) => {
    const d = parseIsoLocal(iso)
    if (!d) return iso || ''
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}
const fmtRange = (start, end) => {
    if (!start || !end) return ''
    if (start === end) return fmtDate(start)
    return `${fmtDate(start)} – ${fmtDate(end)}`
}
const fmtMinutesAsHHMM = (mins) => {
    if (!Number.isFinite(mins)) return '—'
    const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    const period = h >= 12 ? 'PM' : 'AM'
    const display = h % 12 === 0 ? 12 : h % 12
    return `${display}:${String(m).padStart(2, '0')} ${period}`
}

const deltaPct = (current, previous) => {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
    return ((current - previous) / previous) * 100
}

const deltaColor = (pct) => {
    if (pct == null) return undefined
    if (Math.abs(pct) < 0.1) return 'var(--text-secondary)'
    return pct > 0 ? '#16a34a' : '#dc2626'
}

/* ── Chart styling ────────────────────────────────────────────────────── */

const CHART_TOOLTIP_STYLE = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 12
}

/* ── Sub components ───────────────────────────────────────────────────── */

/** Inline KPI hint — leads with intrinsic context (e.g. "yd³/load"); appends
 *  a subtle Δ% pill only when a comparison value is provided. */
function DeltaHint({ base, current, previous }) {
    const pct = deltaPct(current, previous)
    if (!Number.isFinite(previous) || pct == null) return base ?? null
    return (
        <span className="inline-flex items-center gap-1.5">
            <span style={{ color: 'var(--text-tertiary)' }}>{base}</span>
            <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-semibold tabular-nums"
                style={{
                    background: `${deltaColor(pct) || 'var(--text-tertiary)'}1f`,
                    color: deltaColor(pct) || 'var(--text-tertiary)'
                }}
            >
                <i className={`fas fa-${pct >= 0 ? 'arrow-up' : 'arrow-down'} text-[8px]`} />
                {fmtPct(pct).replace('+', '').replace('-', '')}
            </span>
        </span>
    )
}

function ComparisonRow({ current, label, previous }) {
    const pct = deltaPct(current.value, previous?.value)
    return (
        <div
            className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 items-center text-[12.5px]"
            style={{ borderTop: '1px solid var(--border-light)' }}
        >
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span className="font-semibold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {current.formatted}
            </span>
            <span className="font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                {previous ? previous.formatted : '—'}
            </span>
            <span
                className="font-semibold font-mono tabular-nums text-right"
                style={{ color: deltaColor(pct), minWidth: 60 }}
            >
                {pct == null ? '—' : fmtPct(pct)}
            </span>
        </div>
    )
}

function TrendChart({ data, accent, comparisonData }) {
    const merged = useMemo(
        () =>
            data.map((d, idx) => ({
                ...d,
                comparisonYardage: comparisonData?.[idx]?.totalYardage ?? null,
                shortDate: fmtDate(d.planDate)
            })),
        [data, comparisonData]
    )
    return (
        <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={merged} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="shortDate"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} tickFormatter={fmtInt} />
                    <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ stroke: accent, strokeOpacity: 0.2 }}
                        formatter={(value, name) => [fmtInt(value), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                        type="monotone"
                        dataKey="totalYardage"
                        name="Yardage"
                        stroke={accent}
                        strokeWidth={2}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="totalLoads"
                        name="Loads"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="4 3"
                    />
                    {comparisonData && (
                        <Line
                            type="monotone"
                            dataKey="comparisonYardage"
                            name="Yardage (prior)"
                            stroke="var(--text-tertiary)"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="2 4"
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function ByPlantChart({ accent, plantNameByCode, rows }) {
    const trimmed = useMemo(
        () =>
            [...rows]
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, 12)
                .map((r) => ({
                    ...r,
                    name: plantNameByCode?.[r.code] ? `${r.code} · ${plantNameByCode[r.code]}` : r.code
                })),
        [rows, plantNameByCode]
    )
    if (trimmed.length === 0) {
        return (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No plant production data in the selected range.
            </div>
        )
    }
    return (
        <div style={{ height: Math.max(220, trimmed.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trimmed} layout="vertical" margin={{ bottom: 4, left: 8, right: 16, top: 8 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={fmtInt} />
                    <YAxis
                        type="category"
                        dataKey="code"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        width={64}
                    />
                    <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accent}10` }}
                        formatter={(value, name) => [fmtInt(value), name]}
                    />
                    <Bar dataKey="yardage" name="Yardage" radius={[0, 3, 3, 0]}>
                        {trimmed.map((row, idx) => (
                            <Cell
                                key={row.code}
                                fill={plantBadgeColor(
                                    row.code,
                                    FALLBACK_SERIES_COLORS[idx % FALLBACK_SERIES_COLORS.length]
                                )}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function DayOfWeekChart({ accent, plans }) {
    const data = useMemo(() => {
        // Mon–Sat only — Sundays are non-operating days for the plant.
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const buckets = labels.map((label) => ({ avg: 0, count: 0, label, total: 0 }))
        plans.forEach((p) => {
            const d = parseIsoLocal(p.planDate)
            if (!d) return
            const dow = d.getDay()
            if (dow === 0) return
            const bucket = buckets[dow - 1]
            bucket.total += p.totalYardage
            bucket.count += 1
        })
        buckets.forEach((b) => {
            b.avg = b.count > 0 ? Math.round(b.total / b.count) : 0
        })
        return buckets
    }, [plans])
    return (
        <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ bottom: 4, left: 0, right: 8, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} tickFormatter={fmtInt} />
                    <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accent}10` }}
                        formatter={(value, _name, item) => [
                            `${fmtInt(value)} yd³ avg · ${item?.payload?.count} day${item?.payload?.count === 1 ? '' : 's'}`,
                            'Yardage'
                        ]}
                    />
                    <Bar dataKey="avg" name="Avg yardage" fill={accent} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function RankedList({ accent, emptyLabel, items, labelKey, secondaryFmt, valueLabel = 'yd³' }) {
    if (items.length === 0) {
        return (
            <div className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                {emptyLabel}
            </div>
        )
    }
    const max = items[0].yardage
    return (
        <div className="flex flex-col gap-1.5">
            {items.map((item, idx) => (
                <div key={item[labelKey] || idx} className="flex items-center gap-2 text-[12px]">
                    <span
                        className="font-mono tabular-nums w-5 text-right shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {idx + 1}
                    </span>
                    <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                        {item[labelKey]}
                    </span>
                    <div
                        className="h-4 rounded-sm overflow-hidden relative shrink-0"
                        style={{ background: 'var(--bg-tertiary)', width: 80 }}
                    >
                        <div
                            className="h-full"
                            style={{ background: accent, width: `${max > 0 ? (item.yardage / max) * 100 : 0}%` }}
                        />
                    </div>
                    <span
                        className="font-mono tabular-nums font-semibold w-20 text-right shrink-0"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {fmtInt(item.yardage)} {valueLabel}
                    </span>
                    {secondaryFmt && (
                        <span
                            className="font-mono tabular-nums w-16 text-right shrink-0"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            {secondaryFmt(item)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}

/**
 * Per-plant operational scorecard — one row per plant in the period, sorted
 * by yardage, with utilization context (loads/active-day, share of regional
 * yardage, plus a status pill when truck counts are known for the day).
 */
function PlantScorecardTable({
    accent,
    mixerCountsByPlant,
    plantNameByCode,
    rows,
    totalYardage,
    isSingleDay,
    singleDayShiftSpan
}) {
    if (rows.length === 0) {
        return (
            <div className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No plant production in this range.
            </div>
        )
    }
    const sorted = [...rows].sort((a, b) => b.yardage - a.yardage)
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ color: 'var(--text-tertiary)' }}>
                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                            Plant
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Yardage
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Loads
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Orders
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Loads/day
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                            Share
                        </th>
                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((plant) => {
                        const share = totalYardage > 0 ? (plant.yardage / totalYardage) * 100 : 0
                        const trucks = mixerCountsByPlant?.[plant.code] || 0
                        let status = null
                        if (isSingleDay && trucks > 0 && singleDayShiftSpan && plant.yardage > 0) {
                            const yph = plant.yardage / (trucks * singleDayShiftSpan)
                            if (yph > MAX_YPH) status = { color: '#dc2626', label: 'Overbooked' }
                            else if (yph < TARGET_YPH - 0.5 && plant.loads >= 6)
                                status = { color: '#16a34a', label: 'Slack' }
                            else status = { color: '#0ea5e9', label: 'On target' }
                        } else if (plant.activeDays > 0) {
                            const loadsPerDay = plant.loads / plant.activeDays
                            if (loadsPerDay > 30) status = { color: '#dc2626', label: 'Heavy' }
                            else if (loadsPerDay >= 12) status = { color: '#0ea5e9', label: 'Steady' }
                            else status = { color: '#16a34a', label: 'Light' }
                        }
                        const loadsPerDay =
                            plant.activeDays > 0 ? Math.round((plant.loads / plant.activeDays) * 10) / 10 : null
                        return (
                            <tr key={plant.code} style={{ borderTop: '1px solid var(--border-light)' }}>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full shrink-0"
                                            style={{ background: plantBadgeColor(plant.code, accent) }}
                                        />
                                        <span
                                            className="font-mono tabular-nums font-semibold"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {plant.code}
                                        </span>
                                        {plantNameByCode?.[plant.code] && (
                                            <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                                                {plantNameByCode[plant.code]}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums font-semibold"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {fmtInt(plant.yardage)}
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {fmtInt(plant.loads)}
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {fmtInt(plant.orderCount)}
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {loadsPerDay != null ? fmtFloat(loadsPerDay) : '—'}
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {share.toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {status && (
                                        <span
                                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold"
                                            style={{ background: `${status.color}1f`, color: status.color }}
                                        >
                                            {status.label}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/** Big-pour callout list — orders ≥ 120 yd³ that benefit from early coordination. */
/** Tier-color a 0–100 score — green ≥ 90 (Schedule-tab "happy"), amber ≥ 75
 *  ("watching"), red below ("bad service"). Mirrors the Schedule tab's
 *  SatisfactionBadge so headlines on both surfaces feel identical. */
const satisfactionColor = (score100) => {
    if (score100 == null) return 'var(--text-tertiary)'
    if (score100 >= 90) return '#15803d'
    if (score100 >= 75) return '#b45309'
    return '#b91c1c'
}

/**
 * Customer satisfaction chart — wraps the SHARED `computeCustomerSatisfaction`
 * results from `PlanUtility` so the page reads the same score the Schedule
 * tab badge reads. Per-day score points feed a trend line; the headline shows
 * the period-aggregate score with good/bad-service counts and a sample tally.
 */
function SatisfactionChart({ accent, aggregate, isLoading, satisfactionByDay, days }) {
    const trend = useMemo(
        () =>
            days
                .map((d) => {
                    const sat = satisfactionByDay[d.planDate]
                    if (!sat) return null
                    return {
                        badService: sat.badService,
                        goodService: sat.goodService,
                        label: fmtDate(d.planDate),
                        samples: sat.samples,
                        score: Math.round(sat.score * 100)
                    }
                })
                .filter(Boolean),
        [days, satisfactionByDay]
    )
    const score100 = aggregate ? Math.round(aggregate.score * 100) : null
    const headlineColor = satisfactionColor(score100)
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-end gap-3 px-1">
                <div className="flex items-baseline gap-1">
                    <span
                        className="text-[40px] font-bold leading-none font-mono tabular-nums"
                        style={{ color: headlineColor }}
                    >
                        {score100 == null ? '—' : score100}
                    </span>
                    <span className="text-[16px] font-semibold" style={{ color: headlineColor }}>
                        %
                    </span>
                </div>
                <div className="flex flex-col text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {aggregate ? (
                        <>
                            <span>
                                {fmtInt(aggregate.goodService)} good service · {fmtInt(aggregate.badService)} bad
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                across {fmtInt(aggregate.samples)} order
                                {aggregate.samples === 1 ? '' : 's'} with ticket data
                            </span>
                        </>
                    ) : (
                        <>
                            <span>{isLoading ? 'Fetching ticket data…' : 'No ticket data in range'}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                Score combines pace (60%) and on-time start (40%)
                            </span>
                        </>
                    )}
                </div>
            </div>

            {trend.length > 1 ? (
                <div style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
                            <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                            <XAxis
                                dataKey="label"
                                stroke="var(--text-tertiary)"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                            />
                            <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} width={30} />
                            <Tooltip
                                contentStyle={CHART_TOOLTIP_STYLE}
                                cursor={{ stroke: accent, strokeOpacity: 0.2 }}
                                formatter={(value, _name, item) => [
                                    `${value}% · ${item?.payload?.goodService} good / ${item?.payload?.badService} bad`,
                                    'Score'
                                ]}
                            />
                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke={accent}
                                strokeWidth={2}
                                dot={{ r: 2.5 }}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div
                    className="text-[11.5px] py-3 px-2 rounded text-center"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
                >
                    {isLoading
                        ? 'Loading per-day ticket data…'
                        : 'Trend chart needs at least two days with ticket data.'}
                </div>
            )}
        </div>
    )
}

function BigPoursTable({ accent, plantNameByCode, pours }) {
    if (pours.length === 0) {
        return (
            <div className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No big pours scheduled in this range.
            </div>
        )
    }
    const sorted = [...pours].sort((a, b) => b.yardage - a.yardage).slice(0, 12)
    return (
        <div className="flex flex-col">
            {sorted.map((pour, idx) => (
                <div
                    key={`${pour.planDate}-${pour.plantCode}-${pour.orderNum || idx}`}
                    className="flex items-center gap-3 px-3 py-2 text-[12px]"
                    style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <div
                        className="w-9 h-9 rounded flex flex-col items-center justify-center shrink-0"
                        style={{
                            background: `${plantBadgeColor(pour.plantCode, accent)}1f`,
                            color: plantBadgeColor(pour.plantCode, accent)
                        }}
                    >
                        <span className="text-[10px] font-bold tabular-nums leading-none">
                            {fmtDate(pour.planDate).split(' ')[1]}
                        </span>
                        <span className="text-[8.5px] uppercase tracking-wider">
                            {fmtDate(pour.planDate).split(' ')[0]}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {pour.customer}
                        </div>
                        <div
                            className="text-[11px] flex items-center gap-2 flex-wrap"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <span className="font-mono tabular-nums">{pour.plantCode}</span>
                            {plantNameByCode?.[pour.plantCode] && <span>· {plantNameByCode[pour.plantCode]}</span>}
                            {pour.startTime && <span>· {fmtMinutesAsHHMM(timeToMinutes(pour.startTime))}</span>}
                            {pour.productCode && pour.productCode !== '—' && <span>· {pour.productCode}</span>}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {fmtInt(pour.yardage)} yd³
                        </div>
                        <div className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                            {fmtInt(pour.loads)} loads
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ── Main component ───────────────────────────────────────────────────── */

/**
 * Statistics dashboard for the Plan tab. Loads the per-day saved schedule
 * snapshots (`plant_production` JSON on each plan row) across the selected
 * range and compares yardage / loads / orders / customers / products /
 * hourly shape against an optional previous period or the same period last
 * year. Pure schedule-side metrics — no dispatch-plan / help-route mixing.
 */
function PlanStatisticsView({ accentColor, planDate, plantNameByCode, liveProduction, mixerCountsByPlant }) {
    const [period, setPeriod] = useState('week')
    const [comparison, setComparison] = useState('none')
    const [showCompareMenu, setShowCompareMenu] = useState(false)
    const [anchor, setAnchor] = useState(planDate || isoDate(new Date()))
    const [customStart, setCustomStart] = useState(planDate || isoDate(new Date()))
    const [customEnd, setCustomEnd] = useState(planDate || isoDate(new Date()))
    const [loading, setLoading] = useState(true)
    /** Raw plan rows from the database — kept un-aggregated so the plant
     *  filter can re-derive every metric without a re-fetch. */
    const [currentRows, setCurrentRows] = useState([])
    const [previousRows, setPreviousRows] = useState([])
    /** null = all plants; otherwise a plant_code that scopes every
     *  aggregation, chart, and table on the page. */
    const [selectedPlant, setSelectedPlant] = useState(null)
    const [showPlantMenu, setShowPlantMenu] = useState(false)
    /** Per-day detail-order maps (orderId → ticket data) fetched from the
     *  dispatch storage bucket. Feeds `computeCustomerSatisfaction` so this
     *  page produces the EXACT same score the Schedule tab shows for the
     *  current day. Days with no detail data are scored as null. */
    const [detailByDay, setDetailByDay] = useState({})
    const [satisfactionLoading, setSatisfactionLoading] = useState(false)

    useEffect(() => {
        if (planDate) setAnchor(planDate)
    }, [planDate])

    const range = useMemo(
        () => buildRange(period, anchor, comparison, customStart, customEnd),
        [period, anchor, comparison, customStart, customEnd]
    )

    /** True when the user is looking at a single calendar day — unlocks
     *  truck-utilization status pills that need a per-day shift span. */
    const isSingleDay = useMemo(
        () => period === 'day' || (period === 'custom' && customStart === customEnd),
        [period, customStart, customEnd]
    )

    /** Working-day count for the current window (Sundays excluded), used as the
     *  denominator for "X of Y days" KPI hints. */
    const workingDayCount = useMemo(() => {
        const start = parseIsoLocal(range.current.start)
        const end = parseIsoLocal(range.current.end)
        if (!start || !end) return 0
        let n = 0
        const cursor = new Date(start)
        while (cursor <= end) {
            if (cursor.getDay() !== 0) n += 1
            cursor.setDate(cursor.getDate() + 1)
        }
        return n
    }, [range])

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                const [fetchedCurrent, fetchedPrevious] = await Promise.all([
                    PlanService.fetchPlansInRange(range.current.start, range.current.end),
                    range.previous
                        ? PlanService.fetchPlansInRange(range.previous.start, range.previous.end)
                        : Promise.resolve([])
                ])
                if (cancelled) return
                setCurrentRows(fetchedCurrent || [])
                setPreviousRows(fetchedPrevious || [])
            } catch {
                if (cancelled) return
                setCurrentRows([])
                setPreviousRows([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [range])

    /** Derive per-day metrics from the raw rows. Re-runs cheaply when the
     *  plant filter changes — no re-fetch needed. The live-production
     *  fallback runs here so it picks up the same plant filter. */
    const currentDays = useMemo(() => {
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
    }, [currentRows, selectedPlant, planDate, liveProduction, range])

    const previousDays = useMemo(
        () =>
            (previousRows || [])
                .map((row) => computeScheduleMetrics(row, selectedPlant))
                .filter((d) => !isSundayIso(d.planDate)),
        [previousRows, selectedPlant]
    )

    /** Distinct plant codes present in the loaded window (not the global
     *  plant directory). Sorted alphabetically; each entry carries its
     *  display name when one is known. The selected plant is kept in the
     *  list even if the new range has no rows for it so the dropdown
     *  still shows what's currently filtered. */
    const availablePlants = useMemo(() => {
        const codes = new Set()
        ;(currentRows || []).forEach((row) => {
            const production =
                row?.plant_production && typeof row.plant_production === 'object' ? row.plant_production : {}
            Object.keys(production).forEach((code) => {
                if (code !== PLAN_META_KEY) codes.add(code)
            })
        })
        if (selectedPlant) codes.add(selectedPlant)
        return [...codes].sort().map((code) => ({
            code,
            label: plantNameByCode?.[code] ? `${code} · ${plantNameByCode[code]}` : code
        }))
    }, [currentRows, plantNameByCode, selectedPlant])

    /** Fetch detail-order ticket data for every working day in the current
     *  range whose schedule we already loaded. Per-day fetches run in
     *  parallel; cached entries are skipped so changing window/comparison
     *  doesn't redo work. The bucket only retains a few weeks of history
     *  reliably — older days will return empty maps and silently drop out
     *  of the satisfaction score (as expected). */
    useEffect(() => {
        if (currentDays.length === 0) return undefined
        let cancelled = false
        const dates = currentDays.map((d) => d.planDate).filter((d) => !(d in detailByDay))
        if (dates.length === 0) return undefined
        setSatisfactionLoading(true)
        Promise.all(dates.map((date) => DetailOrderBucketService.fetchByDate(date).catch(() => ({}))))
            .then((results) => {
                if (cancelled) return
                setDetailByDay((prev) => {
                    const next = { ...prev }
                    dates.forEach((date, idx) => {
                        next[date] = results[idx] || {}
                    })
                    return next
                })
            })
            .finally(() => {
                if (!cancelled) setSatisfactionLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [currentDays, detailByDay])

    /** Per-day satisfaction (using the shared `computeCustomerSatisfaction`
     *  with the same inputs as the Schedule tab). Null entries mean we have
     *  no ticket data for that day yet. */
    const satisfactionByDay = useMemo(() => {
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
    }, [currentDays, detailByDay])

    /** Period-aggregated satisfaction. Computed by feeding the FULL flat
     *  order list and the merged detail map into the same shared function
     *  that the Schedule tab uses — the math stays identical. */
    const satisfactionAggregate = useMemo(() => {
        if (!currentDays.length) return null
        const allOrders = []
        const mergedDetail = {}
        let anyDetailFetched = false
        currentDays.forEach((d) => {
            const liveOrders = d.allLiveOrders || []
            liveOrders.forEach((o) => allOrders.push(o))
            const detail = detailByDay[d.planDate]
            if (detail) {
                anyDetailFetched = true
                Object.entries(detail).forEach(([orderId, entry]) => {
                    mergedDetail[orderId] = entry
                })
            }
        })
        if (!anyDetailFetched) return null
        return computeCustomerSatisfaction(allOrders, mergedDetail)
    }, [currentDays, detailByDay])

    const currentSummary = useMemo(() => aggregateMetrics(currentDays), [currentDays])
    const previousSummary = useMemo(
        () => (comparison === 'none' ? null : aggregateMetrics(previousDays)),
        [previousDays, comparison]
    )
    /** Pad missing dates with zero-rows so the trend chart shows the full window.
     *  Skips Sundays since plants are closed and we don't surface them anywhere
     *  else on the page. */
    const padTrend = (start, end, sourceDays) => {
        const map = new Map(sourceDays.map((p) => [p.planDate, p]))
        const out = []
        let cursor = parseIsoLocal(start)
        const endDate = parseIsoLocal(end)
        if (!cursor || !endDate) return sourceDays
        while (cursor <= endDate) {
            if (cursor.getDay() !== 0) {
                const iso = isoDate(cursor)
                const row = map.get(iso)
                out.push({
                    planDate: iso,
                    totalLoads: row?.totalLoads || 0,
                    totalYardage: row?.totalYardage || 0
                })
            }
            cursor.setDate(cursor.getDate() + 1)
        }
        return out
    }

    const trendData = useMemo(
        () => (currentDays.length === 0 ? [] : padTrend(range.current.start, range.current.end, currentDays)),
        [currentDays, range]
    )
    const trendComparison = useMemo(
        () =>
            comparison !== 'none' && range.previous && previousDays.length > 0
                ? padTrend(range.previous.start, range.previous.end, previousDays)
                : null,
        [previousDays, range, comparison]
    )

    const topCustomers = useMemo(
        () =>
            Object.values(currentSummary.perCustomer)
                .filter((c) => c.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, 8),
        [currentSummary]
    )
    const topProducts = useMemo(
        () =>
            Object.values(currentSummary.perProduct)
                .filter((c) => c.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, 8),
        [currentSummary]
    )

    /** The schedule HTML occasionally lists ghost plant codes (956, 601, 265, …)
     *  that are sentinels or stale entries — not real production plants. The
     *  authoritative list of real plants is `plantNameByCode`, populated from
     *  the `plants` table, so we only surface scorecard / chart rows for
     *  codes that have a name registered there. */
    const knownPlantRows = useMemo(
        () => Object.values(currentSummary.perPlant).filter((p) => Boolean(plantNameByCode?.[p.code])),
        [currentSummary, plantNameByCode]
    )

    const knownPlantSummary = useMemo(() => {
        const totalYardage = knownPlantRows.reduce((sum, p) => sum + (p.yardage || 0), 0)
        const activeCount = knownPlantRows.filter((p) => p.yardage > 0 || p.loads > 0).length
        const top = [...knownPlantRows].sort((a, b) => b.yardage - a.yardage)[0]
        const topShare =
            top && totalYardage > 0 ? { code: top.code, share: top.yardage / totalYardage, yardage: top.yardage } : null
        return { activeCount, topShare, totalYardage }
    }, [knownPlantRows])

    /** Calendar-aware label for the current window — "April 2026", "Q2 2026",
     *  the Mon–Sat range for weeks, or a single date for a single day. Falls
     *  back to a date range for custom selections. */
    const periodLabel = useMemo(() => {
        const sd = parseIsoLocal(range.current.start)
        const ed = parseIsoLocal(range.current.end)
        if (!sd || !ed) return fmtRange(range.current.start, range.current.end)
        if (period === 'day') {
            return sd.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' })
        }
        if (period === 'month') {
            return sd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }
        if (period === 'quarter') {
            return `Q${Math.floor(sd.getMonth() / 3) + 1} ${sd.getFullYear()}`
        }
        if (period === 'year') {
            return String(sd.getFullYear())
        }
        return fmtRange(range.current.start, range.current.end)
    }, [period, range])

    /** Advance / rewind the anchor by one calendar unit of the active period.
     *  Day = ±1 day, Week = ±7 days (lands on the previous/next Monday since
     *  the anchor maps to the same week regardless of weekday), Month = the
     *  same day-of-month in the next/previous calendar month, Quarter = the
     *  same day-of-month three calendar months away. */
    const shiftPeriod = (direction) => {
        setAnchor((prev) => {
            const base = parseIsoLocal(prev) || new Date()
            if (period === 'day') {
                base.setDate(base.getDate() + direction)
            } else if (period === 'week') {
                base.setDate(base.getDate() + direction * 7)
            } else if (period === 'month') {
                base.setMonth(base.getMonth() + direction)
            } else if (period === 'quarter') {
                base.setMonth(base.getMonth() + direction * 3)
            } else if (period === 'year') {
                base.setFullYear(base.getFullYear() + direction)
            } else {
                base.setDate(base.getDate() + direction)
            }
            return isoDate(base)
        })
    }

    const handleExport = () => {
        const rows = [
            ['Date', 'Yardage', 'Loads', 'Orders', 'Active plants', 'First job', 'Last job', 'Shift span (h)']
        ]
        currentDays.forEach((p) => {
            rows.push([
                p.planDate,
                p.totalYardage,
                p.totalLoads,
                p.totalOrders,
                p.activePlants,
                fmtMinutesAsHHMM(p.firstJobMinutes),
                fmtMinutesAsHHMM(p.lastJobMinutes),
                p.shiftSpanHours ?? ''
            ])
        })
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `schedule-stats-${range.current.start}_to_${range.current.end}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto" data-content-scroll>
            <div className="px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
                {/* Period + comparison controls */}
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        className="flex items-center rounded-lg p-0.5"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
                    >
                        {PERIODS.map(({ id, label }) => (
                            <button
                                key={id}
                                onClick={() => setPeriod(id)}
                                className="rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5"
                                style={{
                                    backgroundColor: period === id ? accentColor : 'transparent',
                                    color: period === id ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {period !== 'custom' ? (
                        <div
                            className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1 py-0.5"
                            style={{
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-light)'
                            }}
                        >
                            <button
                                onClick={() => shiftPeriod(-1)}
                                className="border-none bg-transparent cursor-pointer p-1.5 rounded"
                                style={{ color: 'var(--text-secondary)' }}
                                title="Previous period"
                            >
                                <i className="fas fa-chevron-left text-xs" />
                            </button>
                            <span className="px-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {periodLabel}
                            </span>
                            <button
                                onClick={() => shiftPeriod(1)}
                                className="border-none bg-transparent cursor-pointer p-1.5 rounded"
                                style={{ color: 'var(--text-secondary)' }}
                                title="Next period"
                            >
                                <i className="fas fa-chevron-right text-xs" />
                            </button>
                            <button
                                onClick={() => setAnchor(isoDate(new Date()))}
                                className="border-none bg-transparent cursor-pointer px-2 py-1 rounded text-xs font-semibold"
                                style={{ color: accentColor }}
                            >
                                Today
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs">
                            <input
                                type="date"
                                value={customStart}
                                max={customEnd}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded px-2 py-1 text-xs"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>to</span>
                            <input
                                type="date"
                                value={customEnd}
                                min={customStart}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded px-2 py-1 text-xs"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                    )}
                    <div className="relative ml-auto">
                        <button
                            onClick={() => setShowPlantMenu((s) => !s)}
                            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                            style={{
                                backgroundColor: selectedPlant ? `${accentColor}20` : 'var(--bg-tertiary)',
                                color: selectedPlant ? accentColor : 'var(--text-secondary)'
                            }}
                            title="Filter every chart and table to a single plant"
                        >
                            <i className="fas fa-industry text-[11px]" />
                            <span>
                                {selectedPlant
                                    ? `Plant · ${plantNameByCode?.[selectedPlant] ? `${selectedPlant}` : selectedPlant}`
                                    : 'All plants'}
                            </span>
                            <i className={`fas fa-chevron-${showPlantMenu ? 'up' : 'down'} text-[9px]`} />
                        </button>
                        {showPlantMenu && (
                            <div
                                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-lg z-10 min-w-[220px] max-h-[320px] overflow-y-auto"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)'
                                }}
                            >
                                <button
                                    onClick={() => {
                                        setSelectedPlant(null)
                                        setShowPlantMenu(false)
                                    }}
                                    className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                                    style={{
                                        backgroundColor: !selectedPlant ? `${accentColor}15` : 'transparent',
                                        color: !selectedPlant ? accentColor : 'var(--text-primary)'
                                    }}
                                >
                                    <span>All plants</span>
                                    {!selectedPlant && <i className="fas fa-check text-[10px]" />}
                                </button>
                                {availablePlants.length === 0 ? (
                                    <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                        No plants in this range
                                    </div>
                                ) : (
                                    availablePlants.map(({ code, label }) => (
                                        <button
                                            key={code}
                                            onClick={() => {
                                                setSelectedPlant(code)
                                                setShowPlantMenu(false)
                                            }}
                                            className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                                            style={{
                                                backgroundColor:
                                                    selectedPlant === code ? `${accentColor}15` : 'transparent',
                                                color: selectedPlant === code ? accentColor : 'var(--text-primary)'
                                            }}
                                        >
                                            <span className="truncate">{label}</span>
                                            {selectedPlant === code && <i className="fas fa-check text-[10px]" />}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowCompareMenu((s) => !s)}
                            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                            style={{
                                backgroundColor: comparison !== 'none' ? `${accentColor}20` : 'var(--bg-tertiary)',
                                color: comparison !== 'none' ? accentColor : 'var(--text-secondary)'
                            }}
                            title="Compare against another period"
                        >
                            <i className="fas fa-code-compare text-[11px]" />
                            <span>
                                {comparison === 'none'
                                    ? 'Compare'
                                    : `Compare · ${COMPARISONS.find((c) => c.id === comparison)?.label}`}
                            </span>
                            <i className={`fas fa-chevron-${showCompareMenu ? 'up' : 'down'} text-[9px]`} />
                        </button>
                        {showCompareMenu && (
                            <div
                                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-lg z-10 min-w-[160px]"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)'
                                }}
                            >
                                {COMPARISONS.map(({ id, label }) => (
                                    <button
                                        key={id}
                                        onClick={() => {
                                            setComparison(id)
                                            setShowCompareMenu(false)
                                        }}
                                        className="w-full text-left text-xs font-semibold border-none cursor-pointer px-3 py-2 flex items-center justify-between"
                                        style={{
                                            backgroundColor: comparison === id ? `${accentColor}15` : 'transparent',
                                            color: comparison === id ? accentColor : 'var(--text-primary)'
                                        }}
                                    >
                                        <span>{label}</span>
                                        {comparison === id && <i className="fas fa-check text-[10px]" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={currentDays.length === 0}
                        className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        title="Download per-day schedule metrics as CSV"
                    >
                        <i className="fas fa-file-csv" />
                        <span>Export</span>
                    </button>
                </div>

                {/* Compact KPI strip — context, not the headline. */}
                <StatGroup columns={6}>
                    <Stat
                        label="Total yardage"
                        value={fmtInt(currentSummary.totalYardage)}
                        hint={
                            <DeltaHint
                                base={`${fmtInt(currentSummary.totalLoads)} loads`}
                                current={currentSummary.totalYardage}
                                previous={previousSummary?.totalYardage}
                            />
                        }
                    />
                    <Stat
                        label="Avg per day"
                        value={fmtInt(currentSummary.avgYardagePerActiveDay)}
                        hint={
                            <DeltaHint
                                base={`${currentSummary.daysWithProduction} of ${workingDayCount} working day${workingDayCount === 1 ? '' : 's'}`}
                                current={currentSummary.avgYardagePerActiveDay}
                                previous={previousSummary?.avgYardagePerActiveDay}
                            />
                        }
                    />
                    <Stat
                        label="Yards / load"
                        value={currentSummary.yardagePerLoad != null ? fmtFloat(currentSummary.yardagePerLoad) : '—'}
                        hint={
                            <DeltaHint
                                base="utilization"
                                current={currentSummary.yardagePerLoad}
                                previous={previousSummary?.yardagePerLoad}
                            />
                        }
                    />
                    <Stat
                        label="Peak hour"
                        value={
                            currentSummary.peakHour && currentSummary.peakHour.loads > 0
                                ? fmtMinutesAsHHMM(currentSummary.peakHour.hour * 60).replace(':00', '')
                                : '—'
                        }
                        hint={
                            currentSummary.peakHour && currentSummary.peakHour.loads > 0
                                ? `${currentSummary.peakHour.loads} loads start`
                                : 'no start times'
                        }
                    />
                    <Stat
                        label="Avg shift span"
                        value={
                            currentSummary.avgShiftSpanHours != null
                                ? `${fmtFloat(currentSummary.avgShiftSpanHours)}h`
                                : '—'
                        }
                        hint={
                            <DeltaHint
                                base="first → last job"
                                current={currentSummary.avgShiftSpanHours}
                                previous={previousSummary?.avgShiftSpanHours}
                            />
                        }
                    />
                    <Stat
                        label="Big pours"
                        value={fmtInt(currentSummary.bigPours.length)}
                        hint={
                            currentSummary.bigPours.length > 0
                                ? `>${BIG_POUR_YARDAGE_THRESHOLD} yd³ · <${BIG_POUR_SPACING_THRESHOLD_MIN}m spacing`
                                : 'none scheduled'
                        }
                    />
                </StatGroup>

                {loading && (
                    <div
                        className="rounded px-4 py-3 flex items-center gap-2 text-xs"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <i className="fas fa-spinner fa-spin" />
                        Loading schedule data…
                    </div>
                )}

                {!loading && currentDays.length === 0 && (
                    <div
                        className="rounded p-8 text-center text-sm"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <i
                            className="fas fa-chart-line text-2xl mb-2 block"
                            style={{ color: 'var(--text-tertiary)' }}
                        />
                        No saved schedules in {fmtRange(range.current.start, range.current.end)}.
                    </div>
                )}

                {!loading && currentDays.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {/* Hero: yardage per plant over the active time frame.
                            Plant breakdown is the most actionable summary the
                            page can show — collapses to a single bar when the
                            user has filtered to one plant. */}
                        <Panel
                            title={
                                selectedPlant
                                    ? `Yardage · ${plantNameByCode?.[selectedPlant] ? `${selectedPlant} · ${plantNameByCode[selectedPlant]}` : selectedPlant}`
                                    : 'Yardage by plant'
                            }
                            innerClassName="p-3"
                            right={
                                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                    {currentSummary.activePlantSet.size} plant
                                    {currentSummary.activePlantSet.size === 1 ? '' : 's'} ·{' '}
                                    {fmtInt(currentSummary.totalYardage)} yd³ total
                                </span>
                            }
                        >
                            <ByPlantChart
                                accent={accentColor}
                                plantNameByCode={plantNameByCode}
                                rows={knownPlantRows}
                            />
                        </Panel>

                        {/* 2-column body: operational tables/trends on the
                            left (main column), supporting risk lists and
                            mix breakdowns on the right (sidebar column).
                            3:2 ratio gives the wider panels enough room for
                            tables without crowding the sidebar lists. */}
                        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
                            <div className="flex flex-col gap-4 min-w-0">
                                <Panel
                                    title="Plant scorecards"
                                    innerClassName="p-0"
                                    right={
                                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                            {knownPlantSummary.activeCount} active ·{' '}
                                            {knownPlantSummary.topShare
                                                ? `top: ${knownPlantSummary.topShare.code} (${(knownPlantSummary.topShare.share * 100).toFixed(0)}%)`
                                                : '—'}
                                        </span>
                                    }
                                >
                                    <PlantScorecardTable
                                        accent={accentColor}
                                        isSingleDay={isSingleDay}
                                        mixerCountsByPlant={mixerCountsByPlant}
                                        plantNameByCode={plantNameByCode}
                                        rows={knownPlantRows}
                                        singleDayShiftSpan={isSingleDay ? currentDays[0]?.shiftSpanHours : null}
                                        totalYardage={knownPlantSummary.totalYardage}
                                    />
                                </Panel>
                                <Panel
                                    title="Daily yardage trend"
                                    innerClassName="p-3"
                                    right={
                                        trendComparison && (
                                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                                Dotted = {comparison === 'lastYear' ? 'last year' : 'previous period'}
                                            </span>
                                        )
                                    }
                                >
                                    <TrendChart
                                        accent={accentColor}
                                        data={trendData}
                                        comparisonData={trendComparison}
                                    />
                                </Panel>
                                <Panel title="Average by weekday" innerClassName="p-3">
                                    <DayOfWeekChart accent={accentColor} plans={currentDays} />
                                </Panel>
                            </div>
                            <div className="flex flex-col gap-4 min-w-0">
                                <Panel
                                    title="Customer satisfaction"
                                    innerClassName="p-3"
                                    right={
                                        satisfactionAggregate ? (
                                            <span
                                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded px-2 py-0.5"
                                                style={{
                                                    background: `${satisfactionColor(Math.round(satisfactionAggregate.score * 100))}1f`,
                                                    color: satisfactionColor(
                                                        Math.round(satisfactionAggregate.score * 100)
                                                    )
                                                }}
                                            >
                                                <i className="fas fa-face-smile text-[10px]" />
                                                {Math.round(satisfactionAggregate.score * 100)}%
                                            </span>
                                        ) : satisfactionLoading ? (
                                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                                Loading…
                                            </span>
                                        ) : null
                                    }
                                >
                                    <SatisfactionChart
                                        accent={accentColor}
                                        aggregate={satisfactionAggregate}
                                        days={currentDays}
                                        isLoading={satisfactionLoading}
                                        satisfactionByDay={satisfactionByDay}
                                    />
                                </Panel>
                                <Panel
                                    title="Big pours to coordinate"
                                    innerClassName="p-0"
                                    right={
                                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                            {currentSummary.bigPours.length} · &gt;{BIG_POUR_YARDAGE_THRESHOLD} yd³ ·
                                            &lt;{BIG_POUR_SPACING_THRESHOLD_MIN}m
                                        </span>
                                    }
                                >
                                    <BigPoursTable
                                        accent={accentColor}
                                        plantNameByCode={plantNameByCode}
                                        pours={currentSummary.bigPours}
                                    />
                                </Panel>
                                <Panel
                                    title="Customer concentration"
                                    innerClassName="p-3"
                                    right={
                                        currentSummary.topCustomerShare ? (
                                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                                Top {(currentSummary.topCustomerShare.share * 100).toFixed(0)}%
                                            </span>
                                        ) : null
                                    }
                                >
                                    <RankedList
                                        accent={accentColor}
                                        emptyLabel="No customer data in this range."
                                        items={topCustomers}
                                        labelKey="customer"
                                        secondaryFmt={(item) => `${item.orders} ord`}
                                    />
                                </Panel>
                                <Panel title="Top product mixes" innerClassName="p-3">
                                    <RankedList
                                        accent={accentColor}
                                        emptyLabel="No product data in this range."
                                        items={topProducts}
                                        labelKey="product"
                                        secondaryFmt={(item) => `${fmtInt(item.loads)} loads`}
                                    />
                                </Panel>
                                {previousSummary && (
                                    <Panel title="Period comparison" innerClassName="p-0">
                                        <div
                                            className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            <span>Metric</span>
                                            <span>Current</span>
                                            <span>{previousSummary ? 'Previous' : '—'}</span>
                                            <span className="text-right" style={{ minWidth: 60 }}>
                                                Δ
                                            </span>
                                        </div>
                                        <ComparisonRow
                                            label="Total yardage"
                                            current={{
                                                formatted: fmtInt(currentSummary.totalYardage),
                                                value: currentSummary.totalYardage
                                            }}
                                            previous={
                                                previousSummary
                                                    ? {
                                                          formatted: fmtInt(previousSummary.totalYardage),
                                                          value: previousSummary.totalYardage
                                                      }
                                                    : null
                                            }
                                        />
                                        <ComparisonRow
                                            label="Loads scheduled"
                                            current={{
                                                formatted: fmtInt(currentSummary.totalLoads),
                                                value: currentSummary.totalLoads
                                            }}
                                            previous={
                                                previousSummary
                                                    ? {
                                                          formatted: fmtInt(previousSummary.totalLoads),
                                                          value: previousSummary.totalLoads
                                                      }
                                                    : null
                                            }
                                        />
                                        <ComparisonRow
                                            label="Orders"
                                            current={{
                                                formatted: fmtInt(currentSummary.totalOrders),
                                                value: currentSummary.totalOrders
                                            }}
                                            previous={
                                                previousSummary
                                                    ? {
                                                          formatted: fmtInt(previousSummary.totalOrders),
                                                          value: previousSummary.totalOrders
                                                      }
                                                    : null
                                            }
                                        />
                                        <ComparisonRow
                                            label="Yardage per load"
                                            current={{
                                                formatted:
                                                    currentSummary.yardagePerLoad != null
                                                        ? fmtFloat(currentSummary.yardagePerLoad)
                                                        : '—',
                                                value: currentSummary.yardagePerLoad
                                            }}
                                            previous={
                                                previousSummary && previousSummary.yardagePerLoad != null
                                                    ? {
                                                          formatted: fmtFloat(previousSummary.yardagePerLoad),
                                                          value: previousSummary.yardagePerLoad
                                                      }
                                                    : null
                                            }
                                        />
                                        <ComparisonRow
                                            label="Avg yardage / active day"
                                            current={{
                                                formatted: fmtInt(currentSummary.avgYardagePerActiveDay),
                                                value: currentSummary.avgYardagePerActiveDay
                                            }}
                                            previous={
                                                previousSummary
                                                    ? {
                                                          formatted: fmtInt(previousSummary.avgYardagePerActiveDay),
                                                          value: previousSummary.avgYardagePerActiveDay
                                                      }
                                                    : null
                                            }
                                        />
                                        <ComparisonRow
                                            label="Avg shift span (h)"
                                            current={{
                                                formatted:
                                                    currentSummary.avgShiftSpanHours != null
                                                        ? fmtFloat(currentSummary.avgShiftSpanHours)
                                                        : '—',
                                                value: currentSummary.avgShiftSpanHours
                                            }}
                                            previous={
                                                previousSummary && previousSummary.avgShiftSpanHours != null
                                                    ? {
                                                          formatted: fmtFloat(previousSummary.avgShiftSpanHours),
                                                          value: previousSummary.avgShiftSpanHours
                                                      }
                                                    : null
                                            }
                                        />
                                        <ComparisonRow
                                            label="Active production days"
                                            current={{
                                                formatted: `${currentSummary.daysWithProduction}/${currentSummary.dayCount}`,
                                                value: currentSummary.daysWithProduction
                                            }}
                                            previous={
                                                previousSummary
                                                    ? {
                                                          formatted: `${previousSummary.daysWithProduction}/${previousSummary.dayCount}`,
                                                          value: previousSummary.daysWithProduction
                                                      }
                                                    : null
                                            }
                                        />
                                    </Panel>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PlanStatisticsView
