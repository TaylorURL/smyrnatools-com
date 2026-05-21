/**
 * Client-side ticket-quantity allocator. Mirrors the upstream
 * `DispatchDataService.buildDetailByOrderId` allocator and runs as a
 * defensive second pass on every detail map a consumer reads, so the
 * popup modal, the Schedule's Loaded column, and every Statistics
 * sub-page see corrected ticket quantities even when the service-layer
 * fetch landed before the curated `plant_production` data was available
 * to feed the schedule fallback.
 *
 * Strategy per ticket:
 *   - Confirmed (non-DetailDriver) tickets pass through untouched.
 *   - DetailDriver-only tickets with `quantity > 0` (already allocated
 *     upstream) pass through untouched.
 *   - DetailDriver-only tickets with `quantity === 0` get
 *     `min(loadSize, remaining)`, where
 *     `remaining = scheduledYardage − confirmedTotal − already-allocated DetailDriver yardage`.
 *
 * Returns the original `entry` reference when no backfill was needed so
 * React's referential-equality short-circuits stay efficient.
 *
 * @param {Object} entry - Detail entry as returned by
 *   `DispatchDataService.fetchDetailByOrderId`:
 *   `{ tickets, byPlant, loadedYardage, ticketCount, … }`.
 * @param {{scheduledYardage:number, loadSize:number}} [schedule] - The
 *   dispatcher's curated schedule meta for this order (from the `plans`
 *   table via `plant_production`).
 */
export const enrichDetailEntryWithSchedule = (entry, schedule) => {
    if (!entry || !Array.isArray(entry.tickets) || entry.tickets.length === 0) return entry
    const scheduledYardage = schedule?.scheduledYardage || 0
    const loadSize = schedule?.loadSize || 0
    if (scheduledYardage <= 0) return entry
    const tickets = entry.tickets
    const confirmedTotal = tickets.reduce(
        (sum, t) => (t?.sourceReport === 'DetailDriver' ? sum : sum + (parseFloat(t?.quantity) || 0)),
        0
    )
    const estimateAlreadyAllocated = tickets.reduce(
        (sum, t) => (t?.sourceReport === 'DetailDriver' ? sum + (parseFloat(t?.quantity) || 0) : sum),
        0
    )
    let remaining = Math.max(0, scheduledYardage - confirmedTotal - estimateAlreadyAllocated)
    if (remaining <= 0) return entry
    let backfilled = false
    const nextTickets = tickets.map((t) => {
        if (t?.sourceReport !== 'DetailDriver') return t
        const currentQty = parseFloat(t?.quantity) || 0
        if (currentQty > 0) return t
        if (remaining <= 0) return t
        const allocation = loadSize > 0 ? Math.min(loadSize, remaining) : remaining
        remaining -= allocation
        backfilled = true
        return { ...t, quantity: allocation }
    })
    if (!backfilled) return entry
    // Rebuild byPlant + loadedYardage from the updated quantities so any
    // consumer reading those fields (Schedule's `Loaded` column,
    // Statistics' per-plant load attribution) stays consistent.
    const nextByPlant = {}
    let nextLoadedYardage = 0
    nextTickets.forEach((t) => {
        const qty = parseFloat(t?.quantity) || 0
        nextLoadedYardage += qty
        if (t?.plantId) {
            const slot = nextByPlant[t.plantId] || (nextByPlant[t.plantId] = { loadedYardage: 0, ticketCount: 0 })
            slot.loadedYardage += qty
            slot.ticketCount += 1
        }
    })
    return { ...entry, byPlant: nextByPlant, loadedYardage: nextLoadedYardage, tickets: nextTickets }
}
