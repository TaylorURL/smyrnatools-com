/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'
import { PunchDelta } from './PunchDelta'
import { LONG_SHIFT_HOURS, YPH_TARGET } from './scheduleConstants'
import { filterExceptionText, isPunchLate, isShiftLong, shiftHasRedFlag } from './scheduleFlags'
import { fmtHours, fmtTime, fmtTimeCompact } from './scheduleFormatters'
import { YphChip } from './YphChip'

/** Compact cell content for one shift inside the weekly grid. Tries to
 *  fit the three most useful signals: hours (big), scheduled in time
 *  (small), and exception / PTO markers (icon row). Hover surfaces the
 *  full punch detail. */
export function ShiftCell({ accent, shift, yardage }) {
    if (!shift) {
        return (
            <div
                className="flex items-center justify-center h-full text-text-tertiary text-[11px]"
                style={{ minHeight: 60 }}
            >
                —
            </div>
        )
    }
    if (shift.isPto) {
        return (
            <div
                className="flex flex-col items-start gap-0.5 px-2 py-1.5 h-full"
                style={{ background: 'rgba(14, 165, 233, 0.08)', minHeight: 60 }}
                title={`PTO — ${fmtHours(shift.ptoHours || shift.scheduledHours)}`}
            >
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-primary">
                    <i className="fas fa-umbrella-beach text-[9px]" />
                    PTO
                </span>
                <span className="font-mono tabular-nums font-semibold text-text-primary text-[12px]">
                    {fmtHours(shift.ptoHours || shift.scheduledHours)}
                </span>
            </div>
        )
    }
    /** Filter padded-shift exceptions (early-in / late-out) out of the
     *  raw Dayforce text — those don't count as a real exception per
     *  dispatcher's request. */
    const effectiveExceptionText = filterExceptionText(shift.exceptionText)
    const hasException = !!effectiveExceptionText
    /** Yards-per-hour for this shift — divides delivered yardage by
     *  actual hours worked. Null when we don't have a yardage match
     *  for the operator on this day (typical for a non-mixer position
     *  or a name that didn't resolve to a ticket driver). */
    const shiftYph =
        Number(shift.actualHours) > 0 && Number(yardage) > 0 ? Number(yardage) / Number(shift.actualHours) : null
    const isLowYph = shiftYph != null && shiftYph < YPH_TARGET
    /** Red flag — long shift (>14h), any late punch, OR a low-YPH
     *  shift. Outweighs the amber Dayforce-exception color so the
     *  most urgent issues are visible at a glance across the grid. */
    const hasRedFlag = shiftHasRedFlag(shift) || isLowYph
    const isLong = isShiftLong(shift.actualHours)
    const inLate = isPunchLate(shift.actualInPunchAt || shift.actualInAt, shift.scheduledInAt)
    // Numeric cells render in the theme text color regardless of flag state —
    // the inline alert icon next to the number carries the warning signal.
    const hoursColor = 'var(--text-primary)'
    const cellBg = hasRedFlag ? 'rgba(220, 38, 38, 0.08)' : hasException ? 'rgba(217, 119, 6, 0.06)' : 'transparent'
    const iconColor = 'var(--text-primary)'
    /* Padded-shift signals (early in, late out) are intentionally
     * omitted — the dispatcher only acts on short-changed shifts and
     * long shifts. */
    const flagTitle = [
        isLong ? `Long shift (>${LONG_SHIFT_HOURS}h)` : null,
        inLate ? 'Late clock-in' : null,
        isLowYph ? `Low YPH (${fmtFloat(shiftYph, 1)} < ${YPH_TARGET})` : null,
        effectiveExceptionText ? `Exception: ${effectiveExceptionText}` : null
    ]
        .filter(Boolean)
        .join(' · ')
    const tooltip = [
        `Scheduled ${fmtTime(shift.scheduledInAt)} – ${fmtTime(shift.scheduledOutAt)}`,
        `Actual ${fmtTime(shift.actualInPunchAt || shift.actualInAt)} – ${fmtTime(shift.actualOutPunchAt || shift.actualOutAt)}`,
        flagTitle || null
    ]
        .filter(Boolean)
        .join('\n')
    return (
        <div
            className="flex flex-col gap-0.5 px-2 py-1.5 h-full"
            style={{ background: cellBg, minHeight: 60 }}
            title={tooltip}
        >
            <div className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums font-semibold text-[13px]" style={{ color: hoursColor }}>
                    {fmtHours(shift.actualHours)}
                </span>
                {(hasRedFlag || hasException) && (
                    <i
                        className="fas fa-triangle-exclamation text-[10px]"
                        style={{ color: iconColor }}
                        title={flagTitle || effectiveExceptionText}
                    />
                )}
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-text-secondary font-mono tabular-nums">
                <span>{fmtTimeCompact(shift.actualInPunchAt || shift.actualInAt)}</span>
                <PunchDelta
                    accent={accent}
                    actualIso={shift.actualInPunchAt || shift.actualInAt}
                    scheduledIso={shift.scheduledInAt}
                    kind="in"
                />
                <span className="text-text-tertiary">→</span>
                <span>{fmtTimeCompact(shift.actualOutPunchAt || shift.actualOutAt)}</span>
                <PunchDelta
                    accent={accent}
                    actualIso={shift.actualOutPunchAt || shift.actualOutAt}
                    scheduledIso={shift.scheduledOutAt}
                    kind="out"
                />
            </div>
            {shiftYph != null && (
                <div className="flex items-center gap-1 mt-0.5">
                    <YphChip yph={shiftYph} />
                </div>
            )}
        </div>
    )
}
