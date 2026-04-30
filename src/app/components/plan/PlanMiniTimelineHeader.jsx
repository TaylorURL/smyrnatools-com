import React from 'react'

import { TIMELINE_HOURS, TIMELINE_START_HOUR } from '../../../utils/PlanUtility'

const HEADER_HEIGHT = 34
const LABEL_WIDTH = 120
const SHIFT_START_HOUR = 4
const SHIFT_END_HOUR = 18

const NOW_TIME_OPTIONS = { hour: 'numeric', hour12: true, minute: '2-digit' }

const isWorkHour = (hour) => hour >= SHIFT_START_HOUR && hour <= SHIFT_END_HOUR
const isMajorHour = (hour) => hour % 2 === 0

/**
 * Hour-axis header for the mini timeline. Renders the column-aligned tick
 * marks, the shift-window highlight (4 AM – 6 PM), and the live "NOW"
 * indicator when the current clock time falls inside the visible range.
 */
export function PlanMiniTimelineHeader({ hourLabels, now, nowPct }) {
    return (
        <div className="relative flex" style={{ height: HEADER_HEIGHT }}>
            <div
                className="shrink-0 flex items-center px-3 text-[10px] font-bold uppercase tracking-wider border-b border-r"
                style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-light)',
                    color: 'var(--text-secondary)',
                    width: LABEL_WIDTH
                }}
            >
                Plant
            </div>
            <div
                className="flex-1 relative border-b"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
            >
                <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                        background: 'var(--bg-secondary)',
                        left: `${((SHIFT_START_HOUR - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100}%`,
                        width: `${((SHIFT_END_HOUR - SHIFT_START_HOUR) / TIMELINE_HOURS) * 100}%`
                    }}
                />
                {hourLabels.map((label, idx) => {
                    const hour = TIMELINE_START_HOUR + idx
                    const major = isMajorHour(hour)
                    const work = isWorkHour(hour)
                    return (
                        <div
                            key={idx}
                            className="absolute top-0 bottom-0 flex items-end pb-1"
                            style={{ left: `${(idx / TIMELINE_HOURS) * 100}%` }}
                        >
                            <div
                                className="absolute top-0 bottom-0"
                                style={{
                                    background: 'var(--border-light)',
                                    opacity: major ? 1 : work ? 0.5 : 0.25,
                                    width: 1
                                }}
                            />
                            {major && (
                                <span
                                    className="pl-1 text-[10px] font-semibold"
                                    style={{ color: work ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                                >
                                    {label}
                                </span>
                            )}
                        </div>
                    )
                })}
                {nowPct != null && <NowMarker now={now} nowPct={nowPct} />}
            </div>
        </div>
    )
}

function NowMarker({ now, nowPct }) {
    return (
        <div
            className="absolute top-0 bottom-0"
            style={{
                background: '#dc2626',
                boxShadow: '0 0 0 1px rgba(220,38,38,0.25)',
                left: `${nowPct}%`,
                width: 2
            }}
        >
            <div
                className="absolute -top-0.5 -translate-x-1/2 px-1.5 rounded-sm text-[9px] font-bold text-white whitespace-nowrap"
                style={{ background: '#dc2626' }}
            >
                NOW {now.toLocaleTimeString('en-US', NOW_TIME_OPTIONS)}
            </div>
        </div>
    )
}

PlanMiniTimelineHeader.HEADER_HEIGHT = HEADER_HEIGHT
PlanMiniTimelineHeader.LABEL_WIDTH = LABEL_WIDTH
