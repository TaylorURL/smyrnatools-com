import React from 'react'

/**
 * Loading placeholder block. Pulses on the tertiary surface token so it stays
 * legible in the light, dark, and gray themes, and holds still for
 * reduced-motion users. Hidden from assistive tech — announce the loading state
 * from the container instead, as `SkeletonStack` does.
 */
export default function Skeleton({ className = '', rounded = 'rounded-md' }) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse-slow motion-reduce:animate-none bg-bg-tertiary ${rounded} ${className}`}
        />
    )
}

/** Convenience wrapper for repeated skeleton rows with consistent vertical spacing. */
export function SkeletonStack({ children, count = 3, gapClassName = 'gap-2' }) {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className={`flex flex-col ${gapClassName}`}>
            <span className="sr-only">Loading…</span>
            {Array.from({ length: count }, (_, index) => (
                <React.Fragment key={index}>
                    {typeof children === 'function' ? children(index) : children}
                </React.Fragment>
            ))}
        </div>
    )
}
