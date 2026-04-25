import React from 'react'

/**
 * Flat data cell — label + monospace value + optional hint, with no per-cell
 * border or icon. Designed to live inside a `StatGroup` that runs the row's
 * borders for it. Used wherever the app shows tabular at-a-glance numbers.
 */
export function Stat({ hint, label, value, valueColor }) {
    return (
        <div
            className="px-3 py-2.5 flex flex-col gap-0.5"
            style={{
                background: 'var(--bg-primary)',
                borderRight: '1px solid var(--border-light)'
            }}
        >
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {label}
            </span>
            <span
                className="font-semibold text-[20px] leading-tight font-mono"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </span>
            {hint && (
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {hint}
                </span>
            )}
        </div>
    )
}

/**
 * Container that owns the single 1px border around a row of `Stat`s. The
 * inner `Stat`s carry `border-right` and the wrapper clips them via
 * `overflow-hidden` so the row reads as one unit.
 */
export function StatGroup({ children, columns = 6, className = '' }) {
    const colClass =
        {
            2: 'grid-cols-2',
            3: 'grid-cols-2 sm:grid-cols-3',
            4: 'grid-cols-2 sm:grid-cols-4',
            5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
            6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
            7: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
            8: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
        }[columns] || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
    return (
        <div
            className={`grid ${colClass} rounded overflow-hidden ${className}`}
            style={{ border: '1px solid var(--border-light)' }}
        >
            {children}
        </div>
    )
}

/**
 * Section wrapper — 14px title row with optional right-aligned action slot,
 * then a flat panel (1px border, rounded, no shadow) around the children.
 * Same visual rhythm as the Plan tab; reusable across any view that wants
 * the same flat, table-friendly aesthetic.
 */
export function Panel({ children, id, right, title, className = '', innerClassName = 'p-3' }) {
    return (
        <section id={id} className={`scroll-mt-4 flex flex-col gap-2 ${className}`}>
            {(title || right) && (
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5">
                    {title && (
                        <h3
                            className="text-[14px] font-semibold m-0 min-w-0 truncate"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {title}
                        </h3>
                    )}
                    <div className="flex-1" />
                    {right}
                </div>
            )}
            <div
                className={`rounded ${innerClassName}`}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
            >
                {children}
            </div>
        </section>
    )
}
