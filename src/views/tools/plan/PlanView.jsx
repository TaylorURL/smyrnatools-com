import React, { useEffect, useMemo, useRef, useState } from 'react'

import { PlanSkeleton } from '../../../app/components/common/PlanComponents'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { usePlanActions } from '../../../app/hooks/usePlanActions'
import { usePlanData } from '../../../app/hooks/usePlanData'
import { usePlanInsights } from '../../../app/hooks/usePlanInsights'
import { PlanService } from '../../../services/PlanService'
import { UserService } from '../../../services/UserService'
import { buildYourPlantScope } from '../../../utils/DistrictUtility'
import {
    getOffsetDate,
    getTomorrowDate,
    isCancelledOrder,
    MAX_YPH,
    OVERTIME_THRESHOLD_HOURS,
    TARGET_YPH,
    timeToMinutes
} from '../../../utils/PlanUtility'
import PlanDashboardView from './PlanDashboardView'
import PlanFlowView from './PlanFlowView'
import PlanPlantCard from './PlanPlantCard'
import PlanScheduleView from './PlanScheduleView'
import PlanSettingsModal from './PlanSettingsModal'

/**
 * PlanView — plant-centric dispatch planner.
 *
 * Dispatchers create daily assignment plans: which plant sends operators to which plant,
 * with arrival times, stagger intervals, and custom per-operator
 * overrides. Generates a copyable text summary for dispatch and auto-saves
 * to the database with realtime sync across users.
 */
function PlanView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isDark = preferences.themeMode === 'dark'
    const isMobile = useIsMobile()
    const [planDate, setPlanDate] = useState(getTomorrowDate)
    const hasInitializedDateRef = useRef(false)
    const [viewMode, setViewMode] = useState('flow')
    const [selectedPlant, setSelectedPlant] = useState(null)
    const [productionPopoverPlant, setProductionPopoverPlant] = useState(null)
    const [userPlantCode, setUserPlantCode] = useState('')
    const [userRoleNames, setUserRoleNames] = useState([])
    const [canSeeYourTab, setCanSeeYourTab] = useState(false)

    const {
        adjacentPlans,
        adjacentProduction,
        assignments,
        canEdit,
        dirtyRef,
        getTravelTime,
        isLoading,
        isSchedulesSyncing,
        mixerCountsByPlant,
        notes,
        plantProduction,
        plants,
        refreshSchedule,
        refreshTravelTimes,
        regionPlants,
        scheduleLastSyncedAt,
        setAssignments,
        setNotes,
        setPlantProduction,
        travelTimes,
        userId
    } = usePlanData(planDate)

    const {
        addTravelTime,
        calcClockIn,
        copied,
        copyToClipboard,
        clearPlantProduction,
        newTravelTime,
        removeTravelTime,
        setNewTravelTime,
        setShowSettings,
        showSettings,
        updateAssignment,
        updatePlantProduction
    } = usePlanActions({
        assignments,
        getTravelTime,
        notes,
        planDate,
        refreshTravelTimes,
        setAssignments,
        setNotes,
        setPlantProduction,
        userId
    })

    const { earliestClockIn, planInsights, shiftSpanHours, stats, totalOps, validAssignmentCount } = usePlanInsights({
        assignments,
        calcClockIn,
        getTravelTime,
        mixerCountsByPlant,
        plants,
        travelTimes
    })

    const plantNameByCode = useMemo(() => {
        const out = {}
        ;(plants || []).forEach((p) => {
            if (p?.plant_code) out[p.plant_code] = p.plant_name || null
        })
        return out
    }, [plants])

    /** Plant code → street address lookup for the schedule's route map. */
    const plantAddressByCode = useMemo(() => {
        const out = {}
        ;(plants || []).forEach((p) => {
            if (p?.plant_code && p.plant_address) out[p.plant_code] = p.plant_address
        })
        return out
    }, [plants])

    // On first mount, jump straight to the most recently-saved plan so the
    // user opens where work was last happening instead of always tomorrow.
    // Only adjusts the default once — any subsequent user navigation is kept.
    useEffect(() => {
        if (hasInitializedDateRef.current) return
        let cancelled = false
        PlanService.fetchLatestPlanDate()
            .then((latest) => {
                if (cancelled || hasInitializedDateRef.current) return
                hasInitializedDateRef.current = true
                if (latest) setPlanDate(latest)
            })
            .catch(() => {
                hasInitializedDateRef.current = true
            })
        return () => {
            cancelled = true
        }
    }, [])

    // Fetch the signed-in user's plant code, role names, and `plan.yourtab`
    // permission so the dashboard can surface a role-aware "Your Plant /
    // District / Region" section.
    useEffect(() => {
        if (!userId) {
            setUserPlantCode('')
            setUserRoleNames([])
            setCanSeeYourTab(false)
            return
        }
        let cancelled = false
        Promise.all([
            UserService.getUserPlant(userId).catch(() => null),
            UserService.getUserRoles(userId).catch(() => []),
            UserService.hasPermission(userId, 'plan.yourtab').catch(() => false)
        ]).then(([plantCode, roles, canSee]) => {
            if (cancelled) return
            setUserPlantCode(plantCode || '')
            setUserRoleNames((roles || []).map((r) => r?.name).filter(Boolean))
            setCanSeeYourTab(!!canSee)
        })
        return () => {
            cancelled = true
        }
    }, [userId])

    // Plan data now auto-syncs from the dispatch bucket every 5 minutes
    // (see useScheduleSync inside usePlanData). Users can edit whenever they
    // have permission — no more manual production-import gate.
    const canEditPlan = canEdit

    /** Region-wide totals shown in the overbook bar above the plant strip.
     *  Overbooking is judged ONLY on aggregate capacity — i.e. "even if we
     *  perfectly redistribute operators and trucks across plants, can we
     *  finish today's work without blowing past good KPIs?":
     *   1. Combined YPH > MAX_YPH — total yardage outpaces total operator-hours
     *   2. Loads-per-truck > target — total scheduled loads outpace the fleet
     *  Per-plant overloads are handled visually on the Planner nodes and
     *  intentionally do NOT trip this region-level alarm. Shift span is
     *  informational only. */
    const LOADS_PER_TRUCK_TARGET = 5
    const regionTotals = useMemo(() => {
        let totalYardage = 0
        let totalOperatorHours = 0
        let trucksAvailable = 0
        let trucksScheduled = 0
        let plantsWithProduction = 0
        ;(stats || []).forEach((s) => {
            const prod = plantProduction?.[s.code] || {}
            const orders = Array.isArray(prod.orders) ? prod.orders : []
            const liveOrders = orders.filter((o) => !isCancelledOrder(o))
            // Prefer summing per-order yardage so cancelled orders (start time
            // 17:00 sentinel) are excluded; fall back to the plant-level total
            // only when no order-level data exists yet.
            const orderYardage = liveOrders.reduce((sum, o) => sum + (parseFloat(o.yardage) || 0), 0)
            const yardage = orderYardage > 0 || orders.length > 0 ? orderYardage : parseFloat(prod.totalYardage) || 0
            const firstMins = timeToMinutes(prod.firstJobTime)
            const lastMins = timeToMinutes(prod.lastJobTime)
            const hours =
                firstMins != null && lastMins != null && lastMins > firstMins ? (lastMins - firstMins) / 60 : 0
            totalYardage += yardage
            totalOperatorHours += (s.eff || 0) * hours
            trucksAvailable += s.eff || 0
            if (yardage > 0) plantsWithProduction += 1
            for (const o of liveOrders) trucksScheduled += parseFloat(o?.truckCount) || 0
        })
        const combinedYph = totalOperatorHours > 0 ? Math.round((totalYardage / totalOperatorHours) * 10) / 10 : null
        const loadsPerTruck =
            trucksAvailable > 0 && trucksScheduled > 0
                ? Math.round((trucksScheduled / trucksAvailable) * 10) / 10
                : null
        const overbookedByYph = combinedYph != null && combinedYph > MAX_YPH
        const overbookedByTrucks = loadsPerTruck != null && loadsPerTruck > LOADS_PER_TRUCK_TARGET
        return {
            combinedYph,
            isOverbooked: overbookedByYph || overbookedByTrucks,
            loadsPerTruck,
            loadsPerTruckTarget: LOADS_PER_TRUCK_TARGET,
            overbookedByTrucks,
            overbookedByYph,
            plantsWithProduction,
            totalOperatorHours: Math.round(totalOperatorHours * 10) / 10,
            totalYardage,
            trucksAvailable,
            trucksScheduled
        }
    }, [stats, plantProduction])

    // Role-aware scope: Plant Managers see their plant, District Managers see
    // every plant in their district, General Managers see the whole region.
    const yourPlantScope = useMemo(() => {
        if (!canSeeYourTab) return null
        return buildYourPlantScope({
            plantNameByCode,
            regionPlantCodes: (plants || []).map((p) => p.plant_code).filter(Boolean),
            regionPlants,
            roleNames: userRoleNames,
            userPlantCode
        })
    }, [canSeeYourTab, plantNameByCode, plants, regionPlants, userRoleNames, userPlantCode])

    // Per-plant earliest clock-in (for senders) and earliest arrival (for receivers).
    // Gives each plant card a tangible "when's the first person out / in?" number.
    const { planEarliestArrivalByPlant, planEarliestClockInByPlant } = useMemo(() => {
        const clockIns = {}
        const arrivals = {}
        ;(assignments || []).forEach((a) => {
            if (!a.fromPlant || !a.toPlant || !a.time) return
            const ci = calcClockIn ? calcClockIn(a.time, a.fromPlant, a.toPlant) : null
            if (ci) {
                if (!clockIns[a.fromPlant] || ci < clockIns[a.fromPlant]) clockIns[a.fromPlant] = ci
            }
            if (!arrivals[a.toPlant] || a.time < arrivals[a.toPlant]) arrivals[a.toPlant] = a.time
        })
        return { planEarliestArrivalByPlant: arrivals, planEarliestClockInByPlant: clockIns }
    }, [assignments, calcClockIn])

    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top plan-view"
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
            {/* Header — slim sticky bar */}
            <div
                className="shrink-0 flex items-center gap-3 border-b px-4 py-2.5"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
            >
                <h1 className="text-lg font-bold tracking-tight m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                    Plan
                </h1>
                {/* Date nav — always visible */}
                <div
                    className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1.5 py-1"
                    style={{ backgroundColor: `${accentColor}${isDark ? '30' : '15'}`, color: accentColor }}
                >
                    <button
                        onClick={() => setPlanDate(getOffsetDate(planDate, -1))}
                        className="border-none bg-transparent cursor-pointer p-1 rounded hover:opacity-80"
                        style={{ color: accentColor }}
                        title="Previous day"
                    >
                        <i className="fas fa-chevron-left text-xs" />
                    </button>
                    <button
                        className="relative border-none bg-transparent cursor-pointer px-2 py-0.5 rounded font-semibold text-sm"
                        style={{ color: accentColor }}
                        title="Click to pick date"
                    >
                        {new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        })}
                        <input
                            type="date"
                            value={planDate}
                            onChange={(e) => e.target.value && setPlanDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            style={{ width: '100%', height: '100%' }}
                        />
                    </button>
                    <button
                        onClick={() => setPlanDate(getOffsetDate(planDate, 1))}
                        className="border-none bg-transparent cursor-pointer p-1 rounded hover:opacity-80"
                        style={{ color: accentColor }}
                        title="Next day"
                    >
                        <i className="fas fa-chevron-right text-xs" />
                    </button>
                </div>
                <button
                    onClick={() => setPlanDate(getTomorrowDate())}
                    className="border-none rounded-lg cursor-pointer text-xs font-semibold px-2.5 py-1.5"
                    style={{
                        background:
                            planDate === getTomorrowDate()
                                ? `${accentColor}${isDark ? '30' : '15'}`
                                : 'var(--bg-tertiary)',
                        color: planDate === getTomorrowDate() ? accentColor : 'var(--text-secondary)'
                    }}
                >
                    Tomorrow
                </button>
                <div className="flex-1" />
                {/* Action buttons — compact */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => refreshSchedule?.()}
                        disabled={isSchedulesSyncing}
                        className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-60"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        title={
                            scheduleLastSyncedAt
                                ? `Pull the latest schedule from the dispatch bucket\nLast synced ${scheduleLastSyncedAt.toLocaleTimeString()}`
                                : 'Pull the latest schedule from the dispatch bucket'
                        }
                    >
                        <i className={`fas fa-rotate ${isSchedulesSyncing ? 'fa-spin' : ''}`} />
                        {!isMobile && <span>{isSchedulesSyncing ? 'Syncing…' : 'Refresh'}</span>}
                    </button>
                    <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                        style={{
                            backgroundColor: copied ? '#16a34a' : 'var(--bg-tertiary)',
                            color: copied ? '#fff' : 'var(--text-secondary)'
                        }}
                        title="Copy plan to clipboard"
                    >
                        <i className={`fas fa-${copied ? 'check' : 'copy'}`} />
                        {!isMobile && <span>{copied ? 'Copied' : 'Copy Plan'}</span>}
                    </button>
                    {canEdit && (
                        <>
                            <button
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            'Clear all production data? It will be re-synced from the bucket within 5 minutes.'
                                        )
                                    )
                                        clearPlantProduction()
                                }}
                                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                title="Clear production data (will re-sync from bucket within 5 min)"
                            >
                                <i className="fas fa-eraser" />
                                {!isMobile && <span>Clear Production</span>}
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                                style={{
                                    backgroundColor: showSettings ? accentColor : 'var(--bg-tertiary)',
                                    color: showSettings ? '#fff' : 'var(--text-secondary)'
                                }}
                                title="Travel time settings"
                            >
                                <i className="fas fa-cog" />
                            </button>
                        </>
                    )}
                </div>
                {/* View mode toggle */}
                <div
                    className="flex items-center rounded-lg p-0.5"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
                >
                    {[
                        { mode: 'flow', icon: 'fa-project-diagram', label: 'Planner' },
                        { mode: 'schedule', icon: 'fa-calendar-days', label: 'Schedule' },
                        { mode: 'dashboard', icon: 'fa-gauge-high', label: 'Plan' }
                    ].map(({ mode, icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className="flex items-center gap-1.5 rounded-md text-xs font-semibold border-none cursor-pointer px-2.5 py-1.5"
                            style={{
                                backgroundColor: viewMode === mode ? accentColor : 'transparent',
                                color: viewMode === mode ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            <i className={`fas ${icon}`} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div
                className="global-content-container content-container"
                style={{ overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            >
                {isLoading ? (
                    <PlanSkeleton />
                ) : (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        {/* Read-only banner for users without plan.edit */}
                        {!canEdit && (
                            <div
                                className="flex items-center gap-2 px-4 py-2 text-xs font-medium border-b shrink-0"
                                style={{
                                    background: `${accentColor}10`,
                                    borderColor: 'var(--border-light)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                <i className="fas fa-lock text-[10px]" />
                                <span>View only — you need permission to make changes</span>
                            </div>
                        )}

                        {/* Production-required gate removed — useScheduleSync auto-imports
                            production from the dispatch bucket every 5 minutes, so edits
                            are no longer blocked waiting for a manual upload. */}

                        {showSettings && (
                            <PlanSettingsModal
                                accentColor={accentColor}
                                plants={plants}
                                travelTimes={travelTimes}
                                newTravelTime={newTravelTime}
                                setNewTravelTime={setNewTravelTime}
                                addTravelTime={addTravelTime}
                                removeTravelTime={removeTravelTime}
                                onClose={() => setShowSettings(false)}
                            />
                        )}

                        {/* Region totals — combined yardage, trucks have / need,
                            and combined YPH so dispatch can see at a glance whether
                            today is overbooked across the whole region. */}
                        <RegionTotalsBar
                            accentColor={accentColor}
                            shiftSpanHours={shiftSpanHours}
                            totals={regionTotals}
                        />

                        {/* Plant Strip — horizontal cards, visible in all modes */}
                        <div
                            className="shrink-0 flex items-center gap-2 overflow-x-auto px-4 py-2 border-b"
                            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}
                        >
                            <span
                                className="text-[9px] font-semibold uppercase tracking-wider shrink-0 mr-1"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Plants
                            </span>
                            {stats.map((s) => {
                                const isSelected = selectedPlant === s.code
                                const isPopoverOpen = productionPopoverPlant === s.code
                                return (
                                    <PlanPlantCard
                                        key={s.code}
                                        accentColor={accentColor}
                                        stat={s}
                                        plantName={plantNameByCode[s.code]}
                                        production={plantProduction[s.code] || {}}
                                        earliestClockIn={planEarliestClockInByPlant[s.code]}
                                        earliestArrival={planEarliestArrivalByPlant[s.code]}
                                        isSelected={isSelected}
                                        isPopoverOpen={isPopoverOpen}
                                        onSelect={() => {
                                            setSelectedPlant(s.code)
                                            setProductionPopoverPlant(null)
                                        }}
                                        onTogglePopover={() => setProductionPopoverPlant(isPopoverOpen ? null : s.code)}
                                        updatePlantProduction={updatePlantProduction}
                                    />
                                )
                            })}
                            {selectedPlant && (
                                <button
                                    onClick={() => {
                                        setSelectedPlant(null)
                                        setProductionPopoverPlant(null)
                                    }}
                                    className="shrink-0 border-none rounded-md cursor-pointer text-[10px] font-semibold px-2 py-1"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                >
                                    <i className="fas fa-times mr-1" />
                                    Clear
                                </button>
                            )}
                            <div className="flex-1" />
                            <span
                                className="shrink-0 text-[11px] font-medium whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {validAssignmentCount} route{validAssignmentCount !== 1 ? 's' : ''}, {totalOps} op
                                {totalOps !== 1 ? 's' : ''}
                                {earliestClockIn && (
                                    <>
                                        {' '}
                                        · <span className="font-bold text-[#16a34a]">{earliestClockIn}</span> earliest
                                    </>
                                )}
                                {shiftSpanHours && (
                                    <>
                                        {' '}
                                        ·{' '}
                                        <span
                                            className={
                                                shiftSpanHours > OVERTIME_THRESHOLD_HOURS
                                                    ? 'font-bold text-[#ef4444]'
                                                    : ''
                                            }
                                        >
                                            {shiftSpanHours}h span
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>

                        {viewMode === 'dashboard' && (
                            <PlanDashboardView
                                accentColor={accentColor}
                                assignments={assignments}
                                calcClockIn={calcClockIn}
                                canEdit={canEditPlan}
                                earliestClockIn={earliestClockIn}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                notes={notes}
                                onSwitchToPlanner={() => setViewMode('flow')}
                                planDate={planDate}
                                planInsights={planInsights}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plants}
                                setNotes={setNotes}
                                setPlantProduction={setPlantProduction}
                                shiftSpanHours={shiftSpanHours}
                                stats={stats}
                                totalOps={totalOps}
                                validAssignmentCount={validAssignmentCount}
                                yourPlantScope={yourPlantScope}
                            />
                        )}

                        {viewMode === 'flow' && (
                            <PlanFlowView
                                accentColor={accentColor}
                                assignments={assignments}
                                calcClockIn={calcClockIn}
                                canEdit={canEditPlan}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                plantProduction={plantProduction}
                                plants={plants}
                                setAssignments={setAssignments}
                                stats={stats}
                                updateAssignment={updateAssignment}
                                onSwitchToPlanner={() => setViewMode('dashboard')}
                            />
                        )}

                        {viewMode === 'schedule' && (
                            <PlanScheduleView
                                accentColor={accentColor}
                                onSwitchToPlanner={() => setViewMode('flow')}
                                plantAddressByCode={plantAddressByCode}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plants}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Region totals bar ──────────────────────────────────────────────────── */

const yphColor = (yph) => {
    if (yph == null) return null
    if (yph > MAX_YPH) return '#dc2626'
    if (yph < TARGET_YPH - 0.3) return '#d97706'
    return '#16a34a'
}

function RegionTotalCell({ accent, color, hint, icon, label, value, valueColor, warning }) {
    return (
        <div
            className="rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0"
            style={{
                background: warning ? `${color || '#dc2626'}12` : 'var(--bg-primary)',
                border: `1px solid ${warning ? `${color || '#dc2626'}66` : 'var(--border-light)'}`
            }}
        >
            <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{
                    background: warning ? color || '#dc2626' : `${accent}14`,
                    color: warning ? '#fff' : accent
                }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex flex-col leading-tight">
                <span
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {label}
                </span>
                <span
                    className="text-[14px] font-bold font-mono"
                    style={{
                        color: valueColor || 'var(--text-primary)',
                        fontFamily: 'var(--font-heading)'
                    }}
                >
                    {value}
                </span>
                {hint && (
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {hint}
                    </span>
                )}
            </div>
        </div>
    )
}

function RegionTotalsBar({ accentColor, shiftSpanHours, totals }) {
    const {
        combinedYph,
        isOverbooked,
        loadsPerTruck,
        loadsPerTruckTarget,
        overbookedByTrucks,
        overbookedByYph,
        plantsWithProduction,
        totalOperatorHours,
        totalYardage,
        trucksAvailable,
        trucksScheduled
    } = totals
    const yphFg = yphColor(combinedYph)
    const overSpan = !!shiftSpanHours && shiftSpanHours > OVERTIME_THRESHOLD_HOURS
    const reasons = [
        overbookedByYph && `Combined YPH ${combinedYph} > ${MAX_YPH} — no operator redistribution can fix it`,
        overbookedByTrucks && `${loadsPerTruck} loads/truck > ${loadsPerTruckTarget} — fleet at capacity`
    ].filter(Boolean)
    return (
        <div
            className="shrink-0 flex items-center gap-2 overflow-x-auto px-4 py-2 border-b"
            style={{
                background: isOverbooked ? 'linear-gradient(90deg, #fee2e240, #fef3c740)' : 'var(--bg-primary)',
                borderColor: isOverbooked ? '#fbbf24' : 'var(--border-light)'
            }}
        >
            <span
                className="text-[9px] font-semibold uppercase tracking-wider shrink-0 mr-1"
                style={{ color: 'var(--text-secondary)' }}
            >
                Region today
            </span>

            <RegionTotalCell
                accent={accentColor}
                icon="fa-cubes"
                label="Total yardage"
                value={totalYardage > 0 ? totalYardage.toLocaleString() : '—'}
                hint={
                    plantsWithProduction > 0
                        ? `${plantsWithProduction} plant${plantsWithProduction === 1 ? '' : 's'} reporting`
                        : undefined
                }
            />

            <RegionTotalCell
                accent={accentColor}
                color="#dc2626"
                icon="fa-truck"
                label="Trucks"
                value={trucksAvailable > 0 ? String(trucksAvailable) : '—'}
                hint={
                    trucksScheduled > 0
                        ? `${trucksScheduled} loads scheduled`
                        : trucksAvailable > 0
                          ? 'no loads scheduled'
                          : undefined
                }
            />

            <RegionTotalCell
                accent={accentColor}
                color="#dc2626"
                icon="fa-arrows-rotate"
                label="Loads / truck"
                value={loadsPerTruck != null ? loadsPerTruck.toFixed(1) : '—'}
                valueColor={overbookedByTrucks ? '#dc2626' : undefined}
                hint={loadsPerTruck != null ? `target ≤ ${loadsPerTruckTarget}` : undefined}
                warning={overbookedByTrucks}
            />

            <RegionTotalCell
                accent={accentColor}
                color="#dc2626"
                icon="fa-gauge-high"
                label="Combined YPH"
                value={combinedYph != null ? combinedYph.toFixed(1) : '—'}
                valueColor={yphFg || undefined}
                hint={totalOperatorHours > 0 ? `${totalOperatorHours} op-hours · target ${TARGET_YPH}` : undefined}
                warning={overbookedByYph}
            />

            <RegionTotalCell
                accent={accentColor}
                icon="fa-hourglass-half"
                label="Shift span"
                value={shiftSpanHours ? `${shiftSpanHours}h` : '—'}
                valueColor={overSpan ? '#d97706' : undefined}
                hint={overSpan ? `${OVERTIME_THRESHOLD_HOURS}h+ — overtime likely` : undefined}
            />

            <div className="flex-1" />

            {isOverbooked ? (
                <div
                    className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold plan-overbook-pill"
                    style={{ background: '#dc2626', color: '#fff' }}
                    title={reasons.join(' · ')}
                >
                    <i className="fas fa-triangle-exclamation text-[12px] plan-overbook-icon" />
                    OVERBOOKED
                    <span className="opacity-90 font-normal hidden md:inline">· {reasons.join(' · ')}</span>
                </div>
            ) : totalYardage > 0 || trucksAvailable > 0 ? (
                <div
                    className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={{ background: '#16a34a14', color: '#16a34a' }}
                >
                    <i className="fas fa-check-circle text-[12px]" />
                    Within capacity
                </div>
            ) : null}
        </div>
    )
}

export default PlanView
