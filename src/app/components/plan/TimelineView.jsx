import React, { useEffect, useMemo, useRef } from 'react'

import { DAY_WIDTH, LABEL_WIDTH, TIMELINE_HOURS, TIMELINE_START_HOUR } from '../../../utils/PlanUtility'
import {
    PLAN_TIMELINE_MIN_REST_HOURS,
    usePlanTimelineCursor,
    usePlanTimelineDays,
    usePlanTimelinePlantRows,
    usePlanTimelineRestViolations,
    usePlanTimelineSnapshot
} from '../../hooks/usePlanTimelineData'
import { PlanTimelineDayColumn } from './PlanTimelineDayColumn'
import { PlanTimelinePlantLabels } from './PlanTimelinePlantLabels'
import { PlanTimelineSnapshotBar } from './PlanTimelineSnapshotBar'

const CURRENT_DAY_INDEX = 3
const HOUR_FIRST = 12
const HOUR_NOON = 12

const formatHourLabel = (hour) => {
    if (hour === 0) return '12a'
    if (hour < HOUR_NOON) return `${hour}a`
    if (hour === HOUR_NOON) return '12p'
    return `${hour - HOUR_FIRST}p`
}

/**
 * Multi-day Gantt-style timeline showing 3 days before and 3 days after the
 * selected plan date. Each day column draws sent / received / home lanes per
 * plant and overlays rest-violation hashes when consecutive days don't leave
 * enough recovery time. Click-and-drag inside a day to drop a snapshot ruler
 * and inspect per-plant operator status at that moment.
 */
function TimelineView({
    accentColor,
    addMinutesToTime,
    adjacentPlans,
    adjacentProduction,
    assignments,
    getTravelTime,
    mixerCountsByPlant,
    planDate,
    plantProduction,
    plants
}) {
    const scrollRef = useRef(null)
    const { dayLanes, days } = usePlanTimelineDays({
        addMinutesToTime,
        adjacentPlans,
        adjacentProduction,
        assignments,
        getTravelTime,
        planDate,
        plantProduction
    })
    const restViolations = usePlanTimelineRestViolations({ dayLanes, plants })
    const plantRows = usePlanTimelinePlantRows({ dayLanes, mixerCountsByPlant, plants })
    const { clear, cursorDayIdx, cursorPct, cursorTime, dayRefs, handleMouseDown } = usePlanTimelineCursor()
    const plantSnapshot = usePlanTimelineSnapshot({ cursorDayIdx, cursorTime, dayLanes, mixerCountsByPlant })

    const hourLabels = useMemo(
        () => Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => formatHourLabel(TIMELINE_START_HOUR + i)),
        []
    )

    useEffect(() => {
        const node = dayRefs.current[CURRENT_DAY_INDEX]
        if (node) node.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
    }, [dayRefs])

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <PlanTimelineSnapshotBar
                accentColor={accentColor}
                cursorDayIdx={cursorDayIdx}
                cursorTime={cursorTime}
                days={days}
                plantSnapshot={plantSnapshot}
                onClear={clear}
            />
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
                <div className="flex" style={{ minWidth: LABEL_WIDTH + DAY_WIDTH * days.length }}>
                    <PlanTimelinePlantLabels
                        accentColor={accentColor}
                        mixerCountsByPlant={mixerCountsByPlant}
                        plantRows={plantRows}
                    />
                    {dayLanes.map((day, dayIdx) => (
                        <PlanTimelineDayColumn
                            key={day.date}
                            accentColor={accentColor}
                            cursorDayIdx={cursorDayIdx}
                            cursorPct={cursorPct}
                            day={day}
                            dayIdx={dayIdx}
                            dayRefs={dayRefs}
                            handleMouseDown={handleMouseDown}
                            hourLabels={hourLabels}
                            minRestHours={PLAN_TIMELINE_MIN_REST_HOURS}
                            mixerCountsByPlant={mixerCountsByPlant}
                            plantRows={plantRows}
                            restViolations={restViolations}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default TimelineView
