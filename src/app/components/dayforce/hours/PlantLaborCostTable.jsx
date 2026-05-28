/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'

const USD = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })

const fmtMoney = (n) => USD.format(Number(n) || 0)
const fmtHours = (n) => `${fmtFloat(n, 1)}h`

/** Plant labor cost table — per-plant breakdown of regular vs OT hours
 *  and total labor cost. OT respects the daily-AND-weekly rule
 *  (`computeWeeklyCost` in DayforcePayrollUtility): time-and-a-half for
 *  hours past 8 in a single day OR past 40 in a single week. The subtle
 *  cost-share bar lets the dispatcher see which plants are eating the
 *  biggest slice of payroll at a glance. */
function PlantLaborCostTable({ accent, maxTotalCost, plants }) {
    return (
        <div className="overflow-x-auto rounded border border-border-light">
            <table className="w-full min-w-[720px] border-collapse">
                <thead>
                    <tr>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-left">
                            Plant
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-left hidden sm:table-cell">
                            Cost share
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right">
                            Reg hrs
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right">
                            OT hrs
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right hidden md:table-cell">
                            Total hrs
                        </th>
                        <th className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap border-b border-border-light bg-bg-tertiary text-text-tertiary text-right">
                            Labor cost
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {plants.map((plant) => {
                        const sharePct = maxTotalCost > 0 ? (plant.totalCost / maxTotalCost) * 100 : 0
                        return (
                            <tr key={plant.code} className="border-t border-border-light hover:bg-bg-secondary">
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
                                        <div className="h-full" style={{ background: accent, width: `${sharePct}%` }} />
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {plant.regHours > 0 ? fmtHours(plant.regHours) : '—'}
                                </td>
                                <td
                                    className={`px-3 py-2 text-right text-[12.5px] tabular-nums ${
                                        plant.otHours > 0 ? 'text-text-primary font-semibold' : 'text-text-tertiary'
                                    }`}
                                >
                                    {plant.otHours > 0 ? fmtHours(plant.otHours) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary hidden md:table-cell">
                                    {plant.totalHours > 0 ? fmtHours(plant.totalHours) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums font-semibold text-text-primary">
                                    {plant.totalCost > 0 ? fmtMoney(plant.totalCost) : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default PlantLaborCostTable
