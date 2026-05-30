/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import Badge from '../../../../app/components/common/Badge'
import { ReportUtility } from '../../../../utils/ReportUtility'
import { FORM_FIELD_BASE_CLASS, FORM_FIELD_STYLE, FORM_SECTION_LABEL_CLASS } from './formStyles'
import PlantProductionFieldCell from './PlantProductionFieldCell'

/** Order matters — drives the layout left-to-right within the operator
 *  card. Each entry captures everything PlantProductionFieldCell needs to
 *  render one cell. `autoSource` of `null` means the field is always
 *  manual (eod_in_yard). */
const FIELD_DEFS = [
    {
        autoKey: 'startTime',
        autoSource: 'dayforce',
        field: 'start_time',
        inputType: 'time',
        label: 'Start Time'
    },
    {
        autoKey: 'firstLoad',
        autoSource: 'tickets',
        field: 'first_load',
        inputType: 'time',
        label: '1st Load'
    },
    {
        autoKey: null,
        autoSource: null,
        field: 'eod_in_yard',
        inputType: 'time',
        label: 'EOD In Yard'
    },
    {
        autoKey: 'punchOut',
        autoSource: 'dayforce',
        field: 'punch_out',
        inputType: 'time',
        label: 'Punch Out'
    },
    {
        autoKey: 'loads',
        autoSource: 'tickets',
        field: 'loads',
        inputType: 'number',
        label: 'Total Loads'
    }
]

/** Returns the source-specific auto value for a given field. Centralises
 *  the punch / aggregate key lookup so the cell-rendering code stays
 *  declarative. */
const resolveAutoValue = (def, dayforcePunch, ticketAgg) => {
    if (!def.autoSource) return ''
    if (def.autoSource === 'dayforce') return dayforcePunch?.[def.autoKey] || ''
    if (def.autoSource === 'tickets') {
        const raw = ticketAgg?.[def.autoKey]
        if (raw == null) return ''
        return def.field === 'loads' ? String(raw) : raw
    }
    return ''
}

/** Per-row status used for the corner pill + overall summary count.
 *  - complete:        every field has a value AND no fields are flagged
 *                     "auto source exists but missing"
 *  - needs-attention: at least one auto field has no auto value AND no
 *                     user override yet — needs a typed value before
 *                     submission is meaningful
 *  - overridden:      complete, but at least one field was manually
 *                     overridden (informational only) */
const STATUS_TO_TONE = {
    complete: 'success',
    'needs-attention': 'warning',
    overridden: 'info'
}

const STATUS_LABELS = {
    complete: 'Ready',
    'needs-attention': 'Needs attention',
    overridden: 'Manual override'
}

const STATUS_ICONS = {
    complete: 'circle-check',
    'needs-attention': 'triangle-exclamation',
    overridden: 'pen-to-square'
}

const computeRowStatus = (row, dayforcePunch, ticketAgg) => {
    const overrides = row._overrides || {}
    let anyOverride = false
    let anyMissing = false
    for (const def of FIELD_DEFS) {
        const value = row[def.field]
        const hasValue = value != null && String(value).trim().length > 0
        if (def.autoSource) {
            const autoValue = resolveAutoValue(def, dayforcePunch, ticketAgg)
            const hasAutoValue = !!autoValue
            if (overrides[def.field]) anyOverride = true
            if (!hasValue && !hasAutoValue) anyMissing = true
        } else if (!hasValue) {
            anyMissing = true
        }
    }
    if (anyMissing) return 'needs-attention'
    if (anyOverride) return 'overridden'
    return 'complete'
}

/** Minutes from clock-in to first load — the tracked efficiency metric.
 *  Returns null when either time is missing, or when the first load reads
 *  before the clock-in (bad data we don't surface a negative gap for). */
const minutesToFirstLoad = (startTime, firstLoad) => {
    const toMinutes = (value) => {
        const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''))
        return match ? Number(match[1]) * 60 + Number(match[2]) : null
    }
    const start = toMinutes(startTime)
    const first = toMinutes(firstLoad)
    if (start == null || first == null) return null
    const diff = first - start
    return diff >= 0 ? diff : null
}

/** "1h 12m" / "12m" from a minute count. */
const formatGap = (minutes) => {
    if (minutes == null) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const PlantProductionOperatorCard = ({
    accentColor,
    dayforcePunch,
    mixers,
    onExclude,
    operatorLabel,
    readOnly,
    row,
    rowIndex,
    setRowField,
    setRowOverride,
    ticketAgg
}) => {
    const truckNumber = useMemo(() => ReportUtility.getTruckNumberForOperator(row, mixers) ?? '', [row, mixers])
    const status = useMemo(() => computeRowStatus(row, dayforcePunch, ticketAgg), [row, dayforcePunch, ticketAgg])
    const gapLabel = useMemo(
        () => formatGap(minutesToFirstLoad(row.start_time, row.first_load)),
        [row.start_time, row.first_load]
    )
    const overrides = row._overrides || {}

    return (
        <div
            className="flex flex-col gap-1.5 rounded-lg p-2 bg-bg-primary border border-border-light"
            data-status={status}
        >
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{ background: accentColor }}
                    >
                        {(operatorLabel || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 leading-tight">
                        <div className="text-[12px] font-semibold text-text-primary truncate">
                            {operatorLabel || 'Unknown operator'}
                            <span className="ml-1.5 text-[10px] font-normal text-text-tertiary tabular-nums">
                                · Truck {truckNumber || '—'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {gapLabel && (
                        <span
                            className="inline-flex items-center gap-1 rounded-full border border-border-light bg-bg-secondary px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-text-secondary"
                            title="Clock-in to first load — the tracked efficiency metric"
                        >
                            <i
                                className="fas fa-stopwatch text-[9px]"
                                style={{ color: accentColor }}
                                aria-hidden="true"
                            />
                            {gapLabel}
                        </span>
                    )}
                    <Badge
                        tone={STATUS_TO_TONE[status]}
                        variant="outline"
                        size="sm"
                        shape="pill"
                        weight="semibold"
                        uppercase={false}
                        icon={STATUS_ICONS[status]}
                    >
                        {STATUS_LABELS[status]}
                    </Badge>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={onExclude}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 min-h-[32px] text-[10px] font-semibold cursor-pointer border border-border-light bg-bg-secondary text-text-tertiary hover:border-status-danger/40 hover:text-status-danger hover:bg-status-danger/5 active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                            title="Exclude this operator from the report"
                        >
                            <i className="fas fa-user-minus text-[8.5px]" />
                            Exclude
                        </button>
                    )}
                </div>
            </div>

            <div className="grid gap-1 grid-cols-1 sm:grid-cols-3 lg:grid-cols-5">
                {FIELD_DEFS.map((def) => {
                    const autoValue = resolveAutoValue(def, dayforcePunch, ticketAgg)
                    const hasAutoValue = !!autoValue
                    const isOverridden = !!overrides[def.field]
                    return (
                        <PlantProductionFieldCell
                            key={def.field}
                            autoSource={def.autoSource}
                            autoValue={autoValue}
                            field={def.field}
                            hasAutoValue={hasAutoValue}
                            inputType={def.inputType}
                            isOverridden={isOverridden}
                            label={def.label}
                            onChange={(next) => setRowField(rowIndex, def.field, next)}
                            onResetToAuto={() => setRowOverride(rowIndex, def.field, false, autoValue)}
                            onSetOverride={() => setRowOverride(rowIndex, def.field, true, row[def.field] || autoValue)}
                            readOnly={readOnly}
                            value={row[def.field]}
                        />
                    )
                })}
            </div>

            <div className="flex items-center gap-1.5">
                <label className={`${FORM_SECTION_LABEL_CLASS} shrink-0`} style={{ color: 'var(--text-tertiary)' }}>
                    Notes
                </label>
                <input
                    type="text"
                    value={row.comments ?? ''}
                    onChange={(e) => setRowField(rowIndex, 'comments', e.target.value)}
                    disabled={readOnly}
                    placeholder="Optional · late start, mechanical, weather, etc."
                    className={FORM_FIELD_BASE_CLASS}
                    style={FORM_FIELD_STYLE}
                />
            </div>
        </div>
    )
}

export { computeRowStatus, FIELD_DEFS, resolveAutoValue }
export default PlantProductionOperatorCard
