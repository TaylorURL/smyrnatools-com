/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import ScorePercent from '../ScorePercent'
import ServiceTierBreakdown from '../ServiceTierBreakdown'
import { BOTH_COLOR } from './serviceShared'

export default function CustomerList({ emptyMessage, rows }) {
    if (!rows.length) {
        return <div className="text-[12px] py-3 text-center text-text-tertiary">{emptyMessage}</div>
    }
    return (
        <div className="flex flex-col">
            {rows.map((row, idx) => (
                <div
                    key={row.name + idx}
                    className="flex items-center gap-2 py-1.5 border-b border-border-light last:border-b-0"
                >
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: BOTH_COLOR }}
                    >
                        {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-text-primary truncate" title={row.name}>
                            {row.name}
                        </div>
                        <div className="text-[10.5px] text-text-tertiary mb-0.5">
                            {fmtInt(row.badJobs)} bad of {fmtInt(row.jobs)} · {fmtInt(row.lateJobs)} late ·{' '}
                            {fmtInt(row.slowJobs)} slow
                        </div>
                        <ServiceTierBreakdown tierCounts={row.tierCounts} compact />
                    </div>
                    <div className="text-right shrink-0">
                        <ScorePercent value={row.goodPct} />
                        <div className="text-[10px] text-text-tertiary mt-0.5">good</div>
                    </div>
                </div>
            ))}
        </div>
    )
}
