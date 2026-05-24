import React, { useMemo, useState } from 'react'

import { ActivityEmpty, ActivityListSkeleton } from './activity/ActivityAuxiliary'
import { ActivityGroupedList } from './activity/ActivityGroupedList'
import { ActivityMetrics } from './activity/ActivityMetrics'
import { ActivityOutcomeBreakdown } from './activity/ActivityOutcomeBreakdown'
import { computeActivityMetrics, groupEntriesByDay, startOfDayMs, TIME_RANGE_OPTIONS } from './activity/activityShared'
import { ActivityToolbar } from './activity/ActivityToolbar'

/* ─── Activity feed — metrics + grouped timeline ──────────────────
 *
 * Rebuilt around three layers: a KPI strip (calls today / this week,
 * booked rate, unique customers, top caller), a stacked outcome bar
 * showing the mix at a glance, and a date-grouped timeline of every
 * entry. Clicking a row jumps into the matching customer's detail
 * surface — same pivot the old design supported, just framed with
 * context above so the team can see WHO is making progress and WHAT
 * outcomes are landing.
 */

/** Activity Feed — chronological log of every team call. Clicking an
 *  entry opens the matching customer's detail (same surface Outreach +
 *  Directory use) so dispatchers can pivot from "I see Bob called ACME
 *  yesterday" to "let me log my own follow-up" without leaving the
 *  tab. */
export function CallListActivityPage({
    accentColor,
    isLoading,
    onRefresh,
    onSelectCustomer,
    recentActivity,
    selectedCustomerForActivity
}) {
    const [query, setQuery] = useState('')
    const [outcomeFilter, setOutcomeFilter] = useState('all')
    const [timeRange, setTimeRange] = useState('all')

    const timeFiltered = useMemo(() => {
        const cfg = TIME_RANGE_OPTIONS.find((o) => o.key === timeRange)
        if (!cfg?.days) return recentActivity
        const cutoff = startOfDayMs(new Date()) - (cfg.days - 1) * 86400000
        return recentActivity.filter((entry) => {
            const ts = Date.parse(entry.created_at)
            return Number.isFinite(ts) && ts >= cutoff
        })
    }, [recentActivity, timeRange])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return timeFiltered.filter((entry) => {
            if (outcomeFilter !== 'all' && entry.outcome !== outcomeFilter) return false
            if (!q) return true
            const haystack = [
                entry.customer_name,
                entry.customer_num,
                entry.contact_name,
                entry.comment,
                entry.created_by_name
            ]
                .filter(Boolean)
                .map((v) => String(v).toLowerCase())
                .join(' | ')
            return haystack.includes(q)
        })
    }, [timeFiltered, query, outcomeFilter])

    const metrics = useMemo(() => computeActivityMetrics(timeFiltered), [timeFiltered])
    const groupedFiltered = useMemo(() => groupEntriesByDay(filtered), [filtered])

    if (selectedCustomerForActivity) {
        return selectedCustomerForActivity
    }

    const showSkeleton = isLoading && recentActivity.length === 0
    const showEmpty = !showSkeleton && filtered.length === 0
    const hasOutcomeFilter = outcomeFilter !== 'all'

    return (
        <div className="flex flex-col gap-3 min-w-0">
            <ActivityMetrics
                accentColor={accentColor}
                isLoading={showSkeleton}
                metrics={metrics}
                rangeLabel={TIME_RANGE_OPTIONS.find((o) => o.key === timeRange)?.label || 'All'}
            />

            <ActivityOutcomeBreakdown
                isLoading={showSkeleton}
                metrics={metrics}
                onSelectOutcome={(key) => setOutcomeFilter((cur) => (cur === key ? 'all' : key))}
                selectedOutcome={outcomeFilter}
            />

            <ActivityToolbar
                hasOutcomeFilter={hasOutcomeFilter}
                isLoading={showSkeleton}
                onClearOutcome={() => setOutcomeFilter('all')}
                onQueryChange={setQuery}
                onRefresh={onRefresh}
                onTimeRangeChange={setTimeRange}
                outcomeFilter={outcomeFilter}
                query={query}
                shown={filtered.length}
                timeRange={timeRange}
                total={recentActivity.length}
            />

            {showSkeleton ? (
                <ActivityListSkeleton />
            ) : showEmpty ? (
                <ActivityEmpty hasFilters={hasOutcomeFilter || !!query.trim()} totalLoaded={recentActivity.length} />
            ) : (
                <ActivityGroupedList groups={groupedFiltered} onSelectCustomer={onSelectCustomer} />
            )}
        </div>
    )
}
