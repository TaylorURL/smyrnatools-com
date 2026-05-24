/* eslint-disable react/forbid-dom-props */
import React from 'react'

function PlaceholderBar({ className = '', style }) {
    return (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
}

/** Skeleton for the customer card grid — 9 placeholder cards in the same
 *  responsive grid the real list uses. Renders while the underlying
 *  service-quality query is in-flight (period / plant / comparison
 *  filter swaps) so the visible content matches the active filter
 *  selection instead of lingering on the previous window's results. */
export function CustomerCardGridSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-md p-3 flex flex-col gap-2 border bg-bg-primary border-border-light">
                    <div className="flex items-baseline justify-between gap-3">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <PlaceholderBar className="h-3.5 w-2/3" />
                            <PlaceholderBar className="h-2.5 w-1/3" />
                        </div>
                        <PlaceholderBar className="h-5 w-12" />
                    </div>
                    <PlaceholderBar className="h-1.5 w-full" />
                    <div className="flex items-center justify-between gap-2">
                        <PlaceholderBar className="h-2.5 w-20" />
                        <div className="flex items-center gap-[2px]">
                            {Array.from({ length: 12 }).map((__, j) => (
                                <PlaceholderBar key={j} className="h-1.5 w-1.5 rounded-full" />
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Skeleton for the customer detail card — header, 4-stat block, then a
 *  short order table. Rendered when the user has a customer selected
 *  but the upstream data is mid-reload. Keeps the same layout shape so
 *  the actual content slots in without a visual jump. */
export function CustomerDetailSkeleton() {
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0 flex flex-col gap-1.5">
                    <PlaceholderBar className="h-4 w-48" />
                    <PlaceholderBar className="h-3 w-64" />
                </div>
                <PlaceholderBar className="h-3 w-10" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <PlaceholderBar className="h-2.5 w-16" />
                        <PlaceholderBar className="h-5 w-20" />
                        <PlaceholderBar className="h-2.5 w-24" />
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-bg-secondary border-b border-border-light rounded-t">
                {['12%', '15%', '18%', '12%', '12%', '12%', '12%', '12%'].map((w, i) => (
                    <PlaceholderBar key={i} className="h-2.5" style={{ width: w }} />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border-light last:border-b-0">
                    {['12%', '15%', '18%', '12%', '12%', '12%', '12%', '12%'].map((w, j) => (
                        <PlaceholderBar key={j} className="h-3" style={{ width: w }} />
                    ))}
                </div>
            ))}
        </div>
    )
}
