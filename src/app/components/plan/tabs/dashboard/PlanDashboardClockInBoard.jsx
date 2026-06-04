/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import {
    buildAssignmentDriverTimes,
    computeClockInRows,
    formatMinutesClock,
    getEffectiveBase,
    LOAD_MINUTES,
    parseDurationMinutes,
    PLAN_META_KEY,
    PRE_TRIP_MINUTES
} from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'

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

/** Round a minute-of-day value to the nearest 5-minute slot, mirroring the
 *  rounding already applied inside `computeClockInRows` so local and outbound
 *  rows can be merged on a common grid. */
const snapToFiveMin = (minutes) => (Number.isFinite(minutes) ? Math.round(minutes / 5) * 5 : null)

/**
 * Per-driver clock-in rows for operators leaving an in-scope plant to back up
 * another plant. Two timing rules, matching how the operator's day actually
 * unfolds:
 *   - Deadheading (`loadFromPlant` falsy): clock-in = arrival-at-toPlant minus
 *     `PRE_TRIP_MINUTES + travel(fromPlant → toPlant)`.
 *   - Loaded (`loadFromPlant` truthy, taking a load to the destination job):
 *     clock-in = arrival minus `PRE_TRIP_MINUTES + LOAD_MINUTES + travel-to-job`.
 *     Travel-to-job is approximated as `travel(fromPlant → toPlant) + the
 *     destination order's toJobTime` — a conservative upper bound when the
 *     operator goes via the destination plant (the only direct data we have).
 */
const buildOutboundClockInRows = ({ assignments, getTravelTime, plantProduction, scopePlantSet }) => {
    const rows = []
    ;(assignments || []).forEach((assignment) => {
        if (!assignment?.fromPlant || !assignment?.toPlant) return
        if (assignment.fromPlant === assignment.toPlant) return
        if (scopePlantSet && scopePlantSet.size > 0 && !scopePlantSet.has(assignment.fromPlant)) return
        const travelMinutes =
            typeof getTravelTime === 'function' ? getTravelTime(assignment.fromPlant, assignment.toPlant) : null
        if (!Number.isFinite(travelMinutes)) return

        const isLoadedFromPlant = !!assignment.loadFromPlant
        let destinationOrder = null
        if (assignment.forOrderId) {
            const destinationOrders = plantProduction?.[assignment.toPlant]?.orders || []
            destinationOrder =
                destinationOrders.find((o) => (o.orderId || o.orderNum) === assignment.forOrderId) || null
        }

        const toJobMinutes = parseDurationMinutes(destinationOrder?.toJobTime)
        const loadedTravelToJob = travelMinutes + (Number.isFinite(toJobMinutes) ? toJobMinutes : 0)
        const clockInOffset = isLoadedFromPlant
            ? PRE_TRIP_MINUTES + LOAD_MINUTES + loadedTravelToJob
            : PRE_TRIP_MINUTES + travelMinutes

        const driverTimes = buildAssignmentDriverTimes(assignment)
        driverTimes.forEach((driver) => {
            if (!Number.isFinite(driver.arriveMin)) return
            const rawClockIn = Math.max(0, driver.arriveMin - clockInOffset)
            const time = snapToFiveMin(rawClockIn)
            rows.push({
                isLoadedFromPlant,
                plantCode: assignment.fromPlant,
                time,
                toPlant: assignment.toPlant
            })
        })
    })
    return rows
}

/** Per-plant clock-in roster + leave-off summary. Slot N is filled with
 *  the Nth-earliest clock-in time across local + outbound-help rows; slots
 *  beyond the day's needed count are marked off so the plant manager sees
 *  exactly who to send home. Outbound slots carry destination + load info
 *  so they render with a "→ XXX" tag. */
const buildPlantBreakdowns = ({
    clockInRows,
    effectiveBaseByCode,
    outboundClockInRows,
    plantCodes,
    plantNameByCode,
    plantProduction
}) => {
    return plantCodes
        .map((code) => {
            const data = plantProduction?.[code] || {}
            const totalYardage = parseFloat(data.totalYardage) || 0
            const firstJob = data.firstJobTime || ''
            const base = effectiveBaseByCode[code] || 0

            const localSlots = clockInRows
                .filter((row) => row.plantCode === code)
                .map((row) => ({ outbound: null, time: snapToFiveMin(row.time) }))
            const outboundSlots = outboundClockInRows
                .filter((row) => row.plantCode === code)
                .map((row) => ({
                    outbound: { isLoadedFromPlant: row.isLoadedFromPlant, toPlant: row.toPlant },
                    time: snapToFiveMin(row.time)
                }))
            const combined = [...localSlots, ...outboundSlots]
                .filter((entry) => entry.time != null)
                .sort((a, b) => a.time - b.time)

            const needed = combined.length
            /* Numbered slots only — the named-operator / weekly-hours
             * ranking the board used to do (Dayforce-backed) was retired;
             * operators are now displayed as "Operator 1", "Operator 2",
             * etc., and managers pick who fills each slot. */
            const slotCount = Math.max(base, combined.length)
            const slots = Array.from({ length: slotCount }, (_, i) => ({
                index: i + 1,
                outbound: combined[i]?.outbound ?? null,
                time: combined[i]?.time ?? null
            }))
            const leaveOffCount = Math.max(0, base - needed)
            const earliestMinutes = combined[0]?.time ?? null
            const outboundCount = outboundSlots.length
            return {
                base,
                code,
                earliestClockIn: earliestMinutes != null ? formatMinutesClock(earliestMinutes) : null,
                firstJob,
                leaveOffCount,
                name: plantNameByCode?.[code] || '',
                needed,
                outboundCount,
                slots,
                totalYardage
            }
        })
        .filter((b) => b.base > 0 || b.needed > 0 || b.totalYardage > 0)
}

function KeyStat({ label, value }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9.5px] uppercase tracking-wider truncate text-text-tertiary">{label}</span>
            <span className="text-[14px] font-bold leading-tight font-mono font-heading text-text-primary">
                {value}
            </span>
        </div>
    )
}

/** Compact destination chip rendered on outbound-help operator rows so the
 *  manager can tell at a glance which clock-ins are leaving the yard.
 *  "LD" suffix flags loaded help (operator pulls a load from this plant). */
function OutboundDestinationTag({ outbound }) {
    if (!outbound) return null
    return (
        <Badge
            size="sm"
            shape="rounded"
            variant="custom"
            className="font-mono bg-bg-tertiary text-text-secondary border border-border-light"
            icon={<i className="fas fa-arrow-right-from-bracket text-[7px] opacity-70" />}
        >
            {outbound.toPlant}
            {outbound.isLoadedFromPlant ? ' · LD' : ''}
        </Badge>
    )
}

/** Single plant's clock-in board — header, KPIs, and a row-per-operator
 *  roster. Leave-off slots render with a dashed border so they're visually
 *  distinct from active clock-ins. Outbound-help slots show a destination
 *  tag so the manager spots operators leaving the yard. */
function ClockInPlantCard({ accentColor, breakdown }) {
    const {
        base,
        code,
        earliestClockIn,
        firstJob,
        leaveOffCount,
        name,
        needed,
        outboundCount,
        slots,
        totalYardage
    } = breakdown
    return (
        <div className="rounded-lg overflow-hidden flex flex-col bg-bg-secondary border border-border-light">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                <div
                    className="w-8 h-8 rounded flex items-center justify-center shrink-0 font-mono font-bold font-heading"
                    /* Plant code text colour falls through to `--text-primary`
                     * so the number reads white on dark / grayed themes and
                     * dark on light, sitting on the accent-tinted square. */
                    style={{ background: `${accentColor}29`, color: 'var(--text-primary)', fontSize: 11 }}
                >
                    {code}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate text-text-primary">{name || code}</div>
                    <div className="text-[10.5px] text-text-tertiary">
                        {firstJob ? `First job ${firstJob}` : 'No production'}
                        {totalYardage > 0 ? ` · ${totalYardage.toLocaleString()} yd` : ''}
                        {outboundCount > 0
                            ? ` · ${outboundCount} outbound operator${outboundCount === 1 ? '' : 's'}`
                            : ''}
                    </div>
                </div>
                {leaveOffCount > 0 && (
                    <Badge
                        tone="warning"
                        size="sm"
                        shape="pill"
                        className="shrink-0"
                        title={`${leaveOffCount} of ${base} operators not needed today`}
                        icon={<i className="fas fa-user-minus text-[8px]" />}
                    >
                        Leave off {leaveOffCount}
                    </Badge>
                )}
            </div>
            <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border-light">
                <KeyStat label="Earliest clock-in" value={earliestClockIn || '—'} />
                <KeyStat label="Operators needed" value={`${needed}/${base}`} />
                <KeyStat label="Leave off" value={leaveOffCount} />
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
                                <span className="font-semibold flex items-center gap-2 min-w-0">
                                    <span className="truncate">Operator {slot.index}</span>
                                    <OutboundDestinationTag outbound={slot.outbound} />
                                </span>
                                <span className="font-mono font-bold font-heading shrink-0">
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
 * the manager sees who to leave home. Outbound-help operators (going to
 * another plant) appear in the same roster with a destination tag so the
 * manager spots them at a glance.
 */
function PlanDashboardClockInBoard({
    accentColor,
    assignments,
    getTravelTime,
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
            // Feed the raw roster — getEffectiveBase reapplies the
            // day-of-week multiplier internally; passing the already-
            // adjusted `s.base` would double-halve on Saturdays.
            const roster = Number.isFinite(s.rawBase) ? s.rawBase : Number.isFinite(s.base) ? s.base : 0
            out[s.code] = getEffectiveBase(roster, s.code, plantProduction, planDate)
        })
        // Plants in scope without a `stats` entry still get a 0 base so the
        // breakdown isn't silently dropped — they'll fall out of the filter
        // below if they also have no production.
        ;(scopePlantCodes || []).forEach((code) => {
            if (!(code in out)) out[code] = 0
        })
        return out
    }, [stats, plantProduction, planDate, plantSet, scopePlantCodes])

    /** Per-driver clock-ins for operators leaving any in-scope plant. Each
     *  outbound assignment contributes one row per driver, with timing tied
     *  to whether the operator is deadheading or pulling a load. Computed
     *  first so the local base can be reduced by committed outbound trips
     *  below. */
    const outboundClockInRows = useMemo(
        () =>
            buildOutboundClockInRows({
                assignments,
                getTravelTime,
                plantProduction,
                scopePlantSet: plantSet
            }),
        [assignments, getTravelTime, plantProduction, plantSet]
    )

    /** Operators already committed to outbound help per plant. They come out
     *  of the plant's base, so the local clock-in calc must use a reduced
     *  base — otherwise a plant sending 7 operators to a neighbor would
     *  appear to clock in 7 + (local need) people, double-counting the same
     *  bodies. */
    const outboundCountByPlant = useMemo(() => {
        const out = {}
        outboundClockInRows.forEach((row) => {
            out[row.plantCode] = (out[row.plantCode] || 0) + 1
        })
        return out
    }, [outboundClockInRows])

    /** Effective base minus outbound commitments — the headcount actually
     *  available to staff local orders today. */
    const localBaseByCode = useMemo(() => {
        const out = {}
        Object.entries(effectiveBaseByCode).forEach(([code, base]) => {
            const reserved = outboundCountByPlant[code] || 0
            out[code] = Math.max(0, base - reserved)
        })
        return out
    }, [effectiveBaseByCode, outboundCountByPlant])

    /* `getTravelOverrides` is undefined here — the dashboard doesn't run
     * the live-traffic prefetch, so `computeClockInRows` falls back to the
     * order's own `toJobTime` (the dispatch report's estimate). That keeps
     * the math consistent without requiring the dashboard to subscribe to
     * the heavier travel-time hook chain. */
    const clockInRows = useMemo(() => computeClockInRows(orders, localBaseByCode, undefined), [orders, localBaseByCode])

    const breakdowns = useMemo(
        () =>
            buildPlantBreakdowns({
                clockInRows,
                effectiveBaseByCode,
                outboundClockInRows,
                plantCodes: scopePlantCodes || [],
                plantNameByCode,
                plantProduction
            }),
        [clockInRows, effectiveBaseByCode, outboundClockInRows, scopePlantCodes, plantNameByCode, plantProduction]
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

/* Memoized: typing in the dashboard Notes field re-renders OperationsView and
 * this whole subtree on every keystroke. This board's props don't change while
 * typing notes, so memoizing it skips the (heavy) re-render entirely and keeps
 * the controlled Notes textarea responsive. Depends on `getTravelTime` and
 * `stats` being referentially stable (see usePlanData / usePlanInsights). */
export default React.memo(PlanDashboardClockInBoard)
