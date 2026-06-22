import React from 'react'

import { RPT_INPUT, RPT_TEXTAREA, TD_STYLE, TH_STYLE } from '../../../../views/reporting/reports/types/shared'
import { GM_METRICS } from '../../../constants/generalManagerReportConstants'
import { GmEmptyState, GmSectionHeader, VarianceCell } from './GmAtoms'

/** Disabled "last week" cell — text input bound to the previous value. */
function LastWeekCell({ value }) {
    return <input type="text" value={String(value ?? '')} disabled className={RPT_INPUT} />
}

/** "This week" numeric input — calls `setForm` with the field name on
 *  each change. */
function CurrentWeekCell({ disabled, field, form, setForm }) {
    return (
        <input
            type="number"
            value={form[field] ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
            disabled={disabled}
            className={RPT_INPUT}
        />
    )
}

/** Numeric metric row — Metric / Last Week / This Week / Variance. */
function MetricRow({ field, form, getLastWeekValue, label, readOnly, setForm }) {
    const lastWeekValue = getLastWeekValue(field)
    return (
        <tr>
            <td className={TD_STYLE}>{label}</td>
            <td className={TD_STYLE}>
                <LastWeekCell value={lastWeekValue} />
            </td>
            <td className={TD_STYLE}>
                <CurrentWeekCell disabled={readOnly} field={field} form={form} setForm={setForm} />
            </td>
            <td className={TD_STYLE}>
                <VarianceCell lastValue={lastWeekValue} currentValue={form[field]} />
            </td>
        </tr>
    )
}

/** Notes row — full-width text areas, no variance pill. */
function NotesRow({ field, form, getLastWeekValue, readOnly, setForm }) {
    return (
        <tr>
            <td className={TD_STYLE}>Notes</td>
            <td className={TD_STYLE}>
                <textarea value={String(getLastWeekValue(field) ?? '')} disabled className={RPT_TEXTAREA} />
            </td>
            <td className={TD_STYLE} colSpan={2}>
                <textarea
                    value={form[field] ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                    disabled={readOnly}
                    className={RPT_TEXTAREA}
                />
            </td>
        </tr>
    )
}

const HEADERS = ['Metric', 'Last Week', 'This Week', 'Variance']

/** Per-plant metric table — eight numeric rows + one notes row. */
function PlantTable({ form, getLastWeekValue, plant, readOnly, setForm }) {
    const code = plant.plant_code
    return (
        <div className="rounded-lg border border-gray-200 bg-bg-primary p-4 mb-4">
            <GmSectionHeader title={`${plant.plant_name} (${code})`} />
            <div className="overflow-x-auto mt-3">
            <table className="w-full border-collapse rounded-lg overflow-hidden border border-gray-200 bg-bg-primary">
                <thead>
                    <tr>
                        {HEADERS.map((h) => (
                            <th key={h} className={TH_STYLE}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {GM_METRICS.map(({ key, label }) => (
                        <MetricRow
                            key={key}
                            field={`${key}_${code}`}
                            form={form}
                            getLastWeekValue={getLastWeekValue}
                            label={label}
                            readOnly={readOnly}
                            setForm={setForm}
                        />
                    ))}
                    <NotesRow
                        field={`notes_${code}`}
                        form={form}
                        getLastWeekValue={getLastWeekValue}
                        readOnly={readOnly}
                        setForm={setForm}
                    />
                </tbody>
            </table>
            </div>
        </div>
    )
}

/** Per-Plant Summary section — one table per plant, or empty state. */
export function GmPlantSummarySection({ form, getLastWeekValue, plants, readOnly, setForm }) {
    return (
        <>
            <GmSectionHeader title="Per-Plant Summary" />
            {plants.length === 0 ? (
                <GmEmptyState message="No plants found." />
            ) : (
                <div className="flex flex-col gap-4">
                    {plants.map((p) => (
                        <PlantTable
                            key={p.plant_code}
                            form={form}
                            getLastWeekValue={getLastWeekValue}
                            plant={p}
                            readOnly={readOnly}
                            setForm={setForm}
                        />
                    ))}
                </div>
            )}
        </>
    )
}
