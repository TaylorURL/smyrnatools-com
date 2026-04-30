import React from 'react'

import { MAX_YPH, TIMELINE_HOURS, TIMELINE_START_HOUR, timeToMinutes, timeToPercent } from '../../../utils/PlanUtility'

const ROW_HEIGHT = 40
const LABEL_WIDTH = 120
const SHIFT_START_HOUR = 4
const SHIFT_END_HOUR = 18

const HOME_COLOR = '#2d8659'
const SENT_COLOR = '#c2703a'
const RECV_COLOR = '#3b7dd8'

/** Compute the pour-rate snapshot used by the home-lane badge. */
function computePourRate(prod, plantRow) {
    const startPct = timeToPercent(prod.firstJobTime)
    const endPct = timeToPercent(prod.lastJobTime)
    const hasProd = startPct != null && endPct != null && endPct > startPct
    const effectiveOps = plantRow.homeCount + plantRow.recv.length
    const firstMins = hasProd ? timeToMinutes(prod.firstJobTime) : null
    const lastMins = hasProd ? timeToMinutes(prod.lastJobTime) : null
    const hours = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yards = hasProd ? parseFloat(prod.totalYardage) || 0 : 0
    const yph = hours && yards && effectiveOps > 0 ? Math.round((yards / (hours * effectiveOps)) * 10) / 10 : null
    return { effectiveOps, endPct, hasProd, hours, overMax: yph !== null && yph > MAX_YPH, startPct, yards, yph }
}

/** Single plant row inside the mini timeline. Owns the static label column,
 *  the lane area background grid, and one HomeLane / N×MiniBlock blocks. */
export function PlanMiniTimelineRow({ accentColor, hourLabels, isLast, nowPct, plantProduction, plantRow, rowIndex }) {
    const prod = plantProduction[plantRow.plant] || {}
    const pourRate = computePourRate(prod, plantRow)
    const rowBg = rowIndex % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'
    const totalHeight = ROW_HEIGHT * plantRow.laneCount

    return (
        <div className="flex" style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
            <PlantLabel
                accentColor={accentColor}
                pourRate={pourRate}
                plantRow={plantRow}
                rowBg={rowBg}
                totalHeight={totalHeight}
            />
            <div className="flex-1 relative" style={{ background: rowBg, height: totalHeight }}>
                {hourLabels.map((_, idx) => (
                    <HourGridLine key={idx} idx={idx} />
                ))}
                <ShiftTint accentColor={accentColor} />
                {plantRow.sent.length > 0 && plantRow.recv.length > 0 && (
                    <SentRecvSeparator offsetTop={(plantRow.sent.length + plantRow.homeOffset) * ROW_HEIGHT - 0.5} />
                )}
                {plantRow.homeCount > 0 && (
                    <HomeLane
                        effectiveOps={pourRate.effectiveOps}
                        endPct={pourRate.endPct}
                        hasProd={pourRate.hasProd}
                        overMax={pourRate.overMax}
                        prod={prod}
                        recvCount={plantRow.recv.length}
                        startPct={pourRate.startPct}
                        yds={pourRate.yards}
                    />
                )}
                {plantRow.sent.map((lane, i) => (
                    <MiniBlock key={`s-${i}`} homeOffset={plantRow.homeOffset} isSent lane={lane} laneIdx={i} />
                ))}
                {plantRow.recv.map((lane, i) => (
                    <MiniBlock
                        key={`r-${i}`}
                        homeOffset={plantRow.homeOffset}
                        isSent={false}
                        lane={lane}
                        laneIdx={plantRow.sent.length + i}
                    />
                ))}
                {nowPct != null && <NowVerticalLine nowPct={nowPct} />}
            </div>
        </div>
    )
}

function PlantLabel({ accentColor, pourRate, plantRow, rowBg, totalHeight }) {
    return (
        <div
            className="shrink-0 flex flex-col justify-center px-3 border-r"
            style={{
                background: rowBg,
                borderColor: 'var(--border-light)',
                height: totalHeight,
                width: LABEL_WIDTH
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
                        {plantRow.plant}
                    </div>
                    <div className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                        <span style={{ color: 'var(--text-secondary)' }}>{plantRow.base}</span>
                        {plantRow.sent.length > 0 && (
                            <span style={{ color: SENT_COLOR, fontWeight: 700 }}>-{plantRow.sent.length}</span>
                        )}
                        {plantRow.recv.length > 0 && (
                            <span style={{ color: RECV_COLOR, fontWeight: 700 }}>+{plantRow.recv.length}</span>
                        )}
                    </div>
                </div>
            </div>
            {pourRate.yph !== null && (
                <div
                    className="mt-1 text-[9px] font-bold rounded-full px-1.5 py-px self-start"
                    style={{
                        background: pourRate.overMax ? '#ef444418' : `${HOME_COLOR}14`,
                        color: pourRate.overMax ? '#ef4444' : HOME_COLOR
                    }}
                >
                    {pourRate.yph} yph
                </div>
            )}
        </div>
    )
}

function HourGridLine({ idx }) {
    const hour = TIMELINE_START_HOUR + idx
    const isMajor = hour % 2 === 0
    const isWork = hour >= SHIFT_START_HOUR && hour <= SHIFT_END_HOUR
    return (
        <div
            className="absolute top-0 bottom-0"
            style={{
                background: 'var(--border-light)',
                left: `${(idx / TIMELINE_HOURS) * 100}%`,
                opacity: isMajor ? 0.6 : isWork ? 0.25 : 0.1,
                width: 1
            }}
        />
    )
}

function ShiftTint({ accentColor }) {
    return (
        <div
            className="absolute inset-y-0 pointer-events-none"
            style={{
                background: `${accentColor}05`,
                left: `${((SHIFT_START_HOUR - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100}%`,
                width: `${((SHIFT_END_HOUR - SHIFT_START_HOUR) / TIMELINE_HOURS) * 100}%`
            }}
        />
    )
}

function SentRecvSeparator({ offsetTop }) {
    return (
        <div
            className="absolute left-0 right-0"
            style={{
                background:
                    'repeating-linear-gradient(90deg, var(--border-medium) 0, var(--border-medium) 4px, transparent 4px, transparent 8px)',
                height: 1,
                opacity: 0.7,
                top: offsetTop
            }}
        />
    )
}

function NowVerticalLine({ nowPct }) {
    return (
        <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ background: '#dc2626', left: `${nowPct}%`, opacity: 0.6, width: 2 }}
        />
    )
}

function HomeLane({ effectiveOps, endPct, hasProd, overMax, prod, recvCount, startPct, yds }) {
    const barLeft = hasProd ? startPct : 1
    const barWidth = hasProd ? endPct - startPct : 98
    const blockHeight = ROW_HEIGHT - 8
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
                    height: blockHeight,
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
                            style={{ background: `${HOME_COLOR}15`, color: HOME_COLOR }}
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

function buildLaneGeometry(lane, laneIdx, homeOffset) {
    const clockInPct = timeToPercent(lane.clockIn)
    const preTripEndPct = timeToPercent(lane.preTripEnd)
    const arrivePct = timeToPercent(lane.arriveTime)
    const leavePct = timeToPercent(lane.leaveTime)
    const returnEndPct = timeToPercent(lane.returnEnd)
    const top = (laneIdx + homeOffset) * ROW_HEIGHT + 5
    const blockHeight = ROW_HEIGHT - 10
    const preWidth = clockInPct != null && preTripEndPct != null ? Math.max(preTripEndPct - clockInPct, 0) : 0
    const travelWidth =
        lane.hasTravelTime && preTripEndPct != null && arrivePct != null ? Math.max(arrivePct - preTripEndPct, 0) : 0
    const siteStart = arrivePct ?? preTripEndPct ?? clockInPct
    const siteEnd = leavePct ?? (siteStart != null ? Math.min(siteStart + 2, 100) : null)
    const siteWidth = siteStart != null && siteEnd != null ? Math.max(siteEnd - siteStart, 1) : 0
    const returnWidth = leavePct != null && returnEndPct != null ? Math.max(returnEndPct - leavePct, 0) : 0
    return {
        arrivePct,
        blockHeight,
        clockInPct,
        leavePct,
        preTripEndPct,
        preWidth,
        returnEndPct,
        returnWidth,
        siteEnd,
        siteStart,
        siteWidth,
        top,
        travelWidth
    }
}

function buildLaneTooltip(lane, isSent) {
    return [
        isSent ? `→ ${lane.toPlant}` : `← ${lane.fromPlant}`,
        lane.clockIn && `clock ${lane.clockIn}`,
        lane.arriveTime && `arrive ${lane.arriveTime}`,
        lane.leaveTime && `leave ${lane.leaveTime}`,
        lane.travel != null && `${lane.travel}m travel`
    ]
        .filter(Boolean)
        .join(' · ')
}

function MiniBlock({ homeOffset, isSent, lane, laneIdx }) {
    const blockColor = isSent ? SENT_COLOR : RECV_COLOR
    const tooltip = buildLaneTooltip(lane, isSent)
    const routeLabel = isSent ? `→${lane.toPlant}` : `←${lane.fromPlant}`
    const geom = buildLaneGeometry(lane, laneIdx, homeOffset)

    return (
        <>
            {geom.clockInPct != null && geom.siteStart != null && (
                <div
                    className="absolute pointer-events-none"
                    style={{
                        background: `${blockColor}40`,
                        height: 1,
                        left: `${geom.clockInPct}%`,
                        top: geom.top + geom.blockHeight / 2 - 0.5,
                        width: `${(geom.returnEndPct ?? geom.siteStart + geom.siteWidth) - geom.clockInPct}%`
                    }}
                />
            )}
            {geom.preWidth > 0 && <PreTripBlock blockColor={blockColor} geom={geom} tooltip={tooltip} />}
            {geom.travelWidth > 0 && <TravelBlock blockColor={blockColor} geom={geom} lane={lane} tooltip={tooltip} />}
            {geom.siteWidth > 0 && geom.siteStart != null && (
                <OnSiteBlock
                    blockColor={blockColor}
                    geom={geom}
                    lane={lane}
                    routeLabel={routeLabel}
                    tooltip={tooltip}
                />
            )}
            {geom.returnWidth > 0 && <ReturnBlock blockColor={blockColor} geom={geom} lane={lane} tooltip={tooltip} />}
        </>
    )
}

function PreTripBlock({ blockColor, geom, tooltip }) {
    return (
        <div
            className="absolute rounded-sm flex items-center justify-center"
            title={tooltip}
            style={{
                background: `${blockColor}24`,
                borderLeft: `3px solid ${blockColor}`,
                height: geom.blockHeight,
                left: `${geom.clockInPct}%`,
                minWidth: 6,
                top: geom.top,
                width: `${geom.preWidth}%`
            }}
        >
            {geom.preWidth > 1.5 && (
                <span className="text-[8px] font-bold uppercase" style={{ color: `${blockColor}C0` }}>
                    PT
                </span>
            )}
        </div>
    )
}

function TravelBlock({ blockColor, geom, lane, tooltip }) {
    return (
        <div
            className="absolute flex items-center justify-center"
            title={tooltip}
            style={{
                background: `${blockColor}12`,
                border: `1px dashed ${blockColor}60`,
                borderRadius: 3,
                height: geom.blockHeight - 4,
                left: `${geom.preTripEndPct}%`,
                minWidth: 6,
                top: geom.top + 2,
                width: `${geom.travelWidth}%`
            }}
        >
            {geom.travelWidth > 2.5 && (
                <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: `${blockColor}C0` }}>
                    <i className="fas fa-route text-[7px] mr-0.5" />
                    {lane.travel}m
                </span>
            )}
        </div>
    )
}

function OnSiteBlock({ blockColor, geom, lane, routeLabel, tooltip }) {
    return (
        <div
            className="absolute flex items-center"
            title={tooltip}
            style={{
                background: blockColor,
                borderRadius: geom.returnWidth > 0 ? '4px 0 0 4px' : 4,
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                height: geom.blockHeight,
                left: `${geom.siteStart}%`,
                minWidth: 10,
                top: geom.top,
                width: `${geom.siteWidth}%`
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
    )
}

function ReturnBlock({ blockColor, geom, lane, tooltip }) {
    return (
        <div
            className="absolute flex items-center justify-center"
            title={tooltip}
            style={{
                background: `${blockColor}12`,
                border: `1px dashed ${blockColor}60`,
                borderLeft: 'none',
                borderRadius: '0 3px 3px 0',
                height: geom.blockHeight - 4,
                left: `${geom.leavePct}%`,
                minWidth: 6,
                top: geom.top + 2,
                width: `${geom.returnWidth}%`
            }}
        >
            {geom.returnWidth > 2.5 && (
                <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: `${blockColor}C0` }}>
                    <i className="fas fa-rotate-left text-[7px] mr-0.5" />
                    {lane.travel}m
                </span>
            )}
        </div>
    )
}

PlanMiniTimelineRow.HOME_COLOR = HOME_COLOR
PlanMiniTimelineRow.SENT_COLOR = SENT_COLOR
PlanMiniTimelineRow.RECV_COLOR = RECV_COLOR
