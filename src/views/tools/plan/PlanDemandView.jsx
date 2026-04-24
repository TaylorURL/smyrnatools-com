import React, { useMemo, useState } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

import {
    adjustPoolForDate,
    getCalculatedTruckCount,
    isBigPourOrder,
    isExcludedOrder,
    plantBadgeColor,
    TRUCK_ON_SITE_MINUTES
} from '../../../utils/PlanUtility'

const PLAN_META_KEY = '_meta'

/** Fallback palette for plants that aren't in the shared plant-badge map.
 *  Real plants use the canonical color from `plantBadgeColor` so every view
 *  (Schedule badges, Planner nodes, Demand charts) renders them the same. */
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

/** Separate palette for product mix — products don't map to the plant color
 *  space, so use distinct hues. */
const PRODUCT_COLORS = [
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

const parseHhmm = (value) => {
    const v = String(value || '').trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null
    return h * 60 + min
}

/** Estimate how many minutes a single order ties up trucks for. Uses the
 *  rate spacing + on-site time so overlap-per-hour math reflects reality. */
const estimatePourMinutes = (order) => {
    const rate = parseHhmm(order?.rate)
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    if (!rate || loadSize <= 0 || yardage <= 0) return 60
    const trips = Math.max(1, Math.ceil(yardage / loadSize))
    return (trips - 1) * rate + TRUCK_ON_SITE_MINUTES
}

const clean = (value) => (value == null ? '' : String(value).trim())

/** Rolling-sum helper: mutates `arr` in place to become its prefix sums. */
const toCumulative = (arr) => {
    let running = 0
    return arr.map((x) => {
        running += x
        return running
    })
}

/** Build every chart's underlying data set once. Everything downstream
 *  renders off the same derived payloads so totals are always consistent. */
function useDemandData(plantProduction, stats, plantNameByCode, planDate) {
    return useMemo(() => {
        const plants = new Map()
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            plants.set(s.code, {
                adjustedBase: adjustPoolForDate(Number.isFinite(s.base) ? s.base : 0, planDate),
                base: Number.isFinite(s.base) ? s.base : 0,
                code: s.code,
                name: plantNameByCode?.[s.code] || s.code,
                orders: 0,
                totalTrucks: 0,
                totalYardage: 0
            })
        })
        Object.entries(plantProduction || {}).forEach(([code, prod]) => {
            if (code === PLAN_META_KEY) return
            if (!plants.has(code)) {
                plants.set(code, {
                    adjustedBase: 0,
                    base: 0,
                    code,
                    name: plantNameByCode?.[code] || code,
                    orders: 0,
                    totalTrucks: 0,
                    totalYardage: 0
                })
            }
            const list = Array.isArray(prod?.orders) ? prod.orders : []
            const record = plants.get(code)
            list.forEach((o) => {
                if (isExcludedOrder(o)) return
                const yardage = parseFloat(o?.yardage) || 0
                const trucks = getCalculatedTruckCount(o) || 0
                record.totalYardage += yardage
                record.totalTrucks += trucks
                record.orders += 1
            })
        })
        const perPlant = Array.from(plants.values()).sort((a, b) => b.totalTrucks - a.totalTrucks)

        // Per-hour matrices — trucks (concurrent dispatches) + yardage.
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${String(i).padStart(2, '0')}:00`,
            total: 0,
            yardage: 0
        }))
        const stackedHourly = hours.map((h) => ({ hour: h.hour, label: h.label }))
        const peakByPlant = {}

        // Aggregates for the "interesting orders" KPIs + chart data.
        const customerYardage = new Map()
        const productYardage = new Map()
        let biggestOrder = null
        let bigPourCount = 0
        let totalLoadSizeSum = 0
        let totalLoadSizeCount = 0

        Object.entries(plantProduction || {}).forEach(([code, prod]) => {
            if (code === PLAN_META_KEY) return
            const list = Array.isArray(prod?.orders) ? prod.orders : []
            list.forEach((o) => {
                if (isExcludedOrder(o)) return
                const yardage = parseFloat(o?.yardage) || 0
                const trucks = getCalculatedTruckCount(o) || 0
                const loadSize = parseFloat(o?.loadSize) || 0

                if (yardage > 0) {
                    const customer = clean(o?.customer) || 'Unknown'
                    customerYardage.set(customer, (customerYardage.get(customer) || 0) + yardage)
                    const product = clean(o?.productCode) || '—'
                    productYardage.set(product, (productYardage.get(product) || 0) + yardage)
                    if (!biggestOrder || yardage > biggestOrder.yardage) {
                        biggestOrder = {
                            customer,
                            orderNum: clean(o?.orderNum),
                            plantCode: code,
                            startTime: clean(o?.startTime),
                            yardage
                        }
                    }
                }
                if (loadSize > 0) {
                    totalLoadSizeSum += loadSize * Math.max(1, Math.ceil(yardage / loadSize))
                    totalLoadSizeCount += Math.max(1, Math.ceil(yardage / loadSize))
                }
                if (isBigPourOrder(o)) bigPourCount += 1

                const startMin = parseHhmm(o?.startTime)
                if (!Number.isFinite(startMin) || trucks <= 0) return
                const duration = estimatePourMinutes(o)
                const endMin = startMin + duration
                const startHour = Math.max(0, Math.floor(startMin / 60))
                const endHour = Math.min(23, Math.floor((endMin - 1) / 60))
                for (let h = startHour; h <= endHour; h++) {
                    hours[h].total += trucks
                    stackedHourly[h][code] = (stackedHourly[h][code] || 0) + trucks
                }
                // Yardage goes into the hour the pour STARTS (dispatcher-friendly
                // rather than spread across the rotation).
                if (Number.isFinite(startMin)) {
                    const startH = Math.max(0, Math.min(23, Math.floor(startMin / 60)))
                    hours[startH].yardage += yardage
                }
            })
        })

        // Peak concurrent trucks per plant, used for capacity vs demand chart.
        perPlant.forEach((p) => {
            let peak = 0
            hours.forEach((_, h) => {
                const val = stackedHourly[h][p.code] || 0
                if (val > peak) peak = val
            })
            peakByPlant[p.code] = peak
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

        // Time-of-day splits (dispatcher-relevant morning/afternoon/evening).
        const timeOfDay = { afternoon: 0, evening: 0, morning: 0 }
        hours.forEach((h) => {
            if (h.hour < 12) timeOfDay.morning += h.yardage
            else if (h.hour < 18) timeOfDay.afternoon += h.yardage
            else timeOfDay.evening += h.yardage
        })

        // Running cumulative yardage per hour for the "cumulative" chart.
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

        const avgLoadSize = totalLoadSizeCount > 0 ? Math.round((totals.yardage / totalLoadSizeCount) * 10) / 10 : 0

        // Capacity utilization = peak total demand / sum of adjusted bases.
        const totalBase = perPlant.reduce((acc, p) => acc + (p.adjustedBase || 0), 0)
        const capacityUtilization = totalBase > 0 ? Math.min(200, Math.round((peakHour.total / totalBase) * 100)) : 0

        return {
            avgLoadSize,
            biggestOrder,
            bigPourCount,
            capacityByPlant,
            capacityUtilization,
            cumulativeHourly,
            hours,
            peakByPlant,
            peakHour,
            perPlant,
            productMix,
            stackedHourly,
            timeOfDay,
            topCustomers,
            totalBase,
            totals
        }
    }, [plantProduction, stats, plantNameByCode, planDate])
}

/* ═══════════════════════════════════════════════════════════════════════
   Main view
   ═══════════════════════════════════════════════════════════════════════ */

function PlanDemandView({ accentColor, planDate, plantNameByCode, plantProduction, stats }) {
    const [chartMode, setChartMode] = useState('hourly')
    const data = useDemandData(plantProduction, stats, plantNameByCode, planDate)
    const plantColorByCode = useMemo(() => {
        const out = {}
        data.perPlant.forEach((p, i) => {
            out[p.code] = plantBadgeColor(p.code, FALLBACK_SERIES_COLORS[i % FALLBACK_SERIES_COLORS.length])
        })
        return out
    }, [data.perPlant])

    const chartOptions = [
        { group: 'Demand', icon: 'fa-chart-line', key: 'hourly', label: 'Hourly trucks' },
        { group: 'Demand', icon: 'fa-chart-column', key: 'byPlant', label: 'Trucks by plant' },
        { group: 'Demand', icon: 'fa-layer-group', key: 'stacked', label: 'Stacked by plant' },
        { group: 'Yardage', icon: 'fa-chart-pie', key: 'yardageShare', label: 'Yardage share' },
        { group: 'Yardage', icon: 'fa-chart-area', key: 'cumulative', label: 'Cumulative yd' },
        { group: 'Insights', icon: 'fa-scale-unbalanced', key: 'capacity', label: 'Capacity vs peak' },
        { group: 'Insights', icon: 'fa-users', key: 'customers', label: 'Top customers' },
        { group: 'Insights', icon: 'fa-flask', key: 'products', label: 'Product mix' }
    ]

    const friendlyDate = planDate
        ? new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              weekday: 'short',
              year: 'numeric'
          })
        : ''

    const handleExportCsv = () => {
        const header = ['Plant', 'Name', 'Orders', 'Yardage (yd)', 'Trucks', 'Share %', 'Base', 'Peak']
        const rows = data.perPlant.map((p) => {
            const share = data.totals.trucks > 0 ? (p.totalTrucks / data.totals.trucks) * 100 : 0
            return [
                p.code,
                p.name,
                p.orders,
                Math.round(p.totalYardage),
                p.totalTrucks,
                share.toFixed(1),
                p.adjustedBase,
                data.peakByPlant[p.code] || 0
            ]
        })
        const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `demand-${planDate || 'day'}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const utilColor = data.capacityUtilization > 100 ? '#dc2626' : data.capacityUtilization > 85 ? '#d97706' : '#16a34a'

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-5 flex flex-col gap-4">
                {/* Title + export */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <div
                            className="text-[20px] sm:text-[24px] font-bold leading-tight"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                            Demand
                        </div>
                        <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Total truck demand across every plant for{' '}
                            <b style={{ color: 'var(--text-primary)' }}>{friendlyDate || 'today'}</b>.
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        disabled={data.perPlant.length === 0}
                        className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                        }}
                        title="Download the per-plant breakdown as CSV"
                    >
                        <i className="fas fa-file-csv" />
                        <span>Export CSV</span>
                    </button>
                </div>

                {/* KPI strip — two rows worth of tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                    <KpiTile accent={accentColor} icon="fa-truck" label="Trucks required" value={data.totals.trucks} />
                    <KpiTile
                        accent="#16a34a"
                        icon="fa-cubes-stacked"
                        label="Total yardage"
                        value={`${Math.round(data.totals.yardage).toLocaleString()} yd`}
                    />
                    <KpiTile
                        accent="#8b5cf6"
                        icon="fa-list-check"
                        label="Orders"
                        sublabel={data.avgLoadSize ? `avg ${data.avgLoadSize} yd / load` : null}
                        value={data.totals.orders}
                    />
                    <KpiTile
                        accent="#d97706"
                        icon="fa-gauge-high"
                        label="Peak hour"
                        sublabel={data.peakHour.total > 0 ? `${data.peakHour.total} trucks` : '—'}
                        value={data.peakHour.label || '—'}
                    />
                    <KpiTile
                        accent="#0ea5e9"
                        icon="fa-crown"
                        label="Biggest pour"
                        sublabel={
                            data.biggestOrder
                                ? `${data.biggestOrder.customer} · Plant ${data.biggestOrder.plantCode}`
                                : '—'
                        }
                        value={data.biggestOrder ? `${Math.round(data.biggestOrder.yardage).toLocaleString()} yd` : '—'}
                    />
                    <KpiTile
                        accent="#dc2626"
                        icon="fa-triangle-exclamation"
                        label="Big pours"
                        sublabel={data.bigPourCount === 0 ? 'None today' : '120+ yd · back-to-back'}
                        value={data.bigPourCount}
                    />
                    <KpiTile
                        accent={utilColor}
                        icon="fa-gauge-simple-high"
                        label="Capacity utilization"
                        sublabel={
                            data.totalBase > 0
                                ? `${data.peakHour.total} of ${data.totalBase} at peak`
                                : 'No base assigned'
                        }
                        value={`${data.capacityUtilization}%`}
                    />
                    <KpiTile
                        accent="#0d9488"
                        icon="fa-industry"
                        label="Plants active"
                        sublabel={`of ${data.perPlant.length} in plan`}
                        value={data.perPlant.filter((p) => p.orders > 0).length}
                    />
                </div>

                {/* Time-of-day strip — morning / afternoon / evening */}
                <TimeOfDayStrip totals={data.timeOfDay} grandTotal={data.totals.yardage} />

                {/* Chart mode toggle */}
                <ChartModeToggle
                    accentColor={accentColor}
                    onChange={setChartMode}
                    options={chartOptions}
                    value={chartMode}
                />

                {/* Main chart panel */}
                <div
                    className="rounded-xl p-3 sm:p-4"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    {data.totals.trucks === 0 && chartMode !== 'capacity' ? (
                        <EmptyState />
                    ) : chartMode === 'hourly' ? (
                        <HourlyLineChart accent={accentColor} rows={data.hours} />
                    ) : chartMode === 'byPlant' ? (
                        <ByPlantBarChart accent={accentColor} rows={data.perPlant} />
                    ) : chartMode === 'stacked' ? (
                        <StackedHourlyAreaChart
                            plantColor={plantColorByCode}
                            plants={data.perPlant}
                            rows={data.stackedHourly}
                        />
                    ) : chartMode === 'yardageShare' ? (
                        <YardageSharePie
                            plantColor={plantColorByCode}
                            plants={data.perPlant}
                            total={data.totals.yardage}
                        />
                    ) : chartMode === 'cumulative' ? (
                        <CumulativeYardageChart accent={accentColor} rows={data.cumulativeHourly} />
                    ) : chartMode === 'capacity' ? (
                        <CapacityVsPeakChart accent={accentColor} rows={data.capacityByPlant} />
                    ) : chartMode === 'customers' ? (
                        <TopCustomersBar accent={accentColor} rows={data.topCustomers} />
                    ) : chartMode === 'products' ? (
                        <ProductMixPie rows={data.productMix} total={data.totals.yardage} />
                    ) : null}
                </div>

                {/* Per-plant breakdown table */}
                <PerPlantTable
                    peakByPlant={data.peakByPlant}
                    plantColorByCode={plantColorByCode}
                    rows={data.perPlant}
                    totals={data.totals}
                />
            </div>
        </div>
    )
}

function csvCell(value) {
    const str = String(value ?? '')
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/* ═══════════════════════════════════════════════════════════════════════
   Building blocks
   ═══════════════════════════════════════════════════════════════════════ */

function ChartModeToggle({ accentColor, onChange, options, value }) {
    const groups = useMemo(() => {
        const out = new Map()
        options.forEach((o) => {
            const group = o.group || 'Charts'
            if (!out.has(group)) out.set(group, [])
            out.get(group).push(o)
        })
        return Array.from(out.entries())
    }, [options])
    return (
        <div className="flex flex-wrap gap-3">
            {groups.map(([label, opts]) => (
                <div key={label} className="flex flex-col gap-1">
                    <span
                        className="text-[9.5px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {label}
                    </span>
                    <div
                        className="inline-flex rounded-lg p-0.5 overflow-x-auto max-w-full"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-light)'
                        }}
                    >
                        {opts.map((opt) => {
                            const active = value === opt.key
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => onChange(opt.key)}
                                    className="flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5 whitespace-nowrap"
                                    style={{
                                        background: active ? accentColor : 'transparent',
                                        color: active ? '#fff' : 'var(--text-secondary)'
                                    }}
                                >
                                    <i className={`fas ${opt.icon}`} />
                                    <span>{opt.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}

function KpiTile({ accent, icon, label, sublabel, value }) {
    return (
        <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ background: `${accent}14`, color: accent, height: 40, width: 40 }}
            >
                <i className={`fas ${icon}`} />
            </div>
            <div className="min-w-0">
                <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    {label}
                </div>
                <div
                    className="font-bold text-[18px] leading-tight truncate"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {value}
                </div>
                {sublabel && (
                    <div className="text-[10.5px] truncate" style={{ color: 'var(--text-secondary)' }}>
                        {sublabel}
                    </div>
                )}
            </div>
        </div>
    )
}

function TimeOfDayStrip({ grandTotal, totals }) {
    const sections = [
        {
            color: '#f59e0b',
            hint: '06:00 – 12:00',
            icon: 'fa-mug-hot',
            key: 'morning',
            label: 'Morning'
        },
        {
            color: '#0ea5e9',
            hint: '12:00 – 18:00',
            icon: 'fa-sun',
            key: 'afternoon',
            label: 'Afternoon'
        },
        {
            color: '#8b5cf6',
            hint: '18:00+',
            icon: 'fa-moon',
            key: 'evening',
            label: 'Evening'
        }
    ]
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {sections.map((s) => {
                const value = Math.round(totals[s.key] || 0)
                const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0
                return (
                    <div
                        key={s.key}
                        className="rounded-xl p-3"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)'
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="flex items-center justify-center rounded-lg shrink-0"
                                style={{
                                    background: `${s.color}14`,
                                    color: s.color,
                                    height: 36,
                                    width: 36
                                }}
                            >
                                <i className={`fas ${s.icon}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div
                                    className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    {s.label} <span style={{ color: 'var(--text-tertiary)' }}>· {s.hint}</span>
                                </div>
                                <div
                                    className="font-bold text-[18px] leading-tight"
                                    style={{
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-heading)'
                                    }}
                                >
                                    {value.toLocaleString()} yd
                                </div>
                                <div className="rounded h-1.5 mt-2" style={{ background: 'var(--bg-tertiary)' }}>
                                    <div className="h-1.5 rounded" style={{ background: s.color, width: `${pct}%` }} />
                                </div>
                                <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    {pct.toFixed(1)}% of day
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function EmptyState() {
    return (
        <div
            className="flex flex-col items-center justify-center py-10 gap-2 text-center"
            style={{ color: 'var(--text-tertiary)' }}
        >
            <i className="fas fa-chart-column text-[28px] opacity-50" />
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                No demand to chart yet
            </div>
            <div className="text-[11.5px] max-w-[320px]">
                Once orders with truck counts land in the plan, demand charts for every plant will render here.
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
   Chart components
   ═══════════════════════════════════════════════════════════════════════ */

const tooltipStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-medium)',
    borderRadius: 8,
    color: 'var(--text-primary)'
}
const tooltipLabelStyle = { color: 'var(--text-secondary)' }

function HourlyLineChart({ accent, rows }) {
    const trimmed = useMemo(() => {
        const firstActive = rows.findIndex((r) => r.total > 0)
        const lastActive = rows.length - 1 - [...rows].reverse().findIndex((r) => r.total > 0)
        if (firstActive === -1) return rows.slice(6, 19)
        const start = Math.min(firstActive, 6)
        const end = Math.max(lastActive, 18)
        return rows.slice(start, end + 1)
    }, [rows])
    return (
        <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
                <LineChart data={trimmed} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val} trucks`, 'Active']}
                    />
                    <Line
                        type="monotone"
                        dataKey="total"
                        stroke={accent}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: accent }}
                        activeDot={{ r: 5 }}
                        name="Trucks"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function ByPlantBarChart({ accent, rows }) {
    return (
        <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
                <BarChart data={rows} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="code" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val} trucks`, 'Required']}
                    />
                    <Bar dataKey="totalTrucks" fill={accent} radius={[6, 6, 0, 0]} name="Trucks">
                        {rows.map((r) => (
                            <Cell key={r.code} fill={plantBadgeColor(r.code, accent)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function StackedHourlyAreaChart({ plantColor, plants, rows }) {
    const trimmed = useMemo(() => {
        const hasActivity = (row) => plants.some((p) => (row[p.code] || 0) > 0)
        const firstActive = rows.findIndex(hasActivity)
        const lastActive = rows.length - 1 - [...rows].reverse().findIndex(hasActivity)
        if (firstActive === -1) return rows.slice(6, 19)
        const start = Math.min(firstActive, 6)
        const end = Math.max(lastActive, 18)
        return rows.slice(start, end + 1)
    }, [rows, plants])
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <AreaChart data={trimmed} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    {plants.map((p) => (
                        <Area
                            key={p.code}
                            type="monotone"
                            dataKey={p.code}
                            name={p.code}
                            stackId="plants"
                            stroke={plantColor[p.code]}
                            fill={plantColor[p.code]}
                            fillOpacity={0.6}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

function YardageSharePie({ plantColor, plants, total }) {
    const rows = useMemo(
        () =>
            plants
                .filter((p) => p.totalYardage > 0)
                .map((p) => ({ code: p.code, name: p.code, value: Math.round(p.totalYardage) })),
        [plants]
    )
    if (rows.length === 0) return <EmptyState />
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={rows}
                        dataKey="value"
                        nameKey="code"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={1}
                        label={({ code, percent }) => `${code} · ${(percent * 100).toFixed(0)}%`}
                    >
                        {rows.map((r) => (
                            <Cell key={r.code} fill={plantColor[r.code]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [
                            `${val.toLocaleString()} yd (${total > 0 ? ((val / total) * 100).toFixed(1) : '0'}%)`,
                            name
                        ]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

function CumulativeYardageChart({ accent, rows }) {
    const trimmed = useMemo(() => {
        const firstActive = rows.findIndex((r) => r.yardage > 0)
        if (firstActive === -1) return rows.slice(6, 19)
        const start = Math.max(0, firstActive - 1)
        return rows.slice(start)
    }, [rows])
    return (
        <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
                <AreaChart data={trimmed} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <defs>
                        <linearGradient id="cumulative-grad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val.toLocaleString()} yd`, 'Running total']}
                    />
                    <Area
                        type="monotone"
                        dataKey="yardage"
                        name="Cumulative yardage"
                        stroke={accent}
                        strokeWidth={2.5}
                        fill="url(#cumulative-grad)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

function CapacityVsPeakChart({ accent, rows }) {
    if (rows.length === 0) return <EmptyState />
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <BarChart data={rows} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val, name) => [`${val} trucks`, name]}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="base" name="Assigned mixers" fill={accent} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="peak" name="Peak demand" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function TopCustomersBar({ accent, rows }) {
    if (rows.length === 0) return <EmptyState />
    return (
        <div style={{ height: Math.max(240, 32 * rows.length + 40), width: '100%' }}>
            <ResponsiveContainer>
                <BarChart data={rows} layout="vertical" margin={{ bottom: 4, left: 80, right: 20, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis
                        type="category"
                        dataKey="customer"
                        stroke="var(--text-secondary)"
                        fontSize={11}
                        width={160}
                        tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val.toLocaleString()} yd`, 'Yardage']}
                    />
                    <Bar dataKey="yardage" fill={accent} radius={[0, 6, 6, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function ProductMixPie({ rows, total }) {
    if (rows.length === 0) return <EmptyState />
    const data = rows.slice(0, 12)
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="yardage"
                        nameKey="product"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={1}
                        label={({ product, percent }) =>
                            percent > 0.04 ? `${product} · ${(percent * 100).toFixed(0)}%` : ''
                        }
                    >
                        {data.map((r, i) => (
                            <Cell key={r.product} fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [
                            `${val.toLocaleString()} yd (${total > 0 ? ((val / total) * 100).toFixed(1) : '0'}%)`,
                            name
                        ]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
   Per-plant breakdown
   ═══════════════════════════════════════════════════════════════════════ */

function PerPlantTable({ peakByPlant, plantColorByCode, rows, totals }) {
    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                <div
                    className="text-[13px] font-bold"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    Breakdown by plant
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {rows.length} plant{rows.length === 1 ? '' : 's'}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Plant', 'Orders', 'Yardage', 'Trucks', 'Peak', 'Base', 'Share'].map((h) => (
                                <th
                                    key={h}
                                    className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap"
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        borderBottom: '1px solid var(--border-light)',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((p) => {
                            const share = totals.trucks > 0 ? (p.totalTrucks / totals.trucks) * 100 : 0
                            const peak = peakByPlant[p.code] || 0
                            const over = peak > p.adjustedBase && p.adjustedBase > 0
                            return (
                                <tr key={p.code} style={{ borderTop: '1px solid var(--border-light)' }}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="inline-block rounded"
                                                style={{
                                                    background: plantColorByCode[p.code],
                                                    height: 10,
                                                    width: 10
                                                }}
                                            />
                                            <span
                                                className="font-bold"
                                                style={{
                                                    color: 'var(--text-primary)',
                                                    fontFamily: 'var(--font-heading)'
                                                }}
                                            >
                                                {p.code}
                                            </span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                                {p.name !== p.code ? p.name : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                                        {p.orders}
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono whitespace-nowrap"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {Math.round(p.totalYardage).toLocaleString()} yd
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono font-bold"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {p.totalTrucks}
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono font-semibold"
                                        style={{
                                            color: over ? '#dc2626' : 'var(--text-primary)'
                                        }}
                                        title={
                                            over
                                                ? `Peak ${peak} exceeds assigned ${p.adjustedBase}`
                                                : 'Peak concurrent trucks'
                                        }
                                    >
                                        {peak}
                                    </td>
                                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                                        {p.adjustedBase}
                                    </td>
                                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="rounded h-1.5 flex-1 max-w-[120px]"
                                                style={{ background: 'var(--bg-tertiary)' }}
                                            >
                                                <div
                                                    className="rounded h-1.5"
                                                    style={{
                                                        background: plantColorByCode[p.code],
                                                        width: `${share}%`
                                                    }}
                                                />
                                            </div>
                                            <span className="font-mono text-[11px] min-w-[38px] text-right">
                                                {share.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default PlanDemandView
