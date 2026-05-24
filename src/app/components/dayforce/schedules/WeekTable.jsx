/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'
import { Panel } from '../../ui/Panel'
import { YPH_TARGET } from './scheduleConstants'
import { fmtHours, parseYmd, SHORT_DAY_FORMATTER } from './scheduleFormatters'
import { ShiftCell } from './ShiftCell'

const HEADER_CELL_CLASSES =
    'text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-b border-border-light bg-bg-secondary text-text-tertiary'

/** Renders one week-grid table: operators as rows, Mon–Sat as columns,
 *  plus a "Total" right column with each operator's weekly hours and a
 *  totals row at the bottom summing each day across operators. */
export function WeekTable({ accent, days, operatorRows, totalsByDay, weekTotal, weekLabel, weekYardageTotal }) {
    return (
        <Panel
            title="Weekly schedule"
            innerClassName="p-0"
            right={<span className="text-[11px] text-text-tertiary">{weekLabel}</span>}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                    <thead>
                        <tr>
                            <th className={HEADER_CELL_CLASSES} style={{ left: 0, minWidth: 180, position: 'sticky' }}>
                                Operator
                            </th>
                            {days.map((day) => (
                                <th
                                    key={day.iso}
                                    className={`${HEADER_CELL_CLASSES} text-center`}
                                    style={{ minWidth: 130 }}
                                >
                                    <div>{day.label}</div>
                                    <div className="text-[9.5px] font-mono tabular-nums text-text-tertiary mt-0.5">
                                        {SHORT_DAY_FORMATTER.format(parseYmd(day.iso))}
                                    </div>
                                </th>
                            ))}
                            <th className={`${HEADER_CELL_CLASSES} text-right`} style={{ minWidth: 80 }}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {operatorRows.map((op) => {
                            /** Operator-level YPH for the week — null when
                             *  we don't have any yardage matched (mixer
                             *  drivers will have it, other positions won't). */
                            const opYph = op.weekHours > 0 && op.weekYardage > 0 ? op.weekYardage / op.weekHours : null
                            const isLowOpYph = opYph != null && opYph < YPH_TARGET
                            return (
                                <tr key={op.id} className="border-t border-border-light">
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <span className="font-semibold text-text-primary truncate">{op.name}</span>
                                            <span className="font-mono tabular-nums text-[10.5px] text-text-tertiary">
                                                {op.badge || '—'} · {op.plantCode || '—'}
                                            </span>
                                        </div>
                                    </td>
                                    {days.map((day) => (
                                        <td
                                            key={day.iso}
                                            className="border-l border-border-light align-top"
                                            style={{ padding: 0 }}
                                        >
                                            <ShiftCell
                                                accent={accent}
                                                shift={op.byDay[day.iso] || null}
                                                yardage={op.yardageByDay?.[day.iso] || 0}
                                            />
                                        </td>
                                    ))}
                                    <td className="border-l border-border-light px-3 py-2 text-right align-top">
                                        <span className="font-mono tabular-nums font-bold text-text-primary text-[13px]">
                                            {fmtHours(op.weekHours)}
                                        </span>
                                        {opYph != null && (
                                            <div
                                                className="text-[10.5px] font-mono tabular-nums mt-0.5"
                                                style={{ color: 'var(--text-secondary)' }}
                                                title={`${fmtFloat(opYph, 1)} yards / hour across the week${isLowOpYph ? ` (below ${YPH_TARGET} target)` : ''}`}
                                            >
                                                {fmtFloat(opYph, 1)} y/h
                                            </div>
                                        )}
                                        {op.redFlags > 0 && (
                                            <div className="text-[10px] text-text-primary mt-0.5">
                                                <i className="fas fa-triangle-exclamation mr-1 text-[9px]" />
                                                {op.redFlags} red flag{op.redFlags === 1 ? '' : 's'}
                                            </div>
                                        )}
                                        {op.exceptions > 0 && op.exceptions > op.redFlags && (
                                            <div className="text-[10px] text-text-primary mt-0.5">
                                                <i className="fas fa-triangle-exclamation mr-1 text-[9px]" />
                                                {op.exceptions - op.redFlags} exc.
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-bg-secondary border-t-2 border-border-light">
                            <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-secondary">
                                Day totals
                            </td>
                            {days.map((day) => (
                                <td
                                    key={day.iso}
                                    className="border-l border-border-light px-2 py-2 text-center font-mono tabular-nums font-semibold text-text-primary text-[12px]"
                                >
                                    {fmtHours(totalsByDay[day.iso] || 0)}
                                </td>
                            ))}
                            <td className="border-l border-border-light px-3 py-2 text-right font-mono tabular-nums font-bold text-text-primary text-[13px]">
                                {fmtHours(weekTotal)}
                                {weekYardageTotal > 0 && weekTotal > 0 && (
                                    <div
                                        className="text-[10.5px] font-mono tabular-nums mt-0.5"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {fmtFloat(weekYardageTotal / weekTotal, 1)} y/h
                                    </div>
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Panel>
    )
}
