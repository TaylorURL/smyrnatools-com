/** Status values selectable from the tractor detail status dropdown. */
export const TRACTOR_STATUSES = ['Active', 'Spare', 'In Shop', 'Retired']

/** Freight types selectable from the tractor detail freight dropdown. */
export const TRACTOR_FREIGHT_TYPES = ['Cement', 'Aggregate', 'Dump Truck']

/** Statuses that force any assigned operator to be unassigned. */
export const TRACTOR_STATUSES_FORCING_UNASSIGN = ['In Shop', 'Retired', 'Spare']

/** Display labels for each cleanliness star rating (1-5). Index 0 is unused. */
export const CLEANLINESS_RATING_LABELS = [null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

/** Disabled-input visual styling for read-only plant/operator buttons. */
export const READ_ONLY_BUTTON_STYLE = {
    backgroundColor: 'var(--card-bg)',
    cursor: 'not-allowed',
    opacity: 0.8
}

/** Disabled-input visual styling for the read-only operator-select button. */
export const READ_ONLY_OPERATOR_BUTTON_STYLE = {
    backgroundColor: 'var(--bg-secondary)',
    cursor: 'not-allowed',
    opacity: 0.8
}

/** Inline style for the undo-unassign button (matches mixer detail UX). */
export const UNDO_BUTTON_STYLE = {
    border: 'none',
    boxSizing: 'border-box',
    marginLeft: '8px',
    minWidth: '140px',
    padding: '0 16px'
}
