/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ReportUtility } from '../../../../../utils/ReportUtility'
import { usePreferences } from '../../../../context/PreferencesContext'
import { reportTypeMap } from '../../../../types/ReportTypes'

const REPORT_ICON = {
    aggregate_production: 'fa-cubes',
    district_manager: 'fa-map-marker-alt',
    general_manager: 'fa-user-tie',
    plant_manager: 'fa-building',
    plant_production: 'fa-chart-bar',
    quality_control_manager: 'fa-flask',
    ready_mix_instructor: 'fa-chalkboard-teacher',
    safety_environmental_rep: 'fa-leaf',
    safety_manager: 'fa-hard-hat'
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

const STATUS_PILL_BASE =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0'

function MergedReviewList({ missing = [], review = [], reviewedByCurrentUser, getUserName, onReview, onNudge }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
    const reviewedSet = reviewedByCurrentUser instanceof Set ? reviewedByCurrentUser : new Set()
    const hasItems = missing.length > 0 || review.length > 0

    if (!hasItems) {
        return (
            <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                <div className="flex flex-col items-center justify-center py-10 px-4 text-text-tertiary">
                    <i className="fas fa-clipboard-check text-2xl mb-2" />
                    <div className="text-[12px]">Nothing to review right now</div>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            {missing.map((item) => {
                const reporterName = resolveReporterName(item, getUserName)
                const rt = reportTypeMap[item.report_name] || reportTypeMap[item.name]
                const title = item.reportTitle || rt?.title || item.title || 'Missing report'
                const weekIso = item.week || item.weekIso
                const { dueLabel, daysLate } = computeMissingDue(weekIso)
                return (
                    <div
                        key={`missing-${item.id || `${item.plant_code || item.plant}-${weekIso}-${item.report_name || item.name}`}`}
                        className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light"
                    >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-red-100 text-text-primary">
                            <i className="fas fa-exclamation-circle text-[11px]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[12px] truncate text-text-primary">
                                Missing · {title}
                            </div>
                            <div className="text-[10.5px] mt-0.5 truncate text-text-secondary">
                                {(item.plant_code || item.plant) && <>{item.plant_code || item.plant} · </>}
                                {reporterName}
                                {dueLabel && <> · was due {dueLabel}</>}
                                {daysLate !== null && daysLate > 0 && (
                                    <>
                                        {' · '}
                                        <span className="font-semibold text-text-primary">{daysLate}d late</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNudge?.(item)}
                            className="px-2 py-1 text-[10.5px] font-semibold rounded shrink-0 inline-flex items-center gap-1 uppercase tracking-wider bg-bg-secondary border border-border-light text-text-primary"
                        >
                            <i className="fas fa-paper-plane text-[9px]" /> Nudge
                        </button>
                    </div>
                )
            })}
            {review.map((item) => {
                const reporterName = resolveReporterName(item, getUserName)
                const rt = reportTypeMap[item.name]
                const iconClass = REPORT_ICON[item.name] || 'fa-file-alt'
                const isReviewed = reviewedSet.has(item.id)
                const submittedLate = isSubmittedLate(item)
                return (
                    <div
                        key={`review-${item.id}`}
                        className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-bg-tertiary border-b border-border-light"
                    >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-bg-tertiary text-text-secondary">
                            <i className={`fas ${iconClass} text-[11px]`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[12px] truncate text-text-primary">
                                {item.title || rt?.title || item.name}
                            </div>
                            <div className="text-[10.5px] mt-0.5 truncate text-text-secondary">
                                {reporterName}
                                {item.plant ? ` · ${item.plant}` : ''}
                                {item.completedDate || item.submittedAt || item.submitted_at
                                    ? ` · submitted ${formatRelative(item.completedDate || item.submittedAt || item.submitted_at)}`
                                    : ''}
                            </div>
                        </div>
                        {submittedLate && (
                            <span className={`${STATUS_PILL_BASE} bg-orange-100 text-text-primary`}>Late</span>
                        )}
                        {isReviewed ? (
                            <span className={`${STATUS_PILL_BASE} bg-green-100 text-text-primary`}>Reviewed</span>
                        ) : (
                            <span className={`${STATUS_PILL_BASE} bg-amber-100 text-text-primary`}>Pending</span>
                        )}
                        <button
                            type="button"
                            onClick={() => onReview?.(item)}
                            className="text-white text-[10.5px] font-semibold px-2 py-1 rounded shrink-0 ml-1 hidden sm:inline-flex items-center gap-1 uppercase tracking-wider"
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
