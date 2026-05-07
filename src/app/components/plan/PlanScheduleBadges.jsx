import React from 'react'

import { SERVICE_BADGE_BASE } from '../../../utils/PlanScheduleUtility'

/** Format a minute-of-day count back into "HH:MM", wrapping past midnight. */
const minuteOfDayToHhmm = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.floor(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
import {
    BIG_POUR_MIN_TRUCKS,
    getEffectiveMinTrucks,
    getOrderPourDurationMinutes,
    getOrderPourRate,
    getRequiredTrucksForPourRate,
    isBigPourOrder,
    plantBadgeColor,
    trucksToHitBigPourGoal
} from '../../../utils/PlanUtility'

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
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{
                background: understaffed ? '#dc2626' : isBigPour ? '#4f46e5' : '#d97706',
                color: '#fff'
            }}
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
        `Driver shift would hit ${elapsedHours.toFixed(1)}h — past the 14h DOT limit.`,
        `Anchor (first load-out): ${minuteOfDayToHhmm(firstLoadOutMin)}`,
        `Projected back at yard: ${minuteOfDayToHhmm(finishMin)}`,
        `Load ${segments.load}m + slump ${segments.slump}m + travel ${segments.travelOut}m + pour ${segments.pour}m + return ${segments.travelBack}m`
    ]
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ background: '#dc2626', color: '#fff' }}
            title={tooltipLines.join('\n')}
        >
            <i className="fas fa-clock text-[9px]" />
            Limit Exceeded · {elapsedHours.toFixed(1)}h
        </span>
    )
}

/** Solid pill for cancelled / same-day / test orders, driven by the
 *  start-time sentinel descriptor returned by `getOrderStatus`. */
export function OrderStatusBadge({ status }) {
    if (!status) return null
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ background: status.color, color: '#fff' }}
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
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                    background: 'rgba(255,255,255,0.22)',
                    color: fg,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 10.5,
                    height: 18,
                    minWidth: 34
                }}
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
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ background: 'var(--bg-secondary)' }}
        >
            <span className="text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {value}
            </span>
        </span>
    )
}
