import React, { useMemo } from 'react'

import { computeClockInRows, formatMinutesClock, getEffectiveBase, PLAN_META_KEY } from '../../../utils/PlanUtility'

/** Flatten `plantProduction` into a single orders list filtered to the
 *  scope plants — the shape `computeClockInRows` expects. */
const flattenOrders = (plantProduction, plantSet) => {
    const out = []
    Object.entries(plantProduction || {}).forEach(([code, data]) => {
        if (code === PLAN_META_KEY) return
        if (plantSet && plantSet.size > 0 && !plantSet.has(code)) return
        if (!Array.isArray(data?.orders)) return
        data.orders.forEach((order) => out.push({ ...order, plantCode: code }))
    })
    return out
}

/** Per-plant clock-in roster + leave-off summary. Slot N is filled with
 *  the Nth-earliest clock-in time; slots beyond the day's needed count are
 *  marked off so the plant manager sees exactly who to send home. */
const buildPlantBreakdowns = ({ clockInRows, effectiveBaseByCode, plantCodes, plantNameByCode, plantProduction }) => {
    return plantCodes
        .map((code) => {
            const data = plantProduction?.[code] || {}
            const totalYardage = parseFloat(data.totalYardage) || 0
            const firstJob = data.firstJobTime || ''
            const base = effectiveBaseByCode[code] || 0
            const sortedTimes = clockInRows
                .filter((row) => row.plantCode === code)
                .map((row) => (Number.isFinite(row.time) ? Math.round(row.time / 5) * 5 : null))
                .filter((t) => t != null)
                .sort((a, b) => a - b)
            const slotCount = Math.max(base, sortedTimes.length)
            const slots = Array.from({ length: slotCount }, (_, i) => ({
                index: i + 1,
                time: sortedTimes[i] ?? null
            }))
            const needed = sortedTimes.length
            const leaveOffCount = Math.max(0, base - needed)
            const earliestMinutes = sortedTimes[0] ?? null
            return {
                base,
                code,
                earliestClockIn: earliestMinutes != null ? formatMinutesClock(earliestMinutes) : null,
                firstJob,
                leaveOffCount,
                name: plantNameByCode?.[code] || '',
                needed,
                slots,
                totalYardage
            }
        })
        .filter((b) => b.base > 0 || b.needed > 0 || b.totalYardage > 0)
}

function KeyStat({ accent, label, value }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9.5px] uppercase tracking-wider truncate text-text-tertiary">{label}</span>
            <span
                className="text-[14px] font-bold leading-tight font-mono font-heading"
                style={{ color: accent || 'var(--text-primary)' }}
            >
                {value}
            </span>
        </div>
    )
}

/** Single plant's clock-in board — header, KPIs, and a row-per-operator
 *  roster. Leave-off slots render with a dashed border so they're visually
 *  distinct from active clock-ins. */
function ClockInPlantCard({ accentColor, breakdown }) {
    const { base, code, earliestClockIn, firstJob, leaveOffCount, name, needed, slots, totalYardage } = breakdown
    return (
        <div className="rounded-lg overflow-hidden flex flex-col bg-bg-secondary border border-border-light">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                <div
                    className="w-8 h-8 rounded flex items-center justify-center shrink-0 font-mono font-bold font-heading"
                    style={{ background: `${accentColor}29`, color: accentColor, fontSize: 11 }}
                >
                    {code}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate text-text-primary">{name || code}</div>
                    <div className="text-[10.5px] text-text-tertiary">
                        {firstJob ? `First job ${firstJob}` : 'No production'}
                        {totalYardage > 0 ? ` · ${totalYardage.toLocaleString()} yd` : ''}
                    </div>
                </div>
                {leaveOffCount > 0 && (
                    <span
                        className="status-badge-warning text-[9.5px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 shrink-0 inline-flex items-center gap-1"
                        title={`${leaveOffCount} of ${base} operators not needed today`}
                    >
                        <i className="fas fa-user-minus text-[8px]" />
                        Leave off {leaveOffCount}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border-light">
                <KeyStat
                    label="Earliest clock-in"
                    value={earliestClockIn || '—'}
                    accent={earliestClockIn ? '#16a34a' : 'var(--text-tertiary)'}
                />
                <KeyStat label="Operators needed" value={`${needed}/${base}`} />
                <KeyStat
                    label="Leave off"
                    value={leaveOffCount}
                    accent={leaveOffCount > 0 ? '#d97706' : 'var(--text-tertiary)'}
                />
            </div>
            <div className="px-3 py-2 flex flex-col gap-1">
                {needed === 0 ? (
                    <div className="text-[11.5px] italic text-center py-2 text-text-tertiary">
                        {base === 0 ? 'No operators on roster.' : 'No operators needed today.'}
                    </div>
                ) : (
                    slots
                        .filter((slot) => slot.time != null)
                        .map((slot) => (
                            <div
                                key={`${code}-op-${slot.index}`}
                                className="flex items-center justify-between gap-2 text-[11.5px] px-2 py-1 rounded bg-bg-primary border border-border-light text-text-primary"
                            >
                                <span className="font-semibold">Operator {slot.index}</span>
                                <span className="font-mono font-bold font-heading">
                                    {formatMinutesClock(slot.time)}
                                </span>
                            </div>
                        ))
                )}
                {leaveOffCount > 0 && (
                    <div className="text-[11.5px] italic mt-1 px-2 py-1.5 rounded bg-transparent border border-border-light text-text-tertiary">
                        The rest of the operators should be scheduled off.
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Operator clock-in board for the dashboard's "Your Plant / District /
 * Region" panel. Plant managers get a single detailed card; district /
 * region scopes get one card per plant in scope (2-col grid on md+).
 *
 * Each card surfaces the day's earliest clock-in, the count of operators
 * actually needed vs effective fleet base, and a numbered slot roster
 * that fills earliest clock-in times first and marks the surplus `off` so
 * the manager sees who to leave home.
 */
export default function PlanDashboardClockInBoard({
    accentColor,
    kind,
    planDate,
    plantNameByCode,
    plantProduction,
    scopePlantCodes,
    stats
}) {
    const plantSet = useMemo(() => new Set(scopePlantCodes || []), [scopePlantCodes])

    const orders = useMemo(() => flattenOrders(plantProduction, plantSet), [plantProduction, plantSet])

    const effectiveBaseByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code || !plantSet.has(s.code)) return
            const base = Number.isFinite(s.base) ? s.base : 0
            out[s.code] = getEffectiveBase(base, s.code, plantProduction, planDate)
        })
        // Plants in scope without a `stats` entry still get a 0 base so the
        // breakdown isn't silently dropped — they'll fall out of the filter
        // below if they also have no production.
        ;(scopePlantCodes || []).forEach((code) => {
            if (!(code in out)) out[code] = 0
        })
        return out
    }, [stats, plantProduction, planDate, plantSet, scopePlantCodes])

    /* `getTravelOverrides` is undefined here — the dashboard doesn't run
     * the live-traffic prefetch, so `computeClockInRows` falls back to the
     * order's own `toJobTime` (the dispatch report's estimate). That keeps
     * the math consistent without requiring the dashboard to subscribe to
     * the heavier travel-time hook chain. */
    const clockInRows = useMemo(
        () => computeClockInRows(orders, effectiveBaseByCode, undefined),
        [orders, effectiveBaseByCode]
    )

    const breakdowns = useMemo(
        () =>
            buildPlantBreakdowns({
                clockInRows,
                effectiveBaseByCode,
                plantCodes: scopePlantCodes || [],
                plantNameByCode,
                plantProduction
            }),
        [clockInRows, effectiveBaseByCode, scopePlantCodes, plantNameByCode, plantProduction]
    )

    if (breakdowns.length === 0) return null

    const gridClass = kind === 'plant' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'

    return (
        <div className="flex flex-col gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-text-secondary">
                <i className="fas fa-user-clock text-[10px]" />
                Operator clock-ins · who to leave off
            </div>
            <div className={gridClass}>
                {breakdowns.map((breakdown) => (
                    <ClockInPlantCard key={breakdown.code} accentColor={accentColor} breakdown={breakdown} />
                ))}
            </div>
        </div>
    )
}
