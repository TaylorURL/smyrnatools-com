/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { fmtFloat, fmtInt, fmtRange, fmtYards } from '../../../utils/PlanStatisticsFormatUtility'
import useDayforceOperatorFilters from '../../hooks/useDayforceOperatorFilters'
import useDayforceOperatorMetrics from '../../hooks/useDayforceOperatorMetrics'
import useOperatorYardageByDay from '../../hooks/useOperatorYardageByDay'
import { canonicalNameKey } from '../../../utils/OperatorNameLookupUtility'
import { EmptySection, RefreshingHint } from '../plan/tabs/statistics/PlanStatisticsPages'
import { Panel, Stat, StatGroup } from '../ui/Panel'
import {
    LoadingSkeleton,
    OperatorEfficiencyRow,
    plantStatusFor,
    PlantScorecard,
    SpotlightChip,
    SpotlightColumn,
    YPH_EXCEPTIONAL,
    YPH_TARGET
} from './DayforceEfficiencyPieces'
import { DayforceFilters } from './DayforceFilters'

const EFFICIENCY_SORT_IDS = ['yph', 'yards', 'hours', 'name']

/** Minimum hours an operator needs in the window before they show up in
 *  the leaderboard / underperformer spotlights. Anything under this is
 *  too small a sample to judge fairly — a driver with 1.5h worked and
 *  18 yards reads as YPH 12 and would crowd out genuine top performers. */
const MIN_HOURS_FOR_RANKING = 8

/** Median of a numeric array. Used for the "median operator YPH" KPI —
 *  more representative than the fleet-wide average when a couple of
 *  light-day outliers would otherwise drag the mean. */
const median = (values) => {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const fmtHours = (n) => `${fmtFloat(n, 1)}h`
const fmtYph = (n) => fmtFloat(n, 2)

/** Convert a canonical "last first" name key back to a Title-Cased
 *  display string for phantom rows. The canon key has tokens
 *  alphabetized and lowercased, so the display will look like "Gomez
 *  Jose" instead of "Jose Gomez" — but it still reads as the right
 *  person and signals "this came from dispatch, not Dayforce". */
const titleCaseCanon = (canon) =>
    canon
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

/**
 * Efficiency sub-page — joins Dayforce actual hours with dispatch
 * yardage to surface yards-per-hour (YPH) at the PLANT and operator
 * level. Plant-first by design: the page leads with how each plant is
 * trending, then exposes the operator-level detail underneath for
 * dispatchers who need to drill into a specific driver.
 *
 * Layout:
 *   1. KPI strip — fleet YPH, plants on / below target, total yards,
 *      operator-data-mismatch counters.
 *   2. Per-plant scorecards (PRIMARY) — one large card per plant ranked
 *      by YPH, with the big number, a target-referenced fill bar, a
 *      colour-coded status pill, and supporting hours / yards lines.
 *   3. Operator spotlights — Top performers / Below target / Data
 *      check chips. Three thin columns so the dispatcher reads the
 *      names that need a conversation without scrolling.
 *   4. Per-operator table (SECONDARY, collapsed by default) — actual
 *      hours, yards, YPH, delta vs fleet with the 0..5 scale bar.
 */
export function DayforceEfficiencyPage({ accentColor, dateRange, plantCodes, selectedPlant }) {
    const accent = accentColor || '#1e3a5f'
    const dayforceMetrics = useDayforceOperatorMetrics({ dateRange, plantCodes, selectedPlant })
    const { diagnostics, excluded, hasSyncedData, isLoading: hoursLoading, perOperator, totals } = dayforceMetrics
    const {
        isLoading: yardageLoading,
        yardageByOperator,
        yardageByOperatorByPlant
    } = useOperatorYardageByDay({ dateRange })
    const isLoading = hoursLoading || yardageLoading

    /* Yards-for-operator getter — plant-aware when a plant filter is
     * active. With a plant filter, we ONLY credit yards loaded at that
     * plant (so an operator who clocked at plant 403 but cross-loaded at
     * 408 doesn't pad their plant-403 YPH with another plant's pours).
     * Without a filter, every yard counts toward fleet-level totals. */
    const yardsFor = useMemo(() => {
        if (!selectedPlant) return (canon) => (canon ? yardageByOperator.get(canon) || 0 : 0)
        const plantKey = String(selectedPlant)
        return (canon) => {
            if (!canon) return 0
            const bucket = yardageByOperatorByPlant.get(canon)
            return bucket ? bucket[plantKey] || 0 : 0
        }
    }, [selectedPlant, yardageByOperator, yardageByOperatorByPlant])

    /* Join Dayforce hours with dispatch yardage via canonical name key.
     * Same key used everywhere else (Schedules page, yardage hook). The
     * operator row inherits everything from `perOperator` and adds the
     * `yards` + `yph` it can claim from the dispatch side. */
    const operatorRows = useMemo(() => {
        const usedKeys = new Set()
        const rows = perOperator.map((op) => {
            const canon = canonicalNameKey(op.name)
            const yards = yardsFor(canon)
            if (canon) usedKeys.add(canon)
            const yph = op.actualHours > 0 && yards > 0 ? yards / op.actualHours : 0
            return { ...op, canonKey: canon, yards, yph }
        })
        /* Dispatch-side yardage that didn't match any Dayforce operator —
         * usually a name spelling drift, a contractor, or an inactive
         * operator who's still showing up on tickets. Surfaced as
         * "phantom" rows so the dispatcher can chase the mismatch.
         *
         * Plant-filtered case: only flag phantoms whose yardage at the
         * selected plant > 0 — operators from other plants are not this
         * plant's problem and would otherwise flood the Data Check
         * column with unrelated names. */
        const phantoms = []
        for (const [canon] of yardageByOperator.entries()) {
            if (usedKeys.has(canon)) continue
            const yards = yardsFor(canon)
            if (!yards) continue
            phantoms.push({
                actualHours: 0,
                badge: null,
                canonKey: canon,
                dayforceEmployeeId: `phantom-${canon}`,
                isMatched: false,
                isPhantom: true,
                name: titleCaseCanon(canon),
                plantCode: null,
                position: null,
                yards,
                yph: 0
            })
        }
        return [...rows, ...phantoms]
    }, [perOperator, yardageByOperator, yardsFor])

    const filters = useDayforceOperatorFilters({ defaultSort: 'yph', rows: operatorRows })

    /* Fleet YPH — total yards across the (matched) operator set divided
     * by total Dayforce hours. Phantoms are excluded from the denominator
     * because their hours are zero by definition. */
    const fleetYph = useMemo(() => {
        const matched = operatorRows.filter((r) => !r.isPhantom)
        const totalYards = matched.reduce((sum, r) => sum + (r.yards || 0), 0)
        const totalHours = matched.reduce((sum, r) => sum + (r.actualHours || 0), 0)
        return totalHours > 0 ? totalYards / totalHours : 0
    }, [operatorRows])

    const medianYph = useMemo(
        () =>
            median(
                operatorRows
                    .filter((r) => !r.isPhantom && r.actualHours >= MIN_HOURS_FOR_RANKING && r.yph > 0)
                    .map((r) => r.yph)
            ),
        [operatorRows]
    )

    /* Spotlight buckets. Every spotlight excludes phantoms and tiny-hour
     * rows from the leaderboard sense — they get a dedicated "Data
     * check" column so they're seen, not lost. */
    const spotlights = useMemo(() => {
        const eligible = operatorRows.filter((r) => !r.isPhantom && r.actualHours >= MIN_HOURS_FOR_RANKING && r.yph > 0)
        const top = [...eligible].sort((a, b) => b.yph - a.yph).slice(0, 8)
        const bottom = [...eligible]
            .filter((r) => r.yph < YPH_TARGET)
            .sort((a, b) => a.yph - b.yph)
            .slice(0, 8)
        const hoursNoYards = operatorRows
            .filter((r) => !r.isPhantom && r.actualHours >= MIN_HOURS_FOR_RANKING && r.yards === 0)
            .sort((a, b) => b.actualHours - a.actualHours)
            .slice(0, 6)
        const yardsNoHours = operatorRows
            .filter((r) => r.isPhantom)
            .sort((a, b) => b.yards - a.yards)
            .slice(0, 6)
        return { bottom, hoursNoYards, top, yardsNoHours }
    }, [operatorRows])

    /* Per-plant rollup — aggregates matched operators by their roster
     * plant. Phantoms have no plant and would skew the rollup, so
     * they're excluded. */
    const perPlant = useMemo(() => {
        const map = new Map()
        for (const row of operatorRows) {
            if (row.isPhantom) continue
            const code = row.plantCode || 'Unassigned'
            const entry = map.get(code) || {
                actualHours: 0,
                code,
                name: code,
                operatorIds: new Set(),
                yards: 0
            }
            entry.actualHours += row.actualHours || 0
            entry.yards += row.yards || 0
            entry.operatorIds.add(row.dayforceEmployeeId)
            map.set(code, entry)
        }
        return [...map.values()]
            .map((e) => ({
                actualHours: e.actualHours,
                code: e.code,
                name: e.name,
                operatorCount: e.operatorIds.size,
                yards: e.yards,
                yph: e.actualHours > 0 ? e.yards / e.actualHours : 0
            }))
            .sort((a, b) => b.yph - a.yph)
    }, [operatorRows])

    const totalYards = useMemo(
        () => operatorRows.filter((r) => !r.isPhantom).reduce((sum, r) => sum + (r.yards || 0), 0),
        [operatorRows]
    )
    /* Plant-level status counts drive the headline KPI strip — operator
     * threshold counts moved into the secondary "Operator detail" tray
     * where they're contextually relevant. */
    const plantStatusCounts = useMemo(() => {
        const counts = { 'below-target': 0, exceptional: 0, 'no-data': 0, 'on-target': 0 }
        for (const p of perPlant) counts[plantStatusFor(p.yph)] += 1
        return counts
    }, [perPlant])
    const topPlant = perPlant.length > 0 ? perPlant[0] : null
    const [operatorDetailOpen, setOperatorDetailOpen] = useState(false)

    if (isLoading && diagnostics.shiftsLoaded === 0 && yardageByOperator.size === 0) return <LoadingSkeleton />

    if (diagnostics.loadError) {
        return (
            <Panel title="Couldn't load Dayforce data" innerClassName="p-3">
                <div className="flex items-start gap-3 text-[12.5px]">
                    <i
                        className="fas fa-circle-exclamation text-[14px] mt-0.5"
                        style={{ color: 'var(--text-primary)' }}
                    />
                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold text-text-primary">Query error</span>
                        <span className="text-text-secondary font-mono break-all">{diagnostics.loadError}</span>
                    </div>
                </div>
            </Panel>
        )
    }

    if (!hasSyncedData) {
        return (
            <Panel title="Efficiency" innerClassName="p-0">
                <EmptySection
                    icon="fa-cloud-arrow-down"
                    message="No Dayforce timesheet data has been imported yet. Efficiency appears here after the dayforce-bridge userscript completes its first cycle."
                />
            </Panel>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Efficiency summary"
                right={
                    isLoading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {fmtRange(dateRange?.start, dateRange?.end)}
                        </span>
                    )
                }
                innerClassName="p-3"
            >
                <StatGroup columns={5}>
                    <Stat
                        label="Fleet YPH"
                        value={fmtYph(fleetYph)}
                        hint={`${fmtYards(totalYards)} ÷ ${fmtHours(totals.totalActualHours)}`}
                    />
                    <Stat
                        label="Plants on target"
                        value={`${fmtInt(plantStatusCounts['on-target'] + plantStatusCounts.exceptional)} / ${fmtInt(perPlant.length)}`}
                        hint={`≥ ${YPH_TARGET} YPH${plantStatusCounts.exceptional ? ` · ${plantStatusCounts.exceptional} exceptional` : ''}`}
                    />
                    <Stat
                        label="Plants below target"
                        value={fmtInt(plantStatusCounts['below-target'])}
                        hint={
                            plantStatusCounts['no-data']
                                ? `+${plantStatusCounts['no-data']} with no yardage`
                                : `Target ${YPH_TARGET} YPH`
                        }
                    />
                    <Stat
                        label="Top plant"
                        value={topPlant && topPlant.yph > 0 ? fmtYph(topPlant.yph) : '—'}
                        hint={
                            topPlant && topPlant.yph > 0
                                ? `${topPlant.code} · ${topPlant.name}`
                                : 'No plant yardage yet'
                        }
                    />
                    <Stat
                        label="Data mismatches"
                        value={fmtInt(spotlights.hoursNoYards.length + spotlights.yardsNoHours.length)}
                        hint={
                            spotlights.hoursNoYards.length + spotlights.yardsNoHours.length > 0
                                ? `${spotlights.hoursNoYards.length} hours w/o yards · ${spotlights.yardsNoHours.length} yards w/o hours`
                                : 'Dayforce and dispatch line up'
                        }
                    />
                </StatGroup>
            </Panel>

            <Panel
                title="Plant efficiency"
                innerClassName="p-3"
                right={
                    isLoading ? (
                        <RefreshingHint when />
                    ) : (
                        <span className="text-[11px] text-text-tertiary">
                            {perPlant.length} plant{perPlant.length === 1 ? '' : 's'} · sorted by YPH
                        </span>
                    )
                }
            >
                {perPlant.length === 0 ? (
                    <EmptySection icon="fa-industry" message="No plant-attributed hours in this window." />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {perPlant.map((row) => (
                            <PlantScorecard key={row.code} fleetYph={fleetYph} row={row} />
                        ))}
                    </div>
                )}
            </Panel>

            <Panel
                title="Operator highlights"
                innerClassName="p-3"
                right={
                    <span className="text-[11px] text-text-tertiary">
                        Median operator {fmtYph(medianYph)} · ≥{MIN_HOURS_FOR_RANKING}h to qualify
                    </span>
                }
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <SpotlightColumn
                        accentColor="#15803d"
                        count={spotlights.top.length}
                        emptyMessage="No qualifying operators yet."
                        hint={`Top YPH · ≥${MIN_HOURS_FOR_RANKING}h`}
                        icon="fa-trophy"
                        title="Top performers"
                    >
                        {spotlights.top.map((row) => (
                            <SpotlightChip
                                key={row.dayforceEmployeeId}
                                accent={accent}
                                primary={fmtYph(row.yph)}
                                secondary={`${fmtYards(row.yards)} on ${fmtHours(row.actualHours)}`}
                                row={row}
                            />
                        ))}
                    </SpotlightColumn>

                    <SpotlightColumn
                        accentColor="#b91c1c"
                        count={spotlights.bottom.length}
                        emptyMessage={`Nobody below ${YPH_TARGET} YPH.`}
                        hint={`< ${YPH_TARGET} YPH · ≥${MIN_HOURS_FOR_RANKING}h`}
                        icon="fa-triangle-exclamation"
                        title="Below target"
                    >
                        {spotlights.bottom.map((row) => (
                            <SpotlightChip
                                key={row.dayforceEmployeeId}
                                accent={accent}
                                primary={fmtYph(row.yph)}
                                secondary={`${fmtYards(row.yards)} on ${fmtHours(row.actualHours)}`}
                                row={row}
                            />
                        ))}
                    </SpotlightColumn>

                    <SpotlightColumn
                        accentColor="#b45309"
                        count={spotlights.hoursNoYards.length + spotlights.yardsNoHours.length}
                        emptyMessage="Dayforce and dispatch line up clean."
                        hint="Mismatches to investigate"
                        icon="fa-magnifying-glass-chart"
                        title="Data check"
                    >
                        {spotlights.hoursNoYards.map((row) => (
                            <SpotlightChip
                                key={`hno-${row.dayforceEmployeeId}`}
                                accent={accent}
                                primary={fmtHours(row.actualHours)}
                                secondary={`${row.position || 'Operator'} · 0 yards on dispatch`}
                                row={row}
                            />
                        ))}
                        {spotlights.yardsNoHours.map((row) => (
                            <SpotlightChip
                                key={`ynh-${row.canonKey}`}
                                accent={accent}
                                primary={fmtYards(row.yards)}
                                secondary="Dispatch ticket name not in Dayforce"
                                row={row}
                            />
                        ))}
                    </SpotlightColumn>
                </div>
            </Panel>

            <Panel
                title="Operator detail"
                innerClassName={operatorDetailOpen ? 'p-3' : 'p-0'}
                right={
                    <button
                        type="button"
                        onClick={() => setOperatorDetailOpen((s) => !s)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border-light px-2.5 py-1 text-[11px] font-semibold cursor-pointer bg-bg-tertiary text-text-secondary hover:text-text-primary"
                    >
                        <i className={`fas fa-chevron-${operatorDetailOpen ? 'up' : 'down'} text-[9px]`} />
                        {operatorDetailOpen ? 'Hide table' : `Show all ${operatorRows.length} operators`}
                    </button>
                }
            >
                {operatorDetailOpen && (
                    <div className="flex flex-col gap-3">
                        <DayforceFilters
                            accent={accent}
                            availablePositions={filters.availablePositions}
                            controls={filters.controls}
                            excluded={excluded}
                            onReset={filters.reset}
                            setPosition={filters.setPosition}
                            setSearch={filters.setSearch}
                            setSort={filters.setSort}
                            sortIds={EFFICIENCY_SORT_IDS}
                            visibleCount={filters.filtered.length}
                        />
                        {filters.filtered.length === 0 ? (
                            <EmptySection
                                icon="fa-filter-circle-xmark"
                                message="No operators match these filters. Widen the date range in the top bar or clear the search / role filters."
                            />
                        ) : (
                            <div className="rounded border border-border-light overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-light bg-bg-secondary">
                                    <span className="w-14 shrink-0">Badge</span>
                                    <span className="flex-1">Operator</span>
                                    <span className="w-16 text-right shrink-0">Hours</span>
                                    <span className="w-20 text-right shrink-0">Yards</span>
                                    <span className="w-14 text-right shrink-0">YPH</span>
                                    <span className="w-16 text-right shrink-0">vs Fleet</span>
                                </div>
                                {filters.filtered.map((row) => (
                                    <OperatorEfficiencyRow
                                        key={row.dayforceEmployeeId}
                                        accent={accent}
                                        fleetYph={fleetYph}
                                        row={row}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Panel>
        </div>
    )
}

export default DayforceEfficiencyPage
