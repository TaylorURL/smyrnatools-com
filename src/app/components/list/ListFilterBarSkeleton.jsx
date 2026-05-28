/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Loading-state skeleton that mirrors the new ListFilterBar shape (layout group · grouping group · filters · stats). */
export default function ListFilterBarSkeleton({ isMobile }) {
    return (
        <div className="flex items-center gap-2 rounded-[12px] border border-border-light bg-bg-secondary px-3 py-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border-light bg-bg-primary p-0.5">
                {[isMobile ? 24 : 60, isMobile ? 24 : 72, isMobile ? 24 : 72].map((w, i) => (
                    <div key={i} className="h-[26px] rounded animate-pulse bg-bg-tertiary" style={{ width: w }} />
                ))}
            </div>
            <div className="flex items-center gap-0.5 rounded-md border border-border-light bg-bg-primary p-0.5">
                {[isMobile ? 28 : 64, isMobile ? 28 : 60, isMobile ? 28 : 56, isMobile ? 28 : 56].map((w, i) => (
                    <div key={i} className="h-[26px] rounded animate-pulse bg-bg-tertiary" style={{ width: w }} />
                ))}
            </div>
            <div className="h-[30px] w-[84px] rounded-md animate-pulse bg-bg-tertiary" />
            {!isMobile && <div className="flex-1" />}
            <div className="ml-auto h-[22px] w-[60px] rounded-md animate-pulse bg-bg-tertiary" />
        </div>
    )
}
