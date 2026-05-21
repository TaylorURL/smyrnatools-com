import React, { useMemo, useState } from 'react'

import { StatisticsSkeleton } from '../../../app/components/common/PlanSkeletons'
import { PlanStatisticsControls } from '../../../app/components/plan/tabs/statistics/PlanStatisticsControls'
import PlanStatisticsCustomerLookupPage from '../../../app/components/plan/tabs/statistics/PlanStatisticsCustomerLookupPage'
import PlanStatisticsHelpCrossLoadingPage from '../../../app/components/plan/tabs/statistics/PlanStatisticsHelpCrossLoadingPage'
import PlanStatisticsKickersPage from '../../../app/components/plan/tabs/statistics/PlanStatisticsKickersPage'
import { PlanStatisticsKpiStrip } from '../../../app/components/plan/tabs/statistics/PlanStatisticsKpiStrip'
import {
    PlanStatisticsOperatorsPage,
    PlanStatisticsOverviewPage,
    PlanStatisticsProductionPage
} from '../../../app/components/plan/tabs/statistics/PlanStatisticsPages'
import { PlanStatisticsSatisfactionPage } from '../../../app/components/plan/tabs/statistics/PlanStatisticsSatisfactionPage'
import PlanStatisticsServicePage from '../../../app/components/plan/tabs/statistics/PlanStatisticsServicePage'
import {
    PLAN_STATS_SECTIONS,
    PlanStatisticsSectionTabs,
    PlanStatisticsSidebar
} from '../../../app/components/plan/tabs/statistics/PlanStatisticsSidebar'
import { useHelpCrossLoadingStats } from '../../../app/hooks/useHelpCrossLoadingStats'
import { useKickerStats } from '../../../app/hooks/useKickerStats'
import { usePlanStatistics } from '../../../app/hooks/usePlanStatistics'
import { useServiceQualityStats } from '../../../app/hooks/useServiceQualityStats'

/**
 * Statistics dashboard for the Plan tab. Renders a left-rail navigation that
 * routes between dedicated sub-pages (Overview, Yardage, Customer
 * satisfaction, Plants, Operators, Help & Cross-Loading). Each sub-page
 * tailors its layout for one operational question instead of cramming
 * every chart into a single wall of panels.
 *
 * Period / plant / comparison selectors stay above the split and apply
 * globally — every sub-page (including Customer-satisfaction) reads the
 * same active range and comparison window.
 */
function PlanStatisticsView({
    accentColor,
    liveProduction,
    mixerCountsByPlant,
    planColocationMap,
    planDate,
    plantNameByCode
}) {
    const [activeSection, setActiveSection] = useState('overview')
    /** Satisfaction-side memos (per-plant rank, trend, per-day, aggregate) are
     *  the most expensive work the hook does. Only run them when a sub-page
     *  that actually displays satisfaction is mounted — currently Overview
     *  (renders the aggregate summary card) and Satisfaction (full deep-dive
     *  page). The other sub-pages don't read those fields, so computing
     *  them eagerly was running thousands of operations per render for
     *  nothing. */
    const satisfactionEnabled = activeSection === 'satisfaction' || activeSection === 'overview'
    const operatorsEnabled = activeSection === 'operators'
    const helpCrossLoadingEnabled = activeSection === 'helpCrossLoading'
    const plantsEnabled = activeSection === 'production'
    const customerLookupEnabled = activeSection === 'customerLookup'
    const kickersEnabled = activeSection === 'kickers'
    // Service-quality classifier feeds both the Service page and the
    // Customer Lookup page — enable the underlying ticket-detail fetch
    // and the per-order verdict memo whenever either is active.
    const serviceEnabled = activeSection === 'service' || customerLookupEnabled
    const stats = usePlanStatistics({
        colocationMap: planColocationMap,
        helpCrossLoadingEnabled,
        kickersEnabled,
        liveProduction,
        operatorsEnabled,
        planDate,
        plantsEnabled,
        satisfactionEnabled,
        serviceEnabled
    })
    const {
        anchor,
        availablePlantCodes,
        comparison,
        currentDays,
        currentSummary,
        customEnd,
        customStart,
        detailByDay,
        flatOrders,
        isSingleDay,
        loading,
        loadsByOperator,
        operatorRosterCount,
        operatorRosterReady,
        perPlantLoadAttribution,
        perPlantSatisfaction,
        period,
        plansByDate,
        plansLoading,
        previousSatisfactionAggregate,
        previousSummary,
        range,
        satisfactionAggregate,
        satisfactionByWeekday,
        satisfactionLoading,
        satisfactionMomentum,
        satisfactionTrend,
        satisfactionWorstCustomers,
        satisfactionWorstOrders,
        selectedPlant,
        setAnchor,
        setComparison,
        setCustomEnd,
        setCustomStart,
        setPeriod,
        setSelectedPlant,
        trendComparison,
        trendData,
        workingDayCount
    } = stats

    /* Help & cross-loading derivation runs only when the sub-page is
     * mounted. The hook fans out into pair / flow / order rollups from
     * the saved plans + ticket detail map; it's a no-op when those
     * inputs are still loading. */
    const helpCrossLoading = useHelpCrossLoadingStats({
        colocationMap: planColocationMap,
        detailByDay,
        flatOrders,
        plansByDate: helpCrossLoadingEnabled ? plansByDate : {},
        plantNameByCode,
        range,
        selectedPlant
    })

    /* Service-quality derivation — gated to the Service sub-page so
     * the per-order classifier (same one customer-satisfaction uses)
     * doesn't run on every page mount. Returns an empty result when
     * disabled, so the consuming page can still mount safely. */
    const serviceStats = useServiceQualityStats({
        colocationMap: planColocationMap,
        detailByDay,
        enabled: serviceEnabled,
        flatOrders,
        plantNameByCode,
        selectedPlant
    })

    /* Kicker-leaderboard derivation — gated to the Kickers sub-page so
     * the per-order kicker split (same `splitTicketsAtKicker` helper the
     * View Tickets popup uses) doesn't run when another tab is mounted.
     * Returns an empty result when disabled. */
    const kickerStats = useKickerStats({
        colocationMap: planColocationMap,
        detailByDay,
        enabled: kickersEnabled,
        flatOrders,
        selectedPlant
    })

    /** The schedule HTML occasionally lists ghost plant codes (956, 601, 265, …)
     *  that are sentinels or stale entries — not real production plants. The
     *  authoritative list of real plants is `plantNameByCode`, populated from
     *  the `plants` table, so we only surface scorecard / chart rows for
     *  codes that have a name registered there. */
    const knownPlantRows = useMemo(
        () => Object.values(currentSummary.perPlant).filter((p) => Boolean(plantNameByCode?.[p.code])),
        [currentSummary, plantNameByCode]
    )

    const knownPlantSummary = useMemo(() => {
        const totalYardage = knownPlantRows.reduce((sum, p) => sum + (p.yardage || 0), 0)
        const activeCount = knownPlantRows.filter((p) => p.yardage > 0 || p.loads > 0).length
        const top = [...knownPlantRows].sort((a, b) => b.yardage - a.yardage)[0]
        const topShare =
            top && totalYardage > 0 ? { code: top.code, share: top.yardage / totalYardage, yardage: top.yardage } : null
        return { activeCount, topShare, totalYardage }
    }, [knownPlantRows])

    /** Active section's metadata — used for the right-pane header. */
    const sectionMeta = useMemo(
        () => PLAN_STATS_SECTIONS.find((s) => s.id === activeSection) || PLAN_STATS_SECTIONS[0],
        [activeSection]
    )

    /** Each sub-page now owns its own empty + loading state, so we render
     *  the active sub-page unconditionally and pass `loading` + the
     *  derived datasets through. The old "hide everything until scheduleReady"
     *  gate caused tabs to flash blank during refetches. */
    const renderActiveSection = () => {
        const commonProps = {
            accentColor,
            comparison,
            currentDays,
            currentSummary,
            isSingleDay,
            knownPlantRows,
            knownPlantSummary,
            loading,
            mixerCountsByPlant,
            perPlantLoadAttribution,
            plantNameByCode,
            previousSummary,
            range: range.current,
            selectedPlant,
            trendComparison,
            trendData
        }
        if (activeSection === 'satisfaction') {
            return (
                <PlanStatisticsSatisfactionPage
                    accentColor={accentColor}
                    aggregate={satisfactionAggregate}
                    byWeekday={satisfactionByWeekday}
                    loading={satisfactionLoading || loading}
                    momentum={satisfactionMomentum}
                    onSelectPlant={(code) => setSelectedPlant((current) => (current === code ? null : code))}
                    perPlant={perPlantSatisfaction}
                    plantNameByCode={plantNameByCode}
                    previousAggregate={previousSatisfactionAggregate}
                    range={range.current}
                    selectedPlant={selectedPlant}
                    trend={satisfactionTrend}
                    worstCustomers={satisfactionWorstCustomers}
                    worstOrders={satisfactionWorstOrders}
                />
            )
        }
        if (activeSection === 'production') return <PlanStatisticsProductionPage {...commonProps} />
        if (activeSection === 'operators')
            return (
                <PlanStatisticsOperatorsPage
                    {...commonProps}
                    loadsByOperator={loadsByOperator}
                    operatorRosterCount={operatorRosterCount}
                    operatorRosterReady={operatorRosterReady}
                />
            )
        if (activeSection === 'helpCrossLoading') {
            return (
                <PlanStatisticsHelpCrossLoadingPage
                    accentColor={accentColor}
                    colocationMap={planColocationMap}
                    helpByGiverPlant={helpCrossLoading.helpByGiverPlant}
                    kpi={helpCrossLoading.kpi}
                    loading={loading}
                    plantNameByCode={plantNameByCode}
                    plansLoading={plansLoading}
                    range={range.current}
                />
            )
        }
        if (activeSection === 'service') {
            return (
                <PlanStatisticsServicePage
                    accentColor={accentColor}
                    colocationMap={planColocationMap}
                    loading={loading}
                    plansLoading={plansLoading}
                    plantNameByCode={plantNameByCode}
                    serviceLoading={satisfactionLoading}
                    serviceStats={serviceStats}
                />
            )
        }
        if (activeSection === 'customerLookup') {
            return (
                <PlanStatisticsCustomerLookupPage
                    colocationMap={planColocationMap}
                    customerLookupLoading={satisfactionLoading}
                    loading={loading}
                    plansLoading={plansLoading}
                    plantNameByCode={plantNameByCode}
                    serviceStats={serviceStats}
                />
            )
        }
        if (activeSection === 'kickers') {
            return (
                <PlanStatisticsKickersPage
                    colocationMap={planColocationMap}
                    kickerStats={kickerStats}
                    loading={loading || satisfactionLoading}
                    plansLoading={plansLoading}
                    plantNameByCode={plantNameByCode}
                />
            )
        }
        // Overview is the default landing page.
        return (
            <PlanStatisticsOverviewPage
                {...commonProps}
                onSelectSection={setActiveSection}
                satisfactionAggregate={satisfactionAggregate}
                satisfactionLoading={satisfactionLoading}
            />
        )
    }

    /* Hold the layout-matching skeleton through the initial stats fetch so
     * the user never sees an empty controls bar and KPI strip flash before
     * data is in. Sub-pages still own their own `loading` handling for
     * background re-fetches once the first load lands. */
    if (loading && currentDays.length === 0) return <StatisticsSkeleton />
    return (
        <div className="flex-1 min-h-0 overflow-y-auto animate-fade-in-fast" data-content-scroll>
            <div className="px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
                <PlanStatisticsControls
                    accentColor={accentColor}
                    anchor={anchor}
                    availablePlantCodes={availablePlantCodes}
                    comparison={comparison}
                    customEnd={customEnd}
                    customStart={customStart}
                    period={period}
                    plantNameByCode={plantNameByCode}
                    range={range}
                    selectedPlant={selectedPlant}
                    setAnchor={setAnchor}
                    setComparison={setComparison}
                    setCustomEnd={setCustomEnd}
                    setCustomStart={setCustomStart}
                    setPeriod={setPeriod}
                    setSelectedPlant={setSelectedPlant}
                />

                {/* KPI strip stays visible across sections — quick situational
                    awareness even when the user has drilled into a sub-view. */}
                <PlanStatisticsKpiStrip
                    currentSummary={currentSummary}
                    previousSummary={previousSummary}
                    workingDayCount={workingDayCount}
                />

                <PlanStatisticsSectionTabs
                    accentColor={accentColor}
                    activeSection={activeSection}
                    onSelect={setActiveSection}
                />

                {/* Two-column body: left rail navigates sections; right pane
                    shows the active sub-page. The sidebar collapses to the
                    horizontal scroller above the split below md. */}
                <div className="flex gap-4 items-start">
                    <PlanStatisticsSidebar
                        accentColor={accentColor}
                        activeSection={activeSection}
                        onSelect={setActiveSection}
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-3">
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-[15px] font-bold m-0 text-text-primary">{sectionMeta.label}</h2>
                            <span className="text-[11.5px] text-text-tertiary">{sectionMeta.description}</span>
                        </div>

                        {renderActiveSection()}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlanStatisticsView
