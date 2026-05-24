/* Plan-tab style for the form-fields card. CSS custom properties so the
 * card adapts to dark mode, compact 12px inputs, and the `SECTION_LABEL`
 * pattern used by the redesigned report sections. */
export const FORM_SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'

export const FORM_FIELD_BASE_CLASS =
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'

export const FORM_FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
