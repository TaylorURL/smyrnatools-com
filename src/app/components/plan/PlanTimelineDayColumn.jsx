import React from 'react'

import { DAY_WIDTH, TIMELINE_HOURS, TIMELINE_START_HOUR, timeToPercent } from '../../../utils/PlanUtility'
import { PlanTimelineHomeBar } from './PlanTimelineHomeBar'
import { PlanTimelineLaneBlock } from './PlanTimelineLaneBlock'

const { ROW_HEIGHT, RECV_COLOR } = PlanTimelineLaneBlock

const compareLanesByStart = (a, b) => (a.clockIn || a.arriveTime).localeCompare(b.clockIn || b.arriveTime)
const isWorkHour = (hour) => hour >= 4 && hour <= 18
const formatDayLabel = (dateStr) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })

/**
 * Single day column inside the multi-day timeline. Owns the sticky header
 * (date label + hour ticks) and one lane area per plant row, including the
 * cursor crosshair that responds to mouse drag.
 */
export function PlanTimelineDayColumn({
    accentColor,
    cursorDayIdx,
    cursorPct,
    day,
    dayIdx,
    dayRefs,
    handleMouseDown,
    hourLabels,
    minRestHours,
    mixerCountsByPlant,
    plantRows,
    restViolations
}) {
    const isCurrent = day.isCurrent
    return (
        <div
            key={day.date}
            className="shrink-0 border-r relative"
            ref={(el) => {
                dayRefs.current[dayIdx] = el
            }}
            style={{
                borderColor: isCurrent ? accentColor : 'var(--border-light)',
                borderLeftColor: isCurrent ? accentColor : undefined,
                borderLeftStyle: isCurrent ? 'solid' : 'none',
                borderLeftWidth: isCurrent ? 2 : 0,
                borderRightWidth: isCurrent ? 2 : 1,
                width: DAY_WIDTH
            }}
        >
            <DayHeader accentColor={accentColor} day={day} hourLabels={hourLabels} isCurrent={isCurrent} />
            {plantRows.map((plantRow, prIdx) => (
                <PlantLaneArea
                    key={plantRow.plant}
                    accentColor={accentColor}
                    cursorDayIdx={cursorDayIdx}
                    cursorPct={cursorPct}
                    day={day}
                    dayIdx={dayIdx}
                    handleMouseDown={handleMouseDown}
                    hourLabels={hourLabels}
                    isCurrent={isCurrent}
                    minRestHours={minRestHours}
                    mixerCountsByPlant={mixerCountsByPlant}
                    plantRow={plantRow}
                    prIdx={prIdx}
                    restViolations={restViolations}
                />
            ))}
        </div>
    )
}

function DayHeader({ accentColor, day, hourLabels, isCurrent }) {
    return (
        <div
            className="sticky top-0 z-20 border-b"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)', height: 32 }}
        >
            <div className="flex items-center h-full relative">
                <span
                    className="absolute left-2 text-[10px] font-bold z-10 rounded px-1"
                    style={{
                        background: isCurrent ? `${accentColor}15` : 'var(--bg-tertiary)',
                        color: isCurrent ? accentColor : 'var(--text-secondary)'
                    }}
                >
                    {formatDayLabel(day.date)}
                    {day.lanes.length > 0 && <span className="ml-1 font-normal opacity-70">({day.lanes.length})</span>}
                </span>
                {hourLabels.map((label, i) => {
                    const hour = TIMELINE_START_HOUR + i
                    const work = isWorkHour(hour)
                    return (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 flex items-end pb-0.5"
                            style={{ left: `${(i / TIMELINE_HOURS) * 100}%` }}
                        >
                            <div
                                className="absolute top-0 bottom-0 w-px"
                                style={{ background: 'var(--border-light)', opacity: work ? 1 : 0.4 }}
                            />
                            <span
                                className="text-[9px] pl-0.5"
                                style={{
                                    color: 'var(--text-secondary)',
                                    fontWeight: work ? 600 : 400,
                                    opacity: work ? 0.9 : 0.4
                                }}
                            >
                                {label}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function PlantLaneArea({
    accentColor,
    cursorDayIdx,
    cursorPct,
    day,
    dayIdx,
    handleMouseDown,
    hourLabels,
    isCurrent,
    minRestHours,
    mixerCountsByPlant,
    plantRow,
    prIdx,
    restViolations
}) {
    const sentLanes = day.lanes.filter((lane) => lane.fromPlant === plantRow.plant).sort(compareLanesByStart)
    const recvLanes = day.lanes.filter((lane) => lane.toPlant === plantRow.plant).sort(compareLanesByStart)
    const allLanes = [...sentLanes, ...recvLanes]
    const base = mixerCountsByPlant[plantRow.plant] || 0
    const homeCount = Math.max(0, base - sentLanes.length)
    const homeOffset = homeCount > 0 ? 1 : 0
    const background =
        prIdx % 2 === 0
            ? isCurrent
                ? `${accentColor}06`
                : 'transparent'
            : isCurrent
              ? `${accentColor}08`
              : 'var(--bg-secondary)'

    return (
        <div
            className="relative cursor-crosshair select-none"
            style={{
                background,
                borderBottom: '2px solid var(--border-light)',
                height: ROW_HEIGHT * plantRow.laneCount
            }}
            onMouseDown={(event) => handleMouseDown(event, dayIdx)}
        >
            {sentLanes.length > 0 && recvLanes.length > 0 && (
                <SentRecvSeparator offsetTop={(sentLanes.length + homeOffset) * ROW_HEIGHT - 1} />
            )}
            {hourLabels.map((_, j) => (
                <HourGridLine key={j} idx={j} />
            ))}
            <PlanTimelineHomeBar
                homeCount={homeCount}
                prod={day.production?.[plantRow.plant]}
                recvLanesCount={recvLanes.length}
            />
            {Array.from({ length: sentLanes.length }, (_, li) => (
                <RestViolationBadges
                    key={`v-${li}`}
                    homeOffset={homeOffset}
                    laneIdx={li}
                    minRestHours={minRestHours}
                    nextStartViolation={restViolations[`${dayIdx}:${plantRow.plant}:${li}`] || null}
                    prevLeaveViolation={restViolations[`${dayIdx}:${plantRow.plant}:${li}:end`] || null}
                />
            ))}
            {sentLanes.map((lane, i) => (
                <PlanTimelineLaneBlock key={`s-${i}`} homeOffset={homeOffset} isSent lane={lane} laneIdx={i} />
            ))}
            {recvLanes.map((lane, i) => (
                <PlanTimelineLaneBlock
                    key={`r-${i}`}
                    homeOffset={homeOffset}
                    isSent={false}
                    lane={lane}
                    laneIdx={sentLanes.length + i}
                />
            ))}
            {allLanes.length === 0 && homeCount === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] opacity-30" style={{ color: 'var(--text-secondary)' }}>
                        —
                    </span>
                </div>
            )}
            {cursorDayIdx === dayIdx && cursorPct !== null && <CursorLine pct={cursorPct} />}
        </div>
    )
}

function SentRecvSeparator({ offsetTop }) {
    return (
        <div
            className="absolute left-0 right-0"
            style={{
                background: `repeating-linear-gradient(90deg, ${RECV_COLOR}30 0, ${RECV_COLOR}30 4px, transparent 4px, transparent 8px)`,
                height: 2,
                top: offsetTop
            }}
        />
    )
}

function HourGridLine({ idx }) {
    const hour = TIMELINE_START_HOUR + idx
    return (
        <div
            className="absolute top-0 bottom-0 w-px"
            style={{
                background: 'var(--border-light)',
                left: `${(idx / TIMELINE_HOURS) * 100}%`,
                opacity: isWorkHour(hour) ? 0.5 : 0.15
            }}
        />
    )
}

function CursorLine({ pct }) {
    return (
        <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${pct}%` }}>
            <div className="absolute inset-y-0 -left-px w-0.5" style={{ background: '#dc2626' }} />
        </div>
    )
}

function RestViolationBadges({ homeOffset, laneIdx, minRestHours, nextStartViolation, prevLeaveViolation }) {
    const top = (laneIdx + homeOffset) * ROW_HEIGHT + 4
    const height = ROW_HEIGHT - 8
    return (
        <>
            {nextStartViolation && (
                <div
                    className="absolute pointer-events-none rounded-r flex items-center overflow-hidden"
                    style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderLeft: 'none',
                        height,
                        left: 0,
                        top,
                        width: `calc(${timeToPercent(nextStartViolation.nextStartTime)}% - 5px)`
                    }}
                    title={`Only a ${nextStartViolation.gapHours}h reset, not a ${minRestHours}h reset`}
                >
                    <span className="text-[8px] font-bold whitespace-nowrap pl-1" style={{ color: '#ef4444' }}>
                        Only a {nextStartViolation.gapHours}h reset, not a {minRestHours}h reset
                    </span>
                </div>
            )}
            {prevLeaveViolation && (
                <div
                    className="absolute pointer-events-none rounded-l flex items-center overflow-hidden"
                    style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRight: 'none',
                        height,
                        left: `calc(${timeToPercent(prevLeaveViolation.prevLeaveTime)}% + 5px)`,
                        right: 0,
                        top
                    }}
                    title={`Only a ${prevLeaveViolation.gapHours}h reset, not a ${minRestHours}h reset`}
                >
                    <span className="text-[8px] font-bold whitespace-nowrap pr-1 ml-auto" style={{ color: '#ef4444' }}>
                        Only a {prevLeaveViolation.gapHours}h reset, not a {minRestHours}h reset
                    </span>
                </div>
            )}
        </>
    )
}
