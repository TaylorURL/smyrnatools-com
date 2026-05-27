import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'
import { YPH_TARGET } from '../../../constants/dayforceScheduleConstants'
import Badge from '../../common/Badge'

/** Yards-per-hour chip — shows the per-shift YPH next to the punch row
 *  and tints the BACKGROUND red when the operator is below the
 *  dispatcher's threshold, green when on/above target. Suppressed
 *  entirely when we don't have yardage data for this shift. */
export function YphChip({ yph }) {
    if (yph == null || !Number.isFinite(yph)) return null
    const isBelowTarget = yph < YPH_TARGET
    return (
        <Badge
            tone={isBelowTarget ? 'danger' : 'success'}
            size="xs"
            weight="semibold"
            uppercase={false}
            title={`${fmtFloat(yph, 1)} yd / hour${isBelowTarget ? ` (below ${YPH_TARGET} target)` : ''}`}
            className="tabular-nums cursor-help"
        >
            {fmtFloat(yph, 1)} y/h
        </Badge>
    )
}
