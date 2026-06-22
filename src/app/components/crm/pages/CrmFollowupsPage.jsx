/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import DateUtility from '../../../../utils/DateUtility'
import { useCrmViewMode } from '../../../hooks/useCrmViewMode'
import { useFollowups } from '../../../hooks/useFollowups'
import Badge from '../../common/Badge'
import { CrmTable } from '../CrmTable'
import { CrmViewToggle } from '../CrmViewToggle'

/** Tone map for follow-up status badges. */
const FOLLOWUP_STATUS_TONE = { done: 'success', open: 'neutral', snoozed: 'info' }

/**
 * Follow-ups page — shows the current user's follow-ups grouped into
 * Overdue / Today / Upcoming buckets. Each row has a "Done" button that
 * calls `complete` and triggers a reload.
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function CrmFollowupsPage({ accentColor }) {
    const { complete, error, followups, isLoading } = useFollowups({ mineOnly: true })
    const [viewMode, setViewMode] = useCrmViewMode('followups', 'list')

    const { overdue, today, upcoming } = useMemo(() => {
        const nowMs = Date.now()
        const todayStart = startOfDayMs(nowMs)
        const tomorrowStart = todayStart + 86_400_000

        const overdueList = []
        const todayList = []
        const upcomingList = []

        for (const f of followups) {
            if (!f.due_at) {
                upcomingList.push(f)
                continue
            }
            const dueMs = new Date(f.due_at).getTime()
            if (dueMs < todayStart) overdueList.push(f)
            else if (dueMs < tomorrowStart) todayList.push(f)
            else upcomingList.push(f)
        }

        return { overdue: overdueList, today: todayList, upcoming: upcomingList }
    }, [followups])

    const followupColumns = useMemo(
        () => [
            {
                key: 'title',
                label: 'Title',
                render: (row) => (
                    <span
                        className={`font-semibold ${row.status === 'done' ? 'line-through text-text-tertiary' : 'text-text-primary'}`}
                    >
                        {row.title}
                    </span>
                )
            },
            {
                key: 'account_name',
                label: 'Account',
                render: (row) => row.account_name || <span className="text-text-tertiary">—</span>
            },
            {
                align: 'right',
                key: 'due_at',
                label: 'Due',
                mono: true,
                render: (row) => {
                    if (!row.due_at) return <span className="text-text-tertiary">No date</span>
                    const nowMs = Date.now()
                    const todayStart = startOfDayMs(nowMs)
                    const tomorrowStart = todayStart + 86_400_000
                    const dueMs = new Date(row.due_at).getTime()
                    const isOverdue = dueMs < todayStart
                    const isDueToday = dueMs >= todayStart && dueMs < tomorrowStart
                    const label = DateUtility.formatDate(row.due_at) || formatDueDate(row.due_at)
                    return (
                        <span style={isOverdue ? { color: '#dc2626' } : isDueToday ? { color: '#d97706' } : undefined}>
                            {label}
                        </span>
                    )
                }
            },
            {
                key: 'status',
                label: 'Status',
                render: (row) => {
                    const tone = FOLLOWUP_STATUS_TONE[row.status] ?? 'neutral'
                    return (
                        <Badge tone={tone} size="xs">
                            {row.status || 'open'}
                        </Badge>
                    )
                }
            },
            {
                key: '_actions',
                label: '',
                render: (row) => {
                    if (row.status === 'done') {
                        return (
                            <span className="text-text-tertiary" aria-label="Done">
                                <i className="fas fa-check text-[11px]" aria-hidden="true" />
                            </span>
                        )
                    }
                    return (
                        <button type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                complete(row.id)
                            }}
                            className="rounded-md px-2 py-0.5 text-[11px] font-semibold border border-border-light bg-bg-secondary text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:text-text-primary hover:border-border-medium"
                        >
                            Done
                        </button>
                    )
                }
            }
        ],
        [complete]
    )

    if (error) {
        return (
            <div className="rounded-md p-3 text-[12px] bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.25)] text-text-primary">
                {error}
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <SkeletonGroup />
                <SkeletonGroup />
            </div>
        )
    }

    const allFollowups = [...overdue, ...today, ...upcoming]
    const hasAny = allFollowups.length > 0

    if (!hasAny) {
        return (
            <div className="rounded-md p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                No follow-ups scheduled &mdash; you&apos;re all caught up.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-end">
                <CrmViewToggle accentColor={accentColor} onChange={setViewMode} value={viewMode} />
            </div>

            {viewMode === 'list' ? (
                <CrmTable
                    columns={followupColumns}
                    emptyMessage="No follow-ups to show."
                    rowKey={(row) => row.id}
                    rows={allFollowups}
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {overdue.length > 0 && (
                        <FollowupGroup complete={complete} label="Overdue" items={overdue} tone="danger" />
                    )}
                    {today.length > 0 && (
                        <FollowupGroup complete={complete} label="Today" items={today} tone="warning" />
                    )}
                    {upcoming.length > 0 && (
                        <FollowupGroup complete={complete} label="Upcoming" items={upcoming} tone="neutral" />
                    )}
                </div>
            )}
        </div>
    )
}

function FollowupGroup({ complete, items, label, tone }) {
    const dotColor = tone === 'danger' ? '#ef4444' : tone === 'warning' ? '#f59e0b' : 'var(--text-tertiary)'
    return (
        <section className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-1">
                <span
                    className="h-2 w-2 rounded-sm flex-shrink-0"
                    style={{ background: dotColor }}
                    aria-hidden="true"
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary">{label}</span>
                <span className="text-[10px] text-text-tertiary tabular-nums">({items.length})</span>
            </div>
            <ul className="flex flex-col gap-1.5">
                {items.map((f) => (
                    <FollowupRow key={f.id} complete={complete} followup={f} />
                ))}
            </ul>
        </section>
    )
}

function FollowupRow({ complete, followup }) {
    return (
        <li className="flex items-start gap-3 rounded-md border border-border-light bg-bg-primary px-3 py-2.5">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[12.5px] font-semibold text-text-primary leading-snug">{followup.title}</span>
                <div className="flex items-center gap-2 flex-wrap">
                    {followup.account_name && (
                        <span className="text-[11.5px] text-text-secondary truncate">{followup.account_name}</span>
                    )}
                    {followup.due_at && (
                        <span className="text-[11px] text-text-tertiary shrink-0">
                            <i className="fas fa-clock text-[9px] mr-1" aria-hidden="true" />
                            {formatDueDate(followup.due_at)}
                        </span>
                    )}
                </div>
            </div>
            <button type="button"
                onClick={() => complete(followup.id)}
                title="Mark as done"
                className="shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-semibold border border-border-light bg-bg-secondary text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:text-text-primary hover:border-border-medium"
            >
                Done
            </button>
        </li>
    )
}

function SkeletonGroup() {
    return (
        <div className="flex flex-col gap-2" aria-hidden="true">
            <div className="h-3 w-16 rounded bg-bg-tertiary animate-pulse" />
            {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-md bg-bg-tertiary animate-pulse" />
            ))}
        </div>
    )
}

/** Returns the start-of-day timestamp (midnight local) for a given epoch ms. */
function startOfDayMs(ms) {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

/** Short human-readable due date label (e.g. "May 28" or "Today"). */
function formatDueDate(dateString) {
    try {
        const d = new Date(dateString)
        const todayStart = startOfDayMs(Date.now())
        const dayStart = startOfDayMs(d.getTime())
        if (dayStart === todayStart) return 'Today'
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    } catch {
        return ''
    }
}
