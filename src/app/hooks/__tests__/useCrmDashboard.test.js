import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CrmRosterService from '../../../services/CrmRosterService'
import CrmService from '../../../services/CrmService'

vi.mock('../../../services/CrmRosterService', () => ({
    default: {
        fetchRoster: vi.fn(),
        fetchLeaderboard: vi.fn(),
        fetchRecentActivity: vi.fn()
    }
}))

vi.mock('../../../services/CrmService', () => ({
    default: {
        fetchOpportunities: vi.fn(),
        fetchFollowups: vi.fn(),
        fetchMyDesk: vi.fn()
    }
}))

// useMyDesk internally calls CrmService.fetchMyDesk, but we mock the whole
// hook to keep these tests focused on the aggregation logic.
vi.mock('../useMyDesk', () => ({
    useMyDesk: vi.fn(() => ({
        desk: { followups: [], accounts: [], opportunities: [], recentActivity: [] },
        isLoading: false,
        error: null
    }))
}))

import { aggregateDashboard, useCrmDashboard } from '../useCrmDashboard'

// Fixed "now" — 2026-05-29 12:00 UTC
const NOW_ISO = '2026-05-29T12:00:00.000Z'
const NOW_MS = new Date(NOW_ISO).getTime()

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
    vi.clearAllMocks()

    CrmRosterService.fetchRoster.mockResolvedValue([])
    CrmRosterService.fetchLeaderboard.mockResolvedValue({ daysWindow: 7, rows: [] })
    CrmRosterService.fetchRecentActivity.mockResolvedValue([])
    CrmService.fetchOpportunities.mockResolvedValue([])
    CrmService.fetchFollowups.mockResolvedValue([])
    CrmService.fetchMyDesk.mockResolvedValue({
        followups: [],
        accounts: [],
        opportunities: [],
        recentActivity: []
    })
})

afterEach(() => {
    vi.useRealTimers()
})

// ── Pure aggregation (no React) ────────────────────────────────────────────────

describe('aggregateDashboard', () => {
    it('counts total, customers, prospects, dormant correctly', () => {
        const roster = [
            { lifecycle_stage: 'customer', pouring_status: 'active', last_call_at: NOW_ISO },
            { lifecycle_stage: 'customer', pouring_status: 'dormant', last_call_at: null, days_since_last_pour: 45 },
            { lifecycle_stage: 'prospect', pouring_status: 'never', last_call_at: null },
            { lifecycle_stage: 'prospect', pouring_status: 'dormant', last_call_at: null, days_since_last_pour: 60 }
        ]
        const result = aggregateDashboard({
            roster,
            opps: [],
            followups: [],
            activity: [],
            leaderboardResult: { rows: [] }
        })
        expect(result.roster.total).toBe(4)
        expect(result.roster.customers).toBe(2)
        expect(result.roster.prospects).toBe(2)
        expect(result.roster.dormant).toBe(2)
    })

    it('counts neverCalledOrStale for no last_call_at or call older than 30 days', () => {
        const thirtyOneDaysAgoIso = new Date(NOW_MS - 31 * 24 * 60 * 60 * 1000).toISOString()
        const recentCallIso = new Date(NOW_MS - 5 * 24 * 60 * 60 * 1000).toISOString()
        const roster = [{ last_call_at: null }, { last_call_at: thirtyOneDaysAgoIso }, { last_call_at: recentCallIso }]
        const result = aggregateDashboard({
            roster,
            opps: [],
            followups: [],
            activity: [],
            leaderboardResult: { rows: [] }
        })
        expect(result.roster.neverCalledOrStale).toBe(2)
    })

    it('splits real vs virtual opportunities correctly', () => {
        const opps = [
            { id: 'o1', stage: 'new', virtual: false },
            { id: 'o2', stage: 'contacted', virtual: false },
            { id: 'o3', stage: 'new', virtual: true },
            { id: 'o4', stage: 'quoted', virtual: false }
        ]
        const result = aggregateDashboard({
            roster: [],
            opps,
            followups: [],
            activity: [],
            leaderboardResult: { rows: [] }
        })
        expect(result.pipeline.realOpenTotal).toBe(3)
        expect(result.pipeline.virtualTotal).toBe(1)
        // byStage counts REAL opps only (virtual suggestions are tracked
        // separately via virtualTotal) — o1 is the only real 'new' opp.
        expect(result.pipeline.byStage.new).toBe(1)
        expect(result.pipeline.byStage.contacted).toBe(1)
        expect(result.pipeline.byStage.quoted).toBe(1)
    })

    it('buckets overdue, dueToday, and upcoming follow-ups', () => {
        const overdueIso = '2026-05-01T12:00:00Z'
        const dueTodayIso = '2026-05-29T18:00:00Z'
        const upcomingIso = '2026-06-15T12:00:00Z'

        const followups = [
            { id: 'f1', due_at: overdueIso },
            { id: 'f2', due_at: dueTodayIso },
            { id: 'f3', due_at: upcomingIso },
            { id: 'f4', due_at: null } // no due date → upcoming bucket
        ]

        const result = aggregateDashboard({
            roster: [],
            opps: [],
            followups,
            activity: [],
            leaderboardResult: { rows: [] }
        })

        expect(result.teamFollowups.overdue).toHaveLength(1)
        expect(result.teamFollowups.overdue[0].id).toBe('f1')
        expect(result.teamFollowups.dueToday).toHaveLength(1)
        expect(result.teamFollowups.dueToday[0].id).toBe('f2')
        expect(result.teamFollowups.upcoming).toHaveLength(2)
    })

    it('counts interactions in the last 7 days correctly', () => {
        const recentIso = new Date(NOW_MS - 2 * 24 * 60 * 60 * 1000).toISOString()
        const oldIso = new Date(NOW_MS - 10 * 24 * 60 * 60 * 1000).toISOString()
        const activity = [
            { id: 'a1', created_at: recentIso },
            { id: 'a2', created_at: recentIso },
            { id: 'a3', created_at: oldIso }
        ]
        const result = aggregateDashboard({
            roster: [],
            opps: [],
            followups: [],
            activity,
            leaderboardResult: { rows: [] }
        })
        expect(result.activity.interactionsLast7d).toBe(2)
        expect(result.activity.recentFeed).toHaveLength(3) // all fit within the 8-entry cap
    })

    it('maps leaderboard rows to a clean shape (top 3 only)', () => {
        const rows = [
            { user_name: 'Alice', total_calls: 20, opportunities_won: 2 },
            { user_name: 'Bob', total_calls: 15, opportunities_won: 1 },
            { user_name: 'Carol', total_calls: 10, opportunities_won: 0 },
            { user_name: 'Dave', total_calls: 5, opportunities_won: 0 }
        ]
        const result = aggregateDashboard({
            roster: [],
            opps: [],
            followups: [],
            activity: [],
            leaderboardResult: { rows }
        })
        expect(result.leaderboard).toHaveLength(3)
        expect(result.leaderboard[0]).toMatchObject({ name: 'Alice', totalCalls: 20, opportunitiesWon: 2 })
    })

    it('picks top 5 longest-dormant customers sorted descending', () => {
        const roster = Array.from({ length: 7 }, (_, i) => ({
            account_id: `acc${i}`,
            customer_name: `Customer ${i}`,
            pouring_status: 'dormant',
            days_since_last_pour: i * 10 + 10 // 10, 20, 30, 40, 50, 60, 70
        }))
        const result = aggregateDashboard({
            roster,
            opps: [],
            followups: [],
            activity: [],
            leaderboardResult: { rows: [] }
        })
        expect(result.roster.longestDormant).toHaveLength(5)
        expect(result.roster.longestDormant[0].daysDormant).toBe(70)
        expect(result.roster.longestDormant[4].daysDormant).toBe(30)
    })
})

// ── Hook integration ───────────────────────────────────────────────────────────

describe('useCrmDashboard', () => {
    it('starts loading and resolves to aggregated data', async () => {
        CrmRosterService.fetchRoster.mockResolvedValue([
            {
                lifecycle_stage: 'customer',
                pouring_status: 'dormant',
                last_call_at: null,
                days_since_last_pour: 45,
                account_id: 'a1',
                customer_name: 'Acme'
            }
        ])
        CrmService.fetchOpportunities.mockResolvedValue([{ id: 'o1', stage: 'new', virtual: false }])

        const { result } = renderHook(() => useCrmDashboard())
        expect(result.current.isLoading).toBe(true)

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.error).toBeNull()
        expect(result.current.dashboard.roster.dormant).toBe(1)
        expect(result.current.dashboard.pipeline.realOpenTotal).toBe(1)
    })

    it('surfaces an error message when a fetch fails', async () => {
        CrmRosterService.fetchRoster.mockRejectedValue(new Error('Network timeout'))

        const { result } = renderHook(() => useCrmDashboard())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.error).toBe('Network timeout')
    })
})
