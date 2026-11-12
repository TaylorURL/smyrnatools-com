import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { STALE_NOTES_ASKED_KEY } from '../../constants/dashboardConstants'
import { useStaleNotes } from '../useStaleNotes'

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString()

// Each table answers from its own rows, honouring the filters the hook uses,
// so the test sees exactly what the author read and the plant read return.
const rows = {}
vi.mock('../../../services/DatabaseService', () => ({
    Database: {
        from: (table) => {
            const filters = []
            const query = {
                eq: (col, val) => (filters.push((r) => r[col] === val), query),
                in: (col, vals) => (filters.push((r) => vals.includes(r[col])), query),
                is: (col, val) => (filters.push((r) => (r[col] ?? null) === val), query),
                lt: (col, val) => (filters.push((r) => r[col] < val), query),
                select: () => query,
                then: (resolve) => {
                    resolve({ data: (rows[table] || []).filter((r) => filters.every((f) => f(r))), error: null })
                }
            }
            return query
        }
    }
}))

let roles = []
vi.mock('../../../services/UserService', () => ({
    UserService: {
        getUserDisplayName: async (id) => `Name ${id}`,
        getUserRoles: async () => roles
    }
}))
vi.mock('../../../services/SessionService', () => ({ getSessionUserId: () => 'me' }))
vi.mock('../../../services/MixerService', () => ({ MixerService: {} }))
vi.mock('../../../services/TractorService', () => ({ TractorService: {} }))
vi.mock('../../../services/TrailerService', () => ({ TrailerService: {} }))
vi.mock('../../../services/EquipmentService', () => ({ EquipmentService: {} }))
vi.mock('../../../services/PickupTruckService', () => ({ PickupTruckService: {} }))
vi.mock('../../../services/OperatorService', () => ({ OperatorService: {} }))

const MIXERS = [
    { id: 'm1', plantCode: '401', truckNumber: '2121' },
    { id: 'm2', plantCode: '999', truckNumber: '3030' }
]

const note = (over) => ({ created_at: daysAgo(45), permanent: false, text: 'note', ...over })

const render = (plantCodes) =>
    renderHook(() =>
        useStaleNotes({
            dataReady: true,
            plantCodes,
            recordRefs: { mixers: { current: MIXERS } }
        })
    )

describe('useStaleNotes', () => {
    beforeEach(() => {
        sessionStorage.clear()
        roles = []
        for (const key of Object.keys(rows)) delete rows[key]
        rows.mixers_comments = [
            note({ author: 'me', id: 'mine-far', mixer_id: 'm2', text: 'Mine at another plant' }),
            note({ author: 'someone', id: 'theirs-far', mixer_id: 'm2', text: 'Not mine, not my plant' }),
            note({ author: 'someone', id: 'theirs-home', mixer_id: 'm1', text: 'At my plant' }),
            note({ author: 'me', created_at: daysAgo(5), id: 'mine-new', mixer_id: 'm2' }),
            note({ author: 'me', id: 'mine-kept', mixer_id: 'm2', permanent: true })
        ]
        rows.mixers_maintenance = [
            {
                created_by: 'me',
                id: 'issue-mine',
                issue: 'My open issue',
                mixer_id: 'm2',
                permanent: false,
                severity: 'High',
                time_completed: null,
                time_created: daysAgo(40)
            },
            {
                created_by: 'me',
                id: 'issue-done',
                issue: 'Fixed',
                mixer_id: 'm2',
                permanent: false,
                severity: 'Low',
                time_completed: daysAgo(35),
                time_created: daysAgo(40)
            }
        ]
    })

    it('asks anyone about the old notes they wrote, whatever their role or plant', async () => {
        roles = [{ name: 'Dispatcher' }]
        const { result } = render(null)
        await waitFor(() => expect(result.current.notes).toHaveLength(2))
        expect(result.current.notes.map((n) => n.key).sort()).toEqual(['comment:mine-far', 'issue:issue-mine'])
        expect(result.current.notes.every((n) => n.mine && !n.atMyPlants)).toBe(true)
        expect(result.current.notes[0]).toMatchObject({ assetLabel: '3030', authorName: 'Name me' })
    })

    it('still gives a plant manager everything at their plants, plus their own elsewhere', async () => {
        roles = [{ name: 'Plant Manager' }]
        const { result } = render(new Set(['401']))
        await waitFor(() => expect(result.current.notes).toHaveLength(3))
        const byKey = Object.fromEntries(result.current.notes.map((n) => [n.key, n]))
        expect(Object.keys(byKey).sort()).toEqual(['comment:mine-far', 'comment:theirs-home', 'issue:issue-mine'])
        expect(byKey['comment:theirs-home']).toMatchObject({ atMyPlants: true, mine: false })
        expect(byKey['comment:mine-far']).toMatchObject({ atMyPlants: false, mine: true })
    })

    it('does not show plant notes to someone at a plant who is not its manager', async () => {
        roles = [{ name: 'Operator' }]
        const { result } = render(new Set(['401']))
        await waitFor(() => expect(result.current.notes).toHaveLength(2))
        expect(result.current.notes.some((n) => n.key === 'comment:theirs-home')).toBe(false)
    })

    it('asks nothing once this visit has been dismissed', async () => {
        sessionStorage.setItem(STALE_NOTES_ASKED_KEY + 'me', '1')
        const { result } = render(null)
        await new Promise((r) => setTimeout(r, 20))
        expect(result.current.notes).toEqual([])
    })
})
