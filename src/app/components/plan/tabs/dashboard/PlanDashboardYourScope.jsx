/* eslint-disable react/forbid-dom-props */
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
                <span className="inline-block rounded-sm h-2 w-2" style={{ background: color }} />
                <span className="text-[11px] text-text-secondary">{label}</span>
            </div>
            <div className="text-[13px] font-medium mb-1 text-text-primary">{summary}</div>
            {routes.length > 0 && (
                <div className="flex flex-col gap-0.5 text-[12px] text-text-secondary">
                    {routes.map((route, i) => (
                        <div key={`${label}-${i}`} className="flex items-baseline gap-2">
                            <span className="font-mono font-semibold text-text-primary">+{route.ops}</span>
                            <span>
                                {route.prefix} {route.partner}
                            </span>
                            <span className="font-mono text-text-tertiary">{route.time}</span>
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
        <button type="button"
            type="button"
            onClick={onToggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-none cursor-pointer text-left active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            style={{
                background: checked ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                opacity: checked ? 0.65 : 1
            }}
        >
            <div
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-white"
                style={{
                    background: checked ? accent : 'var(--bg-primary)',
                    border: `1.5px solid ${checked ? accent : 'var(--border-medium)'}`
                }}
            >
                {checked && <i className="fas fa-check text-[9px]" />}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[13px] font-semibold text-text-primary"
                    style={{ textDecoration: checked ? 'line-through' : 'none' }}
                >
                    {text}
                </div>
                {subtitle && <div className="text-[11px] text-text-secondary">{subtitle}</div>}
            </div>
            {time && (
                <div
                    className="font-bold text-sm shrink-0 font-mono font-heading"
                    style={{ color: checked ? 'var(--text-secondary)' : accent }}
                >
                    {time}
                </div>
            )}
        </button>
    )
}
