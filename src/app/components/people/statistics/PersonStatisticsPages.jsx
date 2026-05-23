/* eslint-disable max-lines, react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtInt, fmtPct } from '../../../../utils/PlanStatisticsFormatUtility'
import { CategoricalBarChart, StatusPieChart } from '../../assets/statistics/AssetStatisticsCharts'
import { Panel, Stat, StatGroup } from '../../ui/Panel'

const colorForRating = (rating) => {
    if (!rating || rating === 0) return 'var(--text-tertiary)'
    if (rating < 3) return '#b91c1c'
    if (rating < 4) return '#b45309'
    return '#15803d'
}

const colorForLogin = (days) => {
    if (days == null) return '#94a3b8'
    if (days <= 30) return '#15803d'
    if (days <= 90) return '#b45309'
    return '#b91c1c'
}

/** Highlight row used by the Overview snapshot card — mirrors the asset
 *  surface so the two products read as one. */
function HighlightRow({ hint, icon, label, value, valueColor }) {
    return (
        <div className="flex items-start gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0">
            <i
                className={`fas ${icon} text-[11px] mt-1 w-4 text-center`}
                style={{ color: valueColor || 'var(--text-tertiary)' }}
            />
            <div className="flex-1 min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">{label}</div>
                <div
                    className="font-semibold truncate text-text-primary"
                    style={{ color: valueColor || 'var(--text-primary)', fontSize: 13.5 }}
                >
                    {value}
                </div>
                {hint && <div className="text-[11px] text-text-tertiary truncate">{hint}</div>}
            </div>
        </div>
    )
}

/** Launchpad tile — same affordance as the asset overview's tiles so the
 *  navigation pattern feels identical. */
function LaunchpadTile({ accent, hint, icon, label, onSelect, section, value }) {
    return (
        <button
            type="button"
            onClick={() => onSelect?.(section)}
            className="flex flex-col gap-1 items-start rounded-lg border bg-bg-secondary border-border-light cursor-pointer p-3 text-left hover:border-current transition-colors"
            style={{ color: 'var(--text-secondary)' }}
        >
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider">
                <i className={`fas ${icon} text-[11px]`} style={{ color: accent }} />
                {label}
            </span>
            <span className="font-mono tabular-nums font-bold leading-none text-text-primary" style={{ fontSize: 22 }}>
                {value}
            </span>
            {hint && <span className="text-[10.5px] text-text-tertiary">{hint}</span>}
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: accent }}>
                Open
                <i className="fas fa-arrow-right text-[9px]" />
            </span>
        </button>
    )
}

export function PersonOverviewPage({ accentColor, kind, onSelectSection, stats }) {
    const accent = accentColor || '#1e3a5f'
    const isOperators = kind === 'operators'
    const { perPlant, roleDistribution, statusDistribution, summary } = stats
    const topRoles = roleDistribution.slice(0, 4)
    const topStatuses = statusDistribution.slice(0, 4)

    return (
        <div className="flex flex-col gap-4">
            <Panel title="Roster snapshot" innerClassName="p-0">
                <HighlightRow
                    icon="fa-users"
                    label={isOperators ? 'Operators' : 'Managers'}
                    value={`${fmtInt(summary.total)} on roster`}
                    hint={`${fmtInt(summary.activeCount)} active · ${fmtInt(summary.retiredCount)} terminated / inactive`}
                />
                {isOperators && summary.ratingSamples > 0 && (
                    <HighlightRow
                        icon="fa-star"
                        label="Rating"
                        value={summary.avgRating != null ? `${fmtFloat(summary.avgRating)} ★ avg` : '—'}
                        hint={`${fmtInt(summary.ratingSamples)} rated operators`}
                        valueColor={colorForRating(summary.avgRating)}
                    />
                )}
                {!isOperators && (
                    <HighlightRow
                        icon="fa-right-to-bracket"
                        label="Login recency"
                        value={
                            summary.avgLastLoginDays != null
                                ? `${fmtInt(summary.avgLastLoginDays)} d avg`
                                : 'no recent logins'
                        }
                        hint={
                            summary.neverLoggedIn > 0
                                ? `${fmtInt(summary.neverLoggedIn)} have never logged in`
                                : 'every manager has signed in'
                        }
                        valueColor={summary.neverLoggedIn > 0 ? '#b45309' : '#15803d'}
                    />
                )}
                {!isOperators && stats.managerCoverage && (
                    <HighlightRow
                        icon="fa-shield-halved"
                        label="Coverage risk"
                        value={
                            stats.managerCoverage.uncoveredPlants.length === 0 &&
                            stats.managerCoverage.spofPlants.length === 0
                                ? 'No gaps — every plant has backup'
                                : `${fmtInt(stats.managerCoverage.uncoveredPlants.length)} uncovered · ${fmtInt(stats.managerCoverage.spofPlants.length)} SPOF`
                        }
                        hint={
                            stats.managerCoverage.recentAdditions.length > 0
                                ? `${fmtInt(stats.managerCoverage.recentAdditions.length)} added in last 30 d`
                                : 'roster stable last 30 d'
                        }
                        valueColor={
                            stats.managerCoverage.uncoveredPlants.length > 0
                                ? '#b91c1c'
                                : stats.managerCoverage.spofPlants.length > 0
                                  ? '#b45309'
                                  : '#15803d'
                        }
                    />
                )}
                {!isOperators && stats.managerCoverage && (
                    <HighlightRow
                        icon="fa-user-shield"
                        label="Role tiers"
                        value={`${fmtInt(stats.managerCoverage.roleTiers.admin)} admin · ${fmtInt(stats.managerCoverage.roleTiers.lead)} lead`}
                        hint={`${fmtInt(stats.managerCoverage.roleTiers.manager)} manager · ${fmtInt(stats.managerCoverage.roleTiers.viewer)} viewer`}
                    />
                )}
                {isOperators && stats.hiringTraining && (
                    <HighlightRow
                        icon="fa-user-plus"
                        label="Hiring pipeline"
                        value={
                            stats.hiringTraining.pendingStarts.length + stats.hiringTraining.inTraining.length > 0
                                ? `${fmtInt(stats.hiringTraining.pendingStarts.length)} pending · ${fmtInt(stats.hiringTraining.inTraining.length)} training`
                                : 'Empty'
                        }
                        hint={`${fmtInt(stats.hiringTraining.trainers.length)} trainer${stats.hiringTraining.trainers.length === 1 ? '' : 's'} · ${fmtInt(stats.hiringTraining.recentHires.length)} new in 90 d`}
                        valueColor={stats.hiringTraining.pendingStarts.length > 0 ? '#b45309' : '#15803d'}
                    />
                )}
                <HighlightRow
                    icon="fa-industry"
                    label="Plants represented"
                    value={`${fmtInt(summary.plantsRepresented)} plants`}
                    hint={`${fmtInt(perPlant.length)} in scoped per-plant rollup`}
                />
            </Panel>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {topRoles.length > 0 && (
                    <Panel title={isOperators ? 'Top positions' : 'Top roles'} innerClassName="p-0">
                        <div className="flex flex-col">
                            {topRoles.map((row) => (
                                <div
                                    key={row.label}
                                    className="flex items-center gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0"
                                >
                                    <span className="font-mono tabular-nums font-semibold w-10 text-right text-text-primary">
                                        {fmtInt(row.count)}
                                    </span>
                                    <span className="flex-1 truncate text-text-secondary">{row.label}</span>
                                    <span className="text-[11px] text-text-tertiary">
                                        {fmtPct((row.count / summary.total) * 100)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                )}
                {isOperators && topStatuses.length > 0 && (
                    <Panel title="Status mix" innerClassName="p-3">
                        <StatusPieChart data={statusDistribution.slice(0, 6)} />
                    </Panel>
                )}
                {!isOperators && (
                    <Panel title="Where managers live" innerClassName="p-0">
                        <div className="flex flex-col">
                            {perPlant.slice(0, 6).map((row) => (
                                <div
                                    key={row.code}
                                    className="flex items-center gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0"
                                >
                                    <span className="font-mono tabular-nums font-semibold w-12 text-text-primary">
                                        {row.code}
                                    </span>
                                    <span className="flex-1 truncate text-text-secondary">{row.name}</span>
                                    <span className="font-mono tabular-nums font-semibold text-text-primary">
                                        {fmtInt(row.total)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                )}
            </div>

            <Panel title="Jump into details" innerClassName="p-3">
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {isOperators && (
                        <LaunchpadTile
                            accent={accent}
                            icon="fa-circle-half-stroke"
                            label="Roster Status"
                            section="status"
                            value={fmtInt(summary.activeCount)}
                            hint={`${fmtInt(summary.retiredCount)} inactive`}
                            onSelect={onSelectSection}
                        />
                    )}
                    <LaunchpadTile
                        accent={accent}
                        icon="fa-industry"
                        label="Plant Distribution"
                        section="plants"
                        value={fmtInt(perPlant.length)}
                        hint="plants in scope"
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        accent={accent}
                        icon="fa-user-tag"
                        label={isOperators ? 'Positions' : 'Roles'}
                        section="roles"
                        value={fmtInt(roleDistribution.length)}
                        hint={isOperators ? 'unique positions' : 'unique roles'}
                        onSelect={onSelectSection}
                    />
                    {isOperators && (
                        <LaunchpadTile
                            accent={accent}
                            icon="fa-user-plus"
                            label="Hiring & Training"
                            section="hiringTraining"
                            value={fmtInt(stats.hiringTraining?.pendingStarts.length || 0)}
                            hint={
                                stats.hiringTraining?.inTraining.length > 0
                                    ? `${fmtInt(stats.hiringTraining.inTraining.length)} in training`
                                    : 'pending + training pipeline'
                            }
                            onSelect={onSelectSection}
                        />
                    )}
                    {isOperators && (
                        <LaunchpadTile
                            accent={accent}
                            icon="fa-star"
                            label="Ratings"
                            section="rating"
                            value={summary.avgRating != null ? `${fmtFloat(summary.avgRating)}★` : '—'}
                            hint={`${fmtInt(summary.ratingSamples)} rated`}
                            onSelect={onSelectSection}
                        />
                    )}
                    {!isOperators && stats.managerCoverage && (
                        <LaunchpadTile
                            accent={accent}
                            icon="fa-shield-halved"
                            label="Coverage & Risk"
                            section="coverage"
                            value={fmtInt(
                                stats.managerCoverage.uncoveredPlants.length + stats.managerCoverage.spofPlants.length
                            )}
                            hint={
                                stats.managerCoverage.uncoveredPlants.length + stats.managerCoverage.spofPlants.length >
                                0
                                    ? `${fmtInt(stats.managerCoverage.uncoveredPlants.length)} uncovered · ${fmtInt(stats.managerCoverage.spofPlants.length)} SPOF`
                                    : 'no coverage gaps'
                            }
                            onSelect={onSelectSection}
                        />
                    )}
                    {!isOperators && (
                        <LaunchpadTile
                            accent={accent}
                            icon="fa-right-to-bracket"
                            label="Login Activity"
                            section="activity"
                            value={fmtInt(summary.neverLoggedIn)}
                            hint="never logged in"
                            onSelect={onSelectSection}
                        />
                    )}
                </div>
            </Panel>
        </div>
    )
}

export function PersonStatusPage({ accentColor, stats }) {
    const accent = accentColor || '#1e3a5f'
    const { statusDistribution, summary } = stats
    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Active"
                    value={fmtInt(summary.activeCount)}
                    hint="on the roster today"
                    valueColor="#15803d"
                />
                <Stat label="Inactive" value={fmtInt(summary.retiredCount)} hint="terminated / no-hire" />
                <Stat label="Trainers" value={fmtInt(summary.trainerCount)} hint="flagged as trainer" />
                <Stat
                    label="Missing data"
                    value={fmtInt(summary.missingPlant + summary.missingName + summary.missingPhone)}
                    hint="plant + name + phone gaps"
                    valueColor={
                        summary.missingPlant + summary.missingName + summary.missingPhone > 0 ? '#b45309' : '#15803d'
                    }
                />
            </StatGroup>
            <Panel title="Roster status mix" innerClassName="p-3">
                {statusDistribution.length === 0 ? (
                    <div className="text-[12px] py-6 text-center text-text-tertiary">No status data in scope.</div>
                ) : (
                    <StatusPieChart data={statusDistribution} />
                )}
            </Panel>
            <Panel title="By status" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={statusDistribution} height={220} />
            </Panel>
        </div>
    )
}

export function PersonPlantsPage({ accentColor, kind, stats }) {
    const accent = accentColor || '#1e3a5f'
    const isOperators = kind === 'operators'
    const { perPlant, summary } = stats
    const topPlants = perPlant.slice(0, 12).map((row) => ({ count: row.active, label: row.code }))
    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat label="Plants in scope" value={fmtInt(perPlant.length)} hint="have at least one person" />
                <Stat
                    label="Most populated"
                    value={perPlant[0] ? fmtInt(perPlant[0].active) : '—'}
                    hint={perPlant[0] ? `${perPlant[0].code} · ${perPlant[0].name}` : '—'}
                />
                <Stat
                    label="Avg per plant"
                    value={perPlant.length > 0 ? fmtInt(Math.round(summary.activeCount / perPlant.length)) : '—'}
                    hint="active ÷ plants"
                />
                {isOperators ? (
                    <Stat
                        label="Trainers spread"
                        value={fmtInt(perPlant.filter((p) => p.trainers > 0).length)}
                        hint={`${fmtInt(summary.trainerCount)} trainers total`}
                    />
                ) : (
                    <Stat
                        label="Missing plant"
                        value={fmtInt(summary.missingPlant)}
                        hint="managers without plant"
                        valueColor={summary.missingPlant > 0 ? '#b45309' : undefined}
                    />
                )}
            </StatGroup>
            <Panel title="Top plants by active roster" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={topPlants} height={240} />
            </Panel>
            <Panel
                title="Per-plant scorecard"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${perPlant.length} plants`}</span>}
            >
                {perPlant.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">No plants in scope.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Plant
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Total
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Active
                                    </th>
                                    {isOperators && (
                                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                            Trainers
                                        </th>
                                    )}
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Share
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {perPlant.map((row) => {
                                    const share = summary.activeCount > 0 ? (row.active / summary.activeCount) * 100 : 0
                                    return (
                                        <tr key={row.code} className="border-t border-border-light">
                                            <td className="px-3 py-2">
                                                <span className="font-mono tabular-nums font-semibold text-text-primary">
                                                    {row.code}
                                                </span>
                                                {row.name !== row.code && (
                                                    <span className="ml-2 text-text-secondary">{row.name}</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                                {fmtInt(row.total)}
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                                {fmtInt(row.active)}
                                            </td>
                                            {isOperators && (
                                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                                    {fmtInt(row.trainers)}
                                                </td>
                                            )}
                                            <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                                                {share.toFixed(1)}%
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    )
}

export function PersonRolesPage({ accentColor, kind, stats }) {
    const accent = accentColor || '#1e3a5f'
    const isOperators = kind === 'operators'
    const { roleDistribution, summary } = stats
    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label={isOperators ? 'Positions' : 'Roles'}
                    value={fmtInt(roleDistribution.length)}
                    hint={isOperators ? 'unique operator positions' : 'unique roles'}
                />
                <Stat
                    label="Top group"
                    value={roleDistribution[0] ? fmtInt(roleDistribution[0].count) : '—'}
                    hint={roleDistribution[0] ? roleDistribution[0].label : '—'}
                />
                <Stat
                    label="Top group share"
                    value={
                        roleDistribution[0] && summary.total > 0
                            ? fmtPct((roleDistribution[0].count / summary.total) * 100)
                            : '—'
                    }
                    hint="of roster"
                />
                {isOperators && (
                    <Stat label="Trainers" value={fmtInt(summary.trainerCount)} hint="across all positions" />
                )}
            </StatGroup>
            <Panel title={isOperators ? 'Position breakdown' : 'Role breakdown'} innerClassName="p-3">
                {roleDistribution.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">Nothing assigned yet.</div>
                ) : (
                    <CategoricalBarChart accent={accent} data={roleDistribution} height={240} />
                )}
            </Panel>
        </div>
    )
}

/** Date formatter for the Pending Starts table — short month/day/year so
 *  the table column stays tight. Returns "TBD" for null dates so the
 *  table never renders a blank cell. */
const formatPendingDate = (iso) => {
    if (!iso) return 'TBD'
    const date = new Date(`${iso}T00:00:00`)
    if (!Number.isFinite(date.getTime())) return 'TBD'
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Formats a full ISO timestamp (e.g. `createdAt`, `statusChangedAt`) into
 *  the same short month/day/year style as `formatPendingDate`. Tolerates
 *  both timestamp and date-only inputs so the period-bound event tables
 *  render cleanly regardless of which field the row carries. */
const formatEventDate = (iso) => {
    if (!iso) return '—'
    const value = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

const daysUntilColor = (days) => {
    if (days == null) return 'var(--text-tertiary)'
    if (days < 0) return '#b91c1c'
    if (days <= 7) return '#16a34a'
    if (days <= 30) return '#b45309'
    return 'var(--text-primary)'
}

const daysUntilLabel = (days) => {
    if (days == null) return 'TBD'
    if (days === 0) return 'today'
    if (days < 0) return `${Math.abs(days)} d late`
    if (days === 1) return 'tomorrow'
    return `in ${days} d`
}

/**
 * Hiring & Training — operator-only pipeline view. Surfaces the four
 * lifecycle states dispatch actually cares about: Pending Start (offer
 * accepted, waiting), Training (on-site with a trainer), the trainer
 * roster itself, and recent hires (active within 90 days). No Hire and
 * trainer-coverage gaps round it out.
 */
export function PersonHiringTrainingPage({ stats }) {
    const { hiringTraining, summary } = stats
    if (!hiringTraining) {
        return (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
                <i className="fas fa-circle-info text-[14px]" />
                Hiring &amp; training data only applies to operators.
            </div>
        )
    }

    const {
        counts,
        hiresInPeriod,
        inTraining,
        noHireList,
        pendingStarts,
        periodActive,
        plantsMissingTrainers,
        recentHires,
        terminatedInPeriod,
        trainers
    } = hiringTraining
    const startingSoon = pendingStarts.filter((row) => row.daysUntilStart != null && row.daysUntilStart <= 7).length
    const overdueStarts = pendingStarts.filter((row) => row.daysUntilStart != null && row.daysUntilStart < 0).length
    const periodHint = periodActive ? 'in selected period' : 'lifetime'

    return (
        <div className="flex flex-col gap-4">
            {/* Period activity — filters by createdAt (hires) or
                statusChangedAt (training / activation / termination) inside
                the selected time range. Collapses to lifetime totals when
                the period is all-time so the strip is always useful. */}
            <StatGroup columns={4}>
                <Stat
                    label="Hired"
                    value={fmtInt(counts.hired)}
                    hint={periodHint}
                    valueColor={counts.hired > 0 ? '#15803d' : undefined}
                />
                <Stat label="Started training" value={fmtInt(counts.startedTraining)} hint={periodHint} />
                <Stat
                    label="Activated"
                    value={fmtInt(counts.activated)}
                    hint={periodHint}
                    valueColor={counts.activated > 0 ? '#15803d' : undefined}
                />
                <Stat
                    label="Terminated"
                    value={fmtInt(counts.terminated)}
                    hint={counts.noHire > 0 ? `${periodHint} · ${fmtInt(counts.noHire)} declined` : periodHint}
                    valueColor={counts.terminated > 0 ? '#b91c1c' : undefined}
                />
            </StatGroup>

            {/* Live pipeline snapshot — independent of the selected period
                so dispatch always sees who's currently in the funnel. */}
            <StatGroup columns={4}>
                <Stat
                    label="Pending starts"
                    value={fmtInt(pendingStarts.length)}
                    hint={
                        overdueStarts > 0
                            ? `${fmtInt(overdueStarts)} past start date`
                            : startingSoon > 0
                              ? `${fmtInt(startingSoon)} starting in 7 d`
                              : 'no active pipeline'
                    }
                    valueColor={overdueStarts > 0 ? '#b91c1c' : pendingStarts.length > 0 ? '#b45309' : '#15803d'}
                />
                <Stat label="In training" value={fmtInt(inTraining.length)} hint="currently on-site with trainer" />
                <Stat
                    label="Trainers"
                    value={fmtInt(trainers.length)}
                    hint={`covering ${fmtInt(trainers.reduce((sum, t) => sum + t.mentees, 0))} mentees`}
                />
                <Stat
                    label="Recent hires"
                    value={fmtInt(recentHires.length)}
                    hint="active, hired within 90 d"
                    valueColor={recentHires.length > 0 ? '#15803d' : undefined}
                />
            </StatGroup>

            <Panel
                title="Pending starts"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`${pendingStarts.length} in queue`}</span>}
            >
                {pendingStarts.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">
                        No pending starts in scope. Pipeline is clear.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Name
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Plant
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Position
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Start date
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Countdown
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingStarts.map((row) => (
                                    <tr key={row.id} className="border-t border-border-light">
                                        <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                        <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                            {row.plant}
                                        </td>
                                        <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                        <td className="px-2 py-2 text-text-secondary">
                                            {formatPendingDate(row.pendingStartDate)}
                                        </td>
                                        <td
                                            className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                            style={{ color: daysUntilColor(row.daysUntilStart) }}
                                        >
                                            {daysUntilLabel(row.daysUntilStart)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel
                    title="Currently in training"
                    innerClassName="p-0"
                    right={<span className="text-[11px] text-text-tertiary">{`${inTraining.length} active`}</span>}
                >
                    {inTraining.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            Nobody is in training right now.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Name
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                            Plant
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                            Trainer
                                        </th>
                                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Days in
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inTraining.map((row) => (
                                        <tr key={row.id} className="border-t border-border-light">
                                            <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                            <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                                {row.plant}
                                            </td>
                                            <td className="px-2 py-2 text-text-secondary">
                                                {row.assignedTrainerName ? (
                                                    row.assignedTrainerName
                                                ) : (
                                                    <span className="italic text-text-tertiary">No trainer</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                                style={{
                                                    color:
                                                        row.daysInTraining != null && row.daysInTraining > 30
                                                            ? '#b45309'
                                                            : 'var(--text-primary)'
                                                }}
                                            >
                                                {row.daysInTraining == null ? '—' : `${fmtInt(row.daysInTraining)} d`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
                <Panel
                    title="Trainer roster"
                    innerClassName="p-0"
                    right={<span className="text-[11px] text-text-tertiary">{`${trainers.length} trainers`}</span>}
                >
                    {trainers.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            No trainers flagged on the roster.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Trainer
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                            Plant
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                            Position
                                        </th>
                                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Mentees
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainers.map((row) => (
                                        <tr key={row.id} className="border-t border-border-light">
                                            <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                            <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                                {row.plant}
                                            </td>
                                            <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                            <td
                                                className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                                style={{ color: row.mentees > 0 ? '#15803d' : 'var(--text-tertiary)' }}
                                            >
                                                {fmtInt(row.mentees)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>

            {periodActive && (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                    <Panel
                        title="Hires in period"
                        innerClassName="p-0"
                        right={<span className="text-[11px] text-text-tertiary">{`${hiresInPeriod.length} new`}</span>}
                    >
                        {hiresInPeriod.length === 0 ? (
                            <div className="text-[12px] py-4 text-center text-text-tertiary">
                                No hires inside the selected window.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px] border-collapse">
                                    <thead>
                                        <tr className="text-text-tertiary">
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                                Name
                                            </th>
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                                Plant
                                            </th>
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                                Position
                                            </th>
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                                Status
                                            </th>
                                            <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                                Hired
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hiresInPeriod.map((row) => (
                                            <tr key={row.id} className="border-t border-border-light">
                                                <td className="px-3 py-2 font-semibold text-text-primary">
                                                    {row.name}
                                                </td>
                                                <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                                    {row.plant}
                                                </td>
                                                <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                                <td className="px-2 py-2 text-text-secondary">{row.status}</td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                                                    {formatEventDate(row.eventDate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                    <Panel
                        title="Terminations in period"
                        innerClassName="p-0"
                        right={
                            <span className="text-[11px] text-text-tertiary">
                                {`${terminatedInPeriod.length} ended`}
                            </span>
                        }
                    >
                        {terminatedInPeriod.length === 0 ? (
                            <div className="text-[12px] py-4 text-center text-text-tertiary">
                                No terminations inside the selected window.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px] border-collapse">
                                    <thead>
                                        <tr className="text-text-tertiary">
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                                Name
                                            </th>
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                                Plant
                                            </th>
                                            <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                                Position
                                            </th>
                                            <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                                Effective
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {terminatedInPeriod.map((row) => (
                                            <tr key={row.id} className="border-t border-border-light">
                                                <td className="px-3 py-2 font-semibold text-text-primary">
                                                    {row.name}
                                                </td>
                                                <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                                    {row.plant}
                                                </td>
                                                <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                                <td
                                                    className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                                    style={{ color: '#b91c1c' }}
                                                >
                                                    {formatEventDate(row.eventDate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            <Panel
                title="Recent hires (last 90 days)"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`${recentHires.length} new`}</span>}
            >
                {recentHires.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">
                        No new hires within the last 90 days.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Name
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Plant
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Position
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Status
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Days on roster
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentHires.map((row) => (
                                    <tr key={row.id} className="border-t border-border-light">
                                        <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                        <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                            {row.plant}
                                        </td>
                                        <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                        <td className="px-2 py-2 text-text-secondary">{row.status}</td>
                                        <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                            {fmtInt(row.tenureDays)} d
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel
                    title="Plants missing trainer coverage"
                    innerClassName="p-0"
                    right={
                        <span className="text-[11px] text-text-tertiary">
                            {plantsMissingTrainers.length > 0
                                ? `${plantsMissingTrainers.length} plant${plantsMissingTrainers.length === 1 ? '' : 's'}`
                                : 'Coverage complete'}
                        </span>
                    }
                >
                    {plantsMissingTrainers.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            Every plant with roster has a trainer.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Plant
                                        </th>
                                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Active roster
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantsMissingTrainers.map((row) => (
                                        <tr key={row.code} className="border-t border-border-light">
                                            <td className="px-3 py-2">
                                                <span className="font-mono tabular-nums font-semibold text-text-primary">
                                                    {row.code}
                                                </span>
                                                {row.name !== row.code && (
                                                    <span className="ml-2 text-text-secondary">{row.name}</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                                style={{ color: row.active > 0 ? '#b45309' : 'var(--text-tertiary)' }}
                                            >
                                                {fmtInt(row.active)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
                <Panel
                    title="Declined / No-hire"
                    innerClassName="p-0"
                    right={<span className="text-[11px] text-text-tertiary">{`${noHireList.length} on file`}</span>}
                >
                    {noHireList.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            No declined applicants on file.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Name
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                            Plant
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Position
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {noHireList.map((row) => (
                                        <tr key={row.id} className="border-t border-border-light">
                                            <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                            <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                                {row.plant}
                                            </td>
                                            <td className="px-3 py-2 text-text-secondary">{row.position}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>

            {summary.total > 0 && pendingStarts.length === 0 && inTraining.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-2 text-[12px] text-text-secondary">
                    <i className="fas fa-circle-check text-[14px]" style={{ color: '#15803d' }} />
                    Hiring pipeline is empty — every operator is either training or already in production.
                </div>
            )}
        </div>
    )
}

export function PersonRatingPage({ accentColor, stats }) {
    const accent = accentColor || '#1e3a5f'
    const { lowestRatedOperators, ratingDistribution, summary } = stats
    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Avg rating"
                    value={summary.avgRating != null ? `${fmtFloat(summary.avgRating)} ★` : '—'}
                    hint={`${fmtInt(summary.ratingSamples)} rated`}
                    valueColor={colorForRating(summary.avgRating)}
                />
                <Stat
                    label="At 5 ★"
                    value={fmtInt(ratingDistribution.find((r) => r.label === '5 ★')?.count || 0)}
                    hint="top performers"
                    valueColor="#15803d"
                />
                <Stat
                    label="At 1–2 ★"
                    value={fmtInt(
                        (ratingDistribution.find((r) => r.label === '1 ★')?.count || 0) +
                            (ratingDistribution.find((r) => r.label === '2 ★')?.count || 0)
                    )}
                    hint="needs attention"
                    valueColor="#b91c1c"
                />
                <Stat
                    label="Unrated"
                    value={fmtInt(ratingDistribution.find((r) => r.label === 'Unrated')?.count || 0)}
                    hint="no rating recorded"
                />
            </StatGroup>
            <Panel title="Rating distribution" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={ratingDistribution} height={240} />
            </Panel>
            <Panel
                title="Operators that need attention"
                innerClassName="p-0"
                right={
                    <span className="text-[11px] text-text-tertiary">{`Showing ${lowestRatedOperators.length}`}</span>
                }
            >
                {lowestRatedOperators.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">
                        No low-rated operators in scope. Roster is healthy.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Name
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Plant
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Position
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Status
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Rating
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowestRatedOperators.map((row) => (
                                    <tr key={row.id} className="border-t border-border-light">
                                        <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                        <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                            {row.plant}
                                        </td>
                                        <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                        <td className="px-2 py-2 text-text-secondary">{row.status}</td>
                                        <td
                                            className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                            style={{ color: colorForRating(row.rating) }}
                                        >
                                            {row.rating.toFixed(1)} ★
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    )
}

export function PersonActivityPage({ accentColor, stats }) {
    const accent = accentColor || '#1e3a5f'
    const { lastLoginDistribution, staleManagers, summary } = stats
    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Avg recency"
                    value={summary.avgLastLoginDays != null ? `${fmtInt(summary.avgLastLoginDays)} d` : '—'}
                    hint="days since last login"
                />
                <Stat
                    label="Recent (≤ 7d)"
                    value={fmtInt(lastLoginDistribution.find((r) => r.label === '< 7 d')?.count || 0)}
                    hint="signed in this week"
                    valueColor="#15803d"
                />
                <Stat
                    label="Stale (> 90d)"
                    value={fmtInt(
                        (lastLoginDistribution.find((r) => r.label === '91–180 d')?.count || 0) +
                            (lastLoginDistribution.find((r) => r.label === '> 180 d')?.count || 0)
                    )}
                    hint="long inactive"
                    valueColor="#b45309"
                />
                <Stat
                    label="Never"
                    value={fmtInt(summary.neverLoggedIn)}
                    hint="never logged in"
                    valueColor={summary.neverLoggedIn > 0 ? '#b91c1c' : undefined}
                />
            </StatGroup>
            <Panel title="Login recency" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={lastLoginDistribution} height={240} />
            </Panel>
            <Panel
                title="Stale accounts"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Top ${staleManagers.length}`}</span>}
            >
                {staleManagers.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">All managers are current.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Name
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Plant
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Role
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Last login
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {staleManagers.map((row) => (
                                    <tr key={row.id} className="border-t border-border-light">
                                        <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                        <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                            {row.plant}
                                        </td>
                                        <td className="px-2 py-2 text-text-secondary">{row.role}</td>
                                        <td
                                            className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                            style={{ color: colorForLogin(row.daysSince) }}
                                        >
                                            {row.daysSince == null ? 'Never' : `${fmtInt(row.daysSince)} d`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    )
}

const TIER_META = [
    { color: '#b91c1c', hint: 'role weight ≥ 70', id: 'admin', label: 'Admin' },
    { color: '#b45309', hint: 'role weight 40–69', id: 'lead', label: 'Lead' },
    { color: '#0ea5e9', hint: 'role weight 20–39', id: 'manager', label: 'Manager' },
    { color: '#64748b', hint: 'role weight < 20', id: 'viewer', label: 'Viewer' }
]

/** Role-tier tile — one per band, ordered by weight desc. The colored
 *  swatch + count combo reads as a balance check at a glance. */
function TierTile({ color, count, hint, label, total }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
        <div className="rounded-lg p-3 flex flex-col gap-1 bg-bg-secondary border border-border-light">
            <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary truncate">
                    {label}
                </span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 22 }}>
                    {fmtInt(count)}
                </span>
                {total > 0 && <span className="text-[11px] text-text-tertiary">{pct}%</span>}
            </div>
            <div className="text-[10.5px] text-text-tertiary">{hint}</div>
        </div>
    )
}

/**
 * Coverage & Risk — managers-only. Surfaces the four signals that
 * actually matter for a permission roster: plant coverage gaps,
 * single-point-of-failure plants, role-tier balance, and recent
 * additions. Each section is structured so the operations lead can scan
 * for "where am I exposed?" in under ten seconds.
 */
export function PersonCoveragePage({ accentColor, stats }) {
    const accent = accentColor || '#1e3a5f'
    const { managerCoverage, summary } = stats
    if (!managerCoverage) {
        return (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
                <i className="fas fa-circle-info text-[14px]" />
                Coverage view is only available for managers.
            </div>
        )
    }

    const { domainBreakdown, loginHealth, recentAdditions, roleTiers, spofPlants, uncoveredPlants } = managerCoverage
    const totalTiered = roleTiers.admin + roleTiers.lead + roleTiers.manager + roleTiers.viewer
    const totalManagers = summary.total

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Uncovered plants"
                    value={fmtInt(uncoveredPlants.length)}
                    hint={uncoveredPlants.length > 0 ? 'no managers assigned' : 'every plant covered'}
                    valueColor={uncoveredPlants.length > 0 ? '#b91c1c' : '#15803d'}
                />
                <Stat
                    label="Single-point-of-failure"
                    value={fmtInt(spofPlants.length)}
                    hint={spofPlants.length > 0 ? 'plants with only 1 manager' : 'all plants have backup'}
                    valueColor={spofPlants.length > 0 ? '#b45309' : '#15803d'}
                />
                <Stat
                    label="Recent additions"
                    value={fmtInt(recentAdditions.length)}
                    hint="added in last 30 d"
                    valueColor={recentAdditions.length > 0 ? '#15803d' : undefined}
                />
                <Stat
                    label="Stale accounts"
                    value={fmtInt(loginHealth.stale + loginHealth.never)}
                    hint={`${fmtInt(loginHealth.stale)} > 90 d · ${fmtInt(loginHealth.never)} never`}
                    valueColor={loginHealth.stale + loginHealth.never > 0 ? '#b45309' : '#15803d'}
                />
            </StatGroup>

            <Panel title="Role-tier balance" innerClassName="p-3">
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    {TIER_META.map((tier) => (
                        <TierTile
                            key={tier.id}
                            color={tier.color}
                            count={roleTiers[tier.id]}
                            hint={tier.hint}
                            label={tier.label}
                            total={totalTiered}
                        />
                    ))}
                </div>
                <div className="mt-2 text-[11px] text-text-tertiary">
                    Tiers come from <span className="font-semibold">roleWeight</span> — the same weight the rest of the
                    app uses to gate permissions, so the mix here matches who actually has what access.
                </div>
            </Panel>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel
                    title="Plants with no manager coverage"
                    innerClassName="p-0"
                    right={
                        <span className="text-[11px] text-text-tertiary">
                            {uncoveredPlants.length > 0
                                ? `${uncoveredPlants.length} plant${uncoveredPlants.length === 1 ? '' : 's'}`
                                : 'Coverage complete'}
                        </span>
                    }
                >
                    {uncoveredPlants.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            Every plant in scope has at least one manager.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Plant
                                        </th>
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {uncoveredPlants.map((row) => (
                                        <tr key={row.code} className="border-t border-border-light">
                                            <td className="px-3 py-2">
                                                <span className="font-mono tabular-nums font-semibold text-text-primary">
                                                    {row.code}
                                                </span>
                                                {row.name !== row.code && (
                                                    <span className="ml-2 text-text-secondary">{row.name}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-semibold"
                                                    style={{ background: '#b91c1c1f', color: '#b91c1c' }}
                                                >
                                                    No managers
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
                <Panel
                    title="Single-point-of-failure plants"
                    innerClassName="p-0"
                    right={
                        <span className="text-[11px] text-text-tertiary">
                            {spofPlants.length > 0
                                ? `${spofPlants.length} plant${spofPlants.length === 1 ? '' : 's'}`
                                : 'All have backup'}
                        </span>
                    }
                >
                    {spofPlants.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            Every covered plant has at least two managers — no SPOF risk.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Plant
                                        </th>
                                        <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                            Managers
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spofPlants.map((row) => (
                                        <tr key={row.code} className="border-t border-border-light">
                                            <td className="px-3 py-2">
                                                <span className="font-mono tabular-nums font-semibold text-text-primary">
                                                    {row.code}
                                                </span>
                                                {row.name !== row.code && (
                                                    <span className="ml-2 text-text-secondary">{row.name}</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-3 py-2 text-right font-mono tabular-nums font-semibold"
                                                style={{ color: '#b45309' }}
                                            >
                                                {row.count}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>

            <Panel
                title="Recent additions (last 30 days)"
                innerClassName="p-0"
                right={
                    <span className="text-[11px] text-text-tertiary">
                        {recentAdditions.length > 0 ? `${recentAdditions.length} new` : 'No new managers'}
                    </span>
                }
            >
                {recentAdditions.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">
                        Nobody added in the last 30 days. Roster is stable.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Name
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Plant
                                    </th>
                                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2">
                                        Role
                                    </th>
                                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2">
                                        Added
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAdditions.map((row) => (
                                    <tr key={row.id} className="border-t border-border-light">
                                        <td className="px-3 py-2">
                                            <div className="font-semibold text-text-primary">{row.name}</div>
                                            {row.email && (
                                                <div className="text-[10.5px] text-text-tertiary truncate">
                                                    {row.email}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                            {row.plant}
                                        </td>
                                        <td className="px-2 py-2 text-text-secondary">{row.role}</td>
                                        <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                                            {row.daysSince === 0
                                                ? 'today'
                                                : row.daysSince === 1
                                                  ? 'yesterday'
                                                  : `${fmtInt(row.daysSince)} d ago`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            {domainBreakdown.length > 0 && (
                <Panel title="Email domain mix" innerClassName="p-3">
                    <div className="flex flex-col gap-1.5">
                        {domainBreakdown.slice(0, 8).map((row) => {
                            const max = domainBreakdown[0].count
                            const pct = max > 0 ? (row.count / max) * 100 : 0
                            return (
                                <div key={row.label} className="flex items-center gap-2 text-[12px]">
                                    <span className="flex-1 min-w-0 truncate text-text-primary">{row.label}</span>
                                    <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary w-32">
                                        <div className="h-full" style={{ background: accent, width: `${pct}%` }} />
                                    </div>
                                    <span className="font-mono tabular-nums font-semibold w-12 text-right shrink-0 text-text-primary">
                                        {fmtInt(row.count)}
                                    </span>
                                    <span className="font-mono tabular-nums w-12 text-right shrink-0 text-text-tertiary">
                                        {totalManagers > 0 ? `${Math.round((row.count / totalManagers) * 100)}%` : '—'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    {domainBreakdown.length > 8 && (
                        <div className="mt-2 text-[11px] text-text-tertiary">
                            {`+ ${domainBreakdown.length - 8} more domain${domainBreakdown.length - 8 === 1 ? '' : 's'}`}
                        </div>
                    )}
                </Panel>
            )}
        </div>
    )
}
