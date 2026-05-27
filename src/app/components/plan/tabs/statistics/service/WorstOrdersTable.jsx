import React from 'react'

import { fmtDate } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../../utils/PlantColocationUtility'
import Badge from '../../../../common/Badge'
import ScorePercent from '../ScorePercent'
import { fmtMinutes } from './serviceShared'

/** Two-line tag explaining why a single bad order was bad. Both failure
 *  modes use the warning tone — late and slow are graded warnings, not
 *  catastrophic failures (those are surfaced separately as bad-service
 *  tiers in the parent table). */
function FailureTags({ isLate, isSlow }) {
    if (!isLate && !isSlow) return null
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {isLate && (
                <Badge tone="warning" size="sm" weight="semibold" icon="clock">
                    Late
                </Badge>
            )}
            {isSlow && (
                <Badge tone="warning" size="sm" weight="semibold" icon="gauge-simple-low">
                    Slow
                </Badge>
            )}
        </div>
    )
}

export default function WorstOrdersTable({ colocationMap, plantNameByCode, rows }) {
    if (!rows.length) {
        return (
            <div className="text-[12px] py-6 text-center text-text-tertiary">No bad-service jobs in this window.</div>
        )
    }
    return (
        <div className="overflow-x-auto rounded border border-border-light">
            <table className="w-full min-w-[760px] border-collapse">
                <thead>
                    <tr className="bg-bg-tertiary">
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Date
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            Customer
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider text-left px-3 py-2 text-text-tertiary border-b border-border-light">
                            What happened
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
                    </tr>
                </thead>
                <tbody>
                    {rows.map((m) => (
                        <tr key={m.orderId} className="border-t border-border-light">
                            <td className="px-3 py-2 text-[12px] text-text-secondary tabular-nums">
                                {fmtDate(m.date)}
                            </td>
                            <td className="px-3 py-2 text-[12px] text-text-primary">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                                        {formatColocatedCodeLabel(m.plantCode, colocationMap)}
                                    </span>
                                    <span>
                                        {formatColocatedPlantLabel(m.plantCode, plantNameByCode, colocationMap)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-3 py-2 text-[12px] text-text-primary truncate max-w-[220px]">
                                {m.customer || '—'}
                            </td>
                            <td className="px-3 py-2">
                                <FailureTags isLate={m.isLate} isSlow={m.isSlow} />
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                {m.startTime || '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                                {m.firstLoadTime || '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-[12px] tabular-nums font-bold text-text-primary">
                                {m.isLate ? fmtMinutes(m.latenessMin) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {m.paceScore == null ? (
                                    <span className="text-text-tertiary">—</span>
                                ) : (
                                    <ScorePercent size="sm" value={m.paceScore} />
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
