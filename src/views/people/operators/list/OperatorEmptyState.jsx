import React from 'react'

/**
 * Empty-state block shown when no operators match the active filters, or when
 * the roster is empty. Mirrors the original inline markup verbatim.
 */
function OperatorEmptyState({ hasActiveFilters, onAddOperator }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-users text-3xl text-slate-400"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Operators Found</h3>
            <p className="text-slate-500 mb-6 max-w-md">
                {hasActiveFilters
                    ? 'No operators match your search criteria.'
                    : 'There are no operators in the system yet.'}
            </p>
            <button
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
                onClick={onAddOperator}
            >
                Add Operator
            </button>
        </div>
    )
}

export default OperatorEmptyState
