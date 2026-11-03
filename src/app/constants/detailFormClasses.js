/** Canonical native-select look for detail-view forms: chevron via background-SVG + focus-visible ring. */
export const DETAIL_SELECT_CLS =
    "w-full min-h-[36px] appearance-none cursor-pointer rounded-[4px] border border-border-medium bg-bg-primary text-text-primary text-[13px] px-3 py-1.5 pr-9 bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem_1rem] transition-colors duration-150 hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark] bg-[url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2024%2024'%20stroke='currentColor'%3E%3Cpath%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%20d='M19%209l-7%207-7-7'%3E%3C/path%3E%3C/svg%3E\")]"

/** Picker field that opens a modal (plant, operator, tractor). Carries `form-control` so it sits at the
 *  height of the fields around it, and its own focus ring since it is a button, not an input. */
export const DETAIL_FIELD_BUTTON_CLS =
    'operator-select-button form-control text-left transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Added to a picker field button when the user cannot edit the record. */
export const DETAIL_FIELD_BUTTON_DISABLED_CLS = 'bg-bg-secondary opacity-80 cursor-not-allowed'

/** Builds a picker field button's classes, greyed out when it is disabled. */
export function detailFieldButtonCls(disabled) {
    return disabled ? `${DETAIL_FIELD_BUTTON_CLS} ${DETAIL_FIELD_BUTTON_DISABLED_CLS}` : DETAIL_FIELD_BUTTON_CLS
}

/** The red Unassign button beside an assignment picker. */
export const DETAIL_UNASSIGN_BUTTON_CLS =
    'unassign-operator-button transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** The Undo that takes the Unassign button's slot until something new is assigned: the same
 *  outlined shape in green. It used to borrow the Unassign class and paint over it, which the
 *  Unassign hover and dark-mode rules then repainted pink and red. */
export const DETAIL_UNDO_BUTTON_CLS =
    'assign-operator-button transition-transform duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
