/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ReportUtility } from '../../../../utils/ReportUtility'
import { FORM_FIELD_BASE_CLASS, FORM_FIELD_STYLE, FORM_SECTION_LABEL_CLASS } from './formStyles'

const TIMING_FIELDS = [
    { autoFromTickets: false, field: 'start_time', label: 'Start Time' },
    { autoFromTickets: true, field: 'first_load', label: '1st Load' },
    { autoFromTickets: false, field: 'eod_in_yard', label: 'EOD In Yard' },
    { autoFromTickets: false, field: 'punch_out', label: 'Punch Out' }
]

/** Plant Efficiency / plant_production report form. Plant + report-date
 *  picker, per-operator timing carousel, and an excluded-operators row
 *  that lets a user re-include someone removed by mistake. */
const PlantProductionForm = ({
    accentColor,
    addOperatorRow,
    carouselIndex,
    efficiencyTicketsEnabled,
    efficiencyTicketsLoading,
    efficiencyTicketsReady,
    excludedOperators,
    form,
    handleChange,
    mixers,
    nextForcedReportDate,
    operatorOptions,
    plants,
    readOnly,
    removeOperatorRow,
    setCarouselIndex,
    setForm
}) => (
    <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                <i className="fas fa-stopwatch text-[11px]" />
            </div>
            <div className="min-w-0 flex-1">
                <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    Production
                </div>
                <div className="text-[12.5px] font-semibold leading-tight text-text-primary">Operator Timing Entry</div>
                <div className="text-[10.5px] mt-0.5 text-text-tertiary">
                    Enter punch + load timing for each active operator. Carousel below cycles between operators.
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
                    onChange={(e) => {
                        setForm((f) => ({ ...f, plant: e.target.value, rows: [] }))
                        setCarouselIndex(0)
                    }}
                    required
                    disabled={readOnly}
                    className={`${FORM_FIELD_BASE_CLASS} appearance-none cursor-pointer pr-8`}
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

        <div className="flex flex-col gap-1.5">
            <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                Operators
            </label>

            {!form.plant && (
                <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading plant assignment…
                </div>
            )}
            {form.plant && !form.rows?.length && !excludedOperators.length && (
                <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                    <i className="fas fa-info-circle text-[11px]" />
                    No active operators for this plant.
                </div>
            )}

            {efficiencyTicketsEnabled && (
                <div
                    className="flex items-center gap-2 rounded p-2 text-[11px] bg-bg-secondary border border-border-light text-text-tertiary"
                    title="1st Load and Total Loads are pulled directly from this day's dispatch tickets and cannot be edited."
                >
                    {efficiencyTicketsLoading || !efficiencyTicketsReady ? (
                        <>
                            <i className="fas fa-circle-notch fa-spin text-[10px]" />
                            <span>Loading 1st load + total loads from dispatch tickets…</span>
                        </>
                    ) : (
                        <>
                            <i className="fas fa-check-circle text-[10px] text-text-primary" />
                            <span>
                                1st Load and Total Loads auto-filled from this report day&apos;s dispatch tickets — not
                                editable.
                            </span>
                        </>
                    )}
                </div>
            )}

            {form.rows?.length > 0 && (
                <>
                    <div className="flex flex-wrap gap-1">
                        {form.rows.map((_, idx) => {
                            const active = idx === carouselIndex
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCarouselIndex(idx)}
                                    className="inline-flex items-center justify-center rounded text-[11.5px] font-bold cursor-pointer border-none tabular-nums h-[26px]"
                                    style={{
                                        background: active ? accentColor : 'var(--bg-secondary)',
                                        border: `1px solid ${active ? accentColor : 'var(--border-light)'}`,
                                        color: active ? '#fff' : 'var(--text-secondary)',
                                        minWidth: 26,
                                        padding: '0 8px'
                                    }}
                                >
                                    {idx + 1}
                                </button>
                            )
                        })}
                    </div>
                    <div className="rounded p-3 bg-bg-secondary border border-border-light">
                        {form.rows[carouselIndex] && (
                            <div className="flex flex-col gap-2">
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label
                                            className={FORM_SECTION_LABEL_CLASS}
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            value={
                                                operatorOptions.find(
                                                    (opt) => opt.value === form.rows[carouselIndex]?.name
                                                )?.label ?? ''
                                            }
                                            disabled
                                            className={FORM_FIELD_BASE_CLASS}
                                            style={FORM_FIELD_STYLE}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label
                                            className={FORM_SECTION_LABEL_CLASS}
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            Truck #
                                        </label>
                                        <input
                                            type="text"
                                            value={
                                                ReportUtility.getTruckNumberForOperator(
                                                    form.rows[carouselIndex],
                                                    mixers
                                                ) ?? ''
                                            }
                                            disabled
                                            className={`${FORM_FIELD_BASE_CLASS} tabular-nums`}
                                            style={FORM_FIELD_STYLE}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {TIMING_FIELDS.map(({ autoFromTickets, field, label }) => (
                                        <div key={field} className="flex flex-col gap-1">
                                            <label
                                                className={FORM_SECTION_LABEL_CLASS}
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                {label}
                                                {autoFromTickets && (
                                                    <span className="ml-1 normal-case font-normal tracking-normal text-text-tertiary">
                                                        · from tickets
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                type="time"
                                                value={form.rows[carouselIndex]?.[field] ?? ''}
                                                onChange={(e) => handleChange(e, 'rows', carouselIndex, field)}
                                                disabled={!!readOnly || autoFromTickets}
                                                className={`${FORM_FIELD_BASE_CLASS} tabular-nums`}
                                                style={FORM_FIELD_STYLE}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label
                                            className={FORM_SECTION_LABEL_CLASS}
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            Total Loads
                                            <span className="ml-1 normal-case font-normal tracking-normal text-text-tertiary">
                                                · from tickets
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            value={form.rows[carouselIndex]?.loads ?? ''}
                                            onChange={(e) => handleChange(e, 'rows', carouselIndex, 'loads')}
                                            disabled
                                            className={`${FORM_FIELD_BASE_CLASS} tabular-nums`}
                                            style={FORM_FIELD_STYLE}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label
                                            className={FORM_SECTION_LABEL_CLASS}
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            Comments
                                        </label>
                                        <input
                                            type="text"
                                            value={form.rows[carouselIndex]?.comments ?? ''}
                                            onChange={(e) => handleChange(e, 'rows', carouselIndex, 'comments')}
                                            disabled={readOnly}
                                            className={FORM_FIELD_BASE_CLASS}
                                            style={FORM_FIELD_STYLE}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 flex-wrap border-t border-border-light">
                            <button
                                type="button"
                                onClick={() => removeOperatorRow(carouselIndex)}
                                className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none bg-[rgba(220,_38,_38,_0.1)] border border-[rgba(220,_38,_38,_0.3)] text-text-primary"
                            >
                                <i className="fas fa-user-minus text-[10px]" />
                                Exclude
                            </button>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCarouselIndex((i) => Math.max(i - 1, 0))}
                                    disabled={carouselIndex === 0}
                                    className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ background: accentColor }}
                                >
                                    <i className="fas fa-arrow-left text-[10px]" />
                                    Prev
                                </button>
                                <span className="text-[11.5px] tabular-nums text-text-secondary">
                                    Operator <b className="text-text-primary">{carouselIndex + 1}</b> of{' '}
                                    <b className="text-text-primary">{form.rows.length}</b>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCarouselIndex((i) => Math.min(i + 1, form.rows.length - 1))}
                                    disabled={carouselIndex === form.rows.length - 1}
                                    className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ background: accentColor }}
                                >
                                    Next
                                    <i className="fas fa-arrow-right text-[10px]" />
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {excludedOperators.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Excluded Operators · click to re-include
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {excludedOperators.map((opId) => {
                            const op = operatorOptions.find((opt) => opt.value === opId)
                            return (
                                <button
                                    key={opId}
                                    type="button"
                                    onClick={() => addOperatorRow(opId, mixers)}
                                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-semibold cursor-pointer border-none bg-[rgba(14,_165,_233,_0.12)] border border-[rgba(14,_165,_233,_0.35)] text-text-primary"
                                >
                                    <i className="fas fa-user-plus text-[10px]" />
                                    {op?.label || opId}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    </div>
)

export default PlantProductionForm
