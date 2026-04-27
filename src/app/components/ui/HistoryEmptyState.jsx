import React from 'react'
/** Centered empty state — Plan-tab dashed card matching the redesigned
 *  reports' empty-state look. */
export default function HistoryEmptyState({ title, subtitle, icon = 'fa-clock-rotate-left' }) {
    return (
        <div
            className="rounded p-6 flex flex-col items-center text-center gap-1.5"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-medium)',
                color: 'var(--text-tertiary)'
            }}
        >
            <i className={`fas ${icon} text-[20px]`} />
            <p className="m-0 text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {title}
            </p>
            {subtitle && (
                <p className="m-0 text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                    {subtitle}
                </p>
            )}
        </div>
    )
}
