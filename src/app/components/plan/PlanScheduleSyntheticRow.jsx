import React from 'react'

import { formatMinutesClock } from '../../../utils/PlanUtility'

/**
 * Shared visual shell for every non-order row in the schedule (truck returns,
 * help transfers, send-home recommendations, trade-off decisions, open-slot
 * suggestions). Keeps the visual rhythm consistent so order rows always read
 * as the "primary" content while synthetic rows feel like quiet annotations.
 *
 * Layout:
 *   [accent time col] [plant badge col] [pill + primary + secondary + chips]
 */
export default function PlanScheduleSyntheticRow({
    accentColor,
    animationDelayMs = 0,
    chips,
    icon,
    pillIcon,
    pillLabel,
    plantCell,
    primary,
    secondary,
    time,
    tint
}) {
    return (
        <tr
            className="animate-slide-in-row"
            style={{
                animationDelay: `${animationDelayMs}ms`,
                background: tint,
                borderLeft: `3px solid ${accentColor}`,
                borderTop: '1px solid var(--border-light)'
            }}
        >
            <td
                className="px-3 py-2 font-mono font-bold whitespace-nowrap align-top"
                style={{ color: accentColor, width: 1 }}
            >
                <span className="inline-flex items-center gap-1.5">
                    <i className={`fas ${icon} text-[11px]`} />
                    {formatMinutesClock(time)}
                </span>
            </td>
            <td className="px-3 py-2 whitespace-nowrap align-top" style={{ width: 1 }}>
                {plantCell}
            </td>
            <td className="px-3 py-2 align-top" colSpan={12}>
                <div className="flex items-start gap-2.5 text-[12px] flex-wrap">
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                        style={{ background: accentColor, color: '#fff' }}
                    >
                        <i className={`fas ${pillIcon} text-[8px]`} />
                        {pillLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {primary}
                        </div>
                        {secondary && (
                            <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                                {secondary}
                            </div>
                        )}
                        {chips}
                    </div>
                </div>
            </td>
        </tr>
    )
}
