import React, { useEffect, useMemo, useState } from 'react'

import { ReportService } from '../../../../services/ReportService'
import { ReportUtility } from '../../../../utils/ReportUtility'

/* ── Plan-tab design tokens ───────────────────────────────────────────────
 *  Same vocabulary used by the District / Plant Manager redesigns. */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const TH_BASE = `${SECTION_LABEL_CLASS} px-3 py-2 text-left whitespace-nowrap`
const TH_STYLE = {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-light)'
}
const TD_BASE = 'px-3 py-2 text-[12px] align-middle'
const TD_STYLE = { color: 'var(--text-primary)' }

const getRows = (form) => (Array.isArray(form.rows) ? form.rows : [])

const STAT_ITEMS = [
    { format: (v) => v, key: 'totalLoads', label: 'Total Loads' },
    { format: (v) => v?.toFixed(2) ?? '—', key: 'totalHours', label: 'Total Hours' },
    { format: (v) => v?.toFixed(2) ?? '—', key: 'avgLoads', label: 'Avg Loads' },
    { format: (v) => v?.toFixed(2) ?? '—', key: 'avgHours', label: 'Avg Hours' },
    { format: (v) => v?.toFixed(2) ?? '—', key: 'avgLoadsPerHour', label: 'Avg Loads/Hour' },
    {
        format: (v) => (v !== null ? `${v.toFixed(1)} min` : '—'),
        key: 'avgElapsedStart',
        label: 'Punch In → 1st Load'
    },
    {
        format: (v) => (v !== null ? `${v.toFixed(1)} min` : '—'),
        key: 'avgElapsedEnd',
        label: 'Washout → Punch Out'
    }
]

/** Compact card header — icon chip + label/title — matching the Plan-tab
 *  toolbar look used by the other redesigned reports. */
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

/** Single stat tile — same compact style as the Plan-tab KPI badges and the
 *  District / Plant Manager `StatPill` primitive. */
function StatTile({ label, value }) {
    return (
        <div
            className="rounded p-2.5 flex flex-col gap-0.5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span className="text-[15px] font-bold leading-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {value}
            </span>
        </div>
    )
}

function WarningsBar({ messages }) {
    if (!messages?.length) return null
    return (
        <div className="flex flex-wrap gap-1.5 mb-2">
            {messages.map((msg, i) => (
                <div
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium"
                    style={{
                        background: 'rgba(217, 119, 6, 0.12)',
                        border: '1px solid rgba(217, 119, 6, 0.35)',
                        color: '#92400e'
                    }}
                >
                    <i className="fas fa-triangle-exclamation text-[10px]" />
                    <span>{msg}</span>
                </div>
            ))}
        </div>
    )
}

function Toolbar({ filterText, setFilterText, sortKey, sortDir, setSort, onExpandAll, onCollapseAll }) {
    const toggleSort = (key) => setSort(key, sortKey === key && sortDir === 'asc' ? 'desc' : 'asc')
    const sortButtons = [
        { key: 'operator', label: 'Name' },
        { key: 'loads', label: 'Loads' },
        { key: 'hours', label: 'Hours' },
        { key: 'lph', label: 'L/H' }
    ]
    const ToolbarBtn = ({ active, children, onClick, title }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border-none"
            style={{
                background: active ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
        >
            {children}
        </button>
    )
    return (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter operators or trucks…"
                className="min-w-[200px] flex-1 rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                style={FIELD_STYLE}
            />
            <ToolbarBtn onClick={onExpandAll} title="Expand all rows">
                <i className="fas fa-chevron-down text-[10px]" />
                Expand
            </ToolbarBtn>
            <ToolbarBtn onClick={onCollapseAll} title="Collapse all rows">
                <i className="fas fa-chevron-up text-[10px]" />
                Collapse
            </ToolbarBtn>
            {sortButtons.map(({ key, label }) => {
                const active = sortKey === key
                return (
                    <ToolbarBtn key={key} active={active} onClick={() => toggleSort(key)}>
                        Sort {label}
                        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </ToolbarBtn>
                )
            })}
        </div>
    )
}

function ValidationAlert({ show }) {
    if (!show) return null
    return (
        <div
            className="mt-2 rounded p-2.5 text-[11.5px]"
            style={{
                background: 'rgba(217, 119, 6, 0.08)',
                border: '1px solid rgba(217, 119, 6, 0.35)',
                color: '#92400e'
            }}
        >
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <i className="fas fa-robot text-[11px]" style={{ color: '#b45309' }} />
                <span>AI Validation Required</span>
            </div>
            <div className="mb-1.5">
                Your explanation must provide a <strong>specific reason</strong> for the timing issues. Generic or vague
                answers will be rejected.
            </div>
            <div
                className="rounded px-2 py-1.5 text-[11px]"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
            >
                <div className="mb-1" style={{ color: '#15803d' }}>
                    <i className="fas fa-check mr-1 text-[10px]" />
                    <strong>Good:</strong>{' '}
                    {
                        '"Sent to plant 402 for afternoon deliveries" or "Truck breakdown — waited for mechanic" or "Training new driver on route"'
                    }
                </div>
                <div style={{ color: '#b91c1c' }}>
                    <i className="fas fa-times mr-1 text-[10px]" />
                    <strong>Bad:</strong> {'"N/A" or "mixer" or "truck issues" or unrelated explanations'}
                </div>
            </div>
        </div>
    )
}

function DetailTable({ rows, operatorOptions, sortKey, sortDir, filterText, expandAllSeq, collapseAllSeq }) {
    const [expanded, setExpanded] = useState(new Set())
    const minutes = (timeStr) => ReportUtility.parseTimeToMinutes(timeStr)
    const processed = useMemo(() => {
        const lower = (filterText || '').toLowerCase().trim()
        const filtered = rows.filter((r) => {
            if (!lower) return true
            const name = ReportService.getOperatorName(r, operatorOptions).toLowerCase()
            const truck = String(r.truck_number || '').toLowerCase()
            return name.includes(lower) || truck.includes(lower)
        })
        return filtered
            .map((r, idx) => {
                const start = minutes(r.start_time)
                const first = minutes(r.first_load)
                const eod = minutes(r.eod_in_yard)
                const punch = minutes(r.punch_out)
                const dStart = start !== null && first !== null ? first - start : null
                const dEnd = eod !== null && punch !== null ? punch - eod : null
                const hours = start !== null && punch !== null ? (punch - start) / 60 : null
                const lph = r.loads && hours && hours > 0 ? r.loads / hours : null
                return { dEnd, dStart, hours, key: r.name || `idx:${idx}`, lph, r }
            })
            .sort((a, b) => {
                if (!sortKey) return 0
                const dir = sortDir === 'desc' ? -1 : 1
                if (sortKey === 'operator')
                    return (
                        ReportService.getOperatorName(a.r, operatorOptions).localeCompare(
                            ReportService.getOperatorName(b.r, operatorOptions)
                        ) * dir
                    )
                if (sortKey === 'loads') return ((Number(a.r.loads) || 0) - (Number(b.r.loads) || 0)) * dir
                if (sortKey === 'hours') return ((a.hours ?? -Infinity) - (b.hours ?? -Infinity)) * dir
                if (sortKey === 'lph') return ((a.lph ?? -Infinity) - (b.lph ?? -Infinity)) * dir
                return 0
            })
    }, [rows, operatorOptions, sortKey, sortDir, filterText])
    useEffect(() => {
        if (expandAllSeq) setExpanded(new Set(processed.map((p) => p.key)))
    }, [expandAllSeq, processed])
    useEffect(() => {
        if (collapseAllSeq) setExpanded(new Set())
    }, [collapseAllSeq])
    const toggleExpand = (key) =>
        setExpanded((prev) => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    const headers = ['Operator', 'Truck #', 'Punch In → 1st Load', 'Washout → Punch Out', 'L/H', '']
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full min-w-[700px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={`${TH_BASE} ${i >= 4 ? 'text-right' : ''}`} style={TH_STYLE}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {processed.map(({ r, dStart, dEnd, hours, lph, key }) => {
                        const warnStart = dStart !== null && dStart > 15
                        const warnEnd = dEnd !== null && dEnd > 20
                        const lowLoads = r.loads !== undefined && r.loads !== '' && Number(r.loads) < 3
                        const longHours = hours !== null && hours > 14
                        const needsComment = warnStart || warnEnd || lowLoads || longHours
                        const hasComment = r.comments?.trim()
                        const isOpen = expanded.has(key)
                        const rowStyle = { ...TD_STYLE, borderTop: '1px solid var(--border-light)' }
                        return (
                            <React.Fragment key={key}>
                                <tr>
                                    <td
                                        className={`${TD_BASE} font-semibold`}
                                        style={rowStyle}
                                        title={ReportService.getOperatorName(r, operatorOptions)}
                                    >
                                        {ReportService.getOperatorName(r, operatorOptions) || 'No Name'}
                                    </td>
                                    <td
                                        className={`${TD_BASE} tabular-nums`}
                                        style={{ ...rowStyle, color: 'var(--text-secondary)' }}
                                    >
                                        {r.truck_number || '—'}
                                    </td>
                                    <td
                                        className={`${TD_BASE} tabular-nums`}
                                        style={{
                                            ...rowStyle,
                                            color: warnStart ? '#b45309' : 'var(--text-primary)',
                                            fontWeight: warnStart ? 600 : 400
                                        }}
                                    >
                                        {dStart !== null ? `${dStart} min` : '—'}
                                    </td>
                                    <td
                                        className={`${TD_BASE} tabular-nums`}
                                        style={{
                                            ...rowStyle,
                                            color: warnEnd ? '#b45309' : 'var(--text-primary)',
                                            fontWeight: warnEnd ? 600 : 400
                                        }}
                                    >
                                        {dEnd !== null ? `${dEnd} min` : '—'}
                                    </td>
                                    <td className={`${TD_BASE} text-right font-mono tabular-nums`} style={rowStyle}>
                                        {lph !== null ? Number(lph).toFixed(2) : '—'}
                                    </td>
                                    <td className={`${TD_BASE} text-right`} style={rowStyle}>
                                        <button
                                            type="button"
                                            aria-expanded={isOpen}
                                            onClick={() => toggleExpand(key)}
                                            title={isOpen ? 'Hide details' : 'Show details'}
                                            className="rounded px-1.5 py-1 text-[12px] cursor-pointer border-none"
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-light)',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            <i className={`fas fa-chevron-${isOpen ? 'down' : 'right'} text-[9px]`} />
                                        </button>
                                    </td>
                                </tr>
                                {isOpen && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="!p-0"
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                borderTop: '1px solid var(--border-light)'
                                            }}
                                        >
                                            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5 px-3 py-2.5">
                                                {[
                                                    { label: 'Start', value: r.start_time },
                                                    { label: '1st Load', value: r.first_load },
                                                    { label: 'EOD In Yard', value: r.eod_in_yard },
                                                    { label: 'Punch Out', value: r.punch_out }
                                                ].map(({ label, value }) => (
                                                    <div
                                                        key={label}
                                                        className="rounded p-2"
                                                        style={{
                                                            background: 'var(--bg-primary)',
                                                            border: '1px solid var(--border-light)'
                                                        }}
                                                    >
                                                        <div
                                                            className={`${SECTION_LABEL_CLASS} mb-0.5`}
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                        >
                                                            {label}
                                                        </div>
                                                        <div
                                                            className="text-[12.5px] tabular-nums"
                                                            style={{ color: 'var(--text-primary)' }}
                                                        >
                                                            {value || '—'}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div
                                                    className="rounded p-2"
                                                    style={{
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border-light)'
                                                    }}
                                                >
                                                    <div
                                                        className={`${SECTION_LABEL_CLASS} mb-0.5`}
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        Total Loads
                                                    </div>
                                                    <div
                                                        className="text-[12.5px] font-bold tabular-nums"
                                                        style={{ color: lowLoads ? '#dc2626' : 'var(--text-primary)' }}
                                                    >
                                                        {r.loads || '—'}
                                                    </div>
                                                </div>
                                                <div
                                                    className="rounded p-2"
                                                    style={{
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border-light)'
                                                    }}
                                                >
                                                    <div
                                                        className={`${SECTION_LABEL_CLASS} mb-0.5`}
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        Total Hours
                                                    </div>
                                                    <div
                                                        className="text-[12.5px] font-bold tabular-nums"
                                                        style={{
                                                            color:
                                                                hours !== null && hours > 20
                                                                    ? '#dc2626'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                    >
                                                        {hours !== null ? hours.toFixed(2) : '—'}
                                                    </div>
                                                </div>
                                                <div
                                                    className="rounded p-2 col-span-full"
                                                    style={{
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border-light)'
                                                    }}
                                                >
                                                    <div
                                                        className={`${SECTION_LABEL_CLASS} mb-0.5 flex items-center gap-1.5`}
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        Comments
                                                        {needsComment && (
                                                            <span className="font-bold" style={{ color: '#dc2626' }}>
                                                                * Required — explain timing/performance issues
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div
                                                        className="text-[12px] italic"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                    >
                                                        {r.comments || '—'}
                                                    </div>
                                                    <ValidationAlert show={needsComment && !hasComment} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function EfficiencyPluginBody({ form, operatorOptions }) {
    const [filterText, setFilterText] = useState('')
    const [sortKey, setSortKey] = useState('')
    const [sortDir, setSortDir] = useState('asc')
    const [expandAllSeq, setExpandAllSeq] = useState(0)
    const [collapseAllSeq, setCollapseAllSeq] = useState(0)
    const rows = getRows(form)
    const insights = ReportService.getPlantProductionInsights(rows)
    const setSort = (k, d) => {
        setSortKey(k)
        setSortDir(d)
    }
    if (!rows.length) {
        return (
            <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
                <CardHeader
                    icon="fa-stopwatch"
                    label="Efficiency"
                    title="Plant Production"
                    sub="No operator timing rows have been entered yet."
                />
            </div>
        )
    }
    const statsItems = STAT_ITEMS.map(({ key, label, format }) => ({
        label,
        value: format(insights[key])
    }))
    return (
        <div className="flex flex-col gap-2.5 mt-2.5">
            <div className="rounded p-3" style={CARD_STYLE}>
                <CardHeader
                    icon="fa-stopwatch"
                    label="Efficiency"
                    title="Operator Production Detail"
                    sub="Per-operator timing windows, load counts, and L/H. Expand a row for full punch detail and required comments."
                />
                <WarningsBar messages={insights.avgWarnings} />
                <Toolbar
                    filterText={filterText}
                    setFilterText={setFilterText}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    setSort={setSort}
                    onExpandAll={() => setExpandAllSeq((s) => s + 1)}
                    onCollapseAll={() => setCollapseAllSeq((s) => s + 1)}
                />
                <DetailTable
                    rows={rows}
                    operatorOptions={operatorOptions}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    filterText={filterText}
                    expandAllSeq={expandAllSeq}
                    collapseAllSeq={collapseAllSeq}
                />
            </div>
            <div className="rounded p-3" style={CARD_STYLE}>
                <CardHeader
                    icon="fa-chart-bar"
                    label="Totals"
                    title="Weekly Production Stats"
                    sub="Aggregated across every operator row above."
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                    {statsItems.map((item, i) => (
                        <StatTile key={i} label={item.label} value={item.value} />
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Submit-mode wrapper for the Plant Production (Efficiency) report plugin. */
export function EfficiencySubmitPlugin({ form, operatorOptions }) {
    return <EfficiencyPluginBody form={form} operatorOptions={operatorOptions} />
}

/** Review-mode wrapper for the Plant Production (Efficiency) report plugin (read-only). */
export function EfficiencyReviewPlugin({ form, operatorOptions }) {
    return <EfficiencyPluginBody form={form} operatorOptions={operatorOptions} />
}
