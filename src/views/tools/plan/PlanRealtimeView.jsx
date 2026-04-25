import React, { useEffect, useMemo, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import PlantFilterButton from '../../../app/components/ui/PlantFilterButton'
import {
    buildAssignmentDriverTimes,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computeSendHomeRows,
    getCalculatedTruckCount,
    getEffectiveBase,
    getTodayDate,
    isExcludedOrder,
    plantBadgeColor,
    poolAtTime,
    timeToMinutes,
    TRUCK_ON_SITE_MINUTES
} from '../../../utils/PlanUtility'

const PLAN_META_KEY = '_meta'

const formatClock = (mins) => {
    if (!Number.isFinite(mins)) return '—'
    const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const formatRelative = (diffMin) => {
    if (!Number.isFinite(diffMin)) return ''
    if (Math.abs(diffMin) < 1) return 'now'
    const abs = Math.abs(diffMin)
    if (abs < 60) return diffMin > 0 ? `+${Math.round(abs)}m` : `-${Math.round(abs)}m`
    const hours = Math.floor(abs / 60)
    const mins = Math.round(abs % 60)
    const suffix = mins > 0 ? `${hours}h${mins}m` : `${hours}h`
    return diffMin > 0 ? `+${suffix}` : `-${suffix}`
}

const clean = (value) => (value == null ? '' : String(value).trim())

const estimatePourMinutes = (order) => {
    const rate = timeToMinutes(order?.rate)
    const loadSize = parseFloat(order?.loadSize) || 0
    const yardage = parseFloat(order?.yardage) || 0
    if (!rate || loadSize <= 0 || yardage <= 0) return 60
    const trips = Math.max(1, Math.ceil(yardage / loadSize))
    return (trips - 1) * rate + TRUCK_ON_SITE_MINUTES
}

const useLiveClock = () => {
    const [tick, setTick] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setTick(Date.now()), 30000)
        return () => clearInterval(id)
    }, [])
    return useMemo(() => {
        const now = new Date(tick)
        return {
            nowDate: now,
            nowLabel: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            nowMin: now.getHours() * 60 + now.getMinutes(),
            todayStr: getTodayDate()
        }
    }, [tick])
}

const flattenOrders = (plantProduction) => {
    const out = []
    Object.entries(plantProduction || {}).forEach(([code, prod]) => {
        if (code === PLAN_META_KEY) return
        const list = Array.isArray(prod?.orders) ? prod.orders : []
        list.forEach((o) => {
            if (isExcludedOrder(o)) return
            out.push({ ...o, plantCode: code })
        })
    })
    return out
}

/** Plant pill — same visual treatment as the schedule tab's PlantBadge. */
function PlantPill({ code, name, accentColor }) {
    const bg = plantBadgeColor(code, accentColor)
    const fg = bg && bg.toLowerCase() === '#eab308' ? '#3f2d00' : '#fff'
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 font-semibold whitespace-nowrap"
            style={{ background: bg, color: fg }}
        >
            <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                    background: 'rgba(255,255,255,0.22)',
                    color: fg,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 10.5,
                    height: 18,
                    minWidth: 34
                }}
            >
                {code}
            </span>
            {name && <span className="text-[11.5px]">{name}</span>}
        </span>
    )
}

const SORT_OPTIONS = [
    { key: 'priority', label: 'Most active first' },
    { key: 'plant', label: 'Plant code' },
    { key: 'pool', label: 'Trucks free (low → high)' },
    { key: 'next', label: 'Soonest next pour' }
]

const TIME_WINDOW_MIN = 90

/**
 * Realtime dispatch view. Uses the shared `Panel` / `Stat` / `StatGroup`
 * primitives (the flat, table-friendly aesthetic) for the headline numbers
 * and the tabular sections. Anchors to "now" — PlanView snaps the plan date
 * to today whenever this tab is selected.
 *
 * `defaultPlantCode` — when set (user has the `plan.defaultplant` permission
 * AND has a home plant), the view opens pre-filtered to that plant.
 */
function PlanRealtimeView({
    accentColor,
    assignments,
    defaultPlantCode,
    planDate,
    plantNameByCode,
    plantProduction,
    plants = [],
    stats,
    userPlantCode = ''
}) {
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const clock = useLiveClock()
    const isToday = planDate === clock.todayStr
    const nowMin = clock.nowMin
    const flatOrders = useMemo(() => flattenOrders(plantProduction), [plantProduction])

    const [plantFilter, setPlantFilter] = useState(() => defaultPlantCode || 'all')
    const [sortKey, setSortKey] = useState('priority')
    const filterActive = plantFilter !== 'all' && plantFilter !== 'All' && plantFilter !== ''

    const plantOptions = useMemo(() => {
        const codes = new Set()
        ;(stats || []).forEach((s) => s?.code && codes.add(s.code))
        flatOrders.forEach((o) => o.plantCode && codes.add(o.plantCode))
        ;(assignments || []).forEach((a) => {
            if (a?.fromPlant) codes.add(a.fromPlant)
            if (a?.toPlant) codes.add(a.toPlant)
            if (a?.returnPlant) codes.add(a.returnPlant)
        })
        return Array.from(codes).sort()
    }, [stats, flatOrders, assignments])

    // Resolve the active filter into a concrete Set of plant codes so
    // single-plant, district, and "My Plants" selections all share one
    // membership check downstream.
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

    const touchesFilter = (codes) => !filterActive || codes.some((c) => activeFilterCodes?.has(c))
    const passesPlant = (o) => !filterActive || activeFilterCodes?.has(o.plantCode)

    const initialPoolByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const base = Number.isFinite(s.base) ? s.base : 0
            out[s.code] = getEffectiveBase(base, s.code, plantProduction, planDate)
        })
        return out
    }, [stats, plantProduction, planDate])

    const helpTransfers = useMemo(() => {
        const out = []
        ;(assignments || []).forEach((a) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const home = a.returnPlant || a.fromPlant
            buildAssignmentDriverTimes(a).forEach((dt) => {
                if (!Number.isFinite(dt.arriveMin)) return
                out.push({ delta: -1, plantCode: a.fromPlant, time: dt.arriveMin })
                out.push({ delta: 1, plantCode: a.toPlant, time: dt.arriveMin })
                if (Number.isFinite(dt.leaveMin) && dt.leaveMin > dt.arriveMin) {
                    out.push({ delta: -1, plantCode: a.toPlant, time: dt.leaveMin })
                    out.push({ delta: 1, plantCode: home, time: dt.leaveMin })
                }
            })
        })
        return out
    }, [assignments])

    const poolTimeline = useMemo(
        () => computePlantPoolTimeline(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )
    const poolTimelinesByPlant = useMemo(
        () => computePlantPoolTimelines(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )
    const sendHomeRows = useMemo(
        () => computeSendHomeRows(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )

    const orderSnapshots = useMemo(() => {
        return flatOrders
            .map((o) => {
                const startMin = timeToMinutes(o?.startTime)
                if (!Number.isFinite(startMin)) return null
                const key = o.orderId || `${o.plantCode ?? 'unknown'}-${startMin}-${o.orderNum ?? ''}`
                const entry = poolTimeline?.[key]
                const endMin = Number.isFinite(entry?.lastReturnMinutes)
                    ? entry.lastReturnMinutes
                    : startMin + estimatePourMinutes(o)
                const duration = Math.max(1, endMin - startMin)
                let state = 'upcoming'
                let progress = 0
                if (nowMin < startMin) {
                    state = 'upcoming'
                } else if (nowMin >= endMin) {
                    state = 'done'
                    progress = 100
                } else {
                    state = 'pouring'
                    progress = Math.min(100, Math.max(0, ((nowMin - startMin) / duration) * 100))
                }
                return {
                    customer: clean(o.customer),
                    endMin,
                    order: o,
                    orderKey: key,
                    orderNum: clean(o.orderNum),
                    plantCode: o.plantCode,
                    progress,
                    startMin,
                    state,
                    truckCount: entry?.truckCount || getCalculatedTruckCount(o) || 0,
                    yardage: parseFloat(o.yardage) || 0
                }
            })
            .filter(Boolean)
    }, [flatOrders, poolTimeline, nowMin])

    const activeOrders = useMemo(
        () => orderSnapshots.filter((o) => o.state === 'pouring' && passesPlant(o)).sort((a, b) => a.endMin - b.endMin),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, plantFilter, filterActive]
    )

    const upcomingOrders = useMemo(
        () =>
            orderSnapshots
                .filter((o) => o.state === 'upcoming' && o.startMin - nowMin <= TIME_WINDOW_MIN && passesPlant(o))
                .sort((a, b) => a.startMin - b.startMin),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, nowMin, plantFilter, filterActive]
    )

    const upcomingHelp = useMemo(() => {
        const rows = []
        ;(assignments || []).forEach((a, idx) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const home = a.returnPlant || a.fromPlant
            if (!touchesFilter([a.fromPlant, a.toPlant, home])) return
            buildAssignmentDriverTimes(a).forEach((dt) => {
                if (!Number.isFinite(dt.arriveMin)) return
                if (dt.arriveMin > nowMin && dt.arriveMin - nowMin <= TIME_WINDOW_MIN) {
                    rows.push({
                        fromPlant: a.fromPlant,
                        key: `up-${idx}-${dt.driverIndex}`,
                        time: dt.arriveMin,
                        toPlant: a.toPlant
                    })
                }
            })
        })
        return rows.sort((a, b) => a.time - b.time)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignments, nowMin, plantFilter, filterActive])

    const upcomingSendHome = useMemo(() => {
        return sendHomeRows
            .filter((r) => r.time >= nowMin && r.time - nowMin <= TIME_WINDOW_MIN)
            .filter((r) => !filterActive || activeFilterCodes?.has(r.plantCode))
            .sort((a, b) => a.time - b.time)
    }, [sendHomeRows, nowMin, filterActive, activeFilterCodes])

    const plantSnapshots = useMemo(() => {
        const out = []
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            if (filterActive && !activeFilterCodes?.has(s.code)) return
            const timeline = poolTimelinesByPlant?.[s.code] || []
            const currentPool = poolAtTime(timeline, nowMin)
            const base = initialPoolByCode[s.code] || 0
            const poolingNow = orderSnapshots.filter((o) => o.state === 'pouring' && o.plantCode === s.code)
            const dispatched = poolingNow.reduce((acc, o) => acc + (o.truckCount || 0), 0)
            const nextOrder = orderSnapshots
                .filter((o) => o.state === 'upcoming' && o.plantCode === s.code)
                .sort((a, b) => a.startMin - b.startMin)[0]
            const statusColor =
                currentPool == null ? '#6b7280' : currentPool < 0 ? '#dc2626' : currentPool < 2 ? '#d97706' : '#16a34a'
            if (poolingNow.length === 0 && !nextOrder && base === 0 && dispatched === 0) return
            out.push({
                base,
                code: s.code,
                dispatched,
                name: plantNameByCode?.[s.code] || s.code,
                nextOrder,
                poolNow: currentPool,
                poolingNow,
                statusColor
            })
        })
        const compareByCode = (a, b) => String(a.code).localeCompare(String(b.code))
        return out.sort((a, b) => {
            if (sortKey === 'plant') return compareByCode(a, b)
            if (sortKey === 'pool') {
                const aPool = Number.isFinite(a.poolNow) ? a.poolNow : Infinity
                const bPool = Number.isFinite(b.poolNow) ? b.poolNow : Infinity
                return aPool - bPool || compareByCode(a, b)
            }
            if (sortKey === 'next') {
                const aNext = a.nextOrder ? a.nextOrder.startMin : Infinity
                const bNext = b.nextOrder ? b.nextOrder.startMin : Infinity
                return aNext - bNext || compareByCode(a, b)
            }
            if (a.poolingNow.length !== b.poolingNow.length) return b.poolingNow.length - a.poolingNow.length
            const aHasNext = a.nextOrder ? 1 : 0
            const bHasNext = b.nextOrder ? 1 : 0
            if (aHasNext !== bHasNext) return bHasNext - aHasNext
            return compareByCode(a, b)
        })
    }, [
        stats,
        poolTimelinesByPlant,
        nowMin,
        initialPoolByCode,
        orderSnapshots,
        plantNameByCode,
        plantFilter,
        filterActive,
        sortKey
    ])

    const kpis = useMemo(() => {
        const trucksOut = activeOrders.reduce((acc, o) => acc + (o.truckCount || 0), 0)
        const yardsRemainingFromActive = activeOrders.reduce(
            (acc, o) => acc + (o.yardage || 0) * (1 - o.progress / 100),
            0
        )
        const yardsUpcoming = orderSnapshots
            .filter((o) => o.state === 'upcoming')
            .reduce((acc, o) => acc + (o.yardage || 0), 0)
        const yardsDone = orderSnapshots.filter((o) => o.state === 'done').reduce((acc, o) => acc + (o.yardage || 0), 0)
        const yardsTotal = yardsDone + activeOrders.reduce((acc, o) => acc + (o.yardage || 0), 0) + yardsUpcoming
        const dayProgressPct = yardsTotal > 0 ? Math.round((yardsDone / yardsTotal) * 100) : 0
        return {
            activePlants: plantSnapshots.filter((p) => p.poolingNow.length > 0).length,
            activePours: activeOrders.length,
            dayProgressPct,
            trucksOut,
            yardsDone: Math.round(yardsDone),
            yardsRemaining: Math.round(yardsRemainingFromActive + yardsUpcoming),
            yardsTotal: Math.round(yardsTotal)
        }
    }, [activeOrders, orderSnapshots, plantSnapshots])

    const feed = useMemo(() => {
        const events = []
        upcomingOrders.forEach((o) => {
            events.push({
                color: '#0ea5e9',
                detail: `${o.customer || 'Pour'} · ${o.yardage} yd / ${o.truckCount} trucks`,
                id: `start-${o.orderKey}`,
                kind: 'Start',
                plantCode: o.plantCode,
                time: o.startMin
            })
        })
        activeOrders.forEach((o) => {
            if (o.endMin - nowMin > TIME_WINDOW_MIN) return
            events.push({
                color: '#16a34a',
                detail: `${o.customer || 'Pour'} · ${o.truckCount} trucks freeing up`,
                id: `end-${o.orderKey}`,
                kind: 'Wrap',
                plantCode: o.plantCode,
                time: o.endMin
            })
        })
        upcomingHelp.forEach((h) => {
            events.push({
                color: '#3b82f6',
                detail: `Help arriving from ${h.fromPlant}`,
                id: h.key,
                kind: 'Help',
                plantCode: h.toPlant,
                time: h.time
            })
        })
        upcomingSendHome.forEach((s) => {
            events.push({
                color: '#64748b',
                detail: `Send ${s.count} home`,
                id: `sh-${s.plantCode}-${s.time}`,
                kind: 'Clock-out',
                plantCode: s.plantCode,
                time: s.time
            })
        })
        return events.sort((a, b) => a.time - b.time)
    }, [upcomingOrders, activeOrders, upcomingHelp, upcomingSendHome, nowMin])

    const friendlyDate = clock.nowDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
    })

    // Hand the full plant list (including district memberships) to the
    // modal so the district groupings render. Filter behavior on the
    // page is handled by `activeFilterCodes`.
    const plantPickerOptions = plants || []
    const plantFilterDisplay = (() => {
        if (!filterActive) return `All plants (${plantOptions.length})`
        if (plantFilter === 'MY_PLANTS') return 'My Plants'
        if (plantFilter.startsWith('DISTRICT:')) return plantFilter.slice(9)
        return `Plant ${plantFilter}${plantNameByCode?.[plantFilter] ? ` · ${plantNameByCode[plantFilter]}` : ''}`
    })()

    const filterControls = (
        <div className="flex items-center gap-1.5">
            <PlantFilterButton
                accentColor={accentColor}
                active={filterActive}
                displayText={plantFilterDisplay}
                onClick={() => setIsPlantModalOpen(true)}
                title="Filter Realtime to a single plant"
            />
            <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="px-2 py-1 rounded text-[12px] cursor-pointer font-medium"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)'
                }}
            >
                {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                        Sort: {opt.label}
                    </option>
                ))}
            </select>
        </div>
    )

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 lg:px-6 py-5 flex flex-col gap-5">
                {/* Header — title + scope, filter + sort */}
                <div
                    className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <div className="flex items-baseline gap-3 min-w-0">
                        <h2 className="text-[15px] font-bold m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                            Realtime
                        </h2>
                        <span
                            className="flex items-center gap-2 text-[12px]"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ background: isToday ? '#16a34a' : '#94a3b8' }}
                            />
                            <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                {clock.nowLabel}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>· {friendlyDate}</span>
                        </span>
                    </div>
                    {filterControls}
                </div>

                {/* Stat row — fleet-wide live numbers, Plan-tab style */}
                <StatGroup columns={6}>
                    <Stat
                        label="Pours"
                        value={kpis.activePours}
                        hint={
                            kpis.activePlants > 0
                                ? `${kpis.activePlants} plant${kpis.activePlants === 1 ? '' : 's'}`
                                : 'Idle'
                        }
                    />
                    <Stat
                        label="Trucks out"
                        value={kpis.trucksOut}
                        hint={kpis.trucksOut === 0 ? 'No rotation' : 'In rotation'}
                    />
                    <Stat
                        label="Yards left"
                        value={kpis.yardsRemaining.toLocaleString()}
                        hint={`${kpis.yardsDone.toLocaleString()} poured`}
                    />
                    <Stat
                        label="Day progress"
                        value={`${kpis.dayProgressPct}%`}
                        hint={`of ${kpis.yardsTotal.toLocaleString()} yd`}
                        valueColor={kpis.dayProgressPct >= 80 ? '#16a34a' : undefined}
                    />
                    <Stat
                        label="Active plants"
                        value={`${kpis.activePlants}/${plantSnapshots.length}`}
                        hint={kpis.activePlants > 0 ? 'Pouring now' : 'None pouring'}
                    />
                    <Stat
                        label="Status"
                        value={isToday ? 'Live' : 'Off-day'}
                        valueColor={isToday ? '#16a34a' : '#94a3b8'}
                        hint={isToday ? 'Anchored to now' : 'Not today'}
                    />
                </StatGroup>

                {/* Active pours — Plan-tab card with table inside */}
                <Panel
                    title="Pouring now"
                    right={
                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            {activeOrders.length} active
                        </span>
                    }
                    innerClassName=""
                >
                    {activeOrders.length === 0 ? (
                        <div className="px-4 py-3 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                            No pours running.
                            {upcomingOrders[0] && (
                                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                                    Next:{' '}
                                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                                        {formatClock(upcomingOrders[0].startMin)}
                                    </span>{' '}
                                    ({formatRelative(upcomingOrders[0].startMin - nowMin)}) ·{' '}
                                    {upcomingOrders[0].plantCode} {upcomingOrders[0].customer || ''}
                                </span>
                            )}
                        </div>
                    ) : (
                        <ActivePoursTable
                            orders={activeOrders}
                            accentColor={accentColor}
                            nowMin={nowMin}
                            plantNameByCode={plantNameByCode}
                        />
                    )}
                </Panel>

                {/* Plant capacity + Stream — two columns at large width */}
                <div className="grid gap-5 grid-cols-1 lg:grid-cols-[2fr_1fr]">
                    <Panel
                        title="Plant capacity"
                        right={
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                {plantSnapshots.length} plant{plantSnapshots.length === 1 ? '' : 's'}
                            </span>
                        }
                        innerClassName=""
                    >
                        {plantSnapshots.length === 0 ? (
                            <div className="px-4 py-3 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                                No active plants.
                            </div>
                        ) : (
                            <PlantCapacityTable
                                snapshots={plantSnapshots}
                                accentColor={accentColor}
                                nowMin={nowMin}
                                plantNameByCode={plantNameByCode}
                            />
                        )}
                    </Panel>

                    <Panel
                        title="Next 90 min"
                        right={
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                {feed.length} event{feed.length === 1 ? '' : 's'}
                            </span>
                        }
                        innerClassName=""
                    >
                        {feed.length === 0 ? (
                            <div className="px-4 py-3 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                                Nothing scheduled.
                            </div>
                        ) : (
                            <UpcomingStream
                                events={feed}
                                accentColor={accentColor}
                                nowMin={nowMin}
                                plantNameByCode={plantNameByCode}
                            />
                        )}
                    </Panel>
                </div>
            </div>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    plants={plantPickerOptions}
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

function ActivePoursTable({ orders, accentColor, nowMin, plantNameByCode }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {['Start', 'Plant', 'Customer', 'Yards', 'Trucks', 'Progress', 'Wraps'].map((h) => (
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
                    {orders.map((o) => {
                        const eta = o.endMin - nowMin
                        const pct = Math.round(o.progress)
                        return (
                            <tr key={o.orderKey} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td
                                    className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                                    style={{ color: accentColor }}
                                >
                                    {formatClock(o.startMin)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <PlantPill
                                        code={o.plantCode}
                                        name={plantNameByCode?.[o.plantCode]}
                                        accentColor={accentColor}
                                    />
                                </td>
                                <td
                                    className="px-3 py-2 max-w-[260px] truncate font-semibold"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={o.customer || ''}
                                >
                                    {o.customer || '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {o.yardage > 0 ? o.yardage : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {o.truckCount > 0 ? o.truckCount : '—'}
                                </td>
                                <td className="px-3 py-2 min-w-[140px]">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="flex-1 h-1.5 overflow-hidden"
                                            style={{ background: 'var(--bg-tertiary)', borderRadius: 2 }}
                                        >
                                            <div
                                                className="h-full"
                                                style={{
                                                    background: pct < 33 ? '#0ea5e9' : pct < 66 ? '#d97706' : '#16a34a',
                                                    width: `${pct}%`
                                                }}
                                            />
                                        </div>
                                        <span
                                            className="font-mono font-bold tabular-nums w-9 text-right"
                                            style={{ color: 'var(--text-primary)', fontSize: 11 }}
                                        >
                                            {pct}%
                                        </span>
                                    </div>
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: '#16a34a', fontWeight: 600 }}
                                >
                                    {formatClock(o.endMin)}{' '}
                                    <span style={{ color: 'var(--text-tertiary)' }}>{formatRelative(eta)}</span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function PlantCapacityTable({ snapshots, accentColor, nowMin, plantNameByCode }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {['Plant', 'Free', 'Out', 'Active', 'Next'].map((h, i) => (
                            <th
                                key={h}
                                className={`px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'} font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap`}
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
                    {snapshots.map((s) => {
                        const next = s.nextOrder
                        const eta = next ? next.startMin - nowMin : null
                        return (
                            <tr key={s.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-2">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full"
                                            style={{ background: s.statusColor }}
                                        />
                                        <PlantPill
                                            code={s.code}
                                            name={plantNameByCode?.[s.code]}
                                            accentColor={accentColor}
                                        />
                                    </span>
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap tabular-nums"
                                    style={{ color: s.statusColor, fontSize: 14 }}
                                >
                                    {s.poolNow != null ? s.poolNow : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {s.dispatched}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {s.poolingNow.length}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {next ? (
                                        <>
                                            {formatClock(next.startMin)}{' '}
                                            <span style={{ color: 'var(--text-tertiary)' }}>{formatRelative(eta)}</span>
                                        </>
                                    ) : (
                                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
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

function UpcomingStream({ events, accentColor, nowMin, plantNameByCode }) {
    return (
        <div className="flex flex-col">
            {events.map((event) => {
                const eta = event.time - nowMin
                return (
                    <div
                        key={event.id}
                        className="px-3 py-2 flex items-baseline gap-3 text-[12.5px]"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                        <span
                            className="font-mono tabular-nums font-bold whitespace-nowrap"
                            style={{ color: event.color, minWidth: 48 }}
                        >
                            {formatClock(event.time)}
                        </span>
                        <span
                            className="font-semibold whitespace-nowrap"
                            style={{ color: 'var(--text-primary)', minWidth: 60 }}
                        >
                            {event.kind}
                        </span>
                        {event.plantCode && (
                            <PlantPill
                                code={event.plantCode}
                                name={plantNameByCode?.[event.plantCode]}
                                accentColor={accentColor}
                            />
                        )}
                        <span
                            className="truncate flex-1"
                            style={{ color: 'var(--text-secondary)' }}
                            title={event.detail}
                        >
                            {event.detail}
                        </span>
                        <span
                            className="font-mono tabular-nums whitespace-nowrap"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            {formatRelative(eta)}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

export default PlanRealtimeView
