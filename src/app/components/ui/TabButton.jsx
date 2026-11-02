import React from 'react'

/** Underline tab, the same treatment as the page and record tabs: the
 *  selected one in full-strength text over a 2px rule. Lay a row of them on a
 *  container whose bottom border the rule sits on. */
export default function TabButton({ label, isActive, onClick, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={`-mb-px shrink-0 whitespace-nowrap border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-2.5 pt-2 text-[13px] font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:text-text-primary motion-reduce:transition-none ${
                isActive
                    ? 'border-text-primary text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
            } ${className}`}
        >
            {label}
        </button>
    )
}
