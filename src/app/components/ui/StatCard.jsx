import React from 'react'

/**
 * One hairline-ruled cell in a `StatCardGrid` strip — label above a condensed
 * number, optional line under it — the same shape as `Panel`'s `Stat` at a
 * size that fits a dialog. The cell rules only its own right and bottom edge;
 * the grid's single outline covers the rest.
 */
export default function StatCard({ label, value, sublabel, className = '' }) {
    return (
        <div
            className={`flex min-w-0 flex-col gap-0.5 border-b border-r border-border-light bg-bg-primary px-3 py-2.5 ${className}`}
        >
            <div className="truncate text-[12px] font-medium text-text-secondary">{label}</div>
            <div className="truncate font-heading text-[18px] font-semibold leading-tight tabular-nums text-text-primary">
                {value}
            </div>
            {sublabel && <div className="truncate text-[12px] text-text-tertiary">{sublabel}</div>}
        </div>
    )
}
