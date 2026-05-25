/* eslint-disable react/forbid-dom-props */
import React from 'react'

export function RouteSummary({ accentColor, draft }) {
    return (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2 bg-bg-primary border border-border-light">
            <PlantTag accentColor={accentColor} code={draft.fromPlant || '—'} />
            <i className="fas fa-arrow-right text-[11px] text-text-tertiary" />
            {draft.toPlant ? (
                <PlantTag accentColor={accentColor} code={draft.toPlant} />
            ) : (
                <span className="text-[12px] italic text-text-tertiary">Pick destination…</span>
            )}
        </div>
    )
}

function PlantTag({ accentColor, code }) {
    return (
        <span
            className="inline-flex items-center justify-center rounded-md text-white text-[12px] font-semibold font-mono tabular-nums h-7 min-w-[40px] px-2"
            style={{ background: accentColor }}
        >
            {code}
        </span>
    )
}
