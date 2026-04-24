import React from 'react'

/**
 * Hero-style KPI tile used in the dashboard top strip.
 * Larger, bolder, and grid-aligned — reads as "at a glance" above the fold.
 */
function KpiTile({ label, value, icon, color, accentColor, suffix, trend }) {
    const tint = color || accentColor || 'var(--accent)'
    return (
        <div
            className="relative flex items-center gap-3 bg-bg-primary rounded-xl border border-border-light px-4 py-3.5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animation: 'fadeSlideIn 0.3s ease both' }}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
                style={{ background: `linear-gradient(180deg, ${tint} 0%, ${tint}30 100%)` }}
            />
            {icon && (
                <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ring-1 ring-inset"
                    style={{ background: `${tint}14`, boxShadow: `inset 0 0 0 1px ${tint}22` }}
                >
                    <i className={`fas ${icon} text-[15px]`} style={{ color: tint }} />
                </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider truncate">
                    {label}
                </span>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: tint }}>
                        {value}
                    </span>
                    {suffix && <span className="text-[11px] font-medium text-text-secondary truncate">{suffix}</span>}
                </div>
                {trend && <span className="text-[10px] font-medium text-text-secondary mt-0.5">{trend}</span>}
            </div>
        </div>
    )
}

const gridCls = (isMobile) =>
    `grid gap-2.5 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'} ${isMobile ? 'mb-4' : 'mb-6'}`

/**
 * Horizontal strip of 5–6 key metric tiles displayed at the top of the main content area.
 * Adapts between plant-specific metrics (YPH, cleanliness, safety) and region-level
 * metrics (fleet total, allocation, in shop, overdue, operators, verified).
 */
export default function KeyMetricsStrip({ displayStats, plantNotifications, isPlantMode, accentColor, isMobile }) {
    const stats = displayStats || {}
    const opStats = stats.operators || {}
    const leaderboard = plantNotifications?.leaderboardMetrics

    if (isPlantMode && leaderboard) {
        const cleanliness = leaderboard.avgCleanliness || 0
        const cleanColor = cleanliness >= 4 ? '#16a34a' : cleanliness >= 3 ? '#f59e0b' : '#dc2626'
        const netHelp = Math.round(leaderboard.netHelp || 0)
        const netHelpColor = netHelp > 0 ? '#16a34a' : netHelp < 0 ? '#dc2626' : undefined
        return (
            <div className={gridCls(isMobile)}>
                <KpiTile
                    label="Raw YPH"
                    value={leaderboard.rawYPH?.toFixed(2) || '--'}
                    icon="fa-chart-line"
                    accentColor={accentColor}
                />
                <KpiTile
                    label="Adjusted YPH"
                    value={leaderboard.adjustedYPH?.toFixed(2) || '--'}
                    icon="fa-calculator"
                    accentColor={accentColor}
                />
                <KpiTile
                    label="Net Help"
                    value={`${netHelp > 0 ? '+' : ''}${netHelp}h`}
                    color={netHelpColor}
                    icon="fa-hands-helping"
                    accentColor={accentColor}
                />
                <KpiTile
                    label="Cleanliness"
                    value={cleanliness.toFixed(1)}
                    color={cleanColor}
                    icon="fa-broom"
                    accentColor={accentColor}
                />
                <KpiTile
                    label="Safety"
                    value={leaderboard.safetyIncidents || 0}
                    color={(leaderboard.safetyIncidents || 0) === 0 ? '#16a34a' : '#dc2626'}
                    icon="fa-hard-hat"
                    accentColor={accentColor}
                />
            </div>
        )
    }

    const allocation = Math.round(stats.overallAllocationPercent || 0)
    const allocationColor = allocation >= 80 ? '#16a34a' : allocation >= 50 ? '#f59e0b' : '#dc2626'
    const verified = Math.round(stats.verificationAverage || 0)
    const verifiedColor = verified >= 90 ? '#16a34a' : verified >= 70 ? '#f59e0b' : '#dc2626'
    const inShop =
        (stats.mixers?.shop || 0) +
        (stats.tractors?.shop || 0) +
        (stats.trailers?.shop || 0) +
        (stats.equipment?.shop || 0)
    const overdue = stats.overdueTotal || 0

    return (
        <div className={gridCls(isMobile)}>
            <KpiTile label="Fleet Total" value={stats.fleetTotal || 0} icon="fa-truck" accentColor={accentColor} />
            <KpiTile
                label="Allocation"
                value={`${allocation}%`}
                color={allocationColor}
                icon="fa-chart-pie"
                accentColor={accentColor}
            />
            <KpiTile label="In Shop" value={inShop} color="#f59e0b" icon="fa-tools" accentColor={accentColor} />
            <KpiTile
                label="Overdue"
                value={overdue}
                color={overdue === 0 ? '#16a34a' : '#dc2626'}
                icon="fa-exclamation-triangle"
                accentColor={accentColor}
            />
            <KpiTile
                label="Operators"
                value={opStats.active || 0}
                icon="fa-users"
                accentColor={accentColor}
                suffix={opStats.unassigned > 0 ? `(${opStats.unassigned} idle)` : ''}
            />
            <KpiTile
                label="Verified"
                value={`${verified}%`}
                color={verifiedColor}
                icon="fa-clipboard-check"
                accentColor={accentColor}
            />
        </div>
    )
}
