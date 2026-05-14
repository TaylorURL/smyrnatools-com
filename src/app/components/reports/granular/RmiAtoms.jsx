import React from 'react'
import ReactDOM from 'react-dom'

import { CATEGORY_ICONS, POSITIONS } from '../../../constants/rmiReportConstants'
import { CARD_STYLE, SECTION_LABEL_CLASS, TH_BASE } from '../../../constants/weeklyReportConstants'

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
 *  headers. */
export function ActionChip({ accent, children, disabled, icon, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed bg-bg-secondary border border-border-light"
            style={{ color: accent || 'var(--text-secondary)' }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
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
                    <span
                        className="inline-flex items-center justify-center rounded text-[10.5px] font-bold tabular-nums bg-bg-secondary border border-border-light text-text-secondary h-[18px]"
                        style={{ minWidth: 22, padding: '0 5px' }}
                    >
                        {count}
                    </span>
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
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="flex items-center justify-center rounded border-none cursor-pointer bg-[rgba(220,_38,_38,_0.12)] text-red-700 h-[22px] w-[22px]"
        >
            <i className="fas fa-times text-[10px]" />
        </button>
    )
}

/** Portal-mounted modal — used by Add Trainer / Add Pending forms. Children
 *  are stacked vertically inside the body section. */
export function FormModal({ children, icon, isOpen, onClose, onSubmit, sub, submitDisabled, submitLabel, title }) {
    if (!isOpen || typeof document === 'undefined') return null
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
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
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border-none cursor-pointer bg-bg-tertiary text-text-secondary h-6 w-6"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                </div>
                <div className="p-3 flex flex-col gap-2">{children}</div>
                <div className="flex justify-end gap-1.5 px-3 py-2.5 bg-bg-secondary border-t border-border-light">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none bg-bg-tertiary border border-border-light text-text-secondary"
                    >
                        Cancel
                    </button>
                    <button
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
                {required && <span className="ml-0.5 text-red-600">*</span>}
            </label>
            {children}
        </div>
    )
}
