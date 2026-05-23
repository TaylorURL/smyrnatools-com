/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SERVICE_BADGE_BASE } from '../../../../../utils/PlanScheduleUtility'
import {
    BIG_POUR_MIN_TRUCKS,
    getEffectiveMinTrucks,
    getOrderPourDurationMinutes,
    getOrderPourRate,
    getRequiredTrucksForPourRate,
    isBigPourOrder,
    plantBadgeColor,
    trucksToHitBigPourGoal
} from '../../../../../utils/PlanUtility'

/** Format a minute-of-day count back into "HH:MM", wrapping past midnight. */
const minuteOfDayToHhmm = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.floor(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Inline service-quality badge for a single order row. Rendered alongside
 *  the existing `OrderStatusBadge` so dispatchers see "how this pour went"
 *  without opening the ticket modal. */
export function ServiceBadge({ service }) {
    if (!service?.status) return null
    if (service.status === 'good') {
        return (
            <span
                className={SERVICE_BADGE_BASE}
                style={{ background: 'rgba(22, 163, 74, 0.14)', color: '#15803d' }}
                title="On-time start, on-pace pour"
            >
                <i className="fas fa-circle-check text-[9px]" />
                Good Experience
            </span>
        )
    }
    if (service.status === 'bad') {
        const issues = []
        if (service.isLate) issues.push(`first truck ${service.startLateness} min late`)
        if (service.isSlow && service.actualYdPerHr != null && service.requestedYdPerHr != null) {
            issues.push(
                `poured ${service.actualYdPerHr.toFixed(1)} yd/hr vs ${service.requestedYdPerHr.toFixed(1)} yd/hr requested`
            )
        }
        const label =
            service.isLate && service.isSlow ? 'Late, Bad Experience' : service.isLate ? 'Late' : 'Bad Experience'
        return (
            <span
                className={SERVICE_BADGE_BASE}
                style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' }}
                title={issues.join(' · ') || 'Service flagged'}
            >
                <i className="fas fa-circle-exclamation text-[9px]" />
                {label}
            </span>
        )
    }
    if (service.status === 'ongoing') {
        const counts =
            service.ticketsLoaded != null && service.expectedTrucks
                ? `${service.ticketsLoaded}/${service.expectedTrucks}`
                : `${service.ticketsLoaded ?? 0} loaded`
        const isLate = service.isLate
        const color = isLate ? '#b45309' : '#1d4ed8'
        const bg = isLate ? 'rgba(217, 119, 6, 0.14)' : 'rgba(37, 99, 235, 0.12)'
        return (
            <span
                className={SERVICE_BADGE_BASE}
                style={{ background: bg, color }}
                title={
                    isLate
                        ? `Pour in progress · started ${service.startLateness} min late · ${counts} loaded`
                        : `Pour in progress · ${counts} loaded`
                }
            >
                <i className="fas fa-truck-fast text-[9px]" />
                Ongoing · {counts}
            </span>
        )
    }
    if (service.status === 'pending') {
        /* Pending + late (start was more than `BAD_SERVICE_LATE_THRESHOLD_MIN`
         * ago with no trucks loaded) escalates to a red Late chip. The
         * soft amber "Awaiting Truck" still applies in the 5–15 min
         * grace window — dispatchers see a gentle nudge first, an
         * urgent flag once it's unambiguously a missed pour. */
        if (service.isLate) {
            const minutesLate = Math.max(0, Math.round(service.startLateness || 0))
            const hoursLate = Math.floor(minutesLate / 60)
            const remainderMin = minutesLate % 60
            const lateText = hoursLate > 0 ? `${hoursLate}h ${remainderMin}m` : `${remainderMin}m`
            return (
                <span
                    className={SERVICE_BADGE_BASE}
                    style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' }}
                    title={`Scheduled start was ${lateText} ago — no trucks loaded yet.`}
                >
                    <i className="fas fa-circle-exclamation text-[9px]" />
                    Late · {lateText}
                </span>
            )
        }
        return (
            <span
                className={SERVICE_BADGE_BASE}
                style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#b45309' }}
                title="Past scheduled start with no tickets loaded yet"
            >
                <i className="fas fa-hourglass-half text-[9px]" />
                Awaiting Truck
            </span>
        )
    }
    return null
}

/** Color-coded "Customer Satisfaction" pill — green ≥ 90%, amber ≥ 75%,
 *  orange ≥ 60%, red below. Mirrors the `YardageDeltaBadge` look. */
export function SatisfactionBadge({ score }) {
    if (!Number.isFinite(score)) return null
    const pct = Math.round(score * 100)
    const tier = pct >= 90 ? 'great' : pct >= 75 ? 'good' : pct >= 60 ? 'ok' : 'poor'
    const colors = { good: '#65a30d', great: '#16a34a', ok: '#d97706', poor: '#dc2626' }
    const labels = { good: 'Good', great: 'Excellent', ok: 'Watch', poor: 'Action needed' }
    const color = colors[tier]
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5"
            style={{ background: `${color}1a`, color }}
            title={`${labels[tier]} · weighted blend of pour pace, on-time start, and yardage completion across the day's tickets`}
        >
            <i className="fas fa-face-smile text-[9px]" />
            {labels[tier]}
        </span>
    )
}

/** +/- percentage pill shown next to the Yardage KPI value. Green when up
 *  day-over-day, red when down, gray at zero. */
export function YardageDeltaBadge({ comparisonLabel, comparisonYardage, pct }) {
    if (!Number.isFinite(pct)) return null
    const isFlat = pct === 0
    const isUp = pct > 0
    const color = isFlat ? '#64748b' : isUp ? '#16a34a' : '#dc2626'
    const icon = isFlat ? 'fa-minus' : isUp ? 'fa-arrow-up' : 'fa-arrow-down'
    const sign = isUp ? '+' : ''
    const label = comparisonLabel || 'previous business day'
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5"
            style={{ background: `${color}1a`, color }}
            title={`Day-over-day change · ${label} ${comparisonYardage.toLocaleString()} yd`}
        >
            <i className={`fas ${icon} text-[9px]`} />
            {sign}
            {pct.toFixed(1)}%
        </span>
    )
}

/** Big-pour / understaffed warning chip. Renders only when the order is a
 *  big pour OR the dispatcher has booked fewer trucks than the travel-time
 *  derived requirement. */
export function BigPourBadge({ order, travelOverrides }) {
    const isBigPour = isBigPourOrder(order)
    const needed = getEffectiveMinTrucks(order, travelOverrides)
    // Only flag under-booked when dispatch booked fewer than our canonical count.
    const dispatchBooked = parseFloat(order?.truckCount) || 0
    const shortfall = needed && dispatchBooked > 0 ? Math.max(0, needed - dispatchBooked) : 0
    if (!isBigPour && shortfall === 0) return null
    const rate = getOrderPourRate(order)
    const calculated = getRequiredTrucksForPourRate(order, travelOverrides)
    const pourMinutes = getOrderPourDurationMinutes(order)
    const usingLive = !!travelOverrides
    const pourHours = pourMinutes != null ? (pourMinutes / 60).toFixed(1) : null
    const understaffed = shortfall > 0
    const tooltipLines = []
    if (rate != null) tooltipLines.push(`Pour rate: ${rate} yd/hr`)
    if (calculated != null)
        tooltipLines.push(
            `Travel-based requirement: ${calculated} trucks${usingLive ? ' (live Google traffic)' : ' (dispatch estimate)'}`
        )
    if (isBigPour) {
        tooltipLines.push(`Big-pour floor (≥ 120 yd · <10 min spacing): ${BIG_POUR_MIN_TRUCKS} trucks`)
        const goalTrucks = trucksToHitBigPourGoal(order, travelOverrides)
        if (Number.isFinite(goalTrucks) && goalTrucks > BIG_POUR_MIN_TRUCKS) {
            tooltipLines.push(`Trucks to hit 120 yd/hr loaded at this travel: ${goalTrucks}`)
        }
    }
    if (needed != null) tooltipLines.push(`Effective minimum: ${needed} trucks`)
    if (dispatchBooked > 0 && needed !== dispatchBooked) {
        tooltipLines.push(`On Jonel: ${dispatchBooked} trucks`)
        tooltipLines.push('(Jonel is likely wrong — use the required count above)')
    }
    if (pourHours) tooltipLines.push(`Est. pour time: ~${pourHours}h`)
    if (understaffed) tooltipLines.push(`Short by ${shortfall} truck${shortfall === 1 ? '' : 's'}`)
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-white"
            style={{ background: understaffed ? '#dc2626' : isBigPour ? '#4f46e5' : '#d97706' }}
            title={tooltipLines.join('\n')}
        >
            <i
                className={`fas ${understaffed ? 'fa-triangle-exclamation' : isBigPour ? 'fa-fire' : 'fa-users'} text-[9px]`}
            />
            {understaffed
                ? `${isBigPour ? 'Big pour · ' : ''}+${shortfall} trucks`
                : isBigPour
                  ? `Big Pour · ${rate} yd/hr`
                  : `Needs ${needed} trucks`}
        </span>
    )
}

/** Driver shift cap warning — fires when the projected back-at-yard time
 *  for this order pushes the operator past the 14-hour DOT limit measured
 *  from the day's first load-out. The tooltip breaks down each segment
 *  (load · slump · travel · pour · travel back) so dispatchers see
 *  exactly which leg pushed them over. Render nothing when the order
 *  isn't over the limit or when the limit can't be evaluated. */
export function HoursLimitBadge({ limit }) {
    if (!limit || !limit.exceeds) return null
    const { elapsedHours, finishMin, firstLoadOutMin, segments } = limit
    const tooltipLines = [
        `Operator shift would hit ${elapsedHours.toFixed(1)}h — past the 14h DOT limit.`,
        `Anchor (first load-out): ${minuteOfDayToHhmm(firstLoadOutMin)}`,
        `Projected back at yard: ${minuteOfDayToHhmm(finishMin)}`,
        `Load ${segments.load}m + slump ${segments.slump}m + travel ${segments.travelOut}m + pour ${segments.pour}m + return ${segments.travelBack}m`
    ]
    return (
        <span
            className="status-badge-danger inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            title={tooltipLines.join('\n')}
        >
            <i className="fas fa-clock text-[9px]" />
            Limit · {elapsedHours.toFixed(1)}h
        </span>
    )
}

/** Pre-emptive risk indicator — fires on customers whose trailing 60-day
 *  history has them adding yardage mid-pour on ≥30% of jobs ("Likely to
 *  Kick") or cancelling / moving ≥25% of jobs after the 5:30 PM commit
 *  snapshot ("Likely to Cancel/Move"). Both signals come from
 *  `useCustomerRiskIndex`, which folds the existing Kickers + Moves &
 *  Cancels classifiers into a single per-customer lookup.
 *
 *  Renders as a compact icon-only chip (~20px) so it can sit as a leading
 *  prefix to the customer name without competing for the cell's
 *  horizontal space. The native tooltip exposes the full label + the
 *  underlying rate for power users. Suppressed under `compareMode`
 *  alongside the other annotation badges. */
export function LikelyKickerBadge({ rate }) {
    const pct = Math.round((rate || 0) * 100)
    return (
        <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0"
            style={{ background: 'rgba(220, 38, 38, 0.14)', color: '#b91c1c' }}
            title={`Likely to Kick — kicker rate ${pct}% over the last 60 working days. This customer regularly calls in extra yardage mid-pour.`}
            aria-label="Likely to call in a kicker"
        >
            <i className="fas fa-bolt text-[10px]" />
        </span>
    )
}

export function LikelyChurnBadge({ rate }) {
    const pct = Math.round((rate || 0) * 100)
    return (
        <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0"
            style={{ background: 'rgba(217, 119, 6, 0.16)', color: '#b45309' }}
            title={`Likely to Cancel/Move — combined cancel + move rate ${pct}% over the last 60 working days. This order may shift after the 5:30 PM commit.`}
            aria-label="Likely to cancel or move"
        >
            <i className="fas fa-shuffle text-[10px]" />
        </span>
    )
}

/** Maps the start-time sentinel `kind` to one of the project's themed badge
 *  utility classes so the pill flips correctly between light and dark mode. */
const STATUS_BADGE_TONE_CLASS = {
    cancelled: 'status-badge-danger',
    sameDay: 'status-badge-warning',
    test: 'status-badge-info'
}

/** Themed pill for cancelled / same-day / test orders, driven by the
 *  start-time sentinel descriptor returned by `getOrderStatus`. */
export function OrderStatusBadge({ status }) {
    if (!status) return null
    const toneClass = STATUS_BADGE_TONE_CLASS[status.kind] || 'status-badge-neutral'
    return (
        <span
            className={`${toneClass} inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap`}
            title={`Start time sentinel — order is ${status.label.toLowerCase()}`}
        >
            <i className={`fas ${status.icon} text-[8px]`} />
            {status.label}
        </span>
    )
}

/** Plant identifier chip — colored badge with the plant code on the left and
 *  optional plant name on the right. Color is sourced from
 *  `plantBadgeColor` so every Plan surface paints the same plant the same. */
export function PlantBadge({ code, fallback, name }) {
    const bg = plantBadgeColor(code, fallback)
    // Dark-on-yellow reads better than white-on-yellow.
    const fg = bg && bg.toLowerCase() === '#eab308' ? '#3f2d00' : '#fff'
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 font-semibold whitespace-nowrap"
            style={{ background: bg, color: fg }}
        >
            <span
                className="inline-flex items-center justify-center rounded-full font-bold bg-[rgba(255,255,255,0.22)] font-heading h-[18px]"
                style={{ color: fg, fontSize: 10.5, minWidth: 34 }}
            >
                {code}
            </span>
            {name && <span className="text-[11.5px]">{name}</span>}
        </span>
    )
}

/** Compact "label + value" chip used inside the OrderCard footer. */
export function KeyValue({ label, value }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-secondary">
            <span className="text-[9.5px] uppercase tracking-wider text-text-tertiary">{label}</span>
            <span className="font-mono font-semibold text-text-primary">{value}</span>
        </span>
    )
}
