/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fmtInt, fmtYards } from '../../../../../utils/PlanStatisticsFormatUtility'
import { PLAN_STATS_CHART_TOOLTIP_STYLE } from '../../../../../utils/PlanStatisticsUtility'
import {
    EMPTY_COLOCATION_MAP,
    formatColocatedCodeLabel,
    formatColocatedPlantLabel
} from '../../../../../utils/PlantColocationUtility'
import { plantBadgeColor } from '../../../../../utils/PlanUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import HelpBreakdownTable from './HelpBreakdownTable'
import { EmptySection, RefreshingHint } from './PlanStatisticsPages'

/* Two ways one plant helps another, color-keyed so every label, chart,
 * and chip on the page reads the same way:
 *
 *  • DEADHEAD = the dispatcher planned for one of THIS plant's drivers to
 *    drive (empty) over to another plant and help them out. From the
 *    Planner tab assignments — represents INTENT, not delivery.
 *  • CROSS-LOAD = one of THIS plant's mixers actually loaded a ticket for
 *    another plant's order. From dispatch tickets — represents what
 *    REALLY happened. */
const METHOD = {
    crossLoad: {
        color: '#16a34a',
        primaryLabel: 'Loads given for other plants',
        sourceHint: 'from dispatch tickets',
        title: 'Actual loads given (cross-loading)'
    },
    deadhead: {
        color: '#2563eb',
        primaryLabel: 'Drivers sent to help other plants',
        sourceHint: 'from planner assignments',
        title: 'Planned drivers sent out (deadhead)'
    }
}

/** Horizontal bar chart — one bar per giver plant. */
function HelpGivenBarChart({ accentColor, colocationMap, data, metricKey, plantNameByCode, unitLabel }) {
    const chartData = useMemo(
        () =>
            [...data]
                .filter((row) => (row[metricKey] || 0) > 0)
                .sort((a, b) => b[metricKey] - a[metricKey])
                .map((row) => ({
                    code: row.code,
                    codeLabel: formatColocatedCodeLabel(row.code, colocationMap),
                    label: formatColocatedPlantLabel(row.code, plantNameByCode, colocationMap),
                    value: row[metricKey]
                })),
        [data, metricKey, plantNameByCode, colocationMap]
    )
    if (chartData.length === 0) {
        return (
            <div className="text-[12px] py-8 text-center text-text-tertiary">No {unitLabel} given in this period.</div>
        )
    }
    return (
        <div style={{ height: Math.max(180, chartData.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ bottom: 4, left: 8, right: 24, top: 8 }}>
                    <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                        type="number"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={fmtInt}
                        label={{
                            fill: 'var(--text-tertiary)',
                            fontSize: 11,
                            offset: -4,
                            position: 'insideBottom',
                            value: unitLabel
                        }}
                    />
                    <YAxis
                        dataKey="codeLabel"
                        stroke="var(--text-tertiary)"
                        tick={{ fontSize: 11 }}
                        type="category"
                        width={72}
                    />
                    <Tooltip
                        contentStyle={PLAN_STATS_CHART_TOOLTIP_STYLE}
                        cursor={{ fill: `${accentColor}10` }}
                        formatter={(value, _name, item) => [
                            `${fmtInt(value)} ${unitLabel}`,
                            item?.payload?.label || ''
                        ]}
                    />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                        {chartData.map((row) => (
                            <Cell key={row.code} fill={plantBadgeColor(row.code, accentColor)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Legend strip — describes what the two methods mean before the user
 *  hits the data. Reads in plain English so first-time viewers don't have
 *  to infer terminology from column headers. */
function MethodLegend() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
                className="rounded border border-border-light px-3 py-2 text-[12px] text-text-secondary"
                style={{ borderLeft: `3px solid ${METHOD.deadhead.color}` }}
            >
                <div className="font-semibold text-text-primary mb-0.5" style={{ color: METHOD.deadhead.color }}>
                    {METHOD.deadhead.title}
                </div>
                The dispatcher scheduled drivers from this plant to drive empty over to another plant to help them out.
                Counted from <span className="font-semibold">Planner tab</span> assignments.
            </div>
            <div
                className="rounded border border-border-light px-3 py-2 text-[12px] text-text-secondary"
                style={{ borderLeft: `3px solid ${METHOD.crossLoad.color}` }}
            >
                <div className="font-semibold text-text-primary mb-0.5" style={{ color: METHOD.crossLoad.color }}>
                    {METHOD.crossLoad.title}
                </div>
                This plant&apos;s mixers actually loaded a ticket for an order that belongs to another plant. Counted
                from <span className="font-semibold">dispatch tickets</span>.
            </div>
        </div>
    )
}

/**
 * Help & Cross-Loading sub-page. Answers one question:
 * **For the active period, how much is each plant helping the others — and
 * how is that help being delivered?**
 */
export default function PlanStatisticsHelpCrossLoadingPage({
    accentColor,
    colocationMap = EMPTY_COLOCATION_MAP,
    helpByGiverPlant = [],
    kpi,
    loading,
    plantNameByCode = {},
    plansLoading,
    range
}) {
    const safeKpi = kpi || {
        crossLoadTickets: 0,
        crossLoadYardage: 0,
        deadheadDrivers: 0,
        deadheadTrips: 0,
        giverPlantCount: 0,
        recipientPlantCount: 0
    }
    /* `helpByGiverPlant` now always contains every region-scoped plant
     * (even quiet ones), so `hasData` just gates on whether the region
     * has any plants at all. Quiet plants render with em-dashes across
     * every metric column — the table itself reads "no activity"
     * without needing a separate banner. */
    const hasData = helpByGiverPlant.length > 0
    const isRefreshing = loading || plansLoading

    if (loading && !hasData) {
        return <div className="rounded animate-pulse bg-bg-secondary border border-border-light h-[320px]" />
    }

    return (
        <div className="flex flex-col gap-3">
            <MethodLegend />

            {/* Headline strip — every label is a full plain-English phrase
                so the page reads even with zero context. */}
            <StatGroup columns={4}>
                <Stat
                    hint={`across ${fmtInt(safeKpi.deadheadTrips)} planned trip${safeKpi.deadheadTrips === 1 ? '' : 's'}`}
                    label="Drivers planned to help other plants"
                    value={`${fmtInt(safeKpi.deadheadDrivers)} drivers`}
                    valueColor={METHOD.deadhead.color}
                />
                <Stat
                    hint={`across ${fmtInt(safeKpi.crossLoadTickets)} ticket${safeKpi.crossLoadTickets === 1 ? '' : 's'}`}
                    label="Yardage actually loaded for other plants"
                    value={`${fmtYards(safeKpi.crossLoadYardage)} yd³`}
                    valueColor={METHOD.crossLoad.color}
                />
                <Stat
                    hint="distinct plants sending help"
                    label="Plants that gave help"
                    value={fmtInt(safeKpi.giverPlantCount)}
                />
                <Stat
                    hint="distinct plants receiving help"
                    label="Plants that received help"
                    value={fmtInt(safeKpi.recipientPlantCount)}
                />
            </StatGroup>

            {!hasData ? (
                <Panel title="Help given by each plant" innerClassName="p-0">
                    <EmptySection
                        icon="fa-arrows-rotate"
                        loading={isRefreshing}
                        message={isRefreshing ? 'Loading help data…' : 'No region plants available.'}
                    />
                </Panel>
            ) : (
                <>
                    {/* Full detail table — sits above the charts because
                        the table is the canonical answer; the bar charts
                        are visual reinforcement of the same data. */}
                    <HelpBreakdownTable
                        accentColor={accentColor}
                        colocationMap={colocationMap}
                        crossLoadColor={METHOD.crossLoad.color}
                        deadheadColor={METHOD.deadhead.color}
                        helpByGiverPlant={helpByGiverPlant}
                        plantNameByCode={plantNameByCode}
                        range={range}
                    />

                    {/* Two charts — visual reinforcement of the table
                        above. Sub-title under each title makes the
                        axis-units and source explicit. */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <Panel
                            title={METHOD.deadhead.title}
                            right={
                                isRefreshing ? (
                                    <RefreshingHint when />
                                ) : (
                                    <span className="text-[11px] text-text-tertiary">{METHOD.deadhead.sourceHint}</span>
                                )
                            }
                            innerClassName="p-2"
                        >
                            <div className="px-1 pb-2 text-[11.5px] text-text-secondary">
                                {METHOD.deadhead.primaryLabel} — each bar is the total number of drivers the dispatcher
                                planned to send out from that plant.
                            </div>
                            <HelpGivenBarChart
                                accentColor={METHOD.deadhead.color}
                                colocationMap={colocationMap}
                                data={helpByGiverPlant}
                                metricKey="deadheadDrivers"
                                plantNameByCode={plantNameByCode}
                                unitLabel="drivers"
                            />
                        </Panel>
                        <Panel
                            title={METHOD.crossLoad.title}
                            right={
                                isRefreshing ? (
                                    <RefreshingHint when />
                                ) : (
                                    <span className="text-[11px] text-text-tertiary">
                                        {METHOD.crossLoad.sourceHint}
                                    </span>
                                )
                            }
                            innerClassName="p-2"
                        >
                            <div className="px-1 pb-2 text-[11.5px] text-text-secondary">
                                {METHOD.crossLoad.primaryLabel} — each bar is the total yardage that plant&apos;s mixers
                                loaded for orders belonging to other plants.
                            </div>
                            <HelpGivenBarChart
                                accentColor={METHOD.crossLoad.color}
                                colocationMap={colocationMap}
                                data={helpByGiverPlant}
                                metricKey="crossLoadYardage"
                                plantNameByCode={plantNameByCode}
                                unitLabel="yd³"
                            />
                        </Panel>
                    </div>
                </>
            )}
        </div>
    )
}
