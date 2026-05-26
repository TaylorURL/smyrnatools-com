/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { plantBadgeColor } from '../../../utils/PlanUtility'

/**
 * Plant identifier pill — same visual treatment as the Schedule tab's
 * PlantBadge so every Plan view (Schedule, Realtime, etc.) shows the
 * plant code in the same canonical color and shape.
 *
 * Background color is data-driven (one canonical hex per plant code) so
 * inline `style` is the right tool here — the swatch encodes identity,
 * not theme. Foreground falls back to dark on the yellow swap so contrast
 * still passes.
 */
export function PlantPill({ accentColor, code, name }) {
    const background = plantBadgeColor(code, accentColor)
    const foreground = background && background.toLowerCase() === '#eab308' ? '#3f2d00' : '#fff'
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 font-semibold whitespace-nowrap shadow-sm"
            style={{ background, color: foreground }}
        >
            <span
                className="inline-flex items-center justify-center rounded-full font-bold bg-white/20 font-heading h-[18px] tabular-nums"
                style={{ color: foreground, fontSize: 10.5, minWidth: 34 }}
            >
                {code}
            </span>
            {name && <span className="text-[11.5px]">{name}</span>}
        </span>
    )
}
