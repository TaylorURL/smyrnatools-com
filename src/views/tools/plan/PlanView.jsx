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
import { getOffsetDate, getTomorrowDate, OVERTIME_THRESHOLD_HOURS } from '../../../utils/PlanUtility'
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
        mixerCountsByPlant,
        notes,
        plantProduction,
        plants,
        refreshTravelTimes,
        regionPlants,
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

export default PlanView
