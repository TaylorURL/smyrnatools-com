/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../../app/components/common/Badge'
import { fmtInt, fmtPct } from '../../../../utils/PlanStatisticsFormatUtility'

/** Badge tone per `displayStatus` label, including the In-Shop sub-statuses.
 *  Anything unmapped reads as neutral. */
const STATUS_TO_TONE = {
    Active: 'success',
    'Down In Yard': 'danger',
    'In Shop': 'info',
    'Ready For Pickup': 'success',
    Retired: 'neutral',
    Spare: 'neutral',
    'Third Party Work': 'warning',
    'Waiting For Shop': 'warning'
}

/** Status chip for a table cell. Badge renders a neutral theme-tracking
 *  body, so the tone only tints the leading dot. */
export function StatusPill({ status }) {
    const tone = STATUS_TO_TONE[status] || 'neutral'
    return (
        <Badge tone={tone} size="md" weight="semibold" uppercase={false} className="tabular-nums">
            {status}
        </Badge>
    )
}

/** Per-plant scorecard for the Plant Distribution page. Verification,
 *  overdue-service, and operator columns are conditional: the first and last
 *  on the asset config's feature flags, the middle one on the caller's
 *  `hasService`, which the summary derives from the data. Verified rate and
 *  fleet share are computed here rather than in the aggregator, so `rows`
 *  carries raw counts and `totalFleet` the denominator for share. */
export function PlantScorecardTable({ accent, config, hasService, rows, totalFleet }) {
    if (!rows.length) {
        return <div className="text-[12px] py-4 text-center text-text-tertiary">No plants with assets in scope.</div>
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
                <thead>
                    <tr className="text-text-tertiary">
                        <th
                            scope="col"
                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                        >
                            Plant
                        </th>
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Total
                        </th>
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Active
                        </th>
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Spare
                        </th>
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Shop
                        </th>
                        {config?.hasVerification && (
                            <th
                                scope="col"
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                            >
                                Verified
                            </th>
                        )}
                        {hasService && (
                            <th
                                scope="col"
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                            >
                                Overdue
                            </th>
                        )}
                        {config?.hasOperatorAssignment && (
                            <th
                                scope="col"
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                            >
                                No Op
                            </th>
                        )}
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Issues
                        </th>
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                        >
                            Share
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((plant) => {
                        const share = totalFleet > 0 ? (plant.total / totalFleet) * 100 : 0
                        const verifiedRate = plant.total > 0 ? (plant.verified / plant.total) * 100 : 0
                        return (
                            <tr className="border-t border-border-light" key={plant.code}>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full shrink-0"
                                            style={{ background: accent }}
                                        />
                                        <span className="font-mono tabular-nums font-semibold text-text-primary">
                                            {plant.code}
                                        </span>
                                        {plant.name !== plant.code && (
                                            <span className="truncate text-text-secondary">{plant.name}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                    {fmtInt(plant.total)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                    {fmtInt(plant.active)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary">
                                    {fmtInt(plant.spare)}
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                    {fmtInt(plant.shop)}
                                </td>
                                {config?.hasVerification && (
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                        {fmtPct(verifiedRate)}
                                    </td>
                                )}
                                {hasService && (
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                        {fmtInt(plant.overdueService)}
                                    </td>
                                )}
                                {config?.hasOperatorAssignment && (
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                        {fmtInt(plant.unassignedActive)}
                                    </td>
                                )}
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-text-primary">
                                    {fmtInt(plant.openIssues)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                                    {share.toFixed(1)}%
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/** Shared "top N assets" table — identifier, plant, status, and one trailing
 *  metric column whose heading and cell rendering the caller supplies via
 *  `headerLabel`, `valueAccessor`, and `valueFormatter`. Rows must carry
 *  `identifier`, `plant`, and `status`; `operatorName` is optional and
 *  renders as a subtitle. `onSelect` receives the whole row so the parent
 *  can open the asset's detail view. */
export function AssetWatchlistTable({ headerLabel, onSelect, rows, valueAccessor, valueFormatter }) {
    if (!rows.length) {
        return (
            <div className="text-[12px] py-4 text-center text-text-tertiary">
                Nothing to flag here — fleet is clean.
            </div>
        )
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
                <thead>
                    <tr className="text-text-tertiary">
                        <th
                            scope="col"
                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                        >
                            Asset
                        </th>
                        <th
                            scope="col"
                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Plant
                        </th>
                        <th
                            scope="col"
                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                        >
                            Status
                        </th>
                        <th
                            scope="col"
                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                        >
                            {headerLabel}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const value = valueAccessor(row)
                        const formatted = valueFormatter ? valueFormatter(value, row) : value
                        return (
                            <tr className="border-t border-border-light" key={row.id || row.identifier}>
                                <td className="px-3 py-2">
                                    <button
                                        type="button"
                                        onClick={() => onSelect?.(row)}
                                        className="font-mono tabular-nums font-semibold bg-transparent border-none cursor-pointer p-0 text-left text-text-primary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    >
                                        {row.identifier}
                                    </button>
                                    {row.operatorName && (
                                        <div className="text-[10.5px] text-text-tertiary truncate">
                                            {row.operatorName}
                                        </div>
                                    )}
                                </td>
                                <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">{row.plant}</td>
                                <td className="px-2 py-2">
                                    <StatusPill status={row.status} />
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                    {formatted}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/** Per-plant cleanliness averages. Gauges are scaled against the 5-star
 *  maximum rather than the highest-rated plant, so bar length is comparable
 *  across plant filters. The fill switches to the danger and warning hues
 *  below 3 and 4 stars, matching the "dirty" threshold the list view uses. */
export function CleanlinessPlantList({ accent, rows }) {
    if (!rows.length) {
        return (
            <div className="text-[12px] py-4 text-center text-text-tertiary">No cleanliness ratings recorded yet.</div>
        )
    }
    return (
        <div className="flex flex-col gap-1.5">
            {rows.map((row) => {
                const avg = row.avg ?? 0
                const pct = (avg / 5) * 100
                return (
                    <div key={row.code} className="flex items-center gap-2 text-[12px]">
                        <span className="font-mono tabular-nums w-12 shrink-0 text-text-primary">{row.code}</span>
                        <span className="flex-1 min-w-0 truncate text-text-secondary">{row.name}</span>
                        <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary w-24">
                            <div
                                className="h-full"
                                style={{
                                    background:
                                        avg < 3 ? 'var(--status-danger)' : avg < 4 ? 'var(--status-warning)' : accent,
                                    width: `${pct}%`
                                }}
                            />
                        </div>
                        <span className="font-mono tabular-nums font-semibold w-12 text-right shrink-0 text-text-primary">
                            {avg ? avg.toFixed(2) : '—'}
                        </span>
                        <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-tertiary">
                            {row.dirty > 0 ? `${row.dirty} dirty` : `${row.samples} rated`}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
