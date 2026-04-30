import React from 'react'

/**
 * Compact summary block for one direction of inter-plant movement
 * (outbound or inbound) — colored swatch, summary line, and one row per
 * route with operator count + partner plant + arrival time.
 */
export function PlanFlowSummary({ color, label, routes, summary }) {
    return (
        <div className="flex flex-col">
            <div className="flex items-baseline gap-2 mb-0.5">
                <span className="inline-block rounded-sm" style={{ background: color, height: 8, width: 8 }} />
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </span>
            </div>
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {summary}
            </div>
            {routes.length > 0 && (
                <div className="flex flex-col gap-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {routes.map((route, i) => (
                        <div key={`${label}-${i}`} className="flex items-baseline gap-2">
                            <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                +{route.ops}
                            </span>
                            <span>
                                {route.prefix} {route.partner}
                            </span>
                            <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                {route.time}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Single dispatch-checklist row with a tappable strikeout. The checked
 * state lives in the parent so multiple rows can share one map.
 */
export function PlanChecklistRow({ accent, checked, onToggle, subtitle, text, time }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-none cursor-pointer text-left transition-colors"
            style={{
                background: checked ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                opacity: checked ? 0.65 : 1
            }}
        >
            <div
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{
                    background: checked ? accent : 'var(--bg-primary)',
                    border: `1.5px solid ${checked ? accent : 'var(--border-medium)'}`,
                    color: '#fff'
                }}
            >
                {checked && <i className="fas fa-check text-[9px]" />}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[13px] font-semibold"
                    style={{
                        color: 'var(--text-primary)',
                        textDecoration: checked ? 'line-through' : 'none'
                    }}
                >
                    {text}
                </div>
                {subtitle && (
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {subtitle}
                    </div>
                )}
            </div>
            {time && (
                <div
                    className="font-bold text-sm shrink-0 font-mono"
                    style={{ color: checked ? 'var(--text-secondary)' : accent, fontFamily: 'var(--font-heading)' }}
                >
                    {time}
                </div>
            )}
        </button>
    )
}
