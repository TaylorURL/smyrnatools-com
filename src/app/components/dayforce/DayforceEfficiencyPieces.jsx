/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtYards } from '../../../utils/PlanStatisticsFormatUtility'

/** YPH thresholds — mirrored from the main Efficiency page so this
 *  module stays self-contained. Kept in sync manually; both files
 *  reference the same operational targets. */
export const YPH_TARGET = 3
export const YPH_EXCEPTIONAL = 5

const fmtHours = (n) => `${fmtFloat(n, 1)}h`
const fmtYph = (n) => fmtFloat(n, 2)

/** First-load placeholder — matches the rhythm used by every other
 *  Plan stats sub-page (Hours, Labor Cost, Schedules). */
export function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 animate-pulse">
            {[120, 56, 200, 320, 220].map((h, i) => (
                <div key={i} className="rounded bg-bg-secondary border border-border-light" style={{ height: h }} />
            ))}
        </div>
    )
}

/** Compact operator card used inside spotlight callouts. Same visual
 *  shape as the Hours page chips so the two surfaces feel like a set. */
export function SpotlightChip({ accent, primary, secondary, row }) {
    return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border-light bg-bg-primary text-[12px]">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-text-primary truncate">{row.name}</span>
                    {row.plantCode && (
                        <span
                            className="font-mono tabular-nums text-[10px] px-1 rounded shrink-0"
                            style={{ background: `${accent}18`, color: accent }}
                        >
                            {row.plantCode}
                        </span>
                    )}
                </div>
                {secondary && <div className="text-[10.5px] text-text-tertiary truncate">{secondary}</div>}
            </div>
            <span className="font-mono tabular-nums font-semibold shrink-0 text-text-primary">{primary}</span>
        </div>
    )
}

/** Spotlight column — colored circle icon + count + chip stack.
 *  Empty fallback keeps the three columns balanced even when one
 *  bucket is empty. */
export function SpotlightColumn({ accentColor, children, count, emptyMessage, hint, icon, title }) {
    return (
        <div className="flex flex-col gap-2 rounded border border-border-light bg-bg-primary p-3 min-h-0">
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                    style={{ background: `${accentColor}1a`, color: accentColor }}
                >
                    <i className={`fas ${icon} text-[12px]`} />
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-text-primary truncate">{title}</div>
                    {hint && <div className="text-[10.5px] text-text-tertiary truncate">{hint}</div>}
                </div>
                <span className="font-mono tabular-nums text-[12.5px] font-bold shrink-0 text-text-primary">
                    {count}
                </span>
            </div>
            {count === 0 ? (
                <div className="text-[11.5px] text-text-tertiary px-1 py-2">{emptyMessage}</div>
            ) : (
                <div className="flex flex-col gap-1.5">{children}</div>
            )}
        </div>
    )
}

/** Horizontal scale showing where this operator's YPH lands across a
 *  0..YPH_EXCEPTIONAL band. Two reference lines mark the target (3) and
 *  the exceptional threshold (5). The fill stops at the operator's YPH
 *  so the eye reads "how far along the scale am I" rather than "how
 *  much bar is filled" — a sub-target operator literally sits short of
 *  the target line. */
function YphBar({ accent, yph }) {
    const max = Math.max(YPH_EXCEPTIONAL, yph)
    const fillPct = Math.min(100, (yph / max) * 100)
    const targetPct = (YPH_TARGET / max) * 100
    const exceptionalPct = (YPH_EXCEPTIONAL / max) * 100
    return (
        <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary ml-16 relative">
            <div className="h-full absolute left-0 top-0" style={{ background: accent, width: `${fillPct}%` }} />
            <div
                className="absolute top-0 bottom-0 w-px"
                style={{ background: 'var(--text-tertiary)', left: `${targetPct}%` }}
            />
            <div
                className="absolute top-0 bottom-0 w-px"
                style={{ background: 'var(--border-light)', left: `${exceptionalPct}%` }}
            />
        </div>
    )
}

/** Single operator efficiency row — hours, yards, YPH, vs target.
 *  Background bar visualizes the YPH against the 0..exceptional scale
 *  so weak vs strong reads at a glance without parsing numbers. */
export function OperatorEfficiencyRow({ accent, fleetYph, row }) {
    const deltaVsFleet = fleetYph > 0 ? row.yph - fleetYph : null
    const isBelowTarget = row.yph > 0 && row.yph < YPH_TARGET
    const isExceptional = row.yph >= YPH_EXCEPTIONAL
    return (
        <div className="flex flex-col gap-1 px-3 py-2 border-t border-border-light first:border-t-0 hover:bg-bg-secondary transition-colors">
            <div className="flex items-center gap-2 text-[12px]">
                <span className="font-mono tabular-nums w-14 shrink-0 text-text-tertiary">{row.badge || '—'}</span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-text-primary font-semibold">{row.name}</span>
                    {row.position && (
                        <span className="text-[11px] text-text-tertiary truncate hidden sm:inline">
                            · {row.position}
                        </span>
                    )}
                    {row.plantCode && (
                        <span className="font-mono tabular-nums text-[11px] text-text-tertiary hidden md:inline">
                            · {row.plantCode}
                        </span>
                    )}
                </div>
                <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-secondary">
                    {fmtHours(row.actualHours)}
                </span>
                <span className="font-mono tabular-nums w-20 text-right shrink-0 text-text-secondary">
                    {row.yards > 0 ? fmtYards(row.yards) : '—'}
                </span>
                <span
                    className="font-mono tabular-nums w-14 text-right shrink-0 font-semibold"
                    style={{
                        color: isBelowTarget ? '#b91c1c' : isExceptional ? '#15803d' : 'var(--text-primary)'
                    }}
                >
                    {row.yph > 0 ? fmtYph(row.yph) : '—'}
                </span>
                <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-tertiary">
                    {deltaVsFleet == null ? '—' : `${deltaVsFleet > 0 ? '+' : ''}${fmtYph(deltaVsFleet)}`}
                </span>
            </div>
            <YphBar accent={accent} yph={row.yph} />
        </div>
    )
}

/** Per-plant rollup row — same shape as the Hours page rollup but the
 *  trailing metric is plant YPH instead of plant hours. */
export function PlantEfficiencyRow({ accent, maxYph, row }) {
    const pct = maxYph > 0 ? Math.min(100, (row.yph / maxYph) * 100) : 0
    return (
        <div className="flex items-center gap-2 text-[12px]">
            <span className="font-mono tabular-nums w-14 shrink-0 text-text-primary">{row.code}</span>
            <span className="flex-1 min-w-0 truncate text-text-secondary">{row.name}</span>
            <div className="h-4 rounded-sm overflow-hidden relative shrink-0 bg-bg-tertiary w-28">
                <div className="h-full" style={{ background: accent, width: `${pct}%` }} />
            </div>
            <span className="font-mono tabular-nums w-16 text-right shrink-0 text-text-secondary">
                {fmtHours(row.actualHours)}
            </span>
            <span className="font-mono tabular-nums w-20 text-right shrink-0 text-text-secondary">
                {fmtYards(row.yards)}
            </span>
            <span className="font-mono tabular-nums w-14 text-right shrink-0 text-text-primary font-semibold">
                {row.yph > 0 ? fmtYph(row.yph) : '—'}
            </span>
            <span className="font-mono tabular-nums w-10 text-right shrink-0 text-text-tertiary">
                {row.operatorCount}
            </span>
        </div>
    )
}
