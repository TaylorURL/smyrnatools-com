/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Loading-state skeleton that mirrors the layout of ListFilterBar. */
export default function ListFilterBarSkeleton({ isMobile }) {
    return (
        <div className="flex items-center gap-2 bg-bg-secondary border-t border-border-light -mx-7 mt-4 -mb-6 px-7 py-3">
            {[72, 56, 64, 80].map((width, index) => (
                <div
                    key={index}
                    className="h-[30px] rounded-md bg-slate-200 animate-pulse"
                    style={{ width: `${width}px` }}
                />
            ))}
            <div className="h-5 w-px bg-slate-200 mx-1" />
            <div className="h-[30px] w-[80px] rounded-md bg-slate-100 animate-pulse" />
            <div className="h-[30px] w-[80px] rounded-md bg-slate-100 animate-pulse" />
            {!isMobile && <div className="flex-1" />}
            <div className="h-[24px] w-[60px] rounded-md bg-slate-100 animate-pulse ml-auto" />
        </div>
    )
}
