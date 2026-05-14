import React from 'react'

import { getTodayDate } from '../../../../../utils/PlanUtility'

const SCHEDULE_STALE_THRESHOLD_MS = 30 * 60 * 1000

/** Format a Date as e.g. "Apr 27, 4:32 PM" — matches the on-screen date
 *  pill so the banner reads in the same visual language as the rest of
 *  the header. */
const formatTimestamp = (date) =>
    date.toLocaleString([], {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short'
    })

/**
 * Stale-schedule warning banner shown above the active tab in two flavors:
 *
 *  - **Past plan date** → records are frozen; the bucket never updates a
 *    past day's HTML, so phrase the banner as historical context, not as
 *    an alert ("This date is in the past — records have not been
 *    updated…").
 *  - **Today / future** → the dispatch workstation pushes a fresh HTML
 *    every 5 min; if we haven't seen an upload in 30+ min, the
 *    workstation / Tampermonkey is likely offline.
 *
 * Returns null when the schedule is fresh AND the date isn't in the past
 * — nothing to surface in the happy path.
 */
export function PlanScheduleStaleBanner({ planDate, scheduleFileUpdatedAt }) {
    if (!scheduleFileUpdatedAt) return null
    const todayIso = getTodayDate()
    const isPastDate = !!planDate && planDate < todayIso
    const isStale = Date.now() - scheduleFileUpdatedAt.getTime() > SCHEDULE_STALE_THRESHOLD_MS
    if (!isPastDate && !isStale) return null
    const formattedTimestamp = formatTimestamp(scheduleFileUpdatedAt)
    return (
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b shrink-0 bg-[rgba(245,_158,_11,_0.12)] border-[rgba(245,_158,_11,_0.4)] text-text-primary">
            <i
                className={`fas ${isPastDate ? 'fa-clock-rotate-left' : 'fa-triangle-exclamation'} text-[11px] text-amber-600`}
            />
            <span>
                {isPastDate ? (
                    <>This date is in the past — records have not been updated since {formattedTimestamp}.</>
                ) : (
                    <>
                        Schedule hasn&apos;t been updated since {formattedTimestamp} — dispatch workstation may be
                        offline.
                    </>
                )}
            </span>
        </div>
    )
}
