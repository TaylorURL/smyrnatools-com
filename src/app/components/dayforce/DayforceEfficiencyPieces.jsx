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

/** Status tone metadata for the fleet hero — drives the tone pill +
 *  the headline number colour so "we're crushing it" reads green and
 *  "we're way off" reads red without the user parsing the number. */
const FLEET_STATUS_TONES = {
    'below-target': { label: 'Below target', tone: 'danger' },
    exceptional: { label: 'Exceptional', tone: 'success' },
    'no-data': { label: 'No yardage', tone: 'neutral' },
    'on-target': { label: 'On target', tone: 'success' }
}

/** Fleet-level hero panel — the single anchor metric for the page. Big
 *  YPH number, target-referenced progress fill, status pill, supporting
 *  context line, plus a four-cell secondary KPI strip. Replaces the old
 *  5-up StatGroup strip so the eye lands on the headline number first
 *  and only drops to the supporting metrics if it cares. */
export function FleetHeroPanel({
    accent,
    fleetYph,
    medianYph,
    operatorCount,
    plantsAboveTarget,
    plantsBelowTarget,
    plantsExceptional,
    plantsTotal,
    plantsWithNoData,
    totalHours,
    totalYards
}) {
    const status = plantStatusFor(fleetYph)
    const statusConfig = FLEET_STATUS_TONES[status]
    const scaleMax = Math.max(YPH_EXCEPTIONAL, fleetYph)
    const fillPct = scaleMax > 0 ? Math.min(100, (fleetYph / scaleMax) * 100) : 0
    const targetPct = scaleMax > 0 ? (YPH_TARGET / scaleMax) * 100 : 0
    const exceptionalPct = scaleMax > 0 ? (YPH_EXCEPTIONAL / scaleMax) * 100 : 0
    const pctOfTarget = YPH_TARGET > 0 && fleetYph > 0 ? Math.round((fleetYph / YPH_TARGET) * 100) : 0

    return (
        <div className="flex flex-col gap-5 rounded-card border border-border-light bg-bg-primary p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
                <div className="flex flex-col gap-2 lg:min-w-[260px]">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                            Fleet YPH
                        </span>
                        <Badge tone={statusConfig.tone} size="xs" shape="pill" uppercase>
                            {statusConfig.label}
                        </Badge>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="text-[48px] font-bold tabular-nums leading-none text-text-primary">
                            {fleetYph > 0 ? fmtYph(fleetYph) : '—'}
                        </span>
                        <span className="text-[12px] font-semibold uppercase tracking-wider text-text-tertiary">
                            yd<sup>3</sup>/h
                        </span>
                    </div>
                    <div className="text-[11.5px] text-text-secondary tabular-nums">
                        {pctOfTarget > 0 ? `${pctOfTarget}% of ${YPH_TARGET} target` : `Target ${YPH_TARGET} YPH`}
                        {medianYph > 0 && <span className="text-text-tertiary"> · Median {fmtYph(medianYph)}</span>}
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-text-tertiary tabular-nums">
                        <span>0</span>
                        <span>Target {YPH_TARGET}</span>
                        <span>Exceptional {YPH_EXCEPTIONAL}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-bg-tertiary relative">
                        <div
                            className="h-full absolute left-0 top-0 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                            style={{ background: accent, width: `${fillPct}%` }}
                        />
                        <div
                            className="absolute top-0 bottom-0 w-px"
                            style={{ background: 'var(--text-tertiary)', left: `${targetPct}%` }}
                        />
                        <div
                            className="absolute top-0 bottom-0 w-px"
                            style={{ background: 'var(--border-light)', left: `${exceptionalPct}%` }}
                        />
                    </div>
                    <div className="text-[11.5px] text-text-secondary tabular-nums">
                        <b className="text-text-primary">{fmtYards(totalYards)}</b> on{' '}
                        <b className="text-text-primary">{fmtHours(totalHours)}</b> across{' '}
                        <b className="text-text-primary">{fmtInt(operatorCount)}</b>{' '}
                        {operatorCount === 1 ? 'operator' : 'operators'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-border-light">
                <HeroMicroStat
                    accentTone="success"
                    hint={plantsExceptional > 0 ? `${plantsExceptional} exceptional` : `≥ ${YPH_TARGET} YPH`}
                    label="Plants at / above target"
                    value={`${fmtInt(plantsAboveTarget)} / ${fmtInt(plantsTotal)}`}
                />
                <HeroMicroStat
                    accentTone={plantsBelowTarget > 0 ? 'danger' : 'neutral'}
                    hint={plantsWithNoData > 0 ? `+${plantsWithNoData} with no yardage` : 'All plants reporting'}
                    label="Plants below target"
                    value={fmtInt(plantsBelowTarget)}
                />
                <HeroMicroStat
                    accentTone="neutral"
                    hint="On-roster Dayforce operators"
                    label="Operators on the road"
                    value={fmtInt(operatorCount)}
                />
                <HeroMicroStat
                    accentTone="neutral"
                    hint="Pours credited to operators"
                    label="Yards"
                    value={fmtYards(totalYards)}
                />
            </div>
        </div>
    )
}

function HeroMicroStat({ accentTone, hint, label, value }) {
    const dotColor =
        accentTone === 'success'
            ? 'var(--status-active)'
            : accentTone === 'danger'
              ? 'var(--status-danger)'
              : accentTone === 'warning'
                ? 'var(--status-warning)'
                : 'var(--border-medium)'
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
                <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                <span className="truncate">{label}</span>
            </div>
            <div className="text-[18px] font-bold tabular-nums text-text-primary leading-tight">{value}</div>
            {hint && <div className="text-[10.5px] text-text-tertiary truncate">{hint}</div>}
        </div>
    )
}

/** Dense ranked-row layout for the plant leaderboard. Replaces the older
 *  3-up scorecard grid: rank + plant chip + name on the left, big YPH +
 *  vs-fleet delta + inline bar on the right. Reads top-to-bottom like a
 *  leaderboard rather than left-to-right like a card wall, so the
 *  "who's winning" question lands instantly. */
export function PlantLeaderboardRow({ fleetYph, isLast, rank, row }) {
    const status = plantStatusFor(row.yph)
    const statusConfig = PLANT_STATUS_TONES[status]
    const plantColor = PLANT_BADGE_COLORS[row.code] || FALLBACK_PLANT_COLOR
    const scaleMax = Math.max(YPH_EXCEPTIONAL, row.yph)
    const fillPct = scaleMax > 0 ? Math.min(100, (row.yph / scaleMax) * 100) : 0
    const targetPct = scaleMax > 0 ? (YPH_TARGET / scaleMax) * 100 : 0
    const deltaVsFleet = fleetYph > 0 && row.yph > 0 ? row.yph - fleetYph : null
    const deltaPct = fleetYph > 0 && row.yph > 0 ? Math.round(((row.yph - fleetYph) / fleetYph) * 100) : null
    const deltaColor =
        deltaPct == null
            ? 'var(--text-tertiary)'
            : deltaPct > 0
              ? 'var(--status-active)'
              : deltaPct < 0
                ? 'var(--status-danger)'
                : 'var(--text-tertiary)'

    return (
        <div
            className={`grid grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_minmax(160px,1.4fr)_minmax(80px,auto)_minmax(80px,auto)_minmax(60px,auto)_minmax(140px,2fr)] items-center gap-x-3 gap-y-2 px-3 py-2.5 hover:bg-bg-secondary transition-colors ${
                isLast ? '' : 'border-b border-border-light'
            }`}
        >
            <span className="font-mono tabular-nums text-[12px] font-bold text-text-tertiary text-right">{rank}</span>

            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-7 w-9 items-center justify-center rounded-md text-[11px] font-bold text-white shrink-0 tabular-nums"
                    style={{ background: plantColor }}
                >
                    {row.code}
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-[12.5px] font-semibold text-text-primary truncate">{row.name}</span>
                    <span className="text-[10.5px] text-text-tertiary tabular-nums">
                        {fmtInt(row.operatorCount)} op{row.operatorCount === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            <span className="hidden sm:flex flex-col leading-tight items-end shrink-0">
                <span className="text-[16px] font-bold tabular-nums text-text-primary">
                    {row.yph > 0 ? fmtYph(row.yph) : '—'}
                </span>
                <span className="text-[9.5px] uppercase tracking-wider text-text-tertiary">YPH</span>
            </span>

            <span
                className="hidden sm:flex items-baseline gap-1 shrink-0 font-mono tabular-nums"
                style={{ color: deltaColor }}
            >
                {deltaPct == null ? (
                    <span className="text-text-tertiary text-[12px]">—</span>
                ) : (
                    <>
                        <i
                            className={`fas fa-arrow-${deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'right'} text-[9px]`}
                        />
                        <span className="text-[12.5px] font-semibold">
                            {deltaPct > 0 ? '+' : ''}
                            {deltaPct}%
                        </span>
                    </>
                )}
            </span>

            <Badge
                tone={statusConfig.tone}
                size="xs"
                shape="pill"
                uppercase={false}
                className="hidden sm:inline-flex shrink-0"
            >
                {statusConfig.label}
            </Badge>

            <div className="col-span-3 sm:col-span-1 flex flex-col gap-1 min-w-0">
                <div className="h-1.5 rounded-full overflow-hidden bg-bg-tertiary relative">
                    <div
                        className="h-full absolute left-0 top-0 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                        style={{ background: plantColor, width: `${fillPct}%` }}
                    />
                    <div
                        className="absolute top-0 bottom-0 w-px"
                        style={{ background: 'var(--text-tertiary)', left: `${targetPct}%` }}
                        title={`Target ${YPH_TARGET}`}
                    />
                </div>
                <div className="flex justify-between text-[9.5px] text-text-tertiary tabular-nums">
                    <span>
                        {fmtHours(row.actualHours)} · {fmtYards(row.yards)}
                    </span>
                    {deltaVsFleet != null && (
                        <span className="sm:hidden">
                            {deltaVsFleet > 0 ? '+' : ''}
                            {fmtYph(deltaVsFleet)} vs fleet
                        </span>
                    )}
                </div>
            </div>
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
