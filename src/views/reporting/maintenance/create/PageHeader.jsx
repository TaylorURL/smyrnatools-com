/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SECTION_LABEL_CLASS } from '../../../../app/constants/maintenanceCreateConstants'
import { SubtleButton } from './atoms'

export function PageHeader({ accentColor, editingForm, onBack, onRequestDelete }) {
    return (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-3 sm:px-4 md:px-6 py-2 bg-bg-primary border-b border-border-light">
            <div className="flex items-center gap-2.5 min-w-0">
                <button type="button"
                    type="button"
                    onClick={onBack}
                    className="flex h-9 w-9 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer bg-bg-tertiary shrink-0"
                    style={{ color: accentColor }}
                    aria-label="Back"
                >
                    <i className="fas fa-arrow-left text-[12px]" />
                </button>
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                        style={{ color: accentColor }}
                    >
                        <i className="fas fa-clipboard-list text-[11px]" />
                    </div>
                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        {editingForm ? 'Edit Form' : 'New Maintenance Form'}
                    </span>
                </div>
            </div>
            {editingForm && (
                <SubtleButton danger icon="fa-trash" onClick={onRequestDelete}>
                    Delete
                </SubtleButton>
            )}
        </div>
    )
}
