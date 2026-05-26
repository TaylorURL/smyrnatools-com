import React from 'react'

/**
 * Compact inline stat for the Schedule's KPI strip. Designed to sit shoulder-
 * to-shoulder with siblings inside one rounded panel, separated by hairline
 * dividers. No icons, no big colored chips — just a label, a hero number,
 * an optional unit suffix, and a one-line hint. The badge slot floats next
 * to the value (used by the yardage delta pill).
 */
export default function PlanScheduleStat({ badge, first, hint, label, unit, value }) {
    return (
        <div
            className={`flex-1 min-w-[120px] px-3.5 py-2.5 ${first ? '' : 'border-l border-border-light'}`}
        >
            <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary">{label}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5 truncate" title={String(value)}>
                <span className="font-heading font-bold leading-none text-text-primary text-[22px] tracking-tight tabular-nums">
                    {value}
                </span>
                {unit && <span className="text-[11px] font-semibold text-text-tertiary">{unit}</span>}
                {badge}
            </div>
            {hint && (
                <div className="text-[10.5px] mt-0.5 truncate text-text-secondary" title={hint}>
                    {hint}
                </div>
            )}
        </div>
    )
}
