import React from 'react'

import { getTomorrowDate, offsetDateSkipSunday, skipSundayDate } from '../../../utils/PlanUtility'

/** Display variant for the realtime tab — date is locked to today and
 *  rendered as a read-only pill. Switching to realtime always anchors the
 *  page to "right now," so a date selector would be misleading. */
function RealtimeDatePill({ accentColor, isDark, planDate }) {
    return (
        <div
            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-2.5 py-1"
            style={{ backgroundColor: `${accentColor}${isDark ? '30' : '15'}`, color: accentColor }}
            title="Realtime is locked to today"
        >
            <i className="fas fa-circle-dot text-[10px]" />
            <span>
                Today ·{' '}
                {new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short'
                })}
            </span>
        </div>
    )
}

/** Compact prev / picker / next cluster used on every non-realtime tab. */
function DateStepper({ accentColor, isDark, onChange, planDate }) {
    return (
        <div
            className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1.5 py-1"
            style={{ backgroundColor: `${accentColor}${isDark ? '30' : '15'}`, color: accentColor }}
        >
            <button
                onClick={() => onChange(offsetDateSkipSunday(planDate, -1))}
                className="border-none bg-transparent cursor-pointer p-1 rounded hover:opacity-80"
                style={{ color: accentColor }}
                title="Previous day"
            >
                <i className="fas fa-chevron-left text-xs" />
            </button>
            <button
                className="relative border-none bg-transparent cursor-pointer px-2 py-0.5 rounded font-semibold text-sm"
                style={{ color: accentColor }}
                title="Click to pick date"
            >
                {new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short'
                })}
                <input
                    type="date"
                    value={planDate}
                    onChange={(e) => e.target.value && onChange(skipSundayDate(e.target.value, 1))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ width: '100%', height: '100%' }}
                />
            </button>
            <button
                onClick={() => onChange(offsetDateSkipSunday(planDate, 1))}
                className="border-none bg-transparent cursor-pointer p-1 rounded hover:opacity-80"
                style={{ color: accentColor }}
                title="Next day"
            >
                <i className="fas fa-chevron-right text-xs" />
            </button>
        </div>
    )
}

/** "Tomorrow" shortcut button — highlights when planDate matches tomorrow
 *  (Sunday-skipped to Monday) so it acts like a tab/toggle, not just a
 *  one-shot action. */
function TomorrowButton({ accentColor, isDark, onChange, planDate }) {
    const tomorrowTarget = skipSundayDate(getTomorrowDate(), 1)
    const isTomorrow = planDate === tomorrowTarget
    return (
        <button
            onClick={() => onChange(tomorrowTarget)}
            className="border-none rounded-lg cursor-pointer text-xs font-semibold px-2.5 py-1.5"
            style={{
                background: isTomorrow ? `${accentColor}${isDark ? '30' : '15'}` : 'var(--bg-tertiary)',
                color: isTomorrow ? accentColor : 'var(--text-secondary)'
            }}
        >
            Tomorrow
        </button>
    )
}

/**
 * Date controls in the Plan header. Realtime tab gets a read-only pill;
 * every other tab gets a prev/picker/next stepper plus a "Tomorrow"
 * shortcut. All paths route through `skipSundayDate` so the user can
 * never land on a closed-plant Sunday.
 */
export function PlanDateNav({ accentColor, isDark, isRealtime, onChange, planDate }) {
    if (isRealtime) {
        return <RealtimeDatePill accentColor={accentColor} isDark={isDark} planDate={planDate} />
    }
    return (
        <>
            <DateStepper accentColor={accentColor} isDark={isDark} onChange={onChange} planDate={planDate} />
            <TomorrowButton accentColor={accentColor} isDark={isDark} onChange={onChange} planDate={planDate} />
        </>
    )
}
