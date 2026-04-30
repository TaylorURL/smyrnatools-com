import React from 'react'

import { SORT_OPTIONS } from '../../../utils/PlanScheduleUtility'
import PlanScheduleFilterField from './PlanScheduleFilterField'

/* Shared inline styles for select / input controls — keeps every field in
 * the drawer aligned visually. */
const FIELD_INPUT_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/**
 * Filter drawer — search box + plant / status / product / min-yardage / sort
 * controls used to narrow the schedule. Stateless: all values come in as
 * props and changes route back through the corresponding setters.
 */
export default function PlanScheduleFilterDrawer({
    minYards,
    onChangeMinYards,
    onChangePlant,
    onChangeProduct,
    onChangeQuery,
    onChangeSort,
    onChangeStatus,
    plantFilter,
    plantNameByCode,
    plantOptions,
    productFilter,
    productOptions,
    query,
    sortKey,
    statusCounts,
    statusFilter
}) {
    return (
        <div
            className="rounded-xl p-3 grid gap-3"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
            }}
        >
            <PlanScheduleFilterField label="Search">
                <div
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <i className="fas fa-magnifying-glass text-[11px]" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => onChangeQuery(e.target.value)}
                        placeholder="Customer, address, PO…"
                        className="bg-transparent outline-none border-none text-[12.5px] w-full"
                        style={{ color: 'var(--text-primary)' }}
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => onChangeQuery('')}
                            className="border-none bg-transparent cursor-pointer"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <i className="fas fa-times text-[10px]" />
                        </button>
                    )}
                </div>
            </PlanScheduleFilterField>

            <PlanScheduleFilterField label="Plant">
                <select
                    value={plantFilter}
                    onChange={(e) => onChangePlant(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                    style={FIELD_INPUT_STYLE}
                >
                    <option value="all">All plants · {plantOptions.length}</option>
                    {plantOptions.map((code) => (
                        <option key={code} value={code}>
                            {code}
                            {plantNameByCode?.[code] ? ` · ${plantNameByCode[code]}` : ''}
                        </option>
                    ))}
                </select>
            </PlanScheduleFilterField>

            <PlanScheduleFilterField label="Status">
                <select
                    value={statusFilter}
                    onChange={(e) => onChangeStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                    style={FIELD_INPUT_STYLE}
                >
                    <option value="all">All · {statusCounts.all}</option>
                    <option value="scheduled">Scheduled · {statusCounts.scheduled}</option>
                    <option value="sameDay">Same-day · {statusCounts.sameDay}</option>
                    <option value="cancelled">Cancelled · {statusCounts.cancelled}</option>
                    <option value="test">Test · {statusCounts.test}</option>
                </select>
            </PlanScheduleFilterField>

            <PlanScheduleFilterField label="Product">
                <select
                    value={productFilter}
                    onChange={(e) => onChangeProduct(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                    style={FIELD_INPUT_STYLE}
                >
                    <option value="all">All products · {productOptions.length}</option>
                    {productOptions.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
            </PlanScheduleFilterField>

            <PlanScheduleFilterField label="Min yardage">
                <input
                    type="number"
                    value={minYards}
                    onChange={(e) => onChangeMinYards(e.target.value)}
                    placeholder="Any"
                    min={0}
                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] font-mono"
                    style={FIELD_INPUT_STYLE}
                />
            </PlanScheduleFilterField>

            <PlanScheduleFilterField label="Sort by">
                <select
                    value={sortKey}
                    onChange={(e) => onChangeSort(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md text-[12.5px] cursor-pointer"
                    style={FIELD_INPUT_STYLE}
                >
                    {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                            {o.label}
                            {o.desc ? ' (high → low)' : ''}
                        </option>
                    ))}
                </select>
            </PlanScheduleFilterField>
        </div>
    )
}
