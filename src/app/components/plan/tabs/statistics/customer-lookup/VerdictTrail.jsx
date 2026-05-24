/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtDate } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { verdictColor, verdictLabel } from './customerLookupShared'

/** One dot per measured order, chronological. */
export default function VerdictTrail({ orders }) {
    const dots = useMemo(() => {
        const sorted = [...orders].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date)
            return (a.startMin || 0) - (b.startMin || 0)
        })
        return sorted.slice(-24)
    }, [orders])
    if (!dots.length) return null
    return (
        <div className="flex items-center gap-[2px]">
            {dots.map((m) => (
                <div
                    key={m.orderId}
                    title={`${fmtDate(m.date)} · ${verdictLabel(m)}`}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: verdictColor(m) }}
                />
            ))}
        </div>
    )
}
