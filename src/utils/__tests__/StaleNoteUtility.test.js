import { describe, expect, it } from 'vitest'

import {
    isAutoResolvedNote,
    isPlantManagerRole,
    isResolvedComment,
    isStaleNote,
    mergeStaleNotes,
    noteAgeInDays,
    noteExpiresAt,
    STALE_NOTE_DAYS,
    staleNoteCutoff,
    staleNotesAudience,
    staleNotesHeading
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

    it('tells resolved and timed-out notes from active ones, model or raw row', () => {
        expect(isResolvedComment({ resolved_at: '2026-11-12T10:30:00Z' })).toBe(true)
        expect(isResolvedComment({ resolvedAt: '2026-11-12T10:30:00Z' })).toBe(true)
        expect(isResolvedComment({ resolved_at: null })).toBe(false)
        expect(isResolvedComment(null)).toBe(false)
        expect(isAutoResolvedNote({ auto_resolved: true })).toBe(true)
        expect(isAutoResolvedNote({ autoResolved: true })).toBe(true)
        expect(isAutoResolvedNote({ auto_resolved: false })).toBe(false)
        expect(isAutoResolvedNote(undefined)).toBe(false)
    })

    it('recognises plant manager roles, combined ones included', () => {
        expect(isPlantManagerRole('Plant Manager')).toBe(true)
        expect(isPlantManagerRole('Plant Manager & Equipment Manager')).toBe(true)
        expect(isPlantManagerRole('District Manager')).toBe(false)
        expect(isPlantManagerRole('Dispatcher')).toBe(false)
        expect(isPlantManagerRole(null)).toBe(false)
    })

    it('merges the author and plant reads into one list, marking whose and where', () => {
        const merged = mergeStaleNotes(
            [
                { authorId: 'me', key: 'comment:a', plantCode: '401' },
                { authorId: 'me', key: 'issue:b', plantCode: '999' },
                { authorId: 'me', key: 'comment:a', plantCode: '401' },
                { authorId: 'someone', key: 'comment:c', plantCode: ' 401 ' }
            ],
            'me',
            ['401']
        )
        expect(merged.map((n) => [n.key, n.mine, n.atMyPlants])).toEqual([
            ['comment:a', true, true],
            ['issue:b', true, false],
            ['comment:c', false, true]
        ])
    })

    it('marks nothing at my plants for someone who manages none', () => {
        const merged = mergeStaleNotes([{ authorId: 'me', key: 'comment:a', plantCode: '' }], 'me')
        expect(merged[0]).toMatchObject({ atMyPlants: false, mine: true })
        expect(mergeStaleNotes([{ authorId: 'me', key: 'comment:a' }], '')[0].mine).toBe(false)
    })

    it('heads the prompt by whose notes it holds', () => {
        expect(staleNotesAudience([{ atMyPlants: true, key: 'a' }])).toBe('plants')
        expect(staleNotesAudience([{ atMyPlants: false, key: 'a', mine: true }])).toBe('mine')
        expect(
            staleNotesAudience([
                { atMyPlants: true, key: 'a' },
                { key: 'b', mine: true }
            ])
        ).toBe('mixed')
        expect(staleNotesHeading([{ atMyPlants: true, key: 'a', mine: true }])).toBe('Old notes at your plants')
        expect(staleNotesHeading([{ key: 'a', mine: true }])).toBe('Your old notes')
        expect(
            staleNotesHeading([
                { atMyPlants: true, key: 'a' },
                { key: 'b', mine: true }
            ])
        ).toBe('Old notes at your plants and yours')
    })
})
