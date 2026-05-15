/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { minutesToTime, timeToMinutes } from '../../../../../utils/PlanUtility'
import { MilitaryTimeInput } from '../../../common/MilitaryTimeInput'

const SCRUB_MIN_MINUTES = 0
const SCRUB_MAX_MINUTES = 24 * 60 - 1
const SCRUB_STEP_MINUTES = 5

/**
 * 24-hour horizontal slider that drives the point-in-time view. Mounted
 * flush against the bottom-right corner of the map so it sits on top of
 * the Leaflet attribution watermark — that's why this component carries
 * no outer padding and only rounds the top-left corner. Play / Pause
 * runs the autoplay loop; the parent owns the interval and this
 * component just renders the control surface.
 *
 * The time read-out doubles as a manual editor — type `HH:MM` (or any
 * partial form the `MilitaryTimeInput` resolves on blur) to jump the
 * view straight to that minute. The slider and the input round-trip
 * through the same `onChange(minutes)` so dragging or typing both
 * advance the cycle identically.
 */
export function PlanFlowTimeScrubber({ accentColor, hasActivity, isPlaying, onChange, onPlayToggle, viewTime }) {
    const displayValue = Number.isFinite(viewTime) ? viewTime : 0
    const clockLabel = minutesToTime(displayValue)
    const activityNote =
        hasActivity == null
            ? null
            : hasActivity === 0
              ? 'No plants active at this time'
              : `${hasActivity} plant${hasActivity === 1 ? '' : 's'} actively pouring`

    const handleSlide = (event) => onChange(parseInt(event.target.value, 10))
    const handleTypedTime = (hhmm) => {
        if (!hhmm) return
        const minutes = timeToMinutes(hhmm)
        if (Number.isFinite(minutes) && minutes >= SCRUB_MIN_MINUTES && minutes <= SCRUB_MAX_MINUTES) {
            onChange(minutes)
        }
    }

    return (
        <div
            className="pointer-events-auto flex items-center gap-3 px-3 py-2 rounded-tl-lg bg-bg-primary border-l border-t border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)', minWidth: 420 }}
        >
            {onPlayToggle && (
                <button
                    type="button"
                    onClick={onPlayToggle}
                    className="border-none rounded cursor-pointer w-8 h-8 flex items-center justify-center"
                    style={{
                        background: isPlaying ? accentColor : 'var(--bg-secondary)',
                        color: isPlaying ? '#fff' : 'var(--text-secondary)'
                    }}
                    title={isPlaying ? 'Pause cycle' : 'Cycle through the day'}
                    aria-label={isPlaying ? 'Pause cycle' : 'Play cycle'}
                >
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-[11px]`} />
                </button>
            )}
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
                    title={`Viewing ${clockLabel}`}
                />
                <MilitaryTimeInput
                    ariaLabel="Jump to time (HH:MM, 24-hour)"
                    compact
                    extraClass="w-[68px] text-right font-bold"
                    onChange={handleTypedTime}
                    value={clockLabel}
                />
            </div>
            {activityNote && (
                <span
                    className="text-[10.5px] font-semibold whitespace-nowrap hidden sm:inline"
                    style={{ color: hasActivity === 0 ? 'var(--text-tertiary)' : '#16a34a' }}
                >
                    <i className={`fas ${hasActivity === 0 ? 'fa-moon' : 'fa-truck'} mr-1 text-[9px]`} />
                    {activityNote}
                </span>
            )}
        </div>
    )
}
