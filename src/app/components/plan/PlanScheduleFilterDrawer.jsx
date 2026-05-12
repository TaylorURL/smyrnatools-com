/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useState } from 'react'

import { SORT_OPTIONS } from '../../../utils/PlanScheduleUtility'
import { plantBadgeColor } from '../../../utils/PlanUtility'
import PlantDropdownModal from '../common/PlantDropdownModal'

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

/** Pill button used for the Status row. Active state uses the user's accent
 *  at 18% background; idle uses bg-secondary. Click-through props match a
 *  plain `<button type="button">`. */
function StatusPill({ accent, active, count, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold cursor-pointer border-none transition-colors"
            style={{
                background: active ? `${accent}26` : 'var(--bg-secondary)',
                border: `1px solid ${active ? accent : 'var(--border-light)'}`,
                color: active ? accent : 'var(--text-secondary)'
            }}
        >
            {label}
            <span
                className="rounded px-1 text-[10.5px] font-mono tabular-nums"
                style={{
                    background: active ? `${accent}33` : 'var(--bg-tertiary)',
                    color: active ? accent : 'var(--text-tertiary)'
                }}
            >
                {count}
            </span>
        </button>
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
    onCopyRoster,
    onExitMaximized,
    onTogglePlantFilter,
    onToggleExtraRows,
    operatorRosterCopied,
    operatorRosterReady,
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
     *  the single horizontal row. Keeps the row scannable without forcing
     *  visual bands. */
    const Divider = () => <span aria-hidden className="hidden md:inline-block bg-[var(--border-light)] h-[22px] w-px" />

    return (
        <div
            className="rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            {/* Search — flexes to fill spare width on the row. */}
            <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 flex-1 min-w-[200px] bg-bg-secondary border border-border-light">
                <i className="fas fa-magnifying-glass text-[11px] text-text-tertiary" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onChangeQuery(e.target.value)}
                    placeholder="Search customer, address, PO, product…"
                    className="bg-transparent outline-none border-none text-[12.5px] w-full text-text-primary"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => onChangeQuery('')}
                        className="border-none bg-transparent cursor-pointer text-text-tertiary"
                        aria-label="Clear search"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                )}
            </div>

            <Divider />

            {/* Plants — opens the multi-select PlantDropdownModal. */}
            <button
                type="button"
                onClick={() => setPlantModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold cursor-pointer text-left"
                style={{
                    ...FIELD_INPUT_STYLE,
                    color: plantFilters.length === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                    minWidth: 150
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

            {/* Product. */}
            <select
                value={productFilter}
                onChange={(e) => onChangeProduct(e.target.value)}
                className="rounded-md px-2.5 py-1.5 text-[12.5px] cursor-pointer"
                style={{ ...FIELD_INPUT_STYLE, maxWidth: 180 }}
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

            {/* Min yardage. */}
            <input
                type="number"
                value={minYards}
                onChange={(e) => onChangeMinYards(e.target.value)}
                placeholder="Min yds"
                min={0}
                className="rounded-md px-2.5 py-1.5 text-[12.5px] font-mono"
                style={{ ...FIELD_INPUT_STYLE, width: 90 }}
                title="Minimum yardage"
                aria-label="Minimum yardage"
            />

            {/* Sort by. */}
            <select
                value={sortKey}
                onChange={(e) => onChangeSort(e.target.value)}
                className="rounded-md px-2.5 py-1.5 text-[12.5px] cursor-pointer"
                style={{ ...FIELD_INPUT_STYLE, maxWidth: 200 }}
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

            <Divider />

            {/* Status pills. */}
            <div className="inline-flex items-center gap-1">
                <StatusPill
                    accent={accentColor}
                    active={statusFilter === 'all'}
                    count={statusCounts.all}
                    label="All"
                    onClick={() => onChangeStatus('all')}
                />
                <StatusPill
                    accent={accentColor}
                    active={statusFilter === 'scheduled'}
                    count={statusCounts.scheduled}
                    label="Scheduled"
                    onClick={() => onChangeStatus('scheduled')}
                />
                <StatusPill
                    accent={accentColor}
                    active={statusFilter === 'sameDay'}
                    count={statusCounts.sameDay}
                    label="Same-day"
                    onClick={() => onChangeStatus('sameDay')}
                />
            </div>

            <Divider />

            {/* Cancelled / test visibility toggles. */}
            <ToggleSwitch
                accent={accentColor}
                checked={showCancelled}
                count={statusCounts.cancelled}
                label="Cancelled"
                onChange={onChangeShowCancelled}
                tone="danger"
            />
            <ToggleSwitch
                accent={accentColor}
                checked={showTest}
                count={statusCounts.test}
                label="Test"
                onChange={onChangeShowTest}
                tone="warning"
            />

            {/* Plant tools — inline on the same row when EXACTLY one plant
                is selected. Stays hidden for zero / 2+ plants since the
                actions don't have a single subject. */}
            {singlePlant && (
                <>
                    <Divider />
                    <span
                        className="inline-flex items-center gap-2 rounded-md px-2 py-1 font-bold tabular-nums text-white text-[11.5px]"
                        style={{ background: plantBadge, border: `1px solid ${plantBadge}` }}
                        title={activePlantName ? `${singlePlant} · ${activePlantName}` : singlePlant}
                    >
                        <i className="fas fa-industry text-[10px]" />
                        {singlePlant}
                        {activePlantName && <span className="font-normal opacity-90">· {activePlantName}</span>}
                    </span>
                    <button
                        type="button"
                        onClick={onCopyRoster}
                        disabled={!operatorRosterReady}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                        style={{
                            background: operatorRosterCopied
                                ? '#16a34a'
                                : operatorRosterReady
                                  ? accentColor
                                  : 'var(--bg-secondary)',
                            border: `1px solid ${
                                operatorRosterCopied
                                    ? '#16a34a'
                                    : operatorRosterReady
                                      ? accentColor
                                      : 'var(--border-light)'
                            }`,
                            color: operatorRosterCopied || operatorRosterReady ? '#fff' : 'var(--text-tertiary)'
                        }}
                        title={
                            operatorRosterCopied
                                ? 'Copied operator clock-in times'
                                : `Copy operator clock-in times for ${singlePlant}`
                        }
                    >
                        <i className={`fas fa-${operatorRosterCopied ? 'check' : 'copy'} text-[10.5px]`} />
                        {operatorRosterCopied ? 'Copied' : 'Copy roster'}
                    </button>
                    <ToggleSwitch
                        accent={accentColor}
                        checked={showExtraRows}
                        label="Extras"
                        onChange={() => onToggleExtraRows()}
                    />
                </>
            )}

            {/* Right-aligned tail: match count + Reset. `flex-1` spacer
                pushes both to the right edge of the row. */}
            <div className="flex-1 min-w-[8px]" />
            {Number.isFinite(totalShown) && Number.isFinite(totalUnfiltered) && (
                <span className="text-[11.5px] text-text-secondary">
                    <span className="font-mono tabular-nums font-semibold text-text-primary">{totalShown}</span>
                    {' / '}
                    <span className="font-mono tabular-nums">{totalUnfiltered}</span>
                </span>
            )}
            {typeof onClearFilters === 'function' && (
                <button
                    type="button"
                    onClick={onClearFilters}
                    className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary"
                >
                    <i className="fas fa-rotate-left mr-1" />
                    Reset
                </button>
            )}
            {typeof onExitMaximized === 'function' && (
                <button
                    type="button"
                    onClick={onExitMaximized}
                    className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary"
                    title="Exit maximised view"
                >
                    <i className="fas fa-down-left-and-up-right-to-center mr-1" />
                    Exit
                </button>
            )}
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
