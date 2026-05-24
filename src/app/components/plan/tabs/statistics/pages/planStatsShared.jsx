/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtFloat, fmtInt, fmtYards } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { Panel } from '../../../../ui/Panel'
import { ComparisonRow } from '../PlanStatisticsTables'

/* ──────────────────────────────────────────────────────────────────────────
 * Shared loading / empty primitives — every sub-page uses the same vocab so
 * a "Refreshing…" indicator on Yardage looks identical to one on Plants or
 * Customers. Centralising these means we never drift into per-section
 * lookalikes that drift apart over time.
 * ────────────────────────────────────────────────────────────────────────── */

/** Inline indicator shown in a Panel's right slot while data is being
 *  fetched but partial / cached content is already on screen. */
export function RefreshingHint({ when }) {
    if (!when) return null
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <i className="fas fa-spinner fa-spin text-[10px]" />
            Refreshing…
        </span>
    )
}

/** Empty / loading state for a panel body — explicit messaging beats a
 *  blank box and lets the user tell "loading" apart from "no data". */
export function EmptySection({ icon = 'fa-circle-info', loading, message }) {
    return (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : icon} text-[14px]`} />
            <span>{message}</span>
        </div>
    )
}

/** True when the schedule fetch has finished and there's nothing to show. */
export const isEmptyAfterLoad = (loading, currentDays) => !loading && currentDays.length === 0

/* ──────────────────────────────────────────────────────────────────────────
 * Period comparison — same metric on both sides + Δ%. Shared between
 * Overview / Plants when comparison is on.
 * ────────────────────────────────────────────────────────────────────────── */

export function ComparisonPanel({ currentSummary, previousSummary }) {
    const rows = useMemo(
        () => [
            {
                current: { formatted: fmtYards(currentSummary.totalYardage), value: currentSummary.totalYardage },
                label: 'Total yardage',
                previous: { formatted: fmtYards(previousSummary.totalYardage), value: previousSummary.totalYardage }
            },
            {
                current: { formatted: fmtInt(currentSummary.totalLoads), value: currentSummary.totalLoads },
                label: 'Loads scheduled',
                previous: { formatted: fmtInt(previousSummary.totalLoads), value: previousSummary.totalLoads }
            },
            {
                current: { formatted: fmtInt(currentSummary.totalOrders), value: currentSummary.totalOrders },
                label: 'Orders',
                previous: { formatted: fmtInt(previousSummary.totalOrders), value: previousSummary.totalOrders }
            },
            {
                current: {
                    formatted: currentSummary.yardagePerLoad != null ? fmtFloat(currentSummary.yardagePerLoad) : '—',
                    value: currentSummary.yardagePerLoad
                },
                label: 'Yardage per load',
                previous:
                    previousSummary.yardagePerLoad != null
                        ? {
                              formatted: fmtFloat(previousSummary.yardagePerLoad),
                              value: previousSummary.yardagePerLoad
                          }
                        : null
            },
            {
                current: {
                    formatted: fmtYards(currentSummary.avgYardagePerActiveDay),
                    value: currentSummary.avgYardagePerActiveDay
                },
                label: 'Avg yardage / active day',
                previous: {
                    formatted: fmtYards(previousSummary.avgYardagePerActiveDay),
                    value: previousSummary.avgYardagePerActiveDay
                }
            },
            {
                current: {
                    formatted:
                        currentSummary.avgShiftSpanHours != null ? fmtFloat(currentSummary.avgShiftSpanHours) : '—',
                    value: currentSummary.avgShiftSpanHours
                },
                label: 'Avg shift span (h)',
                previous:
                    previousSummary.avgShiftSpanHours != null
                        ? {
                              formatted: fmtFloat(previousSummary.avgShiftSpanHours),
                              value: previousSummary.avgShiftSpanHours
                          }
                        : null
            },
            {
                current: {
                    formatted: `${currentSummary.daysWithProduction}/${currentSummary.dayCount}`,
                    value: currentSummary.daysWithProduction
                },
                label: 'Active production days',
                previous: {
                    formatted: `${previousSummary.daysWithProduction}/${previousSummary.dayCount}`,
                    value: previousSummary.daysWithProduction
                }
            }
        ],
        [currentSummary, previousSummary]
    )

    return (
        <Panel title="Period comparison" innerClassName="p-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                <span>Metric</span>
                <span>Current</span>
                <span>Previous</span>
                <span className="text-right" style={{ minWidth: 60 }}>
                    Δ
                </span>
            </div>
            {rows.map((row) => (
                <ComparisonRow key={row.label} label={row.label} current={row.current} previous={row.previous} />
            ))}
        </Panel>
    )
}
