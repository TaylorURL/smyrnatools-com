/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    deltaPct,
    fmtDate,
    fmtInt,
    fmtMinutesAsHHMM,
    fmtPct,
    fmtYards
} from '../../../../../utils/PlanStatisticsFormatUtility'
import { MAX_YPH, plantBadgeColor, TARGET_YPH, timeToMinutes } from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'

/** Period-comparison table row — current value, previous value, Δ%. */
export function ComparisonRow({ current, label, previous }) {
    const pct = deltaPct(current.value, previous?.value)
    return (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 items-center text-[12.5px] border-t border-border-light">
            <span className="text-text-secondary">{label}</span>
            <span className="font-semibold font-mono tabular-nums text-text-primary">{current.formatted}</span>
            <span className="font-mono tabular-nums text-text-tertiary">{previous ? previous.formatted : '—'}</span>
            <span
                className="font-semibold font-mono tabular-nums text-right text-text-primary"
                style={{ minWidth: 60 }}
            >
                {pct == null ? '—' : fmtPct(pct)}
            </span>
        </div>
    )
}

/** Top-N ranked list with bar gauges — reused for customers & products. */
export function RankedList({ accent, emptyLabel, items, labelKey, secondaryFmt, valueLabel = 'yd³' }) {
    if (items.length === 0) {
        return <div className="text-[12px] py-4 text-center text-text-tertiary">{emptyLabel}</div>
    }
    const max = items[0].yardage
    return (
        <div className="flex flex-col gap-1.5">
            {items.map((item, idx) => (
                <div key={item[labelKey] || idx} className="flex items-center gap-2 text-[12px]">
                    <span className="font-mono tabular-nums w-5 text-right shrink-0 text-text-tertiary">{idx + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-text-primary">{item[labelKey]}</span>
                    <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary w-20">
                        <div
                            className="h-full"
                            style={{ background: accent, width: `${max > 0 ? (item.yardage / max) * 100 : 0}%` }}
                        />
                    </div>
                    <span className="font-mono tabular-nums font-semibold w-20 text-right shrink-0 text-text-primary">
                        {fmtYards(item.yardage)} {valueLabel}
                    </span>
                    {secondaryFmt && (
                        <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-tertiary">
                            {secondaryFmt(item)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}

/** Big-pour callout list — orders ≥ 120 yd³ that benefit from early
 *  coordination. Sorted descending by yardage; top-12 only. */
export function BigPoursTable({ accent, plantNameByCode, pours }) {
    if (pours.length === 0) {
        return (
            <div className="text-[12px] py-4 text-center text-text-tertiary">No big pours scheduled in this range.</div>
        )
    }
    const sorted = [...pours].sort((a, b) => b.yardage - a.yardage).slice(0, 12)
    return (
        <div className="flex flex-col">
            {sorted.map((pour, idx) => (
                <div
                    key={`${pour.planDate}-${pour.plantCode}-${pour.orderNum || idx}`}
                    className="flex items-center gap-3 px-3 py-2 text-[12px]"
                    style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)' }}
                >
                    <div
                        className="w-9 h-9 rounded flex flex-col items-center justify-center shrink-0"
                        style={{
                            background: `${plantBadgeColor(pour.plantCode, accent)}1f`,
                            color: plantBadgeColor(pour.plantCode, accent)
                        }}
                    >
                        <span className="text-[10px] font-bold tabular-nums leading-none">
                            {fmtDate(pour.planDate).split(' ')[1]}
                        </span>
                        <span className="text-[8.5px] uppercase tracking-wider">
                            {fmtDate(pour.planDate).split(' ')[0]}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-text-primary">{pour.customer}</div>
                        <div className="text-[11px] flex items-center gap-2 flex-wrap text-text-secondary">
                            <span className="font-mono tabular-nums">{pour.plantCode}</span>
                            {plantNameByCode?.[pour.plantCode] && <span>· {plantNameByCode[pour.plantCode]}</span>}
                            {pour.startTime && <span>· {fmtMinutesAsHHMM(timeToMinutes(pour.startTime))}</span>}
                            {pour.productCode && pour.productCode !== '—' && <span>· {pour.productCode}</span>}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums font-semibold text-text-primary">
                            {fmtYards(pour.yardage)} yd³
                        </div>
                        <div className="text-[10.5px] text-text-tertiary">{fmtInt(pour.loads)} loads</div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Single status pill for a plant scorecard row. Picks between the
 *  single-day yards-per-hour assessment and the multi-day loads/active-day
 *  bucket; returns null when there's nothing useful to show. */
const buildScorecardStatus = ({ isSingleDay, plant, singleDayShiftSpan, trucks }) => {
    if (isSingleDay && trucks > 0 && singleDayShiftSpan && plant.yardage > 0) {
        const yph = plant.yardage / (trucks * singleDayShiftSpan)
        if (yph > MAX_YPH) return { color: '#dc2626', label: 'Overbooked' }
        if (yph < TARGET_YPH - 0.5 && plant.loads >= 6) return { color: '#16a34a', label: 'Slack' }
        return { color: '#0ea5e9', label: 'On target' }
    }
    if (plant.activeDays > 0) {
        const loadsPerDay = plant.loads / plant.activeDays
        if (loadsPerDay > 30) return { color: '#dc2626', label: 'Heavy' }
        if (loadsPerDay >= 12) return { color: '#0ea5e9', label: 'Steady' }
        return { color: '#16a34a', label: 'Light' }
    }
    return null
}

/**
 * Per-plant operational scorecard — one row per plant in the period, sorted
 * by yardage, with utilization context (loads/active-day, share of regional
 * yardage, plus a status pill when truck counts are known for the day).
 */
export function PlantScorecardTable({
    accent,
    isSingleDay,
    loadAttributionByPlant,
    mixerCountsByPlant,
    plantNameByCode,
    rows,
    singleDayShiftSpan,
    totalYardage
}) {
    if (rows.length === 0) {
        return <div className="text-[12px] py-4 text-center text-text-tertiary">No plant production in this range.</div>
    }
    const sorted = [...rows].sort((a, b) => b.yardage - a.yardage)
    return (
        <div className="flex flex-col">
            <div className="px-3 py-2.5 text-[11.5px] leading-relaxed border-b border-border-light text-text-secondary">
                <span className="font-semibold text-text-primary">How to read this:</span> the four yardage columns are{' '}
                <span className="font-semibold">non-overlapping</span>, so subtraction works.{' '}
                <span className="font-semibold">Scheduled</span> = booked for this plant.{' '}
                <span className="font-semibold">Own mixers loaded</span> = this plant&apos;s mixers loading for this
                plant&apos;s orders. <span className="font-semibold">Help received</span> = other plants&apos; mixers
                loading for this plant&apos;s orders. <span className="font-semibold">Help given</span> = this
                plant&apos;s mixers loading for OTHER plants&apos; orders. So{' '}
                <span className="font-semibold">Own mixers loaded + Help received ≈ Scheduled</span> (any gap is
                ticket-extraction issues, not unloaded concrete), and{' '}
                <span className="font-semibold">Own mixers loaded + Help given</span> = this plant&apos;s total mixer
                output for the day.
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                    <thead>
                        <tr className="text-text-tertiary">
                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                Plant
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Yardage dispatch booked for this plant on the schedule, regardless of which plant actually loaded the trucks."
                            >
                                Scheduled (yd³)
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Yardage this plant's own mixers loaded for this plant's own orders. Does NOT include help received — that's the next column. Add the two for the full delivery against this plant's orders."
                            >
                                Own mixers loaded (yd³)
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Yardage other plants' mixers loaded for THIS plant's orders. Independent of 'Own mixers loaded' — add them for the total against this plant's orders."
                            >
                                Help received (yd³)
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Yardage this plant's mixers loaded for OTHER plants' orders. Add to 'Own mixers loaded' for this plant's total mixer output for the day."
                            >
                                Help given (yd³)
                            </th>
                            <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                Loads
                            </th>
                            <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                Orders
                            </th>
                            <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                Share
                            </th>
                            <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((plant) => {
                            const share = totalYardage > 0 ? (plant.yardage / totalYardage) * 100 : 0
                            const trucks = mixerCountsByPlant?.[plant.code] || 0
                            const status = buildScorecardStatus({
                                isSingleDay,
                                plant,
                                singleDayShiftSpan,
                                trucks
                            })
                            const attribution = loadAttributionByPlant?.[plant.code]
                            /* `selfLoaded` = this plant's own mixers loading
                             * for this plant's own orders (the loaded total
                             * minus help received). Switching to selfLoaded
                             * makes the four yardage columns non-overlapping
                             * so the row is actually addable: scheduled ≈
                             * selfLoaded + helpReceived, mixerOutput =
                             * selfLoaded + helpGiven. */
                            const selfLoadedYards = attribution?.selfLoaded || 0
                            const crossInYards = attribution?.crossInYards || 0
                            const crossOutYards = attribution?.crossOutYards || 0
                            return (
                                <tr className="border-t border-border-light" key={plant.code}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="custom"
                                                bg={plantBadgeColor(plant.code, accent)}
                                                fg="#ffffff"
                                                size="md"
                                                weight="semibold"
                                                className="font-mono tabular-nums"
                                            >
                                                {plant.code}
                                            </Badge>
                                            {plantNameByCode?.[plant.code] && (
                                                <span className="truncate text-text-secondary">
                                                    {plantNameByCode[plant.code]}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                        {fmtYards(plant.yardage)}
                                    </td>
                                    <td
                                        className="px-2 py-2 text-right font-mono tabular-nums text-text-primary"
                                        title={
                                            selfLoadedYards > 0
                                                ? `${fmtYards(selfLoadedYards)} yd³ — this plant's own mixers, this plant's own orders`
                                                : 'No own-mixer ticket data for this plant'
                                        }
                                    >
                                        {selfLoadedYards > 0 ? fmtYards(selfLoadedYards) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                        {crossInYards > 0 ? fmtYards(crossInYards) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                        {crossOutYards > 0 ? fmtYards(crossOutYards) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                        {fmtInt(plant.loads)}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                        {fmtInt(plant.orderCount)}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                        {share.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {status && (
                                            <Badge
                                                variant="custom"
                                                bg={`${status.color}1f`}
                                                fg="var(--text-primary)"
                                                size="sm"
                                                weight="semibold"
                                                uppercase={false}
                                            >
                                                {status.label}
                                            </Badge>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
