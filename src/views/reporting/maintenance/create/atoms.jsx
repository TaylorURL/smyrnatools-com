/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../../app/components/common/Badge'
import { FIELD_LABEL_CLASS, SECTION_LABEL_CLASS } from '../../../../app/constants/maintenanceCreateConstants'

export function Card({ children }) {
    return <section className="rounded overflow-hidden bg-bg-primary border border-border-light">{children}</section>
}

export function CardHeader({ accentColor, description, icon, required, title }) {
    return (
        <header className="flex items-center gap-2.5 px-4 py-3 border-b border-border-light">
            <div
                className="flex h-7 w-7 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className={`fas ${icon} text-[12px]`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    {title}
                    {required && <span className="ml-1.5 text-text-primary">*</span>}
                </div>
                {description && <div className="text-[11px] mt-0.5 text-text-tertiary">{description}</div>}
            </div>
        </header>
    )
}

export function FieldLabel({ children, required }) {
    return (
        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
            {children}
            {required && <span className="ml-1 text-text-primary">*</span>}
        </label>
    )
}

export function PrimaryButton({ accentColor, children, disabled, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

export function SubtleButton({ children, danger = false, disabled = false, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-95 border border-border-light"
            style={{
                background: danger ? '#fee2e2' : 'var(--bg-secondary)',
                color: danger ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

export function IconButton({ bg, danger, disabled, fg, icon, onClick, title }) {
    const palette = danger
        ? { bg: '#fee2e2', fg: 'var(--text-primary)' }
        : { bg: bg || 'var(--bg-tertiary)', fg: fg || 'var(--text-secondary)' }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            className="flex h-6 w-6 items-center justify-center rounded border-none cursor-pointer transition-colors hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: palette.bg, color: palette.fg }}
        >
            <i className={`fas ${icon} text-[10px]`} />
        </button>
    )
}

export function ErrorText({ children }) {
    return (
        <div className="mt-1 flex items-center gap-1 text-[10.5px] text-text-primary">
            <i className="fas fa-exclamation-circle text-[10px]" />
            <span>{children}</span>
        </div>
    )
}

export function Chip({ accentColor, children, onRemove }) {
    return (
        <Badge
            tone="neutral"
            variant="custom"
            size="md"
            weight="semibold"
            uppercase={false}
            className="bg-bg-secondary border border-border-light gap-1.5"
        >
            {children}
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="flex h-4 w-4 items-center justify-center rounded-full border-none cursor-pointer transition-colors hover:brightness-90 text-white"
                    // eslint-disable-next-line react/forbid-dom-props -- data-driven per-user accent color
                    style={{ background: accentColor }}
                    aria-label="Remove"
                >
                    <i className="fas fa-times text-[8px]" />
                </button>
            )}
        </Badge>
    )
}
