import React from 'react'

/** The small caps line above a comment or issue popup's title, naming the
 *  record: "MIXER 1042". */
export default function NotePopupEyebrow({ itemLabel, itemType }) {
    return (
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            {[itemType, itemLabel].filter(Boolean).join(' ')}
        </span>
    )
}
