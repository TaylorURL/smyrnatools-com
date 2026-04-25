import React, { useEffect, useMemo, useRef, useState } from 'react'

import { PlanTabSkeleton } from '../../../app/components/common/PlanSkeletons'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { usePlanActions } from '../../../app/hooks/usePlanActions'
import { usePlanData } from '../../../app/hooks/usePlanData'
import { usePlanInsights } from '../../../app/hooks/usePlanInsights'
import { PlanService } from '../../../services/PlanService'
import { UserService } from '../../../services/UserService'
import { buildYourPlantScope } from '../../../utils/DistrictUtility'
import {
    buildAssignmentDriverTimes,
    getOffsetDate,
    getTodayDate,
    getTomorrowDate,
    isCancelledOrder,
    MAX_YPH,
    OVERTIME_THRESHOLD_HOURS,
    TARGET_YPH,
    timeToMinutes
} from '../../../utils/PlanUtility'

const SCHEDULE_STALE_THRESHOLD_MS = 30 * 60 * 1000

/** Returns dateStr if it isn't a Sunday; otherwise advances by `direction`
 *  (+1 = forward, -1 = backward) until a non-Sunday is reached. Used so the
 *  Plan date selector skips Sundays entirely (no plans are made on Sundays). */
const skipSundayDate = (dateStr, direction = 1) => {
    if (!dateStr) return dateStr
    const step = direction < 0 ? -1 : 1
    let d = new Date(dateStr + 'T00:00:00')
    while (d.getDay() === 0) d.setDate(d.getDate() + step)
    return d.toISOString().split('T')[0]
}

/** Same direction as getOffsetDate, but lands on the next non-Sunday. */
const offsetDateSkipSunday = (dateStr, offset) => skipSundayDate(getOffsetDate(dateStr, offset), offset)
import PlanDashboardView from './PlanDashboardView'
import PlanDemandView from './PlanDemandView'
import PlanFlowView from './PlanFlowView'
import PlanRealtimeView from './PlanRealtimeView'
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
    const [planDate, setPlanDate] = useState(() => skipSundayDate(getTomorrowDate(), 1))
    const hasInitializedDateRef = useRef(false)
    const [viewMode, setViewModeRaw] = useState('dashboard')
    // Switching to Realtime always snaps the plan date to today so the live
    // clock has something to anchor to. Other tabs leave the date untouched.
    // Mobile users get the Schedule view only — Planner and Plan tabs depend on
    // wide layouts (zoomable canvas, sticky scrollspy) that don't fit a phone.
    const setViewMode = (mode) => {
        if (mode === 'realtime') setPlanDate(getTodayDate())
        setViewModeRaw(mode)
    }
    const effectiveViewMode = isMobile ? 'schedule' : viewMode
    // While the realtime tab is active, force planDate to today on every render
    // and re-check once a minute so the date snaps forward when the day rolls
    // over without requiring a tab switch.
    useEffect(() => {
        if (effectiveViewMode !== 'realtime') return undefined
        const snap = () => {
            const today = getTodayDate()
            setPlanDate((prev) => (prev === today ? prev : today))
        }
        snap()
        const interval = setInterval(snap, 60_000)
        return () => clearInterval(interval)
    }, [effectiveViewMode])
    const [selectedPlant, setSelectedPlant] = useState(null)
    const [productionPopoverPlant, setProductionPopoverPlant] = useState(null)
    const [userPlantCode, setUserPlantCode] = useState('')
    const [hasDefaultPlantPermission, setHasDefaultPlantPermission] = useState(false)
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
        scheduleFileUpdatedAt,
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

    // Enrich the base plant list with district memberships from the region
    // service so PlantDropdownModal can render the same district groupings
    // the rest of the app shows. Without this merge the plan tabs render an
    // empty Districts section in the picker.
    const plantsWithDistricts = useMemo(() => {
        if (!regionPlants?.length) return plants || []
        const districtsByCode = {}
        regionPlants.forEach((rp) => {
            const code = rp.plantCode || rp.plant_code
            if (code && rp.districts?.length) districtsByCode[code] = rp.districts
        })
        return (plants || []).map((p) =>
            districtsByCode[p.plant_code] ? { ...p, districts: districtsByCode[p.plant_code] } : p
        )
    }, [plants, regionPlants])

    /**
     * Plant-manager dispatch text. One line per help route — where to send
     * trucks, how many, when each arrives, whether they're loading for a
     * specific job at the destination, and where they return after.
     */
    const handleCopyPlan = () => {
        const dateLabel = planDate
            ? new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  weekday: 'short'
              })
            : ''
        const lines = [`Plan ${dateLabel || planDate}`]

        const validAssignments = (assignments || []).filter(
            (a) => a.fromPlant && a.toPlant && (parseInt(a.driverCount, 10) || 0) > 0
        )
        if (validAssignments.length === 0) {
            lines.push('No help routes — keep trucks at home plant.')
            return lines.join('\n').trim()
        }

        const formatHHMM = (mins) => {
            if (!Number.isFinite(mins)) return null
            const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
            const h = Math.floor(wrapped / 60)
            const m = Math.round(wrapped % 60)
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }

        validAssignments.forEach((a) => {
            const count = parseInt(a.driverCount, 10) || 0
            const noun = count === 1 ? 'truck' : 'trucks'

            const driverTimes = buildAssignmentDriverTimes(a)
            const arriveTimes = driverTimes.map((dt) => formatHHMM(dt.arriveMin)).filter(Boolean)
            const uniqueArrive = Array.from(new Set(arriveTimes))
            const arriveFrag =
                uniqueArrive.length === 0
                    ? ''
                    : uniqueArrive.length === 1
                      ? ` arrive ${uniqueArrive[0]}`
                      : ` arrive ${uniqueArrive.join(', ')}`

            // Mention the destination job when this route is loading directly
            // for a specific order at the destination plant.
            let jobFrag = ''
            if (a.forOrderId) {
                const destOrders = plantProduction?.[a.toPlant]?.orders || []
                const job = destOrders.find((o) => (o.orderId || o.orderNum) === a.forOrderId)
                if (job) {
                    const tag = job.orderNum ? `#${job.orderNum}` : job.startTime || 'job'
                    const customer = job.customer ? ` ${String(job.customer).trim()}` : ''
                    jobFrag = ` for ${tag}${customer}`
                }
            }

            // Return-plant: where the trucks go after the help is done.
            // Default is the from-plant; only call out an override.
            const home = a.returnPlant || a.fromPlant
            const leaveTimes = driverTimes.map((dt) => formatHHMM(dt.leaveMin)).filter(Boolean)
            const uniqueLeave = Array.from(new Set(leaveTimes))
            const leaveFrag = uniqueLeave.length > 0 ? ` ${uniqueLeave.join('/')}` : ''
            const returnFrag =
                home !== a.fromPlant ? `, then to ${home}${leaveFrag}` : leaveFrag ? `, leave${leaveFrag}` : ''

            lines.push(`${a.fromPlant} → ${a.toPlant}: ${count} ${noun}${arriveFrag}${jobFrag}${returnFrag}`)
        })

        return lines.join('\n').trim()
    }

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
            setHasDefaultPlantPermission(false)
            return
        }
        let cancelled = false
        Promise.all([
            UserService.getUserPlant(userId).catch(() => null),
            UserService.getUserRoles(userId).catch(() => []),
            UserService.hasPermission(userId, 'plan.yourtab').catch(() => false),
            UserService.hasPermission(userId, 'plan.defaultplant').catch(() => false)
        ]).then(([plantCode, roles, canSee, hasDefaultPlant]) => {
            if (cancelled) return
            setUserPlantCode(plantCode || '')
            setUserRoleNames((roles || []).map((r) => r?.name).filter(Boolean))
            setCanSeeYourTab(!!canSee)
            setHasDefaultPlantPermission(!!hasDefaultPlant)
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
            {/* Header — slim sticky bar. Wraps on narrow viewports so the
                settings / action buttons never clip off the right edge. */}
            <div
                className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
            >
                <h1 className="text-lg font-bold tracking-tight m-0 shrink-0" style={{ color: 'var(--text-primary)' }}>
                    Plan
                </h1>
                {/* Date nav — hidden on the realtime tab. Realtime is anchored
                    to "right now", so a date selector is misleading. The
                    effect below keeps planDate snapped to today while the user
                    is on this tab, even if the day rolls over. */}
                {effectiveViewMode === 'realtime' ? (
                    <div
                        className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-2.5 py-1"
                        style={{ backgroundColor: `${accentColor}${isDark ? '30' : '15'}`, color: accentColor }}
                        title="Realtime is locked to today"
                    >
                        <i className="fas fa-circle-dot text-[10px]" />
                        <span>
                            Today ·{' '}
                            {new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </span>
                    </div>
                ) : (
                    <>
                        <div
                            className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1.5 py-1"
                            style={{ backgroundColor: `${accentColor}${isDark ? '30' : '15'}`, color: accentColor }}
                        >
                            <button
                                onClick={() => setPlanDate(offsetDateSkipSunday(planDate, -1))}
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
                                    onChange={(e) => e.target.value && setPlanDate(skipSundayDate(e.target.value, 1))}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </button>
                            <button
                                onClick={() => setPlanDate(offsetDateSkipSunday(planDate, 1))}
                                className="border-none bg-transparent cursor-pointer p-1 rounded hover:opacity-80"
                                style={{ color: accentColor }}
                                title="Next day"
                            >
                                <i className="fas fa-chevron-right text-xs" />
                            </button>
                        </div>
                        <button
                            onClick={() => setPlanDate(skipSundayDate(getTomorrowDate(), 1))}
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
                    </>
                )}
                <div className="flex-1 min-w-[8px]" />
                {/* Action buttons — compact. Kept together and allowed to wrap
                    to a second row on narrow mobile so the settings cog
                    stays inside the viewport. */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
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
                        onClick={() => copyToClipboard(handleCopyPlan())}
                        className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2"
                        style={{
                            backgroundColor: copied ? '#16a34a' : 'var(--bg-tertiary)',
                            color: copied ? '#fff' : 'var(--text-secondary)'
                        }}
                        title="Copy a full plan briefing — assignments, per-plant orders, help routes, send-home and slot recommendations, notes."
                    >
                        <i className={`fas fa-${copied ? 'check' : 'copy'}`} />
                        {!isMobile && <span>{copied ? 'Copied' : 'Copy Plan'}</span>}
                    </button>
                    {canEdit && (
                        <>
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
                {/* View mode toggle — Planner & Plan are desktop-only.
                    Mobile users always land on Schedule. */}
                {!isMobile && (
                    <div
                        className="flex items-center rounded-lg p-0.5"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
                    >
                        {[
                            { mode: 'dashboard', icon: 'fa-gauge-high', label: 'Plan Dashboard' },
                            { mode: 'schedule', icon: 'fa-calendar-days', label: 'Schedule' },
                            { mode: 'flow', icon: 'fa-project-diagram', label: 'Planner' },
                            { mode: 'demand', icon: 'fa-chart-column', label: 'Demand' },
                            { mode: 'realtime', icon: 'fa-circle-dot', label: 'Realtime' }
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
                )}
            </div>
            <div
                className="global-content-container content-container"
                style={{ overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            >
                {isLoading ? (
                    <PlanTabSkeleton mode={effectiveViewMode} />
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

                        {/* Stale-schedule warning — the dispatch workstation pushes a fresh
                            HTML every 5 min; if we haven't seen a new upload in 30+ min the
                            workstation/Tampermonkey is likely offline. */}
                        {scheduleFileUpdatedAt &&
                            Date.now() - scheduleFileUpdatedAt.getTime() > SCHEDULE_STALE_THRESHOLD_MS && (
                                <div
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b shrink-0"
                                    style={{
                                        background: '#fef3c7',
                                        borderColor: '#fcd34d',
                                        color: '#92400e'
                                    }}
                                >
                                    <i className="fas fa-triangle-exclamation text-[11px]" />
                                    <span>
                                        Schedule hasn&apos;t been updated since{' '}
                                        {scheduleFileUpdatedAt.toLocaleString([], {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}{' '}
                                        — dispatch workstation may be offline.
                                    </span>
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

                        {effectiveViewMode === 'dashboard' && (
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

                        {effectiveViewMode === 'flow' && (
                            <PlanFlowView
                                accentColor={accentColor}
                                assignments={assignments}
                                calcClockIn={calcClockIn}
                                canEdit={canEditPlan}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                planDate={planDate}
                                plantProduction={plantProduction}
                                plants={plants}
                                setAssignments={setAssignments}
                                setPlantProduction={setPlantProduction}
                                stats={stats}
                                updateAssignment={updateAssignment}
                                onSwitchToPlanner={() => setViewMode('dashboard')}
                            />
                        )}

                        {effectiveViewMode === 'schedule' && (
                            <PlanScheduleView
                                accentColor={accentColor}
                                adjacentProduction={adjacentProduction}
                                assignments={assignments}
                                isMobile={isMobile}
                                onSwitchToPlanner={isMobile ? null : () => setViewMode('flow')}
                                planDate={planDate}
                                plantAddressByCode={plantAddressByCode}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plants}
                                stats={stats}
                            />
                        )}

                        {effectiveViewMode === 'demand' && (
                            <PlanDemandView
                                accentColor={accentColor}
                                planDate={planDate}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plantsWithDistricts}
                                stats={stats}
                                userPlantCode={userPlantCode}
                            />
                        )}

                        {effectiveViewMode === 'realtime' && (
                            <PlanRealtimeView
                                accentColor={accentColor}
                                assignments={assignments}
                                defaultPlantCode={hasDefaultPlantPermission ? userPlantCode : ''}
                                planDate={planDate}
                                plantNameByCode={plantNameByCode}
                                plantProduction={plantProduction}
                                plants={plantsWithDistricts}
                                stats={stats}
                                userPlantCode={userPlantCode}
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
