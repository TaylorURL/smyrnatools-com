import React from 'react'

import { starLabel } from '../../../../../utils/PersonStatsUtility'
import { fmtFloat, fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { DEFAULT_ACCENT_COLOR } from '../../../../constants/themeConstants'
import StarRating from '../../../common/StarRating'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { CategoricalBarChart } from '../AssetStatisticsCharts'
import { AssetWatchlistTable, CleanlinessPlantList } from '../AssetStatisticsTables'

function StarStrip({ rating }) {
    return <StarRating value={rating} tone="warning" size="sm" />
}

/**
 * Cleanliness — the 1–5 rating distribution, the per-plant rollup, and the
 * dirty watchlist.
 *
 * The section is offered only while at least one in-scope asset carries a
 * rating, so it disappears for asset types that never record one and for
 * scopes where nothing has been rated yet. Ratings are sparse even where
 * they apply, which is why "not yet rated" gets its own tile rather than
 * being folded into the average.
 */
export function AssetStatisticsCleanlinessPage({ accentColor, onSelectAsset, stats }) {
    const accent = accentColor || DEFAULT_ACCENT_COLOR
    const { cleanlinessByPlant, cleanlinessDistribution, dirtyAssets, summary } = stats

    const distribution = cleanlinessDistribution.map((row) => ({
        count: row.count,
        label: starLabel(row.rating),
        rating: row.rating
    }))
    const dirtyRatePct = summary.total > 0 ? (summary.dirtyCount / summary.total) * 100 : 0

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Avg rating"
                    value={summary.cleanlinessAvg != null ? `${fmtFloat(summary.cleanlinessAvg)} Stars` : '—'}
                    hint={`across ${fmtInt(summary.cleanlinessSamples)} rated assets`}
                />
                <Stat
                    label="Dirty assets"
                    value={fmtInt(summary.dirtyCount)}
                    hint={`${fmtPct(dirtyRatePct)} of fleet`}
                />
                <Stat
                    label="Not yet rated"
                    value={fmtInt(summary.total - summary.cleanlinessSamples)}
                    hint="no cleanliness signal"
                />
                <Stat label="Plants rated" value={fmtInt(cleanlinessByPlant.length)} hint="have at least one rating" />
            </StatGroup>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel title="Cleanliness Distribution" innerClassName="p-3">
                    <CategoricalBarChart accent={accent} data={distribution} height={220} />
                    <div className="mt-2 text-[11px] text-text-tertiary">Below 3 Stars counts as dirty.</div>
                </Panel>
                <Panel title="Average Rating by Plant" innerClassName="p-3">
                    <CleanlinessPlantList accent={accent} rows={cleanlinessByPlant} />
                </Panel>
            </div>

            <Panel
                title="Dirty Fleet"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${dirtyAssets.length}`}</span>}
            >
                <AssetWatchlistTable
                    headerLabel="Rating"
                    onSelect={onSelectAsset}
                    rows={dirtyAssets}
                    valueAccessor={(row) => row.rating}
                    valueFormatter={(value) => <StarStrip rating={value} />}
                />
            </Panel>
        </div>
    )
}

export default AssetStatisticsCleanlinessPage
