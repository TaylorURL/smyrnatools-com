import { Database } from './DatabaseService'

/**
 * Loads today's Dayforce shifts and folds them into a map keyed by
 * smyrnatools employee badge so any operator-name surface can render a
 * "clocked in" / "clocked out" indicator without each consumer
 * re-querying the database.
 *
 * Returns `Map<badgeString, { actualInAt, actualOutAt, isClockedIn,
 * shiftDate }>`. A shift counts as clocked-in when `actual_in_at` is
 * populated and `actual_out_at` is still null — the same rule the
 * Dayforce Schedules page applies for the green "On the clock" pill.
 */
const TABLE = 'dayforce_shifts'

const localIsoDate = (date) => {
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

const normalizeBadge = (badge) => {
    if (badge == null) return ''
    return String(badge).trim()
}

class OperatorClockStatusServiceImpl {
    /** Pulls every shift dated today (local time) plus the trailing two
     *  days — overnight shifts that started yesterday but haven't clocked
     *  out yet still count as currently clocked in. The trailing window
     *  is tight on purpose; the table is touched on every poll, so
     *  scanning yesterday is plenty and avoids re-fetching weeks of data. */
    async fetchTodayStatuses() {
        const today = new Date()
        const start = new Date(today.getTime() - 2 * 86_400_000)
        const startIso = localIsoDate(start)
        const endIso = localIsoDate(today)
        const { data, error } = await Database.from(TABLE)
            .select('dayforce_employee_id, employee_badge, shift_date, actual_in_at, actual_out_at')
            .gte('shift_date', startIso)
            .lte('shift_date', endIso)
        if (error || !Array.isArray(data)) return new Map()

        // Newest open shift wins per badge — if a driver clocked in
        // twice the same day with a break in between, the later
        // currently-open punch is the one that matters for "are they
        // on the clock right now?".
        const byBadge = new Map()
        for (const row of data) {
            const badge = normalizeBadge(row.employee_badge)
            if (!badge) continue
            const isClockedIn = !!row.actual_in_at && !row.actual_out_at
            const existing = byBadge.get(badge)
            // Prefer currently-open shifts over closed ones. Among open
            // shifts (or among closed ones), keep the most recent
            // shift_date so the indicator reflects the latest punch.
            if (!existing) {
                byBadge.set(badge, {
                    actualInAt: row.actual_in_at || null,
                    actualOutAt: row.actual_out_at || null,
                    dayforceEmployeeId: row.dayforce_employee_id,
                    isClockedIn,
                    shiftDate: row.shift_date
                })
                continue
            }
            if (isClockedIn && !existing.isClockedIn) {
                byBadge.set(badge, {
                    actualInAt: row.actual_in_at || null,
                    actualOutAt: row.actual_out_at || null,
                    dayforceEmployeeId: row.dayforce_employee_id,
                    isClockedIn: true,
                    shiftDate: row.shift_date
                })
                continue
            }
            if (isClockedIn === existing.isClockedIn && row.shift_date > existing.shiftDate) {
                byBadge.set(badge, {
                    actualInAt: row.actual_in_at || null,
                    actualOutAt: row.actual_out_at || null,
                    dayforceEmployeeId: row.dayforce_employee_id,
                    isClockedIn,
                    shiftDate: row.shift_date
                })
            }
        }
        return byBadge
    }
}

const OperatorClockStatusService = new OperatorClockStatusServiceImpl()
export default OperatorClockStatusService
