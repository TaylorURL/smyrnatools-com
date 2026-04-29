import { parseDetailOrderHtml } from '../utils/DetailOrderParser'
import { Database } from './DatabaseService'

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
     */
    async fetchByDate(dateStr) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return {}

        const perPlant = await Promise.all(
            PLANT_IDS.map(async (plantId) => {
                try {
                    const path = `detail/${dateStr}_${plantId}.html`
                    const { data, error } = await Database.storage.from(BUCKET).download(path)
                    if (error || !data) return { plantId, orders: [] }
                    const html = await data.text()
                    return { plantId, orders: parseDetailOrderHtml(html) }
                } catch (err) {
                    console.warn(`[DetailOrderBucketService] download failed for ${plantId}:`, err)
                    return { plantId, orders: [] }
                }
            })
        )

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
        // Sort each order's tickets chronologically by loaded time so the
        // modal renders them in the order trucks left the plant.
        for (const o of Object.values(byOrderId)) {
            o.tickets.sort((a, b) => String(a.loadedTime || '').localeCompare(String(b.loadedTime || '')))
        }
        return byOrderId
    }
}

export const DetailOrderBucketService = new DetailOrderBucketServiceImpl()
