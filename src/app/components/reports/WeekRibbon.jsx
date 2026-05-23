/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useRef } from 'react'

import { usePreferences } from '../../context/PreferencesContext'

const TONE_STYLES = {
    closed: { bg: '#16a34a', fg: '#16a34a' },
    future: { bg: '#94a3b8', fg: '#94a3b8' },
    late: { bg: '#dc2626', fg: '#dc2626' }
}

/**
 * Horizontally scrollable week navigation. Each card is a fixed-width button
 * representing a week; the active card is highlighted with the accent color
 * and auto-scrolled into view whenever the selection changes.
 */
function WeekRibbon({ weeks, activeIso, onPick }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
    const scrollerRef = useRef(null)
    const activeRef = useRef(null)

    useEffect(() => {
        const node = activeRef.current
        if (!node) return
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }, [activeIso])

    if (!Array.isArray(weeks) || weeks.length === 0) return null

    return (
        <div
            ref={scrollerRef}
            className="flex gap-2 py-0.5 overflow-x-auto -mx-1 px-1 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin' }}
        >
            {weeks.map((wk) => {
                const isActive = wk.iso === activeIso
                const toneBase =
                    wk.status === 'open' ? { bg: accent, fg: accent } : TONE_STYLES[wk.status] || TONE_STYLES.future
                const tone = isActive ? { bg: accent, fg: accent } : toneBase
                const borderColor = isActive ? accent : 'var(--border-light)'
                const borderWidth = isActive ? '2px' : '1px'
                // Equalize the visual padding between active and idle cards so
                // the 1px → 2px border swap doesn't shift the inner content.
                const padding = isActive ? '5px 11px' : '6px 12px'
                return (
                    <button
                        key={wk.iso}
                        ref={isActive ? activeRef : undefined}
                        type="button"
                        onClick={() => onPick?.(wk.iso)}
                        className="shrink-0 w-[180px] snap-start text-left bg-bg-primary rounded-lg transition-all duration-150 hover:-translate-y-px hover:shadow-md cursor-pointer flex items-center gap-2.5"
                        style={{
                            border: `${borderWidth} solid ${borderColor}`,
                            padding
                        }}
                    >
                        <span
                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: tone.bg }}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 leading-tight">
                                <span
                                    className="text-[9.5px] font-bold uppercase tracking-[.08em] shrink-0"
                                    style={{ color: isActive ? accent : 'var(--text-tertiary)' }}
                                >
                                    {wk.label}
                                </span>
                                <span
                                    className="text-[10px] font-semibold ml-auto truncate"
                                    style={{ color: tone.fg }}
                                    title={wk.hint}
                                >
                                    {wk.hint}
                                </span>
                            </div>
                            <div className="font-bold text-[13px] font-heading leading-tight truncate mt-px">
                                {wk.range}
                            </div>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

export default WeekRibbon
