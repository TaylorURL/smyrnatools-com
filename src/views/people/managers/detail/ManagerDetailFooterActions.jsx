import React from 'react'

/**
 * Footer-row action buttons for the manager detail view. Renders the
 * save/delete pair when editing is allowed, or a view-only badge otherwise.
 */
export default function ManagerDetailFooterActions({
    isReadOnly,
    canEditManager,
    canDeleteManager,
    isSaving,
    onSave,
    onRequestDelete
}) {
    if (!isReadOnly && canEditManager) {
        return (
            <>
                <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-light bg-bg-primary px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
                    onClick={onSave}
                    disabled={isSaving}
                >
                    <i className="fas fa-save"></i>
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                {canDeleteManager && (
                    <button
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-light bg-bg-primary px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
                        onClick={onRequestDelete}
                        disabled={isSaving}
                    >
                        <i className="fas fa-trash-alt"></i>
                        <span>Delete</span>
                    </button>
                )}
            </>
        )
    }
    return (
        <div className="flex items-center gap-2 text-text-secondary text-sm font-medium">
            <i className="fas fa-lock"></i>
            <span>View-Only Mode</span>
        </div>
    )
}
