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
import { PlanService } from '../../../services/PlanService'
import {
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
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

/**
 * Reduce a single day's stored `plant_production` (the dispatch schedule
 * snapshot) into a flat metrics object the dashboard can sum / chart. This
 * is purely schedule-side data — order counts, yardage, loads, customers,
 * products, shift spans — with no dispatch-plan / help-route mixing.
 */
const computeScheduleMetrics = (row) => {
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
    const FLEET_MAX_LOAD_SIZE = 10
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
        const block = production[plantCode] || {}
        const orders = Array.isArray(block.orders) ? block.orders : []
        const liveOrders = orders.filter((o) => !isExcludedOrder(o))
        const orderYardage = liveOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
        const yardage = orderYardage > 0 || liveOrders.length > 0 ? orderYardage : parseFloat(block.totalYardage) || 0
        const loads = liveOrders.reduce((sum, o) => sum + loadsForOrder(o), 0)
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

    return {
        activePlants,
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
        totalLoads,
        totalOrders,
        totalYardage,
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
    summary.avgYardagePerActiveDay =
        summary.daysWithProduction > 0 ? Math.round(summary.totalYardage / summary.daysWithProduction) : 0
    summary.avgShiftSpanHours = shiftSpanCount > 0 ? Math.round((shiftSpanSum / shiftSpanCount) * 10) / 10 : null
    summary.yardagePerLoad =
        summary.totalLoads > 0 ? Math.round((summary.totalYardage / summary.totalLoads) * 10) / 10 : null

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
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: accent, strokeOpacity: 0.2 }} />
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
                    <XAxis type="number" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                    <YAxis
                        type="category"
                        dataKey="code"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        width={64}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: `${accent}10` }} />
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
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} />
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

function HourlyDistributionChart({ accent, hourBuckets }) {
    const trimmed = useMemo(() => {
        const firstActive = hourBuckets.findIndex((b) => b.loads > 0 || b.yardage > 0)
        const lastActive =
            hourBuckets.length - 1 - [...hourBuckets].reverse().findIndex((b) => b.loads > 0 || b.yardage > 0)
        if (firstActive < 0) return []
        const start = Math.max(0, firstActive - 1)
        const end = Math.min(23, lastActive + 1)
        return hourBuckets.slice(start, end + 1).map((b) => ({
            ...b,
            label: fmtMinutesAsHHMM(b.hour * 60).replace(':00', '')
        }))
    }, [hourBuckets])
    if (trimmed.length === 0) {
        return (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No order start times available.
            </div>
        )
    }
    return (
        <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trimmed} margin={{ bottom: 4, left: 0, right: 8, top: 12 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} width={48} />
                    <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accent}10` }}
                        formatter={(value, name) => [fmtInt(value), name]}
                    />
                    <Bar dataKey="yardage" name="Yardage" fill={accent} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="loads" name="Loads" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
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

/* ── Insights ─────────────────────────────────────────────────────────── */

/**
 * Build a prioritized list of operational observations. Each entry is
 * action-oriented — what an ops manager should do or know — rather than a
 * generic restatement of the underlying numbers. Ordered by severity so the
 * most important callouts surface first.
 */
const generateInsights = ({ current, previous, days, plantNameByCode, mixerCountsByPlant, isSingleDay }) => {
    const insights = []

    // 1. Concentration risk — single customer eats >35% of yardage.
    if (current.topCustomerShare && current.topCustomerShare.share >= 0.35) {
        const pct = (current.topCustomerShare.share * 100).toFixed(0)
        insights.push({
            icon: 'fa-triangle-exclamation',
            text: `${current.topCustomerShare.customer} is ${pct}% of total yardage (${fmtInt(current.topCustomerShare.yardage)} yd³). Coordinate ahead — losing this customer would gut the schedule.`,
            tone: 'warning'
        })
    }

    // 2. Per-plant overload — yards/operator-hour estimate when truck counts known.
    if (mixerCountsByPlant && isSingleDay) {
        Object.values(current.perPlant).forEach((plant) => {
            const trucks = mixerCountsByPlant[plant.code] || 0
            const day = days[0]
            const span = day?.shiftSpanHours
            if (!trucks || !span || span <= 0 || plant.yardage <= 0) return
            const yph = plant.yardage / (trucks * span)
            if (yph > MAX_YPH) {
                insights.push({
                    icon: 'fa-truck-arrow-right',
                    text: `${plant.code} is overbooked — ${fmtFloat(yph)} yd/op-hr (target ≤ ${MAX_YPH}). Send help routes or stagger jobs.`,
                    tone: 'negative'
                })
            } else if (yph < TARGET_YPH - 0.5 && plant.loads >= 6) {
                insights.push({
                    icon: 'fa-truck-arrow-right',
                    text: `${plant.code} has slack — only ${fmtFloat(yph)} yd/op-hr at ${trucks} truck${trucks === 1 ? '' : 's'}. Could send help.`,
                    tone: 'positive'
                })
            }
        })
    }

    // 3. Big pours — orders that need extra coordination.
    if (current.bigPours.length > 0) {
        const upcoming = current.bigPours.slice(0, 3)
        insights.push({
            icon: 'fa-fire',
            text: `${current.bigPours.length} big pour${current.bigPours.length === 1 ? '' : 's'} (>${BIG_POUR_YARDAGE_THRESHOLD} yd³, <${BIG_POUR_SPACING_THRESHOLD_MIN}-min spacing) need${current.bigPours.length === 1 ? 's' : ''} early coordination — biggest: ${fmtInt(upcoming[0].yardage)} yd³ for ${upcoming[0].customer} at ${upcoming[0].plantCode}.`,
            tone: 'warning'
        })
    }

    // 4. Overtime risk — shift spans pushing past 12h.
    const heavyDays = days.filter((p) => p.shiftSpanHours && p.shiftSpanHours > 12)
    if (heavyDays.length > 0) {
        insights.push({
            icon: 'fa-hourglass-half',
            text: `${heavyDays.length} day${heavyDays.length === 1 ? '' : 's'} run${heavyDays.length === 1 ? 's' : ''} a 12h+ shift span — overtime likely on ${heavyDays.map((d) => fmtDate(d.planDate)).join(', ')}.`,
            tone: 'warning'
        })
    }

    // 5. Peak-hour callout — lets the user know when the day stacks up.
    if (current.peakHour && current.peakHour.loads > 0) {
        const totalLoadsInRange = current.totalLoads
        const peakShare = totalLoadsInRange > 0 ? (current.peakHour.loads / totalLoadsInRange) * 100 : 0
        insights.push({
            icon: 'fa-clock',
            text: `Peak hour: ${fmtMinutesAsHHMM(current.peakHour.hour * 60)} — ${current.peakHour.loads} load${current.peakHour.loads === 1 ? '' : 's'} starting (${peakShare.toFixed(0)}% of the period's loads).`,
            tone: peakShare > 25 ? 'warning' : 'neutral'
        })
    }

    // 6. Load utilization — partial-truck drag.
    if (current.yardagePerLoad != null) {
        if (current.yardagePerLoad < 7) {
            insights.push({
                icon: 'fa-truck',
                text: `${fmtFloat(current.yardagePerLoad)} yd³/load on average — partial trucks. Talk to dispatch about consolidating small orders.`,
                tone: 'warning'
            })
        } else if (current.yardagePerLoad > 9.5) {
            insights.push({
                icon: 'fa-truck',
                text: `${fmtFloat(current.yardagePerLoad)} yd³/load — running full trucks consistently. Good utilization.`,
                tone: 'positive'
            })
        }
    }

    // 7. Trend signal (only when comparison is on).
    const yphDelta = deltaPct(current.totalYardage, previous?.totalYardage)
    if (previous && yphDelta != null && Math.abs(yphDelta) >= 5) {
        insights.push({
            icon: yphDelta > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
            text: `Yardage ${yphDelta > 0 ? 'up' : 'down'} ${Math.abs(yphDelta).toFixed(1)}% vs the comparison period (${fmtInt(current.totalYardage)} vs ${fmtInt(previous.totalYardage)} yd³).`,
            tone: yphDelta > 0 ? 'positive' : 'negative'
        })
    }

    // 8. Coverage gap — some working days have no schedule.
    if (current.dayCount > current.daysWithProduction && current.daysWithProduction > 0) {
        const missing = current.dayCount - current.daysWithProduction
        insights.push({
            icon: 'fa-calendar-xmark',
            text: `${missing} of ${current.dayCount} working day${current.dayCount === 1 ? '' : 's'} in this range have no scheduled production.`,
            tone: 'neutral'
        })
    }

    return insights
}

const TONE_STYLES = {
    negative: { background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' },
    neutral: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
    positive: { background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' },
    warning: { background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }
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
    const [currentDays, setCurrentDays] = useState([])
    const [previousDays, setPreviousDays] = useState([])

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
                const [currentRows, previousRows] = await Promise.all([
                    PlanService.fetchPlansInRange(range.current.start, range.current.end),
                    range.previous
                        ? PlanService.fetchPlansInRange(range.previous.start, range.previous.end)
                        : Promise.resolve([])
                ])
                if (cancelled) return
                let mappedCurrent = (currentRows || [])
                    .map(computeScheduleMetrics)
                    .filter((d) => !isSundayIso(d.planDate))
                // Fallback — if the range covers `planDate` but the server has no
                // saved row for it yet, use the live production already loaded by
                // PlanView so the page is never empty when the user is looking
                // at a freshly-synced day that hasn't been auto-saved yet.
                const hasPlanDateRow = mappedCurrent.some((d) => d.planDate === planDate)
                const planDateInRange = planDate && planDate >= range.current.start && planDate <= range.current.end
                if (!hasPlanDateRow && planDateInRange && liveProduction && !isSundayIso(planDate)) {
                    const synthetic = computeScheduleMetrics({
                        plan_date: planDate,
                        plant_production: liveProduction
                    })
                    if (synthetic.totalYardage > 0 || synthetic.totalLoads > 0 || synthetic.totalOrders > 0) {
                        mappedCurrent = [...mappedCurrent, synthetic].sort((a, b) =>
                            a.planDate.localeCompare(b.planDate)
                        )
                    }
                }
                setCurrentDays(mappedCurrent)
                setPreviousDays(
                    (previousRows || []).map(computeScheduleMetrics).filter((d) => !isSundayIso(d.planDate))
                )
            } catch {
                if (cancelled) return
                setCurrentDays([])
                setPreviousDays([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [range, planDate, liveProduction])

    const currentSummary = useMemo(() => aggregateMetrics(currentDays), [currentDays])
    const previousSummary = useMemo(
        () => (comparison === 'none' ? null : aggregateMetrics(previousDays)),
        [previousDays, comparison]
    )
    const insights = useMemo(
        () =>
            generateInsights({
                current: currentSummary,
                days: currentDays,
                isSingleDay: period === 'day' || (period === 'custom' && customStart === customEnd),
                mixerCountsByPlant,
                plantNameByCode,
                previous: previousSummary
            }),
        [
            currentSummary,
            previousSummary,
            currentDays,
            plantNameByCode,
            mixerCountsByPlant,
            period,
            customStart,
            customEnd
        ]
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

                {/* Action callouts — what an ops manager should know first.
                    Lead with the highest-severity items so the page reads as
                    a punch list, not a wall of numbers. */}
                {!loading && currentDays.length > 0 && insights.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {insights.slice(0, 5).map((insight, idx) => {
                            const tone = TONE_STYLES[insight.tone] || TONE_STYLES.neutral
                            return (
                                <div
                                    key={idx}
                                    className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px]"
                                    style={{
                                        background: tone.background,
                                        border: `1px solid ${tone.color}33`,
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <i
                                        className={`fas ${insight.icon} text-[13px] mt-0.5`}
                                        style={{ color: tone.color }}
                                    />
                                    <span className="leading-snug">{insight.text}</span>
                                </div>
                            )
                        })}
                    </div>
                )}

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
                        {/* Hero: when does the day stack up? Full-width to
                            give the hourly demand curve room to breathe. */}
                        <Panel
                            title="Demand by hour"
                            innerClassName="p-3"
                            right={
                                currentSummary.peakHour && currentSummary.peakHour.loads > 0 ? (
                                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                        Peak {fmtMinutesAsHHMM(currentSummary.peakHour.hour * 60).replace(':00', '')} ·{' '}
                                        {currentSummary.peakHour.loads} loads
                                    </span>
                                ) : null
                            }
                        >
                            <HourlyDistributionChart accent={accentColor} hourBuckets={currentSummary.hourBuckets} />
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
                                            {currentSummary.activePlantSet.size} active ·{' '}
                                            {currentSummary.topPlantShare
                                                ? `top: ${currentSummary.topPlantShare.code} (${(currentSummary.topPlantShare.share * 100).toFixed(0)}%)`
                                                : '—'}
                                        </span>
                                    }
                                >
                                    <PlantScorecardTable
                                        accent={accentColor}
                                        isSingleDay={isSingleDay}
                                        mixerCountsByPlant={mixerCountsByPlant}
                                        plantNameByCode={plantNameByCode}
                                        rows={Object.values(currentSummary.perPlant)}
                                        singleDayShiftSpan={isSingleDay ? currentDays[0]?.shiftSpanHours : null}
                                        totalYardage={currentSummary.totalYardage}
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
                        {insights.length > 5 && (
                            <Panel title="Additional observations">
                                <div className="flex flex-col gap-2">
                                    {insights.slice(5).map((insight, idx) => {
                                        const tone = TONE_STYLES[insight.tone] || TONE_STYLES.neutral
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-2.5 rounded px-3 py-2 text-[12.5px]"
                                                style={{
                                                    background: tone.background,
                                                    color: 'var(--text-primary)'
                                                }}
                                            >
                                                <i
                                                    className={`fas ${insight.icon} text-[12px] mt-0.5`}
                                                    style={{ color: tone.color }}
                                                />
                                                <span>{insight.text}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Panel>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default PlanStatisticsView
