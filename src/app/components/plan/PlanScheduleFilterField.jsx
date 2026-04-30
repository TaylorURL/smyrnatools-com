import React from 'react'

/** Labelled wrapper used inside the Schedule's filter drawer to give every
 *  control a consistent uppercase label + spacing. */
export default function PlanScheduleFilterField({ children, label }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            {children}
        </label>
    )
}
