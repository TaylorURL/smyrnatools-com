import React, { useEffect, useState } from 'react'

import { TIMELINE_HOURS, TIMELINE_START_HOUR } from '../../../utils/PlanUtility'
import { usePlanMiniTimelineRows } from '../../hooks/usePlanMiniTimelineRows'
import { PlanMiniTimelineHeader } from './PlanMiniTimelineHeader'
import { PlanMiniTimelineRow } from './PlanMiniTimelineRow'

const NOW_TICK_INTERVAL_MS = 60 * 1000
const { HOME_COLOR, SENT_COLOR, RECV_COLOR } = PlanMiniTimelineRow

/**
 * Compact, Gantt-style preview of a day's mixer movements: one row per plant,
 * lanes split into "home / sent / received" stacks with per-driver blocks
 * showing pre-trip, travel, on-site, and return segments. Used as the
 * Dashboard-card peek of the full Schedule view.
 */
export default function PlanMiniTimeline({
    accentColor,
    assignments,
    getTravelTime,
    mixerCountsByPlant,
    plantProduction
}) {
    const { allLanes, hourLabels, miniPlantRows } = usePlanMiniTimelineRows({
        assignments,
        getTravelTime,
        mixerCountsByPlant
    })
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(new Date()), NOW_TICK_INTERVAL_MS)
        return () => window.clearInterval(intervalId)
    }, [])

    const nowPct = computeNowPercent(now)

    if (allLanes.length === 0) return <PlanMiniTimelineEmptyState />

    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <PlanMiniTimelineLegend laneCount={allLanes.length} plantCount={miniPlantRows.length} />
            <PlanMiniTimelineHeader hourLabels={hourLabels} now={now} nowPct={nowPct} />
            {miniPlantRows.map((plantRow, idx) => (
                <PlanMiniTimelineRow
                    key={plantRow.plant}
                    accentColor={accentColor}
                    hourLabels={hourLabels}
                    isLast={idx === miniPlantRows.length - 1}
                    nowPct={nowPct}
                    plantProduction={plantProduction}
                    plantRow={plantRow}
                    rowIndex={idx}
                />
            ))}
        </div>
    )
}

function computeNowPercent(now) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = TIMELINE_START_HOUR * 60
    const totalMinutes = TIMELINE_HOURS * 60
    if (nowMinutes < startMinutes || nowMinutes > startMinutes + totalMinutes) return null
    return ((nowMinutes - startMinutes) / totalMinutes) * 100
}

function PlanMiniTimelineEmptyState() {
    return (
        <div className="text-[12px] py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-chart-gantt text-2xl mb-2 opacity-50 block" />
            Add assignments with times to see the timeline
        </div>
    )
}

function PlanMiniTimelineLegend({ laneCount, plantCount }) {
    return (
        <div
            className="flex items-center gap-4 px-4 py-2 text-[10px] font-semibold"
            style={{
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-light)',
                color: 'var(--text-secondary)'
            }}
        >
            <LegendSwatch color={HOME_COLOR} label="On-site (home)" />
            <LegendSwatch color={SENT_COLOR} label="Sent out" />
            <LegendSwatch color={RECV_COLOR} label="Received" />
            <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5" style={{ background: '#dc2626' }} />
                Now
            </span>
            <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {laneCount} lane{laneCount === 1 ? '' : 's'} · {plantCount} plants
            </span>
        </div>
    )
}

function LegendSwatch({ color, label }) {
    return (
        <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
            {label}
        </span>
    )
}
