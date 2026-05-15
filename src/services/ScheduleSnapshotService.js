import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'schedule-snapshot-service'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reads the daily 5:30 PM Central schedule snapshots written by the
 * `schedule-snapshot-service` edge function (cron-fired). The frontend
 * uses these to diff "what the schedule looked like after we finalized it
 * last night" vs. "where it's actually at right now."
 *
 * Snapshots are kept forever — the table is single-row-per-date so the
 * cache here is keyed by `scheduleDate` and never expires within the page
 * session. A page reload re-fetches.
 */
class ScheduleSnapshotServiceImpl {
    snapshotByDate = new Map()
    inFlight = new Map()

    /** Fetch a single date's snapshot. Returns `null` when no snapshot
     *  exists (Sunday skip, empty day, future date that hasn't passed
     *  5:30 PM yet). */
    async getSnapshot(scheduleDate) {
        if (!scheduleDate || !ISO_DATE.test(scheduleDate)) return null
        if (this.snapshotByDate.has(scheduleDate)) {
            return this.snapshotByDate.get(scheduleDate)
        }
        if (this.inFlight.has(scheduleDate)) {
            return this.inFlight.get(scheduleDate)
        }
        const promise = (async () => {
            try {
                const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/get-by-date`, { scheduleDate })
                if (!res?.ok) {
                    console.warn('[ScheduleSnapshotService.getSnapshot] failed:', res?.status, json?.error)
                    return null
                }
                const snapshot = json?.snapshot ?? null
                this.snapshotByDate.set(scheduleDate, snapshot)
                return snapshot
            } catch (error) {
                console.warn('[ScheduleSnapshotService.getSnapshot] threw:', error)
                return null
            } finally {
                this.inFlight.delete(scheduleDate)
            }
        })()
        this.inFlight.set(scheduleDate, promise)
        return promise
    }

    /** List recent snapshots (date + summary fields only — for an admin
     *  history view). */
    async listRecent({ limit = 30 } = {}) {
        try {
            const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/list-recent`, { limit })
            if (!res?.ok) {
                console.warn('[ScheduleSnapshotService.listRecent] failed:', res?.status, json?.error)
                return []
            }
            return Array.isArray(json?.snapshots) ? json.snapshots : []
        } catch (error) {
            console.warn('[ScheduleSnapshotService.listRecent] threw:', error)
            return []
        }
    }

    /** Wipe the in-memory cache (used when the user manually refreshes the
     *  Schedule view so a re-render fetches a fresh copy). */
    clearCache() {
        this.snapshotByDate.clear()
    }
}

export const ScheduleSnapshotService = new ScheduleSnapshotServiceImpl()
