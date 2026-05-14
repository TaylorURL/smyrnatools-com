import React from 'react'

const ribbonSkeleton = (
    <div className="flex gap-2.5 py-1">
        {[1, 2, 3, 4].map((i) => (
            <div
                key={i}
                className="flex-1 bg-bg-primary border border-border-light rounded-lg px-4 py-3.5 animate-pulse"
            >
                <div className="h-2.5 w-16 rounded bg-slate-200 mb-2" />
                <div className="h-4 w-24 rounded bg-slate-200 mb-2.5" />
                <div className="h-2.5 w-20 rounded bg-slate-100" />
            </div>
        ))}
    </div>
)

const fuseSkeleton = (
    <div className="bg-bg-primary border border-border-light rounded-lg px-5 py-4 flex items-center gap-5 animate-pulse">
        <div className="hidden sm:block">
            <div className="h-2.5 w-14 rounded bg-slate-200 mb-2" />
            <div className="h-4 w-28 rounded bg-slate-200" />
        </div>
        <div className="flex-1 h-2 bg-slate-100 rounded-full" />
        <div className="hidden sm:block text-right">
            <div className="h-7 w-10 rounded bg-slate-200 mb-1" />
            <div className="h-2.5 w-16 rounded bg-slate-100" />
        </div>
    </div>
)

const trackGridSkeleton = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-bg-primary rounded-lg border border-border-light overflow-hidden animate-pulse">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-light">
                    <div className="w-9 h-9 rounded-lg bg-slate-200" />
                    <div className="flex-1">
                        <div className="h-3.5 w-48 rounded bg-slate-200 mb-1.5" />
                        <div className="h-2.5 w-32 rounded bg-slate-100" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-slate-200" />
                </div>
                <div className="flex gap-1 px-4 py-2.5">
                    <div className="w-6 h-2 rounded bg-slate-200 mr-1" />
                    {[1, 2, 3, 4, 5].map((j) => (
                        <div key={j} className="flex-1 h-1.5 rounded bg-slate-100" />
                    ))}
                </div>
                <div className="flex items-center justify-end px-4 pb-3.5 pt-1">
                    <div className="h-7 w-20 rounded-lg bg-slate-200" />
                </div>
            </div>
        ))}
    </div>
)

const listRowsSkeleton = (
    <div className="bg-bg-primary rounded-lg border border-border-light overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
            <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-border-light last:border-b-0 animate-pulse"
            >
                <div className="w-9 h-9 rounded-lg bg-slate-200" />
                <div className="flex-1">
                    <div className="h-3.5 w-56 rounded bg-slate-200 mb-1.5" />
                    <div className="h-2.5 w-40 rounded bg-slate-100" />
                </div>
                <div className="h-5 w-16 rounded-full bg-slate-200" />
                <div className="h-7 w-16 rounded-md bg-slate-200 hidden sm:block" />
            </div>
        ))}
    </div>
)

const railSkeleton = (
    <aside className="bg-bg-primary border border-border-light rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded bg-slate-200" />
            <div className="h-3.5 w-28 rounded bg-slate-200" />
        </div>
        <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-100" />
            ))}
        </div>
    </aside>
)

/** Combined skeleton — week ribbon + deadline fuse + (grid or list) + rail. */
export function ReportsViewSkeleton({ variant = 'grid' }) {
    return (
        <div className="flex flex-col gap-4">
            {ribbonSkeleton}
            {fuseSkeleton}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
                <div className="flex flex-col gap-3">
                    <div className="h-3 w-48 rounded bg-slate-200 animate-pulse" />
                    {variant === 'list' ? listRowsSkeleton : trackGridSkeleton}
                </div>
                {railSkeleton}
            </div>
        </div>
    )
}

/** Compact loading state used inside the Quality tab body — a stack of
 *  borderless rows that mirrors the QC list density. */
export function QualityReportsListSkeleton() {
    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                    <div className="w-6 h-6 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                    <div className="flex-1 min-w-0">
                        <div className="h-3 w-44 rounded animate-pulse mb-1 bg-bg-tertiary" />
                        <div className="h-2.5 w-56 rounded animate-pulse bg-bg-secondary" />
                    </div>
                    <div className="h-4 w-16 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                </div>
            ))}
        </div>
    )
}
