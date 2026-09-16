import React from 'react'

import { fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { AssetStatsEmpty } from '../AssetStatisticsCharts'
import { AssetWatchlistTable } from '../AssetStatisticsTables'

/**
 * Operator Coverage — offered only for asset types whose config declares
 * `hasOperatorAssignment`. Splits the active fleet into assigned and
 * unassigned, then lists the assets with no operator beside the operators
 * with no asset so dispatch can pair them.
 *
 * Coverage is measured against Active assets alone: a spare or in-shop asset
 * without an operator is expected, not a gap.
 */
export function AssetStatisticsOperatorsPage({ onSelectAsset, stats }) {
    const { operatorCoverage } = stats

    if (!operatorCoverage) {
        return <AssetStatsEmpty icon="fa-circle-info" message="This asset type does not track operator assignments." />
    }

    const {
        activeAssets,
        activeOperators,
        assignedAssets,
        benchedList,
        benchedOperators,
        unassignedAssetList,
        unassignedAssets
    } = operatorCoverage
    const coverageRate = activeAssets > 0 ? (assignedAssets / activeAssets) * 100 : 0

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Coverage"
                    value={fmtPct(coverageRate)}
                    hint={`${fmtInt(assignedAssets)} of ${fmtInt(activeAssets)} active`}
                />
                <Stat label="Unassigned active" value={fmtInt(unassignedAssets)} hint="active asset, no operator" />
                <Stat label="Active operators" value={fmtInt(activeOperators)} hint="in scope" />
                <Stat label="On the bench" value={fmtInt(benchedOperators)} hint="active operator, no asset" />
            </StatGroup>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel
                    title="Active Assets Without an Operator"
                    innerClassName="p-0"
                    right={
                        <span className="text-[11px] text-text-tertiary">{`Showing ${unassignedAssetList.length}`}</span>
                    }
                >
                    <AssetWatchlistTable
                        headerLabel="Plant"
                        onSelect={onSelectAsset}
                        rows={unassignedAssetList}
                        valueAccessor={(row) => row.plant}
                        valueFormatter={(value) => value}
                    />
                </Panel>
                <Panel
                    title="Operators on the Bench"
                    innerClassName="p-0"
                    right={<span className="text-[11px] text-text-tertiary">{`Showing ${benchedList.length}`}</span>}
                >
                    {benchedList.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            Every active operator has an assigned asset.
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
                                            Operator
                                        </th>
                                        <th
                                            scope="col"
                                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                        >
                                            Plant
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {benchedList.map((op) => (
                                        <tr key={op.id} className="border-t border-border-light">
                                            <td className="px-3 py-2 font-semibold text-text-primary">{op.name}</td>
                                            <td className="px-3 py-2 font-mono tabular-nums text-text-secondary">
                                                {op.plant}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    )
}

export default AssetStatisticsOperatorsPage
