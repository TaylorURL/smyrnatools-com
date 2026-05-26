/* Plan-tab style for the form-fields card. CSS custom properties so the
 * card adapts to dark mode, compact 12px inputs, and the `SECTION_LABEL`
 * pattern used by the redesigned report sections. `color-scheme` keeps
 * native date / time popups aligned with the active theme, and the
 * focus-visible ring matches the rest of the report inputs. */
export const FORM_SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'

export const FORM_FIELD_BASE_CLASS =
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90 disabled:cursor-not-allowed transition-colors duration-150 [color-scheme:light] dark:[color-scheme:dark] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary placeholder:text-text-tertiary'

export const FORM_FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/** Chevron-bearing select class so the dropdown affordance survives
 *  `appearance-none`. Combine with `FORM_FIELD_STYLE` for the surface. */
export const FORM_SELECT_CLASS = `${FORM_FIELD_BASE_CLASS} appearance-none cursor-pointer pr-8 bg-no-repeat bg-[right_8px_center] bg-[length:14px] bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%2394a3b8'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%3E%3Cpath%20d='M19%209l-7%207-7-7'/%3E%3C/svg%3E")]`
