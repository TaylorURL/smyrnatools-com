/* eslint-disable max-lines */
import React, { useCallback, useMemo, useRef, useState } from 'react'

import PlanDashboardActivityFeed from '../../../app/components/plan/tabs/dashboard/PlanDashboardActivityFeed'
import { PlanDashboardAtAGlance } from '../../../app/components/plan/tabs/dashboard/PlanDashboardAtAGlance'
import PlanDashboardClockInBoard from '../../../app/components/plan/tabs/dashboard/PlanDashboardClockInBoard'
import {
    PlanInsightsList,
    PlanYardageByPlantList
} from '../../../app/components/plan/tabs/dashboard/PlanDashboardLists'
import { PlanChecklistRow, PlanFlowSummary } from '../../../app/components/plan/tabs/dashboard/PlanDashboardYourScope'
import PlanFlowPreview from '../../../app/components/plan/tabs/dashboard/PlanFlowPreview'
import PlanNotesSection from '../../../app/components/plan/tabs/dashboard/PlanNotesSection'
import { Panel as SharedPanel, Stat as SharedStat } from '../../../app/components/ui/Panel'
import {
    computeDashboardJobCoverage,
    countPlantsWithYardage,
    PLAN_META_KEY,
    readPlanMeta,
    subtractMinutesFromTime,
    sumPlanYardage,
    writePlanMeta
} from '../../../utils/PlanDashboardUtility'

/** Display labels for the contextual "Your X" panel header — flips with
 *  the user's scope kind (plant / district / region / dispatch). */
const YOUR_SECTION_LABELS = {
    dispatch: 'Your Dispatch',
    district: 'Your District',
    plant: 'Your Plant',
    region: 'Your Region'
}

/** Smooth scroll to a section by id within the dashboard's scroll container.
 *  Replaces the previous scrollspy-driven `jumpTo` so the dashboard no
 *  longer needs the scrollspy hook with the side-nav gone. */
const scrollSectionIntoView = (containerRef, id) => {
    const root = containerRef.current
    if (!root) return
    const el = root.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const Card = (props) => <SharedPanel {...props} />

/** Resolve the user's "Your X" scope into the labels and noun the
 *  dashboard surfaces in section titles, alert lines, and empty hints. */
const useYourScope = (yourPlantScope) => {
    const scopePlantCodes = useMemo(
        () => (yourPlantScope?.plantCodes?.length ? yourPlantScope.plantCodes : []),
        [yourPlantScope]
    )
    const scopePlantSet = useMemo(() => new Set(scopePlantCodes), [scopePlantCodes])
    const hasYourScope = scopePlantSet.size > 0
    const yourSectionKind = yourPlantScope?.kind || 'plant'
    const yourSectionLabel = YOUR_SECTION_LABELS[yourSectionKind]
    const yourSectionTitle = yourPlantScope?.label || yourSectionLabel
    const scopeNoun =
        yourSectionKind === 'dispatch'
            ? 'dispatch area'
            : yourSectionKind === 'region'
              ? 'region'
              : yourSectionKind === 'district'
                ? 'district'
                : 'plant'
    return {
        hasYourScope,
        scopeNoun,
        scopePlantCodes,
        scopePlantSet,
        yourSectionKind,
        yourSectionLabel,
        yourSectionTitle
    }
}

/**
 * PlanDashboardView — 3-column daily-plan dashboard.
 *
 * Left: realtime activity feed of trucks loaded + jobs completed, derived
 * from `detailByOrderId` so it updates as `useDetailOrders` polls.
 * Center: stats, personal (plant-manager) dispatch reminders, Special
 * Attention + QC Attention job lists (persisted via plan metadata),
 * insights, yardage breakdown, timeline preview, and notes.
 * Right: at-a-glance snapshot panel with today's plan numbers.
 */
function PlanDashboardView({
    accentColor,
    assignments,
    canEdit = true,
    detailByOrderId,
    earliestClockIn,
    getTravelTime,
    mixerCountsByPlant,
    notes,
    onSwitchToPlanner,
    planDate,
    planInsights,
    plantNameByCode,
    plantProduction,
    plants,
    setNotes,
    setPlantProduction,
    shiftSpanHours,
    stats,
    totalOps,
    validAssignmentCount,
    yourPlantScope
}) {
    const {
        hasYourScope,
        scopeNoun,
        scopePlantCodes,
        scopePlantSet,
        yourSectionKind,
        yourSectionLabel: _yourSectionLabel,
        yourSectionTitle
    } = useYourScope(yourPlantScope)

    const [checked, setChecked] = useState({})
    const toggle = (key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
    const scrollContainerRef = useRef(null)

    const totalYardage = useMemo(() => sumPlanYardage(plantProduction), [plantProduction])
    const plantsWithYardage = useMemo(() => countPlantsWithYardage(plantProduction), [plantProduction])

    const jobCoverage = useMemo(
        () => computeDashboardJobCoverage({ assignments, planDate, plantProduction, stats }),
        [plantProduction, stats, assignments, planDate]
    )
    const totalOperatorsFleet = useMemo(
        () => Object.values(mixerCountsByPlant || {}).reduce((sum, count) => sum + (count || 0), 0),
        [mixerCountsByPlant]
    )

    // Merge `stats` with every plant known to the region so the flow
    // preview mirrors what's on the full Planner tab.
    const allPlantStats = useMemo(() => {
        const existing = new Map(stats.map((stat) => [stat.code, stat]))
        const list = (plants || []).map((plant) => {
            const code = plant.plant_code
            if (existing.has(code)) return existing.get(code)
            const base = mixerCountsByPlant?.[code] || 0
            return { base, code, eff: base, recv: 0, send: 0 }
        })
        stats.forEach((stat) => {
            if (!list.some((entry) => entry.code === stat.code)) list.push(stat)
        })
        return list.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [plants, stats, mixerCountsByPlant])

    const regionPlantCount = (plants || []).length
    const movementPct = totalOperatorsFleet > 0 ? Math.round((totalOps / totalOperatorsFleet) * 100) : 0
    const avgYardagePerPlant = plantsWithYardage > 0 ? Math.round(totalYardage / plantsWithYardage) : 0
    const plantsMissingProduction = Math.max(0, stats.length - plantsWithYardage)

    const meta = readPlanMeta(plantProduction)
    const specialJobs = useMemo(() => meta.specialJobs || [], [meta.specialJobs])
    const qcJobs = useMemo(() => meta.qcJobs || [], [meta.qcJobs])
    const formattedNotes = meta.formattedNotes || null
    const formattedNotesSource = meta.formattedNotesSource ?? null
    const setFormattedNotes = useCallback(
        (formatted, source) => {
            writePlanMeta(setPlantProduction, (prev) => {
                const next = { ...prev }
                if (formatted && source != null) {
                    next.formattedNotes = formatted
                    next.formattedNotesSource = source
                } else {
                    delete next.formattedNotes
                    delete next.formattedNotesSource
                }
                return next
            })
        },
        [setPlantProduction]
    )

    /* ── Scope-aware summary (Plant / District / Region) ────────────
       Outbound/Inbound include intra-scope moves so managers see every
       transfer touching their coverage area — a plant-to-plant move
       inside the same district counts as both outbound and inbound. */
    const myOutbound = useMemo(
        () =>
            hasYourScope
                ? (assignments || []).filter(
                      (a) => a.fromPlant && a.toPlant && a.time && scopePlantSet.has(a.fromPlant)
                  )
                : [],
        [assignments, hasYourScope, scopePlantSet]
    )
    const myInbound = useMemo(
        () =>
            hasYourScope
                ? (assignments || []).filter((a) => a.fromPlant && a.toPlant && a.time && scopePlantSet.has(a.toPlant))
                : [],
        [assignments, hasYourScope, scopePlantSet]
    )
    const outboundOps = myOutbound.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
    const inboundOps = myInbound.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
    const mySpecialJobs = useMemo(
        () => (hasYourScope ? specialJobs.filter((j) => scopePlantSet.has(j.plant)) : []),
        [specialJobs, hasYourScope, scopePlantSet]
    )
    const myQcJobs = useMemo(
        () => (hasYourScope ? qcJobs.filter((j) => scopePlantSet.has(j.plant)) : []),
        [qcJobs, hasYourScope, scopePlantSet]
    )
    const myAlertCount = mySpecialJobs.length + myQcJobs.length

    /** Help-being-sent checklist — one row per outbound route from any
     *  in-scope plant, with travel-time-adjusted depart times. */
    const pmChecklist = useMemo(() => {
        if (!hasYourScope) return []
        return myOutbound.map((assignment, idx) => {
            const travel = getTravelTime?.(assignment.fromPlant, assignment.toPlant)
            const departTime = travel != null ? subtractMinutesFromTime(assignment.time, travel) : null
            const ops = parseInt(assignment.driverCount, 10) || 0
            const originLabel = scopePlantCodes.length > 1 ? `${assignment.fromPlant} → ` : ''
            return {
                key: `dispatch-${idx}-${assignment.fromPlant}-${assignment.toPlant}`,
                subtitle: `${ops} operator${ops === 1 ? '' : 's'} · arrive ${assignment.time}${travel != null ? ` · ${travel}m travel` : ''}`,
                text: `${originLabel}Send help → ${assignment.toPlant}`,
                time: departTime || assignment.time
            }
        })
    }, [getTravelTime, hasYourScope, myOutbound, scopePlantCodes.length])

    const outboundSummary = myOutbound.length
        ? `Sending ${outboundOps} operator${outboundOps === 1 ? '' : 's'} to ${new Set(myOutbound.map((a) => a.toPlant)).size} plant${myOutbound.length === 1 ? '' : 's'}`
        : `No outbound activity from your ${scopeNoun} today`
    const inboundSummary = myInbound.length
        ? `Receiving ${inboundOps} operator${inboundOps === 1 ? '' : 's'} from ${new Set(myInbound.map((a) => a.fromPlant)).size} plant${myInbound.length === 1 ? '' : 's'}`
        : `No inbound activity to your ${scopeNoun} today`

    const hasInsights = planInsights.warnings.length + planInsights.suggestions.length > 0
    const jumpTo = useCallback((id) => scrollSectionIntoView(scrollContainerRef, id), [])

    const senderCount = new Set((assignments || []).filter((a) => a.fromPlant).map((a) => a.fromPlant)).size
    const receiverCount = new Set((assignments || []).filter((a) => a.toPlant).map((a) => a.toPlant)).size
    const routesHint =
        validAssignmentCount > 0
            ? `${senderCount} sender${senderCount === 1 ? '' : 's'} · ${receiverCount} receiver${receiverCount === 1 ? '' : 's'}`
            : 'Nothing scheduled'

    return (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 flex gap-4">
                <PlanDashboardActivityFeed
                    detailByOrderId={detailByOrderId}
                    plantNameByCode={plantNameByCode}
                    plantProduction={plantProduction}
                />

                <div className="flex-1 min-w-0 py-3 sm:py-5 flex flex-col gap-3 sm:gap-5">
                    <section id="overview" className="scroll-mt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 rounded overflow-hidden border border-border-light">
                            <SharedStat
                                label="Operators"
                                value={totalOperatorsFleet.toLocaleString()}
                                hint={totalOps > 0 ? `${totalOps} moving · ${movementPct}%` : 'None moving today'}
                            />
                            <SharedStat
                                label="Plants"
                                value={`${stats.length}/${regionPlantCount || stats.length}`}
                                valueColor={stats.length < regionPlantCount ? '#d97706' : undefined}
                                hint={
                                    stats.length < regionPlantCount
                                        ? `${regionPlantCount - stats.length} not in plan`
                                        : 'All in plan'
                                }
                            />
                            <SharedStat label="Routes" value={validAssignmentCount} hint={routesHint} />
                            <SharedStat
                                label="Yardage"
                                value={totalYardage.toLocaleString()}
                                hint={
                                    plantsMissingProduction > 0
                                        ? `${plantsWithYardage}/${stats.length} reporting · avg ${avgYardagePerPlant}`
                                        : plantsWithYardage > 0
                                          ? `Avg ${avgYardagePerPlant} yd / plant`
                                          : 'No production'
                                }
                                valueColor={
                                    plantsMissingProduction > 0 && plantsWithYardage > 0 ? '#d97706' : undefined
                                }
                            />
                            <SharedStat
                                label="Earliest clock-in"
                                value={earliestClockIn || '—'}
                                valueColor={earliestClockIn ? '#16a34a' : undefined}
                                hint={earliestClockIn ? 'First departure' : 'No routes'}
                            />
                            <SharedStat
                                label="Shift span"
                                value={shiftSpanHours ? `${shiftSpanHours}h` : '—'}
                                valueColor={shiftSpanHours && shiftSpanHours > 10 ? '#d97706' : undefined}
                                hint={
                                    shiftSpanHours
                                        ? shiftSpanHours > 10
                                            ? 'Overtime likely'
                                            : 'Within normal'
                                        : 'No routes'
                                }
                            />
                            <SharedStat
                                label="Overall Job Coverage"
                                value={jobCoverage ? `${jobCoverage.covered}/${jobCoverage.totalJobs}` : '—'}
                                valueColor={
                                    jobCoverage && jobCoverage.needHelp > 0
                                        ? '#d97706'
                                        : jobCoverage
                                          ? '#16a34a'
                                          : undefined
                                }
                                hint={
                                    jobCoverage
                                        ? jobCoverage.needHelp > 0
                                            ? `${jobCoverage.needHelp} need help · ${jobCoverage.deficit} truck${jobCoverage.deficit === 1 ? '' : 's'} short`
                                            : `All covered · ${jobCoverage.surplus} spare`
                                        : 'No production'
                                }
                            />
                        </div>
                    </section>

                    {hasYourScope && (
                        <Card
                            id="my-plant"
                            title={yourSectionTitle}
                            right={
                                onSwitchToPlanner && (
                                    <button
                                        onClick={onSwitchToPlanner}
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer shrink-0 text-white"
                                        style={{ background: accentColor }}
                                        title="Open Planner"
                                    >
                                        <i className="fas fa-project-diagram sm:mr-1" />
                                        <span className="hidden sm:inline">Open Planner</span>
                                    </button>
                                )
                            }
                        >
                            {myAlertCount > 0 && (
                                <div
                                    className="rounded p-3 mb-3 bg-bg-secondary"
                                    style={{ borderLeft: '3px solid #d97706' }}
                                >
                                    <div className="text-[12.5px] mb-1.5 text-text-primary">
                                        <span className="font-semibold">
                                            {myAlertCount} flagged job{myAlertCount === 1 ? '' : 's'}
                                        </span>{' '}
                                        in your {scopeNoun}
                                        {(mySpecialJobs.length > 0 || myQcJobs.length > 0) && (
                                            <span className="text-text-secondary">
                                                {' — '}
                                                {mySpecialJobs.length > 0 && `${mySpecialJobs.length} special`}
                                                {mySpecialJobs.length > 0 && myQcJobs.length > 0 && ', '}
                                                {myQcJobs.length > 0 && `${myQcJobs.length} QC`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {mySpecialJobs.map((job) => (
                                            <button
                                                key={`alert-s-${job.id}`}
                                                onClick={() => jumpTo('special')}
                                                className="text-left text-[12px] border-none cursor-pointer bg-transparent flex items-baseline gap-2 px-0 py-0.5 text-text-secondary"
                                            >
                                                <span className="text-amber-600">•</span>
                                                <span className="flex-1 truncate">{job.title || 'Untitled'}</span>
                                                {job.time && <span className="font-mono text-[11px]">{job.time}</span>}
                                            </button>
                                        ))}
                                        {myQcJobs.map((job) => (
                                            <button
                                                key={`alert-q-${job.id}`}
                                                onClick={() => jumpTo('qc')}
                                                className="text-left text-[12px] border-none cursor-pointer bg-transparent flex items-baseline gap-2 px-0 py-0.5 text-text-secondary"
                                            >
                                                <span className="text-[#7c3aed]">•</span>
                                                <span className="flex-1 truncate">{job.title || 'Untitled'}</span>
                                                {job.time && <span className="font-mono text-[11px]">{job.time}</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-3">
                                <PlanFlowSummary
                                    color="#dc2626"
                                    label="Outbound"
                                    summary={outboundSummary}
                                    routes={myOutbound.map((a) => ({
                                        ops: parseInt(a.driverCount, 10) || 0,
                                        partner: a.toPlant,
                                        prefix: '→',
                                        time: a.time
                                    }))}
                                />
                                <PlanFlowSummary
                                    color="#16a34a"
                                    label="Inbound"
                                    summary={inboundSummary}
                                    routes={myInbound.map((a) => ({
                                        ops: parseInt(a.driverCount, 10) || 0,
                                        partner: a.fromPlant,
                                        prefix: 'from',
                                        time: a.time
                                    }))}
                                />
                            </div>

                            {pmChecklist.length > 0 ? (
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-text-secondary">
                                        <i className="fas fa-clipboard-check text-[10px]" />
                                        Dispatch checklist
                                        <span className="font-normal">
                                            ({Object.values(checked).filter(Boolean).length} / {pmChecklist.length})
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {pmChecklist.map((item) => (
                                            <PlanChecklistRow
                                                key={item.key}
                                                accent={accentColor}
                                                checked={!!checked[item.key]}
                                                onToggle={() => toggle(item.key)}
                                                subtitle={item.subtitle}
                                                text={item.text}
                                                time={item.time}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg p-4 text-center text-[12px] bg-bg-secondary text-text-secondary">
                                    {yourSectionKind === 'plant'
                                        ? 'Your plant isn’t sending operators today.'
                                        : `Nothing being sent outside your ${scopeNoun} today.`}
                                </div>
                            )}
                            {/* Operator clock-in roster — for plant scope it's
                             * a single detailed card; for district/region
                             * scope it grids one card per plant in scope so
                             * the manager sees clock-ins + leave-offs across
                             * their whole coverage area in one place. */}
                            <div className="mt-4">
                                <PlanDashboardClockInBoard
                                    accentColor={accentColor}
                                    kind={yourSectionKind}
                                    planDate={planDate}
                                    plantNameByCode={plantNameByCode}
                                    plantProduction={plantProduction}
                                    scopePlantCodes={scopePlantCodes}
                                    stats={stats}
                                />
                            </div>
                        </Card>
                    )}

                    <Card id="notes" title="Notes">
                        <PlanNotesSection
                            accentColor={accentColor}
                            cachedFormatted={formattedNotes}
                            cachedSource={formattedNotesSource}
                            canEdit={canEdit}
                            notes={notes}
                            onFormattedChange={setFormattedNotes}
                            setNotes={setNotes}
                        />
                    </Card>

                    <Card
                        id="flow-preview"
                        title="Help Routes"
                        right={
                            onSwitchToPlanner && (
                                <button
                                    onClick={onSwitchToPlanner}
                                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer flex items-center gap-1.5 shrink-0 text-white"
                                    style={{ background: accentColor }}
                                    title="Open Planner"
                                >
                                    <i className="fas fa-up-right-from-square text-[9px]" />
                                    <span className="hidden sm:inline">Open Planner</span>
                                </button>
                            )
                        }
                    >
                        <PlanFlowPreview
                            accentColor={accentColor}
                            allPlantStats={allPlantStats}
                            assignments={assignments}
                            onOpenPlanner={onSwitchToPlanner}
                            plantProduction={plantProduction}
                            plants={plants}
                        />
                    </Card>

                    {hasInsights && (
                        <PlanInsightsList warnings={planInsights.warnings} suggestions={planInsights.suggestions} />
                    )}

                    {stats.length > 0 && (
                        <PlanYardageByPlantList
                            accentColor={accentColor}
                            plantProduction={plantProduction}
                            stats={stats}
                            totalYardage={totalYardage}
                        />
                    )}

                    <div className="h-8" />
                </div>

                <PlanDashboardAtAGlance
                    earliestClockIn={earliestClockIn}
                    planDate={planDate}
                    shiftSpanHours={shiftSpanHours}
                    specialCount={specialJobs.length}
                    qcCount={qcJobs.length}
                    totalOps={totalOps}
                    totalYardage={totalYardage}
                    validAssignmentCount={validAssignmentCount}
                />
            </div>
        </div>
    )
}

// PLAN_META_KEY is re-exported for any legacy consumer of this module — the
// canonical home is `src/utils/PlanDashboardUtility.js`.
export { PLAN_META_KEY }
export default PlanDashboardView
