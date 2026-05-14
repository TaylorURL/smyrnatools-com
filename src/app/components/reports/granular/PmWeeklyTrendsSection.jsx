/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ReportUtility } from '../../../../utils/ReportUtility'
import { PM_TD, PM_TH } from '../../../constants/plantManagerReportConstants'
import { CARD_STYLE, SECTION_LABEL_CLASS } from '../../../constants/weeklyReportConstants'
import { usePmTrendsData } from '../../../hooks/usePmTrendsData'
import { CardHeader } from './RmiAtoms'

/** Loading-state body for the trends card. */
function TrendsLoadingState() {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader icon="fa-chart-line" label="Trends" title="Monthly Performance Trends" />
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-text-tertiary">
                <i className="fas fa-circle-notch fa-spin text-[11px]" />
                Loading historical data…
            </div>
        </div>
    )
}

/** Empty-state body when no historical reports exist for the month. */
function TrendsEmptyState({ monthName }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-calendar-alt"
                label="Trends"
                title={`${monthName} — Weekly Performance`}
                sub="No reports found for this month."
            />
        </div>
    )
}

/** Single timeline row — bullet + report card on the right. */
function TimelineEntry({ previousReport, report, timelineUserNames }) {
    const [year, month, day] = report.weekIso.split('-').map(Number)
    const weekDate = new Date(year, month - 1, day)
    weekDate.setDate(weekDate.getDate() + 1)
    const weekLabel = weekDate.toLocaleDateString()
    const yphVariance = !report.isPlaceholder ? calculateVariance(report.yph, previousReport?.yph) : null
    const userName = report.userId ? timelineUserNames[report.userId] || 'Loading...' : null
    const varianceColor = yphVariance != null && yphVariance >= 0 ? '#16a34a' : '#dc2626'
    return (
        <div className="flex items-start gap-2.5 py-2 relative" style={{ opacity: report.isPlaceholder ? 0.6 : 1 }}>
            <div className="flex items-center justify-center relative z-[1] shrink-0 w-6 h-6">
                <div
                    className="rounded-full w-2.5 h-2.5"
                    style={{
                        background: report.isPlaceholder ? 'var(--border-medium)' : 'var(--accent, #1e3a5f)',
                        boxShadow: '0 0 0 3px var(--bg-primary), 0 0 0 4px var(--border-light)'
                    }}
                />
            </div>
            <div className="flex-1 rounded p-2.5 bg-bg-secondary border border-border-light">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold mb-1 text-text-primary">
                    {weekLabel}
                    {report.isCurrentWeek && (
                        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider bg-accent text-white">
                            Current
                        </span>
                    )}
                </div>
                {report.isPlaceholder ? (
                    <div className="flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
                        <i className="fas fa-clock text-[10px]" />
                        <span>Pending</span>
                    </div>
                ) : (
                    <TimelineMetrics
                        report={report}
                        userName={userName}
                        yphVariance={yphVariance}
                        varianceColor={varianceColor}
                    />
                )}
            </div>
        </div>
    )
}

function TimelineMetrics({ report, userName, yphVariance, varianceColor }) {
    return (
        <>
            <div className="flex items-center gap-1.5 text-[11px] mb-1.5 text-text-tertiary">
                <i className="fas fa-user text-[9px]" />
                {userName || 'Unknown'}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
                <span
                    className="flex items-baseline gap-1 font-mono tabular-nums text-text-primary"
                    title="Raw / Adjusted YPH"
                >
                    <span className="text-[16px] font-bold leading-none">
                        {(report.rawYph ?? report.yph).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-text-tertiary">/</span>
                    <span className="text-[16px] font-bold leading-none">
                        {(report.adjustedYph ?? report.yph).toFixed(2)}
                    </span>
                </span>
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    YPH
                </span>
                {yphVariance !== null && (
                    <span
                        className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
                        style={{ color: varianceColor }}
                    >
                        <i className={`fas fa-arrow-${yphVariance >= 0 ? 'up' : 'down'} text-[9px]`} />
                        {Math.abs(yphVariance).toFixed(1)}%
                    </span>
                )}
            </div>
        </>
    )
}

function calculateVariance(current, previous) {
    if (!previous) return null
    return ((current - previous) / previous) * 100
}

/** Vertical timeline of monthly reports — dots connected by a left rail. */
function TrendsTimeline({ historicalData, timelineUserNames }) {
    return (
        <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-[var(--border-light)]" />
            <div className="flex flex-col relative">
                {historicalData.map((report, idx) => {
                    const previousReport = historicalData
                        .slice(0, idx)
                        .filter((r) => !r.isPlaceholder)
                        .pop()
                    return (
                        <TimelineEntry
                            key={idx}
                            previousReport={previousReport}
                            report={report}
                            timelineUserNames={timelineUserNames}
                        />
                    )
                })}
            </div>
        </div>
    )
}

/** Single row in the year-to-date breakdown table. */
function BreakdownRow({ userNames, week }) {
    const weekDate = new Date(week.week + 'T12:00:00')
    const weekLabel = ReportUtility.formatDate(weekDate)
    const userName = week.userId ? userNames[week.userId] || 'Loading...' : null
    const dailyAvg = Math.round(week.yardage / 6)
    const targetYPH = 3.0
    const yphEfficiency = week.hours > 0 ? Math.min((week.yph / targetYPH) * 100, 100) : 0
    const isMissingRow = week.isMissing || week.isNotSubmitted
    const rowStyle = isMissingRow ? { background: 'rgba(220, 38, 38, 0.04)' } : undefined
    return (
        <tr className="border-t border-border-light">
            <td className={PM_TD} style={rowStyle}>
                {week.isNotSubmitted && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[rgba(217,_119,_6,_0.12)] text-[#b45309]">
                        Not Submitted
                    </span>
                )}
                {week.isMissing && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[rgba(220,_38,_38,_0.12)] text-red-700">
                        Missing
                    </span>
                )}
                {!week.isMissing && !week.isNotSubmitted && userName}
            </td>
            <td className={`${PM_TD} whitespace-nowrap tabular-nums`} style={rowStyle}>
                {weekLabel}
            </td>
            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                {isMissingRow ? '—' : week.yardage.toLocaleString()}
            </td>
            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                {isMissingRow ? '—' : week.hours.toLocaleString()}
            </td>
            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                {isMissingRow ? (
                    '—'
                ) : (
                    <span className="inline-flex items-baseline gap-0.5" title="Raw / Adjusted YPH">
                        <span>{(week.rawYph ?? week.yph).toFixed(2)}</span>
                        <span className="text-text-tertiary">/</span>
                        <span>{(week.adjustedYph ?? week.yph).toFixed(2)}</span>
                    </span>
                )}
            </td>
            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                {isMissingRow ? '—' : dailyAvg.toLocaleString()}
            </td>
            <td className={`${PM_TD} font-mono tabular-nums`} style={rowStyle}>
                {isMissingRow ? '—' : `${yphEfficiency.toFixed(1)}%`}
            </td>
        </tr>
    )
}

const BREAKDOWN_HEADERS = ['Submitted By', 'Week Starting', 'Yardage', 'Hours', 'YPH', 'Daily Avg', 'Efficiency']

function BreakdownTable({ userNames, weeklyBreakdown }) {
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full min-w-[700px] border-collapse">
                <thead>
                    <tr>
                        {BREAKDOWN_HEADERS.map((h) => (
                            <th key={h} className={PM_TH}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {weeklyBreakdown.map((week, idx) => (
                        <BreakdownRow key={idx} userNames={userNames} week={week} />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/** Tinted callout for draft or missing reports — color/icon vary by kind. */
function ReportListAlert({ icon, kind, label, plural, weeks }) {
    if (!weeks?.length) return null
    const palette =
        kind === 'draft'
            ? {
                  bg: 'rgba(217, 119, 6, 0.08)',
                  border: 'rgba(217, 119, 6, 0.35)',
                  iconColor: '#b45309',
                  titleColor: '#92400e'
              }
            : {
                  bg: 'rgba(220, 38, 38, 0.08)',
                  border: 'rgba(220, 38, 38, 0.35)',
                  iconColor: 'rgb(185, 28, 28)',
                  titleColor: '#991b1b'
              }
    return (
        <div className="rounded p-2.5" style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <i className={`fas ${icon} text-[11px]`} style={{ color: palette.iconColor }} />
                <span className="text-[12px] font-semibold" style={{ color: palette.titleColor }}>
                    {weeks.length} {label} {weeks.length === 1 ? 'Report' : 'Reports'}
                </span>
            </div>
            <div className="text-[11.5px] text-text-secondary">
                {plural}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {weeks.map((week, idx) => (
                        <span
                            key={idx}
                            className="rounded px-2 py-0.5 text-[11px] tabular-nums bg-bg-primary border border-border-light text-text-primary"
                        >
                            {ReportUtility.formatDate(new Date(week.week + 'T12:00:00'))}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Monthly trends card — vertical timeline, year-to-date table, and
 *  draft/missing callouts. Driven entirely by `usePmTrendsData`. */
export function WeeklyTrendsSection({ currentWeekIso, plantCode, user }) {
    const effectivePlantCode = plantCode || user?.plant_code || ''
    const { historicalData, loading, timelineUserNames, userNames, yearlyTotals } = usePmTrendsData(
        currentWeekIso,
        effectivePlantCode
    )

    if (loading) return <TrendsLoadingState />

    const weekDateStrForMonth = currentWeekIso.split('T')[0]
    const [yearForMonth, monthForMonth] = weekDateStrForMonth.split('-').map(Number)
    const monthName = new Date(yearForMonth, monthForMonth - 1, 15).toLocaleString('default', {
        month: 'long',
        year: 'numeric'
    })

    if (historicalData.length === 0) return <TrendsEmptyState monthName={monthName} />

    const weeksWithData = historicalData.filter((r) => !r.isPlaceholder).length
    const hasBreakdown = yearlyTotals && yearlyTotals.weeklyBreakdown && yearlyTotals.weeklyBreakdown.length > 0

    return (
        <div className="rounded p-3 flex flex-col gap-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chart-line"
                label="Trends"
                title={`${monthName} Performance Timeline`}
                sub={`${weeksWithData} of ${historicalData.length} ${historicalData.length === 1 ? 'week' : 'weeks'} with data`}
            />
            <TrendsTimeline historicalData={historicalData} timelineUserNames={timelineUserNames} />
            {hasBreakdown && (
                <div className="flex flex-col gap-2.5">
                    <div className={`${SECTION_LABEL_CLASS} text-text-secondary`}>Weekly Breakdown</div>
                    <BreakdownTable userNames={userNames} weeklyBreakdown={yearlyTotals.weeklyBreakdown} />
                    <ReportListAlert
                        icon="fa-circle-exclamation"
                        kind="draft"
                        label="Draft"
                        plural="The following weeks have saved drafts that need to be submitted:"
                        weeks={yearlyTotals.notSubmittedWeeks}
                    />
                    <ReportListAlert
                        icon="fa-triangle-exclamation"
                        kind="missing"
                        label="Missing"
                        plural="The following weeks need reports to be created and submitted:"
                        weeks={yearlyTotals.missingWeeks}
                    />
                </div>
            )}
        </div>
    )
}
