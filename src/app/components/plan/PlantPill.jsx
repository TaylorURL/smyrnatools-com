import React from 'react'

import { plantBadgeColor } from '../../../utils/PlanUtility'

/**
 * Plant identifier pill — same visual treatment as the Schedule tab's
 * PlantBadge so every Plan view (Schedule, Realtime, etc.) shows the
 * plant code in the same canonical color and shape.
 *
 * The plant code chip uses the canonical color from `plantBadgeColor`
 * with a white-on-color treatment. The yellow `#eab308` palette swap
 * uses dark text so the contrast still passes.
 */
export function PlantPill({ accentColor, code, name }) {
    const background = plantBadgeColor(code, accentColor)
    const foreground = background && background.toLowerCase() === '#eab308' ? '#3f2d00' : '#fff'
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 font-semibold whitespace-nowrap"
            style={{ background, color: foreground }}
        >
            <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                    background: 'rgba(255,255,255,0.22)',
                    color: foreground,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 10.5,
                    height: 18,
                    minWidth: 34
                }}
            >
                {code}
            </span>
            {name && <span className="text-[11.5px]">{name}</span>}
        </span>
    )
}
