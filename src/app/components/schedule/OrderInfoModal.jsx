/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { formatOrderAddress } from '../../../utils/AddressUtility'
import { isBigPourOrder, isCancelledOrder, plantBadgeColor, SAME_DAY_ORDER_START } from '../../../utils/PlanUtility'
import { TruckCoveragePanelBody } from './TruckCoverageHoverCard'

const clean = (value) => (value == null ? '' : String(value).trim())

const isSameDayOrder = (order) => {
    const t = String(order?.startTime || '').trim()
    return t ? t.padStart(5, '0') === SAME_DAY_ORDER_START : false
}

/** Compact label-over-value pair used in the Details tab. Stays quiet — no
 *  border, no tint — so the page reads as scannable text rather than a wall
 *  of nested cards. Long unbroken tokens wrap inside the column. */
function Field({ hint, label, mono, value, wide }) {
    const text = clean(value)
    if (!text) return null
    return (
        <div className={`flex flex-col gap-0.5 min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
            <span
                className={`text-[13px] leading-snug ${mono ? 'font-mono' : ''} text-text-primary`}
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                title={text}
            >
                {text}
                {hint && <span className="ml-2 text-[11px] font-normal text-text-tertiary">{hint}</span>}
            </span>
        </div>
    )
}

/** Section card — quiet container around a group of fields. */
function Section({ children, icon, title }) {
    if (!children) return null
    const validChildren = React.Children.toArray(children).filter(Boolean)
    if (validChildren.length === 0) return null
    return (
        <div className="rounded-xl bg-bg-primary border border-border-light">
            <div className="px-3 py-2 flex items-center gap-2 border-b rounded-t-xl bg-bg-secondary border-border-light">
                <i className={`fas ${icon} text-[10.5px] text-text-tertiary`} />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-secondary">{title}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 px-3 py-3">{validChildren}</div>
        </div>
    )
}

/** Hero metric tile — large value over a compact label, optional hint. */
function HeroMetric({ accent, hint, icon, label, value }) {
    return (
        <div className="rounded-lg px-3 py-2 flex items-start gap-2.5 min-w-0 flex-1 bg-bg-primary border border-border-light">
            <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${accent}15`, color: accent }}
            >
                <i className={`fas ${icon} text-[12px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div
                    className="text-[15px] font-bold font-mono leading-tight mt-0.5 truncate text-text-primary"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                    title={value}
                >
                    {value || '—'}
                </div>
                {hint && (
                    <div className="text-[10.5px] mt-0.5 truncate text-text-tertiary" title={hint}>
                        {hint}
                    </div>
                )}
            </div>
        </div>
    )
}

/** Header status pill — used for cancelled / same-day / big-pour / overbooked
 *  / closer-plant-available callouts. */
function StatusPill({ color, icon, label, title }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ background: `${color}1f`, color }}
            title={title}
        >
            <i className={`fas ${icon} text-[9px]`} />
            {label}
        </span>
    )
}

/** Header quick-action button — small icon + label, accent-tinted. */
function HeaderAction({ accent, disabled, icon, label, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title || label}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer disabled:cursor-not-allowed"
            style={{
                background: disabled ? 'var(--bg-secondary)' : `${accent}15`,
                color: disabled ? 'var(--text-tertiary)' : accent,
                opacity: disabled ? 0.6 : 1
            }}
        >
            <i className={`fas ${icon} text-[10.5px]`} />
            {label}
        </button>
    )
}

/** One row in the Suggestions tab. */
function Suggestion({ body, color = '#0ea5e9', icon, title }) {
    return (
        <div className="rounded-xl px-3 py-3 flex items-start gap-3 bg-bg-primary border border-border-light">
            <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${color}1f`, color }}
            >
                <i className={`fas ${icon} text-[12px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-tight text-text-primary">{title}</div>
                <div
                    className="text-[12px] mt-0.5 leading-snug text-text-secondary"
                    style={{ overflowWrap: 'anywhere' }}
                >
                    {body}
                </div>
            </div>
        </div>
    )
}

function EmptyTab({ hint, icon, title }) {
    return (
        <div className="rounded-xl px-5 py-8 text-center flex flex-col items-center gap-2 bg-bg-primary border border-border-medium">
            <i className={`fas ${icon} text-[24px] text-text-tertiary`} />
            <div className="text-[13px] font-bold text-text-secondary">{title}</div>
            {hint && <div className="text-[12px] leading-snug max-w-md text-text-tertiary">{hint}</div>}
        </div>
    )
}

const TABS = [
    { icon: 'fa-clipboard-list', id: 'details', label: 'Details' },
    { icon: 'fa-truck', id: 'plan', label: 'Plan' },
    { icon: 'fa-lightbulb', id: 'suggestions', label: 'Suggestions' }
]

/**
 * Tabbed modal for a single dispatch order — the Schedule tab's right-click
 * → "View order" target.
 *
 *   Header — colored plant strip with order #, customer, home plant chip,
 *            status pills (cancelled / same-day / big pour / overbooked /
 *            closer-plant), and quick-action buttons (Open map · View
 *            tickets).
 *   Hero strip — at-a-glance yardage / trucks / start time / address.
 *   Tabs:
 *     Details — every header field carried on the order (clean title-cased
 *               address, mono codes, hint metadata).
 *     Plan — the truck-coverage explainer reused from the Schedule's
 *            hover side-panel.
 *     Suggestions — actionable nudges (closer plant, recommended move
 *                   time, big-pour shortfall, dispatch mismatch).
 */
function OrderInfoModal({
    accentColor = '#2563eb',
    closerPlant,
    coverage,
    onClose,
    onOpenLocation,
    onViewTickets,
    order,
    plantName,
    ticketCount = null
}) {
    const [tab, setTab] = useState('details')

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    const orderNumLabel = order?.orderNum ? `#${order.orderNum}` : ''
    const customerLabel = clean(order?.customer)
    const homePlantCode = order?.plantCode || ''
    const yardage = parseFloat(order?.yardage) || 0
    const loadSize = parseFloat(order?.loadSize) || 0
    const truckCount = parseFloat(order?.truckCount) || 0

    /** Schedule-tab address normalizer — applies the same Title-Case + stray
     *  punctuation cleanup the schedule rows do, so this modal never shows
     *  raw `.lady Leslie Lane &c.` artifacts. */
    const formattedAddress = useMemo(() => formatOrderAddress(order, ', '), [order])
    const stateZip = useMemo(() => [clean(order?.state), clean(order?.zip)].filter(Boolean).join(' '), [order])

    /** Header status pills — order classification first, then operational
     *  flags that need dispatcher attention. */
    const statusPills = useMemo(() => {
        const out = []
        if (isCancelledOrder(order)) {
            out.push({
                color: '#dc2626',
                icon: 'fa-ban',
                label: 'Cancelled',
                title: 'Order has the cancellation start-time sentinel (17:00).'
            })
        }
        if (isSameDayOrder(order)) {
            out.push({
                color: '#d97706',
                icon: 'fa-bolt',
                label: 'Same-day',
                title: 'Order has the same-day rush sentinel (15:00).'
            })
        }
        if (isBigPourOrder(order)) {
            out.push({
                color: '#4f46e5',
                icon: 'fa-fire',
                label: 'Big pour',
                title: '> 120 yd³ with < 10-minute spacing — coordinate trucks early.'
            })
        }
        if (coverage?.overbooked) {
            out.push({
                color: '#dc2626',
                icon: 'fa-triangle-exclamation',
                label: 'Overbooked',
                title: 'Plant pool can’t cover the pour at the scheduled start.'
            })
        }
        if (closerPlant && closerPlant.savings >= 5) {
            out.push({
                color: '#1d4ed8',
                icon: 'fa-route',
                label: `Closer: ${closerPlant.code}`,
                title: `Plant ${closerPlant.code} is ~${closerPlant.savings} min closer one-way.`
            })
        }
        return out
    }, [order, coverage, closerPlant])

    const suggestions = useMemo(
        () => buildSuggestions({ closerPlant, coverage, order }),
        [closerPlant, coverage, order]
    )

    /** Plant-stripe color — keys the header to `plantBadgeColor` so a glance
     *  at the modal header makes the plant identity unmistakable. */
    const stripeColor = plantBadgeColor(homePlantCode, accentColor)

    if (!order) return null

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.55)] z-[2147483000]"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light"
                style={{
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '92vh',
                    maxWidth: 880
                }}
            >
                {/* Header — plant-color stripe on the left, identification +
                    status pills + quick actions on the right. */}
                <div className="flex items-stretch border-b border-border-light">
                    <div className="w-1.5" style={{ background: stripeColor, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0 px-5 py-3 flex items-start gap-3">
                        <div
                            className="rounded-lg flex items-center justify-center shrink-0 font-bold tabular-nums text-white font-heading h-[38px] w-11"
                            style={{ background: stripeColor, fontSize: 13 }}
                            title={`Plant ${homePlantCode}${plantName ? ` — ${plantName}` : ''}`}
                        >
                            {homePlantCode || '—'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-[15px] font-bold leading-tight text-text-primary font-heading">
                                    Order {orderNumLabel}
                                </span>
                                {plantName && <span className="text-[11px] text-text-tertiary">{plantName}</span>}
                            </div>
                            <div
                                className="text-[12.5px] font-semibold mt-0.5 truncate uppercase tracking-wide text-text-secondary"
                                title={customerLabel}
                            >
                                {customerLabel || '—'}
                            </div>
                            {statusPills.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                    {statusPills.map((p) => (
                                        <StatusPill key={p.label} {...p} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {onOpenLocation && (
                                <HeaderAction
                                    accent={accentColor}
                                    icon="fa-map-location-dot"
                                    label="Map"
                                    onClick={() => onOpenLocation(order)}
                                    title="Open route map for this job site"
                                />
                            )}
                            {onViewTickets && (
                                <HeaderAction
                                    accent={accentColor}
                                    icon="fa-ticket"
                                    label={
                                        ticketCount != null && ticketCount > 0 ? `Tickets · ${ticketCount}` : 'Tickets'
                                    }
                                    onClick={() => onViewTickets(order)}
                                    title="View loaded tickets for this order"
                                />
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer text-text-secondary"
                                aria-label="Close"
                                title="Close (Esc)"
                            >
                                <i className="fas fa-xmark text-[14px]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Hero metrics — at-a-glance answers to "how big, how many,
                    when, where" without scrolling. */}
                <div className="px-5 py-3 flex items-stretch gap-2 flex-wrap border-b bg-bg-secondary border-border-light">
                    <HeroMetric
                        accent={accentColor}
                        icon="fa-cubes"
                        label="Yardage"
                        value={yardage > 0 ? `${yardage} yd³` : '—'}
                        hint={loadSize > 0 ? `${loadSize} yd / load` : null}
                    />
                    <HeroMetric
                        accent={accentColor}
                        icon="fa-truck"
                        label="Trucks"
                        value={truckCount > 0 ? String(truckCount) : '—'}
                        hint={
                            order?.rate
                                ? `every ${order.rate}`
                                : order?.truckClass
                                  ? `class ${clean(order.truckClass)}`
                                  : null
                        }
                    />
                    <HeroMetric
                        accent={accentColor}
                        icon="fa-clock"
                        label="Start time"
                        value={clean(order?.startTime) || '—'}
                        hint={order?.toJobTime ? `${clean(order.toJobTime)} to job` : null}
                    />
                    <HeroMetric
                        accent={accentColor}
                        icon="fa-location-dot"
                        label="Job address"
                        value={formattedAddress || '—'}
                        hint={stateZip || null}
                    />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 py-2 border-b overflow-x-auto bg-bg-secondary border-border-light">
                    {TABS.map((t) => {
                        const active = tab === t.id
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className="px-3 py-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                                style={{
                                    background: active ? accentColor : 'transparent',
                                    color: active ? '#fff' : 'var(--text-secondary)'
                                }}
                            >
                                <i className={`fas ${t.icon} text-[10.5px]`} />
                                {t.label}
                                {t.id === 'suggestions' && suggestions.length > 0 && (
                                    <span
                                        className="inline-flex items-center justify-center rounded-full text-[10px] font-bold h-4"
                                        style={{
                                            background: active ? 'rgba(255,255,255,0.3)' : 'var(--bg-tertiary)',
                                            color: active ? '#fff' : 'var(--text-secondary)',
                                            minWidth: 16,
                                            padding: '0 4px'
                                        }}
                                    >
                                        {suggestions.length}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3 bg-bg-secondary">
                    {tab === 'details' && (
                        <>
                            <Section icon="fa-hashtag" title="Identification">
                                <Field label="Order #" mono value={order.orderNum} />
                                <Field label="Order ID" mono value={order.orderId} />
                                <Field label="PO #" mono value={order.poNumber} />
                                <Field label="Job #" mono value={order.jobNumber} />
                            </Section>

                            <Section icon="fa-user-tie" title="Customer & Contact">
                                <Field label="Name" value={order.customer} wide />
                                <Field label="Customer #" mono value={order.customerNum} />
                                <Field label="Contact" value={order.contact} />
                                <Field
                                    label="Phone"
                                    mono
                                    value={
                                        order.phone ? (
                                            <a
                                                className="text-inherit hover:underline"
                                                href={`tel:${String(order.phone).replace(/\D/g, '')}`}
                                            >
                                                {order.phone}
                                            </a>
                                        ) : null
                                    }
                                />
                            </Section>

                            <Section icon="fa-location-dot" title="Job Location">
                                <Field label="Address" value={formattedAddress} wide />
                                <Field label="City" value={order.city} />
                                <Field label="State / ZIP" mono value={stateZip} />
                            </Section>

                            <Section icon="fa-flask" title="Product">
                                <Field label="Code" mono value={order.productCode} />
                                <Field label="Description" value={order.description} wide />
                            </Section>

                            <Section icon="fa-clock" title="Schedule & Timing">
                                <Field label="Start time" mono value={order.startTime} />
                                <Field label="Spacing" mono value={order.rate} hint="between loads" />
                                <Field label="Travel to job" mono value={order.toJobTime} />
                                <Field label="Travel to plant" mono value={order.toPlantTime} />
                            </Section>
                        </>
                    )}

                    {tab === 'plan' &&
                        (coverage ? (
                            <div className="rounded-xl bg-bg-primary border border-border-light">
                                <TruckCoveragePanelBody accentColor={accentColor} {...coverage} />
                            </div>
                        ) : (
                            <EmptyTab
                                icon="fa-truck"
                                title="No coverage data for this order"
                                hint="Truck-coverage math runs only when the schedule is filtered to this order's plant. Filter to the plant on the Schedule tab and reopen this order."
                            />
                        ))}

                    {tab === 'suggestions' &&
                        (suggestions.length === 0 ? (
                            <EmptyTab
                                icon="fa-circle-check"
                                title="Nothing to flag on this order"
                                hint="The order is on track based on the current plan — no closer plant, no overbooking, no big-pour shortfall."
                            />
                        ) : (
                            suggestions.map((s, i) => <Suggestion key={i} {...s} />)
                        ))}
                </div>
            </div>
        </div>
    )
}

/** Build the Suggestions list — `{ icon, color, title, body }` shaped
 *  Suggestion props. Ordered by urgency: overbooked > big-pour shortfall >
 *  closer plant > dispatch mismatch. */
function buildSuggestions({ closerPlant, coverage, order }) {
    const out = []
    if (coverage?.overbooked) {
        const { computed, plantCode, poolAfterEffective, recommendedMoveTime, timing } = coverage
        const shortfall = Number.isFinite(poolAfterEffective) ? -poolAfterEffective : null
        const lines = []
        if (Number.isFinite(shortfall) && shortfall > 0) {
            lines.push(`Plant ${plantCode} is short ${shortfall} truck${shortfall === 1 ? '' : 's'} for this pour.`)
        }
        if (timing?.scheduledRateYph != null && timing?.effectiveRateYph != null) {
            lines.push(
                `Pour rate drops from ${timing.scheduledRateYph} to ${timing.effectiveRateYph} yd/hr — same yardage, just slower.`
            )
        }
        if (recommendedMoveTime) {
            lines.push(
                `Earliest viable start with ${computed} truck${computed === 1 ? '' : 's'}: ${recommendedMoveTime}.`
            )
        }
        out.push({
            body: lines.join(' '),
            color: '#d97706',
            icon: 'fa-handshake-angle',
            title: recommendedMoveTime
                ? `Move start to ${recommendedMoveTime} or send help`
                : 'Send help from another plant'
        })
    }
    if (coverage?.bigPour && coverage?.computed != null && (parseFloat(order?.truckCount) || 0) < coverage.computed) {
        out.push({
            body: `Big pour (${coverage.yardage}+ yd). Travel-based requirement is ${coverage.computed} trucks; dispatch booked ${parseFloat(order?.truckCount) || 0}.`,
            color: '#4f46e5',
            icon: 'fa-fire',
            title: `Book ${coverage.computed - (parseFloat(order?.truckCount) || 0)} more trucks for this pour`
        })
    }
    if (closerPlant && closerPlant.savings >= 5) {
        out.push({
            body: `Plant ${closerPlant.code} is ~${closerPlant.savings} min closer (${closerPlant.minutes} min vs ${closerPlant.assignedMinutes} min from ${order?.plantCode}). Reassigning shortens cycle time and frees trucks at ${order?.plantCode}.`,
            color: '#0ea5e9',
            icon: 'fa-route',
            title: `Reassign to plant ${closerPlant.code}`
        })
    }
    if (coverage?.differsFromDispatch && !coverage?.overbooked) {
        const { computed, dispatchTrucks } = coverage
        const delta = computed - dispatchTrucks
        out.push({
            body: `Travel-based truck count is ${computed}; dispatch booked ${dispatchTrucks}. ${
                delta > 0
                    ? `Add ${delta} to keep the pour on its scheduled rate.`
                    : `Drop ${-delta} — Jonel is overbooked.`
            }`,
            color: '#d97706',
            icon: 'fa-circle-info',
            title:
                delta > 0
                    ? `Add ${delta} truck${delta === 1 ? '' : 's'}`
                    : `Drop ${-delta} truck${-delta === 1 ? '' : 's'}`
        })
    }
    return out
}

export default OrderInfoModal
