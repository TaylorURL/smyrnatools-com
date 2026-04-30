import React from 'react'

import { NODE_RADIUS_MIN, yphColorFor } from '../../../utils/PlanFlowLayoutUtility'
import { getMissingOperators, minutesToTime } from '../../../utils/PlanUtility'

const NEEDS_HELP_COLOR = '#dc2626'
const LEAVE_OFF_COLOR = '#d97706'
const POSITIVE_COLOR = '#16a34a'
const PICKING_COLOR = '#f59e0b'
const POOL_ZERO_COLOR = '#d97706'
const POOL_NEGATIVE_COLOR = NEEDS_HELP_COLOR
const POOL_POSITIVE_COLOR = POSITIVE_COLOR

/**
 * One plant node on the flow canvas. Encapsulates all of the per-node
 * derivations (role tag, needs-help / leave-off badges, point-in-time vs
 * whole-day stats), the dynamic shadow ring, and the central code label.
 */
export function PlanFlowNode({
    accentColor,
    activeOrdersAtTime,
    draft,
    effAtViewTime,
    leaveOffByCode,
    maxYph,
    minPoolByCode,
    onClick,
    pickingDestination,
    plantProduction,
    poolAtViewTime,
    position,
    radius,
    selectedCode,
    stat,
    targetYph,
    viewTime,
    yphByCode
}) {
    const { eff, recv = 0, send = 0, base = 0 } = stat
    const isSelected = selectedCode === stat.code
    const net = recv - send
    const role =
        send > 0 && recv === 0
            ? 'sender'
            : recv > 0 && send === 0
              ? 'receiver'
              : net > 0
                ? 'receiver'
                : net < 0
                  ? 'sender'
                  : null

    const yph = yphByCode[stat.code]
    const ringColor = yphColorFor(yph, accentColor)
    const minPool = minPoolByCode[stat.code]
    const missingAtPlant = getMissingOperators(plantProduction, stat.code)
    const effWithMissing = Math.max(0, (eff ?? 0) - missingAtPlant)

    // When the scrubber is set to a specific time, "needs help" is point-in-time:
    // pool(t) < 0 AND a job is actively pouring at t. Idle plants never flag.
    // Whole-day view falls back to the day-aggregate peak-overbook signal +
    // YPH > MAX heuristic.
    const isTimeView = Number.isFinite(viewTime)
    const poolNow = isTimeView ? poolAtViewTime?.[stat.code] : null
    const activeNow = isTimeView ? activeOrdersAtTime?.[stat.code]?.length || 0 : 0
    const timeDeficit = isTimeView && Number.isFinite(poolNow) && poolNow < 0 && activeNow > 0 ? -poolNow : 0
    const peakOverbookShortage = isTimeView ? timeDeficit : Number.isFinite(minPool) && minPool < 0 ? -minPool : 0
    const needsHelp = isTimeView ? timeDeficit > 0 : (yph != null && yph > maxYph) || peakOverbookShortage > 0
    const leaveOffInfo =
        !needsHelp && !isTimeView
            ? leaveOffByCode[stat.code] || { adjustedYph: null, count: 0 }
            : { adjustedYph: null, count: 0 }
    const leaveOff = leaveOffInfo.count
    const adjustedYph = leaveOffInfo.adjustedYph
    const hasLeaveOff = leaveOff > 0

    const r = radius || NODE_RADIUS_MIN
    const codeFontSize = Math.round(Math.max(18, Math.min(34, r * 0.38)))
    const isDestinationCandidate = pickingDestination && draft && stat.code !== draft.fromPlant

    const boxShadow = isSelected
        ? `0 0 0 3px ${accentColor}, var(--shadow)`
        : isDestinationCandidate
          ? `0 0 0 3px ${PICKING_COLOR}, var(--shadow)`
          : needsHelp
            ? `0 0 0 2px ${NEEDS_HELP_COLOR}44, var(--shadow)`
            : hasLeaveOff
              ? `0 0 0 2px ${LEAVE_OFF_COLOR}44, var(--shadow)`
              : 'var(--shadow)'

    const buildTitle = () => {
        const missingSuffix = missingAtPlant > 0 ? ` · ${missingAtPlant} out` : ''
        const baseLabel = `Plant ${stat.code} · ${effWithMissing} op${effWithMissing === 1 ? '' : 's'}${missingSuffix}`
        if (isTimeView) {
            const t = minutesToTime(viewTime)
            if (activeNow === 0) return `${baseLabel} · Idle at ${t} — no help needed`
            if (needsHelp) {
                return `${baseLabel} · NEEDS HELP at ${t} — short ${timeDeficit} truck${timeDeficit === 1 ? '' : 's'} (${activeNow} active order${activeNow === 1 ? '' : 's'})`
            }
            return `${baseLabel} · Covered at ${t} — pool ${Number.isFinite(poolNow) ? poolNow : '—'}, ${activeNow} active`
        }
        if (needsHelp) {
            const parts = []
            if (yph != null && yph > maxYph) parts.push(`YPH ${yph} > ${maxYph}`)
            if (peakOverbookShortage > 0) {
                parts.push(
                    `peak demand overbooks by ${peakOverbookShortage} truck${peakOverbookShortage === 1 ? '' : 's'}`
                )
            }
            return `${baseLabel} · NEEDS HELP (${parts.join(' · ')})`
        }
        if (hasLeaveOff) {
            return `${baseLabel} · low YPH ${yph ?? ''} — leave off ${leaveOff} driver${leaveOff === 1 ? '' : 's'}${adjustedYph != null ? ` → adjusted YPH ${adjustedYph.toFixed(1)}` : ''}`
        }
        return baseLabel
    }

    const renderTimeViewStats = () => {
        const effNow = effAtViewTime?.[stat.code]
        const effDisplay = Number.isFinite(effNow) ? effNow : base
        const effDelta = Number.isFinite(effNow) ? effNow - (base ?? 0) : 0
        const poolValue = poolAtViewTime?.[stat.code]
        const poolColor = poolValue < 0 ? POOL_NEGATIVE_COLOR : poolValue === 0 ? POOL_ZERO_COLOR : POOL_POSITIVE_COLOR
        return (
            <>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {effDisplay} op{effDisplay === 1 ? '' : 's'}
                    {effDelta !== 0 && (
                        <>
                            {' '}
                            <span
                                style={{
                                    color: effDelta > 0 ? POSITIVE_COLOR : NEEDS_HELP_COLOR,
                                    fontWeight: 700
                                }}
                            >
                                ({effDelta > 0 ? '+' : ''}
                                {effDelta})
                            </span>
                        </>
                    )}
                </span>
                {Number.isFinite(poolValue) && (
                    <span
                        className="text-[10px] font-bold"
                        style={{ color: poolColor, fontFamily: 'var(--font-heading)' }}
                        title={`${poolValue} truck${poolValue === 1 ? '' : 's'} at plant, ready to dispatch at ${minutesToTime(viewTime)}`}
                    >
                        avail {poolValue}
                    </span>
                )}
            </>
        )
    }

    const renderWholeDayStats = () => (
        <>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {effWithMissing} op{effWithMissing === 1 ? '' : 's'}
                {net !== 0 && (
                    <>
                        {' '}
                        <span style={{ color: net > 0 ? POSITIVE_COLOR : NEEDS_HELP_COLOR, fontWeight: 700 }}>
                            ({net > 0 ? '+' : ''}
                            {net})
                        </span>
                    </>
                )}
                {missingAtPlant > 0 && (
                    <>
                        {' '}
                        <span
                            style={{ color: NEEDS_HELP_COLOR, fontWeight: 700 }}
                            title={`${missingAtPlant} operator${missingAtPlant === 1 ? '' : 's'} marked missing`}
                        >
                            −{missingAtPlant} out
                        </span>
                    </>
                )}
            </span>
            {yph != null && (
                <span className="text-[10px] font-bold" style={{ color: ringColor, fontFamily: 'var(--font-heading)' }}>
                    {yph} yph
                </span>
            )}
        </>
    )

    return (
        <button
            onClick={() => onClick(stat.code)}
            className="absolute cursor-pointer border-none rounded-full p-0"
            style={{
                background: isSelected ? `${accentColor}14` : 'var(--bg-primary)',
                boxShadow,
                height: r * 2,
                left: `${position.x - r}px`,
                top: `${position.y - r}px`,
                transition: 'box-shadow 0.2s, background 0.2s',
                width: r * 2,
                zIndex: 10
            }}
            title={buildTitle()}
        >
            <span
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                    border: `3px solid ${ringColor}`,
                    opacity: yph != null ? 0.8 : 0.35
                }}
            />
            {role && (
                <span
                    className="absolute px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white"
                    style={{
                        background: role === 'sender' ? NEEDS_HELP_COLOR : POSITIVE_COLOR,
                        left: '50%',
                        top: -8,
                        transform: 'translateX(-50%)'
                    }}
                >
                    {role}
                </span>
            )}
            {needsHelp && (
                <span
                    className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap animate-pulse"
                    style={{
                        background: NEEDS_HELP_COLOR,
                        bottom: -9,
                        boxShadow: `0 0 0 2px var(--bg-secondary), 0 2px 6px ${NEEDS_HELP_COLOR}55`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2
                    }}
                    title={
                        isTimeView
                            ? `At ${minutesToTime(viewTime)} — short ${timeDeficit} truck${timeDeficit === 1 ? '' : 's'} (${activeNow} order${activeNow === 1 ? '' : 's'} actively pouring)`
                            : peakOverbookShortage > 0
                              ? `Peak demand overbooks this plant by ${peakOverbookShortage} truck${peakOverbookShortage === 1 ? '' : 's'} — big-pour requirements exceed current pool${yph != null && yph > maxYph ? ` (YPH ${yph} > ${maxYph})` : ''}`
                              : `YPH ${yph} exceeds max (${maxYph}) — operators overloaded`
                    }
                >
                    <i className="fas fa-triangle-exclamation text-[8px]" />
                    Needs Help
                </span>
            )}
            {hasLeaveOff && (
                <span
                    className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                    style={{
                        background: LEAVE_OFF_COLOR,
                        bottom: -9,
                        boxShadow: `0 0 0 2px var(--bg-secondary), 0 2px 6px ${LEAVE_OFF_COLOR}55`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2
                    }}
                    title={`YPH ${yph} below target ${targetYph} — leave off ${leaveOff} driver${leaveOff === 1 ? '' : 's'}${adjustedYph != null ? ` to bring YPH to ${adjustedYph.toFixed(1)}` : ''}`}
                >
                    <i className="fas fa-user-minus text-[8px]" />
                    Leave off {leaveOff}
                    {adjustedYph != null && (
                        <span className="opacity-90 normal-case font-semibold">→ {adjustedYph.toFixed(1)} yph</span>
                    )}
                </span>
            )}
            <div className="flex flex-col items-center justify-center h-full gap-0.5">
                <span
                    className="font-bold"
                    style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-heading)',
                        fontSize: codeFontSize,
                        lineHeight: 1
                    }}
                >
                    {stat.code}
                </span>
                {isTimeView ? renderTimeViewStats() : renderWholeDayStats()}
            </div>
        </button>
    )
}
