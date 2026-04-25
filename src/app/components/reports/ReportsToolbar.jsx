import React from 'react'

import TopSection from '../../../app/components/sections/TopSection'
import { usePreferences } from '../../../app/context/PreferencesContext'

/* ── Shared atoms — all flat, Plan-tab aesthetic ────────────────────────── */

/** Flat select with native chevron — no SVG-bg hack, matches the Plan tab. */
const flatSelectClass = 'text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7'
const flatSelectStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const FlatSelect = ({ value, onChange, options, ariaLabel, className = '' }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${flatSelectClass} ${className}`}
        style={flatSelectStyle}
        aria-label={ariaLabel}
    >
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
)

/** Refresh button — Plan-tab subtle action button. */
const RefreshButton = ({ isRefreshing, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)'
        }}
    >
        <i className={`fas fa-rotate ${isRefreshing ? 'fa-spin' : ''}`} />
        <span className="hidden sm:inline">{isRefreshing ? 'Syncing…' : 'Refresh'}</span>
    </button>
)

/** Plant filter button — same chrome as the rest of the filter row. */
const PlantFilterButton = ({ displayText, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="text-[12px] font-medium cursor-pointer rounded py-1.5 px-2 flex items-center gap-1.5 max-w-[200px]"
        style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)'
        }}
        title={displayText}
    >
        <span className="truncate">{displayText}</span>
        <i className="fas fa-chevron-down text-[9px]" style={{ color: 'var(--text-tertiary)' }} />
    </button>
)

/** Compact pill toggle — sliding-segment look matching Plan tab's view-mode toggle. */
const PillToggle = ({ options, value, onChange }) => {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    return (
        <div
            className="inline-flex items-center rounded p-0.5 gap-0.5"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
        >
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="rounded text-[11.5px] font-semibold cursor-pointer border-none px-2 py-1 transition-colors"
                        style={{
                            background: active ? accentColor : 'transparent',
                            color: active ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/** Compact date-range picker matching FlatSelect chrome. */
const DateRange = ({ from, to, onFromChange, onToChange }) => (
    <div
        className="flex items-center gap-1 rounded px-2 py-1 w-full sm:w-auto"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
    >
        <i className="fas fa-calendar-alt text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="text-[12px] bg-transparent focus:outline-none flex-1 min-w-0 sm:flex-none sm:w-[6.5rem]"
            style={{ color: 'var(--text-primary)' }}
        />
        <span className="text-[10px] select-none mx-0.5" style={{ color: 'var(--text-tertiary)' }}>
            –
        </span>
        <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="text-[12px] bg-transparent focus:outline-none flex-1 min-w-0 sm:flex-none sm:w-[6.5rem]"
            style={{ color: 'var(--text-primary)' }}
        />
    </div>
)

const SortSelect = ({ value, onChange, options }) => (
    <FlatSelect
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel="Sort"
        className="flex-1 sm:flex-none min-w-[130px]"
    />
)

const ClearButton = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 rounded text-[12px] font-semibold px-2 py-1.5 cursor-pointer transition-colors"
        style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)'
        }}
    >
        <i className="fas fa-times text-[10px]" />
        Clear
    </button>
)

/* ── Top toolbar — wraps TopSection with search + plant + refresh ─────── */

/**
 * Sticky page header for Reports. Drops the in-toolbar tab strip — the tab
 * pills now live in `<ReportsActionBar>` rendered below this toolbar so the
 * page reads like the Plan tab (TopSection on top, action bar underneath).
 */
function ReportsToolbar({
    plantDisplayText,
    onPlantModalOpen,
    isLoading = false,
    searchInput,
    onSearchInputChange,
    onClearSearch
}) {
    return (
        <TopSection
            isLoading={isLoading}
            title="Reports"
            hideViewModeToggle
            hidePlantFilter
            sticky
            searchPlaceholder="Search by name or report type"
            searchInput={searchInput}
            onSearchInputChange={onSearchInputChange}
            onClearSearch={onClearSearch}
            customFilters={
                <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                    <PlantFilterButton displayText={plantDisplayText} onClick={onPlantModalOpen} />
                </div>
            }
        />
    )
}

/* ── Action bar — Plan-tab style toolbar that hosts the tab pills ─────── */

/**
 * Slim sticky bar rendered directly below `ReportsToolbar`. Mirrors the
 * PlanView header bar: scope chip on the left, action buttons in the
 * middle, and the tab segmented control on the right. Tabs replace the
 * old in-toolbar tab strip so the layout matches Plan / Schedule / Demand.
 */
export function ReportsActionBar({
    tabs,
    activeTab,
    onTabChange,
    onExport,
    canExport = false,
    isExporting = false,
    isRefreshing = false,
    onRefresh,
    scopeLabel,
    leftChildren,
    rightChildren
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isDark = preferences.themeMode === 'dark'
    const safeTabs = Array.isArray(tabs) ? tabs : []

    return (
        <div
            className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
            {onRefresh && <RefreshButton isRefreshing={isRefreshing} onClick={onRefresh} />}
            {scopeLabel && (
                <span
                    className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold px-2 py-1"
                    style={{
                        background: `${accentColor}${isDark ? '30' : '15'}`,
                        color: accentColor
                    }}
                >
                    <i className="fas fa-bullseye text-[9px]" />
                    {scopeLabel}
                </span>
            )}
            {leftChildren}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {onExport && (
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={!canExport || isExporting}
                        className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                        title="Export the current view to CSV"
                    >
                        <i className={`fas ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-export'}`} />
                        <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export'}</span>
                    </button>
                )}
                {rightChildren}
                {safeTabs.length > 1 && (
                    <div
                        className="flex items-center rounded p-0.5 overflow-x-auto"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
                    >
                        {safeTabs.map(({ key, label, icon }) => {
                            const isActive = activeTab === key
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => onTabChange?.(key)}
                                    className="flex items-center gap-1.5 rounded text-[12px] font-semibold border-none cursor-pointer px-2.5 py-1.5 whitespace-nowrap"
                                    style={{
                                        backgroundColor: isActive ? accentColor : 'transparent',
                                        color: isActive ? '#fff' : 'var(--text-secondary)'
                                    }}
                                >
                                    {icon && <i className={`fas ${icon} text-[11px]`} />}
                                    <span>{label}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Per-tab filter bars — same flat chrome as Plan tab dropdowns ─────── */

const QC_TYPE_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'qc_strength', label: 'QC Strength' },
    { value: 'third_party_lab', label: 'Third Party Lab' }
]

const QC_STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewed', label: 'Reviewed' }
]

export function QcFilterBar({
    qcTypeFilter,
    onQcTypeFilterChange,
    qcStatusFilter,
    onQcStatusFilterChange,
    qcSort,
    onQcSortChange,
    qcDateFrom,
    onQcDateFromChange,
    qcDateTo,
    onQcDateToChange,
    qcHasActiveFilters,
    onClearQcFilters
}) {
    return (
        <div className="flex items-stretch sm:items-center flex-wrap gap-2 w-full">
            <PillToggle options={QC_TYPE_OPTIONS} value={qcTypeFilter} onChange={onQcTypeFilterChange} />
            <PillToggle options={QC_STATUS_OPTIONS} value={qcStatusFilter} onChange={onQcStatusFilterChange} />
            {qcHasActiveFilters && <ClearButton onClick={onClearQcFilters} />}
            <div className="flex items-stretch sm:items-center flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                <SortSelect
                    value={qcSort}
                    onChange={onQcSortChange}
                    options={[
                        { value: 'newest', label: 'Newest First' },
                        { value: 'oldest', label: 'Oldest First' },
                        { value: 'cast_desc', label: 'Cast Date ↓' },
                        { value: 'cast_asc', label: 'Cast Date ↑' }
                    ]}
                />
                <DateRange
                    from={qcDateFrom}
                    to={qcDateTo}
                    onFromChange={onQcDateFromChange}
                    onToChange={onQcDateToChange}
                />
            </div>
        </div>
    )
}

const REVIEW_STATUS_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Reviewed', value: 'reviewed' }
]

export function ReviewFilterBar({
    statusFilter,
    onStatusFilterChange,
    reportTypeFilter,
    onReportTypeFilterChange,
    reportTypeOptions = [],
    sort,
    onSortChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    hasActiveFilters,
    onClear
}) {
    const reportTypeSelectOptions = [
        { value: '', label: 'All Report Types' },
        ...reportTypeOptions.map((opt) => ({ value: opt.name, label: opt.title }))
    ]
    return (
        <div className="flex items-stretch sm:items-center flex-wrap gap-2 w-full">
            <PillToggle options={REVIEW_STATUS_OPTIONS} value={statusFilter} onChange={onStatusFilterChange} />
            <FlatSelect
                value={reportTypeFilter || ''}
                onChange={onReportTypeFilterChange}
                options={reportTypeSelectOptions}
                ariaLabel="Report type"
                className="min-w-0 sm:min-w-[150px] flex-1 sm:flex-none"
            />
            {hasActiveFilters && <ClearButton onClick={onClear} />}
            <div className="flex items-stretch sm:items-center flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                <SortSelect
                    value={sort}
                    onChange={onSortChange}
                    options={[
                        { value: 'newest', label: 'Newest First' },
                        { value: 'oldest', label: 'Oldest First' }
                    ]}
                />
                <DateRange from={dateFrom} to={dateTo} onFromChange={onDateFromChange} onToChange={onDateToChange} />
            </div>
        </div>
    )
}

const LOSS_DUMP_LOCATION_OPTIONS = [
    { label: 'Dump Locations', value: 'all' },
    { label: 'Yard', value: 'Yard' },
    { label: 'Job Site', value: 'Job Site' },
    { label: 'Blocks', value: 'Blocks' },
    { label: 'Other', value: 'Other' }
]

const LOSS_REASON_OPTIONS = [
    { label: 'All Reasons', value: 'all' },
    { label: 'Plant Manager Error', value: 'Plant Manager Error' },
    { label: 'Operator Error', value: 'Operator Error' },
    { label: 'Plant Issue', value: 'Plant Issue' },
    { label: 'Truck Issues', value: 'Truck Issues' },
    { label: 'Other', value: 'Other' }
]

export function LossFilterBar({
    dumpLocationFilter,
    onDumpLocationFilterChange,
    reasonFilter,
    onReasonFilterChange,
    sort,
    onSortChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    hasActiveFilters,
    onClear,
    onExport
}) {
    return (
        <div className="flex items-stretch sm:items-center flex-wrap gap-2 w-full">
            <FlatSelect
                value={dumpLocationFilter}
                onChange={onDumpLocationFilterChange}
                options={LOSS_DUMP_LOCATION_OPTIONS}
                ariaLabel="Dump location"
            />
            <FlatSelect
                value={reasonFilter}
                onChange={onReasonFilterChange}
                options={LOSS_REASON_OPTIONS}
                ariaLabel="Reason"
            />
            {hasActiveFilters && <ClearButton onClick={onClear} />}
            <div className="flex items-stretch sm:items-center flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                {onExport && (
                    <button
                        type="button"
                        onClick={onExport}
                        className="flex items-center justify-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer flex-1 sm:flex-none"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <i className="fas fa-file-export text-[10px]" />
                        Export
                    </button>
                )}
                <SortSelect
                    value={sort}
                    onChange={onSortChange}
                    options={[
                        { value: 'newest', label: 'Newest First' },
                        { value: 'oldest', label: 'Oldest First' }
                    ]}
                />
                <DateRange from={dateFrom} to={dateTo} onFromChange={onDateFromChange} onToChange={onDateToChange} />
            </div>
        </div>
    )
}

/**
 * Mobile-friendly wrapper for any of the per-tab filter bars. Renders the
 * filters inline above `sm`; on small screens it shows a compact header row
 * with an active-filter count and toggles the bar open/closed.
 */
export function MobileFilterShell({ activeCount = 0, children, defaultOpen = false, label = 'Filters' }) {
    const [open, setOpen] = React.useState(defaultOpen)
    return (
        <>
            <div className="sm:hidden flex items-center justify-between gap-2 mb-2">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <i className="fas fa-sliders text-[10px]" />
                    {label}
                    {activeCount > 0 && (
                        <span
                            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                        >
                            {activeCount}
                        </span>
                    )}
                    <i
                        className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px]`}
                        style={{ color: 'var(--text-tertiary)' }}
                    />
                </button>
            </div>
            <div className={`${open ? 'block' : 'hidden'} sm:block`}>{children}</div>
        </>
    )
}

export default ReportsToolbar
