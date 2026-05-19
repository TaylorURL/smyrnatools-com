/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

const CHICAGO_TIME_ZONE = 'America/Chicago'
const REVIEW_SEND_OPEN_HOUR_CT = 16
const REVIEW_SEND_CLOSE_HOUR_CT = 18

/** Refresh button — disables itself while a sync is already in flight
 *  so the user can't queue overlapping fetches. */
function RefreshButton({ isMobile, isSyncing, lastSyncedAt, onRefresh }) {
    const title = lastSyncedAt ? `Last updated ${lastSyncedAt.toLocaleTimeString()}` : 'Refresh schedule'
    return (
        <button
            onClick={() => onRefresh?.()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-60 bg-bg-tertiary text-text-secondary"
            title={title}
        >
            <i className={`fas fa-rotate ${isSyncing ? 'fa-spin' : ''}`} />
            {!isMobile && <span>{isSyncing ? 'Syncing…' : 'Refresh'}</span>}
        </button>
    )
}

/** Snapshot of the Chicago wall clock used by the review/send gate. The
 *  hour-only resolution is enough for the 4–6 PM window — finer granularity
 *  would add re-renders the rest of the header doesn't need. */
function getChicagoNow() {
    const fmt = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        month: '2-digit',
        timeZone: CHICAGO_TIME_ZONE,
        year: 'numeric'
    })
    const parts = fmt.formatToParts(new Date()).reduce((acc, p) => {
        acc[p.type] = p.value
        return acc
    }, {})
    const hour = parts.hour === '24' ? 0 : parseInt(parts.hour, 10)
    const dateIso = `${parts.year}-${parts.month}-${parts.day}`
    return { dateIso, hour }
}

/** Live Chicago-wall-clock snapshot. Ticks every 30 s so the button flips
 *  state right around 4:00 PM / 6:00 PM without the user reloading. */
function useChicagoNow() {
    const [now, setNow] = useState(getChicagoNow)
    useEffect(() => {
        const id = setInterval(() => setNow(getChicagoNow()), 30000)
        return () => clearInterval(id)
    }, [])
    return now
}

/** Review & Send button — opens the per-plant email preview modal. The
 *  same modal the auto-cron uses at 4:00 PM is reachable here for manual
 *  re-sends. Gated to (a) today's plan only and (b) the 4 PM – 6 PM
 *  Central window so a manager can't accidentally email yesterday's
 *  schedule or trigger a redundant send well after the cron + the
 *  5 PM updates window. */
function ReviewSendButton({ isMobile, onReviewSend, planDate }) {
    const now = useChicagoNow()
    const isToday = planDate === now.dateIso
    const inWindow = now.hour >= REVIEW_SEND_OPEN_HOUR_CT && now.hour < REVIEW_SEND_CLOSE_HOUR_CT
    const disabled = !isToday || !inWindow

    let title
    if (!isToday) {
        title = 'Review & Send is only available for today’s plan.'
    } else if (!inWindow) {
        title = 'Review & Send is only available between 4:00 PM and 6:00 PM Central.'
    } else {
        title = 'Review and send the daily plan to each plant manager (CCs the district manager).'
    }

    return (
        <button
            onClick={disabled ? undefined : onReviewSend}
            disabled={disabled}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 bg-bg-tertiary text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            title={title}
        >
            <i className="fas fa-paper-plane" />
            {!isMobile && <span>Review &amp; Send</span>}
        </button>
    )
}

/**
 * Right-aligned action cluster in the Plan header — refresh + review/send.
 * Settings now live inline on the Admin tab (gated by `plan.admin`), so
 * the cog button is gone from here.
 */
export function PlanActionButtons({
    isMobile,
    isSchedulesSyncing,
    onRefresh,
    onReviewSend,
    planDate,
    scheduleLastSyncedAt
}) {
    return (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <RefreshButton
                isMobile={isMobile}
                isSyncing={isSchedulesSyncing}
                lastSyncedAt={scheduleLastSyncedAt}
                onRefresh={onRefresh}
            />
            <ReviewSendButton isMobile={isMobile} onReviewSend={onReviewSend} planDate={planDate} />
        </div>
    )
}
