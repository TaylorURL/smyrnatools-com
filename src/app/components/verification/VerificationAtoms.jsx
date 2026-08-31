/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    FIELD_LABEL_CLASS,
    FIELD_STYLE,
    SECTION_SUBTITLE_CLASS,
    SECTION_TITLE_CLASS
} from '../../constants/verificationModalConstants'
import Badge from '../common/Badge'

const STATUS_TO_TONE = {
    attention: 'danger',
    done: 'success',
    info: 'info',
    warn: 'warning'
}

const STATUS_ICON = {
    attention: 'circle',
    done: 'check',
    info: 'circle',
    warn: 'circle'
}

/** Leading indicator on a section header. With a `count` it shows the number;
 *  without one it falls back to the tone's icon, so a section with nothing to
 *  count still reads as done or needing attention. */
export function StatusMarker({ tone = 'info', count }) {
    const resolvedTone = STATUS_TO_TONE[tone] ?? 'info'
    return (
        <Badge
            tone={resolvedTone}
            size="sm"
            shape="pill"
            weight="bold"
            icon={count == null ? STATUS_ICON[tone] : undefined}
            className="h-5 min-w-5 justify-center"
            aria-label={typeof count === 'number' ? `${count} item${count === 1 ? '' : 's'}` : undefined}
        >
            {count != null ? count : null}
        </Badge>
    )
}

export function Section({ children, expanded, onToggle, status, subtitle, title }) {
    return (
        <div className="rounded-md overflow-hidden bg-bg-primary border border-border-light">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left cursor-pointer border-none transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-tertiary bg-transparent active:scale-[0.97]"
                aria-expanded={expanded}
            >
                <span className="shrink-0">{status}</span>
                <span className="flex-1 min-w-0">
                    <span className={SECTION_TITLE_CLASS}>{title}</span>
                    {subtitle && <span className={`${SECTION_SUBTITLE_CLASS} block truncate`}>{subtitle}</span>}
                </span>
                <i
                    className={`fas fa-chevron-down text-[10px] text-text-tertiary transition-transform ${
                        expanded ? 'rotate-180' : ''
                    }`}
                />
            </button>
            {expanded && <div className="px-3.5 py-3 bg-bg-primary border-t border-border-light">{children}</div>}
        </div>
    )
}

export function Pill({ bg, children, fg }) {
    return (
        <Badge variant="custom" bg={bg} fg={fg} size="md" weight="semibold" uppercase={false}>
            {children}
        </Badge>
    )
}

export function FieldLabel({ children, required }) {
    return (
        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
            {children}
            {required && (
                <span className="text-text-primary" aria-label="required">
                    *
                </span>
            )}
        </label>
    )
}

export function SimpleField({ label, onChange, placeholder, required, value }) {
    return (
        <div>
            <FieldLabel required={required}>{label}</FieldLabel>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-offset-0 transition-shadow"
                style={FIELD_STYLE}
            />
        </div>
    )
}

export function Hint({ children }) {
    return <p className="mt-1.5 text-[11.5px] leading-snug text-text-tertiary">{children}</p>
}

export function RequiredHint({ children }) {
    return (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-text-primary">
            <i className="fas fa-exclamation-circle text-[10px]" />
            {children}
        </div>
    )
}

export function Banner({ children, icon, tone = 'warn' }) {
    const palette =
        tone === 'danger'
            ? { accent: 'var(--status-danger)', bg: 'var(--notice-danger-surface)', fg: 'var(--notice-danger-soft)' }
            : tone === 'info'
              ? { accent: 'var(--text-tertiary)', bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' }
              : {
                    accent: 'var(--notice-warning-icon)',
                    bg: 'var(--notice-warning-bg)',
                    fg: 'var(--notice-warning-strong)'
                }
    return (
        <div
            className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] leading-snug mb-2.5"
            style={{
                background: palette.bg,
                borderLeft: `3px solid ${palette.accent}`,
                color: palette.fg
            }}
        >
            {icon && <i className={`fas ${icon} text-[11px] shrink-0 leading-[1.4]`} />}
            <span>{children}</span>
        </div>
    )
}

export function OperatorRow({ label, last, mono, required, value }) {
    return (
        <div
            className="flex items-start gap-3 py-2.5"
            style={{ borderBottom: last ? 'none' : '1px solid var(--border-light)' }}
        >
            <div className="w-[38%] shrink-0 pt-0.5">
                <span className="text-[12px] font-medium text-text-secondary">
                    {label}
                    {required && (
                        <span className="ml-1 text-text-primary" aria-label="required">
                            *
                        </span>
                    )}
                </span>
            </div>
            <div className={`flex-1 min-w-0 text-[13px] ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}>
                {value}
            </div>
        </div>
    )
}

export function IconButton({ bg, fg, icon, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="flex h-7 w-7 items-center justify-center rounded-md border-none cursor-pointer transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:brightness-95 active:scale-[0.92]"
            style={{ background: bg, color: fg }}
        >
            <i className={`fas ${icon} text-[11px]`} />
        </button>
    )
}
