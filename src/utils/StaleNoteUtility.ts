/**
 * When a comment or an open issue is old enough to doubt. After thirty days
 * the truck, the operator or the repair a note describes has usually moved on,
 * so the comment and issue popups flag anything older and the dashboard asks
 * whoever wrote it, and the plant managers where it sits, whether it still
 * applies.
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

/** Who the dashboard's old-notes prompt is speaking to, for its heading. */
export type StaleNotesAudience = 'mine' | 'plants' | 'mixed'

interface StaleNoteLike {
    atMyPlants?: boolean
    authorId?: string | null
    key: string
    mine?: boolean
    plantCode?: string | null
}

/**
 * One list from the author's read and the plant manager's read, which overlap
 * wherever a manager wrote a note at their own plant. Each note is marked
 * `mine` when the user wrote it and `atMyPlants` when it sits at one of
 * `managedPlants`, the plants of a plant manager (empty for anyone else).
 */
export const mergeStaleNotes = <T extends StaleNoteLike>(
    notes: T[],
    userId: string,
    managedPlants: Iterable<string> = []
): (T & { atMyPlants: boolean; mine: boolean })[] => {
    const plants = new Set([...managedPlants].map((code) => String(code).trim()).filter(Boolean))
    const byKey = new Map<string, T & { atMyPlants: boolean; mine: boolean }>()
    for (const note of notes) {
        if (!note?.key || byKey.has(note.key)) continue
        byKey.set(note.key, {
            ...note,
            atMyPlants: plants.has(String(note.plantCode ?? '').trim()),
            mine: Boolean(userId) && String(note.authorId ?? '') === userId
        })
    }
    return [...byKey.values()]
}

/** `plants` when every note sits at the plant manager's plants, `mine` when
 *  none does (so each is there because the user wrote it), `mixed` otherwise. */
export const staleNotesAudience = (notes: StaleNoteLike[]): StaleNotesAudience => {
    const atPlants = notes.filter((note) => note.atMyPlants).length
    if (notes.length && atPlants === notes.length) return 'plants'
    return atPlants === 0 ? 'mine' : 'mixed'
}

/** The heading on the dashboard's old-notes card. */
export const staleNotesHeading = (notes: StaleNoteLike[]): string => {
    const audience = staleNotesAudience(notes)
    if (audience === 'plants') return 'Old notes at your plants'
    if (audience === 'mine') return 'Your old notes'
    return 'Old notes at your plants and yours'
}
