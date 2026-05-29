/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SkelBar } from './SkelBar'

/** Single placeholder card matching the customer card layout. Rendered
 *  inside `CrmCustomerListSkeleton` so the grid keeps its shape
 *  during a refresh instead of going blank. */
export function CrmCustomerCardRowSkeleton() {
    return (
        <div className="rounded-md p-3 flex flex-col gap-2 border bg-bg-primary border-border-light">
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <SkelBar className="h-3.5 w-2/3" />
                    <SkelBar className="h-2.5 w-1/3" />
                </div>
                <SkelBar className="h-5 w-10" />
            </div>
            <div className="flex items-center gap-3">
                <SkelBar className="h-2.5 w-28" />
                <SkelBar className="h-2.5 w-20" />
            </div>
            <div className="flex items-center justify-between gap-2">
                <SkelBar className="h-2.5 w-24" />
                <SkelBar className="h-2.5 w-20" />
            </div>
        </div>
    )
}

/** Skeleton grid for the customer list — rendered while the roster is
 *  loading or refreshing so the dispatcher sees the layout shape
 *  instead of stale data or a blank space. Mirrors the responsive grid
 *  the live list uses. */
export function CrmCustomerListSkeleton({ count = 9 }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from({ length: count }).map((_, i) => (
                <CrmCustomerCardRowSkeleton key={i} />
            ))}
        </div>
    )
}

/** Skeleton for the full detail card — header, 4-stat block, phones,
 *  log form, service history, team history. Same vertical structure as
 *  `CrmCustomerDetail` so content slots in without a jump. Mirrors
 *  the Customer Lookup detail skeleton shape. */
export function CrmCustomerDetailSkeleton() {
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1.5">
                    <SkelBar className="h-4 w-48" />
                    <SkelBar className="h-3 w-64" />
                </div>
                <SkelBar className="h-3 w-10" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pb-4 border-b border-border-light">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <SkelBar className="h-2.5 w-16" />
                        <SkelBar className="h-5 w-20" />
                        <SkelBar className="h-2.5 w-24" />
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-1.5">
                <SkelBar className="h-2.5 w-20" />
                <SkelBar className="h-3 w-48" />
                <SkelBar className="h-3 w-40" />
            </div>
            <div className="flex flex-col gap-2.5">
                <SkelBar className="h-2.5 w-16" />
                <SkelBar className="h-16 w-full" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkelBar key={i} className="h-9 w-full" />
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <SkelBar className="h-2.5 w-40" />
                <div className="rounded-md border border-border-light p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-1">
                                <SkelBar className="h-2.5 w-16" />
                                <SkelBar className="h-5 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <SkelBar className="h-2.5 w-32" />
                <div className="rounded-md border border-border-light overflow-hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="px-4 py-2 flex items-center gap-3"
                            style={{ borderBottom: i === 2 ? 'none' : '1px solid var(--border-light)' }}
                        >
                            <SkelBar className="h-3 w-16" />
                            <div className="flex-1" />
                            <SkelBar className="h-3 w-28" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
