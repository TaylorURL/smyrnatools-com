import React, { useMemo } from 'react'

import { PlanStatisticsControls } from '../../../app/components/plan/PlanStatisticsControls'
import { PlanStatisticsKpiStrip } from '../../../app/components/plan/PlanStatisticsKpiStrip'
import { PlanStatisticsPanels } from '../../../app/components/plan/PlanStatisticsPanels'
import { usePlanStatistics } from '../../../app/hooks/usePlanStatistics'
import { fmtRange } from '../../../utils/PlanStatisticsFormatUtility'
import { buildScheduleCsv } from '../../../utils/PlanStatisticsUtility'

/** How many rows to show in the customer / product top lists. */
const TOP_LIST_LIMIT = 8

/**
 * Statistics dashboard for the Plan tab. Loads the per-day saved schedule
 * snapshots (`plant_production` JSON on each plan row) across the selected
 * range and compares yardage / loads / orders / customers / products /
 * hourly shape against an optional previous period or the same period last
 * year. Pure schedule-side metrics — no dispatch-plan / help-route mixing.
 */
function PlanStatisticsView({ accentColor, planDate, plantNameByCode, liveProduction, mixerCountsByPlant }) {
    const stats = usePlanStatistics({ liveProduction, planDate })
    const {
        anchor,
        availablePlantCodes,
        comparison,
        currentDays,
        currentSummary,
        customEnd,
        customStart,
        isSingleDay,
        loading,
        period,
        previousSummary,
        range,
        satisfactionAggregate,
        satisfactionByDay,
        satisfactionLoading,
        selectedPlant,
        setAnchor,
        setComparison,
        setCustomEnd,
        setCustomStart,
        setPeriod,
        setSelectedPlant,
        trendComparison,
        trendData,
        workingDayCount
    } = stats

    /** The schedule HTML occasionally lists ghost plant codes (956, 601, 265, …)
     *  that are sentinels or stale entries — not real production plants. The
     *  authoritative list of real plants is `plantNameByCode`, populated from
     *  the `plants` table, so we only surface scorecard / chart rows for
     *  codes that have a name registered there. */
    const knownPlantRows = useMemo(
        () => Object.values(currentSummary.perPlant).filter((p) => Boolean(plantNameByCode?.[p.code])),
        [currentSummary, plantNameByCode]
    )

    const knownPlantSummary = useMemo(() => {
        const totalYardage = knownPlantRows.reduce((sum, p) => sum + (p.yardage || 0), 0)
        const activeCount = knownPlantRows.filter((p) => p.yardage > 0 || p.loads > 0).length
        const top = [...knownPlantRows].sort((a, b) => b.yardage - a.yardage)[0]
        const topShare =
            top && totalYardage > 0 ? { code: top.code, share: top.yardage / totalYardage, yardage: top.yardage } : null
        return { activeCount, topShare, totalYardage }
    }, [knownPlantRows])

    const topCustomers = useMemo(
        () =>
            Object.values(currentSummary.perCustomer)
                .filter((c) => c.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, TOP_LIST_LIMIT),
        [currentSummary]
    )
    const topProducts = useMemo(
        () =>
            Object.values(currentSummary.perProduct)
                .filter((c) => c.yardage > 0)
                .sort((a, b) => b.yardage - a.yardage)
                .slice(0, TOP_LIST_LIMIT),
        [currentSummary]
    )

    const handleExport = () => {
        const csv = buildScheduleCsv(currentDays)
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `schedule-stats-${range.current.start}_to_${range.current.end}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto" data-content-scroll>
            <div className="px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
                <PlanStatisticsControls
                    accentColor={accentColor}
                    anchor={anchor}
                    availablePlantCodes={availablePlantCodes}
                    canExport={currentDays.length > 0}
                    comparison={comparison}
                    customEnd={customEnd}
                    customStart={customStart}
                    onExport={handleExport}
                    period={period}
                    plantNameByCode={plantNameByCode}
                    range={range}
                    selectedPlant={selectedPlant}
                    setAnchor={setAnchor}
                    setComparison={setComparison}
                    setCustomEnd={setCustomEnd}
                    setCustomStart={setCustomStart}
                    setPeriod={setPeriod}
                    setSelectedPlant={setSelectedPlant}
                />

                <PlanStatisticsKpiStrip
                    currentSummary={currentSummary}
                    previousSummary={previousSummary}
                    workingDayCount={workingDayCount}
                />

                {loading && (
                    <div
                        className="rounded px-4 py-3 flex items-center gap-2 text-xs"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <i className="fas fa-spinner fa-spin" />
                        Loading schedule data…
                    </div>
                )}

                {!loading && currentDays.length === 0 && (
                    <div
                        className="rounded p-8 text-center text-sm"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <i
                            className="fas fa-chart-line text-2xl mb-2 block"
                            style={{ color: 'var(--text-tertiary)' }}
                        />
                        No saved schedules in {fmtRange(range.current.start, range.current.end)}.
                    </div>
                )}

                {!loading && currentDays.length > 0 && (
                    <PlanStatisticsPanels
                        accentColor={accentColor}
                        comparison={comparison}
                        currentDays={currentDays}
                        currentSummary={currentSummary}
                        isSingleDay={isSingleDay}
                        knownPlantRows={knownPlantRows}
                        knownPlantSummary={knownPlantSummary}
                        mixerCountsByPlant={mixerCountsByPlant}
                        plantNameByCode={plantNameByCode}
                        previousSummary={previousSummary}
                        satisfactionAggregate={satisfactionAggregate}
                        satisfactionByDay={satisfactionByDay}
                        satisfactionLoading={satisfactionLoading}
                        selectedPlant={selectedPlant}
                        topCustomers={topCustomers}
                        topProducts={topProducts}
                        trendComparison={trendComparison}
                        trendData={trendData}
                    />
                )}
            </div>
        </div>
    )
}

export default PlanStatisticsView
