/* eslint-disable react/forbid-dom-props */
import React from 'react'

import DateUtility from '../../../../utils/DateUtility'
import Badge from '../../common/Badge'
import { CrmPanel as Panel } from '../CrmSection'

/**
 * CRM Overview — team/region command surface. Built on the same flat,
 * dense, mono-numeral primitives as DashboardView (StatGroup KPI strip +
 * Panel sections) so it reads as part of the site, not a foreign screen.
 * Leads with team-wide signal; the signed-in user's personal queue is a
 * subordinate footer that stays useful even when nothing is assigned.
 */

const AMBER = '#f59e0b'
const RED = '#ef4444'

const TYPE_ICON = {
    call: 'fa-phone',
    email: 'fa-envelope',
    meeting: 'fa-handshake',
    note: 'fa-note-sticky',
    site_visit: 'fa-location-dot',
    text: 'fa-message'
}

/** Short relative-time label ("3d", "2h", "now") from an ISO timestamp. */
function relTime(iso) {
    if (!iso) return ''
    const diffMs = Date.now() - new Date(iso).getTime()
    if (Number.isNaN(diffMs)) return ''
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return days < 30 ? `${days}d` : DateUtility.formatDate(iso)
}

/** Threshold color for a dormancy span — longer = more urgent. */
function dormancyColor(days) {
    if (days >= 180) return RED
    if (days >= 90) return AMBER
    return null
}

/** Flat label/value/meta row — mirrors the DashboardAtAGlance row. */
function Row({ children, label, meta, value }) {
    return (
        <div className="flex items-baseline gap-2 py-1.5 px-1 -mx-1 rounded border-b border-border-light last:border-b-0 transition-colors duration-150 hover:bg-bg-hover">
            <span
                className="text-[12px] text-text-secondary truncate min-w-0 flex-1"
                title={typeof label === 'string' ? label : undefined}
            >
                {label}
            </span>
            {children}
            {meta != null && <span className="text-[11px] text-text-tertiary tabular-nums shrink-0">{meta}</span>}
            {value != null && (
                <span className="text-[13px] font-semibold font-mono tabular-nums shrink-0 text-text-primary">
                    {value}
                </span>
            )}
        </div>
    )
}

/** Thin allocation-style bar — matches the dashboard's fleet bars. */
function MiniBar({ color, pct }) {
    return (
        <span className="h-1.5 w-14 rounded-full bg-bg-tertiary overflow-hidden shrink-0" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ background: color, width: `${Math.max(6, pct)}%` }} />
        </span>
    )
}

function SkeletonRows({ count = 3 }) {
    return (
        <div className="flex flex-col gap-2" aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="h-3.5 rounded-md bg-bg-tertiary animate-pulse motion-reduce:animate-none"
                    style={{ width: `${88 - i * 12}%` }}
                />
            ))}
        </div>
    )
}

function EmptyHint({ children }) {
    return <p className="text-[12px] text-text-tertiary py-1">{children}</p>
}

export function CrmMyDeskPage({ accentColor, dashboard, desk, error, isDeskLoading, isLoading }) {
    if (error) {
        return (
            <div className="rounded-md p-3 text-[12px] bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.25)] text-text-primary">
                {error}
            </div>
        )
    }

    const { activity, leaderboard, pipeline, roster, teamFollowups } = dashboard

    return (
        <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PipelinePanel accentColor={accentColor} isLoading={isLoading} pipeline={pipeline} />
                <OutreachPanel accentColor={accentColor} isLoading={isLoading} roster={roster} />
            </div>

            <FollowupsPanel isLoading={isLoading} teamFollowups={teamFollowups} />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
                <ActivityPanel accentColor={accentColor} activity={activity} isLoading={isLoading} />
                <CallersPanel accentColor={accentColor} isLoading={isLoading} leaderboard={leaderboard} />
            </div>

            <PersonalSection desk={desk} isLoading={isDeskLoading} />
        </div>
    )
}

// ─── PIPELINE ────────────────────────────────────────────────────────────────

function PipelinePanel({ accentColor, isLoading, pipeline }) {
    const total = pipeline.realOpenTotal
    const stages = [
        { count: pipeline.byStage.new, id: 'new', label: 'New', op: 1 },
        { count: pipeline.byStage.contacted, id: 'contacted', label: 'Contacted', op: 0.62 },
        { count: pipeline.byStage.quoted, id: 'quoted', label: 'Quoted', op: 0.34 }
    ]
    return (
        <Panel
            title="Pipeline"
            right={
                !isLoading && total > 0 ? (
                    <span className="text-[12px] text-text-tertiary">
                        <span className="font-mono font-semibold text-text-primary tabular-nums">{total}</span> open
                    </span>
                ) : null
            }
        >
            {isLoading ? (
                <SkeletonRows count={3} />
            ) : total === 0 && pipeline.virtualTotal === 0 ? (
                <EmptyHint>No open opportunities yet — work the outreach queue to build the pipeline.</EmptyHint>
            ) : (
                <div className="flex flex-col gap-2.5">
                    <div className="h-2 rounded-full overflow-hidden flex bg-bg-tertiary">
                        {total > 0 &&
                            stages.map((s) =>
                                s.count > 0 ? (
                                    <div
                                        key={s.id}
                                        className="h-full"
                                        style={{
                                            background: accentColor,
                                            opacity: s.op,
                                            width: `${(s.count / total) * 100}%`
                                        }}
                                        title={`${s.label}: ${s.count}`}
                                    />
                                ) : null
                            )}
                    </div>
                    <div>
                        {stages.map((s) => (
                            <Row
                                key={s.id}
                                label={
                                    <span className="flex items-center gap-2">
                                        <span
                                            className="h-2 w-2 rounded-sm"
                                            style={{ background: accentColor, opacity: s.op }}
                                            aria-hidden="true"
                                        />
                                        {s.label}
                                    </span>
                                }
                                value={s.count}
                            />
                        ))}
                    </div>
                    {pipeline.virtualTotal > 0 && (
                        <p className="text-[11px] text-text-tertiary pt-1">
                            <i
                                className="fas fa-wand-magic-sparkles text-[10px] mr-1.5 text-amber-500"
                                aria-hidden="true"
                            />
                            <span className="font-mono font-semibold tabular-nums text-text-secondary">
                                {pipeline.virtualTotal}
                            </span>{' '}
                            suggested — review on the Pipeline tab
                        </p>
                    )}
                </div>
            )}
        </Panel>
    )
}

// ─── OUTREACH ────────────────────────────────────────────────────────────────

function OutreachPanel({ accentColor, isLoading, roster }) {
    const list = roster.longestDormant
    const maxDays = list.reduce((m, r) => Math.max(m, r.daysDormant), 1)
    return (
        <Panel
            title="Outreach focus"
            right={
                !isLoading && roster.dormant > 0 ? (
                    <Badge tone="warning" size="xs">
                        {roster.dormant} dormant
                    </Badge>
                ) : null
            }
        >
            {isLoading ? (
                <SkeletonRows count={4} />
            ) : list.length === 0 ? (
                <EmptyHint>Outreach is current — no dormant customers waiting on a call.</EmptyHint>
            ) : (
                <div>
                    {list.map((r) => {
                        const color = dormancyColor(r.daysDormant)
                        return (
                            <Row key={r.accountId} label={r.name} value={`${r.daysDormant}d`}>
                                <MiniBar color={color || accentColor} pct={(r.daysDormant / maxDays) * 100} />
                            </Row>
                        )
                    })}
                </div>
            )}
        </Panel>
    )
}

// ─── TEAM FOLLOW-UPS ─────────────────────────────────────────────────────────

function FollowupsPanel({ isLoading, teamFollowups }) {
    const { dueToday, overdue } = teamFollowups
    const clear = !isLoading && overdue.length === 0 && dueToday.length === 0
    return (
        <Panel title="Team follow-ups">
            {isLoading ? (
                <SkeletonRows count={3} />
            ) : clear ? (
                <EmptyHint>The team is caught up — nothing overdue or due today.</EmptyHint>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    <FollowupColumn followups={overdue} label="Overdue" tone={RED} />
                    <FollowupColumn followups={dueToday} label="Due today" tone={AMBER} />
                </div>
            )}
        </Panel>
    )
}

function FollowupColumn({ followups, label, tone }) {
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5 pb-1.5">
                <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: tone }} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
                <span className="text-[12px] font-semibold font-mono tabular-nums text-text-primary">
                    {followups.length}
                </span>
            </div>
            {followups.length === 0 ? (
                <p className="text-[11px] text-text-tertiary pl-3.5 pb-1">None</p>
            ) : (
                followups.slice(0, 5).map((f) => (
                    <div key={f.id} className="pl-3.5 py-1 border-b border-border-light last:border-b-0">
                        <div className="text-[12px] text-text-primary truncate" title={f.title}>
                            {f.title}
                        </div>
                        <div className="text-[10.5px] text-text-tertiary truncate">
                            {f.assigned_to_name || f.assignee_name || 'Unassigned'}
                            {f.due_at ? ` · ${DateUtility.formatDate(f.due_at)}` : ''}
                        </div>
                    </div>
                ))
            )}
            {followups.length > 5 && (
                <p className="text-[10.5px] text-text-tertiary pl-3.5 pt-1">+{followups.length - 5} more</p>
            )}
        </div>
    )
}

// ─── TEAM ACTIVITY ───────────────────────────────────────────────────────────

function ActivityPanel({ accentColor, activity, isLoading }) {
    const feed = activity.recentFeed
    return (
        <Panel
            title="Team activity"
            right={
                !isLoading ? (
                    <span className="text-[11px] text-text-tertiary tabular-nums">
                        {activity.interactionsLast7d} this week
                    </span>
                ) : null
            }
        >
            {isLoading ? (
                <SkeletonRows count={5} />
            ) : feed.length === 0 ? (
                <EmptyHint>No team activity logged yet.</EmptyHint>
            ) : (
                <div>
                    {feed.map((e, i) => (
                        <div
                            key={e.id ?? i}
                            className="flex items-baseline gap-2 py-1.5 border-b border-border-light last:border-b-0"
                        >
                            <i
                                className={`fas ${TYPE_ICON[e.interaction_type] || 'fa-note-sticky'} text-[10px] w-3.5 text-center shrink-0`}
                                style={{ color: accentColor }}
                                aria-hidden="true"
                            />
                            <span className="text-[12px] min-w-0 flex-1 truncate">
                                <span className="font-semibold text-text-primary">
                                    {e.created_by_name || 'Someone'}
                                </span>
                                <span className="text-text-secondary">
                                    {' '}
                                    · {(e.interaction_type || 'note').replace('_', ' ')}
                                </span>
                                {e.customer_name ? (
                                    <span className="text-text-secondary"> · {e.customer_name}</span>
                                ) : null}
                            </span>
                            <span className="text-[10.5px] text-text-tertiary tabular-nums shrink-0">
                                {relTime(e.occurred_at || e.created_at)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    )
}

// ─── TOP CALLERS ─────────────────────────────────────────────────────────────

function CallersPanel({ accentColor, isLoading, leaderboard }) {
    const max = leaderboard.reduce((m, r) => Math.max(m, r.totalCalls), 1)
    return (
        <Panel title="Top callers · 7d">
            {isLoading ? (
                <SkeletonRows count={3} />
            ) : leaderboard.length === 0 ? (
                <EmptyHint>No calls logged this week.</EmptyHint>
            ) : (
                <div>
                    {leaderboard.map((r, i) => (
                        <div
                            key={`${r.name}-${i}`}
                            className="relative flex items-center gap-2 py-1.5 px-1 -mx-1 rounded overflow-hidden border-b border-border-light last:border-b-0"
                        >
                            <span
                                className="absolute inset-y-0 left-0 rounded"
                                style={{ background: `${accentColor}0f`, width: `${(r.totalCalls / max) * 100}%` }}
                                aria-hidden="true"
                            />
                            <span
                                className="relative w-4 text-[11px] font-semibold font-mono tabular-nums text-text-tertiary shrink-0 text-center"
                                aria-hidden="true"
                            >
                                {i + 1}
                            </span>
                            <span
                                className="relative text-[12px] text-text-primary truncate flex-1 min-w-0"
                                title={r.name}
                            >
                                {r.name}
                            </span>
                            {r.opportunitiesWon > 0 && (
                                <Badge tone="success" size="xs" className="relative shrink-0">
                                    {r.opportunitiesWon}W
                                </Badge>
                            )}
                            <span className="relative text-[13px] font-semibold font-mono tabular-nums text-text-primary shrink-0">
                                {r.totalCalls}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    )
}

// ─── PERSONAL ("Your work" — subordinate) ─────────────────────────────────────

function PersonalSection({ desk, isLoading }) {
    return (
        <Panel title="Your work" innerClassName="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border-light">
                <PersonalCol
                    icon="fa-circle-check"
                    isLoading={isLoading}
                    title="Follow-ups"
                    items={desk.followups}
                    empty="Caught up"
                    render={(f) => (
                        <PersonalRow
                            key={f.id}
                            meta={f.due_at ? DateUtility.formatDate(f.due_at) : ''}
                            title={f.title}
                        />
                    )}
                />
                <PersonalCol
                    icon="fa-building"
                    isLoading={isLoading}
                    title="Accounts"
                    items={desk.accounts}
                    empty="None assigned"
                    render={(a) => (
                        <PersonalRow key={a.id ?? a.account_id} title={a.name ?? a.customer_name ?? 'Account'} />
                    )}
                />
                <PersonalCol
                    icon="fa-chart-line"
                    isLoading={isLoading}
                    title="Opportunities"
                    items={desk.opportunities}
                    empty="None open"
                    render={(o) => <PersonalRow key={o.id} meta={o.stage} title={o.title} />}
                />
                <PersonalCol
                    icon="fa-clock-rotate-left"
                    isLoading={isLoading}
                    title="Recent activity"
                    items={desk.recentActivity}
                    empty="Nothing logged"
                    render={(e, i) => (
                        <PersonalRow
                            key={e.id ?? i}
                            meta={relTime(e.occurred_at || e.created_at)}
                            title={(e.interaction_type || 'note').replace('_', ' ')}
                        />
                    )}
                />
            </div>
        </Panel>
    )
}

function PersonalCol({ empty, icon, isLoading, items, render, title }) {
    return (
        <div className="p-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 pb-0.5">
                <i className={`fas ${icon} text-[10px] text-text-tertiary`} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{title}</span>
            </div>
            {isLoading ? (
                <SkeletonRows count={2} />
            ) : items.length === 0 ? (
                <EmptyHint>{empty}</EmptyHint>
            ) : (
                items.slice(0, 4).map(render)
            )}
        </div>
    )
}

function PersonalRow({ meta, title }) {
    return (
        <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11.5px] text-text-secondary truncate flex-1 min-w-0 capitalize" title={title}>
                {title}
            </span>
            {meta ? (
                <span className="text-[10px] text-text-tertiary font-mono tabular-nums shrink-0">{meta}</span>
            ) : null}
        </div>
    )
}
