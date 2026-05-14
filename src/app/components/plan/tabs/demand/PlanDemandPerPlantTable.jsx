/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { supplyVerdict } from '../../../../../utils/PlanDemandUtility'

const COVERAGE_DISPLAY_MAX_PCT = 150
const COVERAGE_BAR_BENCHMARK_PCT = 110

const TABLE_HEADERS = [
    { align: 'left', label: 'Plant' },
    { align: 'right', label: 'Yardage' },
    { align: 'right', label: 'Trucks (effective)' },
    { align: 'right', label: 'Peak demand' },
    { align: 'left', label: 'Coverage' }
]

/**
 * Per-plant breakdown table — one row per plant in the active demand
 * filter, showing total yardage, effective truck supply (base ± help in/
 * out), peak concurrent demand, and the supply-vs-demand verdict pill.
 *
 * Each row's "Coverage" bar fills against a 110% benchmark with a
 * vertical 100% marker, so dispatchers can spot tight plants at a
 * glance without reading the percentage text.
 */
export function PlanDemandPerPlantTable({ peakByPlant, plantColorByCode, rows }) {
    return (
        <div className="rounded-xl overflow-hidden bg-bg-primary border border-border-light">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-border-light">
                <div className="text-[13px] font-bold text-text-primary font-heading">Breakdown by plant</div>
                <div className="text-[11px] text-text-secondary">
                    Yards · trucks (incl. help) · how well supply meets demand
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse">
                    <thead>
                        <tr>
                            {TABLE_HEADERS.map((header) => (
                                <th
                                    key={header.label}
                                    className={`px-3 py-2 font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap ${
                                        header.align === 'right' ? 'text-right' : 'text-left'
                                    } bg-bg-tertiary border-b border-border-light text-text-secondary`}
                                >
                                    {header.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((plant) => (
                            <PerPlantRow
                                key={plant.code}
                                color={plantColorByCode[plant.code]}
                                peak={peakByPlant[plant.code] || 0}
                                plant={plant}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function PerPlantRow({ color, peak, plant }) {
    const supply = plant.adjustedBase || 0
    const baseTrucks = supply + (plant.helpSend || 0) - (plant.helpRecv || 0)
    const verdict = supplyVerdict(supply, peak)
    const coveragePct =
        verdict.tone === 'idle' ? null : Math.min(COVERAGE_DISPLAY_MAX_PCT, Math.round(verdict.coverage))
    const helpParts = []
    if (plant.helpRecv > 0) helpParts.push(`+${plant.helpRecv} in`)
    if (plant.helpSend > 0) helpParts.push(`−${plant.helpSend} out`)
    const helpLine = helpParts.length ? `${baseTrucks} base · ${helpParts.join(' · ')}` : `${baseTrucks} base`

    return (
        <tr className="border-t border-border-light">
            <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="inline-block rounded h-2.5 w-2.5" style={{ background: color }} />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary font-heading">{plant.code}</span>
                            <span className="text-[11px] text-text-tertiary">
                                {plant.name !== plant.code ? plant.name : ''}
                            </span>
                        </div>
                        <span className="text-[10.5px] text-text-tertiary">
                            {plant.orders} order{plant.orders === 1 ? '' : 's'}
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap text-right text-text-primary">
                {Math.round(plant.totalYardage).toLocaleString()} yd
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
                <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-[14px] tabular-nums text-text-primary">{supply}</span>
                    <span
                        className="text-[10.5px] font-mono text-text-tertiary"
                        title="Effective truck pool — base ± inter-plant help today"
                    >
                        {helpLine}
                    </span>
                </div>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
                <div className="flex flex-col items-end">
                    <span
                        className="font-mono font-bold text-[14px] tabular-nums"
                        style={{ color: peak > supply && supply > 0 ? '#dc2626' : 'var(--text-primary)' }}
                    >
                        {peak}
                    </span>
                    <span
                        className="text-[10.5px] font-mono text-text-tertiary"
                        title="Peak concurrent trucks the schedule needs at any hour"
                    >
                        concurrent
                    </span>
                </div>
            </td>
            <td className="px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-[180px]">
                    <div
                        className="rounded h-2 flex-1 overflow-hidden relative bg-bg-tertiary"
                        title={coveragePct == null ? 'No demand scheduled' : `Supply / demand = ${coveragePct}%`}
                    >
                        {coveragePct != null && (
                            <>
                                <div
                                    className="rounded h-2"
                                    style={{
                                        background: verdict.color,
                                        width: `${Math.min(100, (coveragePct / COVERAGE_BAR_BENCHMARK_PCT) * 100)}%`
                                    }}
                                />
                                {/* 100% marker — visual reference for "supply equals demand". */}
                                <div
                                    className="absolute top-0 bottom-0 bg-[var(--text-tertiary)] opacity-50 w-px"
                                    style={{ left: `${(100 / COVERAGE_BAR_BENCHMARK_PCT) * 100}%` }}
                                />
                            </>
                        )}
                    </div>
                    <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                        style={{ background: `${verdict.color}1f`, color: verdict.color }}
                    >
                        {verdict.label}
                        {coveragePct != null && <span className="font-mono opacity-85">· {coveragePct}%</span>}
                    </span>
                </div>
            </td>
        </tr>
    )
}
