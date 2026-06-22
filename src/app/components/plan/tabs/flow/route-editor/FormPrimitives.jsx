/* eslint-disable react/forbid-dom-props */
import React from 'react'

export function LabeledField({ children, label }) {
    return (
        <div className="flex flex-col gap-1.5">
            <SectionLabel>{label}</SectionLabel>
            {children}
        </div>
    )
}

export function SectionLabel({ children, className = '' }) {
    return (
        <div className={`text-[11px] font-semibold uppercase tracking-wider text-text-secondary ${className}`}>
            {children}
        </div>
    )
}

/** Required-field asterisk. Visual cue only — the requirement is also
 *  enforced (gated save) and announced via the editor's status message, so
 *  the mark itself is hidden from screen readers to avoid "star" noise. */
export function RequiredMark() {
    return (
        <span aria-hidden="true" className="text-status-danger ml-0.5">
            *
        </span>
    )
}

/**
 * Numeric stepper used for operator counts. `type="text"` keeps native
 * arrow-key stepping and scroll-wheel mutation off the input so the user
 * can backspace to clear the field; `inputMode="numeric"` surfaces the
 * numeric keypad on mobile.
 */
export function CountStepperInput({ ariaLabel, max, min = 0, onBlur, onChange, value }) {
    const numericValue = parseInt(value, 10)
    const safeNumeric = Number.isFinite(numericValue) ? numericValue : 0
    const atMax = max != null && safeNumeric >= max
    const atMin = safeNumeric <= min
    const decrement = () => onChange(String(Math.max(min, safeNumeric - 1)))
    const increment = () => onChange(String(Math.min(max ?? safeNumeric + 1, safeNumeric + 1)))
    return (
        <div className="flex items-stretch rounded-lg overflow-hidden border bg-bg-primary border-border-medium transition-colors duration-150 hover:border-border-dark focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]">
            <button type="button"
                type="button"
                onClick={decrement}
                disabled={atMin}
                aria-label="Decrease"
                className="px-3 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary border-r border-border-light active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
            >
                −
            </button>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onFocus={(event) => event.target.select()}
                aria-label={ariaLabel}
                className="flex-1 px-3 py-1.5 text-sm font-mono tabular-nums text-center bg-transparent border-none outline-none text-text-primary"
            />
            <button type="button"
                type="button"
                onClick={increment}
                disabled={atMax}
                aria-label="Increase"
                className="px-3 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary border-l border-border-light active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
            >
                +
            </button>
        </div>
    )
}
