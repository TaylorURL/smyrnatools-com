/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../../../../utils/PlanStatisticsFormatUtility'

export const MISMATCH_BADGES = {
    multiTruck: { bg: 'rgba(194, 65, 12, 0.16)', icon: 'fa-shuffle', label: 'Multi-truck' },
    unassigned: { bg: 'rgba(220, 38, 38, 0.14)', icon: 'fa-user-slash', label: 'Unassigned' },
    wrongPlant: { bg: 'rgba(217, 119, 6, 0.14)', icon: 'fa-industry', label: 'Wrong plant' },
    wrongTruck: { bg: 'rgba(234, 179, 8, 0.18)', icon: 'fa-truck', label: 'Wrong truck' }
}

export function MismatchBadge({ tone }) {
    const cfg = MISMATCH_BADGES[tone]
    if (!cfg) return null
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-primary"
            style={{ background: cfg.bg }}
            title={cfg.label}
        >
            <i className={`fas ${cfg.icon} text-[9px]`} />
            {cfg.label}
        </span>
    )
}

/** Trucks the operator actually drove this window. Each chip turns
 *  green when it matches their assigned mixer (so the row reads "yes,
 *  they were in their truck") and stays neutral otherwise. The
 *  assigned-mixer reference itself lives in `AssignedCell` to keep
 *  this column focused on real activity. */
export function TruckCell({ assignedTruck, trucksDriven }) {
    if (trucksDriven.length === 0) {
        return <span className="text-[11px] italic text-text-tertiary">No trucks</span>
    }
    return (
        <div className="flex flex-wrap items-center gap-1">
            {trucksDriven.map((truck) => {
                const isAssigned = assignedTruck === truck
                return (
                    <span
                        key={truck}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-semibold text-text-primary"
                        style={{
                            background: isAssigned ? 'rgba(22, 163, 74, 0.14)' : 'var(--bg-tertiary)'
                        }}
                        title={
                            isAssigned
                                ? `#${truck} · matches assigned mixer`
                                : assignedTruck
                                  ? `#${truck} · assigned mixer is #${assignedTruck}`
                                  : `#${truck} · operator has no assigned mixer`
                        }
                    >
                        #{truck}
                    </span>
                )
            })}
        </div>
    )
}

/** Operator's plant assignment — pulled strictly from the active-mixer
 *  roster (plant code + truck number), falling back to the operator
 *  record's `plant_code` for spare drivers without a fixed mixer. We do
 *  NOT infer a plant from where the driver happened to load tickets —
 *  operators are assigned to plants in the roster, not derived from
 *  load history. Rows that don't link to either source collapse into
 *  the dedicated "Unmatched drivers" bucket row instead of reaching
 *  this component. */
export function AssignedCell({ assignedPlant, assignedTruck }) {
    if (!assignedPlant && !assignedTruck) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold italic text-text-tertiary bg-bg-tertiary"
                title="Operator record has no active mixer assignment and no plant set"
            >
                <i className="fas fa-circle-question text-[9px]" />
                No assignment
            </span>
        )
    }
    return (
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {assignedPlant && (
                <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[11.5px] font-mono tabular-nums font-bold text-text-primary bg-bg-tertiary"
                    title={`Active-mixer roster plant: ${assignedPlant}`}
                >
                    {assignedPlant}
                </span>
            )}
            {assignedTruck && (
                <span
                    className="font-mono tabular-nums text-[11.5px] text-text-secondary"
                    title={`Assigned mixer #${assignedTruck}`}
                >
                    #{assignedTruck}
                </span>
            )}
        </div>
    )
}

/**
 * Section divider between groups on the Operators page when the plant
 * filter is active. Matches the dense `Stat`-style header rhythm used
 * elsewhere — uppercase title + count chip + muted hint — so the
 * grouping reads as part of the table, not a separate region.
 */
export function OperatorSegmentHeader({ count, hint, title }) {
    return (
        <div className="flex items-baseline gap-2.5 px-3 py-2 bg-bg-tertiary border-y border-border-light">
            <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-secondary">{title}</span>
            <span className="rounded-sm bg-bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-text-secondary border border-border-light">
                {fmtInt(count)}
            </span>
            {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

/**
 * Comments + History action chips that sit under an operator's name in
 * the Statistics → Operators row. Mirrors the pattern on `AssetListRow`'s
 * operator column (used by MixersView, TractorsView, …) so the same
 * affordance is available wherever an operator is rendered. Clicks bubble
 * up the operator object to the parent, which owns the modal state.
 */
export function OperatorActionButtons({ onComments, onHistory, operator }) {
    if (!operator?.employeeId) return null
    return (
        <div className="flex items-center gap-1 mt-1">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onComments?.(operator)
                }}
                title="Operator comments"
                className="inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 cursor-pointer transition-colors hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary"
            >
                <i className="fas fa-comment text-[8px]" />
                <span>Comments</span>
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onHistory?.(operator)
                }}
                title="Operator history"
                className="inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 cursor-pointer transition-colors hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary"
            >
                <i className="fas fa-history text-[8px]" />
                <span>History</span>
            </button>
        </div>
    )
}
