import React, { useMemo } from 'react'

import { fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { formatCentralDate } from '../../../../../utils/PlanUtility'
import { DEFAULT_ACCENT_COLOR } from '../../../../constants/themeConstants'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { CategoricalBarChart } from '../AssetStatisticsCharts'
import { AssetWatchlistTable } from '../AssetStatisticsTables'

const SERVICE_BUCKETS = [
    { label: '0–30d', max: 30 },
    { label: '31–60d', max: 60 },
    { label: '61–90d', max: 90 },
    { label: '91–180d', max: 180 },
    { label: '181–365d', max: 365 },
    { label: '> 1 year', max: Infinity }
]

/** Bucket items by days since their last service date. Bins are narrow at
 *  the front, where a healthy fleet clusters, and widen past the 180-day
 *  past-due mark so the overdue tail stays readable. Items with no or an
 *  unparseable service date collect in a "No record" bucket, appended after
 *  the ordered bins and only when something falls into it. */
const buildServiceBuckets = (items) => {
    const counts = SERVICE_BUCKETS.map(({ label }) => ({ count: 0, label }))
    let unknown = 0
    items.forEach((item) => {
        const ts = item.lastServiceDate
        if (!ts) {
            unknown += 1
            return
        }
        const days = Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24))
        if (!Number.isFinite(days)) {
            unknown += 1
            return
        }
        const idx = SERVICE_BUCKETS.findIndex((bucket) => days <= bucket.max)
        const target = idx === -1 ? counts.length - 1 : idx
        counts[target].count += 1
    })
    if (unknown > 0) counts.push({ count: unknown, label: 'No Record' })
    return counts
}

const formatServiceDate = (iso) => {
    if (!iso) return 'Never recorded'
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return 'Invalid'
    return formatCentralDate(date)
}

/**
 * Service Health — the past-due count, the days-since-service distribution,
 * and the longest-overdue watchlist carrying each asset's actual last
 * service date, so the worst truck can be booked first. Offered only for
 * asset types the summary marks as service-tracking; mixers additionally get
 * a chip-overdue tile.
 *
 * An asset with a blank `lastServiceDate` is never past due — overdue is
 * measured from a recorded date, so a truck that has never been serviced
 * shows up in "No service on record" and nowhere else.
 */
export function AssetStatisticsServicePage({ accentColor, onSelectAsset, stats }) {
    const accent = accentColor || DEFAULT_ACCENT_COLOR
    const { overdueServiceList, scopedItems, summary } = stats
    const operationalItems = useMemo(
        () => scopedItems.filter((item) => !['Retired', 'Terminated'].includes(item.status)),
        [scopedItems]
    )

    const serviceBuckets = useMemo(() => buildServiceBuckets(operationalItems), [operationalItems])
    const overdueRate = summary.total > 0 ? (summary.overdueService / summary.total) * 100 : 0

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={summary.hasChip ? 5 : 4}>
                <Stat
                    label="Past-due service"
                    value={fmtInt(summary.overdueService)}
                    hint={`${fmtPct(overdueRate)} of fleet`}
                />
                <Stat
                    label="No service on record"
                    value={fmtInt(operationalItems.filter((item) => !item.lastServiceDate).length)}
                    hint="lastServiceDate blank"
                />
                <Stat
                    label="Within last 30d"
                    value={fmtInt(serviceBuckets.find((b) => b.label === '0–30d')?.count || 0)}
                    hint="recently serviced"
                />
                <Stat
                    label="61-180d"
                    value={fmtInt(
                        (serviceBuckets.find((b) => b.label === '61–90d')?.count || 0) +
                            (serviceBuckets.find((b) => b.label === '91–180d')?.count || 0)
                    )}
                    hint="needs scheduling soon"
                />
                {summary.hasChip && (
                    <Stat label="Chips overdue" value={fmtInt(summary.overdueChip)} hint=">90d since last chip" />
                )}
            </StatGroup>

            <Panel title="Days Since Last Service" innerClassName="p-3">
                <CategoricalBarChart accent={accent} data={serviceBuckets} height={220} />
                <div className="mt-2 text-[11px] text-text-tertiary">
                    Past-due threshold is <span className="font-semibold">180 days</span> for every asset type.
                </div>
            </Panel>

            <Panel
                title="Longest Overdue"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${overdueServiceList.length}`}</span>}
            >
                <AssetWatchlistTable
                    headerLabel="Last serviced"
                    onSelect={onSelectAsset}
                    rows={overdueServiceList}
                    valueAccessor={(row) => row.daysSinceService}
                    valueFormatter={(value, row) => {
                        const base =
                            value == null
                                ? formatServiceDate(row.lastServiceDate)
                                : `${formatServiceDate(row.lastServiceDate)} · ${fmtInt(value)}d ago`
                        return Number.isFinite(row.hours) && row.hours > 0
                            ? `${base} · ${fmtInt(Math.round(row.hours))}h`
                            : base
                    }}
                />
            </Panel>
        </div>
    )
}

export default AssetStatisticsServicePage
