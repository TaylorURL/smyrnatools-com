/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { minutesToTime, timeToMinutes } from '../../../../../utils/PlanUtility'
import { SELECTED_FILL_COLOR } from '../../../../../views/tools/plan/flow-map/flowMapShared'
import { MilitaryTimeInput } from '../../../common/MilitaryTimeInput'

const SCRUB_MIN_MINUTES = 0
const SCRUB_MAX_MINUTES = 24 * 60 - 1
const SCRUB_STEP_MINUTES = 5

/* Waypoint icons spaced across the 24-hour track so the user reads
 * "morning / noon / evening / night" at a glance without having to look
 * at the numeric labels. Positions are percentages along the slider. */
const WAYPOINTS = [
    { hour: 6, icon: 'fa-mug-saucer', label: 'Morning' },
    { hour: 12, icon: 'fa-sun', label: 'Noon' },
    { hour: 18, icon: 'fa-cloud-sun', label: 'Evening' },
    { hour: 22, icon: 'fa-moon', label: 'Night' }
]

const HOUR_LABEL_TICKS = [0, 6, 12, 18, 24]

/**
 * 24-hour horizontal scrubber that drives the point-in-time view. Lives
 * in the bottom-right of the Planner map (flush against the corner so it
 * sits over the Leaflet attribution watermark). The play button cycles
 * through the day; the slider and the typeable time input both round-trip
 * through the same `onChange(minutes)` so dragging, typing, or autoplay
 * advance the cycle identically.
 *
 * Visual treatment is intentionally aligned with `DashboardView` / the
 * Operations header chrome — solid `bg-bg-primary`, flat 1px border, small
 * radius, no backdrop blur, no lifted shadows, no gradient/pulse glow on
 * the play button. The dock keeps the corner-flush position so the
 * Leaflet attribution stays covered by the scrubber's footprint.
 */
export function PlanFlowTimeScrubber({ hasActivity, isPlaying, onChange, onPlayToggle, viewTime }) {
    const displayValue = Number.isFinite(viewTime) ? viewTime : 0
    const clockLabel = minutesToTime(displayValue)
    const [hourPart, minutePart] = clockLabel.split(':')
    const progressPercent = (displayValue / SCRUB_MAX_MINUTES) * 100

    /* `hasActivity` is null while the parent is still loading derived
     * stats; we suppress the pill in that case to avoid a "0 plants"
     * flicker on mount. */
    const activityLabel = useMemo(() => {
        if (hasActivity == null) return null
        if (hasActivity === 0) return 'No plants active'
        return `${hasActivity} plant${hasActivity === 1 ? '' : 's'} pouring`
    }, [hasActivity])
    const activityActive = hasActivity != null && hasActivity > 0

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
            className="pf-scrubber pointer-events-auto flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-tl-md bg-bg-primary border-l border-t border-border-light shadow-card sm:min-w-[440px]"
        >
            {onPlayToggle && (
                <button type="button"
                    onClick={onPlayToggle}
                    className={`shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center border cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${isPlaying ? 'border-transparent text-white' : 'border-border-light bg-bg-secondary text-text-primary hover:bg-bg-hover'}`}
                    style={isPlaying ? { background: SELECTED_FILL_COLOR } : undefined}
                    title={isPlaying ? 'Pause cycle' : 'Cycle through the day'}
                    aria-label={isPlaying ? 'Pause cycle' : 'Play cycle'}
                >
                    <i
                        aria-hidden="true"
                        className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-[11px]`}
                        style={isPlaying ? undefined : { marginLeft: 1 }}
                    />
                </button>
            )}

            <div className="shrink-0 flex items-baseline gap-0.5 select-none relative">
                <span className="font-mono font-bold tabular-nums text-[15px] leading-none text-text-primary">
                    {hourPart}
                </span>
                <span className="font-mono font-bold text-[13px] leading-none text-text-tertiary">:</span>
                <span className="font-mono font-bold tabular-nums text-[15px] leading-none text-text-primary">
                    {minutePart}
                </span>
                <MilitaryTimeInput
                    ariaLabel="Jump to time (HH:MM, 24-hour)"
                    compact
                    extraClass="w-0 h-0 opacity-0 absolute pointer-events-none"
                    onChange={handleTypedTime}
                    value={clockLabel}
                />
            </div>

            <div className="flex-1 flex flex-col min-w-0 gap-1">
                <div className="relative h-5">
                    <div
                        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-bg-tertiary"
                        aria-hidden="true"
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
                        style={{ background: SELECTED_FILL_COLOR, width: `${progressPercent}%` }}
                        aria-hidden="true"
                    />
                    {WAYPOINTS.map((wp) => {
                        const left = ((wp.hour * 60) / SCRUB_MAX_MINUTES) * 100
                        const reached = displayValue >= wp.hour * 60
                        return (
                            <span
                                key={wp.hour}
                                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[9px] transition-colors duration-150 ${reached ? 'text-text-primary opacity-90' : 'text-text-tertiary opacity-55'}`}
                                style={{ left: `${left}%` }}
                                title={wp.label}
                            >
                                <i aria-hidden="true" className={`fas ${wp.icon}`} />
                            </span>
                        )
                    })}
                    <input
                        type="range"
                        min={SCRUB_MIN_MINUTES}
                        max={SCRUB_MAX_MINUTES}
                        step={SCRUB_STEP_MINUTES}
                        value={displayValue}
                        onChange={handleSlide}
                        className="pf-scrubber-input absolute inset-0 w-full h-full m-0 p-0 cursor-grab active:cursor-grabbing"
                        style={{ accentColor: SELECTED_FILL_COLOR }}
                        title={`Viewing ${clockLabel}`}
                    />
                </div>
                <div className="relative h-2.5 select-none">
                    {HOUR_LABEL_TICKS.map((h) => {
                        const left = h === 24 ? 100 : ((h * 60) / SCRUB_MAX_MINUTES) * 100
                        const label =
                            h === 0 ? '12a' : h === 12 ? '12p' : h === 24 ? '12a' : h > 12 ? `${h - 12}p` : `${h}a`
                        return (
                            <span
                                key={h}
                                className="absolute -translate-x-1/2 text-[9px] font-semibold tabular-nums text-text-tertiary"
                                style={{ left: `${left}%`, top: 0 }}
                            >
                                {label}
                            </span>
                        )
                    })}
                </div>
            </div>

            {activityLabel && (
                <span
                    className={`hidden sm:inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold whitespace-nowrap shrink-0 border transition-colors duration-150 ${activityActive ? 'border-border-light bg-bg-secondary text-text-primary' : 'border-border-light bg-bg-secondary text-text-tertiary'}`}
                >
                    <span
                        aria-hidden="true"
                        className="inline-block w-1.5 h-1.5 rounded-sm"
                        style={{ background: activityActive ? '#16a34a' : 'var(--text-tertiary)' }}
                    />
                    {activityLabel}
                </span>
            )}

            {/* Slider thumb cross-browser styling — Tailwind can't reach
             *  `::-webkit-slider-thumb` / `::-moz-range-thumb`, so a tiny
             *  scoped style block stays. Matches the Dashboard input
             *  treatment: small circle, accent border, bg-primary fill. */}
            <style>{`
                .pf-scrubber-input {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                    outline: none;
                }
                .pf-scrubber-input::-webkit-slider-runnable-track,
                .pf-scrubber-input::-moz-range-track {
                    background: transparent;
                    border: none;
                }
                .pf-scrubber-input::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px; height: 12px;
                    border-radius: 50%;
                    background: var(--bg-primary);
                    border: 2px solid #1e293b;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
                    cursor: grab;
                    margin-top: 0;
                    transition: transform 120ms ease;
                }
                .pf-scrubber-input::-webkit-slider-thumb:hover {
                    transform: scale(1.15);
                }
                .pf-scrubber-input:active::-webkit-slider-thumb {
                    cursor: grabbing;
                    transform: scale(1.2);
                }
                .pf-scrubber-input::-moz-range-thumb {
                    width: 12px; height: 12px;
                    border-radius: 50%;
                    background: var(--bg-primary);
                    border: 2px solid currentColor;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
                    cursor: grab;
                    transition: transform 120ms ease;
                }
                .pf-scrubber-input::-moz-range-thumb:hover {
                    transform: scale(1.15);
                }
            `}</style>
        </div>
    )
}
