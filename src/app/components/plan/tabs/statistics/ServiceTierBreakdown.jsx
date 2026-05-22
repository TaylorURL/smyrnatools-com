/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { SERVICE_TIER_META } from '../../../../../utils/PlanUtility'

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
            className={`inline-flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'}`}
            style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
        >
            {visible.map((tier) => {
                const count = tierCounts[tier] || 0
                const meta = SERVICE_TIER_META[tier]
                const muted = count === 0
                const padX = compact ? 'px-1.5' : 'px-2'
                const padY = compact ? 'py-0' : 'py-0.5'
                const fontSize = compact ? 'text-[10px]' : 'text-[10.5px]'
                return (
                    <span
                        key={tier}
                        className={`inline-flex items-center gap-1 rounded-full ${padX} ${padY} ${fontSize} font-semibold tabular-nums`}
                        style={{
                            background: muted ? 'var(--bg-tertiary)' : `${meta.color}1f`,
                            color: muted ? 'var(--text-tertiary)' : meta.color
                        }}
                        title={`${meta.label} (${TIER_THRESHOLDS[tier]}) — ${count} order${count === 1 ? '' : 's'}`}
                    >
                        <span>{fmtInt(count)}</span>
                        <span className="font-medium">{meta.label}</span>
                    </span>
                )
            })}
        </div>
    )
}
