/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'

const COLOR_WARN = 'var(--status-warning)'

const USD = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })

const fmtMoney = (n) => USD.format(Number(n) || 0)
const fmtHours = (n) => `${fmtFloat(n, 1)}h`

/** Single operator row — actual / OT / OT% / OT cost / PTO. Clickable:
 *  expands to reveal an inline 7-day shift strip below. */
function OperatorHoursRow({ accent, isExpanded, maxHours, onToggle, row }) {
    const otSharePct = row.actualHours > 0 ? (row.otHours / row.actualHours) * 100 : 0
    const pct = maxHours > 0 ? (row.actualHours / maxHours) * 100 : 0
    const otPct = maxHours > 0 ? (row.otHours / maxHours) * 100 : 0
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className={`w-full flex flex-col gap-1 px-3 py-2 border-t border-border-light first:border-t-0 text-left transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none ${
                isExpanded ? 'bg-bg-secondary' : 'hover:bg-bg-secondary'
            } active:scale-[0.97]`}
        >
            <div className="flex items-center gap-2 text-[12.5px]">
                <i
                    className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[9px] text-text-tertiary w-3 shrink-0`}
                    aria-hidden="true"
                />
                <span className="font-mono tabular-nums w-12 shrink-0 text-text-tertiary">{row.badge || '—'}</span>
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
                <span className="font-mono tabular-nums w-14 text-right shrink-0 text-text-primary font-semibold">
                    {fmtHours(row.actualHours)}
                </span>
                <span
                    className={`font-mono tabular-nums w-14 text-right shrink-0 font-semibold ${
                        row.otHours > 0 ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                >
                    {row.otHours > 0 ? fmtHours(row.otHours) : '—'}
                </span>
                <span
                    className={`font-mono tabular-nums w-12 text-right shrink-0 hidden sm:inline ${
                        otSharePct >= 15 ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                >
                    {otSharePct > 0 ? `${fmtFloat(otSharePct, 0)}%` : '—'}
                </span>
                <span
                    className={`font-mono tabular-nums w-20 text-right shrink-0 font-semibold ${
                        row.otCost > 0 ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                >
                    {row.otCost > 0 ? fmtMoney(row.otCost) : '—'}
                </span>
                <span className="font-mono tabular-nums w-14 text-right shrink-0 text-text-tertiary hidden md:inline">
                    {row.ptoHours > 0 ? fmtHours(row.ptoHours) : '—'}
                </span>
            </div>
            {/* Stacked bar: regular hours in accent, OT hours in amber, on a
             *  shared canvas so the dispatcher sees both the absolute
             *  workload AND the OT chunk inside it without doing math. */}
            <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary ml-[60px] relative">
                <div className="h-full absolute left-0 top-0" style={{ background: accent, width: `${pct}%` }} />
                {row.otHours > 0 && (
                    <div
                        className="h-full absolute top-0"
                        style={{
                            background: COLOR_WARN,
                            left: `${pct - otPct}%`,
                            width: `${otPct}%`
                        }}
                    />
                )}
            </div>
        </button>
    )
}

export default OperatorHoursRow
