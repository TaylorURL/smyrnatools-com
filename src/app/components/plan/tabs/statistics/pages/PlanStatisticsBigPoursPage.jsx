/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtRange } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { BIG_POUR_SPACING_THRESHOLD_MIN, BIG_POUR_YARDAGE_THRESHOLD } from '../../../../../../utils/PlanUtility'
import { Panel } from '../../../../ui/Panel'
import { BigPoursTable } from '../PlanStatisticsTables'
import { EmptySection, isEmptyAfterLoad, RefreshingHint } from './planStatsShared'

/* ──────────────────────────────────────────────────────────────────────────
 * Big pours sub-page — full coordination list.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsBigPoursPage({
    accentColor,
    currentDays,
    currentSummary,
    loading,
    plantNameByCode,
    range
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return <div className="rounded animate-pulse bg-bg-secondary border border-border-light h-[320px]" />
    }
    if (isEmpty) {
        return (
            <Panel title="Big pours" innerClassName="p-0">
                <EmptySection
                    icon="fa-truck-monster"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <Panel
            title="Big pours to coordinate"
            innerClassName="p-0"
            right={
                loading ? (
                    <RefreshingHint when />
                ) : (
                    <span className="text-[11px] text-text-tertiary">
                        {currentSummary.bigPours.length} · &gt;{BIG_POUR_YARDAGE_THRESHOLD} yd³ · &lt;
                        {BIG_POUR_SPACING_THRESHOLD_MIN}m spacing
                    </span>
                )
            }
        >
            {currentSummary.bigPours.length === 0 ? (
                <EmptySection
                    icon="fa-circle-check"
                    loading={loading}
                    message={
                        loading
                            ? 'Looking for big pours…'
                            : 'No big pours in this window — every order is within normal coordination range.'
                    }
                />
            ) : (
                <BigPoursTable accent={accentColor} plantNameByCode={plantNameByCode} pours={currentSummary.bigPours} />
            )}
        </Panel>
    )
}
