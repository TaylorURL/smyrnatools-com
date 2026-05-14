import React from 'react'

/** Card shell with consistent border / radius / background tokens. */
export function Card({ children, className = '' }) {
    return <div className={`rounded-lg ${className} bg-bg-primary border border-border-light`}>{children}</div>
}

/** Header row used at the top of most account cards — icon chip + title +
 *  optional description. */
export function CardHeader({ accentColor, description, icon, title }) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
            <div
                className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className={`fas ${icon} text-[16px]`} />
            </div>
            <div className="min-w-0">
                <div className="text-[14px] font-semibold text-text-primary">{title}</div>
                {description && <div className="text-[12px] mt-0.5 text-text-tertiary">{description}</div>}
            </div>
        </div>
    )
}

/** Filled accent-color button — primary form actions. */
export function PrimaryButton({ accentColor, children, disabled, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-white px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor }}
        >
            {icon && <i className={`fas ${icon} text-[12px]`} />}
            {children}
        </button>
    )
}

/** Outlined secondary button — destructive variant flips border/fill red. */
export function SubtleButton({ children, danger = false, disabled = false, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-95"
            style={{
                background: danger ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-secondary)',
                border: `1px solid ${danger ? 'rgba(220, 38, 38, 0.35)' : 'var(--border-light)'}`,
                color: danger ? '#dc2626' : 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[12px]`} />}
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
            className="relative inline-flex shrink-0 rounded-full transition-colors border border-border-light h-6 w-11"
            style={{ background: checked ? accentColor : 'var(--bg-tertiary)' }}
        >
            <span
                className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all bg-white h-[18px] w-[18px]"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.2)', left: checked ? 22 : 2 }}
            />
        </button>
    )
}

/** Inline pill switcher — accepts a list of `{value, label, icon}` options. */
export function SegmentedControl({ accentColor, onChange, options, value }) {
    return (
        <div className="inline-flex items-center rounded-lg p-1 gap-1 bg-bg-tertiary border border-border-light">
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="rounded-md text-[12.5px] font-semibold uppercase tracking-wider px-3.5 py-2 transition-colors flex items-center gap-2"
                        style={{
                            background: active ? accentColor : 'transparent',
                            color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {opt.icon && <i className={`fas ${opt.icon} text-[12px]`} />}
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/** Single label / value detail row used in the Profile tab's scope card. */
export function DetailRow({ icon, label, mono, value }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-border-light">
            <div className="flex items-center gap-3">
                <i className={`fas ${icon} text-[13px] w-5 text-center text-text-tertiary`} />
                <span className="text-[13px] text-text-secondary">{label}</span>
            </div>
            <span className={`text-[14px] font-semibold ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}>
                {value}
            </span>
        </div>
    )
}

/** Single cell in the at-a-glance stat strip. Flat label / mono value / hint. */
export function StatCell({ hint, label, value, valueColor }) {
    return (
        <div className="px-3 py-2.5 flex flex-col gap-0.5 bg-bg-primary border-r border-border-light">
            <span className="text-[11px] text-text-secondary">{label}</span>
            <span
                className="font-semibold text-[20px] leading-tight font-mono tabular-nums"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
            </span>
            {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
        </div>
    )
}
