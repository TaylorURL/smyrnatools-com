import React from 'react'

import { fmtFloat, fmtInt, fmtPct } from '../../../../utils/PlanStatisticsFormatUtility'
import { Stat, StatGroup } from '../../ui/Panel'

/** Headline KPI strip, capped at five tiles. Values come from the same
 *  `summary` the rest of the page reads, so the strip tracks the plant
 *  filter and time range with it.
 *
 *  Which tiles appear depends on the asset type: verification, service,
 *  cleanliness, and operator-coverage tiles are only built when the type
 *  carries that concept, so a trailer or pickup truck sees fewer of them.
 *  Total fleet and open issues are unconditional; shop count and status
 *  tenure only fill slots the optional tiles left free. */
export function AssetStatisticsKpiStrip({ config, summary }) {
    const verifiedValue = summary.total > 0 ? fmtPct((summary.verifiedRate || 0) * 100) : '—'
    const overdueLabel = summary.hasService ? `${fmtInt(summary.overdueService)} past due` : 'service tracking off'
    const issuesLabel = summary.openIssues > 0 ? `${fmtInt(summary.assetsWithOpenIssues)} assets` : 'no open issues'
    const ageHint = summary.avgFleetYear != null ? `model year ${summary.avgFleetYear}` : 'no year data'

    const verificationTile = config?.hasVerification
        ? { hint: 'fleet-wide check', label: 'Verified', value: verifiedValue }
        : null
    const serviceTile = summary.hasService
        ? { hint: overdueLabel, label: 'Service Overdue', value: fmtInt(summary.overdueService) }
        : null
    const issuesTile = { hint: issuesLabel, label: 'Open Issues', value: fmtInt(summary.openIssues) }
    const shopTile = {
        hint: `${fmtInt(summary.shopCount)} in shop`,
        label: 'In Shop',
        value: fmtInt(summary.shopCount)
    }
    const cleanlinessTile = summary.hasCleanliness
        ? {
              hint: summary.dirtyCount > 0 ? `${fmtInt(summary.dirtyCount)} below 3 Stars` : 'no dirty assets',
              label: 'Avg Cleanliness',
              value: summary.cleanlinessAvg != null ? `${fmtFloat(summary.cleanlinessAvg)} Stars` : '—'
          }
        : null
    const operatorTile = config?.hasOperatorAssignment
        ? {
              hint:
                  summary.unassignedActive > 0
                      ? `${fmtInt(summary.unassignedActive)} active w/o operator`
                      : 'fully covered',
              label: 'Unassigned',
              value: fmtInt(summary.unassignedActive)
          }
        : null
    const tenureTile = {
        hint: ageHint,
        label: 'Avg Status Tenure',
        value: summary.avgStatusTenure != null ? `${fmtInt(summary.avgStatusTenure)}d` : '—'
    }

    // Push order is the display order, most actionable first. The trailing
    // filler tiles guard on length so they only claim slots the optional
    // tiles above them did not.
    const tiles = [
        { hint: `${fmtInt(summary.activeCount)} active`, label: 'Total Fleet', value: fmtInt(summary.total) }
    ]
    if (verificationTile) tiles.push(verificationTile)
    if (serviceTile) tiles.push(serviceTile)
    tiles.push(issuesTile)
    if (cleanlinessTile) tiles.push(cleanlinessTile)
    if (operatorTile && tiles.length < 5) tiles.push(operatorTile)
    if (tiles.length < 5) tiles.push(shopTile)
    if (tiles.length < 5) tiles.push(tenureTile)

    return (
        <StatGroup columns={5}>
            {tiles.slice(0, 5).map((tile) => (
                <Stat key={tile.label} hint={tile.hint} label={tile.label} value={tile.value} />
            ))}
        </StatGroup>
    )
}

export default AssetStatisticsKpiStrip
