import React, { useEffect, useRef, useState } from 'react'

import { usePreferences } from '../../../context/PreferencesContext'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const GRADIENT_CALM = 'linear-gradient(90deg, #16a34a 0%, #84cc16 55%, #f59e0b 100%)'
const GRADIENT_URGENT = 'linear-gradient(90deg, #f59e0b 0%, #f97316 55%, #dc2626 100%)'
const GRADIENT_PAST = 'linear-gradient(90deg, #94a3b8 0%, #64748b 100%)'
const GRADIENT_FUTURE = 'linear-gradient(90deg, #cbd5e1 0%, #94a3b8 100%)'

function DeadlineFuse({ daysLeft, cutoffLabel = 'Sat · 11:59 PM', todayIndex, caption, mode = 'current' }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
    const safeDaysLeft = Math.max(0, Math.min(7, Number.isFinite(daysLeft) ? daysLeft : 0))
    const isPast = mode === 'past'
    const isFuture = mode === 'future'
    const pct = isPast ? 100 : isFuture ? 0 : Math.max(4, Math.min(100, ((7 - safeDaysLeft) / 7) * 100))
    const resolvedTodayIndex = Number.isInteger(todayIndex) ? todayIndex : -1
    const urgent = mode === 'current' && safeDaysLeft <= 2
    const numberColor = isPast
        ? 'var(--text-tertiary)'
        : isFuture
          ? 'var(--text-secondary)'
          : urgent
            ? '#dc2626'
            : 'var(--text-primary)'
    const resolvedCaption =
        caption || (isPast ? 'week closed' : isFuture ? 'until opens' : `day${safeDaysLeft === 1 ? '' : 's'} left`)
    const gradient = isPast ? GRADIENT_PAST : isFuture ? GRADIENT_FUTURE : urgent ? GRADIENT_URGENT : GRADIENT_CALM
    const showShimmer = mode === 'current' && !isFuture && pct < 100
    const showPulse = urgent
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

    return (
        <div
            className="rounded px-3 py-2.5 flex items-center gap-4 flex-col sm:flex-row overflow-hidden"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                transition: 'border-color 0.4s ease'
            }}
        >
            <style>{`
                @keyframes fuse-shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
                @keyframes fuse-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.55; }
                }
                .fuse-fill {
                    height: 100%;
                    border-radius: 9999px;
                    transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                                background 0.45s ease;
                    position: relative;
                    overflow: hidden;
                }
                .fuse-fill.pulse { animation: fuse-pulse 1.6s ease-in-out infinite; }
                .fuse-shimmer {
                    position: absolute;
                    top: 0; bottom: 0;
                    width: 40%;
                    background: linear-gradient(
                        90deg,
                        rgba(255,255,255,0) 0%,
                        rgba(255,255,255,0.55) 50%,
                        rgba(255,255,255,0) 100%
                    );
                    animation: fuse-shimmer 2.2s ease-in-out infinite;
                    pointer-events: none;
                }
                .fuse-number { transition: color 0.4s ease; }
            `}</style>
            <div className="w-full sm:w-auto">
                <div
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Cutoff
                </div>
                <div
                    className="text-[13px] font-semibold mt-0.5 font-mono tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {cutoffLabel}
                </div>
            </div>
            <div className="flex-1 relative w-full pt-5">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div
                        className={`fuse-fill${showPulse ? ' pulse' : ''}`}
                        style={{ background: gradient, width: `${pct}%` }}
                    >
                        {showShimmer && <span className="fuse-shimmer" />}
                    </div>
                </div>
                <div className="absolute top-0 left-0 right-0 flex justify-between text-[9.5px] font-semibold uppercase tracking-wider">
                    {DAY_LABELS.map((d, i) => {
                        const isToday = i === resolvedTodayIndex
                        const isPastDay = !isFuture && !isPast && i < resolvedTodayIndex
                        const color = isToday
                            ? accent
                            : isPastDay
                              ? 'var(--text-secondary)'
                              : isPast
                                ? 'var(--text-secondary)'
                                : 'var(--text-tertiary)'
                        return (
                            <span key={d} style={{ color, fontWeight: isToday ? 700 : 600 }}>
                                {d}
                                {isToday ? ' •' : ''}
                            </span>
                        )
                    })}
                </div>
            </div>
            <div className="flex items-baseline gap-2 sm:block text-left sm:text-right w-full sm:w-auto">
                <div
                    className="fuse-number font-semibold text-[22px] leading-none font-mono tabular-nums"
                    style={{ color: numberColor }}
                >
                    {renderedDays}
                </div>
                <div
                    className="text-[10px] font-semibold uppercase tracking-wider mt-0 sm:mt-1"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {resolvedCaption}
                </div>
            </div>
        </div>
    )
}

export default DeadlineFuse
