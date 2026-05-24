/* eslint-disable react/forbid-dom-props */
import React from 'react'

export function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[120, 56, 480].map((h, i) => (
                <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
            ))}
        </div>
    )
}
