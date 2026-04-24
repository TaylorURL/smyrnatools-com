import React, { useEffect, useMemo, useState } from 'react'

import {
    buildAssignmentDriverTimes,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computeSendHomeRows,
    getCalculatedTruckCount,
    getEffectiveBase,
    isBigPourOrder,
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
    if (abs < 60) return diffMin > 0 ? `in ${Math.round(abs)}m` : `${Math.round(abs)}m ago`
    const hours = Math.floor(abs / 60)
    const mins = Math.round(abs % 60)
    const suffix = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    return diffMin > 0 ? `in ${suffix}` : `${suffix} ago`
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

/** Figure out whether the plan's date is today (so the "realtime" clock
 *  actually anchors to now) or a different day (clock is clamped to that
 *  day's window and we label the view accordingly). */
const usePlanClock = (planDate) => {
    const [tick, setTick] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setTick(Date.now()), 30000)
        return () => clearInterval(id)
    }, [])
    return useMemo(() => {
        const now = new Date(tick)
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
            now.getDate()
        ).padStart(2, '0')}`
        const isToday = planDate === todayStr
        const nowMin = now.getHours() * 60 + now.getMinutes()
        return {
            isToday,
            nowLabel: isToday ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
            nowMin: isToday ? nowMin : null,
            tick
        }
    }, [tick, planDate])
}

/** Flatten plant production into one orders array with plantCode attached. */
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

function PlanRealtimeView({ accentColor, assignments, planDate, plantNameByCode, plantProduction, stats }) {
    const clock = usePlanClock(planDate)
    // For non-today plans, default the scrubber to midday so the screen is
    // still informative — dispatcher can drag to any time.
    const [manualTime, setManualTime] = useState(() => (clock.isToday ? null : 10 * 60))
    const effectiveMin = clock.isToday && manualTime == null ? clock.nowMin : manualTime
    /** "all" = no filter. Any other string = only show activity that touches
     *  that plant code (dispatches, arrivals, returns, help endpoints). */
    const [plantFilter, setPlantFilter] = useState('all')
    const filterActive = plantFilter !== 'all'
    const touchesFilter = (codes) => {
        if (!filterActive) return true
        return codes.some((c) => c === plantFilter)
    }

    const flatOrders = useMemo(() => flattenOrders(plantProduction), [plantProduction])

    /** Every plant code that shows up anywhere in the plan — stats, orders,
     *  or help assignments — fed into the filter dropdown so the dispatcher
     *  can always pick any plant that's relevant to the day. */
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

    /** Snapshot each order's state at `effectiveMin`: upcoming, pouring, or
     *  done. Includes progress percentage + predicted first-truck arrival so
     *  the dispatcher sees what's happening right now. */
    const orderSnapshots = useMemo(() => {
        if (!Number.isFinite(effectiveMin)) return []
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
                if (effectiveMin < startMin) {
                    state = 'upcoming'
                } else if (effectiveMin >= endMin) {
                    state = 'done'
                    progress = 100
                } else {
                    state = 'pouring'
                    progress = Math.min(100, Math.max(0, ((effectiveMin - startMin) / duration) * 100))
                }
                return {
                    customer: clean(o.customer),
                    endMin,
                    loadSize: parseFloat(o.loadSize) || 0,
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
    }, [effectiveMin, flatOrders, poolTimeline])

    const passesPlant = (o) => !filterActive || o.plantCode === plantFilter

    const activeOrders = useMemo(
        () => orderSnapshots.filter((o) => o.state === 'pouring' && passesPlant(o)).sort((a, b) => a.endMin - b.endMin),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, plantFilter, filterActive]
    )

    const upcomingOrders = useMemo(
        () =>
            orderSnapshots
                .filter((o) => o.state === 'upcoming' && passesPlant(o))
                .sort((a, b) => a.startMin - b.startMin)
                .slice(0, 6),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, plantFilter, filterActive]
    )

    const justFinished = useMemo(
        () =>
            orderSnapshots
                .filter((o) => o.state === 'done' && passesPlant(o))
                .sort((a, b) => b.endMin - a.endMin)
                .slice(0, 6),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, plantFilter, filterActive]
    )

    /** Active help transfers happening right now (trucks en route or at dest). */
    const activeHelp = useMemo(() => {
        if (!Number.isFinite(effectiveMin)) return []
        const out = []
        ;(assignments || []).forEach((a, idx) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const home = a.returnPlant || a.fromPlant
            if (!touchesFilter([a.fromPlant, a.toPlant, home])) return
            buildAssignmentDriverTimes(a).forEach((dt) => {
                if (!Number.isFinite(dt.arriveMin) || effectiveMin < dt.arriveMin) return
                const stillOut = !Number.isFinite(dt.leaveMin) || effectiveMin < dt.leaveMin
                if (!stillOut) return
                out.push({
                    arriveMin: dt.arriveMin,
                    driverIndex: dt.driverIndex,
                    fromPlant: a.fromPlant,
                    home,
                    key: `${idx}-${dt.driverIndex}`,
                    leaveMin: dt.leaveMin,
                    toPlant: a.toPlant
                })
            })
        })
        return out
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignments, effectiveMin, plantFilter, filterActive])

    const upcomingHelp = useMemo(() => {
        if (!Number.isFinite(effectiveMin)) return []
        const rows = []
        ;(assignments || []).forEach((a, idx) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const home = a.returnPlant || a.fromPlant
            if (!touchesFilter([a.fromPlant, a.toPlant, home])) return
            buildAssignmentDriverTimes(a).forEach((dt) => {
                if (!Number.isFinite(dt.arriveMin)) return
                if (dt.arriveMin > effectiveMin && dt.arriveMin - effectiveMin <= 180) {
                    rows.push({
                        fromPlant: a.fromPlant,
                        key: `up-${idx}-${dt.driverIndex}`,
                        time: dt.arriveMin,
                        toPlant: a.toPlant
                    })
                }
            })
        })
        return rows.sort((a, b) => a.time - b.time).slice(0, 5)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignments, effectiveMin, plantFilter, filterActive])

    const upcomingSendHome = useMemo(() => {
        if (!Number.isFinite(effectiveMin)) return []
        return sendHomeRows
            .filter((r) => r.time >= effectiveMin && r.time - effectiveMin <= 180)
            .filter((r) => !filterActive || r.plantCode === plantFilter)
            .sort((a, b) => a.time - b.time)
            .slice(0, 5)
    }, [sendHomeRows, effectiveMin, plantFilter, filterActive])

    /** Per-plant current state: pool at this minute, active orders, capacity %. */
    const plantSnapshots = useMemo(() => {
        const out = []
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            if (filterActive && s.code !== plantFilter) return
            const timeline = poolTimelinesByPlant?.[s.code] || []
            const currentPool = Number.isFinite(effectiveMin) ? poolAtTime(timeline, effectiveMin) : null
            const base = initialPoolByCode[s.code] || 0
            // Use the UNFILTERED order list here so pool accounting stays
            // correct even when `activeOrders` is narrowed by the plant filter.
            const poolingNow = orderSnapshots.filter((o) => o.state === 'pouring' && o.plantCode === s.code)
            const dispatched = poolingNow.reduce((acc, o) => acc + (o.truckCount || 0), 0)
            const statusColor =
                currentPool == null ? '#6b7280' : currentPool < 0 ? '#dc2626' : currentPool < 2 ? '#d97706' : '#16a34a'
            out.push({
                base,
                code: s.code,
                dispatched,
                name: plantNameByCode?.[s.code] || s.code,
                poolNow: currentPool,
                poolingNow,
                statusColor
            })
        })
        return out.sort((a, b) => {
            if (a.poolingNow.length !== b.poolingNow.length) return b.poolingNow.length - a.poolingNow.length
            return (b.dispatched || 0) - (a.dispatched || 0)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        stats,
        poolTimelinesByPlant,
        effectiveMin,
        initialPoolByCode,
        orderSnapshots,
        plantNameByCode,
        plantFilter,
        filterActive
    ])

    const totals = useMemo(() => {
        const totalTrucksNow = activeOrders.reduce((acc, o) => acc + (o.truckCount || 0), 0)
        const totalYardageDone = orderSnapshots
            .filter((o) => o.state === 'done')
            .reduce((acc, o) => acc + (o.yardage || 0), 0)
        const totalYardageInFlight = activeOrders.reduce((acc, o) => acc + (o.yardage || 0) * (o.progress / 100), 0)
        const totalYardageAll = orderSnapshots.reduce((acc, o) => acc + (o.yardage || 0), 0)
        return {
            totalTrucksNow,
            totalYardageAll,
            totalYardageDone: Math.round(totalYardageDone + totalYardageInFlight)
        }
    }, [activeOrders, orderSnapshots])

    const dayProgressPct = totals.totalYardageAll > 0 ? (totals.totalYardageDone / totals.totalYardageAll) * 100 : 0
    const friendlyDate = planDate
        ? new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              weekday: 'short',
              year: 'numeric'
          })
        : ''

    // Unified upcoming event feed — orders, help dispatches, and clock-outs
    // merged into one chronological list for the right-rail timeline.
    const unifiedTimeline = useMemo(() => {
        const events = []
        upcomingOrders.forEach((o) => {
            events.push({
                color: '#d97706',
                icon: 'fa-play',
                id: `o-${o.orderKey}`,
                plantCode: o.plantCode,
                subtitle: `${o.yardage} yd · ${o.truckCount} trucks`,
                time: o.startMin,
                title: `${o.customer || 'Pour'} begins`,
                type: 'order'
            })
        })
        activeOrders.forEach((o) => {
            events.push({
                color: '#16a34a',
                icon: 'fa-flag-checkered',
                id: `e-${o.orderKey}`,
                plantCode: o.plantCode,
                subtitle: `${o.customer || 'Pour'} · ${o.truckCount} trucks`,
                time: o.endMin,
                title: 'Pour wraps up',
                type: 'order-end'
            })
        })
        upcomingHelp.forEach((h) => {
            events.push({
                color: '#3b82f6',
                icon: 'fa-paper-plane',
                id: h.key,
                plantCode: h.fromPlant,
                subtitle: `Help dispatch ${h.fromPlant} → ${h.toPlant}`,
                time: h.time,
                title: 'Help sent',
                type: 'help'
            })
        })
        upcomingSendHome.forEach((s) => {
            events.push({
                color: '#64748b',
                icon: 'fa-house-user',
                id: `sh-${s.plantCode}-${s.time}`,
                plantCode: s.plantCode,
                subtitle: `Send ${s.count} home from ${s.plantCode}`,
                time: s.time,
                title: 'Clock out',
                type: 'clock-out'
            })
        })
        return events
            .filter((e) => Number.isFinite(e.time) && e.time >= effectiveMin)
            .sort((a, b) => a.time - b.time)
            .slice(0, 14)
    }, [upcomingOrders, activeOrders, upcomingHelp, upcomingSendHome, effectiveMin])

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-5 flex flex-col gap-4">
                {/* ── COMMAND BAR ────────────────────────────────────────────
                   One condensed strip combining plant filter + live clock +
                   day progress + scrub. Replaces the old 3-card header stack. */}
                <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-3 flex-wrap px-4 py-3">
                        {/* Plant filter */}
                        <div className="flex items-center gap-2 shrink-0">
                            <i className="fas fa-filter text-[11px]" style={{ color: 'var(--text-tertiary)' }} />
                            <select
                                value={plantFilter}
                                onChange={(e) => setPlantFilter(e.target.value)}
                                className="px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer font-semibold"
                                style={{
                                    background: filterActive ? `${accentColor}14` : 'var(--bg-secondary)',
                                    border: `1px solid ${filterActive ? accentColor : 'var(--border-medium)'}`,
                                    color: filterActive ? accentColor : 'var(--text-primary)',
                                    minWidth: 170
                                }}
                            >
                                <option value="all">All plants · {plantOptions.length}</option>
                                {plantOptions.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                        {plantNameByCode?.[code] ? ` · ${plantNameByCode[code]}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Live clock */}
                        <div className="flex items-center gap-3 shrink-0 sm:ml-auto">
                            <div className="flex items-center gap-2">
                                <span
                                    className="inline-block rounded-full animate-pulse"
                                    style={{
                                        background: clock.isToday && manualTime == null ? '#16a34a' : '#94a3b8',
                                        height: 8,
                                        width: 8
                                    }}
                                />
                                <span
                                    className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{
                                        color: clock.isToday && manualTime == null ? '#16a34a' : 'var(--text-tertiary)'
                                    }}
                                >
                                    {clock.isToday && manualTime == null ? 'Live' : 'Scrubbed'}
                                </span>
                            </div>
                            <div
                                className="font-bold leading-none"
                                style={{
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-heading)',
                                    fontSize: 32,
                                    letterSpacing: '-0.02em'
                                }}
                            >
                                {Number.isFinite(effectiveMin) ? formatClock(effectiveMin) : '--:--'}
                            </div>
                            {clock.isToday && manualTime != null && (
                                <button
                                    type="button"
                                    onClick={() => setManualTime(null)}
                                    className="border-none rounded-md cursor-pointer text-[11px] font-semibold px-2.5 py-1.5"
                                    style={{ background: accentColor, color: '#fff' }}
                                >
                                    <i className="fas fa-bolt mr-1" />
                                    Live
                                </button>
                            )}
                        </div>

                        {/* Day progress (flex-1) */}
                        <div className="flex-1 min-w-[220px] ml-auto sm:ml-4">
                            <div
                                className="flex items-center justify-between text-[10.5px] mb-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                <span className="uppercase tracking-wider font-bold">Day progress</span>
                                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {Math.round(dayProgressPct)}% · {totals.totalYardageDone.toLocaleString()} /{' '}
                                    {totals.totalYardageAll.toLocaleString()} yd
                                </span>
                            </div>
                            <div
                                className="h-2 rounded-full overflow-hidden"
                                style={{ background: 'var(--bg-tertiary)' }}
                            >
                                <div
                                    className="h-full rounded-full transition-[width] duration-500"
                                    style={{ background: accentColor, width: `${dayProgressPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    {/* Scrub track */}
                    <div
                        className="flex items-center gap-3 px-4 py-2"
                        style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}
                    >
                        <span
                            className="text-[9.5px] font-bold uppercase tracking-wider shrink-0"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            Scrub
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={24 * 60 - 1}
                            step={5}
                            value={Number.isFinite(effectiveMin) ? effectiveMin : 12 * 60}
                            onChange={(e) => setManualTime(parseInt(e.target.value, 10))}
                            className="flex-1"
                            style={{ accentColor }}
                        />
                        <span
                            className="font-mono text-[11px] shrink-0 min-w-[44px] text-right"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {friendlyDate || '—'}
                        </span>
                    </div>
                </div>

                {/* Filter chip badge */}
                {filterActive && (
                    <div
                        className="rounded-full px-3 py-1 self-start flex items-center gap-2 text-[11.5px]"
                        style={{
                            background: `${accentColor}14`,
                            border: `1px solid ${accentColor}55`,
                            color: accentColor
                        }}
                    >
                        <i className="fas fa-filter text-[10px]" />
                        <span className="font-semibold">
                            Plant {plantFilter}
                            {plantNameByCode?.[plantFilter] ? ` · ${plantNameByCode[plantFilter]}` : ''}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPlantFilter('all')}
                            className="border-none bg-transparent cursor-pointer"
                            style={{ color: accentColor, opacity: 0.7 }}
                            title="Clear plant filter"
                        >
                            <i className="fas fa-times" />
                        </button>
                    </div>
                )}

                {/* ── STAT STRIP ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <StatChip
                        accent={accentColor}
                        icon="fa-truck"
                        label="Active trucks"
                        sublabel={`${activeOrders.length} pour${activeOrders.length === 1 ? '' : 's'} now`}
                        value={totals.totalTrucksNow}
                    />
                    <StatChip
                        accent="#d97706"
                        icon="fa-hourglass-start"
                        label="Upcoming"
                        sublabel={upcomingOrders[0] ? `next ${formatClock(upcomingOrders[0].startMin)}` : '—'}
                        value={
                            orderSnapshots.filter(
                                (o) => o.state === 'upcoming' && (!filterActive || o.plantCode === plantFilter)
                            ).length
                        }
                    />
                    <StatChip
                        accent="#16a34a"
                        icon="fa-flag-checkered"
                        label="Done"
                        sublabel={`${justFinished.length > 0 ? '+' + justFinished.length : '0'} recent`}
                        value={
                            orderSnapshots.filter(
                                (o) => o.state === 'done' && (!filterActive || o.plantCode === plantFilter)
                            ).length
                        }
                    />
                    <StatChip
                        accent="#8b5cf6"
                        icon="fa-people-arrows"
                        label="Help"
                        sublabel={activeHelp.length ? 'between plants' : 'none active'}
                        value={activeHelp.length}
                    />
                </div>

                {/* ── HERO + TIMELINE ───────────────────────────────────────
                   2-column split: big Live Pours hero on the left, unified
                   upcoming timeline feed on the right. On mobile they stack. */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
                    {/* Live pours hero */}
                    <SectionBlock
                        accent={accentColor}
                        count={activeOrders.length}
                        icon="fa-circle-dot"
                        title="Pouring right now"
                    >
                        {activeOrders.length === 0 ? (
                            <EmptyHint>No pours in progress at this time.</EmptyHint>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activeOrders.map((o) => (
                                    <LivePourCard key={o.orderKey} accent={accentColor} now={effectiveMin} order={o} />
                                ))}
                            </div>
                        )}
                    </SectionBlock>

                    {/* Unified upcoming timeline */}
                    <SectionBlock accent="#d97706" count={unifiedTimeline.length} icon="fa-stream" title="What's next">
                        {unifiedTimeline.length === 0 ? (
                            <EmptyHint>Nothing else scheduled today.</EmptyHint>
                        ) : (
                            <EventFeed events={unifiedTimeline} now={effectiveMin} />
                        )}
                    </SectionBlock>
                </div>

                {/* ── PLANT STATUS GRID ───────────────────────────────────── */}
                <SectionBlock
                    accent={accentColor}
                    count={plantSnapshots.length}
                    icon="fa-industry"
                    rightHint="green = idle capacity · amber = tight · red = overbooked"
                    title={`Plant status · ${formatClock(effectiveMin)}`}
                >
                    {plantSnapshots.length === 0 ? (
                        <EmptyHint>No plants in the current plan.</EmptyHint>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                            {plantSnapshots.map((p) => (
                                <PlantTile key={p.code} plant={p} />
                            ))}
                        </div>
                    )}
                </SectionBlock>

                {/* ── ACTIVITY FOOTER ────────────────────────────────────────
                   Side-by-side: Just finished chip row + Help in motion. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SectionBlock
                        accent="#16a34a"
                        count={justFinished.length}
                        icon="fa-flag-checkered"
                        title="Just finished"
                    >
                        {justFinished.length === 0 ? (
                            <EmptyHint>Nothing has wrapped up yet.</EmptyHint>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {justFinished.map((o) => (
                                    <DoneChip key={o.orderKey} now={effectiveMin} order={o} />
                                ))}
                            </div>
                        )}
                    </SectionBlock>
                    <SectionBlock
                        accent="#8b5cf6"
                        count={activeHelp.length}
                        icon="fa-people-arrows"
                        title="Help in motion"
                    >
                        {activeHelp.length === 0 ? (
                            <EmptyHint>No help transfers in motion right now.</EmptyHint>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {activeHelp.map((h) => (
                                    <span
                                        key={h.key}
                                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                        style={{
                                            background: 'rgba(139, 92, 246, 0.12)',
                                            color: '#6d28d9'
                                        }}
                                        title={`Driver ${h.driverIndex + 1} · arrived ${formatClock(h.arriveMin)} · returns ${
                                            Number.isFinite(h.leaveMin) ? formatClock(h.leaveMin) : '—'
                                        } to ${h.home}`}
                                    >
                                        <i className="fas fa-truck-fast text-[9px]" />
                                        <b>{h.fromPlant}</b>
                                        <i className="fas fa-arrow-right text-[8px] opacity-70" />
                                        <b>{h.toPlant}</b>
                                        {h.home !== h.fromPlant && <span style={{ opacity: 0.6 }}>→ {h.home}</span>}
                                    </span>
                                ))}
                            </div>
                        )}
                    </SectionBlock>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
   Building blocks
   ═══════════════════════════════════════════════════════════════════════ */

function SectionBlock({ accent, children, count, icon, rightHint, title }) {
    return (
        <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                <div
                    className="flex items-center justify-center rounded-md shrink-0"
                    style={{ background: `${accent}14`, color: accent, height: 26, width: 26 }}
                >
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div
                    className="text-[13px] font-bold flex-1 truncate"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {title}
                </div>
                {Number.isFinite(count) && count > 0 && (
                    <span
                        className="inline-flex items-center justify-center rounded-full text-[10.5px] font-bold px-2 min-w-[24px] h-[20px]"
                        style={{ background: `${accent}14`, color: accent }}
                    >
                        {count}
                    </span>
                )}
                {rightHint && (
                    <span className="text-[10.5px] hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>
                        {rightHint}
                    </span>
                )}
            </div>
            <div className="p-3 flex-1 min-h-0">{children}</div>
        </div>
    )
}

function StatChip({ accent, icon, label, sublabel, value }) {
    return (
        <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)'
            }}
        >
            <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{
                    background: `${accent}14`,
                    color: accent,
                    height: 34,
                    width: 34
                }}
            >
                <i className={`fas ${icon} text-[13px]`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span
                        className="font-bold leading-none"
                        style={{
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-heading)',
                            fontSize: 22
                        }}
                    >
                        {value}
                    </span>
                    <span
                        className="text-[9.5px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {label}
                    </span>
                </div>
                {sublabel && (
                    <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {sublabel}
                    </div>
                )}
            </div>
        </div>
    )
}

function EmptyHint({ children }) {
    return (
        <div
            className="text-[12px] italic py-4 text-center rounded-lg"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
        >
            {children}
        </div>
    )
}

/** Big live-pour card — the hero of the page. Shows plant, customer, order
 *  number, yardage, trucks, a thick progress bar and time-remaining in a
 *  dense but scannable layout. */
function LivePourCard({ accent, now, order }) {
    const plantColor = plantBadgeColor(order.plantCode, accent)
    const durationMin = Math.max(1, order.endMin - order.startMin)
    const minsLeft = Math.max(0, Math.round(order.endMin - now))
    const minsInto = Math.max(0, Math.round((now ?? 0) - order.startMin))
    return (
        <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{
                background: `linear-gradient(135deg, ${plantColor}0f 0%, var(--bg-secondary) 60%)`,
                border: `1px solid ${plantColor}33`,
                boxShadow: `0 1px 3px rgba(0,0,0,0.04)`
            }}
        >
            <div className="flex items-center gap-3 px-3.5 pt-3">
                <div
                    className="flex items-center justify-center rounded-lg text-white font-bold shrink-0 relative"
                    style={{
                        background: plantColor,
                        fontFamily: 'var(--font-heading)',
                        fontSize: 14,
                        height: 44,
                        width: 44
                    }}
                >
                    {order.plantCode}
                    <span
                        className="absolute top-0 right-0 rounded-full animate-pulse"
                        style={{
                            background: '#fff',
                            height: 8,
                            transform: 'translate(25%, -25%)',
                            width: 8,
                            boxShadow: `0 0 0 2px ${plantColor}`
                        }}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span
                            className="font-bold text-[13.5px] truncate"
                            style={{ color: 'var(--text-primary)' }}
                            title={order.customer}
                        >
                            {order.customer || 'Unknown customer'}
                        </span>
                        {isBigPourOrder(order.order) && (
                            <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: '#dc2626', color: '#fff' }}
                            >
                                Big
                            </span>
                        )}
                    </div>
                    <div className="text-[10.5px] mt-0.5 font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                        {order.orderNum ? `#${order.orderNum}` : ''}
                        {order.orderNum ? ' · ' : ''}
                        {order.yardage} yd · {order.truckCount} trucks · {order.loadSize}yd loads
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div
                        className="font-bold leading-none"
                        style={{
                            color: plantColor,
                            fontFamily: 'var(--font-heading)',
                            fontSize: 22
                        }}
                    >
                        {Math.round(order.progress)}
                        <span className="text-[13px]">%</span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {minsLeft > 0 ? `~${minsLeft}m left` : 'wrapping up'}
                    </div>
                </div>
            </div>

            {/* Timeline bar */}
            <div className="px-3.5 pb-2 pt-2.5">
                <div
                    className="h-2.5 rounded-full overflow-hidden relative"
                    style={{ background: 'var(--bg-tertiary)' }}
                >
                    <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                            background: `linear-gradient(90deg, ${plantColor} 0%, ${plantColor}cc 100%)`,
                            width: `${order.progress}%`
                        }}
                    />
                </div>
                <div
                    className="flex items-center justify-between text-[10px] mt-1 font-mono"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <span>
                        {formatClock(order.startMin)}
                        <span className="opacity-60"> · +{minsInto}m in</span>
                    </span>
                    <span>
                        <span className="opacity-60">ends </span>
                        {formatClock(order.endMin)}
                    </span>
                </div>
            </div>
        </div>
    )
}

/** Unified chronological feed — orders starting/ending, help transfers, and
 *  clock-out moments merged into one vertical list with a NOW line on top. */
function EventFeed({ events, now }) {
    return (
        <div className="relative">
            <div
                className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold mb-2"
                style={{ color: 'var(--text-tertiary)' }}
            >
                <span
                    className="inline-block rounded-full animate-pulse"
                    style={{ background: '#16a34a', height: 7, width: 7 }}
                />
                NOW · {formatClock(now)}
                <div className="flex-1 h-px ml-1" style={{ background: 'var(--border-light)' }} />
            </div>
            <div className="flex flex-col">
                {events.map((ev, i) => (
                    <FeedRow key={ev.id} event={ev} isLast={i === events.length - 1} now={now} />
                ))}
            </div>
        </div>
    )
}

function FeedRow({ event: ev, isLast, now }) {
    const delta = ev.time - now
    const relative = formatRelative(delta)
    return (
        <div className="flex gap-3 items-stretch">
            {/* Timeline rail */}
            <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                <div
                    className="rounded-full shrink-0"
                    style={{
                        background: ev.color,
                        border: '2px solid var(--bg-primary)',
                        boxShadow: `0 0 0 2px ${ev.color}55`,
                        height: 10,
                        marginTop: 6,
                        width: 10
                    }}
                />
                {!isLast && (
                    <div className="flex-1 w-px mt-1" style={{ background: 'var(--border-light)', minHeight: 14 }} />
                )}
            </div>
            {/* Body */}
            <div className="pb-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className="font-mono text-[11.5px] font-bold shrink-0"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {formatClock(ev.time)}
                    </span>
                    <span
                        className="text-[10px] font-semibold rounded-full px-1.5"
                        style={{ background: `${ev.color}1a`, color: ev.color }}
                    >
                        {relative || '—'}
                    </span>
                    {ev.plantCode && (
                        <span
                            className="inline-flex items-center justify-center rounded font-bold text-white text-[9.5px] shrink-0"
                            style={{
                                background: plantBadgeColor(ev.plantCode, ev.color),
                                height: 16,
                                minWidth: 30
                            }}
                        >
                            {ev.plantCode}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <i className={`fas ${ev.icon} text-[10px]`} style={{ color: ev.color }} />
                    <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {ev.title}
                    </span>
                </div>
                {ev.subtitle && (
                    <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {ev.subtitle}
                    </div>
                )}
            </div>
        </div>
    )
}

/** Compact done-order chip for the horizontal footer row. */
function DoneChip({ now, order }) {
    const plantColor = plantBadgeColor(order.plantCode, '#16a34a')
    return (
        <div
            className="rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px]"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)'
            }}
            title={`${order.customer || 'Unknown'} · ${order.yardage}yd · ended ${formatClock(order.endMin)}`}
        >
            <span
                className="inline-flex items-center justify-center rounded font-bold text-white text-[9.5px]"
                style={{ background: plantColor, height: 16, minWidth: 30 }}
            >
                {order.plantCode}
            </span>
            <span className="font-semibold truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
                {order.customer || 'Unknown'}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>{order.yardage}yd</span>
            <span className="font-semibold" style={{ color: '#16a34a' }}>
                {formatRelative(order.endMin - now)}
            </span>
        </div>
    )
}

/** Compact plant tile — status dot, plant code, pool number front-and-center,
 *  and a mini set of supporting metrics. */
function PlantTile({ plant }) {
    const p = plant
    const overbooked = Number.isFinite(p.poolNow) && p.poolNow < 0
    const tight = Number.isFinite(p.poolNow) && p.poolNow >= 0 && p.poolNow < 2
    const poolDisplay = Number.isFinite(p.poolNow) ? p.poolNow : '—'
    const plantColor = plantBadgeColor(p.code, p.statusColor)
    return (
        <div
            className="rounded-xl p-3 flex items-center gap-3 relative overflow-hidden"
            style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${overbooked ? 'rgba(220,38,38,0.5)' : 'var(--border-light)'}`
            }}
        >
            {/* Status ring around plant badge */}
            <div
                className="relative flex items-center justify-center shrink-0 rounded-full"
                style={{
                    background: `${p.statusColor}14`,
                    border: `2px solid ${p.statusColor}`,
                    height: 48,
                    width: 48
                }}
            >
                <span
                    className="inline-flex items-center justify-center rounded-md font-bold text-white"
                    style={{
                        background: plantColor,
                        fontFamily: 'var(--font-heading)',
                        fontSize: 11,
                        height: 26,
                        minWidth: 36
                    }}
                >
                    {p.code}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span
                        className="font-bold leading-none"
                        style={{
                            color: p.statusColor,
                            fontFamily: 'var(--font-heading)',
                            fontSize: 22
                        }}
                    >
                        {poolDisplay}
                    </span>
                    <span
                        className="text-[9.5px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        idle
                    </span>
                </div>
                <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <b style={{ color: 'var(--text-primary)' }}>{p.poolingNow.length}</b> pouring ·{' '}
                    <b style={{ color: 'var(--text-primary)' }}>{p.dispatched}</b> tr · {p.base} base
                </div>
                {p.poolingNow.length > 0 && (
                    <div
                        className="text-[10px] mt-0.5 truncate"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={p.poolingNow.map((o) => o.customer || '?').join(' · ')}
                    >
                        {p.poolingNow
                            .map((o) => o.customer || `#${o.orderNum || '—'}`)
                            .slice(0, 2)
                            .join(' · ')}
                        {p.poolingNow.length > 2 ? ` · +${p.poolingNow.length - 2}` : ''}
                    </div>
                )}
            </div>
            <span
                className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 shrink-0"
                style={{ background: `${p.statusColor}1a`, color: p.statusColor }}
            >
                {overbooked ? 'Over' : tight ? 'Tight' : 'Good'}
            </span>
        </div>
    )
}

export default PlanRealtimeView
