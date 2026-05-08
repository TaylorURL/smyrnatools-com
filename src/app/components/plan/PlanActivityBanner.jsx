import React, { useMemo } from 'react'

import { getNowCstMinutes } from '../../../utils/PlanUtility'
import useRecentLoadedTickets from '../../hooks/useRecentLoadedTickets'
import { PlantBadge } from './PlanScheduleBadges'

/** Minutes a ticket stays in the banner before it ages out. */
const ACTIVITY_WINDOW_MIN = 30

/** Format a ticket's `loadedTime` as relative-to-now ("12m ago"), pinning
 *  the freshest reads to "just now" so the banner doesn't flicker. */
const formatAgo = (loadedMin, nowMin) => {
    if (!Number.isFinite(loadedMin) || !Number.isFinite(nowMin)) return ''
    const diff = nowMin - loadedMin
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    const h = Math.floor(diff / 60)
    return `${h}h ago`
}

/** One ticket entry — renders the loading plant chip, the truck number,
 *  the order tag, and the customer in a compact horizontal row that the
 *  marquee track repeats end-to-end. */
function ActivityEntry({ accentColor, item, nowMin, plantNameByCode }) {
    const plantName = plantNameByCode?.[item.plantCode] || item.plantCode
    const orderTag = item.orderNum ? `#${item.orderNum}` : ''
    return (
        <div className="inline-flex items-center gap-3 shrink-0 px-3">
            <PlantBadge code={item.plantCode} fallback={accentColor} name={plantName} />
            <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                <i className="fas fa-truck text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                <span className="font-mono tabular-nums font-semibold">{item.truckNum}</span>
            </span>
            {(orderTag || item.customer) && (
                <span
                    className="inline-flex items-center gap-1.5 text-[12px]"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-arrow-right text-[9px]" style={{ color: 'var(--text-tertiary)' }} />
                    {orderTag && <span className="font-mono tabular-nums">{orderTag}</span>}
                    {item.customer && (
                        <span className="truncate max-w-[260px]" title={item.customer}>
                            {item.customer}
                        </span>
                    )}
                </span>
            )}
            <span className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                {formatAgo(item.loadedMin, nowMin)}
            </span>
        </div>
    )
}

/**
 * Live "just-loaded" ticker pinned to the bottom of PlanView. Pulls
 * today's dispatch tickets every minute, keeps the entries that loaded
 * inside the last 30 clock minutes, and scrolls them right-to-left at a
 * steady pace. Region-scoped via `plantCodes`. Renders nothing when no
 * recent loads exist so the bottom of the page stays clean on quiet
 * days.
 */
function PlanActivityBanner({ accentColor, plantCodes, plantNameByCode }) {
    const items = useRecentLoadedTickets({ plantCodes, withinMinutes: ACTIVITY_WINDOW_MIN })

    /* Current CST minute-of-day for "X min ago" labels — recomputed only
     * when the items list itself changes since the underlying hook
     * already re-runs once a minute and emits a fresh sort. CST anchor
     * keeps the relative-time math consistent with the dispatch wall
     * clock the tickets came from. */
    const nowMin = useMemo(() => getNowCstMinutes(), [items])

    if (!items.length) return null

    return (
        <div
            className="shrink-0 overflow-hidden border-t"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
            aria-label="Recent dispatch activity"
        >
            <div className="flex items-stretch">
                <div
                    className="shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-r"
                    style={{
                        background: 'var(--bg-tertiary)',
                        borderColor: 'var(--border-light)',
                        color: accentColor
                    }}
                >
                    <span className="relative inline-flex h-2 w-2">
                        <span
                            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                            style={{ background: accentColor }}
                        />
                        <span
                            className="relative inline-flex rounded-full h-2 w-2"
                            style={{ background: accentColor }}
                        />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                        Just loaded
                    </span>
                </div>
                <div className="flex-1 overflow-hidden py-1.5">
                    {/* Track is a flex row repeated twice. The marquee animation
                     * translates -50% so the duplicate copy slides into the
                     * exact starting position for a seamless loop. The pause-
                     * on-hover keeps a glance-readable. */}
                    <div className="flex w-max animate-marquee-scroll hover:[animation-play-state:paused]">
                        {[0, 1].map((cycleIdx) => (
                            <div key={cycleIdx} className="flex" aria-hidden={cycleIdx === 1}>
                                {items.map((item) => (
                                    <ActivityEntry
                                        key={`${cycleIdx}-${item.key}`}
                                        accentColor={accentColor}
                                        item={item}
                                        nowMin={nowMin}
                                        plantNameByCode={plantNameByCode}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlanActivityBanner
