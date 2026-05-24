/* eslint-disable react/forbid-dom-props */
import React from 'react'

import FormatUtility from '../../../../../utils/FormatUtility'
import { ReportUtility } from '../../../../../utils/ReportUtility'

export const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
export const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }

/** Compact card header — icon chip + label/title — matching the look used
 *  by MaintenanceFormReview, NRMCAView, and the Plan-tab toolbars. */
export function CardHeader({ icon, label, sub, title }) {
    return (
        <div className="flex items-center gap-2 mb-2">
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
    )
}

/** Inline pill stat — same compact style as the Plan-tab KPI badges. */
export function StatPill({ icon, label, value }) {
    return (
        <div className="flex items-center gap-2 rounded px-2.5 py-1.5 bg-bg-secondary border border-border-light">
            <i className={`fas ${icon} text-[11px] text-text-primary`} />
            <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-bold leading-none tabular-nums text-text-primary">{value}</span>
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </span>
            </div>
        </div>
    )
}

const ITEM_ICON_CLASSES = {
    completed: { color: '#16a34a', icon: 'fa-circle-check' },
    overdue: { color: '#dc2626', icon: 'fa-triangle-exclamation' },
    pending: { color: '#d97706', icon: 'fa-clock' }
}

function getItemIcon(item) {
    if (item.completed) return ITEM_ICON_CLASSES.completed
    if (item.isOverdue) return ITEM_ICON_CLASSES.overdue
    return ITEM_ICON_CLASSES.pending
}

const truncateText = (text, maxLength) => FormatUtility.truncateText(text, maxLength)

export function MaintenanceItemsTable({ items, plants }) {
    const getPlantName = (plantCode) => {
        const plant = plants?.find((p) => (p.plant_code || p.code) === plantCode)
        return plant?.name || plantCode || ''
    }
    if (items.length === 0) {
        return (
            <div className="rounded p-6 text-center flex flex-col items-center gap-1.5" style={CARD_STYLE}>
                <i className="fas fa-clipboard-check text-[20px] text-text-tertiary" />
                <p className="text-[12px] m-0 text-text-secondary">No maintenance items were completed this week.</p>
            </div>
        )
    }
    return (
        <div className="rounded overflow-hidden" style={CARD_STYLE}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {['Description', 'Plant', 'Deadline', 'Completed'].map((header) => (
                                <th
                                    key={header}
                                    className={`${SECTION_LABEL_CLASS} text-left px-3 py-2 whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`}
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => {
                            const { icon } = getItemIcon(item)
                            return (
                                <tr
                                    className="border-t border-border-light"
                                    key={item.id}
                                    style={{ background: item.isOverdue ? 'rgba(220, 38, 38, 0.04)' : undefined }}
                                >
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex items-start gap-2">
                                            <i
                                                className={`fas ${icon} text-[12px] mt-0.5 shrink-0 text-text-primary`}
                                            />
                                            <span
                                                className="text-[12px] leading-snug text-text-primary"
                                                title={item.description}
                                            >
                                                {truncateText(item.description, 80)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top whitespace-nowrap">
                                        <span
                                            className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-semibold bg-bg-tertiary text-text-secondary border border-border-light"
                                            title={getPlantName(item.plant_code)}
                                        >
                                            {truncateText(getPlantName(item.plant_code), 25)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 align-top whitespace-nowrap text-[12px] tabular-nums text-text-secondary">
                                        {item.deadline ? ReportUtility.formatDate(item.deadline) : '—'}
                                    </td>
                                    <td className="px-3 py-2 align-top whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold tabular-nums bg-[rgba(22,_163,_74,_0.12)] text-text-primary">
                                            <i className="fas fa-check text-[9px]" />
                                            {item.completed_at ? ReportUtility.formatDate(item.completed_at) : '—'}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

/** Side column listing the user's district plants with weekly yardage
 *  pulled from `plant_production` (same source the Schedule view reads).
 *  Sorted highest-to-lowest with a horizontal bar so dispatch / DM can
 *  eyeball who's pulling the volume. Sticky on desktop so it stays in
 *  view while the recap section scrolls. */
export function DistrictYardageRail({ districtNames, loading, plants, weekIso, yardageByPlant }) {
    const total = Object.values(yardageByPlant).reduce((sum, v) => sum + (v || 0), 0)
    const max = Object.values(yardageByPlant).reduce((m, v) => Math.max(m, v || 0), 0)
    const rows = Object.entries(yardageByPlant).sort(([, a], [, b]) => b - a)
    const weekRange = ReportUtility.getWeekVerbose(weekIso)
    const districtLabel =
        Array.isArray(districtNames) && districtNames.length
            ? districtNames.length === 1
                ? districtNames[0]
                : `${districtNames.length} districts`
            : 'Your district'
    return (
        <div className="rounded p-3 flex flex-col gap-3" style={CARD_STYLE}>
            <CardHeader icon="fa-cubes" label="District yardage" title={districtLabel} sub={weekRange || 'This week'} />

            <div className="flex items-baseline justify-between rounded px-2.5 py-2 bg-bg-secondary border border-border-light">
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    Total
                </span>
                <span className="font-mono tabular-nums text-text-primary">
                    <span className="text-[18px] font-bold">{Math.round(total).toLocaleString()}</span>
                    <span className="ml-1 text-[10.5px] text-text-tertiary">yd</span>
                </span>
            </div>

            {loading && rows.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[11.5px] text-text-tertiary">
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading week…
                </div>
            ) : rows.length === 0 ? (
                <div className="text-[11.5px] text-center py-4 text-text-tertiary">No district plants found.</div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {rows.map(([code, value]) => {
                        const plant = plants?.find((p) => (p.plant_code || p.code) === code)
                        const name = plant?.name || ''
                        const pct = max > 0 ? (value / max) * 100 : 0
                        const valRounded = Math.round(value)
                        return (
                            <div
                                key={code}
                                className="rounded px-2 py-1.5 bg-bg-secondary border border-border-light"
                                title={name ? `${code} · ${name}` : code}
                            >
                                <div className="flex items-baseline justify-between gap-2 mb-1">
                                    <div className="min-w-0 flex items-baseline gap-1.5">
                                        <span className="text-[12.5px] font-bold tabular-nums text-text-primary">
                                            {code}
                                        </span>
                                        {name && (
                                            <span className="text-[10.5px] truncate text-text-tertiary">{name}</span>
                                        )}
                                    </div>
                                    <span className="font-mono text-[12px] font-semibold tabular-nums shrink-0 text-text-primary">
                                        {valRounded.toLocaleString()}
                                        <span className="ml-0.5 text-[10px] text-text-tertiary">yd</span>
                                    </span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden bg-bg-tertiary">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            background: value > 0 ? 'var(--accent, #1e3a5f)' : 'var(--border-light)',
                                            width: `${pct}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
