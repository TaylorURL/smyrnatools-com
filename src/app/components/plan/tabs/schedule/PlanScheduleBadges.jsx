/* eslint-disable react/forbid-dom-props */
import React from 'react'

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
import Badge from '../../../common/Badge'

/** Format a minute-of-day count back into "HH:MM", wrapping past midnight. */
const minuteOfDayToHhmm = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.floor(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Maps the four `ServiceBadge` outcomes to the unified Badge tone palette. */
const SERVICE_STATUS_TO_TONE = {
    bad: 'danger',
    good: 'success',
    ongoing: 'info',
    pending: 'warning'
}

/** Inline service-quality badge for a single order row. Rendered alongside
 *  the existing `OrderStatusBadge` so dispatchers see "how this pour went"
 *  without opening the ticket modal. */
export function ServiceBadge({ service }) {
    if (!service?.status) return null
    if (service.status === 'good') {
        return (
            <Badge
                tone={SERVICE_STATUS_TO_TONE.good}
                size="md"
                shape="pill"
                icon="circle-check"
                title="On-time start, on-pace pour"
            >
                Good Experience
            </Badge>
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
            <Badge
                tone={SERVICE_STATUS_TO_TONE.bad}
                size="md"
                shape="pill"
                icon="circle-exclamation"
                title={issues.join(' · ') || 'Service flagged'}
            >
                {label}
            </Badge>
        )
    }
    if (service.status === 'ongoing') {
        const counts =
            service.ticketsLoaded != null && service.expectedTrucks
                ? `${service.ticketsLoaded}/${service.expectedTrucks}`
                : `${service.ticketsLoaded ?? 0} loaded`
        const isLate = service.isLate
        return (
            <Badge
                tone={isLate ? 'warning' : SERVICE_STATUS_TO_TONE.ongoing}
                size="md"
                shape="pill"
                icon="truck-fast"
                title={
                    isLate
                        ? `Pour in progress · started ${service.startLateness} min late · ${counts} loaded`
                        : `Pour in progress · ${counts} loaded`
                }
            >
                Ongoing · {counts}
            </Badge>
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
                <Badge
                    tone="danger"
                    size="md"
                    shape="pill"
                    icon="circle-exclamation"
                    title={`Scheduled start was ${lateText} ago — no trucks loaded yet.`}
                >
                    Late · {lateText}
                </Badge>
            )
        }
        return (
            <Badge
                tone={SERVICE_STATUS_TO_TONE.pending}
                size="md"
                shape="pill"
                icon="hourglass-half"
                title="Past scheduled start with no tickets loaded yet"
            >
                Awaiting Truck
            </Badge>
        )
    }
    return null
}

/** Tier → Badge config for the Customer Satisfaction pill. `great` uses the
 *  solid variant to stand out as the celebratory state; everything else uses
 *  soft tints so the chip never overwhelms the surrounding row. */
const SATISFACTION_TIER_CONFIG = {
    good: { label: 'Good', tone: 'success', variant: 'soft' },
    great: { label: 'Excellent', tone: 'success', variant: 'solid' },
    ok: { label: 'Watch', tone: 'warning', variant: 'soft' },
    poor: { label: 'Action needed', tone: 'danger', variant: 'soft' }
}

/** Color-coded "Customer Satisfaction" pill — green ≥ 90%, amber ≥ 75%,
 *  orange ≥ 60%, red below. Mirrors the `YardageDeltaBadge` look. */
export function SatisfactionBadge({ score }) {
    if (!Number.isFinite(score)) return null
    const pct = Math.round(score * 100)
    const tier = pct >= 90 ? 'great' : pct >= 75 ? 'good' : pct >= 60 ? 'ok' : 'poor'
    const { label, tone, variant } = SATISFACTION_TIER_CONFIG[tier]
    return (
        <Badge
            tone={tone}
            variant={variant}
            size="md"
            shape="pill"
            uppercase={false}
            icon="face-smile"
            title={`${label} · weighted blend of pour pace, on-time start, and yardage completion across the day's tickets`}
        >
            {label}
        </Badge>
    )
}

/** +/- percentage pill shown next to the Yardage KPI value. Green when up
 *  day-over-day, red when down, gray at zero. */
export function YardageDeltaBadge({ comparisonLabel, comparisonYardage, pct }) {
    if (!Number.isFinite(pct)) return null
    const isFlat = pct === 0
    const isUp = pct > 0
    const tone = isFlat ? 'neutral' : isUp ? 'success' : 'danger'
    const icon = isFlat ? 'minus' : isUp ? 'arrow-up' : 'arrow-down'
    const sign = isUp ? '+' : ''
    const label = comparisonLabel || 'previous business day'
    return (
        <Badge
            tone={tone}
            size="md"
            shape="rounded"
            uppercase={false}
            icon={icon}
            className="tabular-nums"
            title={`Day-over-day change · ${label} ${comparisonYardage.toLocaleString()} yd`}
        >
            {sign}
            {pct.toFixed(1)}%
        </Badge>
    )
}

/** Per-state palette + icon for the Big Pour / understaffed warning chip.
 *  Colors stay literal because this badge intentionally overlays the
 *  themed status palette with attention-grabbing reds, indigos, and
 *  ambers regardless of theme. */
const BIG_POUR_STATE_STYLES = {
    bigPour: { bg: '#4f46e5', icon: 'fire' },
    softWarn: { bg: '#d97706', icon: 'users' },
    understaffed: { bg: '#dc2626', icon: 'triangle-exclamation' }
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
    const stateKey = understaffed ? 'understaffed' : isBigPour ? 'bigPour' : 'softWarn'
    const { bg, icon } = BIG_POUR_STATE_STYLES[stateKey]
    const label = understaffed
        ? `${isBigPour ? 'Big pour · ' : ''}+${shortfall} trucks`
        : isBigPour
          ? `Big Pour · ${rate} yd/hr`
          : `Needs ${needed} trucks`
    return (
        <Badge
            variant="custom"
            size="md"
            shape="pill"
            bg={bg}
            icon={icon}
            className="shadow-sm"
            title={tooltipLines.join('\n')}
        >
            {label}
        </Badge>
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
        <Badge tone="danger" size="sm" shape="pill" icon="clock" title={tooltipLines.join('\n')}>
            Limit · {elapsedHours.toFixed(1)}h
        </Badge>
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
        <Badge
            tone="danger"
            size="xs"
            shape="pill"
            icon="bolt"
            className="h-5 w-5 justify-center shrink-0"
            title={`Likely to Kick — kicker rate ${pct}% over the last 60 working days. This customer regularly calls in extra yardage mid-pour.`}
            aria-label="Likely to call in a kicker"
        />
    )
}

export function LikelyChurnBadge({ rate }) {
    const pct = Math.round((rate || 0) * 100)
    return (
        <Badge
            tone="warning"
            size="xs"
            shape="pill"
            icon="shuffle"
            className="h-5 w-5 justify-center shrink-0"
            title={`Likely to Cancel/Move — combined cancel + move rate ${pct}% over the last 60 working days. This order may shift after the 5:30 PM commit.`}
            aria-label="Likely to cancel or move"
        />
    )
}

/** Maps the start-time sentinel `kind` to the unified Badge tone palette. */
const ORDER_STATUS_TO_TONE = {
    cancelled: 'danger',
    sameDay: 'warning',
    test: 'info'
}

/** Themed pill for cancelled / same-day / test orders, driven by the
 *  start-time sentinel descriptor returned by `getOrderStatus`. */
export function OrderStatusBadge({ status }) {
    if (!status) return null
    const tone = ORDER_STATUS_TO_TONE[status.kind] || 'neutral'
    // Status icons arrive as full Font Awesome classes (e.g. `fa-ban`);
    // strip the `fa-` prefix so Badge can re-apply the themed size + color.
    const iconName = typeof status.icon === 'string' ? status.icon.replace(/^fa-/, '') : status.icon
    return (
        <Badge
            tone={tone}
            size="sm"
            shape="pill"
            icon={iconName}
            title={`Start time sentinel — order is ${status.label.toLowerCase()}`}
        >
            {status.label}
        </Badge>
    )
}

/** Plant identifier chip — colored badge with the plant code on the left and
 *  optional plant name on the right. Color is sourced from
 *  `plantBadgeColor` so every Plan surface paints the same plant the same.
 *  Text colour falls through to the site-wide monochrome-badge rule so
 *  the chip renders white on dark / grayed themes and dark on light,
 *  regardless of the saturated chip background. */
export function PlantBadge({ code, fallback, name }) {
    const bg = plantBadgeColor(code, fallback)
    return (
        <Badge variant="custom" size="md" shape="pill" bg={bg}>
            <span className="font-mono tabular-nums">{code}</span>
            {name && <span className="ml-1.5 normal-case font-medium">{name}</span>}
        </Badge>
    )
}

/** Compact "label + value" chip used inside the OrderCard footer. Uses the
 *  unified Badge as a neutral, theme-aware surface while keeping the dual
 *  inner spans so the label / value typography stays distinct. */
export function KeyValue({ label, value }) {
    return (
        <Badge
            variant="custom"
            size="md"
            shape="rounded-md"
            weight="semibold"
            uppercase={false}
            className="bg-bg-secondary border border-border-light"
        >
            <span className="text-[9.5px] uppercase tracking-wider text-text-tertiary">{label}</span>
            <span className="ml-1 font-mono font-semibold text-text-primary tabular-nums">{value}</span>
        </Badge>
    )
}
