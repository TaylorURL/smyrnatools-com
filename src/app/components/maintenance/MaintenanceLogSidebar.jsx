import React, { useMemo } from 'react'

import {
    DAYS_OF_WEEK,
    formatLogDate,
    getCalendarDays,
    STATUS_CONFIG,
    toDateKey
} from '../../../utils/MaintenanceLogUtility'

function MiniCalendar({ equipment, calendarDate, onCalendarDateChange, isDark, accentColor }) {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const days = useMemo(() => getCalendarDays(year, month), [year, month])
    const today = new Date()
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    const monthLabel = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const { lastServiceMap, nextServiceMap } = useMemo(() => {
        const lastMap = {}
        const nextMap = {}
        for (const item of equipment) {
            if (item.last_service_date) {
                if (!lastMap[item.last_service_date]) lastMap[item.last_service_date] = []
                lastMap[item.last_service_date].push(item)
            }
            if (item.next_service_date) {
                if (!nextMap[item.next_service_date]) nextMap[item.next_service_date] = []
                nextMap[item.next_service_date].push(item)
            }
        }
        return { lastServiceMap: lastMap, nextServiceMap: nextMap }
    }, [equipment])

    const navigate = (delta) => {
        const d = new Date(year, month + delta, 1)
        onCalendarDateChange(d)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex h-6 w-6 items-center justify-center rounded transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-tertiary border-none cursor-pointer bg-transparent text-text-secondary active:scale-[0.92]"
                    aria-label="Previous month"
                >
                    <i className="fas fa-chevron-left text-[10px]" />
                </button>
                <span className="text-[12px] font-semibold uppercase tracking-wider text-text-primary">
                    {monthLabel}
                </span>
                <button
                    type="button"
                    onClick={() => navigate(1)}
                    className="flex h-6 w-6 items-center justify-center rounded transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-tertiary border-none cursor-pointer bg-transparent text-text-secondary active:scale-[0.92]"
                    aria-label="Next month"
                >
                    <i className="fas fa-chevron-right text-[10px]" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-px text-center">
                {DAYS_OF_WEEK.map((d) => (
                    <div key={d} className="text-[9.5px] font-bold uppercase tracking-wider py-1 text-text-tertiary">
                        {d}
                    </div>
                ))}
                {days.map((cell, i) => {
                    const dateKey = cell.outside ? null : toDateKey(year, month, cell.day)
                    const isToday = dateKey === todayKey
                    const hasLastService = dateKey && lastServiceMap[dateKey]
                    const nextEvents = dateKey ? nextServiceMap[dateKey] : null

                    const worstStatus = nextEvents?.reduce((worst, e) => {
                        if (e.service_status === 'overdue') return 'overdue'
                        if (e.service_status === 'due_soon' && worst !== 'overdue') return 'due_soon'
                        return worst
                    }, 'ok')
                    const upcomingDotColor =
                        worstStatus === 'overdue'
                            ? STATUS_CONFIG.overdue.barColor
                            : worstStatus === 'due_soon'
                              ? STATUS_CONFIG.due_soon.barColor
                              : nextEvents
                                ? STATUS_CONFIG.ok.barColor
                                : null

                    const lastDotColor = hasLastService ? STATUS_CONFIG.ok.barColor : null

                    return (
                        <div
                            key={i}
                            className="relative flex flex-col items-center justify-center py-1.5 text-xs rounded-md"
                            style={{
                                backgroundColor: isToday ? accentColor : 'transparent',
                                color: cell.outside ? 'var(--text-secondary)' : 'var(--text-primary)',
                                opacity: cell.outside ? 0.35 : 1,
                                ...(isToday ? { borderRadius: '6px', color: '#fff', fontWeight: 700 } : {})
                            }}
                        >
                            {cell.day}
                            {!cell.outside && (lastDotColor || upcomingDotColor) && (
                                <div className="absolute bottom-0.5 flex gap-px">
                                    {lastDotColor && (
                                        <div
                                            className="w-1 h-1 rounded-full"
                                            style={{ backgroundColor: lastDotColor }}
                                        />
                                    )}
                                    {upcomingDotColor && (
                                        <div
                                            className="w-1 h-1 rounded-full"
                                            style={{ backgroundColor: upcomingDotColor }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-border-light">
                {[
                    { color: STATUS_CONFIG.ok.barColor, label: 'Serviced' },
                    { color: STATUS_CONFIG.due_soon.barColor, label: 'Due Soon' },
                    { color: STATUS_CONFIG.overdue.barColor, label: 'Overdue' }
                ].map((item) => (
                    <span
                        key={item.label}
                        className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-text-tertiary"
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    )
}

function UpcomingServices({ equipment, isDark }) {
    const upcoming = useMemo(() => {
        return equipment
            .filter((e) => e.next_service_date && (e.service_status === 'overdue' || e.service_status === 'due_soon'))
            .sort((a, b) => (a.next_service_date > b.next_service_date ? 1 : -1))
            .slice(0, 4)
    }, [equipment])

    if (!upcoming.length) return null

    return (
        <div className="flex flex-col gap-1.5">
            {upcoming.map((item) => {
                const cfg = STATUS_CONFIG[item.service_status] || STATUS_CONFIG.ok
                return (
                    <div
                        key={item.id}
                        className="flex items-center gap-2 rounded px-2.5 py-1.5"
                        style={{
                            background: isDark ? cfg.darkBg : cfg.bg,
                            borderLeft: `3px solid ${cfg.barColor}`
                        }}
                    >
                        <div
                            className="text-[10.5px] font-bold uppercase tracking-wider min-w-[48px] font-mono tabular-nums"
                            style={{ color: isDark ? cfg.darkColor : cfg.color }}
                        >
                            {new Date(item.next_service_date + 'T00:00:00').toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short'
                            })}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold truncate text-text-primary">{item.name}</div>
                            <div className="text-[10.5px] truncate text-text-secondary">
                                {item.category_name} · Plant {item.plant_code}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function RecentActivity({ entries, isDark }) {
    if (!entries.length) {
        return <p className="text-[10.5px] italic m-0 text-text-tertiary">No recent activity</p>
    }
    return (
        <div className="relative pl-5">
            <div className="absolute left-[6px] top-0 bottom-0 w-0.5 bg-[var(--border-light)]" />
            {entries.slice(0, 5).map((entry, i) => (
                <div key={entry.id || i} className="relative pb-3 last:pb-0">
                    <div
                        className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-bg-primary"
                        style={{ border: '2px solid var(--accent, #2A3163)' }}
                    />
                    <div className="text-[12px] font-semibold text-text-primary">
                        {entry.maintenance_log_equipment?.name || 'Equipment'}
                    </div>
                    <div className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                        {formatLogDate(entry.service_date)} · {entry.performed_by_name}
                        {entry.maintenance_log_service_types?.name
                            ? ` · ${entry.maintenance_log_service_types.name}`
                            : ''}
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Right sidebar: calendar, upcoming/overdue list, and recent activity timeline. */
export function MaintenanceLogSidebar({
    equipment,
    filtered,
    recentEntries,
    calendarDate,
    onCalendarDateChange,
    isDark,
    accentColor
}) {
    return (
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">
            <div className="rounded p-3 bg-bg-primary border border-border-light">
                <MiniCalendar
                    equipment={equipment}
                    calendarDate={calendarDate}
                    onCalendarDateChange={onCalendarDateChange}
                    isDark={isDark}
                    accentColor={accentColor}
                />
            </div>
            <div className="rounded p-3 bg-bg-primary border border-border-light">
                <h4 className="text-[9.5px] font-semibold uppercase tracking-wider mb-2 m-0 text-text-secondary">
                    Upcoming & Overdue
                </h4>
                <UpcomingServices equipment={filtered} isDark={isDark} />
                {!filtered.some((e) => e.service_status === 'overdue' || e.service_status === 'due_soon') && (
                    <p className="text-[10.5px] italic m-0 text-text-tertiary">All equipment up to date</p>
                )}
            </div>
            <div className="rounded p-3 bg-bg-primary border border-border-light">
                <h4 className="text-[9.5px] font-semibold uppercase tracking-wider mb-2 m-0 text-text-secondary">
                    Recent Activity
                </h4>
                <RecentActivity entries={recentEntries} isDark={isDark} />
            </div>
        </div>
    )
}
