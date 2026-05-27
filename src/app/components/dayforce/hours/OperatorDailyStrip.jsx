/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtFloat } from '../../../../utils/PlanStatisticsFormatUtility'

const COLOR_WARN = 'var(--status-warning)'
const COLOR_PTO = '#0ea5e9'

const fmtHours = (n) => `${fmtFloat(n, 1)}h`

/** Inline 7-day shift breakdown — appears when a row in the operator
 *  table is expanded. Each bar is one calendar day in the date range;
 *  OT chunks (anything over 8h on a day) render in amber on top of the
 *  accent base so a single glance reveals the daily OT pattern. */
function OperatorDailyStrip({ accent, dailyShifts }) {
    if (!dailyShifts.length) {
        return (
            <div className="px-6 py-3 border-t border-border-light bg-bg-secondary text-[11.5px] text-text-tertiary">
                No shifts in the window.
            </div>
        )
    }
    const maxHours = dailyShifts.reduce((m, d) => Math.max(m, d.actualHours || 0), 8)
    return (
        <div className="px-6 py-3 border-t border-border-light bg-bg-secondary">
            <div className="flex items-end gap-1.5 h-20">
                {dailyShifts.map((d) => {
                    const total = d.actualHours || 0
                    const totalPct = (total / maxHours) * 100
                    const otHours = total > 8 ? total - 8 : 0
                    const otPct = (otHours / maxHours) * 100
                    const regPct = totalPct - otPct
                    const tipParts = [
                        d.shiftDate,
                        d.isPto ? `PTO ${fmtHours(d.ptoHours || 0)}` : fmtHours(total),
                        otHours > 0 ? `${fmtHours(otHours)} OT` : null,
                        d.exceptionText ? `Exception: ${d.exceptionText}` : null
                    ].filter(Boolean)
                    return (
                        <div key={d.dayforceShiftId} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                            <div className="w-full flex-1 flex items-end" title={tipParts.join(' · ')}>
                                <div className="w-full flex flex-col-reverse" style={{ height: `${totalPct}%` }}>
                                    {d.isPto ? (
                                        <div
                                            className="w-full rounded-t-sm"
                                            style={{ background: COLOR_PTO, height: '100%' }}
                                        />
                                    ) : (
                                        <>
                                            <div
                                                className="w-full"
                                                style={{
                                                    background: accent,
                                                    borderTopLeftRadius: otHours > 0 ? 0 : 2,
                                                    borderTopRightRadius: otHours > 0 ? 0 : 2,
                                                    height: `${(regPct / totalPct) * 100 || 0}%`
                                                }}
                                            />
                                            {otHours > 0 && (
                                                <div
                                                    className="w-full rounded-t-sm"
                                                    style={{
                                                        background: COLOR_WARN,
                                                        height: `${(otPct / totalPct) * 100 || 0}%`
                                                    }}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <span className="text-[9.5px] text-text-tertiary font-mono tabular-nums">
                                {(d.shiftDate || '').slice(5)}
                            </span>
                            <span className="text-[10px] text-text-primary font-mono tabular-nums">
                                {total > 0 ? fmtFloat(total, 1) : '—'}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default OperatorDailyStrip
