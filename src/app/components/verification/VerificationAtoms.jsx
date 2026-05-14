/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    FIELD_LABEL_CLASS,
    FIELD_STYLE,
    PILL_BASE,
    SECTION_LABEL_CLASS
} from '../../constants/verificationModalConstants'

/** Collapsible accordion section with icon chip, title, status pill, and chevron. */
export function Section({ accentColor, children, expanded, icon, onToggle, pill, title }) {
    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer border-none transition-colors hover:bg-bg-tertiary bg-transparent"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                        style={{ color: accentColor }}
                    >
                        <i className={`fas ${icon} text-[11px]`} />
                    </div>
                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        {title}
                    </span>
                    {pill}
                </div>
                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-[10px] text-text-tertiary`} />
            </button>
            {expanded && <div className="px-3 py-2.5 bg-bg-primary border-t border-border-light">{children}</div>}
        </div>
    )
}

/** Status pill used in section headers and severity chips. */
export function Pill({ bg, children, fg }) {
    return (
        <span className={PILL_BASE} style={{ background: bg, color: fg }}>
            {children}
        </span>
    )
}

/** Form field label with optional "Required" badge. */
export function FieldLabel({ children, required }) {
    return (
        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
            {children}
            {required && (
                <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white bg-red-600">
                    Required
                </span>
            )}
        </label>
    )
}

/** Single-line text input with matching field style. */
export function SimpleField({ label, onChange, placeholder, required, value }) {
    return (
        <div>
            <FieldLabel required={required}>{label}</FieldLabel>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                style={FIELD_STYLE}
            />
        </div>
    )
}

/** Small helper text rendered beneath inputs. */
export function Hint({ children }) {
    return <p className="mt-1 text-[10.5px] leading-snug text-text-tertiary">{children}</p>
}

/** Red error-style hint for missing required values. */
export function RequiredHint({ children }) {
    return (
        <div className="mt-1 flex items-center gap-1 text-[10.5px] text-red-600">
            <i className="fas fa-exclamation-circle text-[10px]" />
            {children}
        </div>
    )
}

/** Inline banner with warn/danger tone — used for service-overdue and high-severity callouts. */
export function Banner({ children, icon, tone = 'warn' }) {
    const palette =
        tone === 'danger'
            ? { bg: '#fee2e2', border: '#fca5a5', fg: '#b91c1c' }
            : { bg: '#fef3c7', border: '#fcd34d', fg: '#92400e' }
    return (
        <div
            className="flex items-start gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium leading-snug mb-2"
            style={{
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                color: palette.fg
            }}
        >
            <i className={`fas ${icon} text-[11px] mt-0.5 shrink-0`} />
            <span>{children}</span>
        </div>
    )
}

/** Label/value row inside the operator information panel. */
export function OperatorRow({ label, last, mono, required, value }) {
    return (
        <div
            className="flex items-start gap-3 py-2"
            style={{ borderBottom: last ? 'none' : '1px solid var(--border-light)' }}
        >
            <div className="w-[40%] shrink-0">
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </div>
                {required && (
                    <span className="mt-1 inline-flex items-center rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white bg-red-600">
                        Required
                    </span>
                )}
            </div>
            <div className={`flex-1 min-w-0 text-[12.5px] ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}>
                {value}
            </div>
        </div>
    )
}

/** Square icon button for inline actions (complete, delete, save). */
export function IconButton({ bg, fg, icon, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="flex h-6 w-6 items-center justify-center rounded border-none cursor-pointer transition-colors hover:brightness-95"
            style={{ background: bg, color: fg }}
        >
            <i className={`fas ${icon} text-[10px]`} />
        </button>
    )
}
