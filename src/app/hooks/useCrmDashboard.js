import { useCallback, useEffect, useRef, useState } from 'react'

import CrmRosterService from '../../services/CrmRosterService'
import CrmService from '../../services/CrmService'
import { useMyDesk } from './useMyDesk'

const STALE_CALL_DAYS = 30

const EMPTY_DASHBOARD = {
    roster: {
        total: 0,
        customers: 0,
        prospects: 0,
        dormant: 0,
        neverCalledOrStale: 0,
        longestDormant: []
    },
    pipeline: {
        realOpenTotal: 0,
        virtualTotal: 0,
        byStage: { new: 0, contacted: 0, quoted: 0 }
    },
    teamFollowups: {
        overdue: [],
        dueToday: [],
        upcoming: []
    },
    activity: {
        interactionsLast7d: 0,
        recentFeed: []
    },
    leaderboard: []
}

/**
 * Aggregates team/region CRM data for the Overview dashboard.
 * Fetches roster, opportunities, follow-ups, recent activity, and the
 * leaderboard in parallel and derives the KPI metrics client-side.
 *
 * @returns {{ dashboard: typeof EMPTY_DASHBOARD, desk: object, isLoading: boolean, error: string|null }}
 */
export function useCrmDashboard() {
    const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const mounted = useRef(true)

    const { desk, isLoading: isDeskLoading } = useMyDesk()

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    const load = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const [roster, opps, followups, activity, leaderboardResult] = await Promise.all([
                CrmRosterService.fetchRoster({ includeActive: true }),
                CrmService.fetchOpportunities({ openOnly: true }),
                CrmService.fetchFollowups({}),
                CrmRosterService.fetchRecentActivity(200),
                CrmRosterService.fetchLeaderboard({ daysWindow: 7 })
            ])

            if (!mounted.current) return

            setDashboard(aggregateDashboard({ roster, opps, followups, activity, leaderboardResult }))
        } catch (err) {
            if (mounted.current) setError(err?.message || 'Failed to load overview data')
        } finally {
            if (mounted.current) setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    return { dashboard, desk, error, isDeskLoading, isLoading, reload: load }
}

/**
 * Pure aggregation — derives all KPI metrics from the raw API payloads.
 * Kept outside the hook so it is easily unit-tested without React.
 *
 * @param {{ roster: Array, opps: Array, followups: Array, activity: Array, leaderboardResult: object }}
 */
export function aggregateDashboard({ roster, opps, followups, activity, leaderboardResult }) {
    // --- Roster KPIs ---
    const totalAccounts = roster.length
    const customers = roster.filter((r) => r.lifecycle_stage === 'customer').length
    const prospects = roster.filter((r) => r.lifecycle_stage === 'prospect').length
    const dormant = roster.filter((r) => r.pouring_status === 'dormant').length

    const staleThresholdMs = STALE_CALL_DAYS * 24 * 60 * 60 * 1000
    const now = Date.now()
    const neverCalledOrStale = roster.filter((r) => {
        if (!r.last_call_at) return true
        return now - new Date(r.last_call_at).getTime() > staleThresholdMs
    }).length

    // Top 5 longest dormant — sort descending by days_since_last_pour
    const longestDormant = roster
        .filter((r) => r.pouring_status === 'dormant' && (r.days_since_last_pour ?? 0) > 0)
        .sort((a, b) => (b.days_since_last_pour ?? 0) - (a.days_since_last_pour ?? 0))
        .slice(0, 5)
        .map((r) => ({
            accountId: r.account_id ?? r.id,
            name: r.customer_name ?? r.name ?? 'Unknown',
            daysDormant: r.days_since_last_pour ?? 0
        }))

    // --- Pipeline KPIs ---
    const realOpps = opps.filter((o) => !o.virtual)
    const virtualOpps = opps.filter((o) => o.virtual)
    const byStage = realOpps.reduce(
        (acc, o) => {
            const stage = o.stage ?? 'new'
            if (stage in acc) acc[stage] += 1
            return acc
        },
        { new: 0, contacted: 0, quoted: 0 }
    )

    // --- Follow-ups ---
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const overdue = []
    const dueToday = []
    const upcoming = []

    for (const f of followups) {
        if (!f.due_at) {
            upcoming.push(f)
            continue
        }
        const dueMs = new Date(f.due_at).getTime()
        if (dueMs < todayStart.getTime()) overdue.push(f)
        else if (dueMs <= todayEnd.getTime()) dueToday.push(f)
        else upcoming.push(f)
    }

    // --- Activity ---
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000
    const interactionsLast7d = activity.filter(
        (a) => a.created_at && new Date(a.created_at).getTime() >= sevenDaysAgoMs
    ).length
    const recentFeed = activity.slice(0, 8)

    // --- Leaderboard ---
    const leaderboard = (leaderboardResult?.rows ?? []).slice(0, 3).map((row) => ({
        name: row.user_name ?? row.name ?? 'Unknown',
        totalCalls: row.total_calls ?? row.call_count ?? 0,
        opportunitiesWon: row.opportunities_won ?? 0
    }))

    return {
        activity: { interactionsLast7d, recentFeed },
        leaderboard,
        pipeline: {
            byStage,
            realOpenTotal: realOpps.length,
            virtualTotal: virtualOpps.length
        },
        roster: { customers, dormant, longestDormant, neverCalledOrStale, prospects, total: totalAccounts },
        teamFollowups: { dueToday, overdue, upcoming }
    }
}
