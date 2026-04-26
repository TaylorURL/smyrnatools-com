import React from 'react'

import { reportTypeMap } from '../../../../app/types/ReportTypes'
import { usePreviousWeekReport, useReportVariance } from './shared'

/* ── Plan-tab design tokens ───────────────────────────────────────────────
 *  Same vocabulary used by the District / Plant / Efficiency redesigns. */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const FIELD_INPUT_CLASS =
    'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border tabular-nums disabled:opacity-90'
const TH_BASE = `${SECTION_LABEL_CLASS} px-3 py-2 text-left whitespace-nowrap`
const TH_STYLE = {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-light)'
}

/** Compact card header — same primitive as the other redesigned reports. */
function CardHeader({ icon, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </div>
                    {sub && (
                        <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {sub}
                        </div>
                    )}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

/** Variance pill — Plan-tab tinted background, FontAwesome arrow icons. */
function VariancePill({ varianceStr }) {
    if (!varianceStr) {
        return (
            <span
                className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
            >
                —
            </span>
        )
    }
    const n = parseFloat(varianceStr)
    if (!Number.isFinite(n) || n === 0) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
            >
                <i className="fas fa-minus text-[9px]" />
                {varianceStr}
            </span>
        )
    }
    const isUp = n > 0
    const color = isUp ? '#15803d' : '#b91c1c'
    const bg = isUp ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)'
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums"
            style={{ background: bg, color }}
        >
            <i className={`fas fa-arrow-${isUp ? 'up' : 'down'} text-[9px]`} />
            {varianceStr}
        </span>
    )
}

function AggregatePluginBody({ form, setForm, readOnly, weekIso }) {
    const { previousReport: lastWeekAgg } = usePreviousWeekReport(weekIso, 'aggregate_production')
    const { getLastWeekValue, formatVariancePercent } = useReportVariance(lastWeekAgg?.data, form)
    const fields = reportTypeMap.aggregate_production.fields
    const totals = fields.reduce(
        (acc, f) => {
            const last = parseFloat(String(getLastWeekValue(f.name))) || 0
            const curr = parseFloat(form[f.name]) || 0
            acc.last += last
            acc.curr += curr
            return acc
        },
        { curr: 0, last: 0 }
    )
    const totalVarianceStr = totals.last > 0 ? `${(((totals.curr - totals.last) / totals.last) * 100).toFixed(1)}%` : ''
    return (
        <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-cubes-stacked"
                label="Aggregate"
                title="Material Tonnage"
                sub="Enter this week's tonnage per material. Last week's value and the week-over-week variance are shown for reference."
            />
            <div className="overflow-x-auto rounded" style={CARD_STYLE}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {[
                                { align: 'left', label: 'Material' },
                                { align: 'right', label: 'Last Week' },
                                { align: 'right', label: 'This Week' },
                                { align: 'right', label: 'Variance' }
                            ].map((h, i) => (
                                <th
                                    key={i}
                                    className={`${SECTION_LABEL_CLASS} px-3 py-2 whitespace-nowrap`}
                                    style={{ ...TH_STYLE, textAlign: h.align }}
                                >
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {fields.map((f) => {
                            const lastValue = String(getLastWeekValue(f.name))
                            const variance = formatVariancePercent(f.name)
                            const rowStyle = {
                                borderTop: '1px solid var(--border-light)',
                                color: 'var(--text-primary)'
                            }
                            return (
                                <tr key={f.name}>
                                    <td className="px-3 py-1.5 text-[12px] font-semibold align-middle" style={rowStyle}>
                                        {f.label}
                                    </td>
                                    <td className="px-3 py-1.5 align-middle text-right" style={rowStyle}>
                                        <input
                                            type="text"
                                            value={lastValue}
                                            disabled
                                            className={`${FIELD_INPUT_CLASS} text-right`}
                                            style={FIELD_STYLE}
                                        />
                                    </td>
                                    <td className="px-3 py-1.5 align-middle text-right" style={rowStyle}>
                                        <input
                                            type="number"
                                            value={form[f.name] ?? ''}
                                            onChange={(e) =>
                                                setForm && setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                                            }
                                            disabled={readOnly}
                                            placeholder="0"
                                            className={`${FIELD_INPUT_CLASS} text-right`}
                                            style={FIELD_STYLE}
                                        />
                                    </td>
                                    <td className="px-3 py-1.5 align-middle text-right" style={rowStyle}>
                                        <VariancePill varianceStr={variance} />
                                    </td>
                                </tr>
                            )
                        })}
                        <tr style={{ borderTop: '2px solid var(--border-medium)' }}>
                            <td
                                className="px-3 py-2 text-[12px] font-bold uppercase tracking-wider"
                                style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                            >
                                Total
                            </td>
                            <td
                                className="px-3 py-2 text-right text-[13px] font-bold tabular-nums"
                                style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                            >
                                {totals.last.toLocaleString()}
                            </td>
                            <td
                                className="px-3 py-2 text-right text-[13px] font-bold tabular-nums"
                                style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                            >
                                {totals.curr.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right" style={{ background: 'var(--bg-tertiary)' }}>
                                <VariancePill varianceStr={totalVarianceStr} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}

/** Submit-mode plugin for the Aggregate Production report. */
export function AggregateProductionSubmitPlugin({ form, readOnly, setForm, weekIso }) {
    return <AggregatePluginBody form={form} setForm={setForm} readOnly={readOnly} weekIso={weekIso} />
}

/** Review-mode plugin for the Aggregate Production report — read-only same body so reviewers see the same comparison + variance. */
export function AggregateProductionReviewPlugin({ form, weekIso }) {
    return <AggregatePluginBody form={form} setForm={null} readOnly weekIso={weekIso} />
}
