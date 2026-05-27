/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../../../../utils/PlanStatisticsFormatUtility'
import Badge from '../../../../../common/Badge'

const MISMATCH_TO_TONE = {
    multiTruck: 'danger',
    unassigned: 'warning',
    wrongPlant: 'danger',
    wrongTruck: 'danger'
}
const MISMATCH_ICON = {
    multiTruck: 'shuffle',
    unassigned: 'user-slash',
    wrongPlant: 'industry',
    wrongTruck: 'truck'
}
const MISMATCH_LABEL = {
    multiTruck: 'Multi-truck',
    unassigned: 'Unassigned',
    wrongPlant: 'Wrong plant',
    wrongTruck: 'Wrong truck'
}

export function MismatchBadge({ tone }) {
    if (!MISMATCH_TO_TONE[tone]) return null
    return (
        <Badge
            tone={MISMATCH_TO_TONE[tone]}
            size="sm"
            icon={MISMATCH_ICON[tone]}
            title={MISMATCH_LABEL[tone]}
            uppercase
        >
            {MISMATCH_LABEL[tone]}
        </Badge>
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
                const truckTitle = isAssigned
                    ? `#${truck} · matches assigned mixer`
                    : assignedTruck
                      ? `#${truck} · assigned mixer is #${assignedTruck}`
                      : `#${truck} · operator has no assigned mixer`
                return (
                    <Badge
                        key={truck}
                        tone={isAssigned ? 'success' : 'neutral'}
                        size="md"
                        weight="semibold"
                        uppercase={false}
                        className="font-mono tabular-nums"
                        title={truckTitle}
                    >
                        #{truck}
                    </Badge>
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
            <Badge
                tone="neutral"
                size="md"
                weight="semibold"
                uppercase={false}
                icon="circle-question"
                className="italic"
                title="Operator record has no active mixer assignment and no plant set"
            >
                No assignment
            </Badge>
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
            <Badge tone="neutral" size="sm" shape="square" weight="bold" uppercase={false} className="tabular-nums">
                {fmtInt(count)}
            </Badge>
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
            <Badge
                as="button"
                tone="neutral"
                size="sm"
                uppercase={false}
                icon="comment"
                title="Operator comments"
                onClick={(e) => {
                    e.stopPropagation()
                    onComments?.(operator)
                }}
                className="active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            >
                Comments
            </Badge>
            <Badge
                as="button"
                tone="neutral"
                size="sm"
                uppercase={false}
                icon="history"
                title="Operator history"
                onClick={(e) => {
                    e.stopPropagation()
                    onHistory?.(operator)
                }}
                className="active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            >
                History
            </Badge>
        </div>
    )
}
