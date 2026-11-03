/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { DETAIL_SELECT_CLS } from '../../../constants/detailFormClasses'
import { DATE_OPTIONS, TYPE_OPTIONS } from '../../../constants/recapConstants'
import RecapFilterPill from './RecapFilterPill'
import { formatFieldName } from './recapHelpers'

const PERIOD_LABELS = { all: 'All time', day: '24 hours', month: '30 days', week: '7 days' }
const TYPE_LABELS = { all: 'Everything', mixers: 'Mixers', operators: 'Operators', terminated: 'Terminated' }

/** Net change for one measure, as a signed figure. `positive` says which
 *  direction is good — gaining operators reads green, gaining trucks in the
 *  shop reads red — and the colour follows. */
function NetFigure({ label, positive, value }) {
    const color =
        value === 0 ? 'var(--text-primary)' : value > 0 === positive ? 'var(--status-active)' : 'var(--status-danger)'
    return (
        <span className="inline-flex items-baseline gap-1.5">
            <span className="font-heading text-[18px] font-semibold tabular-nums" style={{ color }}>
                {value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'}
            </span>
            <span className="text-[13px] text-text-secondary">{label}</span>
        </span>
    )
}

/**
 * Everything above the change table: search, the period, what to show, an
 * optional field filter, then one line with the net change and the count.
 * It owns no state; every control reports upward.
 */
function RecapFiltersToolbar({
    assetCount,
    availableFields,
    changeCount,
    changeMetrics,
    dateFilter,
    fieldFilter,
    hasActiveFilters,
    onClearFilters,
    onDateFilterChange,
    onFieldFilterChange,
    onSearchQueryChange,
    onTypeFilterChange,
    searchQuery,
    typeFilter
}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                    <i
                        className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        placeholder="Search trucks and operators"
                        aria-label="Search recap by name"
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        className="h-9 w-full rounded-[4px] border border-border-medium bg-bg-primary pl-8 pr-3 text-[13px] text-text-primary outline-none focus-visible:outline-none placeholder:text-text-tertiary transition-colors duration-150 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                </div>
                <div
                    role="group"
                    aria-label="Period"
                    className="flex h-9 items-stretch overflow-hidden rounded-[4px] border border-border-medium"
                >
                    {DATE_OPTIONS.map((d) => (
                        <RecapFilterPill
                            key={d.id}
                            active={dateFilter === d.id}
                            label={PERIOD_LABELS[d.id] || d.label}
                            onClick={() => onDateFilterChange(d.id)}
                        />
                    ))}
                </div>
                <select
                    value={typeFilter}
                    onChange={(e) => onTypeFilterChange(e.target.value)}
                    aria-label="Show"
                    className={`${DETAIL_SELECT_CLS} !w-auto min-w-[140px]`}
                >
                    {TYPE_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>
                            {TYPE_LABELS[t.id] || t.label}
                        </option>
                    ))}
                </select>
                {availableFields.length > 1 && (
                    <select
                        value={fieldFilter}
                        onChange={(e) => onFieldFilterChange(e.target.value)}
                        aria-label="Filter by field"
                        className={`${DETAIL_SELECT_CLS} !w-auto min-w-[140px]`}
                    >
                        <option value="all">Every field</option>
                        {availableFields.map((f) => (
                            <option key={f} value={f}>
                                {formatFieldName(f)}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <NetFigure label="operators" positive value={changeMetrics.operatorsNet} />
                <NetFigure label="runnable" positive value={changeMetrics.runnableNet} />
                <NetFigure label="in the shop" positive={false} value={changeMetrics.downNet} />
                <NetFigure label="transfers" positive value={changeMetrics.transfersNet} />
                <span className="ml-auto flex items-center gap-3 text-[12px] tabular-nums text-text-secondary">
                    {changeCount} change{changeCount === 1 ? '' : 's'} on {assetCount} record
                    {assetCount === 1 ? '' : 's'}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-medium text-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            Clear filters
                        </button>
                    )}
                </span>
            </div>
        </div>
    )
}

export default RecapFiltersToolbar
