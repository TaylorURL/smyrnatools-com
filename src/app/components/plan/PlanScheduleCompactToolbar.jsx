import React from 'react'

import { SORT_OPTIONS } from '../../../utils/PlanScheduleUtility'

/* Shared field styling — keeps every control in the toolbar visually
 * aligned and matches the look of the full filter drawer. */
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/**
 * Slim sticky toolbar shown when the Schedule tab is maximized. Carries the
 * same controls as `PlanScheduleFilterDrawer` plus the view-mode toggle and
 * an Exit button — all the chrome the dispatcher needs to keep working
 * without the full title row, KPI strip, side rail, and drawer above the
 * table. Pins to the top of the schedule scroll container so it's always
 * one click away even on long scrolls.
 */
export default function PlanScheduleCompactToolbar({
    accentColor,
    activeFilterCount,
    allOrdersCount,
    filteredCount,
    hasActiveFilters,
    isMobile,
    minYards,
    onChangeMinYards,
    onChangePlant,
    onChangeProduct,
    onChangeQuery,
    onChangeSort,
    onChangeStatus,
    onChangeViewMode,
    onClearFilters,
    onExitMaximized,
    plantFilter,
    plantNameByCode,
    plantOptions,
    productFilter,
    productOptions,
    query,
    sortKey,
    statusCounts,
    statusFilter,
    viewMode,
    viewModes
}) {
    return (
        <div
            className="sticky top-0 z-20 flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
            }}
        >
            <div
                className="flex items-center gap-1.5 rounded-md px-2 py-1 flex-1 min-w-[160px] max-w-[260px]"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
                <i className="fas fa-magnifying-glass text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onChangeQuery(e.target.value)}
                    placeholder="Customer, address, PO…"
                    className="bg-transparent outline-none border-none text-[12px] w-full"
                    style={{ color: 'var(--text-primary)' }}
                    aria-label="Search schedule"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => onChangeQuery('')}
                        className="border-none bg-transparent cursor-pointer"
                        style={{ color: 'var(--text-tertiary)' }}
                        aria-label="Clear search"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                )}
            </div>

            <select
                value={plantFilter}
                onChange={(e) => onChangePlant(e.target.value)}
                className="rounded-md px-2 py-1 text-[12px] cursor-pointer"
                style={FIELD_STYLE}
                title="Plant"
                aria-label="Filter by plant"
            >
                <option value="all">All plants · {plantOptions.length}</option>
                {plantOptions.map((code) => (
                    <option key={code} value={code}>
                        {code}
                        {plantNameByCode?.[code] ? ` · ${plantNameByCode[code]}` : ''}
                    </option>
                ))}
            </select>

            <select
                value={statusFilter}
                onChange={(e) => onChangeStatus(e.target.value)}
                className="rounded-md px-2 py-1 text-[12px] cursor-pointer"
                style={FIELD_STYLE}
                title="Status"
                aria-label="Filter by status"
            >
                <option value="all">All · {statusCounts.all}</option>
                <option value="scheduled">Scheduled · {statusCounts.scheduled}</option>
                <option value="sameDay">Same-day · {statusCounts.sameDay}</option>
                <option value="cancelled">Cancelled · {statusCounts.cancelled}</option>
                <option value="test">Test · {statusCounts.test}</option>
            </select>

            <select
                value={productFilter}
                onChange={(e) => onChangeProduct(e.target.value)}
                className="rounded-md px-2 py-1 text-[12px] cursor-pointer"
                style={FIELD_STYLE}
                title="Product"
                aria-label="Filter by product"
            >
                <option value="all">All products · {productOptions.length}</option>
                {productOptions.map((p) => (
                    <option key={p} value={p}>
                        {p}
                    </option>
                ))}
            </select>

            <input
                type="number"
                value={minYards}
                onChange={(e) => onChangeMinYards(e.target.value)}
                placeholder="Min yd"
                min={0}
                className="rounded-md px-2 py-1 text-[12px] font-mono w-[88px]"
                style={FIELD_STYLE}
                title="Minimum yardage"
                aria-label="Minimum yardage"
            />

            <select
                value={sortKey}
                onChange={(e) => onChangeSort(e.target.value)}
                className="rounded-md px-2 py-1 text-[12px] cursor-pointer"
                style={FIELD_STYLE}
                title="Sort by"
                aria-label="Sort orders"
            >
                {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                        {o.label}
                        {o.desc ? ' ↓' : ''}
                    </option>
                ))}
            </select>

            <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {hasActiveFilters
                    ? `${filteredCount.toLocaleString()} of ${allOrdersCount.toLocaleString()}`
                    : `${allOrdersCount.toLocaleString()} orders`}
            </span>

            {hasActiveFilters && (
                <button
                    type="button"
                    onClick={onClearFilters}
                    className="px-2 py-1 rounded-md text-[11.5px] font-semibold border-none cursor-pointer"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-secondary)'
                    }}
                    title="Reset all filters"
                >
                    <i className="fas fa-rotate-left mr-1 text-[10px]" />
                    Reset{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
                </button>
            )}

            <div className="ml-auto flex items-center gap-2">
                {!isMobile && Array.isArray(viewModes) && viewModes.length > 1 && (
                    <div
                        className="flex items-center rounded-md p-0.5"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)'
                        }}
                    >
                        {viewModes.map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => onChangeViewMode(m)}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1"
                                style={{
                                    background: viewMode === m ? accentColor : 'transparent',
                                    color: viewMode === m ? '#fff' : 'var(--text-secondary)'
                                }}
                                title={m === 'table' ? 'Table view' : 'Cards view'}
                            >
                                <i className={`fas ${m === 'table' ? 'fa-table' : 'fa-grip'} text-[9px]`} />
                                {m === 'table' ? 'Table' : 'Cards'}
                            </button>
                        ))}
                    </div>
                )}
                <button
                    type="button"
                    onClick={onExitMaximized}
                    className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                    style={{ background: accentColor, color: '#fff' }}
                    title="Exit fullscreen schedule (Esc)"
                >
                    <i className="fas fa-compress text-[10px]" />
                    Exit
                </button>
            </div>
        </div>
    )
}
