/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'
import { YPH_TARGET } from '../../../constants/dayforceScheduleConstants'

/** Yards-per-hour chip — shows the per-shift YPH next to the punch row
 *  and tints the BACKGROUND red when the operator is below the
 *  dispatcher's threshold. Text stays theme-aware (black in light, white
 *  in dark) — the background carries the severity signal. Suppressed
 *  entirely when we don't have yardage data for this shift. */
export function YphChip({ yph }) {
    if (yph == null || !Number.isFinite(yph)) return null
    const isLow = yph < YPH_TARGET
    const bg = isLow ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)'
    return (
        <span
            className="inline-flex items-center rounded px-1 py-0 text-[9.5px] font-semibold tabular-nums text-text-primary cursor-help"
            style={{ background: bg }}
            title={`${fmtFloat(yph, 1)} yd / hour${isLow ? ` (below ${YPH_TARGET} target)` : ''}`}
        >
            {fmtFloat(yph, 1)} y/h
        </span>
    )
}
