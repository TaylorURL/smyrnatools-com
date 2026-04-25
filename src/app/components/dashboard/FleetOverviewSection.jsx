import React from 'react'

import { Panel } from '../ui/Panel'

/**
 * Canonical asset status palette — sourced from mixerConfig.statusBadgeClasses
 * so the dashboard reads identical to the MixersView fleet badges.
 *   Active   → #dcfce7 / #166534
 *   Spare    → #f3e8ff / #7c3aed
 *   In Shop  → #dbeafe / #1e40af
 *   Stationary — not in mixerConfig; kept on amber for pickup trucks.
 */
const STATUS_TINTS = {
    active: '#166534',
    inShop: '#1e40af',
    spare: '#7c3aed',
    stationary: '#a16207'
}

/** Inline status chip — no wrapping container, just colored count + label. */
function StatChip({ label, value, tint }) {
    return (
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[15px] font-bold tabular-nums" style={{ color: tint }}>
                {value}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
        </div>
    )
}

/**
 * Allocation bar — fraction of the asset type that is currently Active out
 * of the total fleet (Active / Total). Higher is better. Color tiers:
 * green ≥ 80%, amber ≥ 50%, red < 50%.
 */
function AllocationBar({ percent }) {
    const pct = Math.min(100, Math.max(0, percent || 0))
    const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626'
    return (
        <div
            className="flex items-center gap-2 min-w-[200px]"
            title="Allocation — share of this asset type currently Active vs total fleet. Green ≥ 80%, amber ≥ 50%, red < 50%."
        >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                Allocation
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ background: color, width: `${pct}%` }} />
            </div>
            <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
                {pct}%
            </span>
        </div>
    )
}

/**
 * Sub-type breakdown pill used for tractor freight and trailer types.
 * Colors match mixerConfig.statusBadgeClasses (Active green, Spare violet,
 * In Shop blue) so the dashboard speaks the same visual language as MixersView.
 */
function SubTypePill({ label, data }) {
    return (
        <div
            className="flex items-center gap-1.5 rounded-md bg-bg-tertiary px-2 py-1 border border-border-light"
            title={`${label} — ${data.active} active · ${data.spare} spare · ${data.shop} in shop`}
        >
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: STATUS_TINTS.active }}>
                {data.active}
            </span>
            <span className="text-text-tertiary">·</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: STATUS_TINTS.spare }}>
                {data.spare}
            </span>
            <span className="text-text-tertiary">·</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: STATUS_TINTS.inShop }}>
                {data.shop}
            </span>
        </div>
    )
}

/** Single asset-type row in the flat fleet overview. */
function AssetRow({ icon, iconColor, label, total, stats, allocation, subTypes, highlight, isTotal }) {
    return (
        <div
            className={`flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-2 border-b border-border-light last:border-b-0 transition-colors ${
                isTotal ? 'border-t-2 border-t-border-medium bg-bg-tertiary/50 font-semibold' : 'hover:bg-bg-tertiary'
            } ${highlight ? 'relative' : ''}`}
        >
            {highlight && (
                <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                    style={{ background: iconColor }}
                />
            )}
            <div className="flex items-center gap-3 min-w-[180px] flex-shrink-0">
                <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ring-1 ring-inset"
                    style={{
                        background: `${iconColor}14`,
                        color: iconColor,
                        boxShadow: `inset 0 0 0 1px ${iconColor}22`
                    }}
                >
                    <i className={`fas ${icon} text-[15px]`} />
                </div>
                <div>
                    <div
                        className={`text-[10px] uppercase tracking-wider leading-none ${
                            isTotal ? 'font-bold text-text-primary' : 'font-semibold text-text-secondary'
                        }`}
                    >
                        {label}
                    </div>
                    <div className="text-[24px] font-bold leading-tight text-text-primary tabular-nums">{total}</div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 flex-1">
                {stats.map(({ key, label: sLabel, value, tint }) => (
                    <StatChip key={key} label={sLabel} value={value} tint={tint} />
                ))}
            </div>
            {subTypes && subTypes.length > 0 && <div className="flex flex-wrap items-center gap-1.5">{subTypes}</div>}
            {allocation != null && <AllocationBar percent={allocation} />}
        </div>
    )
}

/**
 * Flat fleet overview — every asset type rendered as a single inline row
 * (icon · headline total · status chips · sub-type breakdown · allocation bar).
 * No nested cards or container wrapping; rows separated by hairline dividers
 * for visual rhythm and scanning.
 */
export default function FleetOverviewSection({ displayStats, stats, isAggregate, selectedRegion, accentColor }) {
    const assetRows = []

    const baseStats = (record, options = {}) => {
        const activeKey = options.activeKey || 'active'
        return [
            { key: 'active', label: 'Active', tint: STATUS_TINTS.active, value: record[activeKey] ?? record.active },
            { key: 'spare', label: 'Spare', tint: STATUS_TINTS.spare, value: record.spare },
            { key: 'shop', label: 'In Shop', tint: STATUS_TINTS.inShop, value: record.shop }
        ]
    }

    if (!isAggregate) {
        const m = displayStats.mixers
        assetRows.push(
            <AssetRow
                key="mixers"
                icon="fa-truck"
                iconColor="#2563eb"
                label="Mixers"
                total={m.total}
                stats={baseStats(m, { activeKey: m.activeOperators != null ? 'activeOperators' : 'active' })}
                allocation={m.allocationPercent}
                highlight={selectedRegion?.type === 'Concrete'}
            />
        )
    }

    const t = displayStats.tractors
    const tractorSubTypes =
        t.freight &&
        ['Cement', 'Aggregate', 'Dump Truck']
            .filter((type) => t.freight[type] && t.freight[type].total > 0)
            .map((type) => (
                <SubTypePill key={type} label={type === 'Dump Truck' ? 'Dump' : type} data={t.freight[type]} />
            ))
    assetRows.push(
        <AssetRow
            key="tractors"
            icon="fa-tractor"
            iconColor="#16a34a"
            label="Tractors"
            total={t.total}
            stats={baseStats(t, { activeKey: t.activeOperators != null ? 'activeOperators' : 'active' })}
            allocation={t.allocationPercent}
            subTypes={tractorSubTypes}
            highlight={selectedRegion?.type === 'Aggregate'}
        />
    )

    const tr = displayStats.trailers
    const trailerSubTypes =
        tr.trailerType &&
        ['Cement', 'End Dump']
            .filter((type) => tr.trailerType[type] && tr.trailerType[type].total > 0)
            .map((type) => <SubTypePill key={type} label={type} data={tr.trailerType[type]} />)
    assetRows.push(
        <AssetRow
            key="trailers"
            icon="fa-trailer"
            iconColor="#d97706"
            label="Trailers"
            total={tr.total}
            stats={baseStats(tr)}
            allocation={tr.allocationPercent}
            subTypes={trailerSubTypes}
        />
    )

    const e = displayStats.equipment
    assetRows.push(
        <AssetRow
            key="equipment"
            icon="fa-snowplow"
            iconColor="#9333ea"
            label="Equipment"
            total={e.total}
            stats={baseStats(e)}
            allocation={e.allocationPercent}
        />
    )

    const p = stats.pickups
    assetRows.push(
        <AssetRow
            key="pickups"
            icon="fa-truck-pickup"
            iconColor="#db2777"
            label="Pickup Trucks"
            total={p.total}
            stats={[
                { key: 'active', label: 'Active', tint: STATUS_TINTS.active, value: p.active },
                { key: 'shop', label: 'In Shop', tint: STATUS_TINTS.inShop, value: p.shop },
                { key: 'stationary', label: 'Stationary', tint: STATUS_TINTS.stationary, value: p.stationary }
            ]}
        />
    )

    // Column totals — sum of every asset type rendered above. Active reads
    // from the `activeOperators` field when set (matching the displayed value)
    // so the total ties out exactly with what the rows show.
    const sumActive = (record) => Number(record?.activeOperators ?? record?.active ?? 0)
    const totals = {
        active:
            (isAggregate ? 0 : sumActive(displayStats.mixers)) +
            sumActive(displayStats.tractors) +
            sumActive(displayStats.trailers) +
            sumActive(displayStats.equipment) +
            Number(p.active || 0),
        shop:
            (isAggregate ? 0 : Number(displayStats.mixers?.shop || 0)) +
            Number(displayStats.tractors?.shop || 0) +
            Number(displayStats.trailers?.shop || 0) +
            Number(displayStats.equipment?.shop || 0) +
            Number(p.shop || 0),
        spare:
            (isAggregate ? 0 : Number(displayStats.mixers?.spare || 0)) +
            Number(displayStats.tractors?.spare || 0) +
            Number(displayStats.trailers?.spare || 0) +
            Number(displayStats.equipment?.spare || 0),
        stationary: Number(p.stationary || 0),
        total:
            (isAggregate ? 0 : Number(displayStats.mixers?.total || 0)) +
            Number(displayStats.tractors?.total || 0) +
            Number(displayStats.trailers?.total || 0) +
            Number(displayStats.equipment?.total || 0) +
            Number(p.total || 0)
    }
    const totalAllocation = totals.total > 0 ? Math.round((totals.active / totals.total) * 100) : 0
    const totalsStats = [
        { key: 'active', label: 'Active', tint: STATUS_TINTS.active, value: totals.active },
        { key: 'spare', label: 'Spare', tint: STATUS_TINTS.spare, value: totals.spare },
        { key: 'shop', label: 'In Shop', tint: STATUS_TINTS.inShop, value: totals.shop }
    ]
    if (totals.stationary > 0) {
        totalsStats.push({
            key: 'stationary',
            label: 'Stationary',
            tint: STATUS_TINTS.stationary,
            value: totals.stationary
        })
    }
    assetRows.push(
        <AssetRow
            key="totals"
            icon="fa-list-check"
            iconColor={accentColor || '#1e3a5f'}
            label="Fleet Total"
            total={totals.total}
            stats={totalsStats}
            allocation={totalAllocation}
            isTotal
        />
    )

    return (
        <Panel
            title="Fleet Overview"
            right={
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Active, spare, and in-shop counts by asset type
                </span>
            }
        >
            <div className="flex flex-col">{assetRows}</div>
        </Panel>
    )
}
