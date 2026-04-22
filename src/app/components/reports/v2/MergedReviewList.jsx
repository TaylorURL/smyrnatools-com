import React from 'react'

import { ReportUtility } from '../../../../utils/ReportUtility'
import { usePreferences } from '../../../context/PreferencesContext'
import { reportTypeMap } from '../../../types/ReportTypes'

const REPORT_ICONS = {
    aggregate_production: { bg: 'bg-cyan-600', icon: 'fa-cubes' },
    district_manager: { bg: 'bg-purple-600', icon: 'fa-map-marker-alt' },
    general_manager: { bg: 'bg-slate-700', icon: 'fa-user-tie' },
    plant_manager: { bg: 'bg-blue-700', icon: 'fa-building' },
    plant_production: { bg: 'bg-teal-600', icon: 'fa-chart-bar' },
    quality_control_manager: { bg: 'bg-violet-600', icon: 'fa-flask' },
    ready_mix_instructor: { bg: 'bg-indigo-600', icon: 'fa-chalkboard-teacher' },
    safety_environmental_rep: { bg: 'bg-green-600', icon: 'fa-leaf' },
    safety_manager: { bg: 'bg-orange-500', icon: 'fa-hard-hat' }
}

const isSubmittedLate = (item) => {
    const ts = item.completedDate || item.submittedAt || item.submitted_at
    if (!ts || !item.week) return false
    const { saturday } = ReportUtility.getWeekDatesFromIso(item.week)
    if (!saturday) return false
    const cutoff = new Date(saturday)
    cutoff.setHours(23, 59, 59, 999)
    return new Date(ts).getTime() > cutoff.getTime()
}

const formatRelative = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString(undefined, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short'
    })
}

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
 * Merged list for GMs. Missing reports from prior weeks surface first
 * (subtle amber row tint) with a "Nudge" action, followed by the current
 * review queue with primary "Review" actions.
 */
function MergedReviewList({ missing = [], review = [], reviewedByCurrentUser, getUserName, onReview, onNudge }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
    const reviewedSet = reviewedByCurrentUser instanceof Set ? reviewedByCurrentUser : new Set()
    const hasItems = missing.length > 0 || review.length > 0
    if (!hasItems) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-400">
                    <i className="fas fa-clipboard-check text-4xl mb-3" />
                    <div className="text-sm">Nothing to review right now</div>
                </div>
            </div>
        )
    }
    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {missing.map((item) => {
                const reporterName = resolveReporterName(item, getUserName)
                const rt = reportTypeMap[item.report_name] || reportTypeMap[item.name]
                const title = item.reportTitle || rt?.title || item.title || 'Missing report'
                const weekIso = item.week || item.weekIso
                const { dueLabel, daysLate } = computeMissingDue(weekIso)
                return (
                    <div
                        key={`missing-${item.id || `${item.plant_code || item.plant}-${weekIso}-${item.report_name || item.name}`}`}
                        className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0"
                        style={{ background: '#fffbf5' }}
                    >
                        <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <i className="fas fa-exclamation-circle text-[13px]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[13px] text-slate-800 truncate">Missing · {title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {(item.plant_code || item.plant) && <>{item.plant_code || item.plant} · </>}
                                {reporterName}
                                {dueLabel && <> · was due {dueLabel}</>}
                                {daysLate !== null && daysLate > 0 && (
                                    <>
                                        {' · '}
                                        <span className="text-red-600 font-semibold">{daysLate}d late</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNudge?.(item)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0 inline-flex items-center gap-1.5"
                        >
                            <i className="fas fa-paper-plane text-[10px]" /> Nudge
                        </button>
                    </div>
                )
            })}
            {review.map((item) => {
                const reporterName = resolveReporterName(item, getUserName)
                const rt = reportTypeMap[item.name]
                const cfg = REPORT_ICONS[item.name] || { bg: 'bg-slate-600', icon: 'fa-file-alt' }
                const isReviewed = reviewedSet.has(item.id)
                return (
                    <div
                        key={`review-${item.id}`}
                        className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                    >
                        <div
                            className={`w-9 h-9 rounded-lg ${cfg.bg} text-white flex items-center justify-center shrink-0`}
                        >
                            <i className={`fas ${cfg.icon} text-[13px]`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[13px] text-slate-800 truncate">
                                {item.title || rt?.title || item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {reporterName}
                                {item.plant ? ` · ${item.plant}` : ''}
                                {item.completedDate || item.submittedAt || item.submitted_at
                                    ? ` · submitted ${formatRelative(item.completedDate || item.submittedAt || item.submitted_at)}`
                                    : ''}
                            </div>
                        </div>
                        {isSubmittedLate(item) && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700 shrink-0">
                                <i className="fas fa-clock text-[9px]" /> Submitted Late
                            </span>
                        )}
                        {isReviewed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 shrink-0">
                                <i className="fas fa-check text-[9px]" /> Reviewed
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 shrink-0">
                                <i className="fas fa-flag text-[9px]" /> Pending
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => onReview?.(item)}
                            className="text-white text-xs font-semibold px-3 py-1.5 rounded-md shrink-0 ml-2 hidden sm:inline-flex items-center gap-1.5"
                            style={{ background: accent }}
                        >
                            {isReviewed ? 'View' : 'Review'}
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

export default MergedReviewList
