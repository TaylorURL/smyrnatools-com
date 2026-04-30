import React, { useMemo, useState } from 'react'

import { PlanStatisticsControls } from '../../../app/components/plan/PlanStatisticsControls'
import { PlanStatisticsKpiStrip } from '../../../app/components/plan/PlanStatisticsKpiStrip'
import {
    PlanStatisticsBigPoursPage,
    PlanStatisticsCustomersPage,
    PlanStatisticsOverviewPage,
    PlanStatisticsPlantsPage,
    PlanStatisticsYardagePage
} from '../../../app/components/plan/PlanStatisticsPages'
import { PlanStatisticsSatisfactionPage } from '../../../app/components/plan/PlanStatisticsSatisfactionPage'
import {
    PLAN_STATS_SECTIONS,
    PlanStatisticsSectionTabs,
    PlanStatisticsSidebar
} from '../../../app/components/plan/PlanStatisticsSidebar'
import { usePlanStatistics } from '../../../app/hooks/usePlanStatistics'
import { fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import { buildScheduleCsv } from '../../../utils/PlanStatisticsUtility'

/** How many rows to show in the customer / product top lists. */
const TOP_LIST_LIMIT = 8

/** Sections that depend on the schedule-side aggregates and should fall
 *  back to a "no data" empty state when the active range has no rows.
 *  Customer satisfaction owns its own data + empty state, so it stays
 *  reachable even without saved schedules in the current range. */
const SCHEDULE_DEPENDENT_SECTIONS = new Set(['overview', 'yardage', 'plants', 'customers', 'bigPours'])

/**
 * Statistics dashboard for the Plan tab. Renders a left-rail navigation that
 * routes between dedicated sub-pages (Overview, Yardage, Customer
 * satisfaction, Plants, Customers & products, Big pours). Each sub-page
 * tailors its layout for one operational question instead of cramming
 * every chart into a single wall of panels.
 *
 * Period / plant / comparison selectors stay above the split and apply
 * globally — every sub-page (including Customer-satisfaction) reads the
 * same active range and comparison window.
 */
function PlanStatisticsView({ accentColor, planDate, plantNameByCode, liveProduction, mixerCountsByPlant }) {
    const stats = usePlanStatistics({ liveProduction, planDate })
    const {
        anchor,
        availablePlantCodes,
        comparison,
        currentDays,
        currentSummary,
        customEnd,
        customStart,
        isSingleDay,
        loading,
        perPlantSatisfaction,
        period,
        previousSatisfactionAggregate,
        previousSummary,
        range,
        satisfactionAggregate,
        satisfactionLoading,
        satisfactionTrend,
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

    const [activeSection, setActiveSection] = useState('overview')

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

    const topCustomers = useMemo(
        () =>
            Object.values(currentSummary.perCustomer)
                .filter((c) => c.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, TOP_LIST_LIMIT),
        [currentSummary]
    )
    const topProducts = useMemo(
        () =>
            Object.values(currentSummary.perProduct)
                .filter((c) => c.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, TOP_LIST_LIMIT),
        [currentSummary]
    )

    const handleExport = () => {
        const csv = buildScheduleCsv(currentDays)
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `schedule-stats-${range.current.start}_to_${range.current.end}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    /** Active section's metadata — used for the right-pane header. */
    const sectionMeta = useMemo(
        () => PLAN_STATS_SECTIONS.find((s) => s.id === activeSection) || PLAN_STATS_SECTIONS[0],
        [activeSection]
    )

    /** True when the active section needs the schedule aggregates and the
     *  active range turned up nothing. Satisfaction handles its own state. */
    const showScheduleEmpty = !loading && currentDays.length === 0 && SCHEDULE_DEPENDENT_SECTIONS.has(activeSection)
    const scheduleReady = !loading && currentDays.length > 0

    const renderActiveSection = () => {
        if (activeSection === 'satisfaction') {
            return (
                <PlanStatisticsSatisfactionPage
                    accentColor={accentColor}
                    aggregate={satisfactionAggregate}
                    comparison={comparison}
                    loading={satisfactionLoading}
                    perPlant={perPlantSatisfaction}
                    plantNameByCode={plantNameByCode}
                    previousAggregate={previousSatisfactionAggregate}
                    range={range.current}
                    trend={satisfactionTrend}
                />
            )
        }
        if (!scheduleReady) return null
        if (activeSection === 'yardage') {
            return (
                <PlanStatisticsYardagePage
                    accentColor={accentColor}
                    comparison={comparison}
                    currentDays={currentDays}
                    knownPlantRows={knownPlantRows}
                    knownPlantSummary={knownPlantSummary}
                    plantNameByCode={plantNameByCode}
                    selectedPlant={selectedPlant}
                    trendComparison={trendComparison}
                    trendData={trendData}
                />
            )
        }
        if (activeSection === 'plants') {
            return (
                <PlanStatisticsPlantsPage
                    accentColor={accentColor}
                    currentDays={currentDays}
                    currentSummary={currentSummary}
                    isSingleDay={isSingleDay}
                    knownPlantRows={knownPlantRows}
                    knownPlantSummary={knownPlantSummary}
                    mixerCountsByPlant={mixerCountsByPlant}
                    plantNameByCode={plantNameByCode}
                    previousSummary={previousSummary}
                    selectedPlant={selectedPlant}
                />
            )
        }
        if (activeSection === 'customers') {
            return (
                <PlanStatisticsCustomersPage
                    accentColor={accentColor}
                    currentSummary={currentSummary}
                    topCustomers={topCustomers}
                    topProducts={topProducts}
                />
            )
        }
        if (activeSection === 'bigPours') {
            return (
                <PlanStatisticsBigPoursPage
                    accentColor={accentColor}
                    currentSummary={currentSummary}
                    plantNameByCode={plantNameByCode}
                />
            )
        }
        // Overview is the default landing page.
        return (
            <PlanStatisticsOverviewPage
                accentColor={accentColor}
                comparison={comparison}
                currentDays={currentDays}
                currentSummary={currentSummary}
                isSingleDay={isSingleDay}
                knownPlantRows={knownPlantRows}
                knownPlantSummary={knownPlantSummary}
                mixerCountsByPlant={mixerCountsByPlant}
                plantNameByCode={plantNameByCode}
                previousSummary={previousSummary}
                selectedPlant={selectedPlant}
                topCustomers={topCustomers}
                topProducts={topProducts}
                trendComparison={trendComparison}
                trendData={trendData}
            />
        )
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto" data-content-scroll>
            <div className="px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
                <PlanStatisticsControls
                    accentColor={accentColor}
                    anchor={anchor}
                    availablePlantCodes={availablePlantCodes}
                    canExport={currentDays.length > 0}
                    comparison={comparison}
                    customEnd={customEnd}
                    customStart={customStart}
                    onExport={handleExport}
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
                            <h2 className="text-[15px] font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                                {sectionMeta.label}
                            </h2>
                            <span className="text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
                                {sectionMeta.description}
                            </span>
                        </div>

                        {loading && (
                            <div
                                className="rounded px-4 py-3 flex items-center gap-2 text-xs"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                <i className="fas fa-spinner fa-spin" />
                                Loading schedule data…
                            </div>
                        )}

                        {showScheduleEmpty && (
                            <div
                                className="rounded p-8 text-center text-sm"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                <i
                                    className="fas fa-chart-line text-2xl mb-2 block"
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                                No saved schedules in {fmtRange(range.current.start, range.current.end)}.
                            </div>
                        )}

                        {renderActiveSection()}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlanStatisticsView
