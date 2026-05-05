import React, { useState } from 'react'

import { Panel, Stat, StatGroup } from '../ui/Panel'

const COLLAPSED_PLANT_LIMIT = 5

/**
 * Today's plan + dispatch schedule rollup. Shows headline numbers
 * (total yardage, order count, routes, operators moving) followed by
 * a flat plant table — every plant with activity today, sorted by
 * plant code, capped to `COLLAPSED_PLANT_LIMIT` until the user expands.
 */
export default function DashboardScheduleSection({ schedule }) {
    const [expanded, setExpanded] = useState(false)
    const {
        earliestArrival,
        earliestFirstJob,
        hasPlan,
        loading,
        orderCount,
        plantRows = [],
        planDate,
        planYardage,
        receivingPlants,
        routeCount,
        scheduledPlants,
        scheduledYardage,
        sendingPlants,
        totalOps
    } = schedule || {}

    if (loading) {
        return (
            <Panel id="schedule" title="Today's schedule">
                <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                    Loading dispatch data…
                </div>
            </Panel>
        )
    }

    const hasAnyData = scheduledPlants > 0 || hasPlan
    const visibleRows = expanded ? plantRows : plantRows.slice(0, COLLAPSED_PLANT_LIMIT)
    const hiddenCount = plantRows.length - visibleRows.length
    const canExpand = plantRows.length > COLLAPSED_PLANT_LIMIT
    const dateLabel = planDate
        ? new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              weekday: 'long'
          })
        : 'Today'

    return (
        <Panel
            id="schedule"
            title="Today's schedule"
            innerClassName="p-3"
            right={
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {dateLabel}
                </span>
            }
        >
            <div className="flex flex-col gap-3">
                <StatGroup columns={6}>
                    <Stat
                        hint={hasPlan ? `Plan saved` : 'No plan saved'}
                        label="Plan yardage"
                        value={(planYardage || 0).toLocaleString()}
                        valueColor={hasPlan ? undefined : '#a16207'}
                    />
                    <Stat
                        hint={`${scheduledPlants || 0} plant${scheduledPlants === 1 ? '' : 's'} scheduled`}
                        label="Dispatch yardage"
                        value={(scheduledYardage || 0).toLocaleString()}
                    />
                    <Stat
                        hint={orderCount > 0 ? 'From dispatch' : 'No orders'}
                        label="Orders"
                        value={(orderCount || 0).toLocaleString()}
                    />
                    <Stat
                        hint={routeCount > 0 ? `${sendingPlants}→${receivingPlants} plants` : 'No transfers'}
                        label="Routes"
                        value={routeCount || 0}
                    />
                    <Stat
                        hint={totalOps > 0 ? 'Inter-plant moves' : 'No moves'}
                        label="Operators moving"
                        value={totalOps || 0}
                    />
                    <Stat
                        hint={
                            earliestFirstJob ? 'Earliest scheduled' : earliestArrival ? 'Earliest arrival' : 'No jobs'
                        }
                        label="First job"
                        value={earliestFirstJob || earliestArrival || '—'}
                        valueColor={earliestFirstJob || earliestArrival ? '#16a34a' : undefined}
                    />
                </StatGroup>

                {hasAnyData && plantRows.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <table
                            className="w-full border-collapse rounded overflow-hidden"
                            style={{ border: '1px solid var(--border-light)' }}
                        >
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th
                                        className="px-3 py-2 text-left text-[11px] font-semibold"
                                        style={{
                                            borderBottom: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        Plant
                                    </th>
                                    <th
                                        className="px-3 py-2 text-right text-[11px] font-semibold"
                                        style={{
                                            borderBottom: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        Orders
                                    </th>
                                    <th
                                        className="px-3 py-2 text-right text-[11px] font-semibold"
                                        style={{
                                            borderBottom: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        Yardage
                                    </th>
                                    <th
                                        className="px-3 py-2 text-right text-[11px] font-semibold"
                                        style={{
                                            borderBottom: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        First job
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row, i) => (
                                    <tr key={row.code} className="transition-colors hover:bg-bg-tertiary">
                                        <td
                                            className="px-3 py-2 text-[12.5px] font-mono tabular-nums"
                                            style={{
                                                borderBottom:
                                                    i < visibleRows.length - 1
                                                        ? '1px solid var(--border-light)'
                                                        : 'none',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {row.code}
                                        </td>
                                        <td
                                            className="px-3 py-2 text-right font-mono tabular-nums text-[12.5px] font-semibold"
                                            style={{
                                                borderBottom:
                                                    i < visibleRows.length - 1
                                                        ? '1px solid var(--border-light)'
                                                        : 'none',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {row.orderCount}
                                        </td>
                                        <td
                                            className="px-3 py-2 text-right font-mono tabular-nums text-[12.5px] font-semibold"
                                            style={{
                                                borderBottom:
                                                    i < visibleRows.length - 1
                                                        ? '1px solid var(--border-light)'
                                                        : 'none',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {row.yardage.toLocaleString()}
                                        </td>
                                        <td
                                            className="px-3 py-2 text-right font-mono tabular-nums text-[12.5px]"
                                            style={{
                                                borderBottom:
                                                    i < visibleRows.length - 1
                                                        ? '1px solid var(--border-light)'
                                                        : 'none',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            {row.firstJobTime || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {canExpand && (
                            <button
                                type="button"
                                onClick={() => setExpanded((prev) => !prev)}
                                className="self-start text-[12px] font-semibold px-0 py-1 bg-transparent border-none cursor-pointer hover:underline"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {expanded ? 'Show less' : `Show more (${hiddenCount})`}
                            </button>
                        )}
                    </div>
                )}

                {!hasAnyData && (
                    <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                        No dispatch data for today yet.
                    </div>
                )}
            </div>
        </Panel>
    )
}
