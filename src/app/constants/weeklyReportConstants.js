/* ── Plan-tab design tokens shared by every redesigned Weekly report
 *  (Plant Manager, General Manager, Safety, Ready Mix Instructor, etc.).
 *  Same vocabulary as the Plan toolbars: CSS custom properties for theme
 *  awareness, compact 10–13px typography, 4px corner radius. */

export const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'

export const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }

export const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

export const FIELD_INPUT_CLASS =
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90 disabled:cursor-not-allowed transition-colors duration-150 [color-scheme:light] dark:[color-scheme:dark] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary placeholder:text-text-tertiary'

/** Chevron-bearing background used to restore the dropdown affordance when a
 *  select carries `appearance-none`. Encoded inline so the stroke colour
 *  reads against every theme background. */
export const FIELD_SELECT_CLASS = `${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8 bg-no-repeat bg-[right_8px_center] bg-[length:14px] bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%2394a3b8'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%3E%3Cpath%20d='M19%209l-7%207-7-7'/%3E%3C/svg%3E")]`

export const TH_BASE = `${SECTION_LABEL_CLASS} px-3 py-2 text-left whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`

export const TD_BASE = 'px-3 py-1.5 text-[12px] align-middle text-text-primary'

export const ROW_STYLE = { borderTop: '1px solid var(--border-light)', color: 'var(--text-primary)' }
