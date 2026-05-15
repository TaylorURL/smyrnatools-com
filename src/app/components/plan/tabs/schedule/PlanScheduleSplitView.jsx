/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { ScheduleSnapshotService } from '../../../../../services/ScheduleSnapshotService'
import { clean, compareOrders, getOrderStatus } from '../../../../../utils/PlanScheduleUtility'
import { PLAN_META_KEY } from '../../../../../utils/PlanUtility'
import PlanScheduleTable from './PlanScheduleTable'

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
    const planDate = filters?.planDate

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
            <div className="rounded-xl px-4 py-4 bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
                <div className="font-semibold mb-1">No snapshot for {planDate || 'this day'}.</div>
                Snapshots are captured at 5:30 PM Central the evening before. Sundays and empty days are skipped, and
                future dates won&apos;t have a snapshot until their preceding 5:30 PM cycle runs.
            </div>
        )
    }

    const tableShared = {
        accentColor,
        filteredPlantCode: singlePlant,
        isMaximized,
        isPastDay,
        isPlantFiltered: !!singlePlant,
        isToday,
        keyForOrder,
        plantCityByCode,
        plantNameByCode
    }

    return (
        <div className="flex flex-col gap-3">
            <SummaryStrip
                accentColor={accentColor}
                liveCount={filteredLive.length}
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
                            orders={filteredSnapshot}
                            poolSourceByCode={{}}
                            poolTimeline={{}}
                            poolTimelinesByPlant={{}}
                            pullUpRows={[]}
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
                            getTravelOverrides={getTravelOverrides}
                            helpRows={[]}
                            nowMin={nowMin}
                            onOpenAudit={onOpenAudit}
                            onOpenLocation={onOpenLocation}
                            orders={filteredLive}
                            poolSourceByCode={poolSourceByCode || {}}
                            poolTimeline={poolTimeline || {}}
                            poolTimelinesByPlant={poolTimelinesByPlant || {}}
                            pullUpRows={[]}
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

function SummaryStrip({ accentColor, liveCount, snapshot, snapshotCount }) {
    return (
        <div className="rounded-xl flex flex-wrap items-center gap-3 px-3 py-2 bg-bg-secondary border border-border-light">
            <span className="text-[11.5px] font-semibold text-text-secondary">
                <i className="fas fa-code-compare text-[10px] mr-1.5" style={{ color: accentColor }} />
                Comparing original vs. live
                {snapshot?.captured_at && (
                    <span className="ml-2 text-text-tertiary font-normal">
                        · snapshot taken {formatTimestamp(snapshot.captured_at)}
                    </span>
                )}
            </span>
            <span className="flex-1 min-w-[8px]" />
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
            <i className={`fas ${icon} text-[10px]`} style={{ color: accentColor }} />
            {text}
        </div>
    )
}
