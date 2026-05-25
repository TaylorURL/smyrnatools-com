import React from 'react'

export function SummaryRow({ clockIn, returnTime, travel }) {
    return (
        <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-border-light">
            <SummaryCell label="Travel" value={travel != null ? `${travel}m` : '—'} />
            <SummaryCell label="Clock-in" value={clockIn || '—'} />
            <SummaryCell label="Return" value={returnTime || '—'} isLast />
        </div>
    )
}

function SummaryCell({ isLast = false, label, value }) {
    return (
        <div
            className={`px-3 py-2 flex flex-col gap-0.5 bg-bg-primary ${isLast ? '' : 'border-r border-border-light'}`}
        >
            <span className="text-[10.5px] text-text-secondary">{label}</span>
            <span className="text-[14px] font-semibold font-mono tabular-nums truncate text-text-primary">{value}</span>
        </div>
    )
}
