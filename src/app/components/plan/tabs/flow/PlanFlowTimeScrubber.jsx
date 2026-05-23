/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { minutesToTime, timeToMinutes } from '../../../../../utils/PlanUtility'
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
 * Visual layout (left to right): play button → big time read-out → slider
 * with hour ticks + waypoint icons → activity pill. The slider track is
 * painted by `--scrub-progress` (a CSS custom property updated inline) so
 * the filled portion lerps with the autoplay tick instead of snapping.
 */
export function PlanFlowTimeScrubber({ accentColor, hasActivity, isPlaying, onChange, onPlayToggle, viewTime }) {
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
            className="pf-scrubber pointer-events-auto flex items-center gap-3 px-3 py-2.5 rounded-tl-xl border-l border-t border-border-light backdrop-blur-md"
            style={{
                background: 'rgba(255, 255, 255, 0.92)',
                boxShadow: '0 -8px 24px -10px rgba(15, 23, 42, 0.18)',
                minWidth: 480
            }}
        >
            {onPlayToggle && (
                <button
                    type="button"
                    onClick={onPlayToggle}
                    className="pf-scrubber-play group relative shrink-0 border-none cursor-pointer flex items-center justify-center rounded-full transition-transform active:scale-90"
                    style={{
                        background: isPlaying ? accentColor : 'var(--bg-secondary)',
                        boxShadow: isPlaying
                            ? `0 0 0 4px ${accentColor}26, 0 4px 12px ${accentColor}55`
                            : '0 2px 6px rgba(15, 23, 42, 0.12)',
                        color: isPlaying ? '#fff' : 'var(--text-secondary)',
                        height: 36,
                        width: 36
                    }}
                    title={isPlaying ? 'Pause cycle' : 'Cycle through the day'}
                    aria-label={isPlaying ? 'Pause cycle' : 'Play cycle'}
                >
                    {isPlaying && (
                        <span
                            className="pf-scrubber-pulse pointer-events-none absolute inset-0 rounded-full"
                            style={{ background: accentColor }}
                            aria-hidden="true"
                        />
                    )}
                    <i
                        className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-[13px] relative`}
                        style={{ marginLeft: isPlaying ? 0 : 2 }}
                    />
                </button>
            )}

            <div className="pf-scrubber-clock shrink-0 flex items-baseline gap-0.5 select-none">
                <span
                    className="font-bold tabular-nums tracking-tight text-text-primary"
                    style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontSize: 22, lineHeight: 1 }}
                >
                    {hourPart}
                </span>
                <span className="text-text-tertiary font-bold" style={{ fontSize: 18, lineHeight: 1 }}>
                    :
                </span>
                <span
                    className="font-bold tabular-nums tracking-tight text-text-primary"
                    style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontSize: 22, lineHeight: 1 }}
                >
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
                <div className="relative h-6">
                    <div
                        className="pf-scrubber-track absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
                        style={{
                            background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${progressPercent}%, var(--bg-tertiary) ${progressPercent}%, var(--bg-tertiary) 100%)`
                        }}
                    />
                    {WAYPOINTS.map((wp) => {
                        const left = ((wp.hour * 60) / SCRUB_MAX_MINUTES) * 100
                        const reached = displayValue >= wp.hour * 60
                        return (
                            <span
                                key={wp.hour}
                                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-colors ${reached ? 'text-text-primary' : 'text-text-tertiary'}`}
                                style={{
                                    fontSize: 9,
                                    left: `${left}%`,
                                    opacity: reached ? 1 : 0.55
                                }}
                                title={wp.label}
                            >
                                <i className={`fas ${wp.icon}`} />
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
                        style={{ accentColor }}
                        title={`Viewing ${clockLabel}`}
                    />
                </div>
                <div className="relative h-3 select-none">
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
                    className={`pf-scrubber-activity hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap shrink-0 transition-colors ${activityActive ? 'text-text-primary' : 'text-text-tertiary'}`}
                    style={{
                        background: activityActive ? 'rgba(22, 163, 74, 0.12)' : 'var(--bg-secondary)'
                    }}
                >
                    {activityActive ? (
                        <span
                            className="pf-scrubber-activity-dot inline-block w-1.5 h-1.5 rounded-full"
                            style={{ background: '#16a34a' }}
                            aria-hidden="true"
                        />
                    ) : (
                        <i className="fas fa-moon text-[9px]" aria-hidden="true" />
                    )}
                    {activityLabel}
                </span>
            )}

            <style>{`
                html.dark .pf-scrubber {
                    background: rgba(15, 23, 42, 0.92) !important;
                }
                .pf-scrubber-pulse {
                    animation: pf-scrubber-pulse 1.6s ease-in-out infinite;
                    opacity: 0;
                }
                @keyframes pf-scrubber-pulse {
                    0%   { transform: scale(1); opacity: 0.35; }
                    70%  { transform: scale(1.6); opacity: 0; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                .pf-scrubber-activity-dot {
                    animation: pf-scrubber-activity-dot 1.4s ease-in-out infinite;
                    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6);
                }
                @keyframes pf-scrubber-activity-dot {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6); }
                    50%      { box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
                }
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
                    width: 16px; height: 16px;
                    border-radius: 50%;
                    background: var(--bg-primary);
                    border: 2px solid var(--accent, currentColor);
                    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
                    cursor: grab;
                    margin-top: 0;
                    transition: transform 120ms ease;
                }
                .pf-scrubber-input::-webkit-slider-thumb:hover {
                    transform: scale(1.18);
                }
                .pf-scrubber-input:active::-webkit-slider-thumb {
                    cursor: grabbing;
                    transform: scale(1.25);
                }
                .pf-scrubber-input::-moz-range-thumb {
                    width: 16px; height: 16px;
                    border-radius: 50%;
                    background: var(--bg-primary);
                    border: 2px solid currentColor;
                    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
                    cursor: grab;
                    transition: transform 120ms ease;
                }
                .pf-scrubber-input::-moz-range-thumb:hover {
                    transform: scale(1.18);
                }
            `}</style>
        </div>
    )
}
