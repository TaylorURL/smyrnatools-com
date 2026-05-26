import React from 'react'

/** Empty-state card shown when no list items match the active filters. */
export default function ListEmptyState({ hasSearchOrPlant, onAddClick, statusFilter }) {
    const isCompletedFilter = statusFilter === 'completed'
    const title = isCompletedFilter ? 'No Completed Items Found' : 'No List Items Found'
    const message = hasSearchOrPlant
        ? 'No items match your search criteria.'
        : isCompletedFilter
          ? 'There are no completed items to show.'
          : 'There are no items in the list yet. Add your first task to get started.'

    return (
        <div className="flex flex-col items-center justify-center mx-auto max-w-[600px] px-8 py-16 text-center animate-fade-in">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-bg-tertiary text-text-tertiary">
                <i className="fas fa-clipboard-list text-4xl" aria-hidden="true" />
            </div>
            <h3 className="font-heading text-xl font-semibold text-text-primary m-0">{title}</h3>
            <p className="mt-2 mb-6 max-w-md text-sm text-text-secondary">{message}</p>
            <button
                onClick={onAddClick}
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary shadow-sm motion-reduce:transition-none"
            >
                <i className="fas fa-plus" aria-hidden="true" />
                <span>Add Item</span>
            </button>
        </div>
    )
}
