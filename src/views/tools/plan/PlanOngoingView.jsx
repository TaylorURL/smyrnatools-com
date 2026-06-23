/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import { numericPlantComparator } from '../../../utils/ExportPlantHelpers'
import { fmtYards } from '../../../utils/PlanStatisticsFormatUtility'
import { isExcludedOrder, PLAN_META_KEY, plantBadgeColor } from '../../../utils/PlanUtility'

/** Cap the progress bar fill so over-100% rows don't overflow the track —
 *  the raw percent still reads alongside so dispatchers see when a plant
 *  has shipped more than was on the board (kicker yardage, in-the-field
 *  add-ons). */
const PROGRESS_BAR_CAP_PCT = 100

/** Tint thresholds for the per-plant progress bar. Mirrors the
 *  green/blue/amber palette used elsewhere in the Plan tabs — values
 *  resolve to the `--status-*` tokens so light/dark/gray themes pick up
 *  the same hues that Badge tones use. */
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
 *  empty day reads as "0 / 0 yd · idle" instead of vanishing.
 *
 *  Rows are sorted by the project-wide `numericPlantComparator` so the
 *  order is stable run-to-run and matches every other plant listing
 *  (export pipelines, scorecard tables) — never by today's scheduled
 *  yardage, which would reshuffle the list as numbers move during the
 *  shift. */
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

    return rows.sort((a, b) => numericPlantComparator(String(a.code), String(b.code)))
}

const progressTintVarForPct = (pct) => {
    if (!Number.isFinite(pct)) return 'var(--text-tertiary)'
    if (pct >= PROGRESS_BAND_DONE_PCT) return 'var(--status-active)'
    if (pct >= PROGRESS_BAND_ON_TRACK_PCT) return 'var(--status-shop)'
    return 'var(--status-warning)'
}

/** Per-plant row — plant badge + name on the left, a uniform-width
 *  progress bar in the middle, and a tabular-nums readout on the right.
 *  Lives inside a `divide-y` list so the rows share a single rhythm
 *  regardless of name length or value width. */
function PlantProgressRow({ row }) {
    const dotColor = plantBadgeColor(row.code, 'var(--text-tertiary)')
    const hasSchedule = row.scheduled > 0
    const tint = progressTintVarForPct(row.pct)
    const barWidthPct = hasSchedule ? Math.min(PROGRESS_BAR_CAP_PCT, Math.max(0, row.pct)) : 0
    const pctLabel = hasSchedule ? fmtRoundedPct(row.pct) : 'Idle'
    const ordersLabel = row.orderCount
        ? `${row.completedOrderCount}/${row.orderCount} orders`
        : 'No orders'
    const barTitle = hasSchedule
        ? `${fmtYards(row.completed)} of ${fmtYards(row.scheduled)} yd loaded (${fmtRoundedPct(row.pct)})`
        : 'No yardage scheduled today'

    return (
        <li className="grid items-center gap-x-3 gap-y-1.5 px-4 py-3 grid-cols-[minmax(0,1fr)_minmax(100px,1fr)] sm:grid-cols-[minmax(0,1.4fr)_minmax(140px,260px)_minmax(150px,200px)] sm:gap-x-4">
            {/* Identity — dot + code chip + name */}
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="inline-block rounded-sm h-2.5 w-2.5 shrink-0"
                    style={{ background: dotColor }}
                    aria-hidden="true"
                />
                <span className="font-mono text-[11px] tabular-nums text-text-tertiary shrink-0">
                    {row.code}
                </span>
                <span
                    className="font-heading text-[13.5px] font-semibold text-text-primary truncate"
                    title={row.name}
                >
                    {row.name}
                </span>
            </div>

            {/* Progress bar — same width on every row via the parent grid template */}
            <div
                className="rounded-full h-2 overflow-hidden bg-bg-tertiary order-3 col-span-2 sm:order-none sm:col-span-1"
                title={barTitle}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasSchedule ? Math.round(barWidthPct) : 0}
                aria-label={`${row.name} day progress`}
            >
                {hasSchedule && (
                    <div
                        className="h-full rounded-full"
                        style={{ background: tint, width: `${barWidthPct}%` }}
                    />
                )}
            </div>

            {/* Readout — percent + numeric, right-aligned, tabular-nums */}
            <div className="flex flex-col items-end gap-0.5 font-mono tabular-nums min-w-0">
                <span
                    className="text-[14px] font-bold leading-none"
                    style={{ color: hasSchedule ? tint : 'var(--text-tertiary)' }}
                >
                    {pctLabel}
                </span>
                <span className="text-[12px] text-text-secondary whitespace-nowrap">
                    {hasSchedule ? (
                        <>
                            <span className="font-semibold text-text-primary">
                                {fmtYards(row.completed)}
                            </span>
                            <span className="text-text-tertiary"> / {fmtYards(row.scheduled)} yd</span>
                        </>
                    ) : (
                        <span className="text-text-tertiary">No yardage scheduled</span>
                    )}
                </span>
                <span className="text-[11px] text-text-tertiary whitespace-nowrap">
                    {hasSchedule ? `${fmtYards(row.remaining)} yd left · ${ordersLabel}` : ordersLabel}
                </span>
            </div>
        </li>
    )
}

/**
 * PlanOngoingView — at-a-glance "how far through the day is each plant"
 * surface. Reads the dispatcher's curated `plant_production` for the
 * day's scheduled yardage and `detailByOrderId` (live ticket data via
 * `useDetailOrders`) for the loaded-so-far number. Renders an aggregate
 * KPI strip and a single divided list of plants sorted by their numeric
 * plant code so the order is stable across renders.
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
                        valueColor={progressTintVarForPct(totals.pct)}
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

                <Panel title="By plant" innerClassName="p-0 overflow-hidden">
                    {rows.length === 0 ? (
                        <div className="text-center text-[13px] text-text-secondary py-6">
                            No plants on the roster for this day.
                        </div>
                    ) : (
                        <ul className="divide-y divide-border-light">
                            {rows.map((row) => (
                                <PlantProgressRow key={row.code} row={row} />
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    )
}

export default PlanOngoingView
