/* eslint-disable max-lines */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import PlanSettings from '../../../app/components/plan/tabs/settings/PlanSettings'
import { BookOrderLogService } from '../../../services/BookOrderLogService'
import { UserService } from '../../../services/UserService'

const FETCH_LIMIT = 200
const DISPATCHER_ROLE_NAME = 'Dispatcher'
const LEADERBOARD_TOP_N = 5

/** Buckets for the recommendation-kind breakdown. Order drives the legend. */
const RECOMMENDATION_KINDS = [
    { color: '#16a34a', key: 'happy-path', label: 'Happy path' },
    { color: '#0ea5e9', key: 'shift', label: 'Time shift' },
    { color: '#0ea5e9', key: 'best-effort', label: 'Best effort' },
    { color: '#d97706', key: 'help', label: 'Help fleet' },
    { color: '#d97706', key: 'launch-cap-shift', label: 'Launch cap shift' },
    { color: '#dc2626', key: 'none', label: 'No recommendation' }
]

const DATE_RANGE_OPTIONS = [
    { days: 1, label: 'Today' },
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: null, label: 'All time' }
]

/**
 * Plan → Settings tab. Gated by `plan.settings`. Houses two privileged
 * surfaces:
 *   - Plan Settings panel (travel-time matrix + plant addresses) —
 *     formerly a popup behind the header's settings cog.
 *   - Find-a-Spot activity log with filters, a sortable table, and
 *     aggregate metrics including a Dispatcher leaderboard. The same
 *     row data drives both — metrics always reflect what the table shows.
 */
function PlanSettingsView({
    accentColor,
    addTravelTime,
    newTravelTime,
    plants,
    removeTravelTime,
    setNewTravelTime,
    travelTimes
}) {
    const [logs, setLogs] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [rangeDays, setRangeDays] = useState(7)
    const [kindFilter, setKindFilter] = useState('all')
    const [search, setSearch] = useState('')
    /* { Set<userId>, Map<userId, displayName> } — populated once on mount
     * from the global users + roles projection. Used to identify which
     * `user_id` values on log rows belong to a current Dispatcher. */
    const [dispatcherIndex, setDispatcherIndex] = useState({ ids: new Set(), names: new Map() })

    const refresh = useCallback(async () => {
        setIsLoading(true)
        const rows = await BookOrderLogService.listRecent({ limit: FETCH_LIMIT })
        setLogs(Array.isArray(rows) ? rows : [])
        setIsLoading(false)
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    useEffect(() => {
        let cancelled = false
        UserService.getAllUsersWithProfilesAndRoles()
            .then((users) => {
                if (cancelled) return
                const ids = new Set()
                const names = new Map()
                for (const u of users || []) {
                    if (u?.roleName !== DISPATCHER_ROLE_NAME || !u?.id) continue
                    ids.add(u.id)
                    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
                    names.set(u.id, full || u.email || u.id)
                }
                setDispatcherIndex({ ids, names })
            })
            .catch((error) => {
                console.warn('[PlanSettingsView] failed to load dispatcher roster:', error)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const filteredLogs = useMemo(() => {
        const cutoffMs = rangeDays ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : null
        const needle = search.trim().toLowerCase()
        return logs.filter((row) => {
            if (cutoffMs && row.created_at && new Date(row.created_at).getTime() < cutoffMs) return false
            if (kindFilter !== 'all' && (row.recommendation_kind || '') !== kindFilter) return false
            if (!needle) return true
            const haystack = [
                row.submitter_name,
                row.job_address,
                row.recommended_plant_name,
                row.recommended_plant_code,
                row.recommendation_kind
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return haystack.includes(needle)
        })
    }, [logs, rangeDays, kindFilter, search])

    const metrics = useMemo(() => computeMetrics(filteredLogs), [filteredLogs])

    /* Top dispatchers by Find-a-Spot usage. Restricted to users who
     * currently hold the Dispatcher role — log rows from users who held
     * other roles when they submitted are excluded so this leaderboard
     * answers "who on the dispatch team is using this tool today." */
    const dispatcherLeaderboard = useMemo(
        () => computeDispatcherLeaderboard(filteredLogs, dispatcherIndex),
        [filteredLogs, dispatcherIndex]
    )

    /* Outer scroll surface ONLY — no flex-col here. Combining flex layout
     * with overflow-y-auto on the same element makes children measure
     * against the scrollport height instead of their natural content
     * height, which clips inner sections and breaks vertical scrolling. */
    return (
        <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
                <SettingsHeader
                    accentColor={accentColor}
                    isLoading={isLoading}
                    onRefresh={refresh}
                    rowCount={logs.length}
                />

                {metrics.total > 0 ? (
                    <>
                        <StatCardsRow accentColor={accentColor} metrics={metrics} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                            <KindBreakdownCard metrics={metrics} />
                            <DispatcherLeaderboardCard
                                accentColor={accentColor}
                                rosterLoaded={dispatcherIndex.ids.size > 0}
                                rows={dispatcherLeaderboard}
                            />
                        </div>
                    </>
                ) : (
                    <div className="rounded-lg px-4 py-6 text-center bg-bg-primary border border-border-light text-text-tertiary text-[12.5px]">
                        No log entries match the current filters. Adjust the filters or wait for new submissions.
                    </div>
                )}

                {/* Two-column body: settings sidebar (fixed-ish) + activity
                 *  log main column (flex-1). Collapses to a single stack
                 *  below lg. `min-w-0` on the right column lets the
                 *  activity table's internal horizontal scroll engage
                 *  instead of forcing the grid to overflow. */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,360px)_1fr] gap-4 items-start">
                    <aside className="flex flex-col gap-4 min-w-0">
                        <PlanSettings
                            accentColor={accentColor}
                            addTravelTime={addTravelTime}
                            newTravelTime={newTravelTime}
                            plants={plants}
                            removeTravelTime={removeTravelTime}
                            setNewTravelTime={setNewTravelTime}
                            travelTimes={travelTimes}
                        />
                    </aside>

                    <section className="flex flex-col gap-3 min-w-0">
                        <SectionHeader
                            accentColor={accentColor}
                            icon="fa-clock-rotate-left"
                            subtitle={`${filteredLogs.length} of ${logs.length} row${logs.length === 1 ? '' : 's'} match`}
                            title="Find a Spot — activity log"
                        />
                        <Filters
                            kindFilter={kindFilter}
                            onKindChange={setKindFilter}
                            onRangeChange={setRangeDays}
                            onSearchChange={setSearch}
                            rangeDays={rangeDays}
                            search={search}
                        />
                        <ActivityTable accentColor={accentColor} isLoading={isLoading} logs={filteredLogs} />
                    </section>
                </div>
            </div>
        </div>
    )
}

function SectionHeader({ accentColor, icon, subtitle, title }) {
    return (
        <div className="flex items-center gap-3 mt-2">
            <div
                className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className={`fas ${icon} text-[13px]`} />
            </div>
            <div>
                <div className="text-[13px] font-semibold text-text-primary">{title}</div>
                {subtitle && <div className="text-[10.5px] text-text-tertiary">{subtitle}</div>}
            </div>
        </div>
    )
}

function SettingsHeader({ accentColor, isLoading, onRefresh, rowCount }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-tertiary"
                    style={{ color: accentColor }}
                >
                    <i className="fas fa-sliders text-[16px]" />
                </div>
                <div>
                    <div className="text-[16px] font-semibold text-text-primary">Plan settings</div>
                    <div className="text-[11.5px] text-text-tertiary">
                        Travel times, plant addresses, and the Find-a-Spot audit log · {rowCount} row
                        {rowCount === 1 ? '' : 's'} fetched (most recent {FETCH_LIMIT})
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-semibold cursor-pointer border border-border-light bg-bg-secondary text-text-secondary disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'} text-[10px]`} />
                {isLoading ? 'Loading…' : 'Refresh'}
            </button>
        </div>
    )
}

function Filters({ kindFilter, onKindChange, onRangeChange, onSearchChange, rangeDays, search }) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg p-3 bg-bg-primary border border-border-light">
            <div className="flex items-center gap-1">
                {DATE_RANGE_OPTIONS.map((opt) => {
                    const active = rangeDays === opt.days
                    return (
                        <button
                            key={opt.label}
                            type="button"
                            onClick={() => onRangeChange(opt.days)}
                            className="text-[11.5px] font-semibold rounded px-2.5 py-1 cursor-pointer border border-border-light"
                            style={{
                                background: active ? 'var(--bg-tertiary)' : 'transparent',
                                color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
            <select
                value={kindFilter}
                onChange={(e) => onKindChange(e.target.value)}
                className="text-[12px] rounded px-2 py-1.5 bg-bg-secondary border border-border-light text-text-primary"
            >
                <option value="all">All kinds</option>
                {RECOMMENDATION_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                        {k.label}
                    </option>
                ))}
            </select>
            <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search address, submitter, plant…"
                className="flex-1 min-w-[200px] text-[12px] rounded px-2.5 py-1.5 bg-bg-secondary border border-border-light text-text-primary outline-none"
            />
        </div>
    )
}

/** Top metric strip — six at-a-glance stat cards. Numeric cards lead with
 *  a large tabular value; text cards (top submitter / top plant) drop the
 *  font size so long names don't overflow. The "no-recommendation" card
 *  is themed red to flag attention. */
function StatCardsRow({ accentColor, metrics }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard
                accent={accentColor}
                hint={
                    metrics.medianTrucks ? `median ${metrics.medianTrucks} trucks per pour` : 'all-time fetched window'
                }
                icon="fa-clipboard-list"
                label="Submissions"
                value={metrics.total.toLocaleString()}
            />
            <StatCard
                accent={accentColor}
                hint={
                    metrics.totalYardage ? `${metrics.totalYardage.toLocaleString()} yd total` : 'no yardage recorded'
                }
                icon="fa-cubes-stacked"
                label="Avg yardage"
                value={metrics.avgYardage != null ? `${metrics.avgYardage} yd` : '—'}
            />
            <StatCard
                accent={accentColor}
                hint={metrics.happyPathRatePct == null ? null : `${metrics.happyPathRatePct}% happy path`}
                icon="fa-circle-check"
                label="System shifts"
                value={metrics.shiftRatePct != null ? `${metrics.shiftRatePct}%` : '—'}
            />
            <StatCard
                accent="#dc2626"
                hint={metrics.noneCount === 0 ? 'no missed submissions' : 'cases where Find a Spot returned nothing'}
                icon="fa-circle-exclamation"
                label="No-recommendation"
                tone="warning"
                value={metrics.noneCount.toLocaleString()}
            />
            <StatCard
                accent={accentColor}
                compact
                hint={metrics.uniqueSubmitters > 1 ? `${metrics.uniqueSubmitters} unique users` : 'single submitter'}
                icon="fa-user"
                label="Top submitter"
                value={metrics.topSubmitter || '—'}
            />
            <StatCard
                accent={accentColor}
                compact
                hint={metrics.topPlantPct ? `${metrics.topPlantPct}% of recommendations` : null}
                icon="fa-industry"
                label="Top plant"
                value={metrics.topPlantLabel || '—'}
            />
        </div>
    )
}

/** Dispatcher leaderboard — top users with the Dispatcher role ranked by
 *  Find-a-Spot submissions in the filtered window. Shows total count, %
 *  share of all dispatcher submissions, and a thin progress bar. */
function DispatcherLeaderboardCard({ accentColor, rosterLoaded, rows }) {
    const total = rows.reduce((sum, r) => sum + r.count, 0)
    return (
        <div className="rounded-xl px-4 py-3.5 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-2 mb-3">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
                    Top dispatchers · Find-a-Spot usage
                </span>
                <span className="text-[10.5px] text-text-tertiary">
                    {total.toLocaleString()} submission{total === 1 ? '' : 's'}
                </span>
            </div>
            {!rosterLoaded ? (
                <div className="text-[11.5px] text-text-tertiary py-2">Loading dispatcher roster…</div>
            ) : rows.length === 0 ? (
                <div className="text-[11.5px] text-text-tertiary py-2">
                    No users with the &ldquo;{DISPATCHER_ROLE_NAME}&rdquo; role have submitted in this window.
                </div>
            ) : (
                <ol className="flex flex-col gap-2">
                    {rows.map((row, index) => {
                        const pct = total > 0 ? (row.count / total) * 100 : 0
                        return (
                            <li key={row.userId} className="flex items-center gap-2.5 min-w-0">
                                <span
                                    className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold shrink-0"
                                    style={{ background: `${accentColor}15`, color: accentColor }}
                                >
                                    {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span
                                            className="text-[12px] font-semibold truncate text-text-primary"
                                            title={row.name}
                                        >
                                            {row.name}
                                        </span>
                                        <span
                                            className="text-[11.5px] font-bold tabular-nums shrink-0 text-text-primary"
                                            title={`${pct.toFixed(1)}% of dispatcher submissions`}
                                        >
                                            {row.count}
                                            <span className="ml-1 font-normal text-text-tertiary">
                                                · {pct.toFixed(0)}%
                                            </span>
                                        </span>
                                    </div>
                                    <div className="mt-1 h-1.5 w-full rounded-full overflow-hidden bg-bg-tertiary">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ background: accentColor, width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ol>
            )}
        </div>
    )
}

/** Stacked-bar visualisation of the recommendation-kind distribution. Lives
 *  between the stat strip and the two-column body so it spans full width. */
function KindBreakdownCard({ metrics }) {
    return (
        <div className="rounded-xl px-4 py-3.5 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
                    Recommendation breakdown
                </span>
                <span className="text-[10.5px] text-text-tertiary">{metrics.total.toLocaleString()} total</span>
            </div>
            <KindBar buckets={metrics.kindBuckets} total={metrics.total} />
        </div>
    )
}

/** Single stat tile. Vertical layout: small label up top with an accent icon
 *  chip on the right, big hero value, dim hint at the bottom. Two modes:
 *  default (numeric value, big tabular font) and `compact` for text values
 *  (smaller font so names don't break out). The `tone="warning"` variant
 *  adds a red accent stripe + tinted background to flag attention metrics. */
function StatCard({ accent, compact = false, hint, icon, label, tone, value }) {
    const isWarning = tone === 'warning'
    const valueClass = compact
        ? 'text-[15px] font-semibold leading-tight'
        : 'text-[26px] font-bold leading-none tabular-nums'
    return (
        <div
            className="relative overflow-hidden rounded-xl px-4 pt-3.5 pb-4 flex flex-col gap-2 bg-bg-primary border border-border-light min-h-[110px]"
            style={
                isWarning
                    ? { background: 'rgba(220, 38, 38, 0.04)', borderColor: 'rgba(220, 38, 38, 0.25)' }
                    : undefined
            }
        >
            {/* Accent stripe pinned to the top of warning cards so it reads
             *  as "look here" without colouring the whole tile. */}
            {isWarning && <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: '#dc2626' }} />}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary">{label}</span>
                <span
                    className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                    style={{ background: `${accent}15`, color: accent }}
                >
                    <i className={`fas ${icon} text-[10.5px]`} />
                </span>
            </div>
            <div className={`${valueClass} truncate text-text-primary`} title={String(value)}>
                {value}
            </div>
            {hint && (
                <div className="text-[10.5px] mt-auto truncate text-text-tertiary" title={hint}>
                    {hint}
                </div>
            )}
        </div>
    )
}

/** Horizontal stacked-bar showing recommendation-kind distribution. */
function KindBar({ buckets, total }) {
    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-bg-tertiary">
                {RECOMMENDATION_KINDS.map((k) => {
                    const count = buckets[k.key] || 0
                    if (count === 0) return null
                    const widthPct = (count / total) * 100
                    return (
                        <div
                            key={k.key}
                            style={{ background: k.color, width: `${widthPct}%` }}
                            title={`${k.label}: ${count} (${widthPct.toFixed(1)}%)`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {RECOMMENDATION_KINDS.map((k) => {
                    const count = buckets[k.key] || 0
                    if (count === 0) return null
                    const pct = ((count / total) * 100).toFixed(0)
                    return (
                        <span key={k.key} className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
                            <span className="w-2 h-2 rounded-full" style={{ background: k.color }} />
                            <span className="font-semibold text-text-primary">{count}</span>
                            <span>{k.label}</span>
                            <span className="text-text-tertiary">· {pct}%</span>
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

/** Case-insensitive, whitespace-collapsed key for grouping audit rows
 *  by their `(job_address, plan_date)` pair. Same address typed with
 *  different casing should collapse into one bucket. */
const repeatKeyFor = (entry) => {
    const address = String(entry?.job_address || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
    const date = entry?.plan_date
    if (!address || !date) return null
    return `${address}|${date}`
}

function ActivityTable({ accentColor, isLoading, logs }) {
    const [expandedId, setExpandedId] = useState(null)

    /* Set of `(address, date)` keys that show up in more than one log
     * row. Any row whose key lives in this set picks up the "Was
     * Scheduled" badge — same address + same plan date as another
     * Find-a-Spot submission in the visible history. */
    const repeatKeySet = useMemo(() => {
        const counts = new Map()
        for (const row of logs) {
            const key = repeatKeyFor(row)
            if (!key) continue
            counts.set(key, (counts.get(key) || 0) + 1)
        }
        const out = new Set()
        for (const [key, count] of counts) {
            if (count > 1) out.add(key)
        }
        return out
    }, [logs])

    if (isLoading && logs.length === 0) {
        return (
            <div className="rounded-lg px-4 py-6 text-center bg-bg-primary border border-border-light text-text-tertiary text-[12.5px]">
                Loading activity…
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="rounded-lg px-4 py-6 text-center bg-bg-primary border border-border-light text-text-tertiary text-[12.5px]">
                No activity yet. Submissions from Find a Spot land here for diagnostics.
            </div>
        )
    }

    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
                    <thead>
                        <tr className="bg-bg-tertiary">
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                When
                            </th>
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Submitter
                            </th>
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Kind
                            </th>
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Suggested
                            </th>
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Plant
                            </th>
                            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Yd
                            </th>
                            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Trucks
                            </th>
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-text-tertiary px-3 py-2 border-b border-border-light">
                                Address
                            </th>
                            <th aria-label="Actions" className="px-3 py-2 border-b border-border-light" />
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((entry) => {
                            const key = repeatKeyFor(entry)
                            return (
                                <ActivityTableRow
                                    key={entry.id}
                                    accentColor={accentColor}
                                    entry={entry}
                                    expanded={expandedId === entry.id}
                                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                                    wasScheduled={!!key && repeatKeySet.has(key)}
                                />
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ActivityTableRow({ accentColor, entry, expanded, onToggle, wasScheduled = false }) {
    const [copied, setCopied] = useState(false)
    const createdLabel = formatLogTimestamp(entry?.created_at)
    const suggestedTime = entry?.recommended_start_time || ''
    const typedTime = entry?.requested_start_time || ''
    const shifted = !!suggestedTime && !!typedTime && suggestedTime !== typedTime
    const recDate = entry?.recommended_date || entry?.plan_date || ''
    const plantLabel = entry?.recommended_plant_name || entry?.recommended_plant_code || '—'
    const submitter = entry?.submitter_name || entry?.user_id || 'unknown'
    const kindColor = RECOMMENDATION_KINDS.find((k) => k.key === entry?.recommendation_kind)?.color || '#94a3b8'

    const handleCopy = useCallback(
        async (event) => {
            event.stopPropagation()
            try {
                await navigator.clipboard.writeText(buildLogClipboardPayload(entry))
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
            } catch (error) {
                console.warn('[PlanSettingsView] clipboard write failed:', error)
            }
        },
        [entry]
    )

    return (
        <>
            <tr onClick={onToggle} className="cursor-pointer hover:bg-bg-secondary border-b border-border-light">
                <td className="px-3 py-2 text-[12px] text-text-primary whitespace-nowrap">{createdLabel}</td>
                <td className="px-3 py-2 text-[12px] text-text-primary">{submitter}</td>
                <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                    <span
                        className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-semibold"
                        style={{ background: `${kindColor}20`, color: kindColor }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: kindColor }} />
                        {entry?.recommendation_kind || '—'}
                    </span>
                </td>
                <td className="px-3 py-2 text-[12px] text-text-primary whitespace-nowrap font-mono">
                    {suggestedTime || '—'}
                    {shifted && <span className="ml-1.5 text-[10.5px] text-text-tertiary">(typed {typedTime})</span>}
                    {recDate && <div className="text-[10.5px] text-text-tertiary">{recDate}</div>}
                </td>
                <td className="px-3 py-2 text-[12px] text-text-primary whitespace-nowrap">{plantLabel}</td>
                <td className="px-3 py-2 text-[12px] text-text-primary text-right font-mono">
                    {entry?.yardage ?? '—'}
                </td>
                <td className="px-3 py-2 text-[12px] text-text-primary text-right font-mono">
                    {entry?.estimated_trucks ?? '—'}
                </td>
                <td className="px-3 py-2 text-[12px] text-text-secondary max-w-[260px]" title={entry?.job_address}>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate flex-1 min-w-0">{entry?.job_address || '—'}</span>
                        {wasScheduled && (
                            <span
                                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider shrink-0 bg-amber-100 text-amber-800 border border-amber-300"
                                title="This address + plan date appears in another Find a Spot submission"
                            >
                                <i className="fas fa-clock-rotate-left text-[8px]" />
                                Was Scheduled
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer border-0"
                        style={{
                            background: copied ? 'rgba(22, 163, 74, 0.16)' : 'var(--bg-secondary)',
                            color: copied ? '#15803d' : 'var(--text-secondary)'
                        }}
                        title="Copy this row for diagnosis"
                    >
                        <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[9.5px]`} />
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </td>
            </tr>
            {expanded && (
                <tr>
                    <td colSpan={9} className="px-3 py-3 bg-bg-secondary border-b border-border-light">
                        <ExpandedDetail accentColor={accentColor} entry={entry} />
                    </td>
                </tr>
            )}
        </>
    )
}

function ExpandedDetail({ accentColor, entry }) {
    const fields = [
        ['Submitted by', entry?.submitter_name || entry?.user_id],
        ['Submitted at', formatLogTimestamp(entry?.created_at)],
        ['Plan date', entry?.plan_date],
        ['Suggested', formatTimeWithDate(entry?.recommended_date, entry?.recommended_start_time)],
        ['Dispatcher typed', entry?.requested_start_time],
        ['Plant', entry?.recommended_plant_name || entry?.recommended_plant_code],
        ['Recommendation kind', entry?.recommendation_kind],
        ['Title', entry?.recommendation_title],
        ['Subtitle', entry?.recommendation_subtitle],
        ['Pour method', entry?.pour_method],
        ['Spacing (min)', entry?.truck_spacing_min],
        [
            'Pour window',
            entry?.estimated_pour_window_start_min != null && entry?.estimated_pour_window_end_min != null
                ? `${entry.estimated_pour_window_start_min}–${entry.estimated_pour_window_end_min} min`
                : null
        ]
    ]
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
            {fields.map(([label, value]) =>
                value == null || value === '' ? null : (
                    <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-tertiary">
                            {label}
                        </span>
                        <span className="text-[12px] text-text-primary">{String(value)}</span>
                    </div>
                )
            )}
            <div className="md:col-span-3 flex flex-col gap-0.5">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-tertiary">
                    Decision context
                </span>
                <pre
                    className="text-[11px] font-mono whitespace-pre-wrap break-all text-text-primary bg-bg-primary border border-border-light rounded p-2 overflow-y-auto"
                    style={{ borderColor: `${accentColor}22`, maxHeight: 240 }}
                >
                    {JSON.stringify(entry?.decision_context || {}, null, 2)}
                </pre>
            </div>
        </div>
    )
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Aggregate `rows` into a top-N leaderboard of Dispatcher-role users by
 * submission count. Only rows whose `user_id` is in `dispatcherIndex.ids`
 * are counted. Display name resolves to (in order): the log row's
 * `submitter_name` (captured at submission time), the live name from the
 * roster, or finally the raw user id.
 *
 * @returns {Array<{ userId: string, name: string, count: number }>}
 */
function computeDispatcherLeaderboard(rows, dispatcherIndex) {
    if (!rows?.length || !dispatcherIndex?.ids?.size) return []
    const counts = new Map()
    const names = new Map()
    for (const row of rows) {
        const userId = row?.user_id
        if (!userId || !dispatcherIndex.ids.has(userId)) continue
        counts.set(userId, (counts.get(userId) || 0) + 1)
        if (!names.has(userId)) {
            names.set(userId, row.submitter_name || dispatcherIndex.names.get(userId) || userId)
        }
    }
    return Array.from(counts.entries())
        .map(([userId, count]) => ({ count, name: names.get(userId) || userId, userId }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, LEADERBOARD_TOP_N)
}

function computeMetrics(rows) {
    const total = rows.length
    if (total === 0) {
        return {
            avgYardage: null,
            happyPathRatePct: null,
            kindBuckets: {},
            medianTrucks: null,
            noneCount: 0,
            shiftRatePct: null,
            topPlantLabel: null,
            topPlantPct: null,
            topSubmitter: null,
            total: 0,
            totalYardage: 0,
            uniqueSubmitters: 0
        }
    }

    const kindBuckets = {}
    const plantCounts = new Map()
    const submitterCounts = new Map()
    const yardages = []
    const trucks = []
    let shiftedCount = 0
    let happyPathCount = 0
    let noneCount = 0

    for (const row of rows) {
        const kind = row.recommendation_kind || 'none'
        kindBuckets[kind] = (kindBuckets[kind] || 0) + 1
        if (kind === 'happy-path') happyPathCount += 1
        if (kind === 'none') noneCount += 1
        if (kind === 'shift' || kind === 'best-effort' || kind === 'launch-cap-shift') shiftedCount += 1

        const plantKey = row.recommended_plant_name || row.recommended_plant_code
        if (plantKey) plantCounts.set(plantKey, (plantCounts.get(plantKey) || 0) + 1)

        const submitterKey = row.submitter_name || row.user_id
        if (submitterKey) submitterCounts.set(submitterKey, (submitterCounts.get(submitterKey) || 0) + 1)

        const yd = Number(row.yardage)
        if (Number.isFinite(yd) && yd > 0) yardages.push(yd)

        const t = Number(row.estimated_trucks)
        if (Number.isFinite(t) && t > 0) trucks.push(t)
    }

    const totalYardage = yardages.reduce((a, b) => a + b, 0)
    const avgYardage = yardages.length ? Math.round(totalYardage / yardages.length) : null
    const medianTrucks = trucks.length ? Math.round(median(trucks)) : null
    const shiftRatePct = total > 0 ? Math.round((shiftedCount / total) * 100) : null
    const happyPathRatePct = total > 0 ? Math.round((happyPathCount / total) * 100) : null

    const topPlant = pickTop(plantCounts)
    const topSubmitter = pickTop(submitterCounts)

    return {
        avgYardage,
        happyPathRatePct,
        kindBuckets,
        medianTrucks,
        noneCount,
        shiftRatePct,
        topPlantLabel: topPlant?.key || null,
        topPlantPct: topPlant ? Math.round((topPlant.count / total) * 100) : null,
        topSubmitter: topSubmitter?.key || null,
        total,
        totalYardage,
        uniqueSubmitters: submitterCounts.size
    }
}

function pickTop(map) {
    let best = null
    map.forEach((count, key) => {
        if (!best || count > best.count) best = { count, key }
    })
    return best
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function formatLogTimestamp(iso) {
    if (!iso) return ''
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return iso
    return date.toLocaleString('en-US', {
        day: 'numeric',
        hour: 'numeric',
        hour12: true,
        minute: '2-digit',
        month: 'short'
    })
}

function formatTimeWithDate(date, time) {
    if (!time) return null
    return date ? `${date} ${time}` : time
}

function buildLogClipboardPayload(entry) {
    if (!entry) return ''
    return [
        '=== Find a Spot — log entry ===',
        `id: ${entry.id || ''}`,
        `created: ${entry.created_at || ''}`,
        `submitted_by: ${entry.submitter_name || entry.user_id || ''}`,
        '',
        '--- Form inputs ---',
        `plan_date: ${entry.plan_date || ''}`,
        `requested_start_time: ${entry.requested_start_time || ''}`,
        `yardage: ${entry.yardage ?? ''}`,
        `estimated_trucks: ${entry.estimated_trucks ?? ''}`,
        `truck_spacing_min: ${entry.truck_spacing_min ?? ''}`,
        `pour_method: ${entry.pour_method || ''}`,
        `job_address: ${entry.job_address || ''}`,
        `pour_window: ${entry.estimated_pour_window_start_min ?? ''}–${entry.estimated_pour_window_end_min ?? ''}`,
        '',
        '--- Recommendation ---',
        `kind: ${entry.recommendation_kind || ''}`,
        `plant: ${entry.recommended_plant_name || ''} (${entry.recommended_plant_code || ''})`,
        `date: ${entry.recommended_date || ''}`,
        `time: ${entry.recommended_start_time || ''}`,
        `title: ${entry.recommendation_title || ''}`,
        `subtitle: ${entry.recommendation_subtitle || ''}`,
        '',
        '--- Decision context (raw) ---',
        JSON.stringify(entry.decision_context || {}, null, 2)
    ].join('\n')
}

export default PlanSettingsView
