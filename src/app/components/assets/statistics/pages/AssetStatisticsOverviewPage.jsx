/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { DEFAULT_ACCENT_COLOR } from '../../../../constants/themeConstants'
import { Panel } from '../../../ui/Panel'

/** Tile carrying one teaser metric for a sub-page; clicking it switches the
 *  view to `section`. */
function LaunchpadTile({ hint, label, onSelect, section, value }) {
    return (
        <button
            type="button"
            onClick={() => onSelect?.(section)}
            className="group flex flex-col gap-1 items-start rounded-card border border-border-light bg-bg-primary cursor-pointer px-4 py-3 text-left transition-colors duration-150 ease-out hover:border-border-medium hover:bg-bg-hover motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <span className="text-[12px] text-text-secondary">{label}</span>
            <span className="font-heading text-[24px] font-semibold leading-tight tabular-nums text-text-primary">
                {value}
            </span>
            {hint && <span className="text-[12px] text-text-tertiary">{hint}</span>}
            <span className="mt-1 text-[12px] font-medium text-text-secondary group-hover:text-text-primary">
                Open →
            </span>
        </button>
    )
}

/** One fact in the snapshot: the label in a fixed column, the value and its
 *  context beside it. */
function HighlightRow({ hint, label, value }) {
    return (
        <div className="grid grid-cols-[160px_minmax(0,1fr)] items-baseline gap-4 px-4 py-2.5 border-t border-border-light first:border-t-0">
            <div className="text-[13px] text-text-secondary">{label}</div>
            <div className="min-w-0">
                <span className="text-[14px] font-medium text-text-primary">{value}</span>
                {hint && <span className="ml-2 text-[12px] text-text-tertiary">{hint}</span>}
            </div>
        </div>
    )
}

/**
 * Overview — the fleet snapshot, the two plant-health cards, and a tile per
 * deep-dive sub-page.
 *
 * Every figure comes from the same `summary` and `perPlant` the sub-pages
 * read, so nothing here can disagree with the page it links to. Rows and
 * tiles are gated by the same config flags and summary flags that decide
 * which sections the sidebar offers, keeping the launchpad in step with the
 * menu.
 */
export function AssetStatisticsOverviewPage({ accentColor, config, onSelectSection, stats }) {
    const { perPlant, summary } = stats
    const accent = accentColor || DEFAULT_ACCENT_COLOR

    // Plant health is a deliberately blunt score — verified rate minus shop
    // rate minus overdue rate, all unweighted rates of the plant's own fleet
    // so a small plant is not punished for its size. It exists only to order
    // the two cards below; nothing downstream treats it as a metric. With
    // three plants or fewer the same plant can head both cards.
    const plantHealth = perPlant
        .map((row) => {
            const verifiedRate = row.total > 0 ? row.verified / row.total : 0
            const shopRate = row.total > 0 ? row.shop / row.total : 0
            const overdueRate = row.total > 0 ? row.overdueService / row.total : 0
            const score = verifiedRate - shopRate - overdueRate
            return { ...row, overdueRate, score, shopRate, verifiedRate }
        })
        .sort((a, b) => b.score - a.score)

    const healthiest = plantHealth.slice(0, 3)
    const needsAttention = [...plantHealth].sort((a, b) => a.score - b.score).slice(0, 3)

    const shopHint = summary.shopCount > 0 ? `${fmtInt(summary.shopCount)} in shop` : 'no shop entries'

    return (
        <div className="flex flex-col gap-4">
            <Panel title="Fleet Snapshot" innerClassName="p-0">
                <HighlightRow
                    icon="fa-clipboard-check"
                    label="Operational fleet"
                    value={`${fmtInt(summary.total)} assets`}
                    hint={`${fmtInt(summary.activeCount)} active · ${fmtInt(summary.spareCount)} spare · ${shopHint}`}
                />
                {config?.hasVerification && (
                    <HighlightRow
                        icon="fa-clipboard-check"
                        label="Verified"
                        value={summary.total > 0 ? `${fmtPct((summary.verifiedRate || 0) * 100)}` : '—'}
                        hint={`${fmtInt(summary.unverified)} unverified · ${fmtInt(summary.assetsMissingAnyField)} missing data`}
                    />
                )}
                {summary.hasService && (
                    <HighlightRow
                        icon="fa-wrench"
                        label="Service health"
                        value={
                            summary.overdueService > 0 ? `${fmtInt(summary.overdueService)} overdue` : 'All caught up'
                        }
                        hint={summary.hasChip ? `${fmtInt(summary.overdueChip)} overdue chips` : 'past-due > 180 days'}
                    />
                )}
                {summary.openIssues > 0 ? (
                    <HighlightRow
                        icon="fa-triangle-exclamation"
                        label="Open issues"
                        value={`${fmtInt(summary.openIssues)} issues`}
                        hint={`across ${fmtInt(summary.assetsWithOpenIssues)} assets`}
                    />
                ) : (
                    <HighlightRow icon="fa-circle-check" label="Open issues" value="None reported" />
                )}
                {summary.hasCleanliness && (
                    <HighlightRow
                        icon="fa-broom"
                        label="Cleanliness"
                        value={summary.cleanlinessAvg != null ? `${fmtFloat(summary.cleanlinessAvg)} Stars avg` : '—'}
                        hint={
                            summary.dirtyCount > 0
                                ? `${fmtInt(summary.dirtyCount)} assets below 3 Stars`
                                : 'no dirty assets'
                        }
                    />
                )}
                {config?.hasOperatorAssignment && (
                    <HighlightRow
                        icon="fa-id-badge"
                        label="Operator coverage"
                        value={
                            summary.unassignedActive > 0
                                ? `${fmtInt(summary.unassignedActive)} unassigned`
                                : 'Fully covered'
                        }
                        hint={`${fmtInt(summary.activeCount)} active assets`}
                    />
                )}
                {stats.hoursStats?.hasHours && (
                    <HighlightRow
                        icon="fa-gauge"
                        label="Fleet hours"
                        value={
                            stats.hoursStats.avgHours != null
                                ? `${fmtInt(Math.round(stats.hoursStats.avgHours))}h avg`
                                : '—'
                        }
                        hint={
                            stats.hoursStats.hoursUnrecorded > 0
                                ? `${fmtInt(stats.hoursStats.hoursRecorded)} reporting · ${fmtInt(stats.hoursStats.hoursUnrecorded)} missing`
                                : `${fmtInt(stats.hoursStats.hoursRecorded)} reporting · all caught up`
                        }
                    />
                )}
                <HighlightRow
                    icon="fa-clock-rotate-left"
                    label="Avg status tenure"
                    value={summary.avgStatusTenure != null ? `${fmtInt(summary.avgStatusTenure)} days` : '—'}
                    hint={summary.avgFleetYear ? `model year ${summary.avgFleetYear}` : 'no year data'}
                />
            </Panel>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel title="Plants That Need Attention" innerClassName="p-0">
                    {needsAttention.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">No plants in scope.</div>
                    ) : (
                        <div className="flex flex-col">
                            {needsAttention.map((plant) => (
                                <div
                                    key={plant.code}
                                    className="flex items-center gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0"
                                >
                                    <span
                                        className="inline-block w-2 h-2 rounded-full shrink-0"
                                        style={{ background: accent }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono tabular-nums font-semibold text-text-primary">
                                            {plant.code} {plant.name !== plant.code && `· ${plant.name}`}
                                        </div>
                                        <div className="text-[11px] text-text-tertiary">
                                            {fmtInt(plant.total)} fleet
                                            {config?.hasVerification &&
                                                ` · ${fmtPct(plant.verifiedRate * 100)} verified`}
                                            {plant.overdueService > 0 && ` · ${fmtInt(plant.overdueService)} overdue`}
                                            {plant.shop > 0 && ` · ${fmtInt(plant.shop)} shop`}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onSelectSection?.('plants')}
                                        className="text-[11px] font-semibold bg-transparent border-none cursor-pointer text-text-primary transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    >
                                        View <i className="fas fa-arrow-right" aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
                <Panel title="Healthiest Plants" innerClassName="p-0">
                    {healthiest.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">No plants in scope.</div>
                    ) : (
                        <div className="flex flex-col">
                            {healthiest.map((plant) => (
                                <div
                                    key={plant.code}
                                    className="flex items-center gap-3 px-3 py-2.5 border-t border-border-light first:border-t-0"
                                >
                                    <span
                                        className="inline-block w-2 h-2 rounded-full shrink-0"
                                        style={{ background: 'var(--status-active)' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono tabular-nums font-semibold text-text-primary">
                                            {plant.code} {plant.name !== plant.code && `· ${plant.name}`}
                                        </div>
                                        <div className="text-[11px] text-text-tertiary">
                                            {fmtInt(plant.total)} fleet
                                            {config?.hasVerification &&
                                                ` · ${fmtPct(plant.verifiedRate * 100)} verified`}
                                            {plant.overdueService === 0 &&
                                                summary.hasService &&
                                                ' · all service current'}
                                            {!summary.hasService && plant.shop === 0 && ' · no shop entries'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>

            <Panel title="Jump Into Details" innerClassName="p-3">
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    <LaunchpadTile
                        icon="fa-circle-half-stroke"
                        label="Fleet Status"
                        section="fleetStatus"
                        value={fmtInt(summary.shopCount)}
                        hint={`${fmtInt(summary.shopCount)} in shop · ${fmtInt(summary.spareCount)} spare`}
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        icon="fa-industry"
                        label="Plant Distribution"
                        section="plants"
                        value={fmtInt(perPlant.length)}
                        hint={`${fmtInt(perPlant.length)} plants with fleet`}
                        onSelect={onSelectSection}
                    />
                    {summary.hasService && (
                        <LaunchpadTile
                            icon="fa-wrench"
                            label="Service Health"
                            section="service"
                            value={fmtInt(summary.overdueService)}
                            hint={`${fmtInt(summary.overdueService)} past-due assets`}
                            onSelect={onSelectSection}
                        />
                    )}
                    <LaunchpadTile
                        icon="fa-screwdriver-wrench"
                        label="Shop Performance"
                        section="shopPerformance"
                        value={fmtInt(stats.shopPerformance.totalInShop)}
                        hint={
                            stats.shopPerformance.stuckCount > 0
                                ? `${fmtInt(stats.shopPerformance.stuckCount)} stuck > ${stats.shopPerformance.stuckThreshold}d`
                                : 'shop queue snapshot'
                        }
                        onSelect={onSelectSection}
                    />
                    {stats.hoursStats?.hasHours && (
                        <LaunchpadTile
                            icon="fa-gauge"
                            label="Hours & Utilization"
                            section="hours"
                            value={
                                stats.hoursStats.avgHours != null
                                    ? `${fmtInt(Math.round(stats.hoursStats.avgHours))}h`
                                    : '—'
                            }
                            hint={
                                stats.hoursStats.hoursRecorded > 0
                                    ? `${fmtInt(stats.hoursStats.hoursRecorded)} reporting · ${fmtInt(stats.hoursStats.hoursUnrecorded)} missing`
                                    : 'no hours recorded'
                            }
                            onSelect={onSelectSection}
                        />
                    )}
                    {config?.hasVerification && (
                        <LaunchpadTile
                            icon="fa-clipboard-check"
                            label="Verification & Data"
                            section="verification"
                            value={fmtPct((summary.verifiedRate || 0) * 100)}
                            hint={`${fmtInt(summary.unverified)} need verifying`}
                            onSelect={onSelectSection}
                        />
                    )}
                    {summary.hasCleanliness && (
                        <LaunchpadTile
                            icon="fa-broom"
                            label="Cleanliness"
                            section="cleanliness"
                            value={summary.cleanlinessAvg != null ? `${fmtFloat(summary.cleanlinessAvg)} Stars` : '—'}
                            hint={`${fmtInt(summary.dirtyCount)} below 3 Stars`}
                            onSelect={onSelectSection}
                        />
                    )}
                    {config?.hasOperatorAssignment && (
                        <LaunchpadTile
                            icon="fa-id-badge"
                            label="Operator Coverage"
                            section="operators"
                            value={fmtInt(summary.unassignedActive)}
                            hint={`${fmtInt(summary.unassignedActive)} active w/o op`}
                            onSelect={onSelectSection}
                        />
                    )}
                    <LaunchpadTile
                        icon="fa-triangle-exclamation"
                        label="Issues"
                        section="issues"
                        value={fmtInt(summary.openIssues)}
                        hint={`${fmtInt(summary.assetsWithOpenIssues)} assets affected`}
                        onSelect={onSelectSection}
                    />
                    <LaunchpadTile
                        icon="fa-clock-rotate-left"
                        label="Fleet Aging"
                        section="aging"
                        value={summary.avgFleetYear || '—'}
                        hint="model year distribution"
                        onSelect={onSelectSection}
                    />
                </div>
            </Panel>
        </div>
    )
}

export default AssetStatisticsOverviewPage
