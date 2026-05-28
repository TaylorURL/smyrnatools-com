import React, { useMemo } from 'react'

import { useOperatorClockStatusContext } from '../../../../context/OperatorClockStatusContext'
import { PlantBadge } from '../schedule/PlanScheduleBadges'

/** Yardage row in the schedule-tab visual language: a colored PlantBadge
 *  on the left, the day's yardage as a heading-font hero value on the
 *  right with a `yd` unit suffix. Hairline divider beneath each row mirrors
 *  the stat rows above so the section reads as the same column extended. */
function YardageRow({ accentColor, code, plantNameByCode, yardage }) {
    const name = plantNameByCode?.[code]
    return (
        <div
            className="flex items-center justify-between gap-2 py-1.5 border-b border-border-light"
            title={
                name ? `${code} — ${name} · ${yardage.toLocaleString()} yd` : `${code} · ${yardage.toLocaleString()} yd`
            }
        >
            <PlantBadge code={code} fallback={accentColor} />
            <span className="flex items-baseline gap-1 shrink-0">
                <span className="font-heading font-bold leading-none text-text-primary text-[15px] tracking-tight tabular-nums">
                    {yardage.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">yd</span>
            </span>
        </div>
    )
}

/** Yardage-by-plant breakdown — schedule-tab vocabulary: PlantBadge chips,
 *  hairline dividers, heading-font hero values with tabular numerals. Zero-
 *  yardage plants are hidden so the list stays scannable. Sorted descending
 *  so the top producer reads first. */
function YardageByPlantRail({ accentColor, plantNameByCode, plantProduction, stats }) {
    const rows = useMemo(
        () =>
            (stats || [])
                .map((stat) => ({
                    code: stat.code,
                    yardage: parseFloat(plantProduction?.[stat.code]?.totalYardage) || 0
                }))
                .filter((row) => row.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage),
        [stats, plantProduction]
    )

    if (!rows.length) return null

    return (
        <div className="mt-4">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary mb-1.5">
                Yardage By Plant
            </div>
            <div className="flex flex-col">
                {rows.map((row) => (
                    <YardageRow
                        key={row.code}
                        accentColor={accentColor}
                        code={row.code}
                        plantNameByCode={plantNameByCode}
                        yardage={row.yardage}
                    />
                ))}
            </div>
        </div>
    )
}

/**
 * Right-rail "at a glance" snapshot for the dashboard. Mirrors the
 * Overview stat row's numbers with a vertical, label/value layout so
 * users can sanity-check today's plan without scrolling back up, and a
 * compact yardage-by-plant breakdown underneath.
 *
 * Hidden below `xl` breakpoint — the regular Overview row already shows
 * these on smaller screens.
 */
export function PlanDashboardAtAGlance({
    accentColor,
    earliestClockIn,
    planDate,
    plantNameByCode,
    plantProduction,
    shiftSpanHours,
    stats,
    totalOps,
    totalYardage,
    validAssignmentCount
}) {
    const { statusByBadge } = useOperatorClockStatusContext()
    const clockedInCount = useMemo(() => {
        let count = 0
        statusByBadge.forEach((record) => {
            if (record.isClockedIn) count += 1
        })
        return count
    }, [statusByBadge])

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
        { label: 'Clocked In', value: clockedInCount.toLocaleString() },
        { label: 'Operators Assisting', value: (totalOps || 0).toString() },
        { label: 'Yardage', value: totalYardage.toLocaleString() },
        { label: 'Earliest Clock-In', value: earliestClockIn || '—' },
        { label: 'Shift Span', value: shiftSpanHours ? `${shiftSpanHours}h` : '—' }
    ]
    return (
        <aside className="hidden xl:block sticky top-0 self-start py-5 pl-4 w-60 max-h-screen overflow-y-auto">
            <div className="text-[12px] font-medium mb-1.5 text-text-tertiary uppercase tracking-wider">
                {dateLabel}
            </div>
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
            <YardageByPlantRail
                accentColor={accentColor}
                plantNameByCode={plantNameByCode}
                plantProduction={plantProduction}
                stats={stats}
            />
        </aside>
    )
}
