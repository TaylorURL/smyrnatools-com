/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'

const COLOR_WARN = 'var(--status-warning)'

const USD = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })

const fmtMoney = (n) => USD.format(Number(n) || 0)
const fmtHours = (n) => `${fmtFloat(n, 1)}h`

/** Plant pressure table — matches the visual vocabulary of
 *  PlantScorecardTable on the Service tab: real <table>, bg-bg-tertiary
 *  headers in 10.5px uppercase, 12.5px row cells. The single difference
 *  is a "Pressure" column with an inline bar showing relative OT cost,
 *  and that each row is clickable to scope the page to that plant. */
function PlantPressureTable({ focusedPlantCode, maxOtCost, onTogglePlant, plants }) {
    return (
        <div className="overflow-x-auto rounded border border-border-light">
            <table className="w-full min-w-[680px] border-collapse">
                <thead>
                    <tr>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-left">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-left hidden sm:table-cell">
                            Pressure (rel. OT cost)
                        </th>
                        <th
                            className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right cursor-help"
                            title="Operators in OT / total operators at plant"
                        >
                            In OT
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right">
                            OT hrs
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right">
                            OT cost
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {plants.map((plant) => {
                        const isSelected = focusedPlantCode === plant.code
                        const otCostPct = maxOtCost > 0 ? (plant.otCost / maxOtCost) * 100 : 0
                        return (
                            <tr
                                key={plant.code}
                                onClick={() => onTogglePlant(plant.code)}
                                title={isSelected ? 'Clear plant filter' : `Filter to ${plant.code}`}
                                className={`border-t border-border-light cursor-pointer transition-colors ${
                                    isSelected ? 'bg-bg-secondary' : 'hover:bg-bg-secondary'
                                }`}
                            >
                                <td className="px-3 py-2 text-[12.5px] text-text-primary">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                                            {plant.code || '—'}
                                        </span>
                                        <span className="font-semibold truncate">
                                            {plant.name || plant.code || '—'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell">
                                    <div className="h-2 rounded-sm overflow-hidden bg-bg-tertiary w-full max-w-[240px]">
                                        <div
                                            className="h-full"
                                            style={{ background: COLOR_WARN, width: `${otCostPct}%` }}
                                        />
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {plant.operatorsOverOt > 0
                                        ? `${plant.operatorsOverOt}/${plant.operatorCount}`
                                        : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums font-semibold text-text-primary">
                                    {plant.otHours > 0 ? fmtHours(plant.otHours) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums font-semibold text-text-primary">
                                    {plant.otCost > 0 ? fmtMoney(plant.otCost) : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default PlantPressureTable
