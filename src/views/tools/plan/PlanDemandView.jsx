import React, { useMemo, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import {
    ByPlantBarChart,
    CapacityVsPeakChart,
    CumulativeYardageChart,
    HourlyTrucksLineChart,
    PlanDemandEmptyState,
    ProductMixPieChart,
    StackedHourlyAreaChart,
    TopCustomersBarChart,
    YardageSharePieChart
} from '../../../app/components/plan/tabs/demand/PlanDemandCharts'
import { PlanChartModeToggle, PlanTimeOfDayBar } from '../../../app/components/plan/tabs/demand/PlanDemandControls'
import { PlanDemandPerPlantTable } from '../../../app/components/plan/tabs/demand/PlanDemandPerPlantTable'
import { Panel, Stat, StatGroup } from '../../../app/components/ui/Panel'
import PlantFilterButton from '../../../app/components/ui/PlantFilterButton'
import {
    buildDemandData,
    buildPerPlantCsv,
    downloadCsvFile,
    FALLBACK_SERIES_COLORS
} from '../../../utils/PlanDemandUtility'
import { formatPlantFilterDisplay, resolvePlantFilterCodes } from '../../../utils/PlanRuntimeUtility'
import { PLAN_META_KEY, plantBadgeColor } from '../../../utils/PlanUtility'

const CHART_OPTIONS = [
    { group: 'Demand', icon: 'fa-chart-line', key: 'hourly', label: 'Hourly trucks' },
    { group: 'Demand', icon: 'fa-chart-column', key: 'byPlant', label: 'Trucks by plant' },
    { group: 'Demand', icon: 'fa-layer-group', key: 'stacked', label: 'Stacked by plant' },
    { group: 'Yardage', icon: 'fa-chart-pie', key: 'yardageShare', label: 'Yardage share' },
    { group: 'Yardage', icon: 'fa-chart-area', key: 'cumulative', label: 'Cumulative yd' },
    { group: 'Insights', icon: 'fa-scale-unbalanced', key: 'capacity', label: 'Capacity vs peak' },
    { group: 'Insights', icon: 'fa-users', key: 'customers', label: 'Top customers' },
    { group: 'Insights', icon: 'fa-flask', key: 'products', label: 'Product mix' }
]

/** Color scheme for utilization KPI: red over 100%, amber over 85%, green
 *  otherwise — same thresholds the schedule tab uses for the truck-pool
 *  health indicator. */
const utilizationColor = (pct) => {
    if (pct > 100) return '#dc2626'
    if (pct > 85) return '#d97706'
    return '#16a34a'
}

/** Render the active chart for the chosen mode. Lifted out of the main
 *  component body so the JSX stays linear. */
function DemandChart({ accentColor, chartMode, data, plantColorByCode }) {
    if (data.totals.trucks === 0 && chartMode !== 'capacity') return <PlanDemandEmptyState />
    switch (chartMode) {
        case 'hourly':
            return <HourlyTrucksLineChart accent={accentColor} rows={data.hours} />
        case 'byPlant':
            return <ByPlantBarChart accent={accentColor} rows={data.perPlant} />
        case 'stacked':
            return (
                <StackedHourlyAreaChart
                    plantColor={plantColorByCode}
                    plants={data.perPlant}
                    rows={data.stackedHourly}
                />
            )
        case 'yardageShare':
            return (
                <YardageSharePieChart
                    plantColor={plantColorByCode}
                    plants={data.perPlant}
                    total={data.totals.yardage}
                />
            )
        case 'cumulative':
            return <CumulativeYardageChart accent={accentColor} rows={data.cumulativeHourly} />
        case 'capacity':
            return <CapacityVsPeakChart accent={accentColor} rows={data.capacityByPlant} />
        case 'customers':
            return <TopCustomersBarChart accent={accentColor} rows={data.topCustomers} />
        case 'products':
            return <ProductMixPieChart rows={data.productMix} total={data.totals.yardage} />
        default:
            return null
    }
}

/**
 * PlanDemandView — flat KPI row + chart panel + per-plant breakdown.
 * Every aggregate is built once via `buildDemandData` and shared across
 * the KPI tiles, charts, and table so totals stay consistent.
 */
function PlanDemandView({
    accentColor,
    planDate,
    plantNameByCode,
    plantProduction,
    plants = [],
    stats,
    userPlantCode = ''
}) {
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const [chartMode, setChartMode] = useState('hourly')
    const [plantFilter, setPlantFilter] = useState('all')
    const filterActive = plantFilter !== 'all' && plantFilter !== 'All' && plantFilter !== ''

    /** Every plant code that shows up in the day — drives the modal's
     *  fallback "All plants" count. */
    const plantOptions = useMemo(() => {
        const codes = new Set()
        ;(stats || []).forEach((stat) => stat?.code && codes.add(stat.code))
        Object.keys(plantProduction || {}).forEach((code) => {
            if (code !== PLAN_META_KEY) codes.add(code)
        })
        return Array.from(codes).sort()
    }, [stats, plantProduction])

    const allowedCodes = useMemo(
        () => resolvePlantFilterCodes({ plantFilter, plants, userPlantCode }),
        [plantFilter, plants, userPlantCode]
    )

    const data = useMemo(
        () => buildDemandData({ allowedCodes, planDate, plantNameByCode, plantProduction, stats }),
        [plantProduction, stats, plantNameByCode, planDate, allowedCodes]
    )

    const plantColorByCode = useMemo(() => {
        const out = {}
        data.perPlant.forEach((plant, i) => {
            out[plant.code] = plantBadgeColor(plant.code, FALLBACK_SERIES_COLORS[i % FALLBACK_SERIES_COLORS.length])
        })
        return out
    }, [data.perPlant])

    const friendlyDate = planDate
        ? new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              weekday: 'short',
              year: 'numeric'
          })
        : ''

    const handleExportCsv = () => {
        const csv = buildPerPlantCsv({ peakByPlant: data.peakByPlant, perPlant: data.perPlant, totals: data.totals })
        downloadCsvFile(csv, `demand-${planDate || 'day'}.csv`)
    }

    const utilColor = utilizationColor(data.capacityUtilization)
    const scopeLabel = formatPlantFilterDisplay({
        plantFilter,
        plantNameByCode,
        totalPlantOptions: plantOptions.length
    })
    const activeChart = CHART_OPTIONS.find((opt) => opt.key === chartMode)

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-border-light">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h2 className="text-[15px] font-bold m-0 shrink-0 text-text-primary">Demand</h2>
                        <span className="text-[12px] truncate text-text-secondary">
                            {scopeLabel} · {friendlyDate || 'today'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <PlantFilterButton
                            accentColor={accentColor}
                            active={filterActive}
                            displayText={scopeLabel}
                            onClick={() => setIsPlantModalOpen(true)}
                            title="Filter Demand to a plant, district, or My Plants"
                        />
                        {filterActive && (
                            <button
                                type="button"
                                onClick={() => setPlantFilter('all')}
                                className="border-none bg-transparent cursor-pointer text-[11px] font-medium px-1 text-text-secondary"
                                title="Clear plant filter"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={data.perPlant.length === 0}
                            className="border-none rounded text-[12px] font-medium px-2 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-bg-tertiary text-text-secondary"
                            title="Download the per-plant breakdown as CSV"
                        >
                            Export CSV
                        </button>
                    </div>
                </div>

                <StatGroup columns={8}>
                    <Stat label="Trucks" value={data.totals.trucks} />
                    <Stat label="Yardage" value={`${Math.round(data.totals.yardage).toLocaleString()} yd`} />
                    <Stat
                        label="Orders"
                        value={data.totals.orders}
                        hint={data.avgLoadSize ? `${data.avgLoadSize} yd avg` : null}
                    />
                    <Stat
                        label="Peak hour"
                        value={data.peakHour.label || '—'}
                        hint={data.peakHour.total > 0 ? `${data.peakHour.total} trucks` : null}
                    />
                    <Stat
                        label="Biggest pour"
                        value={data.biggestOrder ? `${Math.round(data.biggestOrder.yardage).toLocaleString()} yd` : '—'}
                        hint={data.biggestOrder ? data.biggestOrder.customer : null}
                    />
                    <Stat
                        label="Big pours"
                        value={data.bigPourCount}
                        hint={data.bigPourCount === 0 ? null : '120+ yd, back-to-back'}
                    />
                    <Stat
                        label="Utilization"
                        value={`${data.capacityUtilization}%`}
                        valueColor={utilColor}
                        hint={data.totalBase > 0 ? `${data.peakHour.total}/${data.totalBase} at peak` : null}
                    />
                    <Stat
                        label="Active plants"
                        value={`${data.perPlant.filter((plant) => plant.orders > 0).length}/${data.perPlant.length}`}
                    />
                </StatGroup>

                <PlanTimeOfDayBar totals={data.timeOfDay} grandTotal={data.totals.yardage} />

                <PlanChartModeToggle
                    accentColor={accentColor}
                    onChange={setChartMode}
                    options={CHART_OPTIONS}
                    value={chartMode}
                />

                <Panel
                    title={activeChart?.label || 'Chart'}
                    right={<span className="text-[11px] text-text-tertiary">{activeChart?.group || ''}</span>}
                >
                    <DemandChart
                        accentColor={accentColor}
                        chartMode={chartMode}
                        data={data}
                        plantColorByCode={plantColorByCode}
                    />
                </Panel>

                <PlanDemandPerPlantTable
                    peakByPlant={data.peakByPlant}
                    plantColorByCode={plantColorByCode}
                    rows={data.perPlant}
                />
            </div>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    plants={plants || []}
                    onSelect={(code) => {
                        setPlantFilter(!code || code === 'All' ? 'all' : code)
                        setIsPlantModalOpen(false)
                    }}
                    showAllPlants
                    showMyPlants={!!userPlantCode}
                    userPlantCode={userPlantCode}
                />
            )}
        </div>
    )
}

export default PlanDemandView
