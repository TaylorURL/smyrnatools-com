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
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'

export const TH_BASE = `${SECTION_LABEL_CLASS} px-3 py-2 text-left whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`

export const TD_BASE = 'px-3 py-1.5 text-[12px] align-middle text-text-primary'

export const ROW_STYLE = { borderTop: '1px solid var(--border-light)', color: 'var(--text-primary)' }
