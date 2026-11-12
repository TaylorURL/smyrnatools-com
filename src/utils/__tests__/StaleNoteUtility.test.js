import { describe, expect, it } from 'vitest'

import {
    isPlantManagerRole,
    isStaleNote,
    noteAgeInDays,
    noteExpiresAt,
    STALE_NOTE_DAYS,
    staleNoteCutoff
} from '../StaleNoteUtility'

const NOW = Date.parse('2026-11-03T12:00:00Z')
const daysBefore = (days) => new Date(NOW - days * 86400000).toISOString()

describe('StaleNoteUtility', () => {
    it('counts a note as stale only once it is past the limit', () => {
        expect(isStaleNote(daysBefore(STALE_NOTE_DAYS - 1), NOW)).toBe(false)
        expect(isStaleNote(daysBefore(STALE_NOTE_DAYS), NOW)).toBe(false)
        expect(isStaleNote(daysBefore(STALE_NOTE_DAYS + 0.01), NOW)).toBe(true)
        expect(isStaleNote(daysBefore(200), NOW)).toBe(true)
    })

    it('never counts a missing or unreadable date as stale', () => {
        expect(isStaleNote(null, NOW)).toBe(false)
        expect(isStaleNote(undefined, NOW)).toBe(false)
        expect(isStaleNote('', NOW)).toBe(false)
        expect(isStaleNote('not a date', NOW)).toBe(false)
    })

    it('puts the cutoff the limit before now', () => {
        expect(staleNoteCutoff(NOW)).toBe(daysBefore(STALE_NOTE_DAYS))
    })

    it('reads the age in whole days', () => {
        expect(noteAgeInDays(daysBefore(45.7), NOW)).toBe(45)
        expect(noteAgeInDays(null, NOW)).toBe(0)
        expect(noteAgeInDays(daysBefore(-2), NOW)).toBe(0)
    })

    it('puts the expiry three calendar months after the note was written', () => {
        expect(noteExpiresAt('2026-11-03T12:00:00Z')?.toISOString()).toBe('2027-02-03T12:00:00.000Z')
        expect(noteExpiresAt('2026-08-15T12:00:00Z')?.toISOString()).toBe('2026-11-15T12:00:00.000Z')
        expect(noteExpiresAt(null)).toBeNull()
        expect(noteExpiresAt('not a date')).toBeNull()
    })

    it('recognises plant manager roles, combined ones included', () => {
        expect(isPlantManagerRole('Plant Manager')).toBe(true)
        expect(isPlantManagerRole('Plant Manager & Equipment Manager')).toBe(true)
        expect(isPlantManagerRole('District Manager')).toBe(false)
        expect(isPlantManagerRole('Dispatcher')).toBe(false)
        expect(isPlantManagerRole(null)).toBe(false)
    })
})
