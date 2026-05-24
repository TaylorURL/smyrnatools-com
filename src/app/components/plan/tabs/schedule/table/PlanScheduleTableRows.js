import { timeToMinutes } from '../../../../../../utils/PlanUtility'

/* Order in which synthetic rows resolve when they share a minute. Returns
 * and clock-ins move first (pool grows), then help, then send-home / trade-
 * off, then slot suggestions, then real orders. */
const SAME_MINUTE_PRIORITY = {
    clockIn: 0,
    help: 2,
    order: 6,
    pullUp: 4,
    return: 0,
    sendHome: 3,
    slot: 5,
    tradeoff: 3
}

/** 30-minute bucket size for the "trucks returning" annotation. Trucks cycle
 *  individually but a row per truck would flood the table — a row per half-
 *  hour batch reads like "7 trucks back between 07:00 and 07:30" which is
 *  what dispatchers actually track. */
const TRUCK_RETURN_BUCKET_MIN = 30

/**
 * Build a chronological list of real order rows interleaved with synthetic
 * "trucks returning" rows, one per order at that order's last-truck-back
 * timestamp. The return row styles differently (green tint, left accent)
 * so dispatchers see exactly when capacity frees up at each plant without
 * floating overlays.
 *
 * Return rows only interleave when the sort is time-based (default sort
 * plant→time, or explicit start-time). For yardage/trucks/customer sorts
 * returns are skipped because they'd break the chosen ordering.
 */
export function buildTableRows({
    compareMode,
    extrasActive,
    filteredClockInRows,
    filteredHelpRows,
    filteredPullUpRows,
    filteredSendHomeRows,
    filteredSuggestedSlotRows,
    keyForOrder,
    orders,
    poolTimeline
}) {
    const rows = []
    for (const order of orders) {
        /* Compare-view placeholders flow through the `orders` list with
         * `__placeholder: 'added' | 'removed'`. Treat them as their own row
         * kind so the renderer can ghost them, and so synthetic-row helpers
         * (returns, clock-ins, etc.) never try to attach pool data to a row
         * that isn't a real order. */
        if (order?.__placeholder) {
            rows.push({
                kind: 'placeholder',
                order,
                placeholderKind: order.__placeholder,
                time: timeToMinutes(order.startTime)
            })
        } else {
            rows.push({ kind: 'order', order, time: timeToMinutes(order.startTime) })
        }
    }
    if (extrasActive) {
        // Pool count on each bucket uses the pool state right after the last
        // return in that bucket.
        for (const order of orders) {
            const entry = poolTimeline?.[keyForOrder(order)]
            if (!entry || !Array.isArray(entry.returnEvents) || entry.returnEvents.length === 0) continue
            const buckets = new Map()
            entry.returnEvents.forEach((re) => {
                if (!Number.isFinite(re.time)) return
                const bucket = Math.floor(re.time / TRUCK_RETURN_BUCKET_MIN) * TRUCK_RETURN_BUCKET_MIN
                const existing = buckets.get(bucket)
                if (existing) {
                    existing.count += re.count
                    existing.lastTime = Math.max(existing.lastTime, re.time)
                    existing.poolAfter = re.poolAfter
                } else {
                    buckets.set(bucket, {
                        count: re.count,
                        firstTime: re.time,
                        lastTime: re.time,
                        poolAfter: re.poolAfter
                    })
                }
            })
            const bucketRows = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
            bucketRows.forEach(([bucketStart, agg], i) => {
                rows.push({
                    count: agg.count,
                    kind: 'return',
                    order,
                    plantCode: order.plantCode,
                    poolAfterReturn: agg.poolAfter,
                    rangeEnd: agg.lastTime,
                    rangeStart: agg.firstTime,
                    returnIndex: i,
                    time: bucketStart,
                    totalReturns: bucketRows.length,
                    truckCount: entry.truckCount
                })
            })
        }
    }
    for (const row of filteredHelpRows) {
        rows.push({
            clockInRangeEnd: row.clockInRangeEnd ?? null,
            clockInRangeStart: row.clockInRangeStart ?? null,
            count: row.count,
            direction: row.direction,
            forOrder: row.forOrder || null,
            fromPlant: row.fromPlant,
            helpKey: `${row.assignmentIndex}-${row.direction}-${row.time}`,
            homePlant: row.homePlant ?? null,
            kind: 'help',
            poolAfterAtHome: Number.isFinite(row.poolAfterAtHome) ? row.poolAfterAtHome : null,
            returnPlant: row.returnPlant,
            time: row.time,
            toPlant: row.toPlant
        })
    }
    // Combine a send-home row with any open-slot rows at the same plant that
    // fit the true spare capacity at that moment. "Surplus" here is the
    // cumulative min-future pool — trucks that will never be needed for
    // existing orders from this moment forward. Slots whose min-truck floor
    // fits that surplus merge into a single trade-off row.
    const slotConsumed = new Set()
    const sendHomeConsumed = new Set()
    filteredSendHomeRows.forEach((sh, shIdx) => {
        const available = Number.isFinite(sh.surplus) ? sh.surplus : sh.count
        const fittingIdxs = []
        filteredSuggestedSlotRows.forEach((slot, sIdx) => {
            if (slotConsumed.has(sIdx)) return
            if (slot.plantCode !== sh.plantCode) return
            if (slot.minTrucks > available) return
            fittingIdxs.push(sIdx)
        })
        if (fittingIdxs.length === 0) return
        sendHomeConsumed.add(shIdx)
        fittingIdxs.forEach((i) => slotConsumed.add(i))
        rows.push({
            count: sh.count,
            kind: 'tradeoff',
            plantCode: sh.plantCode,
            poolAfter: sh.poolAfter,
            slots: fittingIdxs.map((i) => filteredSuggestedSlotRows[i]),
            surplus: available,
            time: sh.time,
            tradeoffKey: `${sh.plantCode}-${sh.time}-${shIdx}`
        })
    })
    filteredSendHomeRows.forEach((row, i) => {
        if (sendHomeConsumed.has(i)) return
        rows.push({
            count: row.count,
            kind: 'sendHome',
            plantCode: row.plantCode,
            poolAfter: row.poolAfter,
            sendHomeKey: `${row.plantCode}-${row.time}-${i}`,
            time: row.time
        })
    })
    // Standalone open-window slot rows used to render here. They've been
    // pulled per dispatcher feedback — the open-window content still surfaces
    // inline on the `tradeoff` row (when a matching send-home exists) so the
    // dispatcher sees the booking suggestion in context instead of as its
    // own noisy line item. `filteredSuggestedSlotRows` is still consumed
    // above for that merging, so the upstream computation stays put.
    filteredPullUpRows.forEach((row, i) => {
        rows.push({
            kind: 'pullUp',
            notifyByMin: row.notifyByMin,
            order: row.order,
            originalStartMin: row.originalStartMin,
            plantCode: row.plantCode,
            pourDurationMin: row.pourDurationMin,
            pullUpDeltaMin: row.pullUpDeltaMin,
            pullUpKey: `${row.plantCode}-${row.suggestedStartMin}-${i}`,
            suggestedStartMin: row.suggestedStartMin,
            time: row.time,
            truckCount: row.truckCount,
            yardage: row.yardage
        })
    })
    filteredClockInRows.forEach((row) => {
        rows.push({
            clockInKey: row.groupKey,
            count: row.count,
            firstTime: row.firstTime,
            forOrder: row.forOrder,
            forOrderId: row.forOrderId,
            kind: 'clockIn',
            lastTime: row.lastTime,
            plantCode: row.plantCode,
            time: row.firstTime
        })
    })
    // Chronological sort runs whenever any synthetic row is in play — they
    // only make sense at their actual minute between orders. With NO synthetic
    // rows (pure order list), we preserve the Sort by picker's ordering.
    //
    // Compare mode is a special case: the split-view caller has already
    // produced pair-aligned snapshot + live arrays where index `i` on one
    // side is paired with index `i` on the other. The internal re-sort
    // here would break that alignment — placeholders carry priority 7
    // while real orders carry priority 6, so two pairs sharing a minute
    // can sort to different positions on each side (the snap column has
    // a real order in slot A and a placeholder in slot B; the live
    // column has the placeholder in slot A and the real in slot B; the
    // re-sort then puts them in different sequences). Skip the re-sort
    // in compare mode and trust the upstream pair sequence.
    const hasSyntheticRows = rows.some((r) => r.kind !== 'order')
    if (hasSyntheticRows && !compareMode) {
        rows.sort((a, b) => {
            const at = Number.isFinite(a.time) ? a.time : Infinity
            const bt = Number.isFinite(b.time) ? b.time : Infinity
            if (at !== bt) return at - bt
            return (SAME_MINUTE_PRIORITY[a.kind] ?? 7) - (SAME_MINUTE_PRIORITY[b.kind] ?? 7)
        })
    }
    return rows
}

/** Group raw clock-in rows by `(plant, dispatch order)` so a job needing
 *  three operators reads as a single row ("3 operators clock in for #461,
 *  staggered 07:50 → 08:00") rather than three near-duplicate rows. */
export function groupClockInRows(clockInRows, visiblePlantCodes) {
    const grouped = new Map()
    clockInRows.forEach((row) => {
        if (!visiblePlantCodes.has(row.plantCode)) return
        const orderKey = row.forOrderId || row.forOrder?.orderId || row.forOrder?.orderNum || null
        const groupKey = `${row.plantCode}::${orderKey ?? 'unknown'}`
        const existing = grouped.get(groupKey)
        if (existing) {
            existing.count += row.count
            existing.firstTime = Math.min(existing.firstTime, row.time)
            existing.lastTime = Math.max(existing.lastTime, row.time)
        } else {
            grouped.set(groupKey, {
                count: row.count,
                firstTime: row.time,
                forOrder: row.forOrder,
                forOrderId: row.forOrderId,
                groupKey,
                lastTime: row.time,
                plantCode: row.plantCode
            })
        }
    })
    return Array.from(grouped.values())
}
