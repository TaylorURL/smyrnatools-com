import React from 'react'
/** Compact stat card — Plan-tab tokens, small-caps label, bold tabular value. */
export default function StatCard({ label, value, sublabel, className = '' }) {
    return (
        <div
            className={`rounded p-2.5 flex flex-col gap-0.5 ${className}`}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="text-[9.5px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
            >
                {label}
            </div>
            <div
                className="text-[15px] font-bold leading-tight tabular-nums truncate"
                style={{ color: 'var(--text-primary)' }}
            >
                {value}
            </div>
            {sublabel && (
                <div className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                    {sublabel}
                </div>
            )}
        </div>
    )
}
