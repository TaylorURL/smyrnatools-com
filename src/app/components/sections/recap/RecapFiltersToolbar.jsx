import React from 'react'

import { DATE_OPTIONS, TYPE_OPTIONS } from '../../../constants/recapConstants'
import RecapFilterPill from './RecapFilterPill'
import { formatFieldName } from './recapHelpers'
import RecapMetricCell from './RecapMetricCell'

/**
 * Sticky filter region inside the recap modal: search input, date/type pills,
 * field dropdown, and the four net-change metric tiles. State is fully owned
 * by the parent component — this is a presentational shell.
 */
function RecapFiltersToolbar({
    accentColor,
    searchQuery,
    onSearchQueryChange,
    dateFilter,
    onDateFilterChange,
    typeFilter,
    onTypeFilterChange,
    fieldFilter,
    onFieldFilterChange,
    availableFields,
    changeMetrics
}) {
    return (
        <div className="px-3 py-2 shrink-0 flex flex-col gap-2 bg-bg-secondary border-b border-border-light">
            <div className="relative">
                <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary" />
                <input
                    type="search"
                    placeholder="Search by name…"
                    aria-label="Search recap entries by name"
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-[12.5px] rounded outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => onSearchQueryChange('')}
                        aria-label="Clear search"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded border-none bg-transparent cursor-pointer text-text-tertiary hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors duration-150"
                    >
                        <i className="fa-solid fa-xmark text-[10px]" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                    {DATE_OPTIONS.map((d) => (
                        <RecapFilterPill
                            key={d.id}
                            active={dateFilter === d.id}
                            label={d.label}
                            onClick={() => onDateFilterChange(d.id)}
                            accentColor={accentColor}
                        />
                    ))}
                </div>
                <span className="w-px h-4 bg-[var(--border-light)]" />
                <div className="flex items-center gap-1">
                    {TYPE_OPTIONS.map((t) => (
                        <RecapFilterPill
                            key={t.id}
                            active={typeFilter === t.id}
                            label={t.label}
                            onClick={() => onTypeFilterChange(t.id)}
                            accentColor={accentColor}
                        />
                    ))}
                </div>
                {availableFields.length > 1 && (
                    <>
                        <span className="w-px h-4 bg-[var(--border-light)]" />
                        <select
                            value={fieldFilter}
                            onChange={(e) => onFieldFilterChange(e.target.value)}
                            aria-label="Filter by field"
                            className="rounded text-[11px] cursor-pointer font-medium px-2 py-1 outline-none bg-bg-primary border border-border-light text-text-primary transition-colors duration-150 hover:border-border-medium focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                        >
                            <option value="all">All fields</option>
                            {availableFields.map((f) => (
                                <option key={f} value={f}>
                                    {formatFieldName(f)}
                                </option>
                            ))}
                        </select>
                    </>
                )}
            </div>

            <div className="grid grid-cols-4 rounded overflow-hidden bg-bg-primary border border-border-light">
                <RecapMetricCell
                    value={changeMetrics.operatorsNet}
                    label="Operators"
                    icon="fa-user"
                    iconBg="#dbeafe"
                    iconFg="#1e40af"
                    positive
                />
                <RecapMetricCell
                    value={changeMetrics.runnableNet}
                    label="Runnable"
                    icon="fa-truck"
                    iconBg="#dcfce7"
                    iconFg="#166534"
                    positive
                />
                <RecapMetricCell
                    value={changeMetrics.downNet}
                    label="Down"
                    icon="fa-wrench"
                    iconBg="#fef3c7"
                    iconFg="#92400e"
                    positive={false}
                />
                <RecapMetricCell
                    value={changeMetrics.transfersNet}
                    label="Transfers"
                    icon="fa-right-left"
                    iconBg="#ede9fe"
                    iconFg="#6d28d9"
                    positive
                    last
                />
            </div>
        </div>
    )
}

export default RecapFiltersToolbar
