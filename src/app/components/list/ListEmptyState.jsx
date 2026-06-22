import React from 'react'

/**
 * Lightweight empty state that complements the persistent quick-add bar.
 * Adapts copy + CTA based on whether filters/search are active vs a truly
 * empty list. When the user hasn't filtered, the message just points back
 * up to the quick-add field; when filters are active, we offer a one-tap
 * reset.
 */
export default function ListEmptyState({ hasSearchOrPlant, onReset, onAddClick, statusFilter }) {
    const isFiltered = hasSearchOrPlant || !!statusFilter
    const isCompletedFilter = statusFilter === 'completed'

    let icon = 'fa-clipboard-list'
    let title = 'No tasks yet'
    let body = 'Type a quick task above and press Enter to get started.'
    let action = null

    if (isCompletedFilter) {
        icon = 'fa-check-double'
        title = 'No completed tasks'
        body = 'Complete a task to see it land here.'
    } else if (isFiltered) {
        icon = 'fa-filter'
        title = 'No matches'
        body = 'Try adjusting filters, or clear them to see everything.'
        if (onReset) {
            action = (
                <button type="button"
                    onClick={onReset}
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-light bg-bg-primary px-3 py-1.5 text-[12px] font-medium text-text-primary transition-[background-color,transform] duration-150 hover:bg-bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <i className="fas fa-rotate-left text-[10px] opacity-70" aria-hidden="true" />
                    Clear filters
                </button>
            )
        }
    } else if (onAddClick) {
        action = (
            <button type="button"
                onClick={onAddClick}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-light bg-bg-primary px-3 py-1.5 text-[12px] font-medium text-text-primary transition-[background-color,transform] duration-150 hover:bg-bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                <i className="fas fa-sliders text-[10px] opacity-70" aria-hidden="true" />
                Open full form
            </button>
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-[420px] flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary text-text-tertiary">
                <i className={`fas ${icon} text-[18px]`} aria-hidden="true" />
            </div>
            <h3 className="m-0 text-[15px] font-semibold text-text-primary">{title}</h3>
            <p className="mb-4 mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-text-secondary">{body}</p>
            {action}
        </div>
    )
}
