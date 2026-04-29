import { parseDetailOrderHtml } from '../utils/DetailOrderParser'
import { Database } from './DatabaseService'

const BUCKET = 'dispatch-reports'

/** Plants the bridge userscript pulls DetailOrderAnalysis reports for. Must
 *  stay in sync with `PLANT_IDS` in `bridge/smyrna-dispatch-sync.user.js` —
 *  any plant missing here simply won't have ticket data surfaced. */
const PLANT_IDS = ['401', '402', '403', '405', '406', '407', '408', '410', '453', '455', '461', '468']

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
                    if (error || !data) return []
                    const html = await data.text()
                    return parseDetailOrderHtml(html)
                } catch (err) {
                    console.warn(`[DetailOrderBucketService] download failed for ${plantId}:`, err)
                    return []
                }
            })
        )

        const byOrderId = {}
        for (const orders of perPlant) {
            for (const o of orders) {
                if (!o.orderId) continue
                const existing = byOrderId[o.orderId]
                if (existing) {
                    existing.ticketCount += o.ticketCount
                    existing.loadedYardage += o.loadedYardage
                } else {
                    byOrderId[o.orderId] = { ...o }
                }
            }
        }
        return byOrderId
    }
}

export const DetailOrderBucketService = new DetailOrderBucketServiceImpl()
