/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { ReportUtility } from '../../../../utils/ReportUtility'
import { FORM_FIELD_BASE_CLASS, FORM_FIELD_STYLE, FORM_SECTION_LABEL_CLASS, FORM_SELECT_CLASS } from './formStyles'
import PlantProductionOperatorCard, { computeRowStatus } from './PlantProductionOperatorCard'

const SummaryChip = ({ accent, count, icon, label, onClick, selected }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold cursor-pointer tabular-nums ${
            selected
                ? 'border-text-primary bg-bg-primary text-text-primary'
                : 'border-border-light bg-bg-secondary text-text-tertiary hover:text-text-primary'
        }`}
        style={selected ? { borderColor: accent, color: accent } : undefined}
    >
        <i className={`fas ${icon} text-[9px]`} />
        {count}
        <span className="font-normal opacity-80">{label}</span>
    </button>
)

const FILTER_LABELS = {
    all: 'All',
    'needs-attention': 'Needs attention',
    overridden: 'Manual override'
}

/**
 * Plant Efficiency / plant_production report form — redesigned. Replaces
 * the per-operator carousel with a stacked-card layout that shows every
 * operator at once, with a status pill per row and a sticky summary so
 * the user always knows what's left.
 *
 * Workflow features:
 *  - Plant defaults to the user's assigned plant (set by useSubmitForm).
 *  - Start Time, Punch Out come from Dayforce shift punches.
 *  - 1st Load, Total Loads come from dispatch tickets.
 *  - EOD In Yard is always manual.
 *  - Every auto-fillable field has an "Edit" → manual override + "Reset"
 *    so users can still type when Dayforce/Tickets are missing or wrong.
 *  - Real-time autosave (1.2s debounce) — no progress is lost on refresh
 *    or accidental nav.
 *  - Filter chips narrow the list to "Needs attention" or "Manual override"
 *    so a reviewer can jump straight to the cards that need a human touch.
 */
const PlantProductionForm = ({
    accentColor,
    addOperatorRow,
    dayforcePunches,
    dayforcePunchesLoading,
    dayforcePunchesReady,
    efficiencyAggregates,
    efficiencyTicketsEnabled,
    efficiencyTicketsLoading,
    efficiencyTicketsReady,
    excludedOperators,
    form,
    mixers,
    nextForcedReportDate,
    operatorOptions,
    plants,
    readOnly,
    removeOperatorRow,
    setForm,
    setRowField,
    setRowOverride
}) => {
    const [filter, setFilter] = useState('all')

    const operatorLabelById = useMemo(() => {
        const map = new Map()
        for (const opt of operatorOptions || []) map.set(opt.value, opt.label)
        return map
    }, [operatorOptions])

    const rowStatuses = useMemo(() => {
        if (!Array.isArray(form.rows)) return []
        return form.rows.map((row) =>
            computeRowStatus(row, dayforcePunches?.[row.name], efficiencyAggregates?.[row.name])
        )
    }, [form.rows, dayforcePunches, efficiencyAggregates])

    const summaryCounts = useMemo(() => {
        const counts = { complete: 0, 'needs-attention': 0, overridden: 0 }
        for (const status of rowStatuses) counts[status] = (counts[status] || 0) + 1
        return counts
    }, [rowStatuses])

    const visibleIndices = useMemo(() => {
        const indices = []
        for (let i = 0; i < rowStatuses.length; i += 1) {
            if (filter === 'all' || rowStatuses[i] === filter) indices.push(i)
        }
        return indices
    }, [rowStatuses, filter])

    const totalRows = form.rows?.length || 0
    const autoSourcesReady = (!efficiencyTicketsEnabled || efficiencyTicketsReady) && dayforcePunchesReady
    const autoSourcesLoading =
        efficiencyTicketsEnabled && (efficiencyTicketsLoading || dayforcePunchesLoading || !autoSourcesReady)

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                    <i className="fas fa-stopwatch text-[12px]" />
                </div>
                <div className="min-w-0">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Plant Efficiency
                    </div>
                    <div className="text-[13px] font-semibold leading-tight text-text-primary">
                        Operator Timing Entry
                    </div>
                </div>
            </div>

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light">
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Plant
                        <span className="ml-0.5 text-text-primary">*</span>
                    </label>
                    <select
                        value={form.plant ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, plant: e.target.value, rows: [] }))}
                        required
                        disabled={readOnly}
                        className={FORM_SELECT_CLASS}
                        style={FORM_FIELD_STYLE}
                    >
                        <option value="">Select Plant…</option>
                        {plants.map((p) => (
                            <option key={p.plant_code} value={p.plant_code}>
                                {p.plant_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light">
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Report Date
                        <span className="ml-0.5 text-text-primary">*</span>
                    </label>
                    <input
                        type="date"
                        value={form.report_date ?? ''}
                        required
                        disabled
                        className={FORM_FIELD_BASE_CLASS}
                        style={FORM_FIELD_STYLE}
                    />
                    <div className="text-[10.5px] text-text-tertiary">
                        Next report {ReportUtility.formatDate(nextForcedReportDate)}
                    </div>
                </div>
            </div>

            {!form.plant && (
                <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading plant assignment…
                </div>
            )}

            {form.plant && totalRows === 0 && excludedOperators.length === 0 && (
                <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                    <i className="fas fa-info-circle text-[11px]" />
                    No active operators for this plant.
                </div>
            )}

            {totalRows > 0 && (
                <>
                    <div className="flex items-center justify-between gap-2 flex-wrap rounded p-2 bg-bg-secondary border border-border-light">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <SummaryChip
                                accent={accentColor}
                                count={totalRows}
                                icon="fa-users"
                                label="All"
                                onClick={() => setFilter('all')}
                                selected={filter === 'all'}
                            />
                            <SummaryChip
                                accent={accentColor}
                                count={summaryCounts.complete || 0}
                                icon="fa-circle-check"
                                label="Ready"
                                onClick={() => setFilter('complete')}
                                selected={filter === 'complete'}
                            />
                            <SummaryChip
                                accent={accentColor}
                                count={summaryCounts['needs-attention'] || 0}
                                icon="fa-triangle-exclamation"
                                label="Needs attention"
                                onClick={() => setFilter('needs-attention')}
                                selected={filter === 'needs-attention'}
                            />
                            <SummaryChip
                                accent={accentColor}
                                count={summaryCounts.overridden || 0}
                                icon="fa-pen-to-square"
                                label="Manual override"
                                onClick={() => setFilter('overridden')}
                                selected={filter === 'overridden'}
                            />
                        </div>
                        {autoSourcesLoading && (
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] text-text-tertiary">
                                <i className="fas fa-circle-notch fa-spin text-[10px]" />
                                Loading auto-fill from Dayforce + dispatch tickets…
                            </span>
                        )}
                    </div>

                    {visibleIndices.length === 0 && filter !== 'all' && (
                        <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-light text-text-tertiary">
                            <i className="fas fa-circle-check text-[11px]" />
                            Nothing matches the &ldquo;{FILTER_LABELS[filter]}&rdquo; filter.
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        {visibleIndices.map((rowIndex) => {
                            const row = form.rows[rowIndex]
                            return (
                                <PlantProductionOperatorCard
                                    key={row.name || rowIndex}
                                    accentColor={accentColor}
                                    dayforcePunch={dayforcePunches?.[row.name]}
                                    mixers={mixers}
                                    onExclude={() => removeOperatorRow(rowIndex)}
                                    operatorLabel={operatorLabelById.get(row.name) || row.name}
                                    readOnly={readOnly}
                                    row={row}
                                    rowIndex={rowIndex}
                                    setRowField={setRowField}
                                    setRowOverride={setRowOverride}
                                    ticketAgg={efficiencyAggregates?.[row.name]}
                                />
                            )
                        })}
                    </div>
                </>
            )}

            {excludedOperators.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Excluded operators · click to re-include
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {excludedOperators.map((opId) => {
                            const label = operatorLabelById.get(opId) || opId
                            return (
                                <button
                                    key={opId}
                                    type="button"
                                    onClick={() => addOperatorRow(opId, mixers)}
                                    disabled={readOnly}
                                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-semibold cursor-pointer border-none bg-sky-50 border border-sky-200 text-text-primary hover:bg-sky-100 disabled:opacity-60"
                                >
                                    <i className="fas fa-user-plus text-[10px]" />
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default PlantProductionForm
