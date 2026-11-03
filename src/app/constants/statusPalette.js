/**
 * One palette for every place a status is drawn: the list pill and the grid
 * card badge read `STATUS_TONE`, the list's status bar and the history popup
 * read `STATUS_COLOR`. They used to keep their own maps, so a retired truck
 * was grey in the list and red in its history, and Third Party Work was grey
 * in the list but amber on the card. The two maps below agree tone for tone.
 *
 * Charts keep their own hues on purpose: two statuses that share a tone here
 * (Active and Ready For Pickup) still need telling apart in a chart.
 */

/** Status name → Badge tone. */
export const STATUS_TONE = {
    Active: 'success',
    'Down In Yard': 'danger',
    'In Shop': 'info',
    'Light Duty': 'warning',
    'No Hire': 'danger',
    'Pending Start': 'info',
    'Ready For Pickup': 'success',
    Retired: 'neutral',
    Sold: 'neutral',
    Spare: 'neutral',
    Stationary: 'info',
    Terminated: 'danger',
    'Third Party Work': 'neutral',
    Training: 'warning',
    'Waiting For Shop': 'warning'
}

/** Status name → CSS colour, from the themed `--status-*` tokens so it follows dark mode. */
export const STATUS_COLOR = {
    Active: 'var(--status-active)',
    'Down In Yard': 'var(--status-danger)',
    'In Shop': 'var(--status-shop)',
    'Light Duty': 'var(--status-warning)',
    'No Hire': 'var(--status-danger)',
    'Pending Start': 'var(--status-shop)',
    'Ready For Pickup': 'var(--status-active)',
    Retired: 'var(--text-tertiary)',
    Sold: 'var(--text-tertiary)',
    Spare: 'var(--status-spare)',
    Stationary: 'var(--status-shop)',
    Terminated: 'var(--status-danger)',
    'Third Party Work': 'var(--status-spare)',
    Training: 'var(--status-warning)',
    'Waiting For Shop': 'var(--status-warning)'
}

/** What an unknown status is drawn in. */
export const FALLBACK_STATUS_COLOR = 'var(--text-tertiary)'
export const FALLBACK_STATUS_TONE = 'neutral'

export const getStatusTone = (status) => STATUS_TONE[status] || FALLBACK_STATUS_TONE

export const getStatusColor = (status) => STATUS_COLOR[status] || FALLBACK_STATUS_COLOR
