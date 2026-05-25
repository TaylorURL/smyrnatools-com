/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** One label-over-value tile in the modal's metrics strip. */
function MetricTile({ hint, label, value }) {
    return (
        <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5 bg-bg-primary border border-border-light">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
            <span
                className="font-mono font-bold text-[15px] text-text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {value}
            </span>
            {hint && <span className="text-[10.5px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

export default MetricTile
