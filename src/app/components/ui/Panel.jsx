/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Flat data cell — label + monospace value + optional hint, with no per-cell
 * border or icon. Designed to live inside a `StatGroup` that runs the row's
 * borders for it.
 */
export function Stat({ hint, label, value, valueColor }) {
    return (
        <div className="flex flex-col gap-1 border-b border-r border-border-light bg-bg-primary px-4 py-3.5">
            <span className="text-[12px] text-text-secondary">{label}</span>
            <span
                className="font-heading text-[28px] font-semibold leading-none tracking-tight tabular-nums"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </span>
            {hint && <span className="text-[11.5px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

/**
 * Container that owns the single 1px border around a grid of `Stat`s. Each
 * `Stat` rules its own right and bottom edge; the inner grid is pulled out by
 * a pixel on both sides so the outermost rules fall under the border instead
 * of doubling it, whatever the column count wraps to.
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
            8: 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-8'
        }[columns] || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
    return (
        <div className={`overflow-hidden rounded-card border border-border-light bg-bg-primary ${className}`}>
            <div className={`grid ${colClass} -mb-px -mr-px`}>{children}</div>
        </div>
    )
}

/**
 * Section wrapper: one bordered card whose header row carries the title and
 * an optional right-aligned slot, ruled off from the content beneath.
 */
export function Panel({ children, id, right, title, className = '', innerClassName = 'p-4' }) {
    return (
        <section
            id={id}
            className={`scroll-mt-4 overflow-hidden rounded-card border border-border-light bg-bg-primary ${className}`}
        >
            {(title || right) && (
                <header className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-light px-4 py-2">
                    {title && (
                        <h2 className="m-0 min-w-0 truncate font-heading text-[16px] font-semibold tracking-tight text-text-primary">
                            {title}
                        </h2>
                    )}
                    <div className="flex-1" />
                    {right}
                </header>
            )}
            <div className={innerClassName}>{children}</div>
        </section>
    )
}
