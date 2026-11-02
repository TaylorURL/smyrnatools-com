import React from 'react'

import { Stat, StatGroup } from '../ui/Panel'

const KPI_LABELS = ['Fleet', 'Active', 'In shop', 'Spare', 'Allocation', 'Verified', 'Operators', 'Open issues']

/**
 * The dashboard's headline numbers in one ruled strip across the top of the
 * page, eight to a row on a wide screen and four or two as it narrows. The
 * fleet table below breaks the same numbers down by asset type.
 *
 * Renders a skeleton with the same labels while `loading`, so the strip keeps
 * its height and nothing under it moves when the numbers arrive.
 */
export function DashboardAtAGlance({ alertCount, displayStats, loading = false, openIssues }) {
    if (loading) {
        return (
            <StatGroup columns={8} aria-busy="true">
                {KPI_LABELS.map((label) => (
                    <Stat
                        key={label}
                        label={label}
                        value={
                            <span className="inline-block h-7 w-14 rounded-sm bg-bg-tertiary align-middle animate-pulse motion-reduce:animate-none" />
                        }
                    />
                ))}
            </StatGroup>
        )
    }

    const stats = displayStats || {}
    const ops = stats.operators || {}
    const allocation = Math.round(stats.overallAllocationPercent || 0)
    const verified = Math.round(stats.verificationAverage || 0)
    const inShop =
        (stats.mixers?.shop || 0) +
        (stats.tractors?.shop || 0) +
        (stats.trailers?.shop || 0) +
        (stats.equipment?.shop || 0) +
        (stats.pickups?.shop || 0)
    const spare =
        (stats.mixers?.spare || 0) +
        (stats.tractors?.spare || 0) +
        (stats.trailers?.spare || 0) +
        (stats.equipment?.spare || 0)
    const active =
        (stats.mixers?.active || 0) +
        (stats.tractors?.active || 0) +
        (stats.trailers?.active || 0) +
        (stats.equipment?.active || 0) +
        (stats.pickups?.active || 0)
    const stationary = stats.pickups?.stationary || 0

    return (
        <StatGroup columns={8} className="animate-fade-in-fast motion-reduce:animate-none">
            <Stat label="Fleet" value={(stats.fleetTotal || 0).toLocaleString()} hint="assets" />
            <Stat
                label="Active"
                value={active.toLocaleString()}
                hint={stationary ? `${stationary} stationary` : 'in service'}
            />
            <Stat
                label="In shop"
                value={inShop.toLocaleString()}
                valueColor={inShop > 0 ? 'var(--status-shop)' : undefined}
                hint="out of service"
            />
            <Stat label="Spare" value={spare.toLocaleString()} hint="ready, unassigned" />
            <Stat label="Allocation" value={`${allocation}%`} hint="active of fleet" />
            <Stat
                label="Verified"
                value={`${verified}%`}
                valueColor={verified < 60 ? 'var(--status-warning)' : undefined}
                hint="this week"
            />
            <Stat label="Operators" value={(ops.active || 0).toLocaleString()} hint="active" />
            <Stat
                label="Open issues"
                value={(openIssues || 0).toLocaleString()}
                valueColor={openIssues > 0 ? 'var(--status-danger)' : undefined}
                hint={`${alertCount || 0} alert${alertCount === 1 ? '' : 's'}`}
            />
        </StatGroup>
    )
}
