/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../app/components/common/Badge'
import TopSection from '../../../app/components/sections/TopSection'
import PlantFilterButton from '../../../app/components/ui/PlantFilterButton'
import { isDarkLikeTheme } from '../../../app/constants/themeConstants'
import { usePreferences } from '../../../app/context/PreferencesContext'

/* ── Shared atoms — all flat, Plan-tab aesthetic ────────────────────────── */

/** Flat select with inline SVG chevron — `appearance-none` strips the
 *  browser's native arrow so the dropdown affordance reads identically in
 *  light / dark / gray themes. `currentColor` keeps the glyph in sync with
 *  the select's text color. */
const flatSelectClass =
    "appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:0.875rem_0.875rem] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke=%22currentColor%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20stroke-width=%222%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] [color-scheme:light] dark:[color-scheme:dark] text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7 bg-bg-secondary border border-border-light text-text-primary transition-colors duration-150 hover:border-border-medium focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed"

const FlatSelect = ({ value, onChange, options, ariaLabel, className = '' }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${flatSelectClass} ${className}`}
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
    <button type="button"
        type="button"
        onClick={onClick}
        disabled={isRefreshing}
        aria-label={isRefreshing ? 'Refreshing' : 'Refresh'}
        className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-bg-secondary border border-border-light text-text-primary hover:bg-bg-tertiary hover:border-border-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
    >
        <i className={`fas fa-rotate ${isRefreshing ? 'fa-spin' : ''}`} />
        <span className="hidden sm:inline">{isRefreshing ? 'Syncing…' : 'Refresh'}</span>
    </button>
)

// Trigger button extracted to `app/components/ui/PlantFilterButton` so the
// same chip is used wherever a plant picker is exposed.

const PILL_FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary'

/** Compact pill toggle — sliding-segment look matching Plan tab's view-mode toggle. */
const PillToggle = ({ options, value, onChange, ariaLabel }) => (
    <div
        role="group"
        aria-label={ariaLabel}
        className="inline-flex items-center rounded p-0.5 gap-0.5 bg-bg-tertiary border border-border-light"
    >
        {options.map((opt) => {
            const isActive = value === opt.value
            return (
                <Badge
                    key={opt.value}
                    as="button"
                    tone="accent"
                    variant={isActive ? 'solid' : 'soft'}
                    size="md"
                    shape="rounded"
                    weight="semibold"
                    uppercase={false}
                    onClick={() => onChange(opt.value)}
                    aria-pressed={isActive}
                    className={isActive ? PILL_FOCUS_RING : `bg-transparent text-text-secondary ${PILL_FOCUS_RING}`}
                >
                    {opt.label}
                </Badge>
            )
        })}
    </div>
)

/** Compact date-range picker matching FlatSelect chrome. The wrapper carries
 *  the focus ring via `focus-within` so the two date inputs feel like one
 *  unit; individual inputs intentionally drop their own outlines. */
const DateRange = ({ from, to, onFromChange, onToChange }) => (
    <div className="flex items-center gap-1 rounded px-2 py-1 w-full sm:w-auto bg-bg-secondary border border-border-light hover:border-border-medium transition-colors duration-150 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/40 focus-within:ring-offset-1 focus-within:ring-offset-bg-primary">
        <i className="fas fa-calendar-alt text-[10px] shrink-0 pointer-events-none text-text-tertiary" />
        <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="text-[12px] bg-transparent focus:outline-none rounded-sm flex-1 min-w-0 sm:flex-none sm:w-[6.5rem] text-text-primary [color-scheme:light] dark:[color-scheme:dark]"
        />
        <span className="text-[10px] select-none mx-0.5 text-text-tertiary">–</span>
        <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="text-[12px] bg-transparent focus:outline-none rounded-sm flex-1 min-w-0 sm:flex-none sm:w-[6.5rem] text-text-primary [color-scheme:light] dark:[color-scheme:dark]"
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
    <button type="button"
        type="button"
        onClick={onClick}
        aria-label="Clear filters"
        className="flex items-center gap-1 rounded text-[12px] font-semibold px-2 py-1.5 cursor-pointer transition-colors duration-150 bg-bg-secondary border border-border-light text-text-secondary hover:bg-bg-tertiary hover:border-border-medium hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
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
 * OperationsView header bar: scope chip on the left, action buttons in the
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
    const isDark = isDarkLikeTheme(preferences.themeMode)
    const safeTabs = Array.isArray(tabs) ? tabs : []

    return (
        <div className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2 bg-bg-primary border-border-light">
            {onRefresh && <RefreshButton isRefreshing={isRefreshing} onClick={onRefresh} />}
            {scopeLabel && (
                <Badge
                    tone="accent"
                    variant="custom"
                    size="md"
                    weight="semibold"
                    uppercase={false}
                    icon="bullseye"
                    bg={`${accentColor}${isDark ? '30' : '15'}`}
                    className="text-text-primary"
                >
                    {scopeLabel}
                </Badge>
            )}
            {leftChildren}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {onExport && (
                    <button type="button"
                        type="button"
                        onClick={onExport}
                        disabled={!canExport || isExporting}
                        className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-bg-secondary border border-border-light text-text-primary hover:bg-bg-tertiary hover:border-border-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        title="Export the current view to CSV"
                    >
                        <i className={`fas ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-export'}`} />
                        <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export'}</span>
                    </button>
                )}
                {rightChildren}
                {safeTabs.length > 1 && (
                    <div
                        role="tablist"
                        aria-label="Report tabs"
                        className="flex items-center rounded p-0.5 overflow-x-auto bg-bg-tertiary border border-border-light"
                    >
                        {safeTabs.map(({ key, label, icon, badge }) => {
                            const isActive = activeTab === key
                            return (
                                <button type="button"
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => onTabChange?.(key)}
                                    className="flex items-center gap-1.5 rounded text-[12px] font-semibold border-none cursor-pointer px-2.5 py-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                                    style={{
                                        backgroundColor: isActive ? accentColor : 'transparent',
                                        color: isActive ? '#fff' : 'var(--text-secondary)'
                                    }}
                                >
                                    {icon && <i className={`fas ${icon} text-[11px]`} />}
                                    <span>{label}</span>
                                    {badge != null && badge !== 0 && (
                                        <Badge
                                            tone={isActive ? 'neutral' : 'danger'}
                                            variant={isActive ? 'custom' : 'solid'}
                                            size="xs"
                                            shape="rounded"
                                            weight="bold"
                                            className={
                                                isActive
                                                    ? 'bg-white/25 text-white font-mono tabular-nums'
                                                    : 'font-mono tabular-nums'
                                            }
                                        >
                                            {badge}
                                        </Badge>
                                    )}
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
    { label: 'All Types', value: 'all' },
    { label: 'QC Strength', value: 'qc_strength' },
    { label: 'Third Party Lab', value: 'third_party_lab' }
]

const QC_STATUS_OPTIONS = [
    { label: 'All Status', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Reviewed', value: 'reviewed' }
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
                        { label: 'Newest First', value: 'newest' },
                        { label: 'Oldest First', value: 'oldest' },
                        { label: 'Cast Date ↓', value: 'cast_desc' },
                        { label: 'Cast Date ↑', value: 'cast_asc' }
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
        { label: 'All Report Types', value: '' },
        ...reportTypeOptions.map((opt) => ({ label: opt.title, value: opt.name }))
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
                        { label: 'Newest First', value: 'newest' },
                        { label: 'Oldest First', value: 'oldest' }
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
                    <button type="button"
                        type="button"
                        onClick={onExport}
                        aria-label="Export lost loads"
                        className="flex items-center justify-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer flex-1 sm:flex-none bg-bg-secondary border border-border-light text-text-primary hover:bg-bg-tertiary hover:border-border-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                    >
                        <i className="fas fa-file-export text-[10px]" />
                        Export
                    </button>
                )}
                <SortSelect
                    value={sort}
                    onChange={onSortChange}
                    options={[
                        { label: 'Newest First', value: 'newest' },
                        { label: 'Oldest First', value: 'oldest' }
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
                <button type="button"
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-label={open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                    className="inline-flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 bg-bg-secondary border border-border-light text-text-primary hover:bg-bg-tertiary hover:border-border-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                >
                    <i className="fas fa-sliders text-[10px]" />
                    {label}
                    {activeCount > 0 && (
                        <Badge
                            tone="neutral"
                            variant="custom"
                            size="xs"
                            shape="pill"
                            weight="bold"
                            uppercase={false}
                            className="justify-center min-w-[18px] h-[18px] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                        >
                            {activeCount}
                        </Badge>
                    )}
                    <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px] text-text-tertiary`} />
                </button>
            </div>
            <div className={`${open ? 'block' : 'hidden'} sm:block`}>{children}</div>
        </>
    )
}

export default ReportsToolbar
