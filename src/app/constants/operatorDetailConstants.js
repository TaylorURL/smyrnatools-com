/**
 * Shared classNames for the operator detail surfaces. `INPUT_CLASS` covers
 * text/date/tel/email inputs and inline button-as-input controls (plant
 * picker); `SELECT_CLASS` adds the chevron background plus pr-10 spacing.
 * Both match the radius/border treatment used by ManagerBasicInfoCard /
 * ManagerAssignmentCard so every detail-page form control lines up.
 */
export const INPUT_CLASS =
    'w-full rounded-xl border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none transition-colors hover:border-border-medium focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed'

export const SELECT_CLASS =
    "w-full appearance-none rounded-xl border border-border-light bg-bg-secondary px-4 py-3 pr-10 text-sm text-text-primary outline-none transition-colors hover:border-border-medium focus:border-accent cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%2364748b%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat"

export const RATING_LABELS = [null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
