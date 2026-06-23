/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import { fmtYards } from '../../../utils/PlanStatisticsFormatUtility'
import { isExcludedOrder, PLAN_META_KEY, plantBadgeColor } from '../../../utils/PlanUtility'

/** Cap the progress bar fill so over-100% rows don't overflow the track —
 *  the raw percent still reads alongside so dispatchers see when a plant
 *  has shipped more than was on the board (kicker yardage, in-the-field
 *  add-ons). */
const PROGRESS_BAR_CAP_PCT = 100

/** Tint thresholds for the per-plant progress bar. Mirrors the
 *  green/blue/amber palette used elsewhere in the Plan tabs without
 *  inventing a new scale. */
const PROGRESS_BAND_DONE_PCT = 100
const PROGRESS_BAND_ON_TRACK_PCT = 60

const fmtRoundedPct = (n) => (Number.isFinite(n) ? `${Math.round(n)}%` : '—')

const formatFriendlyDate = (planDate) => {
    if (!planDate) return ''
    return new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
        year: 'numeric'
    })
}

/** Build per-plant "scheduled vs loaded so far" rows. Scheduled yardage
 *  comes from the dispatcher's curated `plant_production` blob; loaded
 *  yardage comes from `detailByOrderId[orderId].loadedYardage`, which is
 *  the sum of every ticket loaded for the order regardless of which
 *  plant physically loaded it. That matches the home-plant accounting
 *  used by `buildPerPlantLoadAttribution` in PlanStatisticsSchedule, so
 *  the Ongoing tab agrees with the Statistics totals.
 *
 *  Every plant that either appears in today's `stats` (working roster)
 *  OR has a `plant_production` block surfaces in the list — even an
 *  empty day reads as "0 / 0 yd · idle" instead of vanishing. */
const buildPlantProgressRows = ({ detailByOrderId, plantNameByCode, plantProduction, stats }) => {
    const codes = new Set()
    ;(stats || []).forEach((stat) => stat?.code && codes.add(stat.code))
    Object.keys(plantProduction || {}).forEach((code) => {
        if (code !== PLAN_META_KEY) codes.add(code)
    })

    const rows = []
    codes.forEach((code) => {
        const block = plantProduction?.[code]
        const orders = Array.isArray(block?.orders) ? block.orders : []
        let scheduled = 0
        let completed = 0
        let orderCount = 0
        let completedOrderCount = 0
        orders.forEach((order) => {
            if (isExcludedOrder(order)) return
            orderCount += 1
            const orderYards = parseFloat(order?.yardage) || 0
            scheduled += orderYards
            const detail = order?.orderId ? detailByOrderId?.[order.orderId] : null
            const loaded = parseFloat(detail?.loadedYardage) || 0
            completed += loaded
            if (orderYards > 0 && loaded >= orderYards) completedOrderCount += 1
        })

        const pct = scheduled > 0 ? (completed / scheduled) * 100 : null
        rows.push({
            code,
            completed,
            completedOrderCount,
            name: plantNameByCode?.[code] || code,
            orderCount,
            pct,
            remaining: Math.max(0, scheduled - completed),
            scheduled
        })
    })

    return rows.sort((a, b) => {
        if (b.scheduled !== a.scheduled) return b.scheduled - a.scheduled
        return a.code.localeCompare(b.code)
    })
}

const progressTintForPct = (pct) => {
    if (!Number.isFinite(pct)) return 'var(--text-tertiary)'
    if (pct >= PROGRESS_BAND_DONE_PCT) return '#16a34a'
    if (pct >= PROGRESS_BAND_ON_TRACK_PCT) return '#0ea5e9'
    return '#d97706'
}

/** Per-plant card — plant badge, progress bar, completed / total / remaining
 *  triple, and an at-a-glance order count. */
function PlantProgressCard({ row }) {
    const dotColor = plantBadgeColor(row.code, 'var(--text-tertiary)')
    const hasSchedule = row.scheduled > 0
    const barTint = progressTintForPct(row.pct)
    const barWidthPct = hasSchedule ? Math.min(PROGRESS_BAR_CAP_PCT, Math.max(0, row.pct)) : 0
    const pctLabel = hasSchedule ? fmtRoundedPct(row.pct) : 'Idle'
    const remainingLabel = hasSchedule ? `${fmtYards(row.remaining)} yd left` : 'No yardage scheduled'
    const subtitle = row.orderCount
        ? `${row.completedOrderCount}/${row.orderCount} orders complete`
        : 'No orders today'

    return (
        <div className="rounded-card bg-bg-primary border border-border-light p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block rounded-sm h-2.5 w-2.5 shrink-0" style={{ background: dotColor }} />
                <span className="font-heading text-sm font-semibold text-text-primary truncate" title={row.name}>
                    {row.name}
                </span>
                <span className="ml-auto font-mono font-bold text-[13px] tabular-nums shrink-0" style={{ color: barTint }}>
                    {pctLabel}
                </span>
            </div>
            <div
                className="rounded h-2.5 overflow-hidden relative bg-bg-tertiary"
                title={
                    hasSchedule
                        ? `${fmtYards(row.completed)} of ${fmtYards(row.scheduled)} yd loaded (${fmtRoundedPct(row.pct)})`
                        : 'No yardage scheduled today'
                }
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasSchedule ? Math.round(Math.min(PROGRESS_BAR_CAP_PCT, row.pct)) : 0}
                aria-label={`${row.name} day progress`}
            >
                {hasSchedule && (
                    <div
                        className="h-2.5 rounded"
                        style={{ background: barTint, width: `${barWidthPct}%` }}
                    />
                )}
            </div>
            <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums text-text-secondary">
                <span className="text-[13px]">
                    <span className="font-semibold text-text-primary">{fmtYards(row.completed)}</span>
                    <span className="text-text-tertiary"> / {fmtYards(row.scheduled)} yd</span>
                </span>
                <span className="text-[11.5px] text-text-tertiary">{remainingLabel}</span>
            </div>
            <div className="text-[11px] text-text-tertiary">{subtitle}</div>
        </div>
    )
}

/**
 * PlanOngoingView — at-a-glance "how far through the day is each plant"
 * surface. Reads the dispatcher's curated `plant_production` for the
 * day's scheduled yardage and `detailByOrderId` (live ticket data via
 * `useDetailOrders`) for the loaded-so-far number. Renders an aggregate
 * KPI strip and a per-plant card grid sorted by largest scheduled day
 * first.
 */
function PlanOngoingView({ accentColor: _accentColor, detailByOrderId, planDate, plantNameByCode, plantProduction, stats }) {
    const rows = useMemo(
        () => buildPlantProgressRows({ detailByOrderId, plantNameByCode, plantProduction, stats }),
        [detailByOrderId, plantNameByCode, plantProduction, stats]
    )

    const totals = useMemo(() => {
        const scheduled = rows.reduce((sum, r) => sum + r.scheduled, 0)
        const completed = rows.reduce((sum, r) => sum + r.completed, 0)
        const activePlants = rows.filter((r) => r.scheduled > 0).length
        const completedPlants = rows.filter((r) => r.scheduled > 0 && r.completed >= r.scheduled).length
        const pct = scheduled > 0 ? (completed / scheduled) * 100 : null
        return {
            activePlants,
            completed,
            completedPlants,
            pct,
            remaining: Math.max(0, scheduled - completed),
            scheduled
        }
    }, [rows])

    const friendlyDate = formatFriendlyDate(planDate)
    const dayPctLabel = totals.scheduled > 0 ? fmtRoundedPct(totals.pct) : '—'

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-border-light">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h2 className="text-[15px] font-bold m-0 shrink-0 text-text-primary">Ongoing</h2>
                        <span className="text-[12px] truncate text-text-secondary">
                            Day progress by plant · {friendlyDate || 'today'}
                        </span>
                    </div>
                </div>

                <StatGroup columns={6}>
                    <Stat
                        label="Day progress"
                        value={dayPctLabel}
                        hint={totals.scheduled > 0 ? `${fmtYards(totals.completed)} / ${fmtYards(totals.scheduled)} yd` : null}
                        valueColor={progressTintForPct(totals.pct)}
                    />
                    <Stat label="Loaded" value={`${fmtYards(totals.completed)} yd`} />
                    <Stat label="Scheduled" value={`${fmtYards(totals.scheduled)} yd`} />
                    <Stat label="Remaining" value={`${fmtYards(totals.remaining)} yd`} />
                    <Stat
                        label="Plants with orders"
                        value={totals.activePlants}
                        hint={rows.length ? `of ${rows.length} on roster` : null}
                    />
                    <Stat
                        label="Plants finished"
                        value={totals.completedPlants}
                        hint={totals.activePlants ? `of ${totals.activePlants} active` : null}
                    />
                </StatGroup>

                <Panel title="By plant" innerClassName="p-3">
                    {rows.length === 0 ? (
                        <div className="text-center text-[13px] text-text-secondary py-6">
                            No plants on the roster for this day.
                        </div>
                    ) : (
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {rows.map((row) => (
                                <PlantProgressCard key={row.code} row={row} />
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    )
}

export default PlanOngoingView
