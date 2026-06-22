import React from 'react'

import { TD_STYLE, TH_STYLE } from '../../../../views/reporting/reports/types/shared'
import { reportTypeMap } from '../../../types/ReportTypes'
import { GmEmptyState, VarianceCell } from './GmAtoms'

const HEADERS = ['Material', 'Last Week', 'This Week', 'Variance']

function getValue(reportData, fieldName) {
    if (!reportData) return ''
    const v = reportData[fieldName]
    return v === undefined || v === null ? '' : v
}

/** Single material row in the aggregate table. */
function MaterialRow({ aggReport, field, lastWeekAgg }) {
    const lastValue = getValue(lastWeekAgg?.data, field.name)
    const currentValue = getValue(aggReport?.data, field.name)
    return (
        <tr className="hover:[&>td]:bg-slate-50">
            <td className={TD_STYLE}>{field.label}</td>
            <td className={TD_STYLE}>{lastValue || '—'}</td>
            <td className={TD_STYLE}>{aggReport.data?.[field.name] ?? '—'}</td>
            <td className={TD_STYLE}>
                <VarianceCell lastValue={lastValue} currentValue={currentValue} />
            </td>
        </tr>
    )
}

/** Aggregate Production section — material × variance table, or empty
 *  state when no aggregate report exists for the week. */
export function GmAggregateProductionSection({ aggReport, lastWeekAgg }) {
    return (
        <>
            <div className="text-lg font-semibold text-slate-800">Aggregate Production</div>
            <div className="rounded-lg border border-gray-200 bg-bg-primary p-4">
                {aggReport ? (
                    <div className="overflow-x-auto mt-4">
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
                            {reportTypeMap.aggregate_production.fields.map((field) => (
                                <MaterialRow
                                    key={field.name}
                                    aggReport={aggReport}
                                    field={field}
                                    lastWeekAgg={lastWeekAgg}
                                />
                            ))}
                        </tbody>
                    </table>
                    </div>
                ) : (
                    <GmEmptyState message="No aggregate production report found." />
                )}
            </div>
        </>
    )
}
