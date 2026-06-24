import React from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { SERVICE_TIER_META } from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'

/* The three "bad" tiers, in worsening order. `good` is intentionally
 * omitted because this component renders the breakdown of the BAD
 * portion only — callers already show good counts in the surrounding
 * UI. */
const BAD_TIERS = ['notGood', 'bad', 'veryBad']

/* Lateness thresholds used by `classifyServiceTier` — surfaced here so
 * the tooltip on each pill can spell out which minute-band it covers
 * without the consumer having to re-import the constants. */
const TIER_THRESHOLDS = {
    bad: '≥ 30 min late',
    notGood: '≥ 15 min late (or slow-only)',
    veryBad: '> 60 min late'
}

/* Semantic tone mapping: amber-late tier maps to warning, the two
 * red tiers (bad / veryBad) collapse to danger since the Badge palette
 * has a single danger tone. Empty tiers fall through to neutral. */
const TIER_TO_TONE = {
    bad: 'danger',
    notGood: 'warning',
    veryBad: 'danger'
}

/** Inline pill row showing how many orders fell into each bad tier
 *  ("Not Good" / "Bad" / "Very Bad"). Empty tiers either render as
 *  muted zero pills (`showZero=true`) or get dropped entirely
 *  (`showZero=false`, the default). Each pill carries a hover tooltip
 *  with the lateness band so the dispatcher doesn't have to remember
 *  the cutoffs. */
export default function ServiceTierBreakdown({ tierCounts, showZero = false, compact = false, align = 'left' }) {
    if (!tierCounts) return null
    const visible = BAD_TIERS.filter((t) => (tierCounts[t] || 0) > 0 || showZero)
    if (visible.length === 0) {
        return <span className="text-text-tertiary text-[11px]">—</span>
    }
    return (
        <div
            className={`inline-flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'} ${
                align === 'right' ? 'justify-end' : 'justify-start'
            }`}
        >
            {visible.map((tier) => {
                const count = tierCounts[tier] || 0
                const meta = SERVICE_TIER_META[tier]
                const muted = count === 0
                return (
                    <Badge
                        key={tier}
                        tone={muted ? 'neutral' : TIER_TO_TONE[tier]}
                        size={compact ? 'sm' : 'md'}
                        shape="pill"
                        weight="semibold"
                        uppercase={false}
                        className="tabular-nums"
                        title={`${meta.label} (${TIER_THRESHOLDS[tier]}) — ${count} order${count === 1 ? '' : 's'}`}
                    >
                        <span>{fmtInt(count)}</span>
                        <span className="font-medium ml-1">{meta.label}</span>
                    </Badge>
                )
            })}
        </div>
    )
}
