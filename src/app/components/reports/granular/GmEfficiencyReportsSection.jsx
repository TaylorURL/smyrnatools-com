import React from 'react'

import { ReportService } from '../../../../services/ReportService'
import { GmEmptyState, GmSectionHeader } from './GmAtoms'

/** Builds the seven KPI tiles shown at the bottom of each plant
 *  efficiency report. Values are formatted to two decimals where
 *  applicable. */
function buildKpiTiles(insights) {
    return [
        { label: 'Total Loads', value: insights.totalLoads || 0 },
        { label: 'Total Hours', value: insights.totalHours !== null ? insights.totalHours.toFixed(2) : '--' },
        { label: 'Avg Loads', value: insights.avgLoads !== null ? insights.avgLoads.toFixed(2) : '--' },
        { label: 'Avg Hours', value: insights.avgHours !== null ? insights.avgHours.toFixed(2) : '--' },
        {
            label: 'Avg L/H',
            value: insights.avgLoadsPerHour !== null ? insights.avgLoadsPerHour.toFixed(2) : '--'
        },
        {
            label: 'Punch In → 1st',
            value: insights.avgElapsedStart !== null ? `${insights.avgElapsedStart.toFixed(1)} min` : '--'
        },
        {
            label: 'Washout → Punch',
            value: insights.avgElapsedEnd !== null ? `${insights.avgElapsedEnd.toFixed(1)} min` : '--'
        }
    ]
}

/** Dot-style pagination indicators for the efficiency-report carousel. */
function CarouselDots({ effIdx, effReports, setEffIdx }) {
    return (
        <div className="flex flex-wrap gap-2 mb-4 rounded-lg bg-slate-50 p-3">
            {effReports.map((r, i) => (
                <div
                    key={r.id}
                    onClick={() => setEffIdx(i)}
                    className={`h-3 w-3 rounded-full cursor-pointer transition-all ${i === effIdx ? 'bg-accent scale-[1.3]' : 'bg-slate-300 hover:bg-slate-400 hover:scale-110'}`}
                    aria-label={`Efficiency Report ${i + 1}`}
                ></div>
            ))}
        </div>
    )
}

/** Prev / Next buttons for the efficiency-report carousel. */
function CarouselNavButtons({ effIdx, effReports, setEffIdx }) {
    return (
        <div className="flex gap-2">
            <button
                type="button"
                className="rounded-md border border-gray-200 bg-slate-100 px-4 py-2 text-[0.8125rem] font-semibold text-slate-600 cursor-pointer transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setEffIdx((i) => Math.max(i - 1, 0))}
                disabled={effIdx === 0}
            >
                ← Prev Report
            </button>
            <button
                type="button"
                className="rounded-md border-none bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white cursor-pointer transition-colors hover:bg-accent-hover disabled:bg-slate-400 disabled:cursor-not-allowed"
                onClick={() => setEffIdx((i) => Math.min(i + 1, effReports.length - 1))}
                disabled={effIdx === effReports.length - 1}
            >
                Next Report →
            </button>
        </div>
    )
}

/** Single KPI tile — label + value. */
function KpiTile({ label, value }) {
    return (
        <div className="text-center rounded-lg border border-gray-200 bg-slate-50 p-3.5">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</div>
            <div className="text-lg font-bold text-accent">{value}</div>
        </div>
    )
}

/** Current-report KPI card — header, nav buttons, KPI tiles grid. */
function EfficiencyReportCard({ effIdx, effReports, setEffIdx }) {
    const report = effReports[effIdx]
    const insights = ReportService.getPlantProductionInsights(report.rows || [])
    const tiles = buildKpiTiles(insights)
    return (
        <div className="rounded-lg border border-gray-200 bg-bg-primary p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="text-lg font-semibold text-slate-800 m-0">
                    {report.plant_name} ({report.plant_code}){report.report_date ? ` - ${report.report_date}` : ''}
                </div>
                <CarouselNavButtons effIdx={effIdx} effReports={effReports} setEffIdx={setEffIdx} />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-3 mt-5 mb-4">
                {tiles.map((tile) => (
                    <KpiTile key={tile.label} {...tile} />
                ))}
            </div>
        </div>
    )
}

/** Plant Efficiency Reports section — carousel header, dots, KPI card. */
export function GmEfficiencyReportsSection({ effIdx, effReports, setEffIdx }) {
    const badge =
        effReports.length > 0 ? (
            <span className="inline-flex rounded-md bg-sky-100 px-2.5 py-1 text-xs font-semibold text-text-primary">
                {effIdx + 1} of {effReports.length}
            </span>
        ) : null
    return (
        <>
            <GmSectionHeader badge={badge} title="Plant Efficiency Reports" />
            {effReports.length === 0 ? (
                <GmEmptyState message="No plant efficiency reports found for this week." />
            ) : (
                <div className="flex flex-col gap-4">
                    <CarouselDots effIdx={effIdx} effReports={effReports} setEffIdx={setEffIdx} />
                    <EfficiencyReportCard effIdx={effIdx} effReports={effReports} setEffIdx={setEffIdx} />
                </div>
            )}
        </>
    )
}
