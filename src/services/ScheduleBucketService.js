import { Database } from './DatabaseService'

const BUCKET = 'dispatch-reports'

/**
 * Reads the auto-synced daily schedule HTML files that a Tampermonkey script
 * uploads from the dispatch workstation. Files are named `YYYY-MM-DD.html` and
 * contain the raw Daily Order Listing for that date. The bucket is refreshed
 * every 5 minutes for today + 7 future days.
 */
class ScheduleBucketServiceImpl {
    /** Downloads the schedule HTML for a given date. Returns null if missing. */
    async fetchScheduleByDate(dateStr) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
        try {
            const { data, error } = await Database.storage.from(BUCKET).download(`${dateStr}.html`)
            if (error) {
                // File not in bucket yet, or access denied — either way, skip this cycle.
                return null
            }
            if (!data) return null
            return await data.text()
        } catch (err) {
            console.warn('[ScheduleBucketService] download failed:', err)
            return null
        }
    }

    /**
     * Returns the storage file's last upload time as a Date, or null if the
     * file doesn't exist yet. Used to surface a "schedule is stale" warning
     * when the dispatch workstation stops pushing updates.
     */
    async fetchScheduleUpdatedAt(dateStr) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
        try {
            const fileName = `${dateStr}.html`
            const { data, error } = await Database.storage.from(BUCKET).list('', { search: fileName })
            if (error || !Array.isArray(data)) return null
            const file = data.find((f) => f.name === fileName)
            const stamp = file?.updated_at || file?.created_at
            return stamp ? new Date(stamp) : null
        } catch (err) {
            console.warn('[ScheduleBucketService] list failed:', err)
            return null
        }
    }
}

export const ScheduleBucketService = new ScheduleBucketServiceImpl()
