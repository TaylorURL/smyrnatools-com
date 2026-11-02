import React from 'react'

/**
 * One option in the recap modal's joined date / type switchers. The chosen
 * one is pressed in — darker fill and text — the same as every other
 * switcher in the app; the toolbar draws the shared border around a row.
 */
function RecapFilterPill({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`h-8 border-0 border-r border-solid border-border-light px-3 text-[13px] cursor-pointer transition-colors duration-150 ease-out last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${
                active
                    ? 'bg-bg-tertiary font-medium text-text-primary'
                    : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
        >
            {label}
        </button>
    )
}

export default RecapFilterPill
