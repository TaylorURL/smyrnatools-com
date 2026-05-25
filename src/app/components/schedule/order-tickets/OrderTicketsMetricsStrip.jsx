import React from 'react'

import { parseDurationMinutes } from '../../../../utils/PlanUtility'
import MetricTile from './MetricTile'
import { formatDuration, formatYph } from './orderTicketHelpers'

/**
 * Pace comparison: actual achieved yd/hr against the customer's scheduled
 * rate. Color the actual value by how it lines up — green at or above target,
 * amber when it slips, red below 70% (the same cutoff
 * `computeCustomerSatisfaction` uses to flag "slow service").
 */
function OrderTicketsMetricsStrip({ order, realized }) {
    // Literal class names so Tailwind JIT picks them up. Dynamic
    // `sm:grid-cols-${n}` templates wouldn't.
    const gridCols = realized.hasKicker ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
    const paceRatio =
        realized.yph != null && realized.targetYph && realized.targetYph > 0 ? realized.yph / realized.targetYph : null
    const paceHint = (() => {
        if (realized.yph == null) return 'no original yardage to pace'
        const span = formatDuration(realized.effectiveSpan)
        const planned = realized.plannedSpan > 0 && realized.plannedSpan >= realized.actualSpan
        const spanLabel = planned ? `over planned ${span}` : `over actual ${span}`
        const ratioLabel = paceRatio != null ? ` · ${Math.round(paceRatio * 100)}% of target` : ''
        const kickerLabel = realized.hasKicker ? ' · excludes kicker' : ''
        return `${spanLabel}${ratioLabel}${kickerLabel}`
    })()

    return (
        <div className={`px-5 py-3 grid grid-cols-1 ${gridCols} gap-3 border-b bg-bg-secondary border-border-light`}>
            <MetricTile label="First truck loaded" value={realized.firstTime} />
            <MetricTile
                hint={realized.ticketCount > 1 ? `${realized.ticketCount} loads total` : 'only one load so far'}
                label="Last truck loaded"
                value={realized.lastTime}
            />
            <MetricTile
                hint={
                    realized.targetYph
                        ? `${order?.loadSize || '—'} yd / truck × ${parseDurationMinutes(order?.rate) || 5} min`
                        : 'truck size or rate missing'
                }
                label="Target pace"
                value={formatYph(realized.targetYph)}
            />
            <MetricTile
                hint={paceHint}
                label={realized.hasKicker ? 'Actual pace (original)' : 'Actual pace'}
                value={formatYph(realized.yph)}
            />
            {realized.hasKicker && (
                <MetricTile
                    hint={`${
                        Number.isInteger(realized.originalYardage)
                            ? realized.originalYardage
                            : realized.originalYardage.toFixed(1)
                    } yd original + ${
                        Number.isInteger(realized.kickerYardage)
                            ? realized.kickerYardage
                            : realized.kickerYardage.toFixed(1)
                    } yd kicker`}
                    label="Kicker added"
                    value={`+${
                        Number.isInteger(realized.kickerYardage)
                            ? realized.kickerYardage
                            : realized.kickerYardage.toFixed(1)
                    } yd`}
                />
            )}
        </div>
    )
}

export default OrderTicketsMetricsStrip
