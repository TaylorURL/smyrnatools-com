import React from 'react'

/**
 * Remounts its children whenever `animationKey` changes, so a tab or section
 * switch reads as new content easing in rather than swapping in place.
 *
 * `className` is composed after the animation class so callers can add layout
 * utilities without overriding it. Reduced motion gets the swap with no fade.
 */
export default function TabFadeIn({ animationKey, children, className }) {
    return (
        <div key={animationKey} className={`animate-fade-in-fast motion-reduce:animate-none ${className || ''}`}>
            {children}
        </div>
    )
}
