/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { formatMinutesClock } from '../../../utils/PlanUtility'

const dur = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`)

/** Plain section heading — no card, no icon, just an underline. */
function Heading({ children }) {
    return (
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary pb-1 mb-2 border-b border-border-light">
            {children}
        </div>
    )
}

/** Coverage value row — number + label, no icon, no tinted background. */
function CoverageStat({ hint, label, value, valueColor }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border-light last:border-b-0">
            <span className="text-[12px] text-text-secondary">{label}</span>
            <span
                className="text-[13px] font-semibold font-mono tabular-nums shrink-0"
                style={{ color: valueColor || 'var(--text-primary)' }}
            >
                {value}
                {hint && <span className="ml-2 text-[10.5px] font-normal text-text-tertiary">{hint}</span>}
            </span>
        </div>
    )
}

/**
 * Plain coverage view for the modal — distinct from the icon-heavy hover
 * side-panel (`TruckCoveragePanelBody`). Renders the same numbers as a
 * key/value list plus a one-line verdict, no badges, no decorative icons.
 */
export default function OrderCoverageView({ coverage }) {
    const {
        bigPour,
        computed,
        differsFromDispatch,
        dispatchTrucks,
        helpInWindow,
        kickerHeld = 0,
        overbooked,
        plantCode,
        poolAfter,
        poolAfterEffective,
        poolAtStart,
        poolSource,
        recommendedMoveTime,
        timing,
        yardage
    } = coverage
    const shortfall = Number.isFinite(poolAfterEffective) ? Math.max(0, -poolAfterEffective) : 0
    const overbookedColor = '#d97706'
    const okColor = '#16a34a'

    const verdictBody = overbooked
        ? `Plant ${plantCode} is short ${shortfall} truck${shortfall === 1 ? '' : 's'}${
              timing?.delayMin > 0 ? ` — pour runs ~${dur(timing.delayMin)} longer than scheduled.` : '.'
          }`
        : `Plant ${plantCode} has enough trucks to keep this pour on its scheduled rate.`

    const poolHint = poolSource
        ? [
              poolSource.missing > 0 ? `−${poolSource.missing} out` : null,
              poolSource.recv > 0 ? `+${poolSource.recv} in` : null,
              poolSource.send > 0 ? `−${poolSource.send} sent` : null
          ]
              .filter(Boolean)
              .join(' · ')
        : ''

    return (
        <div className="flex flex-col gap-5">
            <div className="text-[13px] leading-snug">
                <span className="font-semibold" style={{ color: overbooked ? overbookedColor : okColor }}>
                    {overbooked ? 'Short.' : 'On pace.'}
                </span>{' '}
                <span className="text-text-secondary">{verdictBody}</span>
            </div>

            <div>
                <Heading>Trucks</Heading>
                <CoverageStat
                    label="Needed"
                    value={Number.isFinite(computed) ? computed : '—'}
                    hint={bigPour ? `big pour ${yardage}+ yd` : null}
                />
                {Number.isFinite(dispatchTrucks) && dispatchTrucks > 0 && (
                    <CoverageStat
                        label="Dispatch booked"
                        value={dispatchTrucks}
                        valueColor={differsFromDispatch ? overbookedColor : null}
                    />
                )}
                {poolSource && (
                    <CoverageStat label={`Active at ${plantCode}`} value={poolSource.base} hint={poolHint || null} />
                )}
                {Number.isFinite(poolAtStart) && (
                    <CoverageStat
                        label="In rotation at start"
                        value={poolAtStart}
                        valueColor={overbooked ? overbookedColor : null}
                    />
                )}
                {Number.isFinite(poolAfter) && (
                    <CoverageStat
                        label="Remaining after dispatch"
                        value={poolAfter}
                        valueColor={poolAfter < 0 ? overbookedColor : null}
                    />
                )}
                {helpInWindow > 0 && (
                    <CoverageStat label="Help arriving mid-pour" value={`+${helpInWindow}`} valueColor={okColor} />
                )}
                {kickerHeld > 0 && (
                    <CoverageStat
                        label="Kicker reserve held"
                        value={`−${kickerHeld}`}
                        hint="absorb late yardage adds"
                    />
                )}
            </div>

            {overbooked && timing && (
                <div>
                    <Heading>Pace</Heading>
                    {Number.isFinite(timing.firstArrivalMin) && (
                        <CoverageStat
                            label="First truck on site"
                            value={formatMinutesClock(timing.firstArrivalMin)}
                            valueColor={timing.firstTruckIsLate ? overbookedColor : okColor}
                            hint={timing.firstTruckIsLate ? 'late' : 'on time'}
                        />
                    )}
                    {Number.isFinite(timing.scheduledRateYph) && Number.isFinite(timing.effectiveRateYph) && (
                        <CoverageStat
                            label="Pour rate"
                            value={`${timing.effectiveRateYph} yd/hr`}
                            valueColor={overbookedColor}
                            hint={`vs scheduled ${timing.scheduledRateYph}`}
                        />
                    )}
                    {Number.isFinite(timing.estimatedCompletionMin) && (
                        <CoverageStat
                            label="Finishes"
                            value={formatMinutesClock(timing.estimatedCompletionMin)}
                            valueColor={timing.delayMin > 0 ? overbookedColor : null}
                            hint={
                                Number.isFinite(timing.scheduledCompletionMin)
                                    ? `vs scheduled ${formatMinutesClock(timing.scheduledCompletionMin)}`
                                    : null
                            }
                        />
                    )}
                    {timing.delayMin > 0 && (
                        <CoverageStat
                            label="Delay"
                            value={`~${dur(timing.delayMin)}`}
                            valueColor={overbookedColor}
                            hint={
                                Number.isFinite(timing.actualTrucks) && Number.isFinite(timing.requiredTrucks)
                                    ? `${timing.actualTrucks}/${timing.requiredTrucks} trucks cycling`
                                    : null
                            }
                        />
                    )}
                </div>
            )}

            {(overbooked || differsFromDispatch) && (
                <div className="text-[12px] leading-snug text-text-secondary">
                    {overbooked && Number.isFinite(recommendedMoveTime) && (
                        <div>
                            Move start to{' '}
                            <span className="font-mono font-semibold text-text-primary">
                                {formatMinutesClock(recommendedMoveTime)}
                            </span>{' '}
                            for full rate, or send help from another plant.
                        </div>
                    )}
                    {overbooked && !Number.isFinite(recommendedMoveTime) && (
                        <div>
                            No time later today has the full truck count — {plantCode} needs inbound help to hold the
                            scheduled rate.
                        </div>
                    )}
                    {differsFromDispatch && !overbooked && Number.isFinite(dispatchTrucks) && (
                        <div className="mt-1">
                            Dispatch booked {dispatchTrucks}; our calc says {computed}. Trust the calc — dispatch counts
                            are often off.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/** Build the Flags list — `{ title, body }`. Ordered by urgency:
 *  overbooked > big-pour shortfall > closer plant > dispatch mismatch. */
export function buildOrderFlags({ closerPlant, coverage, order }) {
    const out = []
    if (coverage?.overbooked) {
        const { computed, plantCode, poolAfterEffective, recommendedMoveTime, timing } = coverage
        const shortfall = Number.isFinite(poolAfterEffective) ? -poolAfterEffective : null
        const lines = []
        if (Number.isFinite(shortfall) && shortfall > 0) {
            lines.push(`Plant ${plantCode} is short ${shortfall} truck${shortfall === 1 ? '' : 's'} for this pour.`)
        }
        if (timing?.scheduledRateYph != null && timing?.effectiveRateYph != null) {
            lines.push(
                `Pour rate drops from ${timing.scheduledRateYph} to ${timing.effectiveRateYph} yd/hr — same yardage, just slower.`
            )
        }
        if (Number.isFinite(recommendedMoveTime)) {
            lines.push(
                `Earliest viable start with ${computed} truck${computed === 1 ? '' : 's'}: ${formatMinutesClock(
                    recommendedMoveTime
                )}.`
            )
        }
        out.push({
            body: lines.join(' '),
            title: Number.isFinite(recommendedMoveTime)
                ? `Move start to ${formatMinutesClock(recommendedMoveTime)} or send help`
                : 'Send help from another plant'
        })
    }
    if (coverage?.bigPour && coverage?.computed != null && (parseFloat(order?.truckCount) || 0) < coverage.computed) {
        const need = coverage.computed - (parseFloat(order?.truckCount) || 0)
        out.push({
            body: `Big pour (${coverage.yardage}+ yd). Travel-based requirement is ${coverage.computed} trucks; dispatch booked ${parseFloat(order?.truckCount) || 0}.`,
            title: `Book ${need} more truck${need === 1 ? '' : 's'} for this pour`
        })
    }
    if (closerPlant && closerPlant.savings >= 5) {
        out.push({
            body: `Plant ${closerPlant.code} is ~${closerPlant.savings} min closer (${closerPlant.minutes} min vs ${closerPlant.assignedMinutes} min from ${order?.plantCode}). Reassigning shortens cycle time and frees trucks at ${order?.plantCode}.`,
            title: `Reassign to plant ${closerPlant.code}`
        })
    }
    if (coverage?.differsFromDispatch && !coverage?.overbooked) {
        const { computed, dispatchTrucks } = coverage
        const delta = computed - dispatchTrucks
        out.push({
            body: `Travel-based truck count is ${computed}; dispatch booked ${dispatchTrucks}. ${
                delta > 0
                    ? `Add ${delta} to keep the pour on its scheduled rate.`
                    : `Drop ${-delta} — dispatch is overbooked.`
            }`,
            title:
                delta > 0
                    ? `Add ${delta} truck${delta === 1 ? '' : 's'}`
                    : `Drop ${-delta} truck${-delta === 1 ? '' : 's'}`
        })
    }
    return out
}
