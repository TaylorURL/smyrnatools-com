import React from 'react'

import { timeToPercent } from '../../../utils/PlanUtility'

const ROW_HEIGHT = 36

const SENT_COLOR = '#c2703a'
const RECV_COLOR = '#3b7dd8'

const ARROW_RIGHT = '→'
const ARROW_LEFT = '←'

function buildBlockGeometry(lane, laneIdx, homeOffset) {
    const clockInPct = timeToPercent(lane.clockIn)
    const preTripEndPct = timeToPercent(lane.preTripEnd)
    const arrivePct = timeToPercent(lane.arriveTime)
    const leavePct = timeToPercent(lane.leaveTime)
    const returnEndPct = timeToPercent(lane.returnEnd)
    const top = (laneIdx + homeOffset) * ROW_HEIGHT + 3
    const blockHeight = ROW_HEIGHT - 6
    const preWidth = clockInPct != null && preTripEndPct != null ? Math.max(preTripEndPct - clockInPct, 0) : 0
    const travelWidth =
        lane.hasTravelTime && preTripEndPct != null && arrivePct != null ? Math.max(arrivePct - preTripEndPct, 0) : 0
    const siteStart = arrivePct ?? preTripEndPct ?? clockInPct
    const siteEnd = leavePct ?? (siteStart != null ? Math.min(siteStart + 2, 100) : null)
    const siteWidth = siteStart != null && siteEnd != null ? Math.max(siteEnd - siteStart, 0.8) : 0
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
        siteStart,
        siteWidth,
        top,
        travelWidth
    }
}

/**
 * Render a single lane (one operator's day) inside a Plan timeline row.
 * Composed of up to four pieces drawn at percentage offsets along the
 * day's horizontal axis: pre-trip, travel, on-site pill, return travel.
 */
export function PlanTimelineLaneBlock({ homeOffset, isSent, lane, laneIdx }) {
    const blockColor = isSent ? SENT_COLOR : RECV_COLOR
    const dirIcon = isSent ? 'fa-arrow-right-from-bracket' : 'fa-arrow-right-to-bracket'
    const routeLabel = isSent ? `${ARROW_RIGHT} ${lane.toPlant}` : `${ARROW_LEFT} ${lane.fromPlant}`
    const geom = buildBlockGeometry(lane, laneIdx, homeOffset)

    return (
        <>
            {geom.clockInPct != null && geom.siteStart != null && (geom.preWidth > 0 || geom.travelWidth > 0) && (
                <ConnectorLine blockColor={blockColor} geom={geom} />
            )}
            {geom.preWidth > 0 && <PreTripBlock blockColor={blockColor} geom={geom} />}
            {geom.travelWidth > 0 && <TravelBlock blockColor={blockColor} geom={geom} lane={lane} />}
            {geom.siteWidth > 0 && geom.siteStart != null && (
                <OnSiteBlock
                    blockColor={blockColor}
                    dirIcon={dirIcon}
                    geom={geom}
                    lane={lane}
                    routeLabel={routeLabel}
                />
            )}
            {geom.returnWidth > 0 && <ReturnBlock blockColor={blockColor} geom={geom} lane={lane} />}
        </>
    )
}

function ConnectorLine({ blockColor, geom }) {
    return (
        <div
            className="absolute pointer-events-none"
            style={{
                background: `${blockColor}30`,
                height: 2,
                left: `${geom.clockInPct}%`,
                top: geom.top + geom.blockHeight / 2 - 1,
                width: `${(geom.returnEndPct ?? geom.siteStart + geom.siteWidth) - geom.clockInPct}%`
            }}
        />
    )
}

function PreTripBlock({ blockColor, geom }) {
    return (
        <div
            className="absolute rounded-sm flex items-center justify-center overflow-visible"
            style={{
                background: `${blockColor}18`,
                borderLeft: `3px solid ${blockColor}80`,
                height: geom.blockHeight,
                left: `${geom.clockInPct}%`,
                minWidth: 8,
                top: geom.top,
                width: `${geom.preWidth}%`
            }}
        >
            <span
                className="text-[8px] font-bold whitespace-nowrap px-0.5 uppercase"
                style={{ color: `${blockColor}90` }}
            >
                PT
            </span>
        </div>
    )
}

function TravelBlock({ blockColor, geom, lane }) {
    return (
        <div
            className="absolute flex items-center justify-center overflow-visible"
            style={{
                background: `${blockColor}20`,
                border: `1px dashed ${blockColor}50`,
                borderRadius: 3,
                height: geom.blockHeight - 4,
                left: `${geom.preTripEndPct}%`,
                minWidth: 8,
                top: geom.top + 2,
                width: `${geom.travelWidth}%`
            }}
        >
            <span className="text-[8px] font-semibold whitespace-nowrap px-1" style={{ color: `${blockColor}BB` }}>
                <i className="fas fa-route text-[7px] mr-0.5" />
                {lane.travel}m
            </span>
        </div>
    )
}

function OnSiteBlock({ blockColor, dirIcon, geom, lane, routeLabel }) {
    return (
        <div
            className="absolute flex items-center overflow-visible"
            style={{
                background: blockColor,
                borderRadius: geom.returnWidth > 0 ? '4px 0 0 4px' : 4,
                boxShadow: `0 1px 3px ${blockColor}40`,
                height: geom.blockHeight,
                left: `${geom.siteStart}%`,
                top: geom.top,
                width: `${geom.siteWidth}%`
            }}
        >
            <span className="text-[9px] font-bold text-white px-1.5 whitespace-nowrap flex items-center gap-1">
                <i className={`fas ${dirIcon} text-[7px] opacity-70`} />
                {routeLabel} {lane.arriveTime}
                {lane.leaveTime ? `–${lane.leaveTime}` : ''}
                {lane.loadFromPlant ? ' LD' : ''}
            </span>
        </div>
    )
}

function ReturnBlock({ blockColor, geom, lane }) {
    return (
        <div
            className="absolute flex items-center justify-center overflow-visible"
            style={{
                background: `${blockColor}20`,
                border: `1px dashed ${blockColor}50`,
                borderLeft: 'none',
                borderRadius: '0 3px 3px 0',
                height: geom.blockHeight - 4,
                left: `${geom.leavePct}%`,
                minWidth: 8,
                top: geom.top + 2,
                width: `${geom.returnWidth}%`
            }}
        >
            <span className="text-[8px] font-semibold whitespace-nowrap px-1" style={{ color: `${blockColor}BB` }}>
                <i className="fas fa-rotate-left text-[7px] mr-0.5" />
                {lane.travel}m
            </span>
        </div>
    )
}

PlanTimelineLaneBlock.HOME_COLOR = '#2d8659'
PlanTimelineLaneBlock.RECV_COLOR = RECV_COLOR
PlanTimelineLaneBlock.ROW_HEIGHT = ROW_HEIGHT
PlanTimelineLaneBlock.SENT_COLOR = SENT_COLOR
