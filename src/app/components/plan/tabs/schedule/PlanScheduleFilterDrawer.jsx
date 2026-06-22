/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { SORT_OPTIONS } from '../../../../../utils/PlanScheduleUtility'
import { plantBadgeColor } from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'
import PlantDropdownModal from '../../../common/PlantDropdownModal'

const FIELD_INPUT_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pill helpers — small accent-tinted buttons / toggles used by the new
 * status row + visibility toggles + plant tools row. Tier colour is kept
 * subtle (12% bg + 100% fg) to match the rest of Statistics / Plan tabs.
 * ────────────────────────────────────────────────────────────────────────── */

/** Pill button used for the Status row. Active state lifts the body to
 *  `--bg-tertiary` (always the "more pronounced" neutral step beyond
 *  `--bg-secondary` in every theme — darker in light mode, lighter in
 *  dark / gray mode), with a stronger border and primary text. No accent
 *  hue — the selected state reads through neutral weight alone so it
 *  matches the project's Dot + Text language. Renders through the unified
 *  `Badge` so layout primitives stay consistent with every other pill in
 *  the app. */
function StatusPill({ active, count, label, onClick }) {
    return (
        <Badge
            as="button"
            variant="custom"
            shape="rounded-md"
            size="md"
            weight="semibold"
            uppercase={false}
            onClick={onClick}
            /* Mobile: equal-width tabs across a full-width row + 40px touch height.
             * Desktop: hug content like the original inline pill row. */
            className="flex-1 md:flex-none justify-center min-h-[40px] md:min-h-0 gap-1.5 border active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            style={{
                background: active ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                borderColor: active ? 'var(--border-medium)' : 'var(--border-light)',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
        >
            {label}
            <span
                className="rounded px-1 text-[10.5px] font-mono tabular-nums"
                style={{
                    background: active ? 'var(--border-medium)' : 'var(--bg-tertiary)',
                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)'
                }}
            >
                {count}
            </span>
        </Badge>
    )
}

/** Visibility toggle — boolean checkbox styled like the iOS-ish switches the
 *  rest of the site uses (grey track when off, accent track when on). */
function ToggleSwitch({ accent, checked, count, hint, label, onChange, tone = 'neutral' }) {
    const trackOn = tone === 'danger' ? '#dc2626' : tone === 'warning' ? '#d97706' : accent
    return (
        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-text-secondary">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
            <span
                className="relative inline-block rounded-full transition-[background-color] duration-150 h-[18px] w-8"
                style={{ background: checked ? trackOn : 'var(--border-medium)' }}
            >
                <span
                    className="absolute top-0.5 rounded-full bg-white transition-[left] duration-150 h-3.5 w-3.5"
                    style={{ left: checked ? 16 : 2 }}
                />
            </span>
            <span className="text-[12px] font-semibold text-text-primary">{label}</span>
            {Number.isFinite(count) && (
                <span className="text-[10.5px] font-mono tabular-nums rounded px-1 bg-bg-tertiary text-text-tertiary">
                    {count}
                </span>
            )}
            {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
        </label>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Filter drawer — consolidated layout. Three logical bands:
 *   (1) Search + view-mode + reset
 *   (2) Plant / Product / Min yardage / Sort by  (the dimensional filters)
 *   (3) Status pills + cancelled/test visibility toggles
 *   (4) Plant tools row — visible ONLY when a single plant is selected.
 *       Carries the per-plant actions that used to live in the floating
 *       bottom-left side rail (plant-scope chip, copy operator roster,
 *       extras toggle).
 *
 * The drawer is stateless: every value is owned by the view. Filter setters
 * passed in update parent state.
 * ────────────────────────────────────────────────────────────────────────── */

export default function PlanScheduleFilterDrawer({
    accent,
    activePlantName,
    minYards,
    onChangeMinYards,
    onChangeProduct,
    onChangeQuery,
    onChangeShowCancelled,
    onChangeShowTest,
    onChangeSort,
    onChangeStatus,
    onClearFilters,
    onExitMaximized,
    onTogglePlantFilter,
    onToggleExtraRows,
    plantFilters = [],
    plantNameByCode,
    plantOptions,
    plants = [],
    productFilter,
    productOptions,
    query,
    showCancelled,
    showExtraRows,
    showTest,
    sortKey,
    statusCounts,
    statusFilter,
    totalShown,
    totalUnfiltered
}) {
    const accentColor = accent || '#1e3a5f'
    const [plantModalOpen, setPlantModalOpen] = useState(false)
    /** Single-plant affordances (copy roster, scope chip, extras toggle)
     *  only light up when EXACTLY one plant is in the filter — otherwise
     *  the action either has no subject (zero plants) or is ambiguous
     *  (2+ plants). */
    const singlePlant = plantFilters.length === 1 ? plantFilters[0] : null
    const plantBadge = singlePlant ? plantBadgeColor(singlePlant, accentColor) : null
    /** Plant filter button label — "All plants", "401 · Bayetown", or
     *  "3 plants" depending on selection cardinality. */
    const plantButtonLabel =
        plantFilters.length === 0
            ? `All plants · ${plantOptions.length}`
            : singlePlant
              ? plantNameByCode?.[singlePlant]
                  ? `${singlePlant} · ${plantNameByCode[singlePlant]}`
                  : singlePlant
              : `${plantFilters.length} plants selected`

    /** Hairline vertical divider used to separate logical groups inside
     *  the single horizontal row on desktop. Mobile drops it entirely
     *  (`md:inline-block`) — vertical stack separation comes from row
     *  whitespace instead. */
    const Divider = () => <span aria-hidden className="hidden md:inline-block bg-[var(--border-light)] h-[22px] w-px" />

    /* Mobile layout strategy: the desktop drawer is a single flex-wrap row
     * that devolves into a jumble of 5+ unrelated widget shapes on a phone.
     * To fix that without forking the entire JSX into a mobile-only variant,
     * each logical group is wrapped in a flex container that's `w-full` on
     * mobile and `md:contents` on desktop. `md:contents` lets the children
     * flow back into the parent's `flex-wrap` row, so desktop behaviour is
     * unchanged. The result: on mobile the drawer reads as a vertical form
     * with full-width controls and ≥44px touch targets; on md+ it stays a
     * single horizontal toolbar. */

    /** Input height tuned for mobile touch (`min-h-[44px]`) while preserving
     *  the existing desktop `py-1.5` rhythm via `md:min-h-0 md:py-1.5`. */
    const inputHeightCls = 'min-h-[44px] md:min-h-0 py-2.5 md:py-1.5'

    return (
        <div
            className="rounded-xl px-3 py-3 md:py-2 flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-y-2 md:gap-x-3 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            {/* Search — full-width row on mobile, flexes within the toolbar on desktop. */}
            <div
                className={`flex items-center gap-2 rounded-md px-3 ${inputHeightCls} w-full md:w-auto md:flex-1 md:min-w-[200px] bg-bg-secondary border border-border-light transition-colors duration-150 hover:border-border-medium focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]`}
            >
                <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => onChangeQuery(e.target.value)}
                    placeholder="Search customer, address, PO…"
                    aria-label="Filter schedule"
                    className="bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-accent/30 border-none text-[13px] md:text-[12.5px] w-full text-text-primary placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                    <button type="button"
                        onClick={() => onChangeQuery('')}
                        className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent cursor-pointer text-text-tertiary hover:text-text-primary active:scale-[0.92] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                        aria-label="Clear search"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                )}
            </div>

            <Divider />

            {/* Plants — full-width on mobile, sized to content on desktop. */}
            <button type="button"
                onClick={() => setPlantModalOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={plantModalOpen}
                aria-label="Pick plants — supports districts and arbitrary multi-select"
                className={`inline-flex items-center gap-2 rounded-md px-3 ${inputHeightCls} text-[13px] md:text-[12.5px] font-semibold cursor-pointer text-left w-full md:w-auto md:min-w-[150px] active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:border-border-medium focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]`}
                style={{
                    ...FIELD_INPUT_STYLE,
                    color: plantFilters.length === 0 ? 'var(--text-secondary)' : 'var(--text-primary)'
                }}
                title="Pick plants — supports districts and arbitrary multi-select"
            >
                {plantFilters.length > 1 ? (
                    <i className="fas fa-layer-group text-[10.5px]" style={{ color: accentColor }} />
                ) : (
                    <i className="fas fa-industry text-[10.5px] text-text-tertiary" />
                )}
                <span className="truncate flex-1">{plantButtonLabel}</span>
                <i className="fas fa-chevron-down text-[10px] text-text-tertiary" />
            </button>

            {/* Product + Min yards row on mobile (50/50), free-flow on desktop. */}
            <div className="flex gap-2 w-full md:contents">
                <div className="relative flex-1 md:flex-none">
                    <select
                        value={productFilter}
                        onChange={(e) => onChangeProduct(e.target.value)}
                        className={`appearance-none rounded-md pl-3 pr-8 ${inputHeightCls} text-[13px] md:text-[12.5px] cursor-pointer outline-none transition-colors duration-150 w-full md:w-auto md:max-w-[180px] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]`}
                        style={FIELD_INPUT_STYLE}
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
                    <i
                        aria-hidden="true"
                        className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-text-tertiary"
                    />
                </div>

                {/* Min yardage. Numeric keypad on mobile via inputMode="numeric". */}
                <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={minYards}
                    onChange={(e) => onChangeMinYards(e.target.value)}
                    placeholder="Min yds"
                    min={0}
                    className={`rounded-md px-3 ${inputHeightCls} text-[13px] md:text-[12.5px] font-mono outline-none transition-colors duration-150 w-28 md:w-[90px] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]`}
                    style={FIELD_INPUT_STYLE}
                    title="Minimum yardage"
                    aria-label="Minimum yardage"
                />
            </div>

            {/* Sort by. */}
            <div className="relative w-full md:w-auto">
                <select
                    value={sortKey}
                    onChange={(e) => onChangeSort(e.target.value)}
                    className={`appearance-none rounded-md pl-3 pr-8 ${inputHeightCls} text-[13px] md:text-[12.5px] cursor-pointer outline-none transition-colors duration-150 w-full md:w-auto md:max-w-[200px] hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]`}
                    style={FIELD_INPUT_STYLE}
                    title="Sort by"
                    aria-label="Sort by"
                >
                    {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                            Sort: {o.label}
                            {o.desc ? ' ↓' : ''}
                        </option>
                    ))}
                </select>
                <i
                    aria-hidden="true"
                    className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-text-tertiary"
                />
            </div>

            <Divider />

            {/* Status pills — equal-width on mobile (full row), content-sized on desktop. */}
            <div className="flex w-full md:w-auto md:inline-flex items-center gap-1">
                <StatusPill
                    active={statusFilter === 'all'}
                    count={statusCounts.all}
                    label="All"
                    onClick={() => onChangeStatus('all')}
                />
                <StatusPill
                    active={statusFilter === 'scheduled'}
                    count={statusCounts.scheduled}
                    label="Scheduled"
                    onClick={() => onChangeStatus('scheduled')}
                />
                <StatusPill
                    active={statusFilter === 'sameDay'}
                    count={statusCounts.sameDay}
                    label="Same-day"
                    onClick={() => onChangeStatus('sameDay')}
                />
            </div>

            <Divider />

            {/* Cancelled / test visibility toggles — 50/50 on mobile, inline on desktop. */}
            <div className="flex gap-3 w-full md:contents">
                <div className="flex-1 md:flex-none">
                    <ToggleSwitch
                        accent={accentColor}
                        checked={showCancelled}
                        count={statusCounts.cancelled}
                        label="Cancelled"
                        onChange={onChangeShowCancelled}
                        tone="danger"
                    />
                </div>
                <div className="flex-1 md:flex-none">
                    <ToggleSwitch
                        accent={accentColor}
                        checked={showTest}
                        count={statusCounts.test}
                        label="Test"
                        onChange={onChangeShowTest}
                        tone="warning"
                    />
                </div>
            </div>

            {/* Plant tools — inline on the same row when EXACTLY one plant
                is selected. Stays hidden for zero / 2+ plants since the
                actions don't have a single subject. */}
            {singlePlant && (
                <>
                    <Divider />
                    <div className="flex items-center gap-3 w-full md:contents">
                        <Badge
                            variant="custom"
                            shape="rounded-md"
                            size="md"
                            uppercase={false}
                            className="gap-2 tabular-nums text-[11.5px]"
                            style={{ background: plantBadge, border: `1px solid ${plantBadge}`, color: '#fff' }}
                            title={activePlantName ? `${singlePlant} · ${activePlantName}` : singlePlant}
                        >
                            <i className="fas fa-industry text-[10px]" />
                            {singlePlant}
                            {activePlantName && <span className="font-normal opacity-90">· {activePlantName}</span>}
                        </Badge>
                        <ToggleSwitch
                            accent={accentColor}
                            checked={showExtraRows}
                            label="Extras"
                            onChange={() => onToggleExtraRows()}
                        />
                    </div>
                </>
            )}

            {/* Tail row — match count + Reset/Exit. Right-aligned and inline on
                desktop (the `flex-1` spacer pushes them to the row's edge);
                pulled into its own full-width row on mobile with the buttons
                pushed right via `ml-auto`. */}
            <div className="hidden md:block flex-1 min-w-[8px]" />
            <div className="flex items-center gap-2 w-full md:contents">
                {Number.isFinite(totalShown) && Number.isFinite(totalUnfiltered) && (
                    <span className="text-[12px] md:text-[11.5px] text-text-secondary">
                        <span className="font-mono tabular-nums font-semibold text-text-primary">{totalShown}</span>
                        {' / '}
                        <span className="font-mono tabular-nums">{totalUnfiltered}</span>
                        <span className="md:hidden"> shown</span>
                    </span>
                )}
                <div className="ml-auto flex items-center gap-2 md:contents">
                    {typeof onClearFilters === 'function' && (
                        <button type="button"
                            onClick={onClearFilters}
                            className="rounded-md min-h-[40px] md:min-h-0 px-3 py-2 md:py-1 text-[12.5px] md:text-[11.5px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        >
                            <i className="fas fa-rotate-left mr-1" />
                            Reset
                        </button>
                    )}
                    {typeof onExitMaximized === 'function' && (
                        <button type="button"
                            onClick={onExitMaximized}
                            className="rounded-md min-h-[40px] md:min-h-0 px-3 py-2 md:py-1 text-[12.5px] md:text-[11.5px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            title="Exit maximised view"
                        >
                            <i className="fas fa-down-left-and-up-right-to-center mr-1" />
                            Exit
                        </button>
                    )}
                </div>
            </div>
            <PlantDropdownModal
                allowMultiple
                isOpen={plantModalOpen}
                onClose={() => setPlantModalOpen(false)}
                onSelect={(code) => {
                    if (typeof onTogglePlantFilter === 'function') onTogglePlantFilter(code)
                }}
                plants={plants}
                searchPlaceholder="Search plants or districts…"
                selectedPlantCodes={plantFilters}
            />
        </div>
    )
}
