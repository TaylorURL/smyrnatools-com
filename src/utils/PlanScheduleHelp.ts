// Plan Schedule — cross-plant help rows (assignments → bucketed driver
// movements) and the matching pool-timeline `(plant, time, delta)` events.

import { BUFFER_MINUTES, buildAssignmentDriverTimes, PRE_TRIP_MINUTES } from './PlanUtility'

/** 30-minute bucket size for help rows. A staggered crew arriving over an
 *  hour reads as two rows ("5 between 08:00–08:30, 5 between 08:30–09:00")
 *  rather than one row per driver. */
export const HELP_BUCKET_MIN = 30

/**
 * Build per-driver help rows from the planner's assignments. Each row covers
 * one assignment-direction-bucket and tracks:
 *   - `time` (bucketed arrival/leave minute)
 *   - `count` (drivers in this bucket)
 *   - `rangeStart` / `rangeEnd` (actual minutes inside the bucket)
 *   - `clockInRangeStart` / `clockInRangeEnd` (origin-plant clock-in window
 *     for outbound rows, derived from `getTravelTime` + pre-trip + buffer)
 *
 * `getTravelTime(fromPlant, toPlant)` returns minutes between plants, or any
 * non-finite value when unknown. `plantProduction` is used to resolve the
 * destination order so the row can name the customer it's loading for.
 */
export const buildHelpRows = (assignments, plantProduction, getTravelTime) => {
    const grouped = new Map()
    const bump = (key, seed, time, clockInTime = null) => {
        const existing = grouped.get(key)
        if (existing) {
            existing.count += 1
            existing.rangeEnd = Math.max(existing.rangeEnd, time)
            existing.rangeStart = Math.min(existing.rangeStart, time)
            if (Number.isFinite(clockInTime)) {
                existing.clockInRangeStart = Number.isFinite(existing.clockInRangeStart)
                    ? Math.min(existing.clockInRangeStart, clockInTime)
                    : clockInTime
                existing.clockInRangeEnd = Number.isFinite(existing.clockInRangeEnd)
                    ? Math.max(existing.clockInRangeEnd, clockInTime)
                    : clockInTime
            }
        } else {
            grouped.set(key, {
                ...seed,
                clockInRangeEnd: Number.isFinite(clockInTime) ? clockInTime : null,
                clockInRangeStart: Number.isFinite(clockInTime) ? clockInTime : null,
                count: 1,
                rangeEnd: time,
                rangeStart: time
            })
        }
    }
    ;(assignments || []).forEach((a, idx) => {
        if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
        const returnPlant = a.returnPlant || a.fromPlant
        // When the dispatcher tied this help to a specific destination order,
        // look it up so the row can read "loading for #610" + customer
        // instead of the generic "backing up 402".
        let forOrder = null
        if (a.forOrderId) {
            const destOrders = plantProduction?.[a.toPlant]?.orders || []
            forOrder = destOrders.find((o) => (o.orderId || o.orderNum) === a.forOrderId) || null
        }
        // Travel pre-trip + buffer cushion the operator needs at fromPlant
        // before leaving. Same formula `calcClockIn` uses for assignment help
        // in the copyable plan brief — keeps the two sources aligned.
        const travelMin = typeof getTravelTime === 'function' ? getTravelTime(a.fromPlant, a.toPlant) : null
        const clockInOffsetMin = Number.isFinite(travelMin) ? travelMin + PRE_TRIP_MINUTES + BUFFER_MINUTES : null
        // Return-leg travel from the destination plant back to the operator's
        // home plant. Without this, the help-return event credits the home
        // plant the moment the driver leaves the destination — too early,
        // since they're still on the road. The fallback to the outbound
        // travel time covers the common case where return travel isn't
        // measured separately (most plant-pair travel tables are symmetric).
        const returnTravelMin = typeof getTravelTime === 'function' ? getTravelTime(a.toPlant, returnPlant) : null
        const returnTravelEffective = Number.isFinite(returnTravelMin)
            ? returnTravelMin
            : Number.isFinite(travelMin)
              ? travelMin
              : 0
        const driverTimes = buildAssignmentDriverTimes(a)
        driverTimes.forEach((dt) => {
            if (Number.isFinite(dt.arriveMin)) {
                const bucket = Math.floor(dt.arriveMin / HELP_BUCKET_MIN) * HELP_BUCKET_MIN
                const clockInMin = Number.isFinite(clockInOffsetMin)
                    ? Math.max(0, dt.arriveMin - clockInOffsetMin)
                    : null
                bump(
                    `out-${idx}-${bucket}`,
                    {
                        assignmentIndex: idx,
                        direction: 'outbound',
                        forOrder,
                        forOrderId: a.forOrderId || '',
                        fromPlant: a.fromPlant,
                        returnPlant,
                        time: bucket,
                        toPlant: a.toPlant
                    },
                    dt.arriveMin,
                    clockInMin
                )
            }
            if (Number.isFinite(dt.leaveMin) && dt.leaveMin > dt.arriveMin) {
                // `arriveHomeMin` is when the driver actually rolls back into
                // the home yard — `leaveMin` + return-leg drive. This is the
                // moment the home plant's pool should regain the operator;
                // crediting at `leaveMin` (the OLD behavior) was off by the
                // length of the return trip and made the operators look like
                // they never came back when the next order kicked off.
                const arriveHomeMin = dt.leaveMin + returnTravelEffective
                const bucket = Math.floor(arriveHomeMin / HELP_BUCKET_MIN) * HELP_BUCKET_MIN
                bump(
                    `rt-${idx}-${bucket}`,
                    {
                        arriveHomeMin,
                        assignmentIndex: idx,
                        direction: 'return',
                        forOrder,
                        forOrderId: a.forOrderId || '',
                        fromPlant: a.fromPlant,
                        leaveDestMin: dt.leaveMin,
                        returnPlant,
                        time: bucket,
                        toPlant: a.toPlant
                    },
                    arriveHomeMin
                )
            }
        })
    })
    return Array.from(grouped.values())
}

/**
 * Convert help rows into the `(plantCode, time, delta)` events that
 * `computePlantPoolTimeline` consumes.
 *
 * **Outbound (fromPlant → toPlant)** — strict event-based subtraction:
 *   - `−row.count at fromPlant at row.time` — the operators physically
 *     leave the source plant at departure time. The pool drops then,
 *     not earlier. Orders that fire BEFORE the outbound time see the
 *     full local pool; orders that fire AFTER see the reduced pool.
 *   - `+row.count at toPlant at row.time` — they arrive at the
 *     destination and join its working pool.
 *
 * **Return** — the two sides happen at DIFFERENT times because the drive
 * home isn't instantaneous:
 *   - `−row.count at toPlant at row.leaveDestMin` — the operators leave
 *     the help destination. Pool there drops immediately.
 *   - `+row.count at home at row.arriveHomeMin` — `home = returnPlant ||
 *     fromPlant`. Pool here credits ONLY after the return drive lands;
 *     otherwise an order kicking off in that gap window would see the
 *     operators credited at home before they were physically present.
 *
 * Clock-in rows used to also feed `+1` events here so the pool ramped up
 * from zero over the day. That model double-counted operators: the same
 * person showed up as a positive clock-in delta AND was subtracted as an
 * outbound trip, leaving the morning pool reading 0 even when the lot
 * was full of trucks. The pool now starts at the effective base instead
 * (every active mixer is on the lot at start-of-day) and outbound trips
 * drain it at the actual trip minute. `clockInRows` stays in the
 * signature so callers don't churn, but no longer contributes deltas.
 */
export const buildHelpTransfers = (helpRows, _clockInRows) => {
    const out = []
    helpRows.forEach((row) => {
        if (row.direction === 'outbound') {
            out.push({ delta: -row.count, plantCode: row.fromPlant, time: row.time })
            out.push({ delta: row.count, plantCode: row.toPlant, time: row.time })
        } else {
            const home = row.returnPlant || row.fromPlant
            // toPlant loses the operators the moment they leave the help
            // destination (`leaveDestMin`); home plant gains them when they
            // physically land back in the yard (`arriveHomeMin`, which the
            // builder set as `row.time` after adding the return-leg drive).
            // Falling back to `row.time` for either keeps older callers that
            // don't populate the explicit fields working.
            const leaveAt = Number.isFinite(row.leaveDestMin) ? row.leaveDestMin : row.time
            const homeAt = Number.isFinite(row.arriveHomeMin) ? row.arriveHomeMin : row.time
            out.push({ delta: -row.count, plantCode: row.toPlant, time: leaveAt })
            out.push({ delta: row.count, plantCode: home, time: homeAt })
        }
    })
    return out
}
