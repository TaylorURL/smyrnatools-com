/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { formatCentralDate } from '../../../../../utils/PlanUtility'

/** One fact in the Overview snapshot: the label in a fixed column, the value
 *  and its context beside it — the same row the asset statistics use. */
export function HighlightRow({ hint, icon: _icon, label, value }) {
    return (
        <div className="grid grid-cols-[160px_minmax(0,1fr)] items-baseline gap-4 px-4 py-2.5 border-t border-border-light first:border-t-0">
            <div className="text-[13px] text-text-secondary">{label}</div>
            <div className="min-w-0">
                <span className="text-[14px] font-medium text-text-primary">{value}</span>
                {hint && <span className="ml-2 text-[12px] text-text-tertiary">{hint}</span>}
            </div>
        </div>
    )
}

/** A tile that opens one statistics section — the same tile the asset
 *  overview uses. */
export function LaunchpadTile({ hint, icon: _icon, label, onSelect, section, value }) {
    return (
        <button
            type="button"
            onClick={() => onSelect?.(section)}
            className="group flex flex-col gap-1 items-start rounded-card border border-border-light bg-bg-primary cursor-pointer px-4 py-3 text-left transition-colors duration-150 ease-out hover:border-border-medium hover:bg-bg-hover motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <span className="text-[12px] text-text-secondary">{label}</span>
            <span className="font-heading text-[24px] font-semibold leading-tight tabular-nums text-text-primary">
                {value}
            </span>
            {hint && <span className="text-[12px] text-text-tertiary">{hint}</span>}
            <span className="mt-1 text-[12px] font-medium text-text-secondary group-hover:text-text-primary">
                Open →
            </span>
        </button>
    )
}

/** Date formatter for the Pending Starts table — short month/day/year so
 *  the table column stays tight. Returns "TBD" for null dates so the
 *  table never renders a blank cell. */
export const formatPendingDate = (iso) => {
    if (!iso) return 'TBD'
    const date = new Date(`${iso}T00:00:00`)
    if (!Number.isFinite(date.getTime())) return 'TBD'
    return formatCentralDate(date)
}

/** Formats a full ISO timestamp (e.g. `createdAt`, `statusChangedAt`) into
 *  the same short month/day/year style as `formatPendingDate`. Tolerates
 *  both timestamp and date-only inputs so the period-bound event tables
 *  render cleanly regardless of which field the row carries. */
export const formatEventDate = (iso) => {
    if (!iso) return '—'
    const value = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '—'
    return formatCentralDate(date)
}

export const daysUntilLabel = (days) => {
    if (days == null) return 'TBD'
    if (days === 0) return 'today'
    if (days < 0) return `${Math.abs(days)} d late`
    if (days === 1) return 'tomorrow'
    return `in ${days} d`
}

export const TIER_META = [
    { color: 'var(--role-admin)', hint: 'role weight ≥ 70', id: 'admin', label: 'Admin' },
    { color: 'var(--role-lead)', hint: 'role weight 40–69', id: 'lead', label: 'Lead' },
    { color: 'var(--role-manager)', hint: 'role weight 20–39', id: 'manager', label: 'Manager' },
    { color: 'var(--role-viewer)', hint: 'role weight < 20', id: 'viewer', label: 'Viewer' }
]

/** Role-tier tile — one per band, ordered by weight desc. The colored
 *  swatch + count combo reads as a balance check at a glance. */
export function TierTile({ color, count, hint, label, total }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
        <div className="rounded-lg p-3 flex flex-col gap-1 bg-bg-secondary border border-border-light">
            <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[12px] font-medium text-text-tertiary truncate">{label}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 22 }}>
                    {fmtInt(count)}
                </span>
                {total > 0 && <span className="text-[11px] text-text-tertiary">{pct}%</span>}
            </div>
            <div className="text-[10.5px] text-text-tertiary">{hint}</div>
        </div>
    )
}
