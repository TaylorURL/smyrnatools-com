import React from 'react'

import { fmtFloat, fmtInt, fmtMinutesAsHHMM } from '../../../../../utils/PlanStatisticsFormatUtility'
import { BIG_POUR_SPACING_THRESHOLD_MIN, BIG_POUR_YARDAGE_THRESHOLD } from '../../../../../utils/PlanUtility'
import { Stat, StatGroup } from '../../../ui/Panel'
import { DeltaHint } from './PlanStatisticsCharts'

/** Compact KPI strip — context, not the headline. Six tiles spanning total
 *  yardage, daily average, yards/load, peak hour, shift span, and big pours.
 *  Each tile shows a subtle Δ% pill when the previous-period summary exists. */
export function PlanStatisticsKpiStrip({ currentSummary, previousSummary, workingDayCount }) {
    return (
        <StatGroup columns={6}>
            <Stat
                label="Total yardage"
                value={fmtInt(currentSummary.totalYardage)}
                hint={
                    <DeltaHint
                        base={`${fmtInt(currentSummary.totalLoads)} loads`}
                        current={currentSummary.totalYardage}
                        previous={previousSummary?.totalYardage}
                    />
                }
            />
            <Stat
                label="Avg per day"
                value={fmtInt(currentSummary.avgYardagePerActiveDay)}
                hint={
                    <DeltaHint
                        base={`${currentSummary.daysWithProduction} of ${workingDayCount} working day${workingDayCount === 1 ? '' : 's'}`}
                        current={currentSummary.avgYardagePerActiveDay}
                        previous={previousSummary?.avgYardagePerActiveDay}
                    />
                }
            />
            <Stat
                label="Yards / load"
                value={currentSummary.yardagePerLoad != null ? fmtFloat(currentSummary.yardagePerLoad) : '—'}
                hint={
                    <DeltaHint
                        base="utilization"
                        current={currentSummary.yardagePerLoad}
                        previous={previousSummary?.yardagePerLoad}
                    />
                }
            />
            <Stat
                label="Peak hour"
                value={
                    currentSummary.peakHour && currentSummary.peakHour.loads > 0
                        ? fmtMinutesAsHHMM(currentSummary.peakHour.hour * 60).replace(':00', '')
                        : '—'
                }
                hint={
                    currentSummary.peakHour && currentSummary.peakHour.loads > 0
                        ? `${currentSummary.peakHour.loads} loads start`
                        : 'no start times'
                }
            />
            <Stat
                label="Avg shift span"
                value={
                    currentSummary.avgShiftSpanHours != null ? `${fmtFloat(currentSummary.avgShiftSpanHours)}h` : '—'
                }
                hint={
                    <DeltaHint
                        base="first → last job"
                        current={currentSummary.avgShiftSpanHours}
                        previous={previousSummary?.avgShiftSpanHours}
                    />
                }
            />
            <Stat
                label="Big pours"
                value={fmtInt(currentSummary.bigPours.length)}
                hint={
                    currentSummary.bigPours.length > 0
                        ? `>${BIG_POUR_YARDAGE_THRESHOLD} yd³ · <${BIG_POUR_SPACING_THRESHOLD_MIN}m spacing`
                        : 'none scheduled'
                }
            />
        </StatGroup>
    )
}

export default PlanStatisticsKpiStrip
