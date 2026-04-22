import React from 'react'

import { usePreferences } from '../../../context/PreferencesContext'

const ICON_BG_BY_NAME = {
    aggregate_production: 'bg-cyan-600',
    district_manager: 'bg-purple-600',
    general_manager: 'bg-slate-700',
    plant_manager: 'bg-blue-700',
    plant_production: 'bg-teal-600',
    quality_control_manager: 'bg-violet-600',
    ready_mix_instructor: 'bg-indigo-600',
    safety_environmental_rep: 'bg-green-600',
    safety_manager: 'bg-orange-500',
    test: 'bg-gray-500'
}
const ICON_BY_NAME = {
    aggregate_production: 'fa-cubes',
    district_manager: 'fa-map-marker-alt',
    general_manager: 'fa-user-tie',
    plant_manager: 'fa-building',
    plant_production: 'fa-chart-bar',
    quality_control_manager: 'fa-flask',
    ready_mix_instructor: 'fa-chalkboard-teacher',
    safety_environmental_rep: 'fa-leaf',
    safety_manager: 'fa-hard-hat',
    test: 'fa-flask'
}

const STATUS_CONFIG = {
    in_progress: { badge: 'bg-amber-100 text-amber-700', label: 'Draft', tone: '#ca8a04' },
    not_started: { badge: 'bg-slate-100 text-slate-600', label: 'Not started', tone: '#64748b' },
    overdue: { badge: 'bg-red-100 text-red-700', label: 'Overdue', tone: '#dc2626' },
    submitted: { badge: 'bg-emerald-100 text-emerald-700', label: 'Submitted', tone: '#16a34a' }
}

const HISTORY_COLORS = {
    done: '#16a34a',
    due: '#cbd5e1',
    late: '#f59e0b',
    miss: '#dc2626'
}

/**
 * Single weekly-report card. Shows the report title, plant / due context,
 * a 4-week history strip, and a context-aware action button (Start / Continue / View).
 */
function TrackCard({ item, history = [], onStart, onContinue, onView, plantLabel }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
    if (!item) return null
    const { completed, name, title, report, weekIso, subLabel } = item
    const hasSavedData = !!report?.data
    const status = completed
        ? 'submitted'
        : item.status === 'overdue'
          ? 'overdue'
          : hasSavedData
            ? 'in_progress'
            : 'not_started'
    const statusCfg = STATUS_CONFIG[status]
    const iconBg = ICON_BG_BY_NAME[name] || 'bg-slate-600'
    const icon = ICON_BY_NAME[name] || 'fa-file-alt'
    const handleAction = () => {
        if (status === 'submitted') return onView?.(item)
        if (status === 'in_progress') return onContinue?.(item)
        return onStart?.(item)
    }
    const buttonLabel =
        status === 'submitted'
            ? 'View'
            : status === 'in_progress'
              ? 'Continue'
              : status === 'overdue'
                ? 'Submit now'
                : 'Start'
    const buttonBg = status === 'overdue' ? '#dc2626' : accent
    const contextLine =
        subLabel ||
        (completed
            ? `${plantLabel ? plantLabel + ' · ' : ''}Submitted`
            : `${plantLabel ? plantLabel + ' · ' : ''}due Sat 11:59 PM`)
    return (
        <article className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-px hover:shadow-md">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                <div className={`w-9 h-9 rounded-lg ${iconBg} text-white flex items-center justify-center shrink-0`}>
                    <i className={`fas ${icon} text-[13px]`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] truncate" style={{ fontFamily: 'var(--font-heading)' }}>
                        {title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">{contextLine}</div>
                </div>
                <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusCfg.badge}`}
                >
                    {statusCfg.label}
                </span>
            </div>
            {history.length > 0 && (
                <div className="flex items-center gap-1 px-4 py-2.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[.05em] mr-1.5">
                        {history.length}wk
                    </span>
                    {history.map((seg, idx) => (
                        <span
                            key={`${weekIso}-h-${idx}`}
                            className="flex-1 h-1.5 rounded-sm"
                            style={{ background: HISTORY_COLORS[seg] || HISTORY_COLORS.due }}
                            title={seg}
                        />
                    ))}
                    <span
                        className="flex-1 h-2 rounded-sm"
                        style={{
                            background: statusCfg.tone,
                            boxShadow: `0 0 0 1.5px ${statusCfg.tone} inset, 0 0 0 1px #fff`
                        }}
                        title="this week"
                    />
                </div>
            )}
            <div className="flex items-center gap-2.5 px-4 pb-3.5 pt-1">
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={handleAction}
                    className={`inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-opacity hover:opacity-90 ${
                        status === 'submitted' ? 'bg-white border border-gray-200 text-slate-700' : ''
                    }`}
                    style={status === 'submitted' ? undefined : { background: buttonBg }}
                >
                    {status === 'submitted' && <i className="far fa-eye text-[10px]" />}
                    {buttonLabel}
                    {status !== 'submitted' && <i className="fas fa-arrow-right text-[10px]" />}
                </button>
            </div>
        </article>
    )
}

export default TrackCard
