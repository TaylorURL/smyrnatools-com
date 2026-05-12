import React from 'react'

import {
    deltaColor,
    deltaPct,
    fmtDate,
    fmtInt,
    fmtMinutesAsHHMM,
    fmtPct
} from '../../../utils/PlanStatisticsFormatUtility'
import { MAX_YPH, plantBadgeColor, TARGET_YPH, timeToMinutes } from '../../../utils/PlanUtility'

/** Period-comparison table row — current value, previous value, Δ%. */
export function ComparisonRow({ current, label, previous }) {
    const pct = deltaPct(current.value, previous?.value)
    return (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 items-center text-[12.5px] border-t border-border-light">
            <span className="text-text-secondary">{label}</span>
            <span className="font-semibold font-mono tabular-nums text-text-primary">{current.formatted}</span>
            <span className="font-mono tabular-nums text-text-tertiary">{previous ? previous.formatted : '—'}</span>
            <span
                className="font-semibold font-mono tabular-nums text-right"
                style={{ color: deltaColor(pct), minWidth: 60 }}
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
                        {fmtInt(item.yardage)} {valueLabel}
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
                            {fmtInt(pour.yardage)} yd³
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
    /** Show the cross-loaded column only when at least one plant has ticket
     *  data — otherwise the column is all em-dashes and just clutters the
     *  table for windows where the bucket hasn't synced detail orders. */
    const hasAttributionData =
        loadAttributionByPlant &&
        Object.values(loadAttributionByPlant).some((entry) => entry && (entry.loaded > 0 || entry.crossOutYards > 0))
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
                <thead>
                    <tr className="text-text-tertiary">
                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                            Plant
                        </th>
                        <th
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                            title="Total ordered yardage attributed to this plant — schedule's own demand, regardless of who loaded the trucks."
                        >
                            Ordered
                        </th>
                        {hasAttributionData && (
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Yardage actually loaded for this plant's orders (includes help received from sibling plants)."
                            >
                                Loaded
                            </th>
                        )}
                        {hasAttributionData && (
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Cross-loaded yardage — help received (in) and help given to other plants (out)."
                            >
                                Cross-loaded
                            </th>
                        )}
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
                        const loadedYards = attribution?.loaded || 0
                        const crossInYards = attribution?.crossInYards || 0
                        const crossOutYards = attribution?.crossOutYards || 0
                        return (
                            <tr className="border-t border-border-light" key={plant.code}>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full shrink-0"
                                            style={{ background: plantBadgeColor(plant.code, accent) }}
                                        />
                                        <span className="font-mono tabular-nums font-semibold text-text-primary">
                                            {plant.code}
                                        </span>
                                        {plantNameByCode?.[plant.code] && (
                                            <span className="truncate text-text-secondary">
                                                {plantNameByCode[plant.code]}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td
                                    className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-text-primary"
                                    title="Ordered yardage attributed to this plant"
                                >
                                    {fmtInt(plant.yardage)}
                                </td>
                                {hasAttributionData && (
                                    <td
                                        className="px-2 py-2 text-right font-mono tabular-nums text-text-primary"
                                        title={
                                            loadedYards > 0
                                                ? `${fmtInt(loadedYards)} yd loaded for this plant's orders`
                                                : 'No ticket data yet'
                                        }
                                    >
                                        {loadedYards > 0 ? fmtInt(loadedYards) : '—'}
                                    </td>
                                )}
                                {hasAttributionData && (
                                    <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap text-text-secondary">
                                        {crossInYards === 0 && crossOutYards === 0 ? (
                                            '—'
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5">
                                                {crossInYards > 0 && (
                                                    <span
                                                        className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold bg-[rgba(37,_99,_235,_0.12)] text-blue-700"
                                                        title={`Help received: ${fmtInt(crossInYards)} yd loaded by sibling plants for this plant's orders`}
                                                    >
                                                        +{fmtInt(crossInYards)} in
                                                    </span>
                                                )}
                                                {crossOutYards > 0 && (
                                                    <span
                                                        className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold bg-[rgba(217,_119,_6,_0.12)] text-[#b45309]"
                                                        title={`Help given: ${fmtInt(crossOutYards)} yd loaded by this plant for other plants' orders`}
                                                    >
                                                        −{fmtInt(crossOutYards)} out
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                )}
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
                                        <span
                                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold"
                                            style={{ background: `${status.color}1f`, color: status.color }}
                                        >
                                            {status.label}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
