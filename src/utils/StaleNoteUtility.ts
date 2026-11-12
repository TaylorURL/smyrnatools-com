/**
 * When a comment or an open issue is old enough to doubt. After thirty days
 * the truck, the operator or the repair a note describes has usually moved on,
 * so the comment and issue popups flag anything older and the dashboard asks
 * plant managers whether it still applies.
 */

export const STALE_NOTE_DAYS = 30

const MS_PER_DAY = 86400000

/** The instant a note has to be older than to count as stale, as ISO. */
export const staleNoteCutoff = (now: number = Date.now()): string =>
    new Date(now - STALE_NOTE_DAYS * MS_PER_DAY).toISOString()

/** Whole days since the note was written; 0 for a missing or unreadable date. */
export const noteAgeInDays = (dateString: string | null | undefined, now: number = Date.now()): number => {
    const time = dateString ? Date.parse(dateString) : NaN
    if (!Number.isFinite(time)) return 0
    return Math.max(0, Math.floor((now - time) / MS_PER_DAY))
}

/** True once the note is more than `STALE_NOTE_DAYS` old. */
export const isStaleNote = (dateString: string | null | undefined, now: number = Date.now()): boolean => {
    const time = dateString ? Date.parse(dateString) : NaN
    return Number.isFinite(time) && now - time > STALE_NOTE_DAYS * MS_PER_DAY
}

/**
 * How long a comment or an open issue lives unless it was kept permanently
 * when it was written. `expire_old_notes()` deletes anything older every
 * night; change both together.
 */
export const NOTE_EXPIRY_MONTHS = 3

/** When the nightly job deletes a note written at `dateString`, or null for a
 *  missing or unreadable date. Calendar months, the way Postgres reads
 *  `interval '3 months'` on a UTC database. */
export const noteExpiresAt = (dateString: string | null | undefined): Date | null => {
    const time = dateString ? Date.parse(dateString) : NaN
    if (!Number.isFinite(time)) return null
    const at = new Date(time)
    at.setUTCMonth(at.getUTCMonth() + NOTE_EXPIRY_MONTHS)
    return at
}

/** Plant Manager, and the combined roles that carry it, such as "Plant
 *  Manager & Equipment Manager". Matched the way the dashboard's people
 *  section buckets roles, so both agree on who counts. */
export const isPlantManagerRole = (roleName: string | null | undefined): boolean => {
    const name = String(roleName || '').toLowerCase()
    return name.includes('plant') && name.includes('manager')
}
