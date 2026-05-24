import { Database } from '../../../../../../services/DatabaseService'
import { ALLOWED_FILE_TYPE, DUMP_LOCATIONS, REASONS, STORAGE_BUCKET, STORAGE_PREFIX } from './constants'

export function getCurrentWeekBounds() {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + diff)
    monday.setHours(12, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    return { monday: monday.toISOString(), saturday: saturday.toISOString() }
}

/** Uploads a PDF to storage and returns the public URL. */
export async function uploadWriteup(file, userId) {
    const fileName = `${STORAGE_PREFIX}/${userId}_${Date.now()}.pdf`
    const { error } = await Database.storage.from(STORAGE_BUCKET).upload(fileName, file, {
        cacheControl: '3600',
        contentType: ALLOWED_FILE_TYPE,
        upsert: false
    })
    if (error) throw new Error('Failed to upload writeup: ' + error.message)
    const { data: urlData } = Database.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
    return urlData?.publicUrl || fileName
}

/** Splits a stored "Category: explanation" reason string into the editable form pieces. */
export function parseInitialReason(rawReason) {
    const full = rawReason || ''
    if (!full) return { category: '', explanation: '' }
    const idx = full.indexOf(':')
    const [cat] = full.split(':')
    const trimmedCat = (cat || '').trim()
    const category = REASONS.includes(trimmedCat) ? trimmedCat : 'Other'
    const explanation = idx === -1 ? full : full.slice(idx + 1).trim()
    return { category, explanation }
}

/** Splits a stored dump location into a category choice and the "Other" free-text. */
export function parseInitialDumpLocation(rawDumpLocation) {
    if (!rawDumpLocation) return { category: '', other: '' }
    if (DUMP_LOCATIONS.includes(rawDumpLocation)) return { category: rawDumpLocation, other: '' }
    return { category: 'Other', other: rawDumpLocation }
}
