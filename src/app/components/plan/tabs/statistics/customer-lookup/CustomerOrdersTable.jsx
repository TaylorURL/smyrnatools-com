/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtDate } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../../utils/PlantColocationUtility'
import ScorePercent from '../ScorePercent'
import { fmtMinutes, fmtYards, SAME_DAY, verdictLabel } from './customerLookupShared'

export default function CustomerOrdersTable({ colocationMap, orders, plantNameByCode }) {
    if (!orders.length) {
        return (
            <div className="text-[12px] py-4 text-text-tertiary">
                No measured orders for this customer in the window.
            </div>
        )
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
                <thead>
                    <tr>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Date
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Verdict
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Scheduled
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            First load
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Late by
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light">
                            Pace
                        </th>
                        <th
                            className="text-[10.5px] font-semibold uppercase tracking-wider text-right px-3 py-2 text-text-tertiary border-b border-border-light"
                            title="Yards the customer added mid-pour (kicker)"
                        >
                            Kicker
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((m) => {
                        const kickerLabel = m.hasKicker ? fmtYards(m.kickerYards) : null
                        return (
                            <tr key={m.orderId} className="border-b border-border-light last:border-b-0">
                                <td className="px-3 py-2 text-[12px] text-text-secondary tabular-nums">
                                    {fmtDate(m.date)}
                                </td>
                                <td className="px-3 py-2 text-[12px] text-text-primary">
                                    <span className="font-mono text-[11px] tabular-nums text-text-tertiary mr-2">
                                        {formatColocatedCodeLabel(m.plantCode, colocationMap)}
                                    </span>
                                    {formatColocatedPlantLabel(m.plantCode, plantNameByCode, colocationMap)}
                                </td>
                                <td className="px-3 py-2 text-[12px] font-semibold">
                                    <div className="flex items-center gap-1.5">
                                        <span>{verdictLabel(m)}</span>
                                        {m.isSameDay && (
                                            <span
                                                title="Same-day order — booked the day it ran (15:00 sentinel)"
                                                className="rounded-sm px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                                                style={{ background: `${SAME_DAY}1a`, color: SAME_DAY }}
                                            >
                                                <i className="fas fa-bolt mr-0.5 text-[8px]" />
                                                Same-day
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {m.startTime || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                    {m.firstLoadTime || '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-primary">
                                    {m.isLate ? fmtMinutes(m.latenessMin) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {m.paceScore == null ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        <ScorePercent size="sm" value={m.paceScore} />
                                    )}
                                </td>
                                <td
                                    className="px-3 py-2 text-right text-[12px] tabular-nums font-semibold text-text-primary"
                                    title={
                                        kickerLabel
                                            ? `${m.kickerLoads} kicker load${m.kickerLoads === 1 ? '' : 's'}`
                                            : undefined
                                    }
                                >
                                    {kickerLabel ? `+${kickerLabel}` : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
