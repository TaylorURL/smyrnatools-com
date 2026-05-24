import React from 'react'

/**
 * Empty-state panel rendered inside `AssetView` when no items match the
 * current search / filter combo. Calls back to open the add sheet unless
 * there's an active search (in which case adding is unlikely to be useful).
 */
export default function AssetEmptyState({ config, filters, onAdd }) {
    const hasActiveScope =
        filters.searchText || filters.selectedPlant || (filters.statusFilter && filters.statusFilter !== 'All Statuses')

    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-bg-hover">
                <i className={`fas ${config.emptyState.icon} text-3xl text-text-secondary`} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-text-primary">{config.emptyState.title}</h3>
            <p className="text-sm mb-6 max-w-md text-text-secondary">
                {hasActiveScope
                    ? 'No items match your search criteria.'
                    : `There are no ${config.pluralLabel.toLowerCase()} in the system yet.`}
            </p>
            {!filters.searchText && (
                <button
                    className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
                    onClick={onAdd}
                >
                    {config.emptyState.addLabel}
                </button>
            )}
        </div>
    )
}
