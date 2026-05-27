/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { MAX_YPH, TARGET_YPH, timeToMinutes, timeToPercent } from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'
import { PlanTimelineLaneBlock } from './PlanTimelineLaneBlock'

const { HOME_COLOR, ROW_HEIGHT } = PlanTimelineLaneBlock

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
                        <span className="text-[9px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            {prod.firstJobTime}–{prod.lastJobTime}
                        </span>
                    )}
                    {metrics.yards > 0 && (
                        <Badge
                            variant="custom"
                            size="xs"
                            shape="pill"
                            weight="bold"
                            uppercase={false}
                            bg={`${HOME_COLOR}15`}
                            fg="var(--text-primary)"
                        >
                            {prod.totalYardage} yds
                        </Badge>
                    )}
                    {metrics.ydsPerHrOp !== null && <YphBadge metrics={metrics} />}
                    {metrics.availableToSend !== null && metrics.availableToSend > 0 && (
                        <Badge tone="success" size="xs" shape="pill" weight="bold" uppercase={false} icon="paper-plane">
                            {metrics.availableToSend} avail
                        </Badge>
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
        <Badge
            variant="custom"
            size="xs"
            shape="pill"
            weight="bold"
            uppercase={false}
            icon="hard-hat"
            bg={`${HOME_COLOR}25`}
            fg="var(--text-primary)"
        >
            {effectiveOps}
            {recvLanesCount > 0 && (
                <span className="font-semibold ml-0.5" style={{ color: 'var(--text-secondary)' }}>
                    (+{recvLanesCount})
                </span>
            )}
        </Badge>
    )
}

function YphBadge({ metrics }) {
    const { overMax, underTarget, ydsPerHrOp } = metrics
    if (overMax) {
        return (
            <Badge tone="danger" size="xs" shape="pill" weight="bold" uppercase={false}>
                {ydsPerHrOp} yph
            </Badge>
        )
    }
    if (underTarget) {
        return (
            <Badge tone="warning" size="xs" shape="pill" weight="bold" uppercase={false}>
                {ydsPerHrOp} yph
            </Badge>
        )
    }
    return (
        <Badge
            variant="custom"
            size="xs"
            shape="pill"
            weight="bold"
            uppercase={false}
            bg={`${HOME_COLOR}15`}
            fg="var(--text-primary)"
        >
            {ydsPerHrOp} yph
        </Badge>
    )
}

function BehindScheduleBadge() {
    return (
        <Badge tone="danger" size="xs" shape="pill" weight="bold" uppercase={false} icon="triangle-exclamation">
            Likely behind
        </Badge>
    )
}

function LeaveOffBadge({ count }) {
    return (
        <Badge tone="warning" size="xs" shape="pill" weight="bold" uppercase={false} icon="user-minus">
            Leave {count} off
        </Badge>
    )
}
