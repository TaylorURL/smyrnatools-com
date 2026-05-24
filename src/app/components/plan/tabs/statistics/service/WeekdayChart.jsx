/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { EmptySection } from '../PlanStatisticsPages'
import ScorePercent from '../ScorePercent'

/** Mon–Sat good-service breakdown — bars in user accent, star rating
 *  above each bar so the weekday quality reads at a glance without a
 *  raw percentage. Lifted from the retired Satisfaction page. */
export default function WeekdayChart({ accentColor, data }) {
    const valid = data.filter((d) => d.score != null)
    if (valid.length === 0) {
        return <EmptySection icon="fa-calendar-week" message="No weekday ticket data yet." />
    }
    return (
        <div className="flex items-end justify-between gap-2 h-[160px] py-2">
            {data.map((bucket) => {
                const pct = bucket.score == null ? null : bucket.score / 100
                const h = pct == null ? 4 : Math.max(8, pct * 100)
                const opacity = pct == null ? 0.25 : 0.35 + pct * 0.55
                return (
                    <div key={bucket.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-end h-[120px]">
                            <ScorePercent size="sm" value={pct} />
                            <div
                                className="w-full rounded-t-sm mt-1"
                                style={{ background: accentColor, height: h, opacity }}
                            />
                        </div>
                        <span className="text-[10.5px] font-semibold text-text-secondary">{bucket.label}</span>
                        <span className="text-[9.5px] tabular-nums text-text-tertiary">
                            {bucket.samples ? `${fmtInt(bucket.samples)} ord` : ''}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
