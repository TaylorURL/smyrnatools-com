import React, { useMemo } from 'react'

import { usePreferences } from '../../../app/context/PreferencesContext'
import { ReportService } from '../../../services/ReportService'
import { ReportUtility } from '../../../utils/ReportUtility'
import { reportTypeMap } from '../../types/ReportTypes'
import { ReportsListSkeleton } from '../ui/AssetListSkeleton'

const REPORT_ICONS = {
    district_manager: { icon: 'fa-map-marker-alt', bg: 'bg-purple-600' },
    plant_manager: { icon: 'fa-building', bg: 'bg-blue-700' },
    plant_production: { icon: 'fa-chart-bar', bg: 'bg-teal-600' },
    aggregate_production: { icon: 'fa-cubes', bg: 'bg-cyan-600' },
    safety_manager: { icon: 'fa-hard-hat', bg: 'bg-orange-500' },
    safety_environmental_rep: { icon: 'fa-leaf', bg: 'bg-green-600' },
    general_manager: { icon: 'fa-user-tie', bg: 'bg-slate-700' },
    ready_mix_instructor: { icon: 'fa-chalkboard-teacher', bg: 'bg-indigo-600' },
    quality_control_manager: { icon: 'fa-vial', bg: 'bg-violet-600' },
    test: { icon: 'fa-flask', bg: 'bg-gray-500' }
}

const BADGE_COLORS = {
    'Last Week': 'text-amber-700 bg-amber-100',
    Older: 'text-slate-600 bg-slate-100'
}

const getInitials = (name) =>
    (name || '')
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase()

const formatUserName = (item) => {
    const full = `${item.first_name || ''} ${item.last_name || ''}`.trim()
    return full || (typeof item.userId === 'string' ? item.userId.slice(0, 8) : 'Unknown')
}

const MissingRow = ({ item, accentColor }) => {
    const iconConfig = REPORT_ICONS[item.report_name] || { icon: 'fa-file-alt', bg: 'bg-slate-500' }
    const title = reportTypeMap[item.report_name]?.title || item.report_name
    const userName = formatUserName(item)
    const initials = getInitials(userName)
    return (
        <div className="flex items-center px-4 sm:px-5 py-3.5 border-b border-slate-100 last:border-b-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-lg ${iconConfig.bg} flex items-center justify-center shrink-0`}>
                    <i className={`fas ${iconConfig.icon} text-white text-[10px]`} />
                </div>
                <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-800 block truncate">{title}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${accentColor}20`, color: accentColor }}
                        >
                            <span className="text-[8px] font-bold">{initials}</span>
                        </div>
                        <span className="text-xs text-slate-500 truncate">{userName}</span>
                    </div>
                </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 shrink-0">
                <i className="fas fa-exclamation-circle text-[9px]" />
                Missing
            </span>
        </div>
    )
}

const MissingWeekGroup = ({ weekIso, items, accentColor }) => {
    const { monday, saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
    const weekRange = ReportService.getWeekRangeString(monday, saturday)
    const badge = ReportUtility.getWeekBadge(weekIso) || 'Older'
    return (
        <div className="mb-5">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${BADGE_COLORS[badge] || BADGE_COLORS.Older}`}
                >
                    {badge}
                </span>
                <span className="text-xs text-slate-400">{weekRange}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-red-700 bg-red-50">
                    {items.length} missing
                </span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {items.map((item) => (
                    <MissingRow
                        key={`${item.userId}-${item.report_name}-${item.week}`}
                        item={item}
                        accentColor={accentColor}
                    />
                ))}
            </div>
        </div>
    )
}

/** Lists reports that were not submitted by their assignees, grouped by week. */
function MissingReportsList({ isLoading, items }) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'

    const groupedByWeek = useMemo(() => {
        const groups = {}
        for (const item of items) {
            const weekIso = item.week ? new Date(item.week).toISOString().slice(0, 10) : 'unknown'
            if (!groups[weekIso]) groups[weekIso] = []
            groups[weekIso].push(item)
        }
        return Object.keys(groups)
            .sort((a, b) => (a > b ? -1 : 1))
            .map((key) => ({ weekIso: key, items: groups[key] }))
    }, [items])

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <ReportsListSkeleton columnCount={6} />
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-12 text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-full flex items-center justify-center mb-5 sm:mb-6">
                    <i className="fas fa-check-circle text-4xl sm:text-5xl text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 m-0 mb-2">No Missing Reports</h3>
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed m-0 max-w-sm">
                    Everyone submitted their reports for the previous two weeks.
                </p>
            </div>
        )
    }

    return (
        <div>
            {groupedByWeek.map(({ weekIso, items: weekItems }) => (
                <MissingWeekGroup key={weekIso} weekIso={weekIso} items={weekItems} accentColor={accentColor} />
            ))}
        </div>
    )
}

export default MissingReportsList
