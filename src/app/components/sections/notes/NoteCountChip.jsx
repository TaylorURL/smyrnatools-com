import React from 'react'

/** The quiet count beside a popup title or a tab label. */
export default function NoteCountChip({ count }) {
    return (
        <span className="inline-flex items-center rounded-full bg-bg-tertiary px-2 py-0.5 align-middle font-sans text-[11px] font-medium leading-none tabular-nums tracking-normal text-text-secondary">
            {count}
        </span>
    )
}
