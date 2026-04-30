import { parseDetailDriverHtml } from '../utils/DetailDriverParser'
import { parseDetailOrderHtml } from '../utils/DetailOrderParser'
import { Database } from './DatabaseService'

/** Normalize a customer name for fuzzy matching between DailyOrder and
 *  DetailDriver records. Casing, trailing punctuation, and whitespace can
 *  drift between reports for the same customer; this gives them a stable key. */
const normalizeCustomer = (name) =>
    String(name || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()

const BUCKET = 'dispatch-reports'

/** Plants the bridge userscript pulls DetailOrderAnalysis reports for. Must
 *  stay in sync with `PLANT_IDS` in `bridge/smyrna-dispatch-sync.user.js` —
 *  any plant missing here simply won't have ticket data surfaced.
 *
 *  Baytown is split between 403 and 404; Conroe is split between 408 and 409.
 *  Trucks routinely load from either sibling, so both codes must be fetched
 *  for cross-plant ticket aggregation to be accurate. */
const PLANT_IDS = ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410', '453', '455', '461', '468']

/**
 * Reads the per-plant DetailOrderAnalysis HTML files uploaded by the bridge
 * userscript. One file per (date, plant) at `detail/YYYY-MM-DD_<plant>.html`.
 *
 * Files may be missing while the bridge is mid-cycle or during early backfill —
 * we skip those and merge whatever's available rather than failing the whole
 * date, so partial data still shows in the UI.
 */
class DetailOrderBucketServiceImpl {
    /**
     * Returns a map keyed by orderId with merged ticket counts and loaded
     * yardage across every plant that has a report file for the date.
     *
     * @param {string} dateStr - ISO date `YYYY-MM-DD`
     * @param {Object} [plantProduction] - Optional DailyOrder map (the same
     *   `plantProduction` PlanView already passes around). When provided,
     *   DetailDriver tickets that don't match an existing DetailOrderAnalysis
     *   ticketNum are joined back to their order via (orderNum, customer)
     *   so cross-plant loads still attach to the right home order.
     */
    async fetchByDate(dateStr, plantProduction = null) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return {}

        const [perPlant, perPlantDriver] = await Promise.all([
            Promise.all(
                PLANT_IDS.map(async (plantId) => {
                    try {
                        const path = `detail/${dateStr}_${plantId}.html`
                        const { data, error } = await Database.storage.from(BUCKET).download(path)
                        if (error || !data) return { plantId, orders: [] }
                        const html = await data.text()
                        return { plantId, orders: parseDetailOrderHtml(html) }
                    } catch (err) {
                        console.warn(`[DetailOrderBucketService] detail download failed for ${plantId}:`, err)
                        return { plantId, orders: [] }
                    }
                })
            ),
            Promise.all(
                PLANT_IDS.map(async (plantId) => {
                    try {
                        const path = `driver/${dateStr}_${plantId}.html`
                        const { data, error } = await Database.storage.from(BUCKET).download(path)
                        if (error || !data) return { plantId, tickets: [] }
                        const html = await data.text()
                        const parsed = parseDetailDriverHtml(html, plantId)
                        return { plantId, tickets: parsed.tickets }
                    } catch (err) {
                        console.warn(`[DetailOrderBucketService] driver download failed for ${plantId}:`, err)
                        return { plantId, tickets: [] }
                    }
                })
            )
        ])

        // Diagnostic — per-fetch summary of how many orders/tickets each plant
        // file contributed, and the unique loading-plant codes the parser
        // pulled out of each file's ticket headers. Lets a dispatcher (or
        // dev) quickly tell whether 404/409 tickets are missing from the
        // bucket entirely vs. being captured under a sibling plant's file.
        try {
            const summary = perPlant.map(({ plantId, orders }) => {
                const ticketTotal = orders.reduce((acc, o) => acc + (o.tickets?.length || 0), 0)
                const loadingPlants = new Set()
                for (const o of orders) {
                    for (const t of o.tickets || []) {
                        if (t.loadedPlantCode) loadingPlants.add(t.loadedPlantCode)
                    }
                }
                return {
                    file: plantId,
                    orders: orders.length,
                    tickets: ticketTotal,
                    loadingPlants: [...loadingPlants].sort().join(',') || '—'
                }
            })
            console.info(`[DetailOrderBucketService] ${dateStr} per-file summary:`, summary)
        } catch {
            // Diagnostic logging must never break the data flow.
        }

        // We dedupe tickets across plant files by ticketId so a ticket that
        // shows up in more than one report file (Baytown 403/404 share trucks
        // and the dispatch system can list the same ticket on either side)
        // counts exactly once. Per-ticket plant attribution comes from the
        // ticket's own header cell (the truck's actual loading plant) rather
        // than the file's intPlantId, falling back to the file's plant when
        // the parser couldn't read the cell.
        const byOrderId = {}
        const seenTickets = new Set()
        for (const { plantId, orders } of perPlant) {
            for (const o of orders) {
                if (!o.orderId) continue
                let existing = byOrderId[o.orderId]
                if (!existing) {
                    existing = byOrderId[o.orderId] = {
                        byPlant: {},
                        loadedYardage: 0,
                        orderId: o.orderId,
                        orderNum: o.orderNum,
                        ticketCount: 0,
                        tickets: []
                    }
                }
                if (!Array.isArray(o.tickets)) continue
                for (const t of o.tickets) {
                    const dedupeKey = t.ticketId || `${plantId}:${t.ticketNum}:${t.loadedTime}`
                    if (seenTickets.has(dedupeKey)) continue
                    seenTickets.add(dedupeKey)

                    const attributedPlant = t.loadedPlantCode || plantId
                    const ticketRow = { ...t, plantId: attributedPlant, sourceFilePlantId: plantId }
                    existing.tickets.push(ticketRow)
                    existing.ticketCount += 1
                    existing.loadedYardage += t.quantity || 0

                    const plantEntry =
                        existing.byPlant[attributedPlant] ||
                        (existing.byPlant[attributedPlant] = { loadedYardage: 0, ticketCount: 0 })
                    plantEntry.ticketCount += 1
                    plantEntry.loadedYardage += t.quantity || 0
                }
            }
        }
        // ── DetailDriver merge ──────────────────────────────────────────
        // DetailDriver fills in cross-plant tickets that DetailOrderAnalysis
        // can't see (loads where the loading plant ≠ order home plant). Match
        // strategy:
        //   1. ticketNum already in `byOrderId` → just refine plant
        //      attribution to the loading plant from the driver report.
        //   2. ticketNum unknown → look up the home order via
        //      (orderNum, customer) against the DailyOrder data we were
        //      handed in `plantProduction`.
        //   3. No match → drop (we don't know which order it goes to).

        // Index existing DetailOrderAnalysis tickets by ticketNum.
        const existingTicketIndex = new Map()
        for (const order of Object.values(byOrderId)) {
            for (const t of order.tickets) {
                if (t.ticketNum) existingTicketIndex.set(t.ticketNum, { orderId: order.orderId, ticket: t })
            }
        }

        // Build (orderNum + customer) → orderId lookup from DailyOrder data.
        // We index two ways: a strict (orderNum + normalized customer) key and
        // a loose orderNum-only key. Strict wins; loose is the fallback for
        // customer-name drift between reports.
        const orderLookupStrict = new Map()
        const orderLookupLoose = new Map()
        if (plantProduction && typeof plantProduction === 'object') {
            for (const prod of Object.values(plantProduction)) {
                const orders = Array.isArray(prod?.orders) ? prod.orders : []
                for (const o of orders) {
                    if (!o?.orderId || !o?.orderNum) continue
                    const orderNum = String(o.orderNum)
                    const cust = normalizeCustomer(o.customer)
                    if (cust) orderLookupStrict.set(`${orderNum}||${cust}`, o.orderId)
                    // Loose lookup keeps the FIRST orderId for each orderNum;
                    // collisions (same orderNum across plants) still resolve
                    // via the strict customer match above.
                    if (!orderLookupLoose.has(orderNum)) orderLookupLoose.set(orderNum, o.orderId)
                }
            }
        }

        let crossPlantAdded = 0
        let crossPlantRefined = 0
        for (const { plantId, tickets } of perPlantDriver) {
            for (const t of tickets) {
                if (!t.ticketNum) continue

                const existing = existingTicketIndex.get(t.ticketNum)
                if (existing) {
                    // Same ticket already counted via DetailOrderAnalysis.
                    // The DetailDriver report's plant context (the file's
                    // plantId) IS authoritative for loading-plant attribution;
                    // re-attribute byPlant counts if we previously had it
                    // under a different plant.
                    const order = byOrderId[existing.orderId]
                    const oldPlant = existing.ticket.plantId
                    if (oldPlant !== plantId) {
                        const oldEntry = order.byPlant[oldPlant]
                        if (oldEntry) {
                            oldEntry.ticketCount = Math.max(0, oldEntry.ticketCount - 1)
                            oldEntry.loadedYardage = Math.max(
                                0,
                                oldEntry.loadedYardage - (existing.ticket.quantity || 0)
                            )
                            if (oldEntry.ticketCount === 0 && oldEntry.loadedYardage === 0) {
                                delete order.byPlant[oldPlant]
                            }
                        }
                        const newEntry =
                            order.byPlant[plantId] || (order.byPlant[plantId] = { loadedYardage: 0, ticketCount: 0 })
                        newEntry.ticketCount += 1
                        newEntry.loadedYardage += existing.ticket.quantity || 0
                        existing.ticket.plantId = plantId
                        existing.ticket.sourceFilePlantId = plantId
                        crossPlantRefined++
                    }
                    continue
                }

                // Brand-new ticket from DetailDriver — try to attach to a
                // home order via DailyOrder lookup.
                const orderNum = String(t.orderNum || '')
                if (!orderNum) continue
                const cust = normalizeCustomer(t.customer)
                let orderId = (cust && orderLookupStrict.get(`${orderNum}||${cust}`)) || orderLookupLoose.get(orderNum)
                if (!orderId) continue

                let order = byOrderId[orderId]
                if (!order) {
                    order = byOrderId[orderId] = {
                        byPlant: {},
                        loadedYardage: 0,
                        orderId,
                        orderNum,
                        ticketCount: 0,
                        tickets: []
                    }
                }

                // DetailDriver doesn't carry yardage — leave quantity at 0
                // and flag the source so the UI can render those rows
                // distinctly if it wants to.
                const ticketRow = {
                    customer: t.customer,
                    driverName: t.driverName,
                    driverNum: t.driverNum,
                    loadedTime: t.loadedTime,
                    orderNum,
                    plantId, // loading plant from the file
                    quantity: 0,
                    sourceFilePlantId: plantId,
                    sourceReport: 'DetailDriver',
                    ticketId: '',
                    ticketNum: t.ticketNum,
                    ticketTime: t.ticketTime,
                    truckNum: t.truckNum
                }
                order.tickets.push(ticketRow)
                order.ticketCount += 1
                existingTicketIndex.set(t.ticketNum, { orderId, ticket: ticketRow })

                const plantEntry =
                    order.byPlant[plantId] || (order.byPlant[plantId] = { loadedYardage: 0, ticketCount: 0 })
                plantEntry.ticketCount += 1
                crossPlantAdded++
            }
        }

        if (crossPlantAdded || crossPlantRefined) {
            console.info(
                `[DetailOrderBucketService] ${dateStr} DetailDriver merge: ` +
                    `added ${crossPlantAdded} cross-plant ticket(s), refined ${crossPlantRefined} attribution(s)`
            )
        }

        // Sort each order's tickets chronologically by loaded time so the
        // modal renders them in the order trucks left the plant.
        for (const o of Object.values(byOrderId)) {
            o.tickets.sort((a, b) => String(a.loadedTime || '').localeCompare(String(b.loadedTime || '')))
        }
        return byOrderId
    }
}

export const DetailOrderBucketService = new DetailOrderBucketServiceImpl()
