import React, { useMemo } from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { DEFAULT_ACCENT_COLOR } from '../../../../constants/themeConstants'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { CategoricalBarChart } from '../AssetStatisticsCharts'
import { AssetWatchlistTable } from '../AssetStatisticsTables'

/**
 * Fleet Aging — model year distribution plus the oldest assets still in
 * operation, so replacement rounds can be planned against real age.
 *
 * Age is derived from the model year against the current calendar year, not
 * from a purchase or in-service date; assets with no year land in the
 * histogram's "Unknown" bucket and are left out of the oldest-assets list
 * entirely. The watchlist appends hours per row only where an hours reading
 * exists, so it stays useful for asset types that never record them.
 */
export function AssetStatisticsAgingPage({ accentColor, onSelectAsset, stats }) {
    const accent = accentColor || DEFAULT_ACCENT_COLOR
    const { ageDistribution, oldestAssets, summary } = stats
    const currentYear = new Date().getFullYear()

    const histogram = useMemo(
        () => ageDistribution.map((row) => ({ count: row.count, label: row.label })),
        [ageDistribution]
    )
    // These roll the histogram's 2-year bins up into the two headline tiles
    // by matching bucket labels, so they track `AGE_BUCKET_ORDER` verbatim —
    // a relabelled bucket silently reads as zero here.
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
                <Stat label="Newer fleet" value={fmtInt(newFleetCount)} hint="≤ 5yr old" />
                <Stat label="Aging fleet" value={fmtInt(oldFleetCount)} hint="> 15yr old" />
                <Stat
                    label="Avg hours"
                    value={summary.avgHours != null ? fmtInt(Math.round(summary.avgHours)) : '—'}
                    hint="across recorded assets"
                />
            </StatGroup>

            <Panel title="Model Year Distribution" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={histogram} height={240} />
                <div className="mt-2 text-[11px] text-text-tertiary">
                    Buckets reflect age vs. {currentYear}. Assets without a recorded year roll into the
                    &quot;Unknown&quot; bucket.
                </div>
            </Panel>

            <Panel
                title="Oldest Assets in Operation"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${oldestAssets.length}`}</span>}
            >
                <AssetWatchlistTable
                    accent={accent}
                    headerLabel="Year · Hours"
                    onSelect={onSelectAsset}
                    rows={oldestAssets}
                    valueAccessor={(row) => row.year}
                    valueFormatter={(value, row) =>
                        row.hours != null && row.hours > 0 ? `${value} · ${fmtInt(Math.round(row.hours))}h` : `${value}`
                    }
                />
            </Panel>
        </div>
    )
}

export default AssetStatisticsAgingPage
