import React, { useEffect, useMemo, useState } from 'react'

import {
    addMinutesToTime,
    BUFFER_MINUTES,
    DEFAULT_STAGGER_MINUTES,
    LANE_COLORS,
    MAX_YPH,
    PRE_TRIP_MINUTES,
    TIMELINE_HOURS,
    TIMELINE_START_HOUR,
    timeToMinutes,
    timeToPercent
} from '../../../utils/PlanUtility'

const SENT_COLOR = '#c2703a'
const RECV_COLOR = '#3b7dd8'
const HOME_COLOR = '#2d8659'
const ROW_HEIGHT = 40
const LABEL_WIDTH = 120
const HEADER_HEIGHT = 34

/** Compact, cleaner Gantt-style preview of the day's movements. */
export default function PlanMiniTimeline({
    accentColor,
    assignments,
    getTravelTime,
    mixerCountsByPlant,
    plantProduction
}) {
    const { allLanes, hourLabels, miniPlantRows } = useMemo(() => {
        const lanes = []
        assignments.forEach((a, idx) => {
            if (!a.fromPlant || !a.toPlant || !a.time) return
            const count = parseInt(a.driverCount) || 1
            const travelMin = getTravelTime(a.fromPlant, a.toPlant)
            const showTravel = travelMin !== null && !a.loadFromPlant
            const totalPreDeparture = showTravel ? travelMin + BUFFER_MINUTES + PRE_TRIP_MINUTES : PRE_TRIP_MINUTES

            const buildLane = (arriveTime, leaveTime, opLabel) => {
                const clockIn = arriveTime ? addMinutesToTime(arriveTime, -totalPreDeparture) : null
                const preTripEnd = clockIn ? addMinutesToTime(clockIn, PRE_TRIP_MINUTES) : null
                const returnEnd = showTravel && leaveTime ? addMinutesToTime(leaveTime, travelMin) : null
                return {
                    arriveTime,
                    clockIn,
                    preTripEnd,
                    leaveTime: leaveTime || null,
                    returnEnd,
                    fromPlant: a.fromPlant,
                    toPlant: a.toPlant,
                    hasTravelTime: showTravel,
                    travel: showTravel ? travelMin : null,
                    loadFromPlant: a.loadFromPlant,
                    label: opLabel,
                    color: LANE_COLORS[idx % LANE_COLORS.length]
                }
            }

            if (count > 1 && a.timeMode === 'custom' && a.customTimes?.length) {
                a.customTimes.slice(0, count).forEach((ct, i) => {
                    if (ct.time)
                        lanes.push(buildLane(ct.time, ct.leaveTime, `${a.fromPlant}\u2192${a.toPlant} #${i + 1}`))
                })
            } else if (count > 1) {
                for (let j = 0; j < count; j++) {
                    const arr = addMinutesToTime(a.time, j * (a.staggerMinutes || DEFAULT_STAGGER_MINUTES))
                    if (arr) lanes.push(buildLane(arr, a.leaveTime, `${a.fromPlant}\u2192${a.toPlant} #${j + 1}`))
                }
            } else {
                lanes.push(buildLane(a.time, a.leaveTime, `${a.fromPlant}\u2192${a.toPlant}`))
            }
        })

        const involvedPlants = [...new Set([...lanes.map((l) => l.fromPlant), ...lanes.map((l) => l.toPlant)])].sort()
        const rows = involvedPlants.map((plant) => {
            const sent = lanes
                .filter((l) => l.fromPlant === plant)
                .sort((a, b) => (a.clockIn || a.arriveTime).localeCompare(b.clockIn || b.arriveTime))
            const recv = lanes
                .filter((l) => l.toPlant === plant)
                .sort((a, b) => (a.clockIn || a.arriveTime).localeCompare(b.clockIn || b.arriveTime))
            const base = mixerCountsByPlant[plant] || 0
            const homeCount = Math.max(0, base - sent.length)
            const homeOffset = homeCount > 0 ? 1 : 0
            const laneCount = Math.max(1, sent.length + recv.length + homeOffset)
            return { plant, sent, recv, base, homeCount, homeOffset, laneCount }
        })

        const labels = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => {
            const h = TIMELINE_START_HOUR + i
            return h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`
        })

        return { allLanes: lanes, hourLabels: labels, miniPlantRows: rows }
    }, [assignments, getTravelTime, mixerCountsByPlant])

    // Live "now" indicator (updates every minute so it slides across)
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60 * 1000)
        return () => clearInterval(t)
    }, [])
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = TIMELINE_START_HOUR * 60
    const totalMinutes = TIMELINE_HOURS * 60
    const nowPct =
        nowMinutes >= startMinutes && nowMinutes <= startMinutes + totalMinutes
            ? ((nowMinutes - startMinutes) / totalMinutes) * 100
            : null

    const hasAny = allLanes.length > 0

    if (!hasAny) {
        return (
            <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
                <i className="fas fa-chart-gantt text-2xl mb-2 opacity-50 block" />
                Add assignments with times to see the timeline
            </div>
        )
    }

    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            {/* Legend */}
            <div
                className="flex items-center gap-4 px-4 py-2 text-[10px] font-semibold"
                style={{
                    background: 'var(--bg-primary)',
                    borderBottom: '1px solid var(--border-light)',
                    color: 'var(--text-secondary)'
                }}
            >
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: HOME_COLOR }} />
                    On-site (home)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: SENT_COLOR }} />
                    Sent out
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: RECV_COLOR }} />
                    Received
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5" style={{ background: '#dc2626' }} />
                    Now
                </span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {allLanes.length} lane{allLanes.length === 1 ? '' : 's'} · {miniPlantRows.length} plants
                </span>
            </div>

            {/* Hour header */}
            <div className="relative flex" style={{ height: HEADER_HEIGHT }}>
                <div
                    className="shrink-0 flex items-center px-3 text-[10px] font-bold uppercase tracking-wider border-b border-r"
                    style={{
                        width: LABEL_WIDTH,
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-light)',
                        background: 'var(--bg-primary)'
                    }}
                >
                    Plant
                </div>
                <div
                    className="flex-1 relative border-b"
                    style={{ borderColor: 'var(--border-light)', background: 'var(--bg-primary)' }}
                >
                    {/* Shift window highlight (4AM–6PM) */}
                    <div
                        className="absolute inset-y-0 pointer-events-none"
                        style={{
                            background: 'var(--bg-secondary)',
                            left: `${((4 - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100}%`,
                            width: `${((18 - 4) / TIMELINE_HOURS) * 100}%`
                        }}
                    />
                    {hourLabels.map((label, i) => {
                        const hour = TIMELINE_START_HOUR + i
                        const isWorkHour = hour >= 4 && hour <= 18
                        const isMajor = hour % 2 === 0
                        return (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 flex items-end pb-1"
                                style={{ left: `${(i / TIMELINE_HOURS) * 100}%` }}
                            >
                                <div
                                    className="absolute top-0 bottom-0"
                                    style={{
                                        width: 1,
                                        background: 'var(--border-light)',
                                        opacity: isMajor ? 1 : isWorkHour ? 0.5 : 0.25
                                    }}
                                />
                                {isMajor && (
                                    <span
                                        className="pl-1 text-[10px] font-semibold"
                                        style={{
                                            color: isWorkHour ? 'var(--text-primary)' : 'var(--text-tertiary)'
                                        }}
                                    >
                                        {label}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                    {/* NOW marker in header */}
                    {nowPct != null && (
                        <div
                            className="absolute top-0 bottom-0"
                            style={{
                                left: `${nowPct}%`,
                                width: 2,
                                background: '#dc2626',
                                boxShadow: '0 0 0 1px rgba(220,38,38,0.25)'
                            }}
                        >
                            <div
                                className="absolute -top-0.5 -translate-x-1/2 px-1.5 rounded-sm text-[9px] font-bold text-white whitespace-nowrap"
                                style={{ background: '#dc2626' }}
                            >
                                NOW{' '}
                                {now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, minute: '2-digit' })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Plant rows */}
            {miniPlantRows.map((pr, prIdx) => (
                <PlantRow
                    key={pr.plant}
                    accentColor={accentColor}
                    hourLabels={hourLabels}
                    nowPct={nowPct}
                    plantProduction={plantProduction}
                    plantRow={pr}
                    rowIndex={prIdx}
                    isLast={prIdx === miniPlantRows.length - 1}
                />
            ))}
        </div>
    )
}

function PlantRow({ accentColor, hourLabels, isLast, nowPct, plantProduction, plantRow: pr, rowIndex: prIdx }) {
    const prod = plantProduction[pr.plant] || {}
    const startPct = timeToPercent(prod.firstJobTime)
    const endPct = timeToPercent(prod.lastJobTime)
    const hasProd = startPct != null && endPct != null && endPct > startPct
    const effectiveOps = pr.homeCount + pr.recv.length
    const firstMins = hasProd ? timeToMinutes(prod.firstJobTime) : null
    const lastMins = hasProd ? timeToMinutes(prod.lastJobTime) : null
    const hrs = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yds = hasProd ? parseFloat(prod.totalYardage) || 0 : 0
    const yph = hrs && yds && effectiveOps > 0 ? Math.round((yds / (hrs * effectiveOps)) * 10) / 10 : null
    const overMax = yph !== null && yph > MAX_YPH
    const rowBg = prIdx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'

    return (
        <div className="flex" style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
            {/* Plant label */}
            <div
                className="shrink-0 flex flex-col justify-center px-3 border-r"
                style={{
                    width: LABEL_WIDTH,
                    borderColor: 'var(--border-light)',
                    height: ROW_HEIGHT * pr.laneCount,
                    background: rowBg
                }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-industry text-[10px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[12px] font-bold uppercase tracking-wide leading-none"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                        >
                            {pr.plant}
                        </div>
                        <div className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                            <span style={{ color: 'var(--text-secondary)' }}>{pr.base}</span>
                            {pr.sent.length > 0 && (
                                <span style={{ color: SENT_COLOR, fontWeight: 700 }}>-{pr.sent.length}</span>
                            )}
                            {pr.recv.length > 0 && (
                                <span style={{ color: RECV_COLOR, fontWeight: 700 }}>+{pr.recv.length}</span>
                            )}
                        </div>
                    </div>
                </div>
                {yph !== null && (
                    <div
                        className="mt-1 text-[9px] font-bold rounded-full px-1.5 py-px self-start"
                        style={{
                            background: overMax ? '#ef444418' : `${HOME_COLOR}14`,
                            color: overMax ? '#ef4444' : HOME_COLOR
                        }}
                    >
                        {yph} yph
                    </div>
                )}
            </div>

            {/* Lane area */}
            <div className="flex-1 relative" style={{ height: ROW_HEIGHT * pr.laneCount, background: rowBg }}>
                {/* Hour grid lines */}
                {hourLabels.map((_, j) => {
                    const hour = TIMELINE_START_HOUR + j
                    const isMajor = hour % 2 === 0
                    const isWorkHour = hour >= 4 && hour <= 18
                    return (
                        <div
                            key={j}
                            className="absolute top-0 bottom-0"
                            style={{
                                left: `${(j / TIMELINE_HOURS) * 100}%`,
                                width: 1,
                                background: 'var(--border-light)',
                                opacity: isMajor ? 0.6 : isWorkHour ? 0.25 : 0.1
                            }}
                        />
                    )
                })}

                {/* Shift window tint */}
                <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                        background: `${accentColor}05`,
                        left: `${((4 - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100}%`,
                        width: `${((18 - 4) / TIMELINE_HOURS) * 100}%`
                    }}
                />

                {/* Sent/Recv separator */}
                {pr.sent.length > 0 && pr.recv.length > 0 && (
                    <div
                        className="absolute left-0 right-0"
                        style={{
                            top: (pr.sent.length + pr.homeOffset) * ROW_HEIGHT - 0.5,
                            height: 1,
                            background: `repeating-linear-gradient(90deg, var(--border-medium) 0, var(--border-medium) 4px, transparent 4px, transparent 8px)`,
                            opacity: 0.7
                        }}
                    />
                )}

                {/* Home operators + production window */}
                {pr.homeCount > 0 && (
                    <HomeLane
                        hasProd={hasProd}
                        startPct={startPct}
                        endPct={endPct}
                        prod={prod}
                        effectiveOps={effectiveOps}
                        recvCount={pr.recv.length}
                        yds={yds}
                        yph={yph}
                        overMax={overMax}
                    />
                )}

                {/* Sent lanes */}
                {pr.sent.map((lane, i) => (
                    <MiniBlock key={`s-${i}`} lane={lane} laneIdx={i} isSent homeOffset={pr.homeOffset} />
                ))}

                {/* Received lanes */}
                {pr.recv.map((lane, i) => (
                    <MiniBlock
                        key={`r-${i}`}
                        lane={lane}
                        laneIdx={pr.sent.length + i}
                        isSent={false}
                        homeOffset={pr.homeOffset}
                    />
                ))}

                {/* NOW vertical line */}
                {nowPct != null && (
                    <div
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                            left: `${nowPct}%`,
                            width: 2,
                            background: '#dc2626',
                            opacity: 0.6
                        }}
                    />
                )}
            </div>
        </div>
    )
}

function HomeLane({ effectiveOps, endPct, hasProd, overMax, prod, recvCount, startPct, yds, yph }) {
    const barLeft = hasProd ? startPct : 1
    const barWidth = hasProd ? endPct - startPct : 98
    const blockH = ROW_HEIGHT - 8
    return (
        <>
            {hasProd && (
                <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                        background: `${HOME_COLOR}08`,
                        borderLeft: `2px solid ${HOME_COLOR}30`,
                        borderRight: `2px solid ${HOME_COLOR}30`,
                        left: `${startPct}%`,
                        width: `${endPct - startPct}%`
                    }}
                />
            )}
            <div
                className="absolute flex items-center pointer-events-none"
                style={{
                    background: `${HOME_COLOR}22`,
                    borderLeft: `3px solid ${HOME_COLOR}`,
                    borderRadius: 6,
                    boxShadow: `inset 0 0 0 1px ${HOME_COLOR}30`,
                    height: blockH,
                    left: `${barLeft}%`,
                    top: 4,
                    width: `${barWidth}%`
                }}
            >
                <div className="flex items-center gap-2 px-2 whitespace-nowrap">
                    <span className="text-[10px] font-extrabold flex items-center gap-1" style={{ color: HOME_COLOR }}>
                        <i className="fas fa-hard-hat text-[8px]" />
                        {effectiveOps} op{effectiveOps === 1 ? '' : 's'}
                        {recvCount > 0 && <span style={{ color: RECV_COLOR, fontWeight: 700 }}> (+{recvCount})</span>}
                    </span>
                    {hasProd && (
                        <span className="text-[10px] font-semibold font-mono" style={{ color: `${HOME_COLOR}CC` }}>
                            {prod.firstJobTime}–{prod.lastJobTime}
                        </span>
                    )}
                    {yds > 0 && (
                        <span
                            className="text-[10px] font-bold rounded-full px-1.5 py-px"
                            style={{ color: HOME_COLOR, background: `${HOME_COLOR}15` }}
                        >
                            {prod.totalYardage} yd
                        </span>
                    )}
                    {overMax && (
                        <span
                            className="text-[10px] font-extrabold flex items-center gap-1"
                            style={{ color: '#ef4444' }}
                        >
                            <i className="fas fa-triangle-exclamation text-[9px]" />
                            Over capacity
                        </span>
                    )}
                </div>
            </div>
        </>
    )
}

function MiniBlock({ homeOffset, isSent, lane, laneIdx }) {
    const blockColor = isSent ? SENT_COLOR : RECV_COLOR
    const clockInPct = timeToPercent(lane.clockIn)
    const preTripEndPct = timeToPercent(lane.preTripEnd)
    const arrivePct = timeToPercent(lane.arriveTime)
    const leavePct = timeToPercent(lane.leaveTime)
    const returnEndPct = timeToPercent(lane.returnEnd)
    const top = (laneIdx + homeOffset) * ROW_HEIGHT + 5
    const blockH = ROW_HEIGHT - 10

    const preW = clockInPct != null && preTripEndPct != null ? Math.max(preTripEndPct - clockInPct, 0) : 0
    const travelW =
        lane.hasTravelTime && preTripEndPct != null && arrivePct != null ? Math.max(arrivePct - preTripEndPct, 0) : 0
    const siteStart = arrivePct ?? preTripEndPct ?? clockInPct
    const siteEnd = leavePct ?? (siteStart != null ? Math.min(siteStart + 2, 100) : null)
    const siteW = siteStart != null && siteEnd != null ? Math.max(siteEnd - siteStart, 1) : 0
    const returnW = leavePct != null && returnEndPct != null ? Math.max(returnEndPct - leavePct, 0) : 0

    const tooltip = [
        isSent ? `→ ${lane.toPlant}` : `← ${lane.fromPlant}`,
        lane.clockIn && `clock ${lane.clockIn}`,
        lane.arriveTime && `arrive ${lane.arriveTime}`,
        lane.leaveTime && `leave ${lane.leaveTime}`,
        lane.travel != null && `${lane.travel}m travel`
    ]
        .filter(Boolean)
        .join(' · ')

    const routeLabel = isSent ? `→${lane.toPlant}` : `←${lane.fromPlant}`

    return (
        <>
            {/* Connecting line through the whole lane range */}
            {clockInPct != null && siteStart != null && (
                <div
                    className="absolute pointer-events-none"
                    style={{
                        left: `${clockInPct}%`,
                        width: `${(returnEndPct ?? siteStart + siteW) - clockInPct}%`,
                        top: top + blockH / 2 - 0.5,
                        height: 1,
                        background: `${blockColor}40`
                    }}
                />
            )}

            {/* Pre-trip */}
            {preW > 0 && (
                <div
                    className="absolute rounded-sm flex items-center justify-center"
                    title={tooltip}
                    style={{
                        background: `${blockColor}24`,
                        borderLeft: `3px solid ${blockColor}`,
                        height: blockH,
                        left: `${clockInPct}%`,
                        minWidth: 6,
                        top,
                        width: `${preW}%`
                    }}
                >
                    {preW > 1.5 && (
                        <span className="text-[8px] font-bold uppercase" style={{ color: `${blockColor}C0` }}>
                            PT
                        </span>
                    )}
                </div>
            )}

            {/* Travel */}
            {travelW > 0 && (
                <div
                    className="absolute flex items-center justify-center"
                    title={tooltip}
                    style={{
                        background: `${blockColor}12`,
                        border: `1px dashed ${blockColor}60`,
                        borderRadius: 3,
                        height: blockH - 4,
                        left: `${preTripEndPct}%`,
                        minWidth: 6,
                        top: top + 2,
                        width: `${travelW}%`
                    }}
                >
                    {travelW > 2.5 && (
                        <span
                            className="text-[9px] font-semibold whitespace-nowrap"
                            style={{ color: `${blockColor}C0` }}
                        >
                            <i className="fas fa-route text-[7px] mr-0.5" />
                            {lane.travel}m
                        </span>
                    )}
                </div>
            )}

            {/* On-site block — the hero */}
            {siteW > 0 && siteStart != null && (
                <div
                    className="absolute flex items-center"
                    title={tooltip}
                    style={{
                        background: blockColor,
                        borderRadius: returnW > 0 ? '4px 0 0 4px' : 4,
                        boxShadow: `0 1px 2px rgba(0,0,0,0.12)`,
                        height: blockH,
                        left: `${siteStart}%`,
                        minWidth: 10,
                        top,
                        width: `${siteW}%`
                    }}
                >
                    <span className="text-[10px] font-bold text-white px-2 whitespace-nowrap truncate">
                        {routeLabel}
                        {lane.arriveTime && (
                            <span className="font-normal opacity-90 ml-1 font-mono">
                                {lane.arriveTime}
                                {lane.leaveTime ? `–${lane.leaveTime}` : ''}
                            </span>
                        )}
                        {lane.loadFromPlant && <span className="ml-1 opacity-80">LD</span>}
                    </span>
                </div>
            )}

            {/* Return */}
            {returnW > 0 && (
                <div
                    className="absolute flex items-center justify-center"
                    title={tooltip}
                    style={{
                        background: `${blockColor}12`,
                        border: `1px dashed ${blockColor}60`,
                        borderLeft: 'none',
                        borderRadius: '0 3px 3px 0',
                        height: blockH - 4,
                        left: `${leavePct}%`,
                        minWidth: 6,
                        top: top + 2,
                        width: `${returnW}%`
                    }}
                >
                    {returnW > 2.5 && (
                        <span
                            className="text-[9px] font-semibold whitespace-nowrap"
                            style={{ color: `${blockColor}C0` }}
                        >
                            <i className="fas fa-rotate-left text-[7px] mr-0.5" />
                            {lane.travel}m
                        </span>
                    )}
                </div>
            )}
        </>
    )
}
