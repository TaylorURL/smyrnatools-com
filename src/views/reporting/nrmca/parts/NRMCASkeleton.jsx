import React from 'react'

function PlantCardSkeleton() {
    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary border-b border-border-light">
                <div className="w-6 h-6 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                <div className="flex-1 min-w-0">
                    <div className="h-3 w-40 rounded animate-pulse mb-1 bg-bg-tertiary" />
                    <div className="h-2.5 w-28 rounded animate-pulse bg-bg-tertiary" />
                </div>
                <div className="h-4 w-14 rounded animate-pulse bg-bg-tertiary" />
            </div>
            {[1, 2].map((r) => (
                <div key={r} className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                    <div className="w-4 shrink-0" />
                    <div className="w-6 h-6 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                    <div className="flex-1 min-w-0">
                        <div className="h-3 w-36 rounded animate-pulse mb-1 bg-bg-tertiary" />
                        <div className="h-2.5 w-48 rounded animate-pulse bg-bg-tertiary" />
                    </div>
                    <div className="h-4 w-12 rounded animate-pulse bg-bg-tertiary" />
                </div>
            ))}
        </div>
    )
}

export function NRMCASkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((g) => (
                <PlantCardSkeleton key={g} />
            ))}
        </div>
    )
}
