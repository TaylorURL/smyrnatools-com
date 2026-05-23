import React, { useMemo } from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { CategoricalBarChart } from '../AssetStatisticsCharts'
import { AssetWatchlistTable } from '../AssetStatisticsTables'

/**
 * Fleet Aging — model year distribution + the oldest assets still in
 * operation. Helps the fleet manager decide which trucks to roll into the
 * next round of replacements. Hours / mileage column lights up when the
 * asset type tracks it.
 */
export function AssetStatisticsAgingPage({ accentColor, onSelectAsset, stats }) {
    const accent = accentColor || '#1e3a5f'
    const { ageDistribution, oldestAssets, summary } = stats
    const currentYear = new Date().getFullYear()

    const histogram = useMemo(
        () => ageDistribution.map((row) => ({ count: row.count, label: row.label })),
        [ageDistribution]
    )
    const oldFleetCount =
        (ageDistribution.find((r) => r.label === '16–20 yr')?.count || 0) +
        (ageDistribution.find((r) => r.label === '> 20 yr')?.count || 0)
    const newFleetCount =
        (ageDistribution.find((r) => r.label === '0–2 yr')?.count || 0) +
        (ageDistribution.find((r) => r.label === '3–5 yr')?.count || 0)

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Avg model year"
                    value={summary.avgFleetYear || '—'}
                    hint={summary.avgFleetYear ? `${currentYear - summary.avgFleetYear}yr avg age` : 'no year data'}
                />
                <Stat label="Newer fleet" value={fmtInt(newFleetCount)} hint="≤ 5yr old" valueColor="#15803d" />
                <Stat
                    label="Aging fleet"
                    value={fmtInt(oldFleetCount)}
                    hint="> 15yr old"
                    valueColor={oldFleetCount > 0 ? '#b45309' : undefined}
                />
                <Stat
                    label="Avg hours"
                    value={summary.avgHours != null ? fmtInt(Math.round(summary.avgHours)) : '—'}
                    hint="across recorded assets"
                />
            </StatGroup>

            <Panel title="Model year distribution" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={histogram} height={240} />
                <div className="mt-2 text-[11px] text-text-tertiary">
                    Buckets reflect age vs. {currentYear}. Assets without a recorded year roll into the
                    &quot;Unknown&quot; bucket.
                </div>
            </Panel>

            <Panel
                title="Oldest assets in operation"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${oldestAssets.length}`}</span>}
            >
                <AssetWatchlistTable
                    accent={accent}
                    headerLabel="Year · Hours"
                    onSelect={onSelectAsset}
                    rows={oldestAssets}
                    valueAccessor={(row) => row.year}
                    valueColor={(value) =>
                        currentYear - value > 20
                            ? '#b91c1c'
                            : currentYear - value > 15
                              ? '#b45309'
                              : 'var(--text-primary)'
                    }
                    valueFormatter={(value, row) =>
                        row.hours != null && row.hours > 0 ? `${value} · ${fmtInt(Math.round(row.hours))}h` : `${value}`
                    }
                />
            </Panel>
        </div>
    )
}

export default AssetStatisticsAgingPage
