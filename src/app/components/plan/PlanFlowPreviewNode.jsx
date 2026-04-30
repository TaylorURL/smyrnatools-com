import React from 'react'

import { yphColorFor } from '../../../utils/PlanFlowLayoutUtility'
import { MAX_YPH } from '../../../utils/PlanUtility'

const NEEDS_HELP_COLOR = '#dc2626'
const LEAVE_OFF_COLOR = '#d97706'

const SENDER_BG = '#dc2626'
const RECEIVER_BG = '#16a34a'

/**
 * Single plant node rendered inside the Plan flow preview cluster. Mirrors the
 * full `PlanFlowView` node visuals (ring colour for yph, sender/receiver pill,
 * Needs Help / Leave Off badges) at preview-card scale.
 */
export function PlanFlowPreviewNode({ accentColor, leaveOff, minPool, position, radius, stat, yph }) {
    const role = roleFor(stat)
    const ringColor = yphColorFor(yph, accentColor)
    const codeFontSize = Math.round(Math.max(18, Math.min(34, radius * 0.38)))
    const peakOverbookShortage = Number.isFinite(minPool) && minPool < 0 ? -minPool : 0
    const needsHelp = (yph != null && yph > MAX_YPH) || peakOverbookShortage > 0
    const hasLeaveOff = !needsHelp && leaveOff > 0
    const nodeShadow = needsHelp
        ? `0 0 0 2px ${NEEDS_HELP_COLOR}44, var(--shadow)`
        : hasLeaveOff
          ? `0 0 0 2px ${LEAVE_OFF_COLOR}44, var(--shadow)`
          : 'var(--shadow)'
    const net = stat.recv - stat.send

    return (
        <div
            className="absolute rounded-full flex flex-col items-center justify-center"
            style={{
                background: 'var(--bg-primary)',
                boxShadow: nodeShadow,
                height: radius * 2,
                left: position.x - radius,
                top: position.y - radius,
                width: radius * 2,
                zIndex: 5
            }}
        >
            <span
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                    border: `3px solid ${ringColor}`,
                    opacity: yph != null ? 0.8 : 0.35
                }}
            />
            {role && <RoleBadge role={role} />}
            {needsHelp && <NeedsHelpBadge />}
            {hasLeaveOff && <LeaveOffBadge count={leaveOff} />}
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
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {stat.eff} op{stat.eff === 1 ? '' : 's'}
                {net !== 0 && (
                    <>
                        {' '}
                        <span style={{ color: net > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            ({net > 0 ? '+' : ''}
                            {net})
                        </span>
                    </>
                )}
            </span>
            {yph != null && (
                <span className="text-[9px] font-bold" style={{ color: ringColor, fontFamily: 'var(--font-heading)' }}>
                    {yph} yph
                </span>
            )}
        </div>
    )
}

function roleFor(stat) {
    const { send = 0, recv = 0 } = stat
    if (send > 0 && recv === 0) return 'sender'
    if (recv > 0 && send === 0) return 'receiver'
    const net = recv - send
    if (net > 0) return 'receiver'
    if (net < 0) return 'sender'
    return null
}

function RoleBadge({ role }) {
    return (
        <span
            className="absolute px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider text-white"
            style={{
                background: role === 'sender' ? SENDER_BG : RECEIVER_BG,
                left: '50%',
                top: -8,
                transform: 'translateX(-50%)'
            }}
        >
            {role}
        </span>
    )
}

function NeedsHelpBadge() {
    return (
        <span
            className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider text-white whitespace-nowrap animate-pulse"
            style={{
                background: NEEDS_HELP_COLOR,
                bottom: -8,
                boxShadow: `0 0 0 2px var(--bg-secondary), 0 2px 6px ${NEEDS_HELP_COLOR}55`,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 2
            }}
        >
            <i className="fas fa-triangle-exclamation text-[7px]" />
            Needs Help
        </span>
    )
}

function LeaveOffBadge({ count }) {
    return (
        <span
            className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
            style={{
                background: LEAVE_OFF_COLOR,
                bottom: -8,
                boxShadow: `0 0 0 2px var(--bg-secondary), 0 2px 6px ${LEAVE_OFF_COLOR}55`,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 2
            }}
        >
            <i className="fas fa-user-minus text-[7px]" />
            Leave off {count}
        </span>
    )
}
