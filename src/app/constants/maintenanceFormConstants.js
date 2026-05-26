/* ── Plan-tab design tokens (matches the redesigned reports). ────────────── */
export const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
export const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
export const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
export const FIELD_INPUT_CLASS =
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90 disabled:cursor-not-allowed transition-colors duration-150 [color-scheme:light] dark:[color-scheme:dark] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary placeholder:text-text-tertiary'

export const HISTORY_COLLAPSED_LIMIT = 3
