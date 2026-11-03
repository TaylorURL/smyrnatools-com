import React from 'react'

/**
 * The outline around a strip of `StatCard`s, as `Panel`'s `StatGroup` draws
 * it: one 1px border, with the cells ruling each other. The inner grid is
 * pulled out a pixel right and down so the outermost cell rules fall under
 * the border instead of doubling it, however many columns the width fits.
 *
 * Columns fit the width unless `columns={2}` pins two, for a narrow column
 * like the timeline's analysis panel; an odd last cell then takes the whole
 * row rather than leaving a hole beside it.
 */
export default function StatCardGrid({ children, className = '', columns }) {
    const colClass =
        columns === 2
            ? 'grid-cols-2 [&>*:last-child:nth-child(odd)]:col-span-2'
            : 'grid-cols-[repeat(auto-fit,minmax(120px,1fr))]'
    return (
        <div className={`overflow-hidden rounded-card border border-border-light bg-bg-primary ${className}`}>
            <div className={`-mb-px -mr-px grid ${colClass}`}>{children}</div>
        </div>
    )
}
