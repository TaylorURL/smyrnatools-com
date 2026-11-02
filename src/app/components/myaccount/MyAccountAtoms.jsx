import React from 'react'

/** Card shell with consistent border / radius / background tokens. */
export function Card({ children, className = '' }) {
    return <div className={`rounded-card border border-border-light bg-bg-primary ${className}`}>{children}</div>
}

/** Header row used at the top of most account cards — title and an optional
 *  description, ruled off from the card body. */
export function CardHeader({ accentColor: _accentColor, description, icon: _icon, title }) {
    return (
        <div className="flex items-center gap-3 border-b border-border-light px-5 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
                <div className="font-heading text-[16px] font-semibold tracking-tight text-text-primary">{title}</div>
                {description && <div className="text-[12px] text-text-tertiary">{description}</div>}
            </div>
        </div>
    )
}

/** Filled accent-color button — primary form actions. */
export function PrimaryButton({ children, disabled, icon, onClick, type = 'button' }) {
    return (
        <button type={type} onClick={onClick} disabled={disabled} className="btn-primary">
            {icon && <i className={`fas ${icon} text-[12px]`} aria-hidden="true" />}
            {children}
        </button>
    )
}

/** Outlined secondary button — the destructive variant is red. */
export function SubtleButton({ children, danger = false, disabled = false, icon, onClick, type = 'button' }) {
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={danger ? 'btn-danger' : 'btn-secondary'}>
            {icon && <i className={`fas ${icon} text-[12px]`} aria-hidden="true" />}
            {children}
        </button>
    )
}

/** iOS-style toggle switch. */
export function Toggle({ accentColor, ariaLabel, checked, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={onChange}
            className="relative inline-flex h-6 w-11 shrink-0 rounded-full border border-border-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary motion-reduce:transition-none"
            style={{ background: checked ? accentColor : 'var(--bg-tertiary)' }}
        >
            <span
                className="absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition duration-200 ease-out motion-reduce:transition-none"
                style={{ left: checked ? 22 : 2 }}
            />
        </button>
    )
}

/** Joined-button switcher — accepts a list of `{value, label, icon}` options.
 *  The chosen one is pressed in: darker fill, darker text. */
export function SegmentedControl({ onChange, options, value }) {
    return (
        <div className="inline-flex items-stretch overflow-hidden rounded-[4px] border border-border-medium bg-bg-primary">
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        type="button"
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        aria-pressed={active}
                        className={`inline-flex h-9 items-center gap-2 border-0 border-r border-solid border-border-medium px-3.5 text-[13px] cursor-pointer transition-colors duration-150 ease-out last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${
                            active
                                ? 'bg-bg-tertiary font-medium text-text-primary'
                                : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
                    >
                        {opt.icon && <i className={`fas ${opt.icon} text-[12px]`} aria-hidden="true" />}
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/** Single label / value detail row used in the Profile tab's scope card. */
export function DetailRow({ label, mono, value }) {
    return (
        <div className="flex items-center justify-between border-b border-border-light py-3 last:border-b-0">
            <span className="text-[13px] text-text-secondary">{label}</span>
            <span className={`text-[14px] font-semibold text-text-primary ${mono ? 'font-mono tabular-nums' : ''}`}>
                {value}
            </span>
        </div>
    )
}

/** Single cell in the at-a-glance stat strip. Flat label / mono value / hint. */
export function StatCell({ hint, label, value }) {
    return (
        <div className="flex min-w-0 flex-col gap-1 border-r border-border-light bg-bg-primary px-4 py-3.5 last:border-r-0">
            <span className="text-[12px] text-text-secondary">{label}</span>
            <span className="truncate font-heading text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-text-primary">
                {value}
            </span>
            {hint && <span className="truncate text-[11.5px] text-text-tertiary">{hint}</span>}
        </div>
    )
}
