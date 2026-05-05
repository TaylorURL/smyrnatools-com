import React from 'react'

import { Panel, Stat, StatGroup } from '../ui/Panel'

/**
 * Reports rollup — submission counts for the current week + the heaviest
 * outstanding offenders (by report type and by user) so plant/district
 * managers can chase the few names that owe the most paperwork.
 */
export default function DashboardReportsSection({ reports }) {
    const {
        expectedThisWeek,
        loading,
        overdueCount,
        submittedThisWeek,
        topOverdueReports,
        topOverdueUsers,
        weeklyCompletionRate,
        yearReportCount
    } = reports || {}

    if (loading) {
        return (
            <Panel id="reports" title="Reports">
                <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                    Loading reports…
                </div>
            </Panel>
        )
    }

    const submittedColor = submittedThisWeek > 0 ? '#16a34a' : undefined
    const overdueColor = overdueCount > 0 ? '#dc2626' : undefined
    const completionColor =
        weeklyCompletionRate == null
            ? undefined
            : weeklyCompletionRate >= 90
              ? '#16a34a'
              : weeklyCompletionRate >= 70
                ? '#d97706'
                : '#dc2626'

    return (
        <Panel
            id="reports"
            title="Reports"
            innerClassName="p-3"
            right={
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {yearReportCount || 0} this year
                </span>
            }
        >
            <div className="flex flex-col gap-3">
                <StatGroup columns={4}>
                    <Stat
                        hint="Plant manager reports"
                        label="Submitted this week"
                        value={submittedThisWeek || 0}
                        valueColor={submittedColor}
                    />
                    <Stat
                        hint={
                            expectedThisWeek > 0
                                ? `${submittedThisWeek || 0} of ${expectedThisWeek} expected`
                                : 'No reports due'
                        }
                        label="Completion rate"
                        value={weeklyCompletionRate == null ? '—' : `${weeklyCompletionRate}%`}
                        valueColor={completionColor}
                    />
                    <Stat
                        hint={overdueCount > 0 ? 'Across all users' : 'All caught up'}
                        label="Overdue reports"
                        value={overdueCount || 0}
                        valueColor={overdueColor}
                    />
                    <Stat hint="Submitted YTD" label="Year-to-date" value={(yearReportCount || 0).toLocaleString()} />
                </StatGroup>

                {(topOverdueReports?.length > 0 || topOverdueUsers?.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {topOverdueReports?.length > 0 && (
                            <div>
                                <div
                                    className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Top overdue report types
                                </div>
                                <table
                                    className="w-full border-collapse rounded overflow-hidden"
                                    style={{ border: '1px solid var(--border-light)' }}
                                >
                                    <tbody>
                                        {topOverdueReports.map((row, i) => (
                                            <tr key={row.name} className="transition-colors hover:bg-bg-tertiary">
                                                <td
                                                    className="px-3 py-2 text-[12.5px]"
                                                    style={{
                                                        borderBottom:
                                                            i < topOverdueReports.length - 1
                                                                ? '1px solid var(--border-light)'
                                                                : 'none',
                                                        color: 'var(--text-primary)'
                                                    }}
                                                >
                                                    {row.name}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-right font-mono tabular-nums text-[12.5px] font-semibold"
                                                    style={{
                                                        borderBottom:
                                                            i < topOverdueReports.length - 1
                                                                ? '1px solid var(--border-light)'
                                                                : 'none',
                                                        color: '#dc2626'
                                                    }}
                                                >
                                                    {row.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {topOverdueUsers?.length > 0 && (
                            <div>
                                <div
                                    className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Top overdue users
                                </div>
                                <table
                                    className="w-full border-collapse rounded overflow-hidden"
                                    style={{ border: '1px solid var(--border-light)' }}
                                >
                                    <tbody>
                                        {topOverdueUsers.map((row, i) => (
                                            <tr
                                                key={row.name + row.plant}
                                                className="transition-colors hover:bg-bg-tertiary"
                                            >
                                                <td
                                                    className="px-3 py-2 text-[12.5px]"
                                                    style={{
                                                        borderBottom:
                                                            i < topOverdueUsers.length - 1
                                                                ? '1px solid var(--border-light)'
                                                                : 'none',
                                                        color: 'var(--text-primary)'
                                                    }}
                                                >
                                                    <span>{row.name}</span>
                                                    {row.plant && (
                                                        <span
                                                            className="ml-1.5 font-mono text-[11px]"
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                        >
                                                            · {row.plant}
                                                        </span>
                                                    )}
                                                </td>
                                                <td
                                                    className="px-3 py-2 text-right font-mono tabular-nums text-[12.5px] font-semibold"
                                                    style={{
                                                        borderBottom:
                                                            i < topOverdueUsers.length - 1
                                                                ? '1px solid var(--border-light)'
                                                                : 'none',
                                                        color: '#dc2626'
                                                    }}
                                                >
                                                    {row.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {!topOverdueReports?.length && !topOverdueUsers?.length && (
                    <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                        Nothing overdue right now.
                    </div>
                )}
            </div>
        </Panel>
    )
}
