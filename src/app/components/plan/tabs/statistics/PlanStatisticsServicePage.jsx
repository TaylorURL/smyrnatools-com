import React, { useMemo } from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { EmptySection, RefreshingHint } from './PlanStatisticsPages'
import ScorePercent from './ScorePercent'
import CustomerList from './service/CustomerList'
import DailyTrendChart from './service/DailyTrendChart'
import HourOfDayChart from './service/HourOfDayChart'
import MomentumPanel from './service/MomentumPanel'
import OutcomesBreakdown from './service/OutcomesBreakdown'
import PlantScorecardTable from './service/PlantScorecardTable'
import WeekdayChart from './service/WeekdayChart'
import WorstOrdersTable from './service/WorstOrdersTable'
import ServiceTierBreakdown from './ServiceTierBreakdown'

/**
 * Service-quality analytics sub-page. Covers the full "good vs. bad
 * customer experience" picture: late starts, slow pours, and the
 * overlap between them. Uses the SAME per-order classifier
 * (`scoreOrderExperience`) that powers the customer-satisfaction
 * score, so this page and the Satisfaction page always agree on
 * whether a specific order was good service.
 *
 * Attribution lands on the plant + scheduled hour, never on the
 * driver — drivers don't control either lateness or pour pace, so
 * blaming them with a leaderboard would be misleading.
 */
export default function PlanStatisticsServicePage({
    accentColor,
    byWeekday = [],
    colocationMap,
    loading,
    momentum,
    plansLoading,
    plantNameByCode,
    serviceLoading,
    serviceStats
}) {
    const { byCustomer, byDay, byHour, byPlant, kpi, outcomes, threshold, worstOrders } = serviceStats
    const isLoading = !!(loading || serviceLoading || plansLoading)
    const hasData = kpi.totalJobs > 0
    const visiblePlantRows = useMemo(() => byPlant.filter((row) => row.jobs > 0), [byPlant])

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Customer experience"
                right={isLoading ? <RefreshingHint when /> : null}
                innerClassName="p-0 overflow-hidden"
            >
                {hasData ? (
                    <div className="flex flex-col gap-3 p-3">
                        <StatGroup columns={4}>
                            <Stat
                                label="Good service"
                                value={<ScorePercent value={kpi.goodPct} />}
                                hint={`${fmtInt(kpi.goodJobs)} of ${fmtInt(kpi.totalJobs)} jobs — neither late nor slow`}
                            />
                            <Stat
                                label="Late jobs"
                                value={fmtInt(kpi.lateJobs)}
                                hint={`First load > ${threshold} min past scheduled start`}
                            />
                            <Stat
                                label="Slow jobs"
                                value={fmtInt(kpi.slowJobs)}
                                hint="Pour rate under 70% of requested yd/hr"
                            />
                            <Stat
                                label="Late + slow"
                                value={fmtInt(kpi.lateAndSlow)}
                                hint="Worst-case overlap — both failures on one order"
                            />
                        </StatGroup>
                        {/* Severity breakdown of the bad slice — tiered by
                            lateness so the dispatcher sees how many orders
                            were mildly off (15 min) vs. catastrophically
                            late (60+ min). */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                            <span className="font-semibold uppercase tracking-wider">Bad-service breakdown:</span>
                            <ServiceTierBreakdown tierCounts={kpi.tierCounts} showZero />
                        </div>
                    </div>
                ) : (
                    <div className="p-3">
                        <EmptySection
                            icon="fa-circle-info"
                            loading={isLoading}
                            message={
                                isLoading
                                    ? 'Loading ticket data…'
                                    : 'No measurable jobs in this window. Service scoring needs a scheduled start time and at least one loaded ticket per order.'
                            }
                        />
                    </div>
                )}
            </Panel>

            <MomentumPanel loading={isLoading} momentum={momentum} />

            <Panel title="Service quality by plant" right={isLoading ? <RefreshingHint when /> : null}>
                {visiblePlantRows.length > 0 ? (
                    <>
                        <div className="text-[11.5px] mb-2 text-text-secondary">
                            Per-plant breakdown — best on-time and on-pace first. Click any column to re-rank. Late and
                            Slow columns count separately, so an order that was both shows up in both.
                        </div>
                        <PlantScorecardTable
                            rows={visiblePlantRows}
                            plantNameByCode={plantNameByCode}
                            colocationMap={colocationMap}
                        />
                    </>
                ) : (
                    <EmptySection
                        icon="fa-circle-info"
                        loading={isLoading}
                        message="No plant scorecards yet — measured jobs will appear once first loads land."
                    />
                )}
            </Panel>

            <Panel title="Customers with the worst service" innerClassName="p-3">
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    These are the customers who have had the worst service (min 2 jobs in window).
                </div>
                <CustomerList rows={byCustomer} emptyMessage="No customers with bad service in this window." />
            </Panel>

            <Panel title="Good service % by time of day" innerClassName="p-3">
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    Buckets scheduled start times by hour-of-day. Surfaces patterns like &ldquo;6am load-outs run
                    late&rdquo; or &ldquo;afternoon pours fall behind pace.&rdquo; Attribution lands on the
                    dispatcher&apos;s booking decision.
                </div>
                <HourOfDayChart data={byHour} accentColor={accentColor} />
            </Panel>

            <Panel
                title="Good service % by weekday"
                innerClassName="p-3"
                right={isLoading ? <RefreshingHint when /> : null}
            >
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    Mon–Sat good-service rate. Spot whether one weekday consistently runs worse than the rest — the
                    answer to &ldquo;is Friday always our problem day?&rdquo;.
                </div>
                {byWeekday.filter((d) => d.score != null).length === 0 ? (
                    <EmptySection
                        loading={isLoading}
                        message={isLoading ? 'Loading per-weekday scores…' : 'No weekday ticket data yet.'}
                    />
                ) : (
                    <WeekdayChart accentColor={accentColor} data={byWeekday} />
                )}
            </Panel>

            <Panel title="Outcome mix" innerClassName="p-3">
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    Every measured order sorts into exactly one bucket — useful for spotting whether the bad service is
                    mostly lateness, mostly slow pours, or both at once.
                </div>
                <OutcomesBreakdown outcomes={outcomes} accentColor={accentColor} />
            </Panel>

            <Panel title={byDay.length > 1 ? 'Good service trend by day' : 'Service trend'} innerClassName="p-3">
                {byDay.length > 1 ? (
                    <>
                        <div className="text-[11.5px] mb-2 text-text-secondary">
                            Daily good-service %. Spot weekday patterns and one-off bad days at a glance.
                        </div>
                        <DailyTrendChart data={byDay} accentColor={accentColor} />
                    </>
                ) : (
                    <div className="text-[12px] py-6 text-center text-text-tertiary">
                        Single-day window — the daily trend lights up once the window spans multiple days.
                    </div>
                )}
            </Panel>

            <Panel title="Worst bad-service jobs" right={isLoading ? <RefreshingHint when /> : null}>
                <div className="text-[11.5px] mb-2 text-text-secondary">
                    Top 20 bad-service jobs ranked by lateness (then pace). &ldquo;What happened&rdquo; shows whether
                    the order was late, slow, or both — useful for spotting the specific customers and dates worth
                    digging into.
                </div>
                <WorstOrdersTable rows={worstOrders} plantNameByCode={plantNameByCode} colocationMap={colocationMap} />
            </Panel>
        </div>
    )
}
