/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { CALL_OUTCOME_LABELS } from '../../../../utils/CrmRosterUtility'
import { useCrmViewMode } from '../../../hooks/useCrmViewMode'
import Badge from '../../common/Badge'
import { CrmTable } from '../CrmTable'
import { CrmViewToggle } from '../CrmViewToggle'
import { ActivityEmpty, ActivityListSkeleton } from './activity/ActivityAuxiliary'
import { ActivityGroupedList } from './activity/ActivityGroupedList'
import { ActivityMetrics } from './activity/ActivityMetrics'
import { ActivityOutcomeBreakdown } from './activity/ActivityOutcomeBreakdown'
import {
    computeActivityMetrics,
    formatRelativeShort,
    groupEntriesByDay,
    startOfDayMs,
    TIME_RANGE_OPTIONS
} from './activity/activityShared'
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

/** Tone map for role_lens badges — mirrors InteractionTimeline. */
const LENS_TONE = { dispatch: 'success', general: 'neutral', plant: 'warning', sales: 'info' }

const INTERACTION_TYPE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'call', label: 'Call' },
    { id: 'site_visit', label: 'Site visit' },
    { id: 'meeting', label: 'Meeting' },
    { id: 'email', label: 'Email' },
    { id: 'note', label: 'Note' }
]

/** Activity Feed — chronological log of every team call. Clicking an
 *  entry opens the matching customer's detail (same surface Outreach +
 *  Directory use) so dispatchers can pivot from "I see Bob called ACME
 *  yesterday" to "let me log my own follow-up" without leaving the
 *  tab. */
export function CrmActivityPage({
    accentColor,
    isLoading,
    onRefresh,
    onSelectCustomer,
    recentActivity,
    selectedCustomerForActivity
}) {
    const [query, setQuery] = useState('')
    const [outcomeFilter, setOutcomeFilter] = useState('all')
    const [interactionTypeFilter, setInteractionTypeFilter] = useState('all')
    const [timeRange, setTimeRange] = useState('all')
    const [viewMode, setViewMode] = useCrmViewMode('activity', 'list')

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
            if (interactionTypeFilter !== 'all' && entry.interaction_type !== interactionTypeFilter) return false
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
    }, [timeFiltered, query, outcomeFilter, interactionTypeFilter])

    const metrics = useMemo(() => computeActivityMetrics(timeFiltered), [timeFiltered])
    const groupedFiltered = useMemo(() => groupEntriesByDay(filtered), [filtered])

    const activityColumns = useMemo(
        () => [
            {
                key: 'interaction_type',
                label: 'Type',
                render: (row) => (
                    <span className="capitalize">
                        {row.interaction_type ? row.interaction_type.replace(/_/g, ' ') : '—'}
                    </span>
                )
            },
            {
                key: 'customer_name',
                label: 'Customer',
                render: (row) => row.customer_name || <span className="text-text-tertiary">—</span>
            },
            {
                key: 'created_by_name',
                label: 'By',
                render: (row) => row.created_by_name || <span className="text-text-tertiary">—</span>
            },
            {
                key: 'role_lens',
                label: 'Lens',
                render: (row) =>
                    row.role_lens ? (
                        <Badge tone={LENS_TONE[row.role_lens] ?? 'neutral'} size="xs">
                            {row.role_lens}
                        </Badge>
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
            },
            {
                key: 'outcome',
                label: 'Outcome',
                render: (row) =>
                    row.outcome ? (
                        CALL_OUTCOME_LABELS[row.outcome] || row.outcome
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
            },
            {
                align: 'right',
                key: 'when',
                label: 'When',
                mono: true,
                render: (row) => {
                    const ts = row.occurred_at || row.created_at
                    return ts ? formatRelativeShort(ts) : <span className="text-text-tertiary">—</span>
                }
            },
            {
                key: 'comment',
                label: 'Note',
                render: (row) =>
                    row.comment ? (
                        <span className="truncate block max-w-[200px]">{row.comment}</span>
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
            }
        ],
        []
    )

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

            <div className="flex items-center gap-2 flex-wrap">
                <InteractionTypeFilterRow
                    accentColor={accentColor}
                    activeFilter={interactionTypeFilter}
                    onSelect={setInteractionTypeFilter}
                />
                <CrmViewToggle accentColor={accentColor} onChange={setViewMode} value={viewMode} />
            </div>

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
                <ActivityEmpty
                    hasFilters={hasOutcomeFilter || interactionTypeFilter !== 'all' || !!query.trim()}
                    totalLoaded={recentActivity.length}
                />
            ) : viewMode === 'list' ? (
                <CrmTable
                    columns={activityColumns}
                    emptyMessage="No activity matches the current filters."
                    onRowClick={(row) => {
                        const target = row.account_id || row.customer_num
                        if (target) onSelectCustomer?.(target)
                    }}
                    rowKey={(row) => row.id}
                    rows={filtered}
                />
            ) : (
                <ActivityGroupedList groups={groupedFiltered} onSelectCustomer={onSelectCustomer} />
            )}
        </div>
    )
}

/** Chip row for filtering the activity feed by interaction type.
 *  Active chip uses the accent color background tint matching the
 *  composer chip pattern. */
function InteractionTypeFilterRow({ accentColor, activeFilter, onSelect }) {
    return (
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by interaction type">
            {INTERACTION_TYPE_FILTERS.map(({ id, label }) => {
                const isActive = activeFilter === id
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold border transition-[colors,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none ${
                            isActive
                                ? 'text-text-primary'
                                : 'border-border-light text-text-secondary hover:text-text-primary'
                        }`}
                        style={isActive ? { background: `${accentColor}1f`, borderColor: accentColor } : undefined}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
