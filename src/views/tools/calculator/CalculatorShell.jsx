import React from 'react'

/**
 * Section wrapper inside a calculator's "Adjust Inputs" body. Renders a small
 * uppercase title with optional right-side action (e.g. mode toggle), then
 * the children below. Intentionally plain — no icon — matching the mockup.
 */
export const CalcSection = ({ action, children, title }) => (
    <div>
        {(title || action) && (
            <div className="flex items-center justify-between gap-3 mb-3">
                {title && (
                    <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--text-secondary)]">
                        {title}
                    </span>
                )}
                {action}
            </div>
        )}
        {children}
    </div>
)

/**
 * Labeled input with optional unit suffix. Matches the SmyrnaTools standard:
 * 1px border, rounded-md, compact padding, text-sm body. Supports children
 * for callers that need a custom control instead of a native input.
 */
export const CalcField = ({
    children,
    label,
    max,
    min,
    onChange,
    placeholder,
    step,
    suffix,
    type = 'number',
    value
}) => {
    const handleChange = (event) => onChange?.(event.target.value)
    return (
        <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--text-secondary)]">
                {label}
            </label>
            <div className="relative flex items-center">
                {children || (
                    <input
                        type={type}
                        value={value}
                        onChange={handleChange}
                        placeholder={placeholder}
                        step={step}
                        min={min}
                        max={max}
                        className={`w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] text-[13px] font-semibold outline-none transition-colors duration-150 px-2.5 py-2 focus:border-accent focus:shadow-[0_0_0_3px_rgba(30,58,95,0.10)] ${suffix ? 'pr-9' : ''}`}
                    />
                )}
                {suffix && !children && (
                    <span className="absolute right-2.5 text-[var(--text-tertiary)] font-semibold text-[11px] pointer-events-none">
                        {suffix}
                    </span>
                )}
            </div>
        </div>
    )
}

/** One stat slot in the result row. Plain text — no dividers, just spacing. */
const StatTile = ({ label, value }) => (
    <div>
        <div className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--text-tertiary)]">{label}</div>
        <div className="mt-1 text-[17px] font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
    </div>
)

/** Status badge color presets — only used for the small pill in the card head. */
const STATUS_BADGE = {
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700'
}

/**
 * Result-first wrapper for a single concrete calculator. Top card holds the
 * title, status badge, headline number(s), and a 4-up stat row. Bottom card
 * is "Adjust Inputs" with the form. Plain white surfaces — status colour
 * lives only in the badge, matching Mockup 4.
 *
 * @param {object}   props
 * @param {string}   props.icon              Font Awesome icon class shown next to the title
 * @param {string}   props.title             Calculator title
 * @param {object}   [props.status]          { kind: 'success'|'warning'|'danger'|'info', label: string }
 * @param {object}   [props.primary]         Headline number — { value, label }
 * @param {object}   [props.secondary]       Optional second number paired with primary
 * @param {Array}    [props.stats]           Optional stat tiles — [{ label, value }]
 * @param {string}   [props.placeholder]     Empty-state copy when no result
 * @param {string}   [props.placeholderIcon] Empty-state icon class
 * @param {Function} [props.onReset]         If supplied, renders a Reset button in the inputs head
 * @param {React.ReactNode} props.children   The form / input JSX
 */
const CalculatorShell = ({
    children,
    icon,
    onReset,
    placeholder = 'Enter values to calculate',
    placeholderIcon = 'fa-calculator',
    primary,
    secondary,
    stats = [],
    status,
    title
}) => {
    const hasResult = Boolean(primary)
    const badgeClass = status ? STATUS_BADGE[status.kind] || STATUS_BADGE.info : ''

    return (
        <div className="flex flex-col gap-3.5 max-w-[880px] mx-auto">
            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-2.5 font-bold text-[var(--text-primary)] text-[15px]">
                        <i className={`fas ${icon} text-accent text-[14px]`} />
                        <span>{title}</span>
                    </div>
                    {hasResult && status && (
                        <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.06em] ${badgeClass}`}
                        >
                            {status.label}
                        </span>
                    )}
                </div>
                {hasResult ? (
                    <>
                        <div className="px-7 py-9 text-center bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
                            <div className="flex items-baseline justify-center gap-3 leading-none text-accent">
                                <span className="font-bold text-[64px] md:text-[80px] tabular-nums">
                                    {primary.value}
                                </span>
                                {secondary && (
                                    <>
                                        <span className="text-[var(--text-tertiary)] text-[32px] font-semibold">/</span>
                                        <span className="font-bold text-[48px] md:text-[64px] tabular-nums opacity-80">
                                            {secondary.value}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="mt-2 text-[14px] text-[var(--text-secondary)] font-semibold">
                                {primary.label}
                                {secondary?.label ? ` · ${secondary.label}` : ''}
                            </div>
                        </div>
                        {stats.length > 0 && (
                            <div className="grid grid-cols-2 sm:[grid-template-columns:repeat(auto-fit,minmax(120px,1fr))] gap-3 px-6 py-[18px] border-t border-[var(--border-light)] bg-[var(--bg-primary)]">
                                {stats.map((s, i) => (
                                    <StatTile key={i} label={s.label} value={s.value} />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="px-6 py-12 text-center">
                        <i className={`fas ${placeholderIcon} text-[44px] text-[var(--text-tertiary)] mb-3`} />
                        <div className="text-sm text-[var(--text-secondary)]">{placeholder}</div>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-2.5 font-bold text-[var(--text-primary)] text-[15px]">
                        <i className="fas fa-sliders text-accent text-[14px]" />
                        <span>Adjust Inputs</span>
                    </div>
                    {onReset && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="flex items-center gap-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-secondary)] rounded text-[11.5px] font-semibold px-2.5 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            <i className="fas fa-redo text-[10px]" />
                            <span>Reset</span>
                        </button>
                    )}
                </div>
                <div className="px-[18px] py-5">{children}</div>
            </div>
        </div>
    )
}

export default CalculatorShell
