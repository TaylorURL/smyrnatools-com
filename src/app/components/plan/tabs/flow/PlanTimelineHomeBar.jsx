/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { MAX_YPH, TARGET_YPH, timeToMinutes, timeToPercent } from '../../../../../utils/PlanUtility'
import { PlanTimelineLaneBlock } from './PlanTimelineLaneBlock'

const { HOME_COLOR, RECV_COLOR, ROW_HEIGHT } = PlanTimelineLaneBlock

const HOME_BAR_TOP = 2
const HOME_BAR_HEIGHT = ROW_HEIGHT - 4

function deriveHomeBarMetrics({ effectiveOps, prod }) {
    const startPct = timeToPercent(prod?.firstJobTime)
    const endPct = timeToPercent(prod?.lastJobTime)
    const hasProd = startPct != null && endPct != null && endPct > startPct
    const firstMins = hasProd ? timeToMinutes(prod.firstJobTime) : null
    const lastMins = hasProd ? timeToMinutes(prod.lastJobTime) : null
    const hours = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yards = hasProd ? parseFloat(prod.totalYardage) || 0 : 0
    const ydsPerHrOp =
        hours && yards && effectiveOps > 0 ? Math.round((yards / (hours * effectiveOps)) * 10) / 10 : null
    const minNeeded = hours && yards ? Math.ceil(yards / (hours * TARGET_YPH)) : null
    const availableToSend = minNeeded !== null ? Math.max(0, effectiveOps - minNeeded) : null
    const overMax = ydsPerHrOp !== null && ydsPerHrOp > MAX_YPH
    const underTarget = ydsPerHrOp !== null && ydsPerHrOp < TARGET_YPH && availableToSend > 0
    return {
        availableToSend,
        endPct,
        hasProd,
        leaveOffCount: underTarget ? availableToSend : 0,
        overMax,
        startPct,
        underTarget,
        yards,
        ydsPerHrOp
    }
}

/**
 * Consolidated production / home-operator bar shown on the first row of a
 * timeline plant cell. Surfaces yardage, yph, and capacity warnings inside a
 * single pill so dispatchers can spot under/over-staffed days at a glance.
 */
export function PlanTimelineHomeBar({ homeCount, prod, recvLanesCount }) {
    if (homeCount <= 0) return null
    const effectiveOps = homeCount + recvLanesCount
    const metrics = deriveHomeBarMetrics({ effectiveOps, prod })

    return (
        <>
            {metrics.hasProd && (
                <div
                    className="absolute pointer-events-none"
                    style={{
                        background: `${HOME_COLOR}08`,
                        borderLeft: `2px solid ${HOME_COLOR}25`,
                        borderRight: `2px solid ${HOME_COLOR}25`,
                        bottom: 0,
                        left: `${metrics.startPct}%`,
                        top: 0,
                        width: `${metrics.endPct - metrics.startPct}%`
                    }}
                />
            )}
            <div
                className="absolute flex items-center overflow-visible pointer-events-none rounded-[5px]"
                style={{
                    background: `${HOME_COLOR}20`,
                    borderLeft: `3px solid ${HOME_COLOR}`,
                    boxShadow: `inset 0 0 0 1px ${HOME_COLOR}25`,
                    height: HOME_BAR_HEIGHT,
                    left: metrics.hasProd ? `${metrics.startPct}%` : '1%',
                    top: HOME_BAR_TOP,
                    width: metrics.hasProd ? `${metrics.endPct - metrics.startPct}%` : '98%'
                }}
            >
                <div className="flex items-center gap-2 px-2 whitespace-nowrap">
                    <OperatorCountBadge effectiveOps={effectiveOps} recvLanesCount={recvLanesCount} />
                    {metrics.hasProd && (
                        <span className="text-[9px] font-semibold" style={{ color: `${HOME_COLOR}CC` }}>
                            {prod.firstJobTime}–{prod.lastJobTime}
                        </span>
                    )}
                    {metrics.yards > 0 && (
                        <span
                            className="text-[9px] font-bold rounded-full px-1.5 py-px"
                            style={{ background: `${HOME_COLOR}15`, color: HOME_COLOR }}
                        >
                            {prod.totalYardage} yds
                        </span>
                    )}
                    {metrics.ydsPerHrOp !== null && <YphBadge metrics={metrics} />}
                    {metrics.availableToSend !== null && metrics.availableToSend > 0 && (
                        <span className="text-[9px] font-bold rounded-full px-1.5 py-px bg-[#16a34a18] text-green-600">
                            <i className="fas fa-paper-plane text-[7px] mr-0.5" />
                            {metrics.availableToSend} avail
                        </span>
                    )}
                    {metrics.overMax && <BehindScheduleBadge />}
                    {metrics.underTarget && <LeaveOffBadge count={metrics.leaveOffCount} />}
                </div>
            </div>
        </>
    )
}

function OperatorCountBadge({ effectiveOps, recvLanesCount }) {
    return (
        <span className="text-[9px] font-extrabold flex items-center gap-1" style={{ color: HOME_COLOR }}>
            <i className="fas fa-hard-hat text-[8px]" />
            {effectiveOps}
            {recvLanesCount > 0 && (
                <span className="font-semibold" style={{ color: RECV_COLOR }}>
                    (+{recvLanesCount})
                </span>
            )}
        </span>
    )
}

function YphBadge({ metrics }) {
    const { overMax, underTarget, ydsPerHrOp } = metrics
    const color = overMax ? '#fff' : underTarget ? '#d97706' : HOME_COLOR
    const background = overMax ? '#ef444490' : underTarget ? '#d9770620' : `${HOME_COLOR}15`
    return (
        <span className="text-[9px] font-bold rounded-full px-1.5 py-px" style={{ background, color }}>
            {ydsPerHrOp} yph
        </span>
    )
}

function BehindScheduleBadge() {
    return (
        <span className="text-[9px] font-extrabold flex items-center gap-0.5 text-red-500">
            <i className="fas fa-triangle-exclamation text-[8px]" />
            Likely behind
        </span>
    )
}

function LeaveOffBadge({ count }) {
    return (
        <span className="text-[9px] font-bold rounded-full px-1.5 py-px flex items-center gap-0.5 bg-[#d9770618] text-amber-600">
            <i className="fas fa-user-minus text-[7px]" />
            Leave {count} off
        </span>
    )
}
