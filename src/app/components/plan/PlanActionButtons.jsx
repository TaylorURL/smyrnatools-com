/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

const CHICAGO_TIME_ZONE = 'America/Chicago'

/* The cron + button stay aligned on day-specific windows:
 *   • Mon–Fri (1–5): cron fires at 16:00 CT, button enabled 16:00–18:00
 *   • Sat        (6): cron fires at 11:00 CT, button enabled 11:00–13:00
 *   • Sun        (0): plant closed — no plan, no window
 * On Saturday the target plan is MONDAY's (we skip Sunday); the rest of
 * the week the target is tomorrow. Mirrors the edge function's
 * `expectedCronHourForWeekday` + `chicagoNextWorkingDate`. */
const REVIEW_SEND_SCHEDULE = {
    /* Sunday */ 0: null,
    /* Monday */ 1: { closeHour: 18, label: '4:00 PM and 6:00 PM Central', openHour: 16 },
    /* Tuesday */ 2: { closeHour: 18, label: '4:00 PM and 6:00 PM Central', openHour: 16 },
    /* Wednesday */ 3: { closeHour: 18, label: '4:00 PM and 6:00 PM Central', openHour: 16 },
    /* Thursday */ 4: { closeHour: 18, label: '4:00 PM and 6:00 PM Central', openHour: 16 },
    /* Friday */ 5: { closeHour: 18, label: '4:00 PM and 6:00 PM Central', openHour: 16 },
    /* Saturday */ 6: { closeHour: 13, label: '11:00 AM and 1:00 PM Central', openHour: 11 }
}

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

/** Snapshot of the Chicago wall clock used by the review/send gate.
 *  Returns the current ISO date, hour, weekday (0 = Sun … 6 = Sat), and
 *  the next-working ISO date — that's tomorrow on weekdays, Monday on
 *  Saturdays (Sunday is closed so we never land on it). The button only
 *  enables when the user is actually viewing that next-working date. */
function getChicagoNow() {
    const fmt = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        month: '2-digit',
        timeZone: CHICAGO_TIME_ZONE,
        weekday: 'short',
        year: 'numeric'
    })
    const parts = fmt.formatToParts(new Date()).reduce((acc, p) => {
        acc[p.type] = p.value
        return acc
    }, {})
    const weekdayMap = { Fri: 5, Mon: 1, Sat: 6, Sun: 0, Thu: 4, Tue: 2, Wed: 3 }
    const hour = parts.hour === '24' ? 0 : parseInt(parts.hour, 10)
    const year = parseInt(parts.year, 10)
    const month = parseInt(parts.month, 10)
    const day = parseInt(parts.day, 10)
    const weekday = weekdayMap[parts.weekday] ?? 0
    /* Anchor UTC date math at noon UTC so any DST hour-shift across the
     * boundary can't bump the date off by one. */
    const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    const skipSunday = weekday === 6 ? 2 : 1
    base.setUTCDate(base.getUTCDate() + skipSunday)
    const nextWorking = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`
    const dateIso = `${parts.year}-${parts.month}-${parts.day}`
    return { dateIso, hour, nextWorkingIso: nextWorking, weekday }
}

/** Live Chicago-wall-clock snapshot. Ticks every 30 s so the button flips
 *  state right around the open/close boundary without a reload. */
function useChicagoNow() {
    const [now, setNow] = useState(getChicagoNow)
    useEffect(() => {
        const id = setInterval(() => setNow(getChicagoNow()), 30000)
        return () => clearInterval(id)
    }, [])
    return now
}

/** Friendly date label used in tooltips so the dispatcher sees which day's
 *  plan the review surface targets ("Monday's plan" / "tomorrow's plan"). */
function describeTarget(weekday) {
    if (weekday === 6) return "Monday's plan"
    return "tomorrow's plan"
}

/** Review & Send button — opens the per-plant email preview modal. The
 *  same modal the auto-cron uses is reachable here for manual re-sends.
 *  Window + target date track the cron rules: Mon–Fri 4 PM–6 PM CT for
 *  tomorrow's plan, Sat 11 AM–1 PM CT for Monday's plan. Sunday is
 *  always disabled. */
function ReviewSendButton({ isMobile, onReviewSend, planDate }) {
    const now = useChicagoNow()
    const window = REVIEW_SEND_SCHEDULE[now.weekday]
    const isTargetDate = planDate === now.nextWorkingIso
    const inWindow = !!window && now.hour >= window.openHour && now.hour < window.closeHour
    const disabled = !window || !isTargetDate || !inWindow

    let title
    if (!window) {
        title = 'Review & Send is closed on Sundays — the plant doesn’t operate that day.'
    } else if (!isTargetDate) {
        title = `Review & Send is only available while viewing ${describeTarget(now.weekday)}.`
    } else if (!inWindow) {
        title = `Review & Send is only available between ${window.label}.`
    } else {
        title = `Review and send ${describeTarget(now.weekday)} to each plant manager (CCs the district manager).`
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
