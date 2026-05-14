/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Empty-state card shown when no list items match the active filters. */
export default function ListEmptyState({ accentColor, hasSearchOrPlant, onAddClick, statusFilter }) {
    const isCompletedFilter = statusFilter === 'completed'
    const title = isCompletedFilter ? 'No Completed Items Found' : 'No List Items Found'
    const message = hasSearchOrPlant
        ? 'No items match your search criteria.'
        : isCompletedFilter
          ? 'There are no completed items to show.'
          : 'There are no items in the list yet.'

    return (
        <div className="flex flex-col items-center justify-center mx-auto max-w-[600px] px-8 py-16 text-center">
            <div className="text-text-tertiary text-[4rem] mb-6">
                <i className="fas fa-clipboard-list" />
            </div>
            <h3 className="text-text-primary text-xl font-bold mb-2 m-0">{title}</h3>
            <p className="text-text-secondary text-[0.9375rem] mb-6 m-0">{message}</p>
            <button
                onClick={onAddClick}
                className="flex items-center border-none rounded text-white cursor-pointer text-sm font-semibold gap-2 outline-none px-5 py-2.5 transition-all duration-200"
                style={{ background: accentColor }}
            >
                <i className="fas fa-plus" />
                <span>Add Item</span>
            </button>
        </div>
    )
}
