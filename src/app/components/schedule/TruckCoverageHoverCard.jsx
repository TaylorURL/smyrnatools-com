import React, { useEffect, useRef, useState } from 'react'

import { formatMinutesClock } from '../../../utils/PlanUtility'

const PANEL_WIDTH_PX = 380
const PANEL_TRANSITION = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease'

/** Single icon + label + value row inside the coverage hover card. */
function HoverRow({ children, icon, iconColor, label, value }) {
    return (
        <div className="flex items-start gap-2 py-1.5">
            <div
                className="flex items-center justify-center rounded-md shrink-0 mt-0.5"
                style={{ background: `${iconColor}14`, color: iconColor, height: 22, width: 22 }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {label}
                    </span>
                    <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {value}
                    </span>
                </div>
                {children}
            </div>
        </div>
    )
}

function HoverNote({ children }) {
    return (
        <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>
            {children}
        </div>
    )
}

/**
 * Rich truck-coverage hover explainer for a single dispatch order. Shared
 * between PlanView's schedule tab and the dashboard schedule preview.
 *
 * Pool-timeline driven rows (`poolSource`, `poolAtStart`, `poolAfter`,
 * `poolAfterEffective`, `helpInWindow`, `timing`, `recommendedMoveTime`)
 * are all optional — when callers can't compute them (e.g. the dashboard
 * preview), the card gracefully degrades to the canonical truck calc +
 * Jonel mismatch warning.
 */
/**
 * Side-panel wrapper. Slides in from the right edge of the schedule table's
 * relative wrapper (NOT the viewport) when `isOpen` is true. Sized to match
 * the table's height — `position: absolute; inset: 0 0 0 auto`. The detail
 * props for an individual order are captured into local state on first
 * non-null payload so the slide-out animation can still render the
 * previous content after the consumer drops `payload` to null.
 */
export default function TruckCoverageHoverCard({ accentColor, isOpen, onMouseEnter, onMouseLeave, payload }) {
    const [retainedPayload, setRetainedPayload] = useState(payload || null)
    const exitTimer = useRef(null)
    useEffect(() => {
        if (payload) {
            if (exitTimer.current) {
                clearTimeout(exitTimer.current)
                exitTimer.current = null
            }
            setRetainedPayload(payload)
            return undefined
        }
        exitTimer.current = setTimeout(() => setRetainedPayload(null), 260)
        return () => {
            if (exitTimer.current) clearTimeout(exitTimer.current)
        }
    }, [payload])
    const data = payload || retainedPayload
    return (
        <aside
            aria-hidden={!isOpen}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="absolute top-0 bottom-0 right-0 overflow-y-auto rounded-xl"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                boxShadow: isOpen
                    ? '0 18px 40px -12px rgba(0, 0, 0, 0.35), 0 6px 14px -6px rgba(0, 0, 0, 0.18)'
                    : 'none',
                color: 'var(--text-primary)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: 'normal',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: PANEL_TRANSITION,
                whiteSpace: 'normal',
                width: `min(${PANEL_WIDTH_PX}px, 92vw)`,
                zIndex: 20
            }}
        >
            {data ? <TruckCoveragePanelBody accentColor={accentColor} {...data} /> : null}
        </aside>
    )
}

function TruckCoveragePanelBody({
    accentColor,
    bigPour,
    computed,
    customer,
    differsFromDispatch,
    dispatchTrucks,
    helpInWindow,
    kickerHeld = 0,
    kickerBigPourActive = false,
    liveTravel,
    orderNum,
    overbooked,
    plantCode,
    poolAfter,
    poolAfterEffective,
    poolAtStart,
    poolSource,
    recommendedMoveTime,
    timing,
    yardage
}) {
    const statusColor = overbooked ? '#d97706' : '#16a34a'
    const statusIcon = overbooked ? 'fa-gauge-simple-high' : 'fa-circle-check'
    const statusTitle = overbooked ? 'Pour will run at reduced rate' : 'This order is covered'
    const shortfall = overbooked && Number.isFinite(poolAfterEffective) ? -poolAfterEffective : 0
    const scheduledYph = timing?.scheduledRateYph
    const actualYph = timing?.effectiveRateYph
    const statusSub = overbooked
        ? `${plantCode} is short ${shortfall} truck${shortfall === 1 ? '' : 's'}. ${
              Number.isFinite(scheduledYph) && Number.isFinite(actualYph)
                  ? `Pour rate drops from ${scheduledYph} to ${actualYph} yd/hr — same yardage, just takes longer to finish.`
                  : 'Fewer trucks cycling means a lower pour rate — the pour still finishes, it just takes longer.'
          } Consider sending help from another plant to keep the pour on its scheduled rate.`
        : `${plantCode} has enough trucks to keep this pour on pace.`
    return (
        <div className="p-5 text-left font-normal normal-case">
            <div
                className="flex items-center gap-2 pb-3 mb-3"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                <div
                    className="flex items-center justify-center rounded-lg shrink-0"
                    style={{ background: `${accentColor}14`, color: accentColor, height: 34, width: 34 }}
                >
                    <i className="fas fa-truck text-[14px]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        Truck Coverage
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {orderNum ? `#${orderNum}` : ''}
                        {orderNum && customer ? ' · ' : ''}
                        {customer || `Plant ${plantCode}`}
                    </div>
                </div>
            </div>

            <HoverRow
                icon="fa-list-check"
                iconColor={accentColor}
                label="Trucks needed"
                value={`${Number.isFinite(computed) ? computed : '—'} truck${computed === 1 ? '' : 's'}`}
            >
                {bigPour && <HoverNote>Big pour ({yardage}+ yd) — we require at least 12 trucks.</HoverNote>}
                {liveTravel && <HoverNote>Based on live Google traffic times.</HoverNote>}
            </HoverRow>

            {poolSource && (
                <HoverRow
                    icon="fa-warehouse"
                    iconColor="#0ea5e9"
                    label={`Plant ${plantCode}`}
                    value={`${poolSource.base} active assigned mixer${poolSource.base === 1 ? '' : 's'}`}
                >
                    {poolSource.missing > 0 && (
                        <HoverNote>
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                −{poolSource.missing} operator{poolSource.missing === 1 ? '' : 's'} out today
                            </span>{' '}
                            <span style={{ color: 'var(--text-tertiary)' }}>(of {poolSource.rawBase} assigned)</span>
                        </HoverNote>
                    )}
                    {(poolSource.send > 0 || poolSource.recv > 0) && (
                        <HoverNote>
                            {poolSource.recv > 0 && (
                                <>
                                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                        +{poolSource.recv} help coming in
                                    </span>
                                    {poolSource.send > 0 ? ' · ' : ''}
                                </>
                            )}
                            {poolSource.send > 0 && (
                                <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                    −{poolSource.send} sent elsewhere
                                </span>
                            )}
                        </HoverNote>
                    )}
                </HoverRow>
            )}

            {Number.isFinite(poolAtStart) && (
                <HoverRow
                    icon="fa-clock"
                    iconColor="#8b5cf6"
                    label="Trucks in rotation"
                    value={`${poolAtStart} truck${poolAtStart === 1 ? '' : 's'} at plant`}
                >
                    {overbooked ? (
                        <HoverNote>
                            <span style={{ color: '#d97706', fontWeight: 600 }}>
                                {bigPour
                                    ? `Not enough trucks to hold 120 yd/hr loaded — pour runs at a reduced rate.`
                                    : `${plantCode} doesn't have enough trucks to hold the scheduled pour rate — the pour still runs, just slower.`}
                            </span>
                        </HoverNote>
                    ) : poolAfter < 0 ? (
                        <HoverNote>
                            Starts <b style={{ color: '#d97706' }}>{-poolAfter}</b> short, but {helpInWindow} truck
                            {helpInWindow === 1 ? '' : 's'} arriving mid-pour will cover the later trips.
                        </HoverNote>
                    ) : (
                        <HoverNote>
                            There {poolAfter === 1 ? 'is' : 'are'}{' '}
                            <b style={{ color: 'var(--text-primary)' }}>{poolAfter}</b> truck
                            {poolAfter === 1 ? '' : 's'} available at this plant after sending out{' '}
                            <b style={{ color: 'var(--text-primary)' }}>{computed}</b> truck
                            {computed === 1 ? '' : 's'} for this order.
                        </HoverNote>
                    )}
                </HoverRow>
            )}

            {kickerHeld > 0 && (
                <HoverRow
                    icon="fa-shield-halved"
                    iconColor="#d97706"
                    label="Kicker reserve"
                    value={`−${kickerHeld} truck${kickerHeld === 1 ? '' : 's'} held`}
                >
                    <HoverNote>
                        Held back from the pool to absorb late yardage adds. Every 4 jobs reserves{' '}
                        {kickerBigPourActive ? '2 trucks (block contains a big pour)' : '1 truck'} for ~2–3 hours.
                    </HoverNote>
                </HoverRow>
            )}

            {helpInWindow > 0 && (
                <HoverRow
                    icon="fa-right-to-bracket"
                    iconColor="#16a34a"
                    label="Extra help mid-pour"
                    value={`+${helpInWindow} truck${helpInWindow === 1 ? '' : 's'}`}
                >
                    <HoverNote>
                        Trucks returning from other jobs (or help arriving) land at {plantCode} while this pour is still
                        running — they&apos;ll cover later trips.
                    </HoverNote>
                </HoverRow>
            )}

            {Number.isFinite(poolAtStart) && (
                <div
                    className="flex items-start gap-2 mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--border-light)' }}
                >
                    <i className={`fas ${statusIcon} text-[16px] mt-0.5`} style={{ color: statusColor }} />
                    <div>
                        <div className="text-[12px] font-bold" style={{ color: statusColor }}>
                            {statusTitle}
                        </div>
                        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {statusSub}
                        </div>
                    </div>
                </div>
            )}

            {overbooked && timing && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <div
                            className="flex items-center justify-center rounded-md shrink-0"
                            style={{
                                background: 'rgba(217, 119, 6, 0.14)',
                                color: '#d97706',
                                height: 22,
                                width: 22
                            }}
                        >
                            <i className="fas fa-gauge-simple-high text-[11px]" />
                        </div>
                        <div className="text-[12px] font-bold" style={{ color: '#d97706' }}>
                            Pour pace
                        </div>
                    </div>
                    <div className="text-[11px] leading-relaxed pl-7" style={{ color: 'var(--text-secondary)' }}>
                        {Number.isFinite(timing.firstArrivalMin) && (
                            <div>
                                First truck at job:{' '}
                                <b style={{ color: 'var(--text-primary)' }}>
                                    {formatMinutesClock(timing.firstArrivalMin)}
                                </b>{' '}
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                    {timing.firstTruckIsLate ? '(late — no truck available)' : '(on time)'}
                                </span>
                            </div>
                        )}
                        {Number.isFinite(timing.scheduledRateYph) && Number.isFinite(timing.effectiveRateYph) && (
                            <div className="mt-0.5">
                                Pour rate: <b style={{ color: '#d97706' }}>{timing.effectiveRateYph} yd/hr</b>{' '}
                                <span style={{ color: 'var(--text-tertiary)' }}>
                                    (scheduled {timing.scheduledRateYph} yd/hr)
                                </span>
                            </div>
                        )}
                        <div className="mt-0.5">
                            Pour finishes around{' '}
                            <b style={{ color: '#d97706' }}>{formatMinutesClock(timing.estimatedCompletionMin)}</b>{' '}
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                (vs. scheduled {formatMinutesClock(timing.scheduledCompletionMin)})
                            </span>
                        </div>
                        {timing.delayMin > 0 && (
                            <div className="mt-0.5">
                                <b style={{ color: '#d97706' }}>
                                    ~
                                    {timing.delayMin >= 60
                                        ? `${Math.floor(timing.delayMin / 60)}h ${timing.delayMin % 60}m`
                                        : `${timing.delayMin} min`}
                                </b>{' '}
                                longer than scheduled — cycling {timing.actualTrucks} truck
                                {timing.actualTrucks === 1 ? '' : 's'} instead of {timing.requiredTrucks}.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {overbooked && Number.isFinite(recommendedMoveTime) && (
                <div
                    className="flex items-start gap-2 mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--border-light)' }}
                >
                    <div
                        className="flex items-center justify-center rounded-md shrink-0 mt-0.5"
                        style={{ background: 'rgba(14, 165, 233, 0.14)', color: '#0ea5e9', height: 22, width: 22 }}
                    >
                        <i className="fas fa-calendar-xmark text-[11px]" />
                    </div>
                    <div className="text-[11px] leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                        <div className="font-bold text-[12px]" style={{ color: '#0ea5e9' }}>
                            To pour at full rate
                        </div>
                        Move this order to{' '}
                        <b style={{ color: 'var(--text-primary)' }}>{formatMinutesClock(recommendedMoveTime)}</b> —
                        that&apos;s the earliest {plantCode} has {computed} truck
                        {computed === 1 ? '' : 's'} free to hold the scheduled pour rate.
                    </div>
                </div>
            )}
            {overbooked && !Number.isFinite(recommendedMoveTime) && (
                <div
                    className="flex items-start gap-2 mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--border-light)' }}
                >
                    <div
                        className="flex items-center justify-center rounded-md shrink-0 mt-0.5"
                        style={{ background: 'rgba(217, 119, 6, 0.14)', color: '#d97706', height: 22, width: 22 }}
                    >
                        <i className="fas fa-calendar-xmark text-[11px]" />
                    </div>
                    <div className="text-[11px] leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                        No time later today has the full truck count — {plantCode} will need inbound help from another
                        plant to pour this order at the scheduled rate.
                    </div>
                </div>
            )}

            {differsFromDispatch && dispatchTrucks > 0 && (
                <div
                    className="flex items-start gap-2 mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--border-light)' }}
                >
                    <i className="fas fa-circle-info text-[14px] mt-0.5" style={{ color: '#d97706' }} />
                    <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Jonel booked <b>{dispatchTrucks}</b>, but our math says you really need <b>{computed}</b>. Go
                        with our number — Jonel&apos;s count is often off.
                    </div>
                </div>
            )}
        </div>
    )
}
