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

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import PlantFilterButton from '../../../app/components/ui/PlantFilterButton'
import {
    getCalculatedTruckCount,
    getEffectiveBase,
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
 *  renders off the same derived payloads so totals are always consistent.
 *  When `plantFilter` is set to a plant code, every aggregate is narrowed
 *  to that single plant — KPIs, hourly demand, top-customers, product mix,
 *  and the per-plant breakdown all reflect just that plant. */
function useDemandData(plantProduction, stats, plantNameByCode, planDate, allowedCodes) {
    return useMemo(() => {
        const filterActive = allowedCodes instanceof Set
        const passesPlantFilter = (code) => !filterActive || allowedCodes.has(code)
        const plants = new Map()
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            if (!passesPlantFilter(s.code)) return
            const rawBase = Number.isFinite(s.base) ? s.base : 0
            // Match the schedule tab's starting-pool math: apply date/holiday
            // adjustments AND missing-operator shortfalls, then subtract help
            // sent to other plants and add help received from other plants.
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
        Object.entries(plantProduction || {}).forEach(([code, prod]) => {
            if (code === PLAN_META_KEY) return
            if (!passesPlantFilter(code)) return
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
            if (!passesPlantFilter(code)) return
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
        const timeOfDay = { afternoon: 0, evening: 0, morning: 0, overnight: 0 }
        hours.forEach((h) => {
            if (h.hour < 6) timeOfDay.overnight += h.yardage
            else if (h.hour < 12) timeOfDay.morning += h.yardage
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
    }, [plantProduction, stats, plantNameByCode, planDate, allowedCodes])
}

/* ═══════════════════════════════════════════════════════════════════════
   Main view
   ═══════════════════════════════════════════════════════════════════════ */

function PlanDemandView({
    accentColor,
    planDate,
    plantNameByCode,
    plantProduction,
    plants = [],
    stats,
    userPlantCode = ''
}) {
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const [chartMode, setChartMode] = useState('hourly')
    const [plantFilter, setPlantFilter] = useState('all')
    const filterActive = plantFilter !== 'all' && plantFilter !== 'All' && plantFilter !== ''

    /** Every plant code that shows up in the day — drives the filter
     *  dropdown so the dispatcher can scope to any plant in the plan. */
    const plantOptions = useMemo(() => {
        const codes = new Set()
        ;(stats || []).forEach((s) => s?.code && codes.add(s.code))
        Object.keys(plantProduction || {}).forEach((code) => {
            if (code !== PLAN_META_KEY) codes.add(code)
        })
        return Array.from(codes).sort()
    }, [stats, plantProduction])

    // Resolve the active filter into a Set of plant codes so single-plant,
    // district, and "My Plants" selections share one membership rule.
    const activeFilterCodes = useMemo(() => {
        if (!filterActive) return null
        if (plantFilter === 'MY_PLANTS') return userPlantCode ? new Set([userPlantCode]) : new Set()
        if (plantFilter.startsWith('DISTRICT:')) {
            const districtName = plantFilter.slice(9)
            const codes = new Set()
            ;(plants || []).forEach((p) => {
                const code = p.plantCode || p.plant_code
                if (!code) return
                const dists = p.districts || []
                if (dists.some((d) => (typeof d === 'string' ? d : d?.name) === districtName)) codes.add(code)
            })
            return codes
        }
        return new Set([plantFilter])
    }, [filterActive, plantFilter, plants, userPlantCode])

    const data = useDemandData(plantProduction, stats, plantNameByCode, planDate, activeFilterCodes)
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

    const scopeLabel = (() => {
        if (!filterActive) return `All plants (${plantOptions.length})`
        if (plantFilter === 'MY_PLANTS') return 'My Plants'
        if (plantFilter.startsWith('DISTRICT:')) return plantFilter.slice(9)
        return `Plant ${plantFilter}${plantNameByCode?.[plantFilter] ? ` · ${plantNameByCode[plantFilter]}` : ''}`
    })()

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-3 flex flex-col gap-3">
                {/* Header — single tight row: title + scope, filter, export */}
                <div
                    className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h2 className="text-[15px] font-bold m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                            Demand
                        </h2>
                        <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                            {scopeLabel} · {friendlyDate || 'today'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <PlantFilterButton
                            accentColor={accentColor}
                            active={filterActive}
                            displayText={scopeLabel}
                            onClick={() => setIsPlantModalOpen(true)}
                            title="Filter Demand to a plant, district, or My Plants"
                        />
                        {filterActive && (
                            <button
                                type="button"
                                onClick={() => setPlantFilter('all')}
                                className="border-none bg-transparent cursor-pointer text-[11px] font-medium px-1"
                                style={{ color: 'var(--text-secondary)' }}
                                title="Clear plant filter"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={data.perPlant.length === 0}
                            className="border-none rounded text-[12px] font-medium px-2 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            title="Download the per-plant breakdown as CSV"
                        >
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Demand at-a-glance — Plan-tab style stat row */}
                <StatGroup columns={8}>
                    <Stat label="Trucks" value={data.totals.trucks} />
                    <Stat label="Yardage" value={`${Math.round(data.totals.yardage).toLocaleString()} yd`} />
                    <Stat
                        label="Orders"
                        value={data.totals.orders}
                        hint={data.avgLoadSize ? `${data.avgLoadSize} yd avg` : null}
                    />
                    <Stat
                        label="Peak hour"
                        value={data.peakHour.label || '—'}
                        hint={data.peakHour.total > 0 ? `${data.peakHour.total} trucks` : null}
                    />
                    <Stat
                        label="Biggest pour"
                        value={data.biggestOrder ? `${Math.round(data.biggestOrder.yardage).toLocaleString()} yd` : '—'}
                        hint={data.biggestOrder ? data.biggestOrder.customer : null}
                    />
                    <Stat
                        label="Big pours"
                        value={data.bigPourCount}
                        hint={data.bigPourCount === 0 ? null : '120+ yd, back-to-back'}
                    />
                    <Stat
                        label="Utilization"
                        value={`${data.capacityUtilization}%`}
                        valueColor={utilColor}
                        hint={data.totalBase > 0 ? `${data.peakHour.total}/${data.totalBase} at peak` : null}
                    />
                    <Stat
                        label="Active plants"
                        value={`${data.perPlant.filter((p) => p.orders > 0).length}/${data.perPlant.length}`}
                    />
                </StatGroup>

                {/* Time-of-day — single segmented bar with inline legend */}
                <TimeOfDayBar totals={data.timeOfDay} grandTotal={data.totals.yardage} />

                {/* Chart mode toggle — flat segmented row */}
                <ChartModeToggle
                    accentColor={accentColor}
                    onChange={setChartMode}
                    options={chartOptions}
                    value={chartMode}
                />

                <Panel
                    title={chartOptions.find((o) => o.key === chartMode)?.label || 'Chart'}
                    right={
                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            {chartOptions.find((o) => o.key === chartMode)?.group || ''}
                        </span>
                    }
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
                </Panel>

                {/* Per-plant breakdown table */}
                <PerPlantTable
                    peakByPlant={data.peakByPlant}
                    plantColorByCode={plantColorByCode}
                    rows={data.perPlant}
                />
            </div>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    plants={plants || []}
                    onSelect={(code) => {
                        setPlantFilter(!code || code === 'All' ? 'all' : code)
                        setIsPlantModalOpen(false)
                    }}
                    showAllPlants
                    showMyPlants={!!userPlantCode}
                    userPlantCode={userPlantCode}
                />
            )}
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
    return (
        <div className="flex flex-wrap gap-1">
            {options.map((opt) => {
                const active = value === opt.key
                return (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => onChange(opt.key)}
                        className="flex items-center gap-1.5 rounded text-[12px] font-medium cursor-pointer px-2.5 py-1 whitespace-nowrap"
                        style={{
                            background: active ? accentColor : 'var(--bg-secondary)',
                            color: active ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${active ? accentColor : 'var(--border-light)'}`
                        }}
                        title={opt.group ? `${opt.group} · ${opt.label}` : opt.label}
                    >
                        <i className={`fas ${opt.icon} text-[10px]`} />
                        <span>{opt.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

const TIME_OF_DAY_SECTIONS = [
    { color: '#6366f1', hint: '00:00–06:00', key: 'overnight', label: 'Overnight' },
    { color: '#f59e0b', hint: '06:00–12:00', key: 'morning', label: 'Morning' },
    { color: '#0ea5e9', hint: '12:00–18:00', key: 'afternoon', label: 'Afternoon' },
    { color: '#8b5cf6', hint: '18:00+', key: 'evening', label: 'Evening' }
]

function TimeOfDayBar({ grandTotal, totals }) {
    if (grandTotal <= 0) return null
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider">
                <span style={{ color: 'var(--text-tertiary)' }}>Time of day</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                    {Math.round(grandTotal).toLocaleString()} yd total
                </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                {TIME_OF_DAY_SECTIONS.map((s) => {
                    const value = totals[s.key] || 0
                    const pct = (value / grandTotal) * 100
                    if (pct <= 0) return null
                    return (
                        <div
                            key={s.key}
                            style={{ background: s.color, width: `${pct}%` }}
                            title={`${s.label}: ${Math.round(value).toLocaleString()} yd (${pct.toFixed(1)}%)`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                {TIME_OF_DAY_SECTIONS.map((s) => {
                    const value = Math.round(totals[s.key] || 0)
                    const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0
                    return (
                        <span key={s.key} className="flex items-center gap-1.5">
                            <span
                                className="inline-block rounded-sm shrink-0"
                                style={{ background: s.color, height: 8, width: 8 }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                                {value.toLocaleString()} yd
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                · {pct.toFixed(0)}% · {s.hint}
                            </span>
                        </span>
                    )
                })}
            </div>
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

/** Verdict pill for how supply (effective truck pool) compares to peak
 *  demand (concurrent trucks the schedule needs). Coverage = supply / demand:
 *    ≥ 110% → Comfortable
 *    100–109% → On target
 *    80–99%  → Tight
 *    < 80%   → Overbooked
 *  No-demand plants render a neutral "Idle" pill so the row still says
 *  something useful. */
const supplyVerdict = (supply, demand) => {
    if (!demand) return { color: 'var(--text-tertiary)', label: 'Idle', tone: 'idle' }
    const coverage = supply > 0 ? (supply / demand) * 100 : 0
    if (coverage >= 110) return { color: '#16a34a', coverage, label: 'Comfortable', tone: 'good' }
    if (coverage >= 100) return { color: '#0ea5e9', coverage, label: 'On target', tone: 'good' }
    if (coverage >= 80) return { color: '#d97706', coverage, label: 'Tight', tone: 'warn' }
    return { color: '#dc2626', coverage, label: 'Overbooked', tone: 'bad' }
}

function PerPlantTable({ peakByPlant, plantColorByCode, rows }) {
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
                    Yards · trucks (incl. help) · how well supply meets demand
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {[
                                { align: 'left', label: 'Plant' },
                                { align: 'right', label: 'Yardage' },
                                { align: 'right', label: 'Trucks (effective)' },
                                { align: 'right', label: 'Peak demand' },
                                { align: 'left', label: 'Coverage' }
                            ].map((h) => (
                                <th
                                    key={h.label}
                                    className={`px-3 py-2 font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap ${
                                        h.align === 'right' ? 'text-right' : 'text-left'
                                    }`}
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        borderBottom: '1px solid var(--border-light)',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((p) => {
                            const peak = peakByPlant[p.code] || 0
                            const supply = p.adjustedBase || 0
                            const baseTrucks = supply + (p.helpSend || 0) - (p.helpRecv || 0)
                            const verdict = supplyVerdict(supply, peak)
                            const coveragePct =
                                verdict.tone === 'idle' ? null : Math.min(150, Math.round(verdict.coverage))
                            const helpParts = []
                            if (p.helpRecv > 0) helpParts.push(`+${p.helpRecv} in`)
                            if (p.helpSend > 0) helpParts.push(`−${p.helpSend} out`)
                            const helpLine = helpParts.length
                                ? `${baseTrucks} base · ${helpParts.join(' · ')}`
                                : `${baseTrucks} base`
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
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="font-bold"
                                                        style={{
                                                            color: 'var(--text-primary)',
                                                            fontFamily: 'var(--font-heading)'
                                                        }}
                                                    >
                                                        {p.code}
                                                    </span>
                                                    <span
                                                        className="text-[11px]"
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        {p.name !== p.code ? p.name : ''}
                                                    </span>
                                                </div>
                                                <span
                                                    className="text-[10.5px]"
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    {p.orders} order{p.orders === 1 ? '' : 's'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td
                                        className="px-3 py-2 font-mono font-semibold whitespace-nowrap text-right"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {Math.round(p.totalYardage).toLocaleString()} yd
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                            <span
                                                className="font-mono font-bold text-[14px] tabular-nums"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {supply}
                                            </span>
                                            <span
                                                className="text-[10.5px] font-mono"
                                                style={{ color: 'var(--text-tertiary)' }}
                                                title="Effective truck pool — base ± inter-plant help today"
                                            >
                                                {helpLine}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                            <span
                                                className="font-mono font-bold text-[14px] tabular-nums"
                                                style={{
                                                    color:
                                                        peak > supply && supply > 0 ? '#dc2626' : 'var(--text-primary)'
                                                }}
                                            >
                                                {peak}
                                            </span>
                                            <span
                                                className="text-[10.5px] font-mono"
                                                style={{ color: 'var(--text-tertiary)' }}
                                                title="Peak concurrent trucks the schedule needs at any hour"
                                            >
                                                concurrent
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2.5 min-w-[180px]">
                                            <div
                                                className="rounded h-2 flex-1 overflow-hidden relative"
                                                style={{ background: 'var(--bg-tertiary)' }}
                                                title={
                                                    coveragePct == null
                                                        ? 'No demand scheduled'
                                                        : `Supply / demand = ${coveragePct}%`
                                                }
                                            >
                                                {coveragePct != null && (
                                                    <>
                                                        <div
                                                            className="rounded h-2"
                                                            style={{
                                                                background: verdict.color,
                                                                width: `${Math.min(100, (coveragePct / 110) * 100)}%`
                                                            }}
                                                        />
                                                        {/* 100% marker — visual reference for "supply equals demand". */}
                                                        <div
                                                            className="absolute top-0 bottom-0"
                                                            style={{
                                                                background: 'var(--text-tertiary)',
                                                                left: `${(100 / 110) * 100}%`,
                                                                opacity: 0.5,
                                                                width: 1
                                                            }}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                            <span
                                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                                                style={{
                                                    background: `${verdict.color}1f`,
                                                    color: verdict.color
                                                }}
                                            >
                                                {verdict.label}
                                                {coveragePct != null && (
                                                    <span className="font-mono" style={{ opacity: 0.85 }}>
                                                        · {coveragePct}%
                                                    </span>
                                                )}
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
