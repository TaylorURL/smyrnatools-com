import React, { useMemo, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import {
    PlanRealtimeActivePoursTable,
    PlanRealtimeCapacityTable,
    PlanRealtimeNotStartedTable,
    PlanRealtimeRunningBehindTable,
    PlanRealtimeUpcomingStream
} from '../../../app/components/plan/PlanRealtimeTables'
import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import PlantFilterButton from '../../../app/components/ui/PlantFilterButton'
import { useDetailOrders } from '../../../app/hooks/useDetailOrders'
import { useLiveClock } from '../../../app/hooks/useLiveClock'
import {
    buildOrderSnapshots,
    buildPlantSnapshots,
    buildRealtimeKpis,
    buildRealtimePoolModel,
    buildRunningBehindRows,
    buildUpcomingEventFeed,
    buildUpcomingHelpRows,
    REALTIME_SORT_OPTIONS,
    TIME_WINDOW_MIN
} from '../../../utils/PlanRealtimeUtility'
import {
    formatMinutesClock,
    formatPlantFilterDisplay,
    formatRelativeMinutes,
    resolvePlantFilterCodes
} from '../../../utils/PlanRuntimeUtility'

/** Stat color for the live "Status" pill — green only when the user is
 *  looking at today, neutral otherwise. */
const TODAY_GREEN = '#16a34a'
const NOT_TODAY_GRAY = '#94a3b8'

/**
 * Realtime dispatch view. Uses the shared `Panel` / `Stat` / `StatGroup`
 * primitives for the headline numbers and the tabular sections. Anchors
 * to "now" — PlanView snaps the plan date to today whenever this tab is
 * selected.
 *
 * `defaultPlantCode` — when set (user has the `plan.defaultplant`
 * permission AND has a home plant), the view opens pre-filtered to that
 * plant.
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
    const [plantFilter, setPlantFilter] = useState(() => defaultPlantCode || 'all')
    const [sortKey, setSortKey] = useState('priority')

    const clock = useLiveClock()
    const isToday = planDate === clock.todayStr
    const nowMin = clock.nowMin
    const filterActive = plantFilter !== 'all' && plantFilter !== 'All' && plantFilter !== ''

    const detailByOrderId = useDetailOrders(planDate, plantProduction)

    /** Pool simulation snapshot — derived once per plan/assignment change
     *  and shared by every downstream table. */
    const { flatOrders, initialPoolByCode, poolTimeline, poolTimelinesByPlant, sendHomeRows } = useMemo(
        () => buildRealtimePoolModel({ assignments, planDate, plantProduction, stats }),
        [plantProduction, stats, planDate, assignments]
    )

    const plantOptions = useMemo(() => {
        const codes = new Set()
        ;(stats || []).forEach((stat) => stat?.code && codes.add(stat.code))
        flatOrders.forEach((order) => order.plantCode && codes.add(order.plantCode))
        ;(assignments || []).forEach((assignment) => {
            if (assignment?.fromPlant) codes.add(assignment.fromPlant)
            if (assignment?.toPlant) codes.add(assignment.toPlant)
            if (assignment?.returnPlant) codes.add(assignment.returnPlant)
        })
        return Array.from(codes).sort()
    }, [stats, flatOrders, assignments])

    const activeFilterCodes = useMemo(
        () => resolvePlantFilterCodes({ plantFilter, plants, userPlantCode }),
        [plantFilter, plants, userPlantCode]
    )

    const touchesFilter = (codes) => !filterActive || codes.some((code) => activeFilterCodes?.has(code))
    const passesPlant = (order) => !filterActive || activeFilterCodes?.has(order.plantCode)

    const orderSnapshots = useMemo(
        () => buildOrderSnapshots({ detailByOrderId, flatOrders, isToday, nowMin, poolTimeline }),
        [flatOrders, poolTimeline, nowMin, detailByOrderId, isToday]
    )

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

    const notStartedOrders = useMemo(
        () =>
            orderSnapshots
                .filter((o) => o.state === 'not-started' && passesPlant(o))
                .sort((a, b) => a.startMin - b.startMin),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, plantFilter, filterActive]
    )

    const upcomingHelp = useMemo(
        () => buildUpcomingHelpRows({ assignments, nowMin, touchesFilter }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [assignments, nowMin, plantFilter, filterActive]
    )

    const upcomingSendHome = useMemo(
        () =>
            sendHomeRows
                .filter((row) => row.time >= nowMin && row.time - nowMin <= TIME_WINDOW_MIN)
                .filter((row) => !filterActive || activeFilterCodes?.has(row.plantCode))
                .sort((a, b) => a.time - b.time),
        [sendHomeRows, nowMin, filterActive, activeFilterCodes]
    )

    const plantSnapshots = useMemo(
        () =>
            buildPlantSnapshots({
                activeFilterCodes,
                filterActive,
                initialPoolByCode,
                nowMin,
                orderSnapshots,
                plantNameByCode,
                poolTimelinesByPlant,
                sortKey,
                stats
            }),
        [
            stats,
            poolTimelinesByPlant,
            nowMin,
            initialPoolByCode,
            orderSnapshots,
            plantNameByCode,
            filterActive,
            activeFilterCodes,
            sortKey
        ]
    )

    const runningBehind = useMemo(
        () => buildRunningBehindRows({ detailByOrderId, isToday, nowMin, orderSnapshots, passesPlant }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orderSnapshots, detailByOrderId, nowMin, isToday, plantFilter, filterActive]
    )

    const kpis = useMemo(
        () => buildRealtimeKpis({ activeOrders, orderSnapshots, plantSnapshots }),
        [activeOrders, orderSnapshots, plantSnapshots]
    )

    const feed = useMemo(
        () => buildUpcomingEventFeed({ activeOrders, nowMin, upcomingHelp, upcomingOrders, upcomingSendHome }),
        [upcomingOrders, activeOrders, upcomingHelp, upcomingSendHome, nowMin]
    )

    const friendlyDate = clock.nowDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
    })
    const plantFilterDisplay = formatPlantFilterDisplay({
        plantFilter,
        plantNameByCode,
        totalPlantOptions: plantOptions.length
    })

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
                {REALTIME_SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                        Sort: {option.label}
                    </option>
                ))}
            </select>
        </div>
    )

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 lg:px-6 py-5 flex flex-col gap-5">
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
                                style={{ background: isToday ? TODAY_GREEN : NOT_TODAY_GRAY }}
                            />
                            <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                {clock.nowLabel}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>· {friendlyDate}</span>
                        </span>
                    </div>
                    {filterControls}
                </div>

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
                        valueColor={kpis.dayProgressPct >= 80 ? TODAY_GREEN : undefined}
                    />
                    <Stat
                        label="Active plants"
                        value={`${kpis.activePlants}/${plantSnapshots.length}`}
                        hint={kpis.activePlants > 0 ? 'Pouring now' : 'None pouring'}
                    />
                    <Stat
                        label="Status"
                        value={isToday ? 'Live' : 'Off-day'}
                        valueColor={isToday ? TODAY_GREEN : NOT_TODAY_GRAY}
                        hint={isToday ? 'Anchored to now' : 'Not today'}
                    />
                </StatGroup>

                {runningBehind.length > 0 && (
                    <Panel
                        title="Running behind"
                        right={
                            <span className="text-[11px]" style={{ color: '#dc2626' }}>
                                {runningBehind.length} order{runningBehind.length === 1 ? '' : 's'}
                            </span>
                        }
                        innerClassName=""
                    >
                        <PlanRealtimeRunningBehindTable
                            accentColor={accentColor}
                            nowMin={nowMin}
                            plantNameByCode={plantNameByCode}
                            rows={runningBehind}
                        />
                    </Panel>
                )}

                {notStartedOrders.length > 0 && (
                    <Panel
                        title="Scheduled — not pouring yet"
                        right={
                            <span className="text-[11px]" style={{ color: '#d97706' }}>
                                {notStartedOrders.length} order{notStartedOrders.length === 1 ? '' : 's'}
                            </span>
                        }
                        innerClassName=""
                    >
                        <PlanRealtimeNotStartedTable
                            accentColor={accentColor}
                            nowMin={nowMin}
                            plantNameByCode={plantNameByCode}
                            rows={notStartedOrders}
                        />
                    </Panel>
                )}

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
                                        {formatMinutesClock(upcomingOrders[0].startMin)}
                                    </span>{' '}
                                    ({formatRelativeMinutes(upcomingOrders[0].startMin - nowMin)}) ·{' '}
                                    {upcomingOrders[0].plantCode} {upcomingOrders[0].customer || ''}
                                </span>
                            )}
                        </div>
                    ) : (
                        <PlanRealtimeActivePoursTable
                            accentColor={accentColor}
                            nowMin={nowMin}
                            orders={activeOrders}
                            plantNameByCode={plantNameByCode}
                        />
                    )}
                </Panel>

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
                            <PlanRealtimeCapacityTable
                                accentColor={accentColor}
                                nowMin={nowMin}
                                plantNameByCode={plantNameByCode}
                                snapshots={plantSnapshots}
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
                            <PlanRealtimeUpcomingStream
                                accentColor={accentColor}
                                events={feed}
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
                    plants={plants}
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

export default PlanRealtimeView
