import React from 'react'

import { ReportUtility } from '../../../../../utils/ReportUtility'
import { reportTypeMap } from '../../../../types/ReportTypes'

const resolveReporterName = (item, getUserName) => {
    const full = `${item.first_name || ''} ${item.last_name || ''}`.trim()
    if (full) return full
    const byId = (item.userId && getUserName?.(item.userId)) || (item.user_id && getUserName?.(item.user_id))
    return byId || 'Unknown'
}

const computeMissingDue = (weekIso) => {
    if (!weekIso) return { daysLate: null, dueLabel: '' }
    const { saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
    if (!saturday) return { daysLate: null, dueLabel: '' }
    const dueLabel = saturday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    const daysLate = Math.max(0, Math.floor((Date.now() - saturday.getTime()) / 86400000))
    return { daysLate, dueLabel }
}

/**
 * Right-rail list of missing reports with a Nudge action. Complements the main
 * review queue on the left — missing reports are kept separate so reviewers see
 * submissions vs. non-submissions at a glance.
 */
function MissingPanel({ missing = [], getUserName, onNudge, weekRangeLabel }) {
    return (
        <aside className="bg-bg-primary border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
                <i className="fas fa-exclamation-circle text-[13px] text-text-primary" />
                <span className="font-bold text-[14px] font-heading">Missing</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-text-primary">
                    {missing.length}
                </span>
            </div>
            {weekRangeLabel && (
                <div className="text-[10.5px] text-slate-400 uppercase tracking-[.08em] font-semibold mb-3">
                    {weekRangeLabel}
                </div>
            )}
            {missing.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <i className="fas fa-circle-check text-2xl mb-2 text-text-primary" />
                    <div className="text-[12px]">Nothing missing for this week</div>
                </div>
            ) : (
                <div className="flex flex-col">
                    {missing.map((item) => {
                        const reporterName = resolveReporterName(item, getUserName)
                        const rt = reportTypeMap[item.report_name] || reportTypeMap[item.name]
                        const title = item.reportTitle || rt?.title || item.report_name || 'Missing report'
                        const weekIso = item.week || item.weekIso
                        const { dueLabel, daysLate } = computeMissingDue(weekIso)
                        return (
                            <div
                                key={`mp-${item.id || `${item.plant_code || item.plant}-${weekIso}-${item.report_name || item.name}`}`}
                                className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-b-0"
                            >
                                <div className="w-6 h-6 rounded-full bg-red-100 text-text-primary flex items-center justify-center shrink-0 mt-0.5">
                                    <i className="fas fa-exclamation text-[10px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-semibold truncate">{title}</div>
                                    <div className="text-[10.5px] text-slate-500 truncate">
                                        {(item.plant_code || item.plant) && <>{item.plant_code || item.plant} · </>}
                                        {reporterName}
                                    </div>
                                    <div className="text-[10.5px] mt-0.5">
                                        {dueLabel && <span className="text-slate-500">due {dueLabel}</span>}
                                        {daysLate !== null && daysLate > 0 && (
                                            <>
                                                {dueLabel && <span className="text-slate-300"> · </span>}
                                                <span className="text-text-primary font-semibold">
                                                    {daysLate}d late
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button type="button"
                                    type="button"
                                    onClick={() => onNudge?.(item)}
                                    className="px-2.5 py-1 text-[10.5px] font-semibold rounded-md border border-gray-200 bg-bg-primary text-slate-700 hover:bg-slate-50 shrink-0 mt-0.5 inline-flex items-center gap-1"
                                >
                                    <i className="fas fa-paper-plane text-[9px]" /> Nudge
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </aside>
    )
}

export default MissingPanel
