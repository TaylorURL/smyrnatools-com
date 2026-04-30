import React from 'react'

import { minutesToTime } from '../../../utils/PlanUtility'

const SCRUB_MIN_MINUTES = 0
const SCRUB_MAX_MINUTES = 24 * 60 - 1
const SCRUB_STEP_MINUTES = 15
const SCRUB_DEFAULT_MINUTES = 12 * 60

/**
 * 24-hour horizontal slider that drives the point-in-time "needs help"
 * view. Sticky below the main toolbar. `viewTime` is minutes since
 * midnight (or null for the whole-day view).
 */
export function PlanFlowTimeScrubber({ accentColor, hasActivity, onChange, viewTime }) {
    const isActive = Number.isFinite(viewTime)
    const displayValue = isActive ? viewTime : SCRUB_DEFAULT_MINUTES
    const clockLabel = isActive ? minutesToTime(displayValue) : 'All day'
    const activityNote = !isActive
        ? null
        : hasActivity === 0
          ? 'No plants active at this time'
          : `${hasActivity} plant${hasActivity === 1 ? '' : 's'} actively pouring`

    const handleToggle = () => onChange(isActive ? null : SCRUB_DEFAULT_MINUTES)
    const handleSlide = (event) => onChange(parseInt(event.target.value, 10))

    return (
        <div className="sticky z-20 flex justify-center px-4 pb-3 pointer-events-none" style={{ top: '60px' }}>
            <div
                className="pointer-events-auto w-full max-w-2xl rounded-lg flex items-center gap-3 px-3 py-2"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <button
                    type="button"
                    onClick={handleToggle}
                    className="border-none rounded cursor-pointer px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                        background: isActive ? accentColor : 'var(--bg-secondary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)'
                    }}
                    title={isActive ? 'Return to whole-day view' : 'Enable point-in-time view'}
                >
                    <i className={`fas ${isActive ? 'fa-clock' : 'fa-calendar-day'} mr-1 text-[9px]`} />
                    {isActive ? 'At time' : 'All day'}
                </button>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    <input
                        type="range"
                        min={SCRUB_MIN_MINUTES}
                        max={SCRUB_MAX_MINUTES}
                        step={SCRUB_STEP_MINUTES}
                        value={displayValue}
                        onChange={handleSlide}
                        className="flex-1"
                        style={{ accentColor }}
                        title={isActive ? `Viewing ${clockLabel}` : 'Drag to pick a time'}
                    />
                    <div
                        className="font-mono font-bold text-[13px] shrink-0 min-w-[62px] text-right"
                        style={{ color: isActive ? accentColor : 'var(--text-tertiary)' }}
                    >
                        {clockLabel}
                    </div>
                </div>
                {isActive && activityNote && (
                    <span
                        className="text-[10.5px] font-semibold whitespace-nowrap hidden sm:inline"
                        style={{ color: hasActivity === 0 ? 'var(--text-tertiary)' : '#16a34a' }}
                    >
                        <i className={`fas ${hasActivity === 0 ? 'fa-moon' : 'fa-truck'} mr-1 text-[9px]`} />
                        {activityNote}
                    </span>
                )}
            </div>
        </div>
    )
}
