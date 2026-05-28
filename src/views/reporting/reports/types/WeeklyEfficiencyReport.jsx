/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import Badge from '../../../../app/components/common/Badge'
import { exportEfficiencyReport } from '../../../../app/components/modules/export/reports/EfficiencyExport'
import { EFFICIENCY_THRESHOLDS } from '../../../../app/constants/reportConstants'
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
const TH_BASE = `${SECTION_LABEL_CLASS} px-3 py-2 text-left whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`
const TD_BASE = 'px-3 py-2 text-[12px] align-middle text-text-primary'

/** Status pill used in place of colored numbers to flag out-of-threshold
 *  cells. Severity drives the background: `danger` is the hard red shared
 *  with operator status badges (#dc2626), `warn` is the standard amber
 *  (#d97706). White text on a solid fill — same visual vocabulary as the
 *  `operatorStatusBadge` solid variant on the people list. When `tone` is
 *  null the value renders as plain text so good rows stay quiet. */
const WarnPill = ({ children, tone }) => {
    if (!tone) return <>{children}</>
    return (
        <Badge
            tone={tone === 'danger' ? 'danger' : 'warning'}
            size="md"
            shape="pill"
            weight="bold"
            uppercase={false}
            className="tabular-nums"
        >
            {children}
        </Badge>
    )
}

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

/** Single stat tile — same compact style as the Plan-tab KPI badges and the
 *  District / Plant Manager `StatPill` primitive. */
function StatTile({ label, value }) {
    return (
        <div className="rounded p-2.5 flex flex-col gap-0.5 bg-bg-secondary border border-border-light">
            <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span className="text-[15px] font-bold leading-tight tabular-nums text-text-primary">{value}</span>
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
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium bg-[rgba(217,_119,_6,_0.12)] border border-[rgba(217,_119,_6,_0.35)] text-text-primary"
                >
                    <i className="fas fa-triangle-exclamation text-[10px]" />
                    <span>{msg}</span>
                </div>
            ))}
        </div>
    )
}

function Toolbar({ filterText, setFilterText, sortKey, sortDir, setSort }) {
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
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border-none border border-border-light"
            style={{
                background: active ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
        >
            {children}
        </button>
    )
    return (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <input
                type="search"
                aria-label="Filter operators or trucks"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter operators or trucks…"
                className="min-w-0 sm:min-w-[200px] w-full sm:w-auto flex-1 rounded px-2.5 py-1.5 text-[16px] sm:text-[12.5px] outline-none transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                style={FIELD_STYLE}
            />
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

function DetailTable({ rows, operatorOptions, sortKey, sortDir, filterText }) {
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
                // Wrap past midnight so overnight shifts (start 23:00 →
                // punch 11:00) resolve to a positive 12 h, not −12 h.
                const dStart = ReportUtility.diffMinutesWrapping(start, first)
                const dEnd = ReportUtility.diffMinutesWrapping(eod, punch)
                const totalMinutes = ReportUtility.diffMinutesWrapping(start, punch)
                const hours = totalMinutes != null ? totalMinutes / 60 : null
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
    const headers = [
        'Operator',
        'Truck #',
        'Start',
        '1st Load',
        'EOD In Yard',
        'Punch Out',
        'Loads',
        'Hours',
        'Punch In → 1st',
        'Washout → Punch',
        'L/H',
        'Comments'
    ]
    const rightAlignFromIndex = 6
    const commentsColIndex = headers.length - 1
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full min-w-[1400px] border-collapse">
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th
                                key={i}
                                className={`${TH_BASE} ${i >= rightAlignFromIndex && i !== commentsColIndex ? 'text-right' : ''}`}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {processed.map(({ r, dStart, dEnd, hours, lph, key }) => {
                        const warnStart = dStart !== null && dStart > EFFICIENCY_THRESHOLDS.LATE_START_LIMIT_MIN
                        const warnEnd = dEnd !== null && dEnd > EFFICIENCY_THRESHOLDS.LATE_OFF_LIMIT_MIN
                        const lowLoads =
                            r.loads !== undefined &&
                            r.loads !== '' &&
                            Number(r.loads) < EFFICIENCY_THRESHOLDS.LOW_LOADS_THRESHOLD
                        const longHours = hours !== null && hours > EFFICIENCY_THRESHOLDS.LONG_HOURS_THRESHOLD
                        const needsComment = warnStart || warnEnd || lowLoads || longHours
                        const hasComment = r.comments?.trim()
                        const missingRequiredComment = needsComment && !hasComment
                        const rowStyle = { borderTop: '1px solid var(--border-light)' }
                        const mutedStyle = { ...rowStyle, color: 'var(--text-secondary)' }
                        return (
                            <tr key={key}>
                                <td
                                    className={`${TD_BASE} font-semibold`}
                                    style={rowStyle}
                                    title={ReportService.getOperatorName(r, operatorOptions)}
                                >
                                    {ReportService.getOperatorName(r, operatorOptions) || 'No Name'}
                                </td>
                                <td className={`${TD_BASE} tabular-nums`} style={mutedStyle}>
                                    {r.truck_number || '—'}
                                </td>
                                <td className={`${TD_BASE} tabular-nums`} style={mutedStyle}>
                                    {r.start_time || '—'}
                                </td>
                                <td className={`${TD_BASE} tabular-nums`} style={mutedStyle}>
                                    {r.first_load || '—'}
                                </td>
                                <td className={`${TD_BASE} tabular-nums`} style={mutedStyle}>
                                    {r.eod_in_yard || '—'}
                                </td>
                                <td className={`${TD_BASE} tabular-nums`} style={mutedStyle}>
                                    {r.punch_out || '—'}
                                </td>
                                <td className={`${TD_BASE} text-right tabular-nums font-semibold`} style={rowStyle}>
                                    <WarnPill tone={lowLoads ? 'danger' : null}>{r.loads || '—'}</WarnPill>
                                </td>
                                <td className={`${TD_BASE} text-right tabular-nums font-semibold`} style={rowStyle}>
                                    <WarnPill
                                        tone={
                                            hours !== null && hours > EFFICIENCY_THRESHOLDS.LONG_HOURS_DANGER_THRESHOLD
                                                ? 'danger'
                                                : longHours
                                                  ? 'warn'
                                                  : null
                                        }
                                    >
                                        {hours !== null ? hours.toFixed(2) : '—'}
                                    </WarnPill>
                                </td>
                                <td className={`${TD_BASE} text-right tabular-nums`} style={rowStyle}>
                                    <WarnPill tone={warnStart ? 'warn' : null}>
                                        {dStart !== null ? `${dStart} min` : '—'}
                                    </WarnPill>
                                </td>
                                <td className={`${TD_BASE} text-right tabular-nums`} style={rowStyle}>
                                    <WarnPill tone={warnEnd ? 'warn' : null}>
                                        {dEnd !== null ? `${dEnd} min` : '—'}
                                    </WarnPill>
                                </td>
                                <td className={`${TD_BASE} text-right font-mono tabular-nums`} style={rowStyle}>
                                    {lph !== null ? Number(lph).toFixed(2) : '—'}
                                </td>
                                <td
                                    className={`${TD_BASE} align-top`}
                                    style={{
                                        ...rowStyle,
                                        color: 'var(--text-secondary)',
                                        maxWidth: 360,
                                        minWidth: 260
                                    }}
                                >
                                    {hasComment ? (
                                        <div className="text-[12px] italic whitespace-pre-wrap break-words text-text-primary">
                                            {r.comments}
                                        </div>
                                    ) : missingRequiredComment ? (
                                        <span className="font-semibold text-text-primary">
                                            * Required — explain timing/performance issues
                                        </span>
                                    ) : (
                                        <span>—</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function EfficiencyPluginBody({ form, operatorOptions, sidebarStats = false, plants, weekIso, assignedPlant }) {
    const [filterText, setFilterText] = useState('')
    const [sortKey, setSortKey] = useState('')
    const [sortDir, setSortDir] = useState('asc')
    const [isExporting, setIsExporting] = useState(false)
    const rows = getRows(form)
    const insights = ReportService.getPlantProductionInsights(rows)
    const setSort = (k, d) => {
        setSortKey(k)
        setSortDir(d)
    }
    const plantCode = form?.plant || assignedPlant || ''
    const handleExport = async () => {
        if (isExporting) return
        setIsExporting(true)
        try {
            await exportEfficiencyReport({
                form,
                operatorOptions,
                plantCode,
                plants,
                weekIso
            })
        } catch (error) {
            console.error('Failed to export efficiency report:', error)
        } finally {
            setIsExporting(false)
        }
    }
    const exportButton = (
        <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || !rows.length}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border-none disabled:cursor-not-allowed disabled:opacity-60 bg-bg-secondary border border-border-light text-text-primary"
            title="Download this report as an Excel spreadsheet"
        >
            <i className={`fas ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-excel'} text-[11px]`} />
            {isExporting ? 'Exporting…' : 'Export Excel'}
        </button>
    )
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
    const detailCard = (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-stopwatch"
                label="Efficiency"
                title="Operator Production Detail"
                sub="Per-operator timing windows, load counts, L/H, and required comments — all columns visible inline."
                right={exportButton}
            />
            <WarningsBar messages={insights.avgWarnings} />
            <Toolbar
                filterText={filterText}
                setFilterText={setFilterText}
                sortKey={sortKey}
                sortDir={sortDir}
                setSort={setSort}
            />
            <DetailTable
                rows={rows}
                operatorOptions={operatorOptions}
                sortKey={sortKey}
                sortDir={sortDir}
                filterText={filterText}
            />
        </div>
    )
    // Stats render as a single-column stack when used as a sidebar so each
    // tile reads cleanly at the narrow width; otherwise a wide grid spans
    // the full row underneath the detail table.
    const statsGridClass = sidebarStats
        ? 'grid grid-cols-1 gap-2'
        : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2'
    const statsCard = (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chart-bar"
                label="Totals"
                title="Weekly Production Stats"
                sub={
                    sidebarStats
                        ? 'Aggregated across every operator row.'
                        : 'Aggregated across every operator row above.'
                }
            />
            <div className={statsGridClass}>
                {statsItems.map((item, i) => (
                    <StatTile key={i} label={item.label} value={item.value} />
                ))}
            </div>
        </div>
    )
    if (sidebarStats) {
        return (
            <div className="flex flex-col lg:flex-row gap-2.5 mt-2.5 items-start">
                <div className="flex-1 min-w-0 w-full">{detailCard}</div>
                <aside className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-2.5">{statsCard}</aside>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-2.5 mt-2.5">
            {detailCard}
            {statsCard}
        </div>
    )
}

/** Submit-mode wrapper for the Plant Production (Efficiency) report plugin. */
export function EfficiencySubmitPlugin({ form, operatorOptions, plants, weekIso, assignedPlant }) {
    return (
        <EfficiencyPluginBody
            form={form}
            operatorOptions={operatorOptions}
            plants={plants}
            weekIso={weekIso}
            assignedPlant={assignedPlant}
        />
    )
}

/** Review-mode wrapper. Pulls the Weekly Production Stats out of the bottom
 *  and pins them to the right as a sticky sidebar so reviewers always see
 *  the aggregate totals while scrolling through individual operator rows. */
export function EfficiencyReviewPlugin({ form, operatorOptions, plants, weekIso, assignedPlant }) {
    return (
        <EfficiencyPluginBody
            form={form}
            operatorOptions={operatorOptions}
            plants={plants}
            weekIso={weekIso}
            assignedPlant={assignedPlant}
            sidebarStats
        />
    )
}
