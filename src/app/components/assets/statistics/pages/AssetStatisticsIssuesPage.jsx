import React, { useMemo } from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { AssetWatchlistTable } from '../AssetStatisticsTables'

/**
 * Issues — open issues counted per asset and rolled up per plant. Every
 * figure reads the `openIssuesCount` that `useAssetData` attaches to each
 * item after the list loads, so the page never fetches issues itself and
 * shows nothing until those counts land.
 */
export function AssetStatisticsIssuesPage({ onSelectAsset, stats }) {
    const { perPlant, summary, topIssueAssets } = stats

    const plantsWithIssues = useMemo(
        () => perPlant.filter((row) => row.openIssues > 0).sort((a, b) => b.openIssues - a.openIssues),
        [perPlant]
    )
    const avgIssuesPerAsset = summary.assetsWithOpenIssues > 0 ? summary.openIssues / summary.assetsWithOpenIssues : 0

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat label="Open issues" value={fmtInt(summary.openIssues)} hint="across all in-scope assets" />
                <Stat
                    label="Assets affected"
                    value={fmtInt(summary.assetsWithOpenIssues)}
                    hint={`${fmtInt(summary.total - summary.assetsWithOpenIssues)} clean`}
                />
                <Stat
                    label="Avg per affected"
                    value={avgIssuesPerAsset > 0 ? avgIssuesPerAsset.toFixed(1) : '—'}
                    hint="issues per impacted asset"
                />
                <Stat
                    label="Plants with issues"
                    value={fmtInt(plantsWithIssues.length)}
                    hint={`${fmtInt(perPlant.length)} total in scope`}
                />
            </StatGroup>

            <Panel
                title="Assets With the Most Open Issues"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${topIssueAssets.length}`}</span>}
            >
                <AssetWatchlistTable
                    headerLabel="Open issues"
                    onSelect={onSelectAsset}
                    rows={topIssueAssets}
                    valueAccessor={(row) => row.openIssues}
                    valueFormatter={(value) => fmtInt(value)}
                />
            </Panel>

            <Panel
                title="Issues by Plant"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${plantsWithIssues.length}`}</span>}
            >
                {plantsWithIssues.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">
                        No open issues on any plant in scope.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th
                                        scope="col"
                                        className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                    >
                                        Plant
                                    </th>
                                    <th
                                        scope="col"
                                        className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                    >
                                        Open Issues
                                    </th>
                                    <th
                                        scope="col"
                                        className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                    >
                                        Fleet
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {plantsWithIssues.map((row) => (
                                    <tr key={row.code} className="border-t border-border-light">
                                        <td className="px-3 py-2">
                                            <span className="font-mono tabular-nums font-semibold text-text-primary">
                                                {row.code}
                                            </span>
                                            {row.name !== row.code && (
                                                <span className="ml-2 text-text-secondary">{row.name}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                            {fmtInt(row.openIssues)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                                            {fmtInt(row.total)}
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

export default AssetStatisticsIssuesPage
