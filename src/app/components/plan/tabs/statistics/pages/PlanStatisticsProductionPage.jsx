/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtRange } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { Panel } from '../../../../ui/Panel'
import { DayOfWeekChart, TrendChart } from '../PlanStatisticsCharts'
import { PlantScorecardTable } from '../PlanStatisticsTables'
import { ComparisonPanel, EmptySection, isEmptyAfterLoad, RefreshingHint } from './planStatsShared'

/* ──────────────────────────────────────────────────────────────────────────
 * Production sub-page — merged Plants + Yardage view. Leads with the
 * per-plant scorecard table (the operator-facing "who did what" answer),
 * then a daily yardage trend and weekday-shape chart for time-series
 * context, then the period-comparison block when comparison is on.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsProductionPage({
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
    range,
    trendComparison,
    trendData
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                {[280, 260, 200].map((h, i) => (
                    <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
                ))}
            </div>
        )
    }
    if (isEmpty) {
        return (
            <Panel title="Production" innerClassName="p-0">
                <EmptySection
                    icon="fa-industry"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Plant scorecards"
                innerClassName="p-0"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {knownPlantSummary.activeCount} active ·{' '}
                            {knownPlantSummary.topShare
                                ? `top: ${knownPlantSummary.topShare.code} (${(knownPlantSummary.topShare.share * 100).toFixed(0)}%)`
                                : '—'}
                        </span>
                    )
                }
            >
                {knownPlantRows.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading scorecards…' : 'No plant production in this window.'}
                    />
                ) : (
                    <PlantScorecardTable
                        accent={accentColor}
                        isSingleDay={isSingleDay}
                        loadAttributionByPlant={perPlantLoadAttribution}
                        mixerCountsByPlant={mixerCountsByPlant}
                        plantNameByCode={plantNameByCode}
                        rows={knownPlantRows}
                        singleDayShiftSpan={isSingleDay ? currentDays[0]?.shiftSpanHours : null}
                        totalYardage={knownPlantSummary.totalYardage}
                    />
                )}
            </Panel>
            <Panel
                title="Daily yardage trend"
                innerClassName="p-3"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : trendComparison ? (
                        <span className="text-[11px] text-text-tertiary">
                            Dotted = {comparison === 'lastYear' ? 'last year' : 'previous period'}
                        </span>
                    ) : null
                }
            >
                {trendData.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading daily yardage…' : 'No daily yardage data yet.'}
                    />
                ) : (
                    <TrendChart accent={accentColor} data={trendData} comparisonData={trendComparison} />
                )}
            </Panel>
            <Panel title="Average by weekday" innerClassName="p-3" right={loading ? <RefreshingHint when /> : null}>
                {currentDays.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading weekday averages…' : 'No weekday data yet.'}
                    />
                ) : (
                    <DayOfWeekChart accent={accentColor} plans={currentDays} />
                )}
            </Panel>
            {previousSummary && <ComparisonPanel currentSummary={currentSummary} previousSummary={previousSummary} />}
        </div>
    )
}
