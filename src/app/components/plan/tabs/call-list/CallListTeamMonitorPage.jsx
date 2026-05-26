/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo } from 'react'

import { CALL_OUTCOME_COLORS, CALL_OUTCOME_LABELS, formatRelativeDays } from '../../../../../utils/CallListUtility'
import { fmtInt, fmtScorePct } from '../../../../../utils/PlanStatisticsFormatUtility'

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

/** Per-user activity rollup. Backs the Call List → Team Monitor side
 *  menu — a management oversight tool, not a competition board. Managers
 *  see who's actually working the outreach queue, who's closing the most
 *  pours, and who hasn't logged a call recently. Booking rate is the
 *  leading indicator: total calls measures effort, bookings measures
 *  impact. Gated to role weight ≥ 31 upstream in `CallListView`. */
export function CallListTeamMonitorPage({ daysWindow = 30, isLoading, monitor, onChangeWindow, onRefresh }) {
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
        let customers = new Set()
        for (const row of sortedCallers) {
            calls += row.total_calls || 0
            booked += row.booked || 0
            willBookAgain += row.will_book_again || 0
            // unique_customers from RPC is per-user; we don't have the raw
            // set to dedupe across users here. Sum is an upper bound — fine
            // for the team-wide summary line.
            customers.add(row.created_by)
        }
        return { booked, callerCount: customers.size, calls, willBookAgain }
    }, [sortedCallers])

    return (
        <div className="flex flex-col gap-3 min-w-0">
            <WindowSelector activeDays={daysWindow} isLoading={isLoading} onSelect={onChangeWindow} />
            <SummaryStrip
                bookingRate={totals.calls > 0 ? totals.booked / totals.calls : 0}
                callerCount={totals.callerCount}
                isLoading={isLoading && sortedCallers.length === 0}
                totalBooked={totals.booked}
                totalCalls={totals.calls}
                totalWillBookAgain={totals.willBookAgain}
            />
            {isLoading && sortedCallers.length === 0 ? (
                <TeamMonitorSkeleton />
            ) : sortedCallers.length === 0 ? (
                <div className="rounded-lg p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                    No call activity in this window yet. Once the team starts logging calls each caller&apos;s summary
                    will appear here.
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sortedCallers.map((row) => (
                        <CallerActivityCard key={row.created_by} row={row} />
                    ))}
                </ul>
            )}
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
                        <button
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

function SummaryStrip({ bookingRate, callerCount, isLoading, totalBooked, totalCalls, totalWillBookAgain }) {
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light grid grid-cols-2 sm:grid-cols-4 gap-5">
            <SummaryStat
                label="Total calls"
                value={isLoading ? '—' : fmtInt(totalCalls)}
                sub={`by ${fmtInt(callerCount)} caller${callerCount === 1 ? '' : 's'}`}
            />
            <SummaryStat
                label="Booked"
                sub={`${fmtScorePct(bookingRate)} booking rate`}
                value={isLoading ? '—' : fmtInt(totalBooked)}
            />
            <SummaryStat
                label="Will book again"
                value={isLoading ? '—' : fmtInt(totalWillBookAgain)}
                sub="Warm follow-ups queued"
            />
            <SummaryStat
                label="Effort"
                value={isLoading ? '—' : `${fmtInt(Math.round(totalCalls / Math.max(callerCount, 1)))}`}
                sub="avg calls per caller"
            />
        </div>
    )
}

function SummaryStat({ label, sub, value }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-[11px] text-text-tertiary">{label}</div>
            <div className="text-[20px] font-semibold tabular-nums leading-tight text-text-primary">{value}</div>
            {sub && <div className="text-[10.5px] text-text-tertiary">{sub}</div>}
        </div>
    )
}

/** Single caller's activity summary. Renders the same data set the
 *  prior leaderboard row did but without the rank chip / gold styling —
 *  this is a management dashboard, not a scoreboard. The card highlights
 *  whether a caller has been silent recently (>14 days since last call)
 *  so managers can spot drop-off at a glance. */
function CallerActivityCard({ row }) {
    const bookingRate = row.total_calls > 0 ? (row.booked || 0) / row.total_calls : 0
    const productiveRate = row.total_calls > 0 ? ((row.booked || 0) + (row.will_book_again || 0)) / row.total_calls : 0
    const lastCallDaysAgo = row.last_call_at
        ? Math.floor((Date.now() - new Date(row.last_call_at).getTime()) / 86_400_000)
        : null
    const isStale = lastCallDaysAgo != null && lastCallDaysAgo >= 14
    return (
        <li className="rounded-md p-3 bg-bg-primary border border-border-light flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 min-w-0">
                <span className="text-[13.5px] font-semibold text-text-primary truncate min-w-0" title={row.user_name}>
                    {row.user_name}
                </span>
                <div className="text-[20px] font-semibold tabular-nums leading-none shrink-0 text-text-primary">
                    {fmtInt(row.total_calls)}
                </div>
            </div>

            <OutcomeMixBar row={row} />

            <div className="grid grid-cols-3 gap-2 text-[11px]">
                <MiniStat label="Booked" value={fmtInt(row.booked || 0)} sub={fmtScorePct(bookingRate)} />
                <MiniStat
                    label="Will book again"
                    value={fmtInt(row.will_book_again || 0)}
                    sub={fmtScorePct(productiveRate)}
                />
                <MiniStat label="Customers" value={fmtInt(row.unique_customers || 0)} sub="unique" />
            </div>

            <div className="flex items-center justify-between gap-2 text-[10.5px] text-text-tertiary tabular-nums">
                <span>
                    No answer: <span className="text-text-secondary">{fmtInt(row.no_answer || 0)}</span>
                    <span className="mx-1.5">·</span>
                    Not interested: <span className="text-text-secondary">{fmtInt(row.not_interested || 0)}</span>
                </span>
                <span
                    title={isStale ? 'No calls logged in the last 2 weeks — follow up with this caller' : undefined}
                    style={{ color: 'var(--text-tertiary)', fontWeight: isStale ? 600 : 400 }}
                >
                    {row.last_call_at ? `Last call ${formatRelativeDays(row.last_call_at)}` : 'No calls yet'}
                </span>
            </div>
        </li>
    )
}

function MiniStat({ label, sub, value }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</div>
            <div className="text-[15px] font-semibold tabular-nums leading-none text-text-primary">{value}</div>
            {sub && <div className="text-[10px] text-text-tertiary tabular-nums">{sub}</div>}
        </div>
    )
}

/** Stacked horizontal bar showing the outcome mix for the user. */
function OutcomeMixBar({ row }) {
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

function TeamMonitorSkeleton() {
    const SkelBar = ({ className = '', style }) => (
        <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
    )
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-md p-3 bg-bg-primary border border-border-light flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <SkelBar className="h-3.5 w-2/3" />
                            <SkelBar className="h-2.5 w-1/3" />
                        </div>
                        <SkelBar className="h-5 w-10" />
                    </div>
                    <SkelBar className="h-1.5 w-full" />
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 3 }).map((__, j) => (
                            <div key={j} className="flex flex-col gap-1">
                                <SkelBar className="h-2 w-12" />
                                <SkelBar className="h-4 w-10" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
