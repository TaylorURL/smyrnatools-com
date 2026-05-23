/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useRef, useState } from 'react'

import { usePreferences } from '../../context/PreferencesContext'

/** Mon → Mon, 8-day cutoff window. The submission window opens Monday and
 *  closes the following Monday at 7:00 AM CST, so the strip has 8 cells. */
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M']

const COLOR_DONE = '#16a34a'
const COLOR_PAST = '#94a3b8'
const COLOR_URGENT = '#dc2626'
const COLOR_EMPTY = 'var(--bg-tertiary)'

/**
 * Compact deadline indicator. The previous gradient + day-row design was
 * hard to read at a glance and clashed with the surrounding chrome.
 * This version uses 8 discrete day pills (one per day in the Mon→Mon
 * cutoff window):
 *   - past days fill with a muted slate
 *   - today fills with the accent color and gets a 2px ring
 *   - future days are empty (`bg-tertiary`)
 *   - urgent mode (≤ 2 days left in current week) swaps the active fill
 *     to red and pulses today's pill so the dispatcher can't miss it
 * To the right of the pills sits a bold days-left counter and the
 * cutoff label so the absolute deadline is always visible.
 *
 * Renders inline-friendly markup (no outer card) when `embedded` is
 * true so it can drop into the summary bar without doubling borders.
 */
function DeadlineFuse({
    caption,
    cutoffLabel = 'Mon · 7:00 AM CST',
    daysLeft,
    embedded = false,
    mode = 'current',
    todayIndex
}) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'

    const MAX_DAYS = DAY_LETTERS.length
    const safeDaysLeft = Math.max(0, Math.min(MAX_DAYS, Number.isFinite(daysLeft) ? daysLeft : 0))
    const isPast = mode === 'past'
    const isFuture = mode === 'future'
    const urgent = mode === 'current' && safeDaysLeft <= 2
    const resolvedTodayIndex = Number.isInteger(todayIndex) ? todayIndex : -1

    const numberColor = isPast
        ? 'var(--text-tertiary)'
        : isFuture
          ? 'var(--text-secondary)'
          : urgent
            ? COLOR_URGENT
            : 'var(--text-primary)'
    const resolvedCaption =
        caption || (isPast ? 'week closed' : isFuture ? 'until opens' : `day${safeDaysLeft === 1 ? '' : 's'} left`)

    const [displayDays, setDisplayDays] = useState(safeDaysLeft)
    const frameRef = useRef(null)
    const startRef = useRef(null)
    useEffect(() => {
        if (displayDays === safeDaysLeft) return
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        const start = displayDays
        const end = safeDaysLeft
        const duration = 450
        startRef.current = null
        const step = (ts) => {
            if (startRef.current == null) startRef.current = ts
            const elapsed = ts - startRef.current
            const t = Math.min(1, elapsed / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setDisplayDays(start + (end - start) * eased)
            if (t < 1) frameRef.current = requestAnimationFrame(step)
        }
        frameRef.current = requestAnimationFrame(step)
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeDaysLeft])
    const renderedDays = isPast ? '—' : Math.round(displayDays)

    const inner = (
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
            {/* Day pills: when embedded the row stretches to fill its
             *  parent (each pill column is flex-1), giving the deadline
             *  block real horizontal presence next to the summary cells.
             *  Standalone (Review tab) keeps fixed-width columns. */}
            <div className={embedded ? 'flex items-end gap-1.5 flex-1 min-w-0' : 'flex items-end gap-1 shrink-0'}>
                {DAY_LETTERS.map((letter, i) => {
                    const isToday = !isPast && !isFuture && i === resolvedTodayIndex
                    const isPastDay = isPast || (!isFuture && i < resolvedTodayIndex)
                    let fill = COLOR_EMPTY
                    if (isToday) fill = urgent ? COLOR_URGENT : accent
                    else if (isPastDay) fill = isPast ? COLOR_PAST : COLOR_DONE
                    const labelColor = isToday
                        ? urgent
                            ? COLOR_URGENT
                            : accent
                        : isPastDay
                          ? 'var(--text-secondary)'
                          : 'var(--text-tertiary)'
                    return (
                        <div
                            key={`${letter}-${i}`}
                            className={
                                embedded
                                    ? 'flex flex-col items-center gap-0.5 flex-1 min-w-0'
                                    : 'flex flex-col items-center gap-0.5 w-3.5'
                            }
                        >
                            <span className="text-[9px] font-bold uppercase leading-none" style={{ color: labelColor }}>
                                {letter}
                            </span>
                            <span
                                className={`block ${embedded ? 'w-full' : 'w-2.5'} h-4 rounded-sm transition-colors duration-300${
                                    isToday && urgent ? ' animate-fuse-pulse' : ''
                                }`}
                                style={{
                                    background: fill,
                                    boxShadow: isToday ? `0 0 0 1.5px ${urgent ? COLOR_URGENT : accent}` : 'none'
                                }}
                            />
                        </div>
                    )
                })}
            </div>
            <div className="flex flex-col items-end leading-tight shrink-0 min-w-0">
                <div className="flex items-baseline gap-1">
                    <span
                        className="font-mono text-[22px] sm:text-[20px] font-semibold tabular-nums leading-none transition-colors duration-300"
                        style={{ color: numberColor }}
                    >
                        {renderedDays}
                    </span>
                    {!isPast && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">d</span>
                    )}
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary mt-0.5">
                    {resolvedCaption}
                </span>
                {!isPast && (
                    <span
                        className="text-[9.5px] font-mono tabular-nums text-text-tertiary mt-0.5 whitespace-nowrap"
                        title="Cutoff time"
                    >
                        to {cutoffLabel}
                    </span>
                )}
            </div>
        </div>
    )

    if (embedded) return inner

    return (
        <div
            className="rounded-lg px-3 py-2 bg-bg-primary border border-border-light"
            style={{ transition: 'border-color 0.4s ease' }}
        >
            {inner}
        </div>
    )
}

export default DeadlineFuse
