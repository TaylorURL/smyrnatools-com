import { useEffect, useMemo, useRef, useState } from 'react'

import {
    BUFFER_MINUTES,
    DEFAULT_STAGGER_MINUTES,
    getOffsetDate,
    LANE_COLORS,
    minutesToTime,
    percentToTime,
    PRE_TRIP_MINUTES,
    timeToMinutes
} from '../../utils/PlanUtility'

const DAY_OFFSET_MIN = -3
const DAY_OFFSET_MAX = 3
const ARROW = '→'
const MIN_REST_HOURS = 10
const MIN_REST_MINUTES = MIN_REST_HOURS * 60
const MINUTES_PER_DAY = 24 * 60

/** Build the 7-day window of plan days with their per-driver lanes and a few
 *  derived helpers (plant rows, rest violations) shared by both render paths. */
export function usePlanTimelineDays({
    addMinutesToTime,
    adjacentPlans,
    adjacentProduction,
    assignments,
    getTravelTime,
    plantProduction,
    planDate
}) {
    const days = useMemo(() => {
        const out = []
        for (let offset = DAY_OFFSET_MIN; offset <= DAY_OFFSET_MAX; offset++) {
            const date = getOffsetDate(planDate, offset)
            const isCurrent = offset === 0
            out.push({
                assignments: isCurrent ? assignments : adjacentPlans[date] || [],
                date,
                isCurrent,
                offset,
                production: isCurrent ? plantProduction : adjacentProduction[date] || {}
            })
        }
        return out
    }, [adjacentPlans, adjacentProduction, assignments, plantProduction, planDate])

    const dayLanes = useMemo(
        () =>
            days.map((day, dayIdx) => ({
                ...day,
                lanes: buildLanesForDay(day.assignments, dayIdx, getTravelTime, addMinutesToTime)
            })),
        [days, getTravelTime, addMinutesToTime]
    )

    return { dayLanes, days }
}

function buildLanesForDay(dayAssignments, dayIdx, getTravelTime, addMinutesToTime) {
    const result = []
    ;(dayAssignments || []).forEach((assignment, idx) => {
        if (!assignment.fromPlant || !assignment.toPlant || !assignment.time) return
        const count = parseInt(assignment.driverCount, 10) || 1
        const travelMin = getTravelTime(assignment.fromPlant, assignment.toPlant)
        const hasTravelTime = travelMin !== null
        const color = LANE_COLORS[idx % LANE_COLORS.length]

        const buildLane = (arriveTime, leaveTime, opLabel) => {
            const showTravel = hasTravelTime && !assignment.loadFromPlant
            const totalPreDeparture = showTravel ? travelMin + BUFFER_MINUTES + PRE_TRIP_MINUTES : PRE_TRIP_MINUTES
            const clockIn = arriveTime ? addMinutesToTime(arriveTime, -totalPreDeparture) : null
            const preTripEnd = clockIn ? addMinutesToTime(clockIn, PRE_TRIP_MINUTES) : null
            const returnEnd = showTravel && leaveTime ? addMinutesToTime(leaveTime, travelMin) : null
            return {
                arriveTime,
                clockIn,
                color,
                dayIdx,
                fromPlant: assignment.fromPlant,
                hasTravelTime: showTravel,
                label: opLabel,
                leaveTime: leaveTime || null,
                loadFromPlant: assignment.loadFromPlant,
                preTripEnd,
                returnEnd,
                toPlant: assignment.toPlant,
                travel: showTravel ? travelMin : null
            }
        }

        if (count > 1 && assignment.timeMode === 'custom' && assignment.customTimes?.length) {
            assignment.customTimes.slice(0, count).forEach((customTime, i) => {
                if (!customTime.time) return
                result.push(
                    buildLane(
                        customTime.time,
                        customTime.leaveTime,
                        `${assignment.fromPlant}${ARROW}${assignment.toPlant} #${i + 1}`
                    )
                )
            })
        } else if (count > 1) {
            for (let i = 0; i < count; i++) {
                const arrive = addMinutesToTime(
                    assignment.time,
                    i * (assignment.staggerMinutes || DEFAULT_STAGGER_MINUTES)
                )
                if (!arrive) continue
                result.push(
                    buildLane(
                        arrive,
                        assignment.leaveTime,
                        `${assignment.fromPlant}${ARROW}${assignment.toPlant} #${i + 1}`
                    )
                )
            }
        } else {
            result.push(
                buildLane(assignment.time, assignment.leaveTime, `${assignment.fromPlant}${ARROW}${assignment.toPlant}`)
            )
        }
    })
    return result
}

/**
 * Detect insufficient rest (< 10 hours) between consecutive days. Only
 * checks plant-of-origin lanes (sent) — received lanes belong to another
 * plant's drivers and don't count for this plant's reset.
 */
export function usePlanTimelineRestViolations({ dayLanes, plants }) {
    return useMemo(() => {
        const violations = {}
        const plantCodes = (plants || []).map((p) => p.plant_code).filter(Boolean)
        const compareByStart = (a, b) => (a.clockIn || a.arriveTime).localeCompare(b.clockIn || b.arriveTime)

        for (let i = 0; i < dayLanes.length - 1; i++) {
            const dayA = dayLanes[i]
            const dayB = dayLanes[i + 1]
            if (!dayA.lanes.length || !dayB.lanes.length) continue
            for (const plant of plantCodes) {
                const lanesA = dayA.lanes.filter((lane) => lane.fromPlant === plant).sort(compareByStart)
                const lanesB = dayB.lanes.filter((lane) => lane.fromPlant === plant).sort(compareByStart)
                if (!lanesA.length || !lanesB.length) continue
                accumulateRestViolations({ dayA: i, dayB: i + 1, lanesA, lanesB, plant, violations })
            }
        }
        return violations
    }, [dayLanes, plants])
}

function accumulateRestViolations({ dayA, dayB, lanesA, lanesB, plant, violations }) {
    const leaveMinsA = lanesA
        .map((lane, idx) => ({ idx, mins: timeToMinutes(lane.returnEnd ?? lane.leaveTime) }))
        .filter((entry) => entry.mins !== null)
    const startMinsB = lanesB
        .map((lane, idx) => ({ idx, mins: timeToMinutes(lane.clockIn || lane.arriveTime) }))
        .filter((entry) => entry.mins !== null)
    if (!leaveMinsA.length || !startMinsB.length) return

    const earliestStartB = Math.min(...startMinsB.map((entry) => entry.mins))
    const latestLeaveA = Math.max(...leaveMinsA.map((entry) => entry.mins))

    leaveMinsA.forEach(({ idx, mins }) => {
        const gap = MINUTES_PER_DAY - mins + earliestStartB
        if (gap >= MIN_REST_MINUTES) return
        violations[`${dayA}:${plant}:${idx}:end`] = {
            gapHours: Math.round((gap / 60) * 10) / 10,
            prevLeaveTime: minutesToTime(mins)
        }
    })
    startMinsB.forEach(({ idx, mins }) => {
        const gap = MINUTES_PER_DAY - latestLeaveA + mins
        if (gap >= MIN_REST_MINUTES) return
        violations[`${dayB}:${plant}:${idx}`] = {
            gapHours: Math.round((gap / 60) * 10) / 10,
            nextStartTime: minutesToTime(mins)
        }
    })
}

/** Plant-row metadata (max sent/recv across all visible days, total lane count). */
export function usePlanTimelinePlantRows({ dayLanes, mixerCountsByPlant, plants }) {
    return useMemo(() => {
        const allPlants = (plants || [])
            .map((plant) => plant.plant_code)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        return allPlants.map((plant) => {
            let maxSent = 0
            let maxRecv = 0
            let maxTotal = 0
            const base = mixerCountsByPlant[plant] || 0
            dayLanes.forEach((day) => {
                const sent = day.lanes.filter((lane) => lane.fromPlant === plant).length
                const recv = day.lanes.filter((lane) => lane.toPlant === plant).length
                const home = Math.max(0, base - sent)
                maxSent = Math.max(maxSent, sent)
                maxRecv = Math.max(maxRecv, recv)
                maxTotal = Math.max(maxTotal, sent + recv + (home > 0 ? 1 : 0))
            })
            return { base, laneCount: Math.max(1, maxTotal), plant, recvCount: maxRecv, sentCount: maxSent }
        })
    }, [dayLanes, mixerCountsByPlant, plants])
}

/** Cursor state + drag handlers for the timeline row areas. */
export function usePlanTimelineCursor() {
    const dayRefs = useRef({})
    const [cursorDayIdx, setCursorDayIdx] = useState(null)
    const [cursorPct, setCursorPct] = useState(null)
    const [isDragging, setIsDragging] = useState(false)

    const updateCursorFromEvent = (event, dayIdx) => {
        const ref = dayRefs.current[dayIdx]
        if (!ref) return
        const rect = ref.getBoundingClientRect()
        const x = event.clientX - rect.left
        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
        setCursorPct(pct)
    }

    const handleMouseDown = (event, dayIdx) => {
        setIsDragging(true)
        setCursorDayIdx(dayIdx)
        updateCursorFromEvent(event, dayIdx)
    }

    useEffect(() => {
        if (!isDragging) return undefined
        const onMove = (event) => {
            if (cursorDayIdx !== null) updateCursorFromEvent(event, cursorDayIdx)
        }
        const onUp = () => setIsDragging(false)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [isDragging, cursorDayIdx])

    const cursorTime = cursorPct !== null ? percentToTime(cursorPct) : null
    const clear = () => {
        setCursorPct(null)
        setCursorDayIdx(null)
    }

    return { clear, cursorDayIdx, cursorPct, cursorTime, dayRefs, handleMouseDown }
}

/** Per-plant snapshot at the current cursor — counts each operator's status. */
export function usePlanTimelineSnapshot({ cursorDayIdx, cursorTime, dayLanes, mixerCountsByPlant }) {
    return useMemo(() => {
        if (cursorTime === null || cursorDayIdx === null) return []
        const cursorMin = timeToMinutes(cursorTime)
        const day = dayLanes[cursorDayIdx]
        if (!day) return []

        const plantCounts = {}
        const ensure = (plant) => {
            if (!plantCounts[plant]) plantCounts[plant] = { idle: 0, onSite: 0, traveling: 0 }
            return plantCounts[plant]
        }

        day.lanes.forEach((lane) => {
            const clockInMin = timeToMinutes(lane.clockIn)
            const arriveMin = timeToMinutes(lane.arriveTime)
            const leaveMin = timeToMinutes(lane.leaveTime)
            if (clockInMin !== null && cursorMin >= clockInMin && arriveMin !== null && cursorMin < arriveMin) {
                ensure(lane.fromPlant).traveling += 1
            } else if (arriveMin !== null && cursorMin >= arriveMin) {
                if (leaveMin !== null && cursorMin > leaveMin) ensure(lane.toPlant).idle += 1
                else ensure(lane.toPlant).onSite += 1
            } else if (clockInMin !== null && cursorMin < clockInMin) {
                ensure(lane.fromPlant).idle += 1
            }
        })

        return Object.entries(plantCounts)
            .map(([code, counts]) => ({ code, ...counts, base: mixerCountsByPlant[code] || 0 }))
            .sort((a, b) => a.code.localeCompare(b.code))
    }, [cursorDayIdx, cursorTime, dayLanes, mixerCountsByPlant])
}

export const PLAN_TIMELINE_MIN_REST_HOURS = MIN_REST_HOURS
