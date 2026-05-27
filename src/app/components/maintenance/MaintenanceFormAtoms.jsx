/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { isDarkLikeTheme } from '../../constants/themeConstants'
import { usePreferences } from '../../context/PreferencesContext'
import Badge from '../common/Badge'

/* Plan-tab inspired atoms shared by every Maintenance form surface — kept in
 * one place so the badge / chip / icon language stays in lockstep across the
 * combined Log workflow, the Manage Forms list, and any future modal flows.
 *
 * Theme-awareness: each tinted swatch carries a separate `darkBg` / `darkFg`
 * so the badges stay readable in dark mode (the original solid pastels were
 * over-bright on dark surfaces). The components subscribe to preferences
 * directly so call sites don't have to prop-drill `isDark`. */

/** Canonical status palette — light + dark variants. Retained for the
 *  non-badge consumers (`ItemIcon`) that still need direct tint access. */
const STATUS_PALETTE = {
    approved: { bg: '#dcfce7', darkBg: 'rgba(34,197,94,0.18)', darkFg: '#4ade80', fg: '#166534' },
    completed: { bg: '#dcfce7', darkBg: 'rgba(34,197,94,0.18)', darkFg: '#4ade80', fg: '#166534' },
    overdue: { bg: '#fee2e2', darkBg: 'rgba(239,68,68,0.18)', darkFg: '#f87171', fg: '#b91c1c' },
    pending: { bg: '#fef3c7', darkBg: 'rgba(251,191,36,0.18)', darkFg: '#fbbf24', fg: '#92400e' },
    rejected: { bg: '#fee2e2', darkBg: 'rgba(239,68,68,0.18)', darkFg: '#f87171', fg: '#b91c1c' },
    submitted: { bg: '#dbeafe', darkBg: 'rgba(59,130,246,0.20)', darkFg: '#60a5fa', fg: '#1e40af' }
}

const FALLBACK_TINT = {
    bg: 'var(--bg-tertiary)',
    darkBg: 'var(--bg-tertiary)',
    darkFg: 'var(--text-secondary)',
    fg: 'var(--text-secondary)'
}

const ICON_BY_STATUS = {
    approved: 'fa-check-circle',
    completed: 'fa-check-circle',
    overdue: 'fa-exclamation-circle',
    pending: 'fa-clipboard-list',
    rejected: 'fa-times-circle',
    submitted: 'fa-clock'
}

/** Maps a maintenance status string to the unified Badge tone palette. */
const STATUS_TO_TONE = {
    approved: 'success',
    completed: 'success',
    overdue: 'danger',
    pending: 'warning',
    rejected: 'danger',
    submitted: 'info'
}

/** Resolve a tint pair against the user's current theme. */
function useTint(palette) {
    const { preferences } = usePreferences()
    const isDark = isDarkLikeTheme(preferences?.themeMode)
    return {
        background: isDark ? palette.darkBg : palette.bg,
        color: isDark ? palette.darkFg : palette.fg
    }
}

/** Compact status badge — delegates to the unified Badge with a maintenance
 *  status → tone mapping. */
export function StatusBadge({ status }) {
    return (
        <Badge tone={STATUS_TO_TONE[status] || 'neutral'} size="xs" weight="bold">
            {status}
        </Badge>
    )
}

/** Plant code chip — consistent blue tint across every list / table. */
export function PlantChip({ code }) {
    if (!code) return <span className="text-text-tertiary">—</span>
    return (
        <Badge tone="info" size="xs" weight="bold" className="font-mono tabular-nums">
            {code}
        </Badge>
    )
}

/** Square status icon — used as the row leader in the combined log list. */
export function ItemIcon({ status }) {
    const icon = ICON_BY_STATUS[status] || ICON_BY_STATUS.pending
    const tint = useTint(STATUS_PALETTE[status] || FALLBACK_TINT)
    return (
        <div className="flex items-center justify-center w-6 h-6 rounded shrink-0" style={tint}>
            <i className={`fas ${icon} text-[11px]`} />
        </div>
    )
}

/** Skeleton row strip used while form data is loading. */
export function FormTabSkeleton({ count = 5 }) {
    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                    <div className="w-6 h-6 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                    <div className="flex-1 min-w-0">
                        <div className="h-3 w-44 rounded animate-pulse mb-1 bg-bg-tertiary" />
                        <div className="h-2.5 w-56 rounded animate-pulse bg-bg-secondary" />
                    </div>
                    <div className="h-4 w-16 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                </div>
            ))}
        </div>
    )
}

/** Generic empty state — icon + title + sub message + optional CTA. */
export function EmptyState({ icon, title, message, children }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-text-tertiary">
            <i className={`fas ${icon} text-2xl mb-2`} />
            <div className="text-[13px] font-semibold text-text-primary">{title}</div>
            {message && <p className="m-0 mt-1 text-[11px] text-text-secondary">{message}</p>}
            {children && <div className="mt-3">{children}</div>}
        </div>
    )
}

/**
 * Row-style table — renders a list of rows with: status icon, title (first
 * column or the column flagged `highlight`), middle metadata pills, and an
 * optional trailing column for status/action. Used by the combined Log
 * sections and the Manage Forms list.
 */
export function FormTable({ columns, emptyChildren, emptyIcon, emptyMessage, emptyTitle, onRowClick, rows }) {
    if (!rows || rows.length === 0) {
        return (
            <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage}>
                    {emptyChildren}
                </EmptyState>
            </div>
        )
    }

    const titleCol = columns.find((c) => c.highlight) || columns[0]
    const statusCol = columns.find((c) => c.key === 'status' || c.key === 'actions')
    const metaCols = columns.filter((c) => c !== titleCol && c !== statusCol)

    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            {rows.map((row, idx) => (
                <div
                    key={row.id}
                    className="flex items-center px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary"
                    style={{ borderBottom: idx < rows.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                    onClick={() => onRowClick?.(row)}
                >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <ItemIcon status={row.status} />
                        <div className="min-w-0">
                            <span className="text-[12px] font-semibold block truncate text-text-primary">
                                {titleCol.render ? titleCol.render(row) : row[titleCol.key]}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] flex-wrap text-text-secondary">
                                {metaCols.map((col, i) => {
                                    const val = col.render ? col.render(row) : row[col.key]
                                    if (!val || val === '—') return null
                                    return (
                                        <React.Fragment key={col.key}>
                                            {i > 0 && <span className="hidden sm:inline text-text-tertiary">·</span>}
                                            <span className="font-mono tabular-nums">{val}</span>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    {statusCol && (
                        <div className="shrink-0 ml-2">
                            {statusCol.render ? statusCol.render(row) : row[statusCol.key]}
                        </div>
                    )}
                    <i className="fas fa-chevron-right text-[10px] ml-2 sm:hidden text-text-tertiary" />
                </div>
            ))}
        </div>
    )
}
