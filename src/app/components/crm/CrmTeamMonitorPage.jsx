/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo } from 'react'

import { CALL_OUTCOME_COLORS, CALL_OUTCOME_LABELS, formatRelativeDays } from '../../../utils/CrmRosterUtility'
import { fmtInt, fmtScorePct } from '../../../utils/PlanStatisticsFormatUtility'
import { Stat } from '../ui/Panel'
import { CrmPanel as Panel, CrmStatGroup as StatGroup } from './CrmSection'
import { CrmTable } from './CrmTable'

/* Time-range catalog. Mirrors the Activity feed's selector so both
 * surfaces read the same. `days` is what the backend's leaderboard RPC
 * uses to compute the trailing window. "All" passes a large sentinel
 * so the RPC effectively scans every recorded call. */
const WINDOW_OPTIONS = [
    { days: 1, label: 'Today' },
    { days: 7, label: 'This week' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: 'Year' },
    { days: 36500, label: 'All' }
]

/** Table columns for the leaderboard — mirrors Schedule-style table layout. */
const LEADERBOARD_COLUMNS = [
    {
        key: 'user_name',
        label: 'User',
        render: (row) => (
            <span className="font-semibold text-text-primary truncate" title={row.user_name}>
                {row.user_name}
            </span>
        )
    },
    { align: 'right', key: 'total_calls', label: 'Calls', mono: true },
    { align: 'right', key: 'booked', label: 'Booked', mono: true },
    {
        align: 'right',
        key: 'booking_rate',
        label: 'Book %',
        mono: true,
        render: (row) => (row.total_calls > 0 ? fmtScorePct((row.booked || 0) / row.total_calls) : '—')
    },
    { align: 'right', key: 'will_book_again', label: 'Will book again', mono: true },
    { align: 'right', key: 'no_answer', label: 'No answer', mono: true },
    {
        align: 'right',
        key: 'unique_customers',
        label: 'Unique customers',
        mono: true,
        render: (row) => fmtInt(row.unique_customers || 0)
    },
    {
        align: 'right',
        key: 'opportunities_won',
        label: 'Opps won',
        mono: true,
        render: (row) => fmtInt(row.opportunities_won ?? 0)
    },
    {
        align: 'right',
        key: 'last_call_at',
        label: 'Last call',
        render: (row) => {
            if (!row.last_call_at) return <span className="text-text-tertiary">—</span>
            const daysAgo = Math.floor((Date.now() - new Date(row.last_call_at).getTime()) / 86_400_000)
            const isStale = daysAgo >= 14
            return (
                <span
                    className="tabular-nums"
                    style={{
                        color: isStale ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        fontWeight: isStale ? 600 : 400
                    }}
                    title={isStale ? 'No calls logged in the last 2 weeks' : undefined}
                >
                    {formatRelativeDays(row.last_call_at)}
                </span>
            )
        }
    }
]

/** Per-user activity rollup. Backs the Call List → Team Monitor side
 *  menu — a management oversight tool, not a competition board. Managers
 *  see who's actually working the outreach queue, who's closing the most
 *  pours, and who hasn't logged a call recently. Booking rate is the
 *  leading indicator: total calls measures effort, bookings measures
 *  impact. Gated to crm.manage upstream in `CrmView`. */
export function CrmTeamMonitorPage({ daysWindow = 30, isLoading, monitor, onChangeWindow, onRefresh }) {
    useEffect(() => {
        if (onRefresh) onRefresh({ daysWindow })
        // Reload whenever the trailing window changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [daysWindow])

    const sortedCallers = useMemo(() => {
        const rows = monitor?.rows || []
        return [...rows].sort((a, b) => {
            if (b.total_calls !== a.total_calls) return b.total_calls - a.total_calls
            return (b.last_call_at || '').localeCompare(a.last_call_at || '')
        })
    }, [monitor])

    const totals = useMemo(() => {
        let calls = 0
        let booked = 0
        let willBookAgain = 0
        const callerIds = new Set()
        for (const row of sortedCallers) {
            calls += row.total_calls || 0
            booked += row.booked || 0
            willBookAgain += row.will_book_again || 0
            callerIds.add(row.created_by)
        }
        return { booked, callerCount: callerIds.size, calls, willBookAgain }
    }, [sortedCallers])

    const bookingRate = totals.calls > 0 ? totals.booked / totals.calls : 0

    return (
        <div className="flex flex-col gap-4 min-w-0 animate-fade-in-up">
            <WindowSelector activeDays={daysWindow} isLoading={isLoading} onSelect={onChangeWindow} />

            {/* Summary KPI strip — matches the overview's StatGroup */}
            <StatGroup columns={4}>
                <Stat label="Total calls" value={isLoading ? '—' : fmtInt(totals.calls)} />
                <Stat label="Booked" value={isLoading ? '—' : fmtInt(totals.booked)} />
                <Stat label="Will book again" value={isLoading ? '—' : fmtInt(totals.willBookAgain)} />
                <Stat
                    label="Avg calls/caller"
                    value={isLoading ? '—' : fmtInt(Math.round(totals.calls / Math.max(totals.callerCount, 1)))}
                />
            </StatGroup>

            {/* Leaderboard table */}
            <Panel title="Caller breakdown">
                {isLoading && sortedCallers.length === 0 ? (
                    <TeamMonitorSkeleton />
                ) : (
                    <CrmTable
                        columns={LEADERBOARD_COLUMNS}
                        emptyMessage="No call activity in this window yet. Once the team starts logging calls each caller's summary will appear here."
                        maxHeight="calc(100dvh - 340px)"
                        rowKey={(row) => row.created_by}
                        rows={sortedCallers}
                    />
                )}
            </Panel>
        </div>
    )
}

function WindowSelector({ activeDays, isLoading, onSelect }) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-tertiary mr-1">
                Time frame
            </span>
            <div className="inline-flex rounded-md overflow-hidden border border-border-light">
                {WINDOW_OPTIONS.map(({ days, label }) => {
                    const active = activeDays === days
                    return (
                        <button type="button"
                            key={days}
                            type="button"
                            onClick={() => onSelect && onSelect(days)}
                            disabled={isLoading}
                            className="text-[11.5px] font-semibold px-2.5 py-1.5 border-none cursor-pointer disabled:opacity-60 active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                            style={{
                                background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function TeamMonitorSkeleton() {
    const SkelBar = ({ className = '' }) => (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)' }} />
    )
    return (
        <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-1">
                    <SkelBar className="h-3 flex-1" />
                    <SkelBar className="h-3 w-12" />
                    <SkelBar className="h-3 w-10" />
                    <SkelBar className="h-3 w-10" />
                    <SkelBar className="h-3 w-12" />
                </div>
            ))}
        </div>
    )
}

/** Stacked horizontal bar showing the outcome mix for a user (kept for future use). */
export function OutcomeMixBar({ row }) {
    const total = row.total_calls || 0
    if (total === 0) return null
    const segments = [
        { count: row.booked || 0, key: 'booked' },
        { count: row.will_book_again || 0, key: 'will_book_again' },
        { count: row.note || 0, key: 'note' },
        { count: row.no_answer || 0, key: 'no_answer' },
        { count: row.not_interested || 0, key: 'not_interested' }
    ].filter((s) => s.count > 0)
    return (
        <div
            className="rounded-sm h-1.5 overflow-hidden flex bg-bg-tertiary"
            title={segments.map((s) => `${CALL_OUTCOME_LABELS[s.key] || s.key}: ${s.count}`).join(' · ')}
        >
            {segments.map((s) => (
                <div
                    key={s.key}
                    style={{
                        background: CALL_OUTCOME_COLORS[s.key] || '#64748b',
                        width: `${(s.count / total) * 100}%`
                    }}
                />
            ))}
        </div>
    )
}
