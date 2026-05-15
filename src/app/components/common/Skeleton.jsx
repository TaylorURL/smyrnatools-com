import React from 'react'

/**
 * Theme-aware skeleton placeholder. Pulses via Tailwind's animate-pulse
 * using bg-bg-tertiary so it stays legible in both light and dark mode.
 */
export default function Skeleton({ className = '', rounded = 'rounded-md' }) {
    return <div aria-hidden="true" className={`animate-pulse bg-bg-tertiary ${rounded} ${className}`} />
}

/** Convenience wrapper for repeated skeleton rows with consistent vertical spacing. */
export function SkeletonStack({ children, count = 3, gapClassName = 'gap-2' }) {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className={`flex flex-col ${gapClassName}`}>
            <span className="sr-only">Loading…</span>
            {Array.from({ length: count }, (_, i) => (
                <React.Fragment key={i}>{typeof children === 'function' ? children(i) : children}</React.Fragment>
            ))}
        </div>
    )
}
