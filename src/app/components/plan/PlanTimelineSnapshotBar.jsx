import React from 'react'

const formatDayLabel = (dateStr) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })

/**
 * Cursor-driven snapshot strip at the top of the timeline. Shows the time
 * the user clicked and per-plant operator counts split into on-site /
 * transit / idle.
 */
export function PlanTimelineSnapshotBar({ accentColor, cursorDayIdx, cursorTime, days, onClear, plantSnapshot }) {
    if (!cursorTime || plantSnapshot.length === 0) return null
    return (
        <div
            className="shrink-0 flex items-center gap-3 border-b px-4 py-2 flex-wrap"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
        >
            <div className="flex items-center gap-1.5">
                <i className="fas fa-crosshairs text-[10px]" style={{ color: '#ef4444' }} />
                <span className="text-xs font-bold font-mono" style={{ color: '#ef4444' }}>
                    {cursorTime} · {cursorDayIdx !== null && formatDayLabel(days[cursorDayIdx]?.date)}
                </span>
            </div>
            <div className="w-px h-5" style={{ background: 'var(--border-medium)' }} />
            {plantSnapshot.map((plant) => (
                <PlantSnapshotChip key={plant.code} accentColor={accentColor} plant={plant} />
            ))}
            <button
                onClick={onClear}
                className="ml-auto border-none bg-transparent cursor-pointer p-1 text-[10px]"
                style={{ color: 'var(--text-secondary)' }}
            >
                <i className="fas fa-times" />
            </button>
        </div>
    )
}

function PlantSnapshotChip({ accentColor, plant }) {
    return (
        <div
            className="flex items-center gap-1.5 rounded-md px-2 py-1"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {plant.code}
            </span>
            {plant.onSite > 0 && (
                <span className="text-[10px] font-semibold text-[#16a34a]">{plant.onSite} on site</span>
            )}
            {plant.traveling > 0 && (
                <span className="text-[10px] font-semibold" style={{ color: accentColor }}>
                    {plant.traveling} transit
                </span>
            )}
            {plant.idle > 0 && (
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {plant.idle} idle
                </span>
            )}
            {plant.base > 0 && (
                <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                    / {plant.base} mixers
                </span>
            )}
        </div>
    )
}
