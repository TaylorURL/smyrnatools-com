/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat, fmtInt, fmtYards } from '../../../utils/PlanStatisticsFormatUtility'
import { PLANT_BADGE_COLORS } from '../../constants/planConstants'
import Badge from '../common/Badge'

/** YPH thresholds — mirrored from the main Efficiency page so this
 *  module stays self-contained. Kept in sync manually; both files
 *  reference the same operational targets. */
export const YPH_TARGET = 3
export const YPH_EXCEPTIONAL = 5

const fmtHours = (n) => `${fmtFloat(n, 1)}h`
const fmtYph = (n) => fmtFloat(n, 2)

/** Map a plant's YPH onto one of four status buckets that drive the
 *  scorecard's badge colour + the headline KPI counts. `no-data` covers
 *  plants whose operators clocked hours but never appear on a ticket
 *  (typically a small office plant or a roster mismatch). */
export function plantStatusFor(yph) {
    if (!yph || yph <= 0) return 'no-data'
    if (yph >= YPH_EXCEPTIONAL) return 'exceptional'
    if (yph >= YPH_TARGET) return 'on-target'
    return 'below-target'
}

/** Status pill tones — maps each YPH bucket onto a shared Badge tone +
 *  the FA icon suffix (without `fa-` prefix; Badge prepends it). Tones
 *  follow the project's status vocabulary: danger for below target,
 *  success for on/exceptional, neutral for missing yardage. */
const PLANT_STATUS_TONES = {
    'below-target': { icon: 'triangle-exclamation', label: 'Below target', tone: 'danger' },
    exceptional: { icon: 'trophy', label: 'Exceptional', tone: 'success' },
    'no-data': { icon: 'circle-minus', label: 'No yardage', tone: 'neutral' },
    'on-target': { icon: 'circle-check', label: 'On target', tone: 'success' }
}

const FALLBACK_PLANT_COLOR = '#475569'

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
    const iconSuffix = typeof icon === 'string' ? icon.replace(/^fa-/, '') : icon
    return (
        <div className="flex flex-col gap-2 rounded border border-border-light bg-bg-primary p-3 min-h-0">
            <div className="flex items-center gap-2">
                <Badge
                    variant="custom"
                    bg={`${accentColor}1a`}
                    fg={accentColor}
                    size="lg"
                    shape="pill"
                    uppercase={false}
                    icon={iconSuffix}
                    className="h-7 w-7 justify-center shrink-0"
                />
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

/** Large plant-first scorecard. Anchors the redesigned Efficiency page:
 *  one card per plant, ranked by YPH, with the big number front-and-
 *  center, a target-referenced fill bar, a colour-coded status pill,
 *  and the supporting hours / yards / operator-count line. The plant
 *  identity chip pulls its colour from `PLANT_BADGE_COLORS` so each
 *  plant has the same hue here that it does on the Schedule and
 *  Planner views. */
export function PlantScorecard({ fleetYph, row }) {
    const status = plantStatusFor(row.yph)
    const statusConfig = PLANT_STATUS_TONES[status]
    const plantColor = PLANT_BADGE_COLORS[row.code] || FALLBACK_PLANT_COLOR
    const scaleMax = Math.max(YPH_EXCEPTIONAL, row.yph)
    const fillPct = scaleMax > 0 ? Math.min(100, (row.yph / scaleMax) * 100) : 0
    const targetPct = scaleMax > 0 ? (YPH_TARGET / scaleMax) * 100 : 0
    const exceptionalPct = scaleMax > 0 ? (YPH_EXCEPTIONAL / scaleMax) * 100 : 0
    const deltaVsFleet = fleetYph > 0 && row.yph > 0 ? row.yph - fleetYph : null
    const deltaPrefix = deltaVsFleet == null ? '' : deltaVsFleet >= 0 ? '+' : ''
    return (
        <div className="flex flex-col gap-2.5 rounded-lg p-3 bg-bg-primary border border-border-light">
            <div className="flex items-center gap-2.5">
                <div
                    className="flex h-10 w-12 items-center justify-center rounded-md text-[13px] font-bold text-white shrink-0 tabular-nums"
                    style={{ background: plantColor }}
                >
                    {row.code}
                </div>
                <div className="flex-1 min-w-0 leading-tight">
                    <div className="text-[13px] font-semibold text-text-primary truncate">{row.name}</div>
                    <div className="text-[10.5px] text-text-tertiary tabular-nums mt-0.5">
                        {fmtInt(row.operatorCount)} operator{row.operatorCount === 1 ? '' : 's'}
                    </div>
                </div>
                <Badge
                    tone={statusConfig.tone}
                    variant="solid"
                    size="sm"
                    shape="pill"
                    uppercase={false}
                    icon={statusConfig.icon}
                    className="shrink-0"
                >
                    {statusConfig.label}
                </Badge>
            </div>

            <div className="flex items-end gap-3">
                <div className="flex flex-col leading-none shrink-0">
                    <span className="text-[28px] font-bold tabular-nums text-text-primary">
                        {row.yph > 0 ? fmtYph(row.yph) : '—'}
                    </span>
                    <span className="text-[9.5px] font-semibold uppercase tracking-wider text-text-tertiary mt-1">
                        YPH
                    </span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="h-2.5 rounded-sm overflow-hidden bg-bg-tertiary relative">
                        <div
                            className="h-full absolute left-0 top-0"
                            style={{ background: plantColor, width: `${fillPct}%` }}
                        />
                        <div
                            className="absolute top-0 bottom-0 w-px"
                            style={{ background: 'var(--text-tertiary)', left: `${targetPct}%` }}
                            title={`Target ${YPH_TARGET}`}
                        />
                        <div
                            className="absolute top-0 bottom-0 w-px"
                            style={{ background: 'var(--border-light)', left: `${exceptionalPct}%` }}
                            title={`Exceptional ${YPH_EXCEPTIONAL}`}
                        />
                    </div>
                    <div className="flex justify-between text-[9.5px] text-text-tertiary tabular-nums">
                        <span>Target {YPH_TARGET}</span>
                        <span>Exceptional {YPH_EXCEPTIONAL}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary tabular-nums pt-1 border-t border-border-light">
                <span>
                    <b className="text-text-primary">{fmtHours(row.actualHours)}</b> hours
                </span>
                <span className="text-text-tertiary">·</span>
                <span>
                    <b className="text-text-primary">{fmtYards(row.yards)}</b> yards
                </span>
                {deltaVsFleet != null && (
                    <>
                        <span className="text-text-tertiary">·</span>
                        <span>
                            <b className="text-text-primary">
                                {deltaPrefix}
                                {fmtYph(deltaVsFleet)}
                            </b>{' '}
                            vs fleet
                        </span>
                    </>
                )}
            </div>
        </div>
    )
}
