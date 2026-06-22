import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'

import { CATEGORY_ICONS, POSITIONS } from '../../../constants/rmiReportConstants'
import { CARD_STYLE, SECTION_LABEL_CLASS, TH_BASE } from '../../../constants/weeklyReportConstants'
import Badge from '../../common/Badge'

/** Title + label + optional sub for each section. Right slot is used for
 *  action chips when the section header needs trailing buttons. */
export function CardHeader({ icon, label, right, sub, title }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-tight text-text-primary">{title}</div>
                    {sub && <div className="text-[10.5px] mt-0.5 text-text-tertiary">{sub}</div>}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

/** Small text+icon pill used for Pull / Add / Clear actions in section
 *  headers. `icon` is a Font Awesome suffix (e.g. "fa-plus") and is wrapped
 *  here so Badge renders it verbatim rather than treating it as a `fas fa-`
 *  suffix. */
export function ActionChip({ children, disabled, icon, onClick, title }) {
    const iconNode = icon ? <i className={`fas ${icon} text-[10px]`} aria-hidden="true" /> : null
    return (
        <Badge
            as="button"
            variant="custom"
            size="md"
            weight="semibold"
            uppercase={false}
            icon={iconNode}
            onClick={onClick}
            title={title}
            disabled={disabled}
            className="bg-bg-secondary border border-border-light text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {children}
        </Badge>
    )
}

/** Inline empty-state row used by every Rmi data table. */
export function RMIEmptyState({ icon = 'fa-user-slash', message }) {
    return (
        <div className="flex items-center justify-center gap-2 py-5 px-3 rounded text-[11.5px] bg-bg-secondary border border-border-medium text-text-tertiary">
            <i className={`fas ${icon} text-[12px]`} />
            <span>{message}</span>
        </div>
    )
}

/** Tabbed-card shell for one position (Mixer or Tractor) inside a section.
 *  Header shows the icon + label + count + optional action chips. */
export function CategoryCard({ actions, children, count, label, position }) {
    const icon = CATEGORY_ICONS[position] || CATEGORY_ICONS[POSITIONS.MIXER]
    return (
        <div className="rounded overflow-hidden flex flex-col bg-bg-secondary border border-border-light">
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 flex-wrap bg-bg-tertiary border-b border-border-light">
                <div className="flex items-center gap-2">
                    <i className={`fas ${icon} text-[11px] text-text-secondary`} />
                    <span className="text-[12px] font-semibold text-text-primary">{label}</span>
                    <Badge
                        variant="custom"
                        size="md"
                        weight="bold"
                        uppercase={false}
                        className="bg-bg-secondary border border-border-light text-text-secondary min-w-[22px] h-[18px] justify-center tabular-nums"
                    >
                        {count}
                    </Badge>
                </div>
                {actions && <div className="flex gap-1 flex-wrap">{actions}</div>}
            </div>
            <div className="p-2">{children}</div>
        </div>
    )
}

/** Generic borderless data table with consistent header / row styling.
 *  Renders the empty state when data is empty. */
export function DataTable({ data, emptyIcon = 'fa-check-circle', emptyMessage, headers, renderRow }) {
    if (!data?.length) return <RMIEmptyState icon={emptyIcon} message={emptyMessage} />
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={TH_BASE}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{data.map(renderRow)}</tbody>
            </table>
        </div>
    )
}

/** 22×22 red-tinted X button used by every removable table row. */
export function TableRowActionButton({ onClick, title }) {
    return (
        <button type="button"
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="flex items-center justify-center rounded border-none cursor-pointer bg-[rgba(220,_38,_38,_0.12)] text-text-primary h-[22px] w-[22px] hover:bg-[rgba(220,_38,_38,_0.2)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
        >
            <i className="fas fa-times text-[10px]" />
        </button>
    )
}

/** Portal-mounted modal — used by Add Trainer / Add Pending forms. Children
 *  are stacked vertically inside the body section. */
export function FormModal({ children, icon, isOpen, onClose, onSubmit, sub, submitDisabled, submitLabel, title }) {
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])
    if (!isOpen || typeof document === 'undefined') return null
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
            <div
                className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded shadow-2xl"
                style={CARD_STYLE}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-3 py-2.5 bg-bg-secondary border-b border-border-light">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                            <i className={`fas ${icon} text-[11px]`} />
                        </div>
                        <div className="min-w-0">
                            <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Action
                            </div>
                            <div className="text-[12.5px] font-semibold leading-tight text-text-primary">{title}</div>
                            {sub && <div className="text-[10.5px] mt-0.5 text-text-tertiary">{sub}</div>}
                        </div>
                    </div>
                    <button type="button"
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded border-none cursor-pointer bg-bg-tertiary text-text-secondary h-6 w-6 hover:bg-bg-hover hover:text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                </div>
                <div className="p-3 flex flex-col gap-2">{children}</div>
                <div className="flex justify-end gap-1.5 px-3 py-2.5 bg-bg-secondary border-t border-border-light">
                    <button type="button"
                        type="button"
                        onClick={onClose}
                        className="rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none bg-bg-tertiary border border-border-light text-text-secondary"
                    >
                        Cancel
                    </button>
                    <button type="button"
                        type="button"
                        onClick={onSubmit}
                        disabled={submitDisabled}
                        className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--accent, #1e3a5f)]"
                    >
                        <i className="fas fa-plus text-[10px]" />
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

/** Labeled field row inside a `FormModal`. */
export function ModalField({ children, icon, label, required }) {
    return (
        <div className="flex flex-col gap-1">
            <label className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5 text-text-tertiary`}>
                {icon && <i className={`fas ${icon} text-[10px]`} />}
                {label}
                {required && <span className="ml-0.5 text-text-primary">*</span>}
            </label>
            {children}
        </div>
    )
}
