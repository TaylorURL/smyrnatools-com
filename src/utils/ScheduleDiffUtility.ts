/**
 * Schedule-snapshot diff engine. Compares the 5:30 PM Central snapshot of a
 * day's order list against the live schedule and surfaces every change the
 * dispatcher cares about — moved times, spacing changes, address swaps,
 * plant reassignments, yardage edits, plus added / removed orders.
 *
 * Two entry points:
 *   - `diffOrderAgainstSnapshot(snapshot, liveOrder)` → per-order diff used
 *     by the right-click Order Audit popup.
 *   - `diffScheduleAgainstSnapshot(snapshot, liveProduction)` → full-day
 *     diff used by the two-column compare view. Bins every order into
 *     'added', 'removed', 'changed', or 'unchanged'.
 *
 * `OrderDiff.kind` values:
 *   - 'added'     — present live, absent in snapshot.
 *   - 'removed'   — present in snapshot, absent live.
 *   - 'changed'   — present in both, at least one tracked field differs.
 *   - 'unchanged' — present in both, no tracked field changes.
 */

/* ─── Field config ──────────────────────────────────────────────
 * Every field the audit cares about, with the display label and a
 * normalizer so cosmetic differences (trailing whitespace, casing) don't
 * register as a "change." Order matters — the popup renders changes in
 * this order so the most operationally relevant ones (time, spacing,
 * yardage, plant, address) lead. */

const trim = (value) => (value == null ? '' : String(value).trim())
const trimLower = (value) => trim(value).toLowerCase()
const normalizeNumber = (value) => {
    const n = parseFloat(trim(value))
    return Number.isFinite(n) ? String(n) : ''
}

const TRACKED_FIELDS = [
    { key: 'startTime', label: 'Start time' },
    { key: 'rate', label: 'Truck spacing', normalize: normalizeNumber },
    { key: 'yardage', label: 'Yardage', normalize: normalizeNumber },
    { key: 'loadSize', label: 'Load size', normalize: normalizeNumber },
    { key: 'truckCount', label: 'Truck count', normalize: normalizeNumber },
    { key: 'plantCode', label: 'Plant' },
    { key: 'address', label: 'Address', normalize: trimLower },
    { key: 'city', label: 'City', normalize: trimLower },
    { key: 'customer', label: 'Customer', normalize: trimLower },
    { key: 'productCode', label: 'Product' },
    { key: 'description', label: 'Description', normalize: trimLower },
    { key: 'poNumber', label: 'PO #' },
    { key: 'jobNumber', label: 'Job #' },
    { key: 'contact', label: 'Contact', normalize: trimLower },
    { key: 'phone', label: 'Phone' },
    { key: 'toJobTime', label: 'Scheduled travel to job', normalize: normalizeNumber },
    { key: 'toPlantTime', label: 'Scheduled return time', normalize: normalizeNumber },
    { key: 'truckClass', label: 'Truck class' }
]

/** Flatten a `plantProduction` map into an `[orderId → order]` lookup with
 *  the `plantCode` stamped onto each order (the original blob keys orders
 *  by plant, so the diff engine needs to merge them first). Orders missing
 *  an `orderId` are skipped — they can't be diffed reliably. */
function flattenByOrderId(plantProduction) {
    const out = new Map()
    if (!plantProduction || typeof plantProduction !== 'object') return out
    Object.entries(plantProduction).forEach(([plantCode, block]) => {
        const orders = Array.isArray(block?.orders) ? block.orders : []
        orders.forEach((order) => {
            const id = trim(order?.orderId)
            if (!id) return
            out.set(id, { ...order, plantCode: order?.plantCode || plantCode })
        })
    })
    return out
}

function fieldChanged(spec, snapshotOrder, liveOrder) {
    const normalize = spec.normalize || trim
    const before = normalize(snapshotOrder[spec.key])
    const after = normalize(liveOrder[spec.key])
    if (before === after) return null
    const format = spec.format || ((value) => trim(value) || '—')
    return {
        after: format(liveOrder[spec.key]),
        before: format(snapshotOrder[spec.key]),
        field: spec.key,
        label: spec.label
    }
}

function computeChanges(snapshotOrder, liveOrder) {
    const out = []
    for (const spec of TRACKED_FIELDS) {
        const change = fieldChanged(spec, snapshotOrder, liveOrder)
        if (change) out.push(change)
    }
    return out
}

function describeOrder(order, plantFallback = '') {
    return {
        customer: trim(order?.customer),
        orderNum: trim(order?.orderNum),
        plantCode: trim(order?.plantCode) || plantFallback
    }
}

/**
 * Diff one specific order against the snapshot for the same date. Returns
 * `kind: 'added'` when the order is absent in the snapshot, `'removed'`
 * when it's absent live, or `'changed'` / `'unchanged'` based on whether
 * any tracked field moved. `null` is returned when neither side has the
 * order (defensive — shouldn't happen).
 */
export function diffOrderAgainstSnapshot(snapshot, liveOrder) {
    if (!liveOrder?.orderId) return null
    const orderId = trim(liveOrder.orderId)
    if (!orderId) return null

    const snapshotByOrderId = flattenByOrderId(snapshot?.plant_production)
    const snapshotOrder = snapshotByOrderId.get(orderId) || null

    if (!snapshotOrder) {
        const meta = describeOrder(liveOrder)
        return {
            changes: [],
            customer: meta.customer,
            kind: 'added',
            liveOrder,
            orderId,
            orderNum: meta.orderNum,
            plantCode: meta.plantCode,
            snapshotOrder: null
        }
    }

    const changes = computeChanges(snapshotOrder, liveOrder)
    const meta = describeOrder(liveOrder)
    return {
        changes,
        customer: meta.customer,
        kind: changes.length === 0 ? 'unchanged' : 'changed',
        liveOrder,
        orderId,
        orderNum: meta.orderNum,
        plantCode: meta.plantCode,
        snapshotOrder
    }
}

/**
 * Diff every order in the snapshot against the live schedule, returning
 * separate buckets for added / removed / changed / unchanged plus a
 * summary count map. Used by the two-column compare view.
 */
export function diffScheduleAgainstSnapshot(snapshot, livePlantProduction) {
    const snapshotByOrderId = flattenByOrderId(snapshot?.plant_production)
    const liveByOrderId = flattenByOrderId(livePlantProduction)
    const added = []
    const removed = []
    const changed = []
    const unchanged = []

    liveByOrderId.forEach((liveOrder, orderId) => {
        const snapshotOrder = snapshotByOrderId.get(orderId) || null
        const meta = describeOrder(liveOrder)
        if (!snapshotOrder) {
            added.push({
                changes: [],
                customer: meta.customer,
                kind: 'added',
                liveOrder,
                orderId,
                orderNum: meta.orderNum,
                plantCode: meta.plantCode,
                snapshotOrder: null
            })
            return
        }
        const changes = computeChanges(snapshotOrder, liveOrder)
        const diff = {
            changes,
            customer: meta.customer,
            kind: changes.length === 0 ? 'unchanged' : 'changed',
            liveOrder,
            orderId,
            orderNum: meta.orderNum,
            plantCode: meta.plantCode,
            snapshotOrder
        }
        if (changes.length === 0) unchanged.push(diff)
        else changed.push(diff)
    })

    snapshotByOrderId.forEach((snapshotOrder, orderId) => {
        if (liveByOrderId.has(orderId)) return
        const meta = describeOrder(snapshotOrder)
        removed.push({
            changes: [],
            customer: meta.customer,
            kind: 'removed',
            liveOrder: null,
            orderId,
            orderNum: meta.orderNum,
            plantCode: meta.plantCode,
            snapshotOrder
        })
    })

    const byStart = (a, b) => {
        const aStart = trim(a.liveOrder?.startTime || a.snapshotOrder?.startTime)
        const bStart = trim(b.liveOrder?.startTime || b.snapshotOrder?.startTime)
        return aStart.localeCompare(bStart)
    }
    added.sort(byStart)
    removed.sort(byStart)
    changed.sort(byStart)
    unchanged.sort(byStart)

    return {
        added,
        changed,
        removed,
        summary: {
            added: added.length,
            changed: changed.length,
            removed: removed.length,
            unchanged: unchanged.length
        },
        unchanged
    }
}

/** Re-exported field list so renderers can reuse the canonical labels. */
export const SCHEDULE_DIFF_FIELDS = TRACKED_FIELDS.map((spec) => ({ key: spec.key, label: spec.label }))
