import React from 'react'

import { Stat, StatGroup } from '../ui/Panel'

/**
 * Top-of-page KPI row using the shared `StatGroup` + `Stat` primitives so
 * the Dashboard reads with the same visual rhythm as the Plan tab.
 *
 * Adapts content based on whether a single plant is selected (YPH /
 * cleanliness / safety) or the broader region/all-plants view (fleet
 * total / allocation / in-shop / operators / verified).
 */
export default function KeyMetricsStrip({ displayStats, plantNotifications, isPlantMode, accentColor }) {
    const stats = displayStats || {}
    const opStats = stats.operators || {}
    const leaderboard = plantNotifications?.leaderboardMetrics

    if (isPlantMode && leaderboard) {
        const cleanliness = leaderboard.avgCleanliness || 0
        const cleanColor = cleanliness >= 4 ? '#16a34a' : cleanliness >= 3 ? '#d97706' : '#dc2626'
        const netHelp = Math.round(leaderboard.netHelp || 0)
        const netHelpColor = netHelp > 0 ? '#16a34a' : netHelp < 0 ? '#dc2626' : undefined
        const safetyIncidents = leaderboard.safetyIncidents || 0
        return (
            <section id="overview" className="scroll-mt-4">
                <StatGroup columns={5}>
                    <Stat label="Raw YPH" value={leaderboard.rawYPH?.toFixed(2) || '--'} />
                    <Stat label="Adjusted YPH" value={leaderboard.adjustedYPH?.toFixed(2) || '--'} />
                    <Stat
                        label="Net Help"
                        value={`${netHelp > 0 ? '+' : ''}${netHelp}h`}
                        valueColor={netHelpColor}
                        hint={netHelp === 0 ? 'No transfers' : netHelp > 0 ? 'Receiving' : 'Sending'}
                    />
                    <Stat label="Cleanliness" value={cleanliness.toFixed(1)} valueColor={cleanColor} hint="0–5 score" />
                    <Stat
                        label="Safety"
                        value={safetyIncidents}
                        valueColor={safetyIncidents === 0 ? '#16a34a' : '#dc2626'}
                        hint={safetyIncidents === 0 ? 'No incidents' : 'Incidents'}
                    />
                </StatGroup>
            </section>
        )
    }

    const allocation = Math.round(stats.overallAllocationPercent || 0)
    const allocationColor = allocation >= 80 ? '#16a34a' : allocation >= 50 ? '#d97706' : '#dc2626'
    const verified = Math.round(stats.verificationAverage || 0)
    const verifiedColor = verified >= 90 ? '#16a34a' : verified >= 70 ? '#d97706' : '#dc2626'
    const inShop =
        (stats.mixers?.shop || 0) +
        (stats.tractors?.shop || 0) +
        (stats.trailers?.shop || 0) +
        (stats.equipment?.shop || 0)
    const critical = plantNotifications?.assetsWithMostIssues?.length || 0

    return (
        <section id="overview" className="scroll-mt-4">
            <StatGroup columns={7}>
                <Stat
                    hint="3 regions · all sites"
                    label="Fleet total"
                    value={(stats.fleetTotal || 0).toLocaleString()}
                />
                <Stat hint="Active vs total" label="Allocation" value={`${allocation}%`} valueColor={allocationColor} />
                <Stat
                    hint={inShop === 0 ? 'None down' : 'Across fleet'}
                    label="In shop"
                    value={inShop}
                    valueColor={inShop > 0 ? '#d97706' : undefined}
                />
                <Stat
                    hint={opStats.unassigned > 0 ? `${opStats.unassigned} idle` : 'All assigned'}
                    label="Operators"
                    value={opStats.active || 0}
                />
                <Stat hint="Inspection compliance" label="Verified" value={`${verified}%`} valueColor={verifiedColor} />
                <Stat
                    hint={critical > 0 ? 'Assets w/ open issues' : 'All clear'}
                    label="Critical"
                    value={critical}
                    valueColor={critical > 0 ? '#dc2626' : undefined}
                />
                <Stat
                    hint={opStats.lightDuty > 0 ? 'Reassigned' : 'Healthy roster'}
                    label="Light duty"
                    value={opStats.lightDuty || 0}
                    valueColor={opStats.lightDuty > 0 ? '#7c3aed' : undefined}
                />
            </StatGroup>
        </section>
    )
}
