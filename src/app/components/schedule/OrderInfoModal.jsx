import React, { useEffect, useMemo, useState } from 'react'

import { TruckCoveragePanelBody } from './TruckCoverageHoverCard'

const clean = (value) => (value == null ? '' : String(value).trim())

/** A single label-over-value pair. Stays quiet — no border, no tint. The
 *  label is small uppercase tertiary text; the value is regular weight
 *  primary so it reads at the same level as body copy elsewhere on the
 *  site (mirrors the dashboard sections' StatChip / KeyValue style).
 *
 *  `overflowWrap: anywhere` on the value forces long unbroken tokens to
 *  wrap inside the column instead of pushing past the card edge. */
function Field({ hint, label, mono, value, wide }) {
    const text = clean(value)
    if (!text) return null
    return (
        <div className={`flex flex-col gap-0.5 min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span
                className={`text-[13px] leading-snug ${mono ? 'font-mono' : ''}`}
                style={{
                    color: 'var(--text-primary)',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word'
                }}
                title={text}
            >
                {text}
                {hint && (
                    <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-tertiary)' }}>
                        {hint}
                    </span>
                )}
            </span>
        </div>
    )
}

/** Section card — quiet container around a group of fields. Heading-bar
 *  look mirrors the schedule's KPI strip / filter drawer. */
function Section({ children, icon, title }) {
    if (!children) return null
    const validChildren = React.Children.toArray(children).filter(Boolean)
    if (validChildren.length === 0) return null
    return (
        <div
            className="rounded-xl"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="px-3 py-2 flex items-center gap-2 border-b rounded-t-xl"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
            >
                <i className={`fas ${icon} text-[10.5px]`} style={{ color: 'var(--text-tertiary)' }} />
                <span
                    className="text-[10.5px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {title}
                </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 px-3 py-3">{validChildren}</div>
        </div>
    )
}

/** One row in the Suggestions tab — colored chip on the left, headline +
 *  body text on the right. Optional CTA for "apply" actions. */
function Suggestion({ body, color = '#0ea5e9', icon, title }) {
    return (
        <div
            className="rounded-xl px-3 py-3 flex items-start gap-3"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${color}1f`, color }}
            >
                <i className={`fas ${icon} text-[12px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </div>
                <div
                    className="text-[12px] mt-0.5 leading-snug"
                    style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}
                >
                    {body}
                </div>
            </div>
        </div>
    )
}

/** Empty-state message used by the Plan / Suggestions tabs when there's
 *  nothing to show. */
function EmptyTab({ hint, icon, title }) {
    return (
        <div
            className="rounded-xl px-5 py-8 text-center flex flex-col items-center gap-2"
            style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border-medium)' }}
        >
            <i className={`fas ${icon} text-[24px]`} style={{ color: 'var(--text-tertiary)' }} />
            <div className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                {title}
            </div>
            {hint && (
                <div className="text-[12px] leading-snug max-w-md" style={{ color: 'var(--text-tertiary)' }}>
                    {hint}
                </div>
            )}
        </div>
    )
}

const TABS = [
    { icon: 'fa-clipboard-list', id: 'details', label: 'Details' },
    { icon: 'fa-truck', id: 'plan', label: 'Plan' },
    { icon: 'fa-lightbulb', id: 'suggestions', label: 'Suggestions' }
]

/**
 * Tabbed modal for a single dispatch order. Three tabs:
 *
 *   1. Details — every field carried on the order header (sourced from the
 *      Daily Order Listing import in `dispatch_data`).
 *   2. Plan — the truck-coverage explainer that used to render as a hover
 *      side-panel on the schedule table's Trucks column. Reuses the same
 *      `TruckCoveragePanelBody` so the math + copy stays identical.
 *   3. Suggestions — actionable nudges the dispatcher can take on this
 *      order: closer plant, recommended move time when overbooked, big-pour
 *      shortfall hint, dispatch-vs-canonical truck-count mismatch.
 *
 * Visual language mirrors the rest of the Schedule tab — section cards on
 * a tinted body, header bar on each panel, no per-field tile borders.
 */
function OrderInfoModal({ accentColor = '#2563eb', closerPlant, coverage, onClose, order, plantName }) {
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
    const fullAddress = useMemo(() => {
        const parts = [clean(order?.address), clean(order?.city), clean(order?.state), clean(order?.zip)].filter(
            Boolean
        )
        return parts.length ? parts.join(', ') : clean(order?.address)
    }, [order])
    const stateZip = useMemo(() => [clean(order?.state), clean(order?.zip)].filter(Boolean).join(' '), [order])

    const suggestions = useMemo(
        () => buildSuggestions({ closerPlant, coverage, order }),
        [closerPlant, coverage, order]
    )

    if (!order) return null

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', zIndex: 2147483000 }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '90vh',
                    maxWidth: 760
                }}
            >
                <div
                    className="flex items-start gap-3 px-5 py-3 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-clipboard-list text-[14px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                            Order {orderNumLabel}
                        </div>
                        <div
                            className="text-[12px] mt-0.5 truncate"
                            style={{ color: 'var(--text-secondary)' }}
                            title={customerLabel}
                        >
                            {customerLabel || '—'}
                            {homePlantCode && (
                                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                                    · home plant {homePlantCode}
                                    {plantName ? ` (${plantName})` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close"
                        title="Close"
                    >
                        <i className="fas fa-xmark text-[14px]" />
                    </button>
                </div>

                <div
                    className="flex items-center gap-1 px-5 py-2 border-b overflow-x-auto"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
                >
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
                                        className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                                        style={{
                                            background: active ? 'rgba(255,255,255,0.3)' : 'var(--bg-tertiary)',
                                            color: active ? '#fff' : 'var(--text-secondary)',
                                            height: 16,
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

                <div
                    className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3"
                    style={{ background: 'var(--bg-secondary)' }}
                >
                    {tab === 'details' && (
                        <>
                            <Section icon="fa-hashtag" title="Identification">
                                <Field label="Order #" mono value={order.orderNum} />
                                <Field label="Order ID" mono value={order.orderId} />
                                <Field label="PO #" mono value={order.poNumber} />
                                <Field label="Job #" mono value={order.jobNumber} />
                            </Section>

                            <Section icon="fa-user-tie" title="Customer">
                                <Field label="Name" value={order.customer} wide />
                                <Field label="Customer #" mono value={order.customerNum} />
                            </Section>

                            <Section icon="fa-location-dot" title="Job Location">
                                <Field label="Address" value={fullAddress} wide />
                                <Field label="City" value={order.city} />
                                <Field label="State / ZIP" mono value={stateZip} />
                            </Section>

                            <Section icon="fa-flask" title="Product">
                                <Field label="Code" mono value={order.productCode} />
                                <Field label="Description" value={order.description} wide />
                            </Section>

                            <Section icon="fa-clock" title="Schedule">
                                <Field label="Start time" mono value={order.startTime} />
                                <Field label="Spacing" mono value={order.rate} hint="between loads" />
                                <Field
                                    label="Yardage"
                                    mono
                                    value={yardage > 0 ? `${yardage} yd` : ''}
                                    hint={loadSize > 0 ? `${loadSize} yd / load` : null}
                                />
                                <Field
                                    label="Trucks"
                                    mono
                                    value={truckCount > 0 ? String(truckCount) : ''}
                                    hint={order.truckClass ? `class ${clean(order.truckClass)}` : null}
                                />
                                <Field label="Travel to job" mono value={order.toJobTime} />
                                <Field label="Travel to plant" mono value={order.toPlantTime} />
                            </Section>

                            <Section icon="fa-phone" title="Contact">
                                <Field label="Name" value={order.contact} />
                                <Field label="Phone" mono value={order.phone} />
                            </Section>
                        </>
                    )}

                    {tab === 'plan' &&
                        (coverage ? (
                            <div
                                className="rounded-xl"
                                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                            >
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

/** Build the Suggestions list from the inputs we already have. Each entry
 *  is `{ icon, color, title, body }` — a Suggestion-component-shaped object.
 *  Suggestions are ordered by urgency: overbooked > big-pour shortfall >
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
