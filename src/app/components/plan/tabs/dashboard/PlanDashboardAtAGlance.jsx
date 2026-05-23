/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Right-rail "at a glance" snapshot for the dashboard. Mirrors the
 * Overview stat row's numbers with a vertical, label/value layout so
 * users can sanity-check today's plan without scrolling back up.
 *
 * Hidden below `xl` breakpoint — the regular Overview row already shows
 * these on smaller screens.
 */
export function PlanDashboardAtAGlance({
    earliestClockIn,
    planDate,
    shiftSpanHours,
    specialCount,
    qcCount,
    totalOps,
    totalYardage,
    validAssignmentCount
}) {
    const dateLabel = planDate
        ? new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              weekday: 'long',
              year: 'numeric'
          })
        : ''
    const rows = [
        { label: 'Routes', value: (validAssignmentCount || 0).toString() },
        { label: 'Operators', value: (totalOps || 0).toString() },
        { label: 'Yardage', value: totalYardage.toLocaleString() },
        { label: 'Earliest clock-in', value: earliestClockIn || '—' },
        { label: 'Shift span', value: shiftSpanHours ? `${shiftSpanHours}h` : '—' },
        { label: 'Extra diligence', value: ((specialCount || 0) + (qcCount || 0)).toString() }
    ]
    return (
        <aside className="hidden xl:block sticky top-0 self-start py-5 pl-4 w-60">
            <div className="text-[12px] mb-1 text-text-tertiary">{dateLabel}</div>
            <div className="flex flex-col">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="flex items-baseline justify-between py-1.5 border-b border-border-light"
                    >
                        <span className="text-[12px] text-text-secondary">{row.label}</span>
                        <span className="text-[13px] font-semibold font-mono text-text-primary">{row.value}</span>
                    </div>
                ))}
            </div>
        </aside>
    )
}
