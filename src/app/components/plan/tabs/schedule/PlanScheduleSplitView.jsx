/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ScheduleSnapshotService } from '../../../../../services/ScheduleSnapshotService'
import { clean, compareOrders, getOrderStatus } from '../../../../../utils/PlanScheduleUtility'
import { PLAN_META_KEY } from '../../../../../utils/PlanUtility'
import PlanScheduleTable, { SCHEDULE_ALL_COLUMN_KEYS, SCHEDULE_COMPARE_DEFAULT_COLUMNS } from './PlanScheduleTable'

const formatTimestamp = (iso) => {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString(undefined, {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

/** Flatten a `plant_production` map into a single `[{...order, plantCode}]`
 *  array so the same filter pipeline can run against snapshot + live. */
const flattenProduction = (plantProduction) => {
    if (!plantProduction || typeof plantProduction !== 'object') return []
    const out = []
    Object.entries(plantProduction).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((order) => out.push({ ...order, plantCode: order?.plantCode || code }))
    })
    return out
}

/** Build the dedupe key used to pair an order across snapshot + live.
 *  Prefer `orderId` (the canonical dispatch UUID); fall back to a
 *  best-effort composite when an order doesn't have one yet. */
const orderPairKey = (order) => {
    if (!order) return ''
    if (order.orderId) return String(order.orderId)
    return `${order.plantCode || ''}|${order.orderNum || ''}|${order.startTime || ''}`
}

/** Build a placeholder pseudo-order. The schedule table recognises the
 *  `__placeholder` marker and routes these to `PlaceholderRow` instead of
 *  the normal order row. We carry over enough fields from the reference
 *  order so the placeholder reads as "this is what's at this slot on the
 *  other side". `extras` carries kind-specific data (e.g. `movedToTime`
 *  for a moved-away placeholder so it can render the destination time). */
const buildPlaceholder = (kind, reference, key, extras = {}) => ({
    __placeholder: kind,
    customer: reference?.customer || '',
    orderId: `__placeholder__${key}`,
    orderNum: reference?.orderNum || '',
    plantCode: reference?.plantCode || '',
    startTime: reference?.startTime || '',
    yardage: reference?.yardage || '',
    ...extras
})

/** Pair snapshot + live orders by `orderId` (or composite fallback) and
 *  return two row-aligned arrays. Sort runs once over the union so the
 *  two arrays guarantee the same row sequence — index `i` on the left
 *  describes the same pour as index `i` on the right.
 *
 *  Four pair shapes:
 *
 *  1. Same on both sides (or same time on both)  → ONE pair, both real.
 *  2. Only on snapshot (cancelled / dropped)     → ONE pair, snap real,
 *     live placeholder "Removed from live".
 *  3. Only on live (added after snapshot)        → ONE pair, snap
 *     placeholder "Added since snapshot", live real.
 *  4. On both but the dispatcher moved the time  → TWO pairs:
 *       (a) at the snapshot's original slot — snap real, live a
 *           "Moved to HH:MM" ghost so the live column shows the slot
 *           was vacated.
 *       (b) at the live's new slot — snap a "Moved here from HH:MM"
 *           ghost so the snapshot column shows the slot was filled,
 *           live real.
 *
 *  Splitting moved orders is the only way to keep BOTH columns in
 *  chronological order while preserving pair alignment — the move
 *  surfaces visually as a ghost row at the vacated slot and a ghost row
 *  at the filled slot, both labelled with the corresponding time so the
 *  dispatcher can trace the move at a glance.
 */
function pairAlignedOrders(snapshotOrders, liveOrders, sortKey) {
    const snapMap = new Map()
    snapshotOrders.forEach((order) => snapMap.set(orderPairKey(order), order))
    const liveMap = new Map()
    liveOrders.forEach((order) => liveMap.set(orderPairKey(order), order))

    const pairs = []
    const seen = new Set()
    const enqueue = (key) => {
        if (seen.has(key)) return
        seen.add(key)
        const snap = snapMap.get(key) || null
        const live = liveMap.get(key) || null
        if (!snap && !live) return

        // Same scheduled start (or one-sided) → single row pair.
        if (snap && live && snap.startTime === live.startTime) {
            pairs.push({ key, live, snap, sortRef: snap })
            return
        }
        // Time moved — emit two pairs so each column reads chronologically.
        if (snap && live) {
            pairs.push({
                key: `${key}__from`,
                live: buildPlaceholder('movedTo', snap, `${key}__movedTo`, {
                    movedToTime: live.startTime
                }),
                snap,
                sortRef: snap
            })
            pairs.push({
                key: `${key}__to`,
                live,
                snap: buildPlaceholder('movedFrom', live, `${key}__movedFrom`, {
                    movedFromTime: snap.startTime
                }),
                sortRef: live
            })
            return
        }
        // One-sided (added or removed). Standard placeholder handling
        // happens at the .map() stage below.
        pairs.push({ key, live, snap, sortRef: snap || live })
    }
    snapMap.forEach((_value, key) => enqueue(key))
    liveMap.forEach((_value, key) => enqueue(key))
    pairs.sort((a, b) => compareOrders(a.sortRef, b.sortRef, sortKey))
    return {
        liveAligned: pairs.map((p) => p.live || buildPlaceholder('removed', p.snap, p.key)),
        snapAligned: pairs.map((p) => p.snap || buildPlaceholder('added', p.live, p.key))
    }
}

/** Filter + sort one production map using the same gates `usePlanScheduleData`
 *  applies to the live data. Keeps both columns honest about which rows
 *  the dispatcher's current filters reveal. */
const applyFilters = (orders, filters, isViewingToday) => {
    const { minYards, plantFilterSet, productFilter, query, showCancelled, showTest, sortKey, statusFilter } = filters
    const q = (query || '').trim().toLowerCase()
    const minYd = parseFloat(minYards) || 0
    return orders
        .filter((o) => {
            if (plantFilterSet?.size > 0 && !plantFilterSet.has(o.plantCode)) return false
            const kind = getOrderStatus(o.startTime, { isToday: isViewingToday })?.kind || 'scheduled'
            if (kind === 'cancelled' && !showCancelled) return false
            if (kind === 'test' && !showTest) return false
            if (statusFilter && statusFilter !== 'all' && kind !== statusFilter) return false
            if (productFilter && productFilter !== 'all' && clean(o.productCode) !== productFilter) return false
            if (minYd > 0 && (parseFloat(o.yardage) || 0) < minYd) return false
            if (q) {
                const haystack = [
                    o.orderNum,
                    o.customer,
                    o.customerNum,
                    o.address,
                    o.city,
                    o.productCode,
                    o.description,
                    o.contact,
                    o.phone,
                    o.poNumber,
                    o.jobNumber,
                    o.plantCode
                ]
                    .filter(Boolean)
                    .map((v) => String(v).toLowerCase())
                    .join(' | ')
                if (!haystack.includes(q)) return false
            }
            return true
        })
        .sort((a, b) => compareOrders(a, b, sortKey))
}

/**
 * Side-by-side schedule comparison. Renders TWO copies of the regular
 * `PlanScheduleTable` — one fed with the 5:30 PM snapshot orders, one
 * with the live orders — so both columns inherit the standard schedule
 * styling exactly (sticky header, row chrome, column widths, badges).
 * Both sides honor the same filter drawer state so chip / search / sort
 * changes update them in lockstep.
 *
 * The snapshot side is intentionally read-only: no audit / location
 * affordances, no synthetic rows, no live-data dependencies (ticket detail,
 * pool timelines, help rows, clock-ins). Just the orders as captured at
 * 5:30 PM, rendered against the same table component.
 */
export default function PlanScheduleSplitView({
    accentColor,
    detailByOrderId,
    filters,
    firstLoadOutByPlant,
    getCloserPlantForOrder,
    getJobTravelMin,
    getTravelOverrides,
    isMaximized,
    isPastDay,
    isToday,
    keyForOrder,
    nowMin,
    onOpenAudit,
    onOpenLocation,
    plantCityByCode,
    plantNameByCode,
    poolSourceByCode,
    poolTimeline,
    poolTimelinesByPlant,
    rawPlantProduction,
    singlePlant,
    /** Optional pre-loaded snapshot passed down from the parent so the
     *  stat strip and the split view share the same in-memory copy.
     *  When omitted, fall back to fetching here. */
    snapshot: providedSnapshot = undefined
}) {
    const [snapshot, setSnapshot] = useState(providedSnapshot ?? null)
    const [loading, setLoading] = useState(providedSnapshot === undefined)
    /** Compare-mode column toggle. Default keeps the table narrow (Start /
     *  Plant / Order / Customer / Location / Yards / Spacing) so two
     *  schedules fit side-by-side without horizontal scroll. Toggle to
     *  the full set when the dispatcher needs the extra columns. */
    const [showAllColumns, setShowAllColumns] = useState(false)
    const visibleColumns = showAllColumns ? SCHEDULE_ALL_COLUMN_KEYS : SCHEDULE_COMPARE_DEFAULT_COLUMNS
    const planDate = filters?.planDate

    /* Scroll-sync refs. Each PlanScheduleTable attaches a ref to its inner
     * scroll viewport; the effect below mirrors scrollTop + scrollLeft
     * between the two so the dispatcher reads pair-by-pair without
     * having to scroll each side independently. */
    const snapshotScrollRef = useRef(null)
    const liveScrollRef = useRef(null)
    useEffect(() => {
        const snap = snapshotScrollRef.current
        const live = liveScrollRef.current
        if (!snap || !live) return undefined
        // Lock token tracks which side initiated the in-flight sync so the
        // mirror assignment doesn't fire the partner's listener back into
        // an infinite loop. Cleared on the next animation frame.
        let lockedBy = null
        const mirror = (source, target) => () => {
            if (lockedBy && lockedBy !== source) return
            lockedBy = source
            if (target.scrollTop !== source.scrollTop) target.scrollTop = source.scrollTop
            if (target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft
            requestAnimationFrame(() => {
                lockedBy = null
            })
        }
        const onSnap = mirror(snap, live)
        const onLive = mirror(live, snap)
        snap.addEventListener('scroll', onSnap, { passive: true })
        live.addEventListener('scroll', onLive, { passive: true })
        return () => {
            snap.removeEventListener('scroll', onSnap)
            live.removeEventListener('scroll', onLive)
        }
    }, [snapshot, loading])

    useEffect(() => {
        if (providedSnapshot !== undefined) {
            setSnapshot(providedSnapshot)
            setLoading(false)
            return undefined
        }
        if (!planDate) return undefined
        let cancelled = false
        setLoading(true)
        ;(async () => {
            const result = await ScheduleSnapshotService.getSnapshot(planDate)
            if (!cancelled) {
                setSnapshot(result)
                setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [planDate, providedSnapshot])

    const liveOrders = useMemo(() => flattenProduction(rawPlantProduction), [rawPlantProduction])
    const snapshotOrders = useMemo(() => flattenProduction(snapshot?.plant_production), [snapshot])
    const filteredLive = useMemo(() => applyFilters(liveOrders, filters, isToday), [liveOrders, filters, isToday])
    const filteredSnapshot = useMemo(
        () => applyFilters(snapshotOrders, filters, isToday),
        [snapshotOrders, filters, isToday]
    )

    /** Row-aligned snapshot + live arrays. For every order that exists on
     *  EITHER side, both arrays get an entry at the same index — either
     *  the real order or a placeholder marker. The two tables then render
     *  with identical row counts and the dispatcher can read pair-by-pair
     *  down the screen instead of hunting for the matching row on the
     *  other side. Sort is single-pass over the union so both arrays
     *  guarantee the same row sequence. */
    const { liveAligned, snapAligned } = useMemo(
        () => pairAlignedOrders(filteredSnapshot, filteredLive, filters?.sortKey),
        [filteredSnapshot, filteredLive, filters?.sortKey]
    )

    if (loading) {
        return (
            <div className="rounded-xl p-10 text-center bg-bg-primary border border-border-light text-text-secondary">
                <i className="fas fa-circle-notch fa-spin text-[20px] mb-2 block" />
                Loading 5:30 PM snapshot…
            </div>
        )
    }
    if (!snapshot) {
        return (
            <div className="rounded-xl px-4 py-4 bg-amber-50 border border-amber-200 text-[13px] text-text-primary">
                <div className="font-semibold mb-1">No snapshot for {planDate || 'this day'}.</div>
                Snapshots are captured at 5:30 PM Central the evening before. Sundays and empty days are skipped, and
                future dates won&apos;t have a snapshot until their preceding 5:30 PM cycle runs.
            </div>
        )
    }

    const tableShared = {
        accentColor,
        // Compare mode hides annotation badges (status / service / hours
        // limit / needs-help) and routes placeholder rows through the
        // ghost renderer — keeps row heights consistent so the pairs read
        // side-by-side at the same Y.
        compareMode: true,
        filteredPlantCode: singlePlant,
        isMaximized,
        isPastDay,
        isPlantFiltered: !!singlePlant,
        isToday,
        keyForOrder,
        plantCityByCode,
        plantNameByCode,
        visibleColumns
    }

    return (
        <div className="flex flex-col gap-3">
            <SummaryStrip
                accentColor={accentColor}
                liveCount={filteredLive.length}
                onToggleShowAllColumns={() => setShowAllColumns((prev) => !prev)}
                showAllColumns={showAllColumns}
                snapshot={snapshot}
                snapshotCount={filteredSnapshot.length}
            />
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2 min-w-0">
                    <ColumnLabel
                        accentColor={accentColor}
                        icon="fa-clock-rotate-left"
                        text="Original (5:30 PM snapshot)"
                    />
                    <div className="min-w-0">
                        <PlanScheduleTable
                            {...tableShared}
                            // Snapshot side: no live-only inputs. Empty
                            // arrays / nulls so the table renders pure
                            // order rows without synthetic clock-in /
                            // help / send-home / slot interleaving.
                            clockInRows={[]}
                            detailByOrderId={{}}
                            firstLoadOutByPlant={null}
                            getCloserPlantForOrder={undefined}
                            getTravelOverrides={undefined}
                            helpRows={[]}
                            nowMin={null}
                            onOpenAudit={undefined}
                            onOpenLocation={onOpenLocation}
                            orders={snapAligned}
                            poolSourceByCode={{}}
                            poolTimeline={{}}
                            poolTimelinesByPlant={{}}
                            pullUpRows={[]}
                            scrollContainerRef={snapshotScrollRef}
                            sendHomeRows={[]}
                            showExtraRows={false}
                            suggestedSlotRows={[]}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                    <ColumnLabel accentColor={accentColor} icon="fa-rss" text="Live now" />
                    <div className="min-w-0">
                        <PlanScheduleTable
                            {...tableShared}
                            // Live side: full data parity with the
                            // standard PlanScheduleTable, minus the
                            // synthetic-row toggles (showExtraRows=false)
                            // so both columns stay structurally identical.
                            clockInRows={[]}
                            detailByOrderId={detailByOrderId || {}}
                            firstLoadOutByPlant={firstLoadOutByPlant || null}
                            getCloserPlantForOrder={getCloserPlantForOrder}
                            getJobTravelMin={getJobTravelMin}
                            getTravelOverrides={getTravelOverrides}
                            helpRows={[]}
                            nowMin={nowMin}
                            onOpenAudit={onOpenAudit}
                            onOpenLocation={onOpenLocation}
                            orders={liveAligned}
                            poolSourceByCode={poolSourceByCode || {}}
                            poolTimeline={poolTimeline || {}}
                            poolTimelinesByPlant={poolTimelinesByPlant || {}}
                            pullUpRows={[]}
                            scrollContainerRef={liveScrollRef}
                            sendHomeRows={[]}
                            showExtraRows={false}
                            suggestedSlotRows={[]}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function SummaryStrip({ accentColor, liveCount, onToggleShowAllColumns, showAllColumns, snapshot, snapshotCount }) {
    return (
        <div className="rounded-xl flex flex-wrap items-center gap-3 px-3 py-2 bg-bg-secondary border border-border-light">
            <span className="text-[11.5px] font-semibold text-text-secondary">
                <i className="fas fa-code-compare text-[10px] mr-1.5" style={{ color: 'var(--text-primary)' }} />
                Comparing original vs. live
                {snapshot?.captured_at && (
                    <span className="ml-2 text-text-tertiary font-normal">
                        · snapshot taken {formatTimestamp(snapshot.captured_at)}
                    </span>
                )}
            </span>
            <span className="flex-1 min-w-[8px]" />
            <button
                type="button"
                onClick={onToggleShowAllColumns}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer bg-bg-primary border border-border-light text-text-secondary hover:bg-bg-tertiary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                title={
                    showAllColumns
                        ? 'Collapse to the compact comparison columns (Start, Plant, Order, Customer, Location, Yards, Spacing)'
                        : 'Show every schedule column on both sides'
                }
            >
                <i className={`fas ${showAllColumns ? 'fa-compress' : 'fa-table-columns'} text-[10px]`} />
                {showAllColumns ? 'Compact columns' : 'Show all columns'}
            </button>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-secondary">
                Original
                <span className="font-mono tabular-nums rounded px-1.5 bg-bg-tertiary text-text-primary">
                    {snapshotCount}
                </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-secondary">
                Live
                <span className="font-mono tabular-nums rounded px-1.5 bg-bg-tertiary text-text-primary">
                    {liveCount}
                </span>
            </span>
        </div>
    )
}

function ColumnLabel({ accentColor, icon, text }) {
    return (
        <div className="px-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 text-text-secondary">
            <i className={`fas ${icon} text-[10px]`} style={{ color: 'var(--text-primary)' }} />
            {text}
        </div>
    )
}
