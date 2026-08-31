/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtInt, fmtPct } from '../../../../../utils/PlanStatisticsFormatUtility'
import { DEFAULT_ACCENT_COLOR } from '../../../../constants/themeConstants'
import { itemDisplayId } from '../../../../hooks/useAssetStatistics'
import { Panel, Stat, StatGroup } from '../../../ui/Panel'
import { AssetWatchlistTable } from '../AssetStatisticsTables'

const displayStatus = (item) => {
    const status = String(item.status || 'Unknown')
    if (status !== 'In Shop') return status
    const map = {
        down_in_yard: 'Down In Yard',
        in_shop: 'In Shop',
        ready_for_pickup: 'Ready For Pickup',
        third_party: 'Third Party Work',
        waiting_for_shop: 'Waiting For Shop'
    }
    return map[item.shopStatus] || 'In Shop'
}

/** Whole days since the asset was last touched — its verification stamp
 *  (`updatedLast`) if it has ever been verified, otherwise the last edit.
 *  Returns null when neither timestamp is usable, which the watchlist
 *  renders as "Never". */
const daysSinceVerifiedSignal = (item) => {
    const ts = item.updatedLast || item.updatedAt
    if (!ts) return null
    const time = new Date(ts).getTime()
    if (!Number.isFinite(time)) return null
    return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)))
}

/**
 * Verification & Data Quality — two adjacent questions on one page: is the
 * fleet being verified each week, and is its identification data (VIN, make,
 * model, year) actually filled in?
 *
 * Verification runs on a weekly cycle that resets Monday at 5 PM Central, so
 * an asset counts as verified only while its verification stamp is newer
 * than the last reset and no edit has landed since. Every asset falls out of
 * verification once a week by design; a high unverified count early in the
 * week is the normal state, not a backlog.
 *
 * Both watchlists build from `scopedItems`, which is the plant and
 * time-range scope before the operational filter, so each drops retired and
 * terminated assets itself to keep out records nobody is expected to verify.
 */
export function AssetStatisticsVerificationPage({ accentColor, config, onSelectAsset, stats }) {
    const accent = accentColor || DEFAULT_ACCENT_COLOR
    const { operatorNames, scopedItems, summary } = stats

    // Assets currently failing the weekly check, longest-untouched first.
    // Rows with no usable timestamp sort ahead of everything else, putting
    // the records that have never been verified or edited at the very top.
    const unverifiedAssets = useMemo(() => {
        const enriched = scopedItems
            .filter((item) => !['Retired', 'Terminated'].includes(item.status))
            .filter((item) => !(typeof item.isVerified === 'function' && item.isVerified()))
            .map((item) => ({
                days: daysSinceVerifiedSignal(item),
                id: item.id,
                identifier: itemDisplayId(item, config),
                operatorName: operatorNames.get(item.assignedOperator) || null,
                plant: item.assignedPlant || '—',
                status: displayStatus(item)
            }))
        enriched.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
        return enriched.slice(0, 20)
    }, [config, operatorNames, scopedItems])

    // Assets with at least one identification field blank, worst first. VIN
    // is read from either `vinNumber` or `vin` because asset types disagree
    // on which column carries it.
    const missingDataAssets = useMemo(() => {
        const enriched = scopedItems
            .filter((item) => !['Retired', 'Terminated'].includes(item.status))
            .map((item) => {
                const missing = []
                const vin = item.vinNumber || item.vin
                if (!vin) missing.push('VIN')
                if (!item.make) missing.push('Make')
                if (!item.model) missing.push('Model')
                if (!item.year) missing.push('Year')
                return {
                    id: item.id,
                    identifier: itemDisplayId(item, config),
                    missing,
                    operatorName: operatorNames.get(item.assignedOperator) || null,
                    plant: item.assignedPlant || '—',
                    status: displayStatus(item)
                }
            })
            .filter((row) => row.missing.length > 0)
        enriched.sort((a, b) => b.missing.length - a.missing.length)
        return enriched.slice(0, 20)
    }, [config, operatorNames, scopedItems])

    const verifiedRatePct = summary.total > 0 ? (summary.verifiedRate || 0) * 100 : 0
    const completeRatePct =
        summary.total > 0 ? ((summary.total - summary.assetsMissingAnyField) / summary.total) * 100 : 0

    return (
        <div className="flex flex-col gap-4">
            <StatGroup columns={4}>
                <Stat
                    label="Verified"
                    value={fmtPct(verifiedRatePct)}
                    hint={`${fmtInt(summary.verified)} of ${fmtInt(summary.total)}`}
                />
                <Stat label="Unverified" value={fmtInt(summary.unverified)} hint="not checked this week" />
                <Stat
                    label="Data complete"
                    value={fmtPct(completeRatePct)}
                    hint={`${fmtInt(summary.assetsMissingAnyField)} assets missing fields`}
                />
                <Stat
                    label="Fields blank"
                    value={fmtInt(
                        summary.missingVin + summary.missingMake + summary.missingModel + summary.missingYear
                    )}
                    hint="VIN + Make + Model + Year"
                />
            </StatGroup>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Panel title="Missing VIN" innerClassName="p-3">
                    <div className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 24 }}>
                        {fmtInt(summary.missingVin)}
                    </div>
                    <div className="text-[11px] text-text-tertiary">asset records without a VIN</div>
                </Panel>
                <Panel title="Missing Make" innerClassName="p-3">
                    <div className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 24 }}>
                        {fmtInt(summary.missingMake)}
                    </div>
                    <div className="text-[11px] text-text-tertiary">manufacturer blank</div>
                </Panel>
                <Panel title="Missing Model" innerClassName="p-3">
                    <div className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 24 }}>
                        {fmtInt(summary.missingModel)}
                    </div>
                    <div className="text-[11px] text-text-tertiary">model name blank</div>
                </Panel>
                <Panel title="Missing Year" innerClassName="p-3">
                    <div className="font-mono tabular-nums font-bold text-text-primary" style={{ fontSize: 24 }}>
                        {fmtInt(summary.missingYear)}
                    </div>
                    <div className="text-[11px] text-text-tertiary">model year blank</div>
                </Panel>
            </div>

            <Panel
                title="Unverified Assets"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${unverifiedAssets.length}`}</span>}
            >
                <AssetWatchlistTable
                    accent={accent}
                    headerLabel="Days since edit"
                    onSelect={onSelectAsset}
                    rows={unverifiedAssets}
                    valueAccessor={(row) => row.days}
                    valueFormatter={(value) => (value == null ? 'Never' : `${fmtInt(value)}d`)}
                />
            </Panel>

            <Panel
                title="Assets Missing Identification Fields"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`Showing ${missingDataAssets.length}`}</span>}
            >
                <AssetWatchlistTable
                    accent={accent}
                    headerLabel="Fields missing"
                    onSelect={onSelectAsset}
                    rows={missingDataAssets}
                    valueAccessor={(row) => row.missing.length}
                    valueFormatter={(_value, row) => row.missing.join(', ')}
                />
            </Panel>
        </div>
    )
}

export default AssetStatisticsVerificationPage
