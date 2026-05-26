/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'

/**
 * Section wrapper inside a calculator's "Inputs" body. Renders a small
 * uppercase title with an optional right-side action (e.g. mode toggle),
 * then the children below. Matches the dense compact rhythm of the rest
 * of the Plan tab.
 */
export const CalcSection = ({ action, children, title }) => (
    <div>
        {(title || action) && (
            <div className="flex items-center justify-between gap-3 mb-2.5">
                {title && (
                    <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-tertiary">
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
 * Labeled input with optional unit suffix. Matches the SmyrnaTools
 * standard: 1px bordered pill, rounded-md, text-[13px], compact padding.
 * Children override the default `<input>` for callers that need a date
 * picker, native time picker, or anything else.
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
            <label className="text-[10px] font-semibold uppercase tracking-[.08em] text-text-secondary">{label}</label>
            <div className="relative flex items-center">
                {children || (
                    <input
                        className={`w-full bg-bg-primary border border-border-medium rounded-md text-text-primary text-[13px] font-semibold outline-none transition-colors duration-150 px-2.5 py-2 placeholder:text-text-tertiary [color-scheme:light] dark:[color-scheme:dark] hover:border-border-dark focus:border-accent focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:opacity-60 disabled:cursor-not-allowed ${suffix ? 'pr-9' : ''}`}
                        max={max}
                        min={min}
                        onChange={handleChange}
                        placeholder={placeholder}
                        step={step}
                        type={type}
                        value={value}
                    />
                )}
                {suffix && !children && (
                    <span className="absolute right-2.5 text-text-tertiary font-semibold text-[11px] pointer-events-none">
                        {suffix}
                    </span>
                )}
            </div>
        </div>
    )
}

const STATUS_PILL = {
    danger: { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--text-primary)' },
    info: { background: 'rgba(37, 99, 235, 0.12)', color: 'var(--text-primary)' },
    success: { background: 'rgba(22, 163, 74, 0.12)', color: 'var(--text-primary)' },
    warning: { background: 'rgba(245, 158, 11, 0.14)', color: 'var(--text-primary)' }
}

/**
 * Result-first wrapper for a single concrete calculator — rebuilt around
 * the shared Panel / StatGroup primitives so it sits in the same visual
 * register as the Plan dashboard and Statistics panels. The headline
 * stays prominent (3xl tabular numeral) but the chrome is flat — 1px
 * border, no gradient, no oversized banner.
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
    const statusStyle = status ? STATUS_PILL[status.kind] || STATUS_PILL.info : null
    return (
        <div className="flex flex-col gap-3.5 w-full">
            <Panel
                innerClassName="p-0"
                right={
                    <div className="flex items-center gap-2">
                        {icon && <i className={`fas ${icon} text-accent text-[12px]`} />}
                        {status && hasResult && (
                            <span
                                className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.06em]"
                                style={statusStyle || undefined}
                            >
                                {status.label}
                            </span>
                        )}
                    </div>
                }
                title={title}
            >
                {hasResult ? (
                    <>
                        <div className="flex items-baseline justify-between gap-4 flex-wrap px-4 py-4 border-b border-border-light">
                            <div className="min-w-0">
                                <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-text-tertiary">
                                    {primary.label}
                                </div>
                                <div className="flex items-baseline gap-3 mt-1 leading-none">
                                    <span className="text-[36px] sm:text-[44px] font-bold tabular-nums text-text-primary">
                                        {primary.value}
                                    </span>
                                    {secondary && (
                                        <>
                                            <span className="text-text-tertiary text-[24px] font-semibold">/</span>
                                            <span className="text-[28px] font-bold tabular-nums text-text-secondary">
                                                {secondary.value}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {secondary?.label && (
                                    <div className="mt-1 text-[11px] text-text-tertiary">{secondary.label}</div>
                                )}
                            </div>
                        </div>
                        {stats.length > 0 && (
                            <StatGroup
                                className="rounded-none border-0 border-t border-border-light"
                                columns={stats.length > 3 ? 4 : 3}
                            >
                                {stats.map((s, i) => (
                                    <Stat key={i} hint={s.hint} label={s.label} value={s.value} />
                                ))}
                            </StatGroup>
                        )}
                    </>
                ) : (
                    <div className="px-6 py-10 text-center">
                        <i className={`fas ${placeholderIcon} text-[32px] text-text-tertiary mb-2.5`} />
                        <div className="text-[12.5px] text-text-secondary">{placeholder}</div>
                    </div>
                )}
            </Panel>

            <Panel
                innerClassName="p-4"
                right={
                    onReset ? (
                        <button
                            className="inline-flex items-center gap-1.5 bg-bg-secondary border border-border-light text-text-secondary rounded text-[11px] font-semibold px-2 py-1 hover:bg-bg-tertiary hover:border-border-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                            onClick={onReset}
                            type="button"
                            aria-label="Reset calculator inputs"
                        >
                            <i className="fas fa-rotate-left text-[10px]" />
                            <span>Reset</span>
                        </button>
                    ) : null
                }
                title="Inputs"
            >
                {children}
            </Panel>
        </div>
    )
}

export default CalculatorShell
