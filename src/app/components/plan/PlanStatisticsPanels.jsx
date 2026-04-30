import React, { useMemo } from 'react'

import { fmtFloat, fmtInt, satisfactionColor } from '../../../utils/PlanStatisticsFormatUtility'
import { BIG_POUR_SPACING_THRESHOLD_MIN, BIG_POUR_YARDAGE_THRESHOLD } from '../../../utils/PlanUtility'
import { Panel } from '../ui/Panel'
import { ByPlantChart, DayOfWeekChart, SatisfactionChart, TrendChart } from './PlanStatisticsCharts'
import { BigPoursTable, ComparisonRow, PlantScorecardTable, RankedList } from './PlanStatisticsTables'

/** Period-comparison panel — same metric on both sides + Δ%. Driven by a
 *  config table so adding a new row is a one-line change. */
function ComparisonPanel({ currentSummary, previousSummary }) {
    const rows = useMemo(
        () => [
            {
                current: { formatted: fmtInt(currentSummary.totalYardage), value: currentSummary.totalYardage },
                label: 'Total yardage',
                previous: { formatted: fmtInt(previousSummary.totalYardage), value: previousSummary.totalYardage }
            },
            {
                current: { formatted: fmtInt(currentSummary.totalLoads), value: currentSummary.totalLoads },
                label: 'Loads scheduled',
                previous: { formatted: fmtInt(previousSummary.totalLoads), value: previousSummary.totalLoads }
            },
            {
                current: { formatted: fmtInt(currentSummary.totalOrders), value: currentSummary.totalOrders },
                label: 'Orders',
                previous: { formatted: fmtInt(previousSummary.totalOrders), value: previousSummary.totalOrders }
            },
            {
                current: {
                    formatted: currentSummary.yardagePerLoad != null ? fmtFloat(currentSummary.yardagePerLoad) : '—',
                    value: currentSummary.yardagePerLoad
                },
                label: 'Yardage per load',
                previous:
                    previousSummary.yardagePerLoad != null
                        ? {
                              formatted: fmtFloat(previousSummary.yardagePerLoad),
                              value: previousSummary.yardagePerLoad
                          }
                        : null
            },
            {
                current: {
                    formatted: fmtInt(currentSummary.avgYardagePerActiveDay),
                    value: currentSummary.avgYardagePerActiveDay
                },
                label: 'Avg yardage / active day',
                previous: {
                    formatted: fmtInt(previousSummary.avgYardagePerActiveDay),
                    value: previousSummary.avgYardagePerActiveDay
                }
            },
            {
                current: {
                    formatted:
                        currentSummary.avgShiftSpanHours != null ? fmtFloat(currentSummary.avgShiftSpanHours) : '—',
                    value: currentSummary.avgShiftSpanHours
                },
                label: 'Avg shift span (h)',
                previous:
                    previousSummary.avgShiftSpanHours != null
                        ? {
                              formatted: fmtFloat(previousSummary.avgShiftSpanHours),
                              value: previousSummary.avgShiftSpanHours
                          }
                        : null
            },
            {
                current: {
                    formatted: `${currentSummary.daysWithProduction}/${currentSummary.dayCount}`,
                    value: currentSummary.daysWithProduction
                },
                label: 'Active production days',
                previous: {
                    formatted: `${previousSummary.daysWithProduction}/${previousSummary.dayCount}`,
                    value: previousSummary.daysWithProduction
                }
            }
        ],
        [currentSummary, previousSummary]
    )

    return (
        <Panel title="Period comparison" innerClassName="p-0">
            <div
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
            >
                <span>Metric</span>
                <span>Current</span>
                <span>Previous</span>
                <span className="text-right" style={{ minWidth: 60 }}>
                    Δ
                </span>
            </div>
            {rows.map((row) => (
                <ComparisonRow key={row.label} label={row.label} current={row.current} previous={row.previous} />
            ))}
        </Panel>
    )
}

/** Period-aggregate satisfaction pill rendered as the right-hand badge for
 *  the satisfaction panel header. Returns a "Loading…" hint while ticket
 *  data is in flight, or null when there's no data and nothing pending. */
function SatisfactionBadge({ aggregate, isLoading }) {
    if (aggregate) {
        const score = Math.round(aggregate.score * 100)
        const color = satisfactionColor(score)
        return (
            <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded px-2 py-0.5"
                style={{ background: `${color}1f`, color }}
            >
                <i className="fas fa-face-smile text-[10px]" />
                {score}%
            </span>
        )
    }
    if (isLoading) {
        return (
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                Loading…
            </span>
        )
    }
    return null
}

/**
 * The full body of the Statistics view: hero + 2-column grid of operational
 * panels. Pure presentation — every dataset comes in as props, every
 * sub-panel is its own component for easy mental scanning.
 */
export function PlanStatisticsPanels({
    accentColor,
    comparison,
    currentDays,
    currentSummary,
    isSingleDay,
    knownPlantRows,
    knownPlantSummary,
    mixerCountsByPlant,
    plantNameByCode,
    previousSummary,
    satisfactionAggregate,
    satisfactionByDay,
    satisfactionLoading,
    selectedPlant,
    topCustomers,
    topProducts,
    trendComparison,
    trendData
}) {
    const heroTitle = selectedPlant
        ? `Yardage · ${plantNameByCode?.[selectedPlant] ? `${selectedPlant} · ${plantNameByCode[selectedPlant]}` : selectedPlant}`
        : 'Yardage by plant'

    return (
        <div className="flex flex-col gap-4">
            {/* Hero: yardage per plant over the active time frame. Plant
                breakdown is the most actionable summary the page can show —
                collapses to a single bar when the user has filtered to one
                plant. */}
            <Panel
                title={heroTitle}
                innerClassName="p-3"
                right={
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {currentSummary.activePlantSet.size} plant
                        {currentSummary.activePlantSet.size === 1 ? '' : 's'} · {fmtInt(currentSummary.totalYardage)}{' '}
                        yd³ total
                    </span>
                }
            >
                <ByPlantChart accent={accentColor} plantNameByCode={plantNameByCode} rows={knownPlantRows} />
            </Panel>

            {/* 2-column body: operational tables/trends on the left (main
                column), supporting risk lists and mix breakdowns on the
                right (sidebar column). 3:2 ratio gives the wider panels
                enough room for tables without crowding the sidebar lists. */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
                <div className="flex flex-col gap-4 min-w-0">
                    <Panel
                        title="Plant scorecards"
                        innerClassName="p-0"
                        right={
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                {knownPlantSummary.activeCount} active ·{' '}
                                {knownPlantSummary.topShare
                                    ? `top: ${knownPlantSummary.topShare.code} (${(knownPlantSummary.topShare.share * 100).toFixed(0)}%)`
                                    : '—'}
                            </span>
                        }
                    >
                        <PlantScorecardTable
                            accent={accentColor}
                            isSingleDay={isSingleDay}
                            mixerCountsByPlant={mixerCountsByPlant}
                            plantNameByCode={plantNameByCode}
                            rows={knownPlantRows}
                            singleDayShiftSpan={isSingleDay ? currentDays[0]?.shiftSpanHours : null}
                            totalYardage={knownPlantSummary.totalYardage}
                        />
                    </Panel>
                    <Panel
                        title="Daily yardage trend"
                        innerClassName="p-3"
                        right={
                            trendComparison && (
                                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                    Dotted = {comparison === 'lastYear' ? 'last year' : 'previous period'}
                                </span>
                            )
                        }
                    >
                        <TrendChart accent={accentColor} data={trendData} comparisonData={trendComparison} />
                    </Panel>
                    <Panel title="Average by weekday" innerClassName="p-3">
                        <DayOfWeekChart accent={accentColor} plans={currentDays} />
                    </Panel>
                </div>
                <div className="flex flex-col gap-4 min-w-0">
                    <Panel
                        title="Customer satisfaction"
                        innerClassName="p-3"
                        right={<SatisfactionBadge aggregate={satisfactionAggregate} isLoading={satisfactionLoading} />}
                    >
                        <SatisfactionChart
                            accent={accentColor}
                            aggregate={satisfactionAggregate}
                            days={currentDays}
                            isLoading={satisfactionLoading}
                            satisfactionByDay={satisfactionByDay}
                        />
                    </Panel>
                    <Panel
                        title="Big pours to coordinate"
                        innerClassName="p-0"
                        right={
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                {currentSummary.bigPours.length} · &gt;{BIG_POUR_YARDAGE_THRESHOLD} yd³ · &lt;
                                {BIG_POUR_SPACING_THRESHOLD_MIN}m
                            </span>
                        }
                    >
                        <BigPoursTable
                            accent={accentColor}
                            plantNameByCode={plantNameByCode}
                            pours={currentSummary.bigPours}
                        />
                    </Panel>
                    <Panel
                        title="Customer concentration"
                        innerClassName="p-3"
                        right={
                            currentSummary.topCustomerShare ? (
                                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                    Top {(currentSummary.topCustomerShare.share * 100).toFixed(0)}%
                                </span>
                            ) : null
                        }
                    >
                        <RankedList
                            accent={accentColor}
                            emptyLabel="No customer data in this range."
                            items={topCustomers}
                            labelKey="customer"
                            secondaryFmt={(item) => `${item.orders} ord`}
                        />
                    </Panel>
                    <Panel title="Top product mixes" innerClassName="p-3">
                        <RankedList
                            accent={accentColor}
                            emptyLabel="No product data in this range."
                            items={topProducts}
                            labelKey="product"
                            secondaryFmt={(item) => `${fmtInt(item.loads)} loads`}
                        />
                    </Panel>
                    {previousSummary && (
                        <ComparisonPanel currentSummary={currentSummary} previousSummary={previousSummary} />
                    )}
                </div>
            </div>
        </div>
    )
}

export default PlanStatisticsPanels
