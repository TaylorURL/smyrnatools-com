import React from 'react'

export function SkeletonBar({ className = '', style }) {
    return (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
}

function SkeletonRow({ i }) {
    return (
        <tr
            className="border-b border-border-light"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
        >
            <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                    <SkeletonBar className="w-6 h-6" />
                    <div className="min-w-0">
                        <SkeletonBar className="h-3 w-32 mb-1" />
                        <SkeletonBar className="h-2.5 w-24" />
                    </div>
                </div>
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-3 w-10" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-3 w-20" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-2.5 w-28 mb-1" />
                <SkeletonBar className="h-1.5 w-full rounded-full" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-4 w-16" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="w-6 h-6" />
            </td>
        </tr>
    )
}

export function ContentSkeleton({ isMobile }) {
    return (
        <div className={`flex gap-3 items-start ${isMobile ? 'flex-col' : ''}`}>
            <div className="flex-1 min-w-0 rounded overflow-hidden bg-bg-primary border border-border-light">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-bg-secondary">
                            {['w-24', 'w-10', 'w-16', 'w-20', 'w-12', 'w-6'].map((w, i) => (
                                <th key={i} className="text-left py-2 px-3 border-b border-border-light">
                                    <SkeletonBar className={`h-2.5 ${w}`} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 8 }, (_, i) => (
                            <SkeletonRow key={i} i={i} />
                        ))}
                    </tbody>
                </table>
            </div>
            {!isMobile && (
                <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">
                    {[140, 120, 160].map((h, i) => (
                        <div
                            key={i}
                            className="rounded p-3 bg-bg-primary border border-border-light"
                            style={{ animationDelay: `${i * 80}ms` }}
                        >
                            <SkeletonBar className="h-2.5 w-24 mb-2" />
                            <SkeletonBar className="rounded" style={{ height: `${h}px` }} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
