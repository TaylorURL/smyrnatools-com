import React from 'react'

const SKELETON_HEIGHT_CLASSES = ['h-[120px]', 'h-[56px]', 'h-[480px]']

export function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {SKELETON_HEIGHT_CLASSES.map((h, i) => (
                <div key={i} className={`rounded-card bg-bg-secondary border border-border-light ${h}`} />
            ))}
        </div>
    )
}
