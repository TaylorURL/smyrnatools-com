import { useMemo } from 'react'

import {
    addMinutesToTime,
    BUFFER_MINUTES,
    DEFAULT_STAGGER_MINUTES,
    LANE_COLORS,
    PRE_TRIP_MINUTES,
    TIMELINE_HOURS,
    TIMELINE_START_HOUR
} from '../../utils/PlanUtility'

const ARROW_GLYPH = '→'

const formatHourLabel = (hour) => {
    if (hour === 0) return '12a'
    if (hour < 12) return `${hour}a`
    if (hour === 12) return '12p'
    return `${hour - 12}p`
}

/**
 * Build mini-timeline rows from raw assignments. Splits each assignment into
 * one or more "lanes" (per-driver tracks) with derived clock-in / pre-trip
 * end / on-site / return-end timestamps so the renderer can position them
 * along the day axis without re-computing math per render.
 *
 * Each lane carries:
 *   - clockIn / preTripEnd — derived from arrival - travel - buffer - pre-trip
 *   - arriveTime / leaveTime — straight from the assignment (or custom slots)
 *   - returnEnd — when the driver gets back home (only when travel is set)
 *   - color — picked round-robin from LANE_COLORS so siblings stay distinct
 */
export function usePlanMiniTimelineRows({ assignments, getTravelTime, mixerCountsByPlant }) {
    return useMemo(() => {
        const lanes = buildLanesFromAssignments(assignments, getTravelTime)
        const involvedPlants = [...new Set(lanes.flatMap((lane) => [lane.fromPlant, lane.toPlant]))].sort()
        const miniPlantRows = involvedPlants.map((plant) => buildPlantRow(plant, lanes, mixerCountsByPlant))
        const hourLabels = Array.from({ length: TIMELINE_HOURS + 1 }, (_, idx) =>
            formatHourLabel(TIMELINE_START_HOUR + idx)
        )
        return { allLanes: lanes, hourLabels, miniPlantRows }
    }, [assignments, getTravelTime, mixerCountsByPlant])
}

function buildLanesFromAssignments(assignments, getTravelTime) {
    const lanes = []
    ;(assignments || []).forEach((assignment, idx) => {
        if (!assignment.fromPlant || !assignment.toPlant || !assignment.time) return
        const count = parseInt(assignment.driverCount, 10) || 1
        const travelMin = getTravelTime(assignment.fromPlant, assignment.toPlant)
        const showTravel = travelMin !== null && !assignment.loadFromPlant
        const totalPreDeparture = showTravel ? travelMin + BUFFER_MINUTES + PRE_TRIP_MINUTES : PRE_TRIP_MINUTES
        const color = LANE_COLORS[idx % LANE_COLORS.length]
        const buildLane = (arriveTime, leaveTime, opLabel) =>
            buildLaneRecord({
                arriveTime,
                assignment,
                color,
                leaveTime,
                opLabel,
                showTravel,
                totalPreDeparture,
                travelMin
            })

        if (count > 1 && assignment.timeMode === 'custom' && assignment.customTimes?.length) {
            assignment.customTimes.slice(0, count).forEach((customTime, i) => {
                if (!customTime.time) return
                lanes.push(
                    buildLane(
                        customTime.time,
                        customTime.leaveTime,
                        `${assignment.fromPlant}${ARROW_GLYPH}${assignment.toPlant} #${i + 1}`
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
                lanes.push(
                    buildLane(
                        arrive,
                        assignment.leaveTime,
                        `${assignment.fromPlant}${ARROW_GLYPH}${assignment.toPlant} #${i + 1}`
                    )
                )
            }
        } else {
            lanes.push(
                buildLane(
                    assignment.time,
                    assignment.leaveTime,
                    `${assignment.fromPlant}${ARROW_GLYPH}${assignment.toPlant}`
                )
            )
        }
    })
    return lanes
}

function buildLaneRecord({
    arriveTime,
    assignment,
    color,
    leaveTime,
    opLabel,
    showTravel,
    totalPreDeparture,
    travelMin
}) {
    const clockIn = arriveTime ? addMinutesToTime(arriveTime, -totalPreDeparture) : null
    const preTripEnd = clockIn ? addMinutesToTime(clockIn, PRE_TRIP_MINUTES) : null
    const returnEnd = showTravel && leaveTime ? addMinutesToTime(leaveTime, travelMin) : null
    return {
        arriveTime,
        clockIn,
        color,
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

function buildPlantRow(plant, lanes, mixerCountsByPlant) {
    const compareByStart = (a, b) => (a.clockIn || a.arriveTime).localeCompare(b.clockIn || b.arriveTime)
    const sent = lanes.filter((lane) => lane.fromPlant === plant).sort(compareByStart)
    const recv = lanes.filter((lane) => lane.toPlant === plant).sort(compareByStart)
    const base = mixerCountsByPlant[plant] || 0
    const homeCount = Math.max(0, base - sent.length)
    const homeOffset = homeCount > 0 ? 1 : 0
    const laneCount = Math.max(1, sent.length + recv.length + homeOffset)
    return { base, homeCount, homeOffset, laneCount, plant, recv, sent }
}
