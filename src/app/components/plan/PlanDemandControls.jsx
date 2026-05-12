/* eslint-disable react/forbid-dom-props */
import React from 'react'

const TIME_OF_DAY_SECTIONS = [
    { color: '#6366f1', hint: '00:00–06:00', key: 'overnight', label: 'Overnight' },
    { color: '#f59e0b', hint: '06:00–12:00', key: 'morning', label: 'Morning' },
    { color: '#0ea5e9', hint: '12:00–18:00', key: 'afternoon', label: 'Afternoon' },
    { color: '#8b5cf6', hint: '18:00+', key: 'evening', label: 'Evening' }
]

/**
 * Segmented chart-mode toggle with grouped icons. Active button picks up
 * the user's accent color so the dispatcher's selection stays visible on
 * either light or dark theme.
 */
export function PlanChartModeToggle({ accentColor, onChange, options, value }) {
    return (
        <div className="flex flex-wrap gap-1">
            {options.map((option) => {
                const isActive = value === option.key
                return (
                    <button
                        key={option.key}
                        type="button"
                        onClick={() => onChange(option.key)}
                        className="flex items-center gap-1.5 rounded text-[12px] font-medium cursor-pointer px-2.5 py-1 whitespace-nowrap"
                        style={{
                            background: isActive ? accentColor : 'var(--bg-secondary)',
                            border: `1px solid ${isActive ? accentColor : 'var(--border-light)'}`,
                            color: isActive ? '#fff' : 'var(--text-secondary)'
                        }}
                        title={option.group ? `${option.group} · ${option.label}` : option.label}
                    >
                        <i className={`fas ${option.icon} text-[10px]`} />
                        <span>{option.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

/**
 * Single segmented bar showing the dispatcher-relevant time-of-day split
 * of yardage, with an inline legend. Returns null when there's no
 * yardage to chart.
 */
export function PlanTimeOfDayBar({ grandTotal, totals }) {
    if (grandTotal <= 0) return null
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider">
                <span className="text-text-tertiary">Time of day</span>
                <span className="text-text-secondary">{Math.round(grandTotal).toLocaleString()} yd total</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-bg-tertiary">
                {TIME_OF_DAY_SECTIONS.map((section) => {
                    const value = totals[section.key] || 0
                    const pct = (value / grandTotal) * 100
                    if (pct <= 0) return null
                    return (
                        <div
                            key={section.key}
                            style={{ background: section.color, width: `${pct}%` }}
                            title={`${section.label}: ${Math.round(value).toLocaleString()} yd (${pct.toFixed(1)}%)`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                {TIME_OF_DAY_SECTIONS.map((section) => {
                    const value = Math.round(totals[section.key] || 0)
                    const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0
                    return (
                        <span key={section.key} className="flex items-center gap-1.5">
                            <span
                                className="inline-block rounded-sm shrink-0 h-2 w-2"
                                style={{ background: section.color }}
                            />
                            <span className="text-text-secondary">{section.label}</span>
                            <span className="font-mono text-text-primary">{value.toLocaleString()} yd</span>
                            <span className="text-text-tertiary">
                                · {pct.toFixed(0)}% · {section.hint}
                            </span>
                        </span>
                    )
                })}
            </div>
        </div>
    )
}
