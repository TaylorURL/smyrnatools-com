import React, { useCallback, useEffect, useMemo, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import { MaintenanceFormsRail } from '../../../app/components/maintenance/MaintenanceFormsRail'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { Database } from '../../../services/DatabaseService'
import { MaintenanceLogService } from '../../../services/MaintenanceLogService'
import { MaintenanceService } from '../../../services/MaintenanceService'
import MaintenanceFormView from './MaintenanceFormView'

// ── Constants ───────────────────────────────────────────────────
const STATUS_CONFIG = {
    due_soon: {
        badge: 'Due Soon',
        color: '#b45309',
        darkColor: '#fbbf24',
        bg: 'rgba(245,158,11,0.1)',
        darkBg: 'rgba(251,191,36,0.2)',
        icon: 'fa-clock',
        barColor: '#f59e0b'
    },
    never_serviced: {
        badge: 'Never',
        color: '#64748b',
        darkColor: '#94a3b8',
        bg: 'rgba(100,116,139,0.1)',
        darkBg: 'rgba(148,163,184,0.15)',
        icon: 'fa-minus-circle',
        barColor: '#94a3b8'
    },
    ok: {
        badge: 'OK',
        color: '#15803d',
        darkColor: '#4ade80',
        bg: 'rgba(22,163,74,0.1)',
        darkBg: 'rgba(34,197,94,0.2)',
        icon: 'fa-check-circle',
        barColor: '#22c55e'
    },
    overdue: {
        badge: 'Overdue',
        color: '#dc2626',
        darkColor: '#f87171',
        bg: 'rgba(239,68,68,0.1)',
        darkBg: 'rgba(239,68,68,0.2)',
        icon: 'fa-exclamation-triangle',
        barColor: '#ef4444'
    }
}

const STATUS_FILTER_MAP = { 'Due Soon': 'due_soon', 'Never Serviced': 'never_serviced', OK: 'ok', Overdue: 'overdue' }
const MS_PER_DAY = 86_400_000
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const CHEVRON_BG =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")"
const SELECT_CLS =
    'w-full appearance-none rounded bg-no-repeat px-2.5 py-1.5 pr-8 text-[12.5px] outline-none cursor-pointer'
const SELECT_STYLE = {
    background: 'var(--bg-secondary)',
    backgroundImage: CHEVRON_BG,
    backgroundPosition: 'right 8px center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '14px',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const FIELD_INPUT_CLS = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none'
const FIELD_INPUT_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const FIELD_LABEL_CLS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'

// ── Content Skeleton ────────────────────────────────────────────

const SkeletonBar = ({ className = '', style }) => (
    <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
)

function SkeletonRow({ i }) {
    return (
        <tr
            style={{
                animationDelay: `${i * 60}ms`,
                animationFillMode: 'both',
                borderBottom: '1px solid var(--border-light)'
            }}
        >
            <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                    <SkeletonBar className="w-6 h-6" />
                    <div className="min-w-0">
                        <SkeletonBar className="h-3 w-32 mb-1" />
                        <SkeletonBar className="h-2.5 w-24" />
                    </div>
                </div>
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-3 w-10" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-3 w-20" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-2.5 w-28 mb-1" />
                <SkeletonBar className="h-1.5 w-full rounded-full" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="h-4 w-16" />
            </td>
            <td className="py-2 px-3">
                <SkeletonBar className="w-6 h-6" />
            </td>
        </tr>
    )
}

function ContentSkeleton({ isMobile }) {
    return (
        <div className={`flex gap-3 items-start ${isMobile ? 'flex-col' : ''}`}>
            <div
                className="flex-1 min-w-0 rounded overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
            >
                <table className="w-full border-collapse">
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            {['w-24', 'w-10', 'w-16', 'w-20', 'w-12', 'w-6'].map((w, i) => (
                                <th
                                    key={i}
                                    className="text-left py-2 px-3"
                                    style={{ borderBottom: '1px solid var(--border-light)' }}
                                >
                                    <SkeletonBar className={`h-2.5 ${w}`} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 8 }, (_, i) => (
                            <SkeletonRow key={i} i={i} />
                        ))}
                    </tbody>
                </table>
            </div>
            {!isMobile && (
                <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">
                    {[140, 120, 160].map((h, i) => (
                        <div
                            key={i}
                            className="rounded p-3"
                            style={{
                                animationDelay: `${i * 80}ms`,
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)'
                            }}
                        >
                            <SkeletonBar className="h-2.5 w-24 mb-2" />
                            <SkeletonBar className="rounded" style={{ height: `${h}px` }} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Helpers ─────────────────────────────────────────────────────

function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysBetween(dateA, dateB) {
    return Math.round((new Date(dateB) - new Date(dateA)) / MS_PER_DAY)
}

function getProgressInfo(item) {
    if (!item.last_service_date || !item.next_service_date) {
        return { label: 'Never serviced', overdueDays: 0, pct: 0, status: 'never' }
    }
    const interval = item.service_interval_days || daysBetween(item.last_service_date, item.next_service_date)
    const today = new Date().toISOString().slice(0, 10)
    const elapsed = daysBetween(item.last_service_date, today)
    const pct = Math.min(Math.max(elapsed / interval, 0), 1)

    if (item.service_status === 'overdue') {
        const overdueDays = daysBetween(item.next_service_date, today)
        return {
            label: `${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`,
            overdueDays,
            pct: 1,
            status: 'overdue'
        }
    }
    if (item.service_status === 'due_soon') {
        return {
            label: `${elapsed} of ${interval} days — due ${formatDate(item.next_service_date)}`,
            overdueDays: 0,
            pct,
            status: 'due_soon'
        }
    }
    return { label: `${elapsed} of ${interval} days`, overdueDays: 0, pct, status: 'ok' }
}

function getCalendarDays(year, month) {
    const first = new Date(year, month, 1)
    const startDay = first.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDays = new Date(year, month, 0).getDate()
    const days = []
    for (let i = startDay - 1; i >= 0; i--) days.push({ day: prevDays - i, outside: true })
    for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, outside: false })
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) days.push({ day: d, outside: true })
    return days
}

function toDateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Sub-components ──────────────────────────────────────────────

function StatusBadge({ status, isDark }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ok
    return (
        <span
            className="inline-flex items-center gap-1 rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            style={{ background: isDark ? cfg.darkBg : cfg.bg, color: isDark ? cfg.darkColor : cfg.color }}
        >
            <i className={`fas ${cfg.icon} text-[9px]`} />
            {cfg.badge}
        </span>
    )
}

function ProgressBar({ item, isDark }) {
    const info = getProgressInfo(item)
    const cfg = STATUS_CONFIG[info.status] || STATUS_CONFIG.ok
    return (
        <div>
            <div
                className="text-[10.5px] font-semibold mb-1 font-mono tabular-nums"
                style={{ color: info.status === 'ok' ? 'var(--text-secondary)' : isDark ? cfg.darkColor : cfg.color }}
            >
                {info.label}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ background: cfg.barColor, width: `${info.pct * 100}%` }}
                />
            </div>
        </div>
    )
}

function MiniCalendar({ equipment, calendarDate, onCalendarDateChange, isDark, accentColor }) {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const days = useMemo(() => getCalendarDays(year, month), [year, month])
    const today = new Date()
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    const monthLabel = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Build maps for both last service (past) and next service (upcoming) dates
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
                    className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer"
                    style={{ background: 'transparent', color: 'var(--text-secondary)' }}
                    aria-label="Previous month"
                >
                    <i className="fas fa-chevron-left text-[10px]" />
                </button>
                <span
                    className="text-[12px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {monthLabel}
                </span>
                <button
                    type="button"
                    onClick={() => navigate(1)}
                    className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer"
                    style={{ background: 'transparent', color: 'var(--text-secondary)' }}
                    aria-label="Next month"
                >
                    <i className="fas fa-chevron-right text-[10px]" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-px text-center">
                {DAYS_OF_WEEK.map((d) => (
                    <div
                        key={d}
                        className="text-[9.5px] font-bold uppercase tracking-wider py-1"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {d}
                    </div>
                ))}
                {days.map((cell, i) => {
                    const dateKey = cell.outside ? null : toDateKey(year, month, cell.day)
                    const isToday = dateKey === todayKey
                    const hasLastService = dateKey && lastServiceMap[dateKey]
                    const nextEvents = dateKey ? nextServiceMap[dateKey] : null

                    // Upcoming dot color based on worst status
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

                    // Past service dot is always green
                    const lastDotColor = hasLastService ? STATUS_CONFIG.ok.barColor : null

                    return (
                        <div
                            key={i}
                            className="relative flex flex-col items-center justify-center py-1.5 text-xs rounded-md"
                            style={{
                                color: cell.outside ? 'var(--text-secondary)' : 'var(--text-primary)',
                                opacity: cell.outside ? 0.35 : 1,
                                backgroundColor: isToday ? accentColor : 'transparent',
                                ...(isToday ? { color: '#fff', fontWeight: 700, borderRadius: '6px' } : {})
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
            <div className="flex items-center gap-2.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                {[
                    { color: STATUS_CONFIG.ok.barColor, label: 'Serviced' },
                    { color: STATUS_CONFIG.due_soon.barColor, label: 'Due Soon' },
                    { color: STATUS_CONFIG.overdue.barColor, label: 'Overdue' }
                ].map((item) => (
                    <span
                        key={item.label}
                        className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    )
}

function RecentActivity({ entries, isDark }) {
    if (!entries.length) {
        return (
            <p className="text-[10.5px] italic m-0" style={{ color: 'var(--text-tertiary)' }}>
                No recent activity
            </p>
        )
    }
    return (
        <div className="relative pl-5">
            <div className="absolute left-[6px] top-0 bottom-0 w-0.5" style={{ background: 'var(--border-light)' }} />
            {entries.slice(0, 5).map((entry, i) => (
                <div key={entry.id || i} className="relative pb-3 last:pb-0">
                    <div
                        className="absolute -left-[15px] top-1 w-2 h-2 rounded-full"
                        style={{ background: 'var(--bg-primary)', border: '2px solid var(--accent, #2A3163)' }}
                    />
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {entry.maintenance_log_equipment?.name || 'Equipment'}
                    </div>
                    <div className="text-[10.5px] font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDate(entry.service_date)} · {entry.performed_by_name}
                        {entry.maintenance_log_service_types?.name
                            ? ` · ${entry.maintenance_log_service_types.name}`
                            : ''}
                    </div>
                </div>
            ))}
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
                            <div
                                className="text-[12px] font-semibold truncate"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {item.name}
                            </div>
                            <div className="text-[10.5px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                {item.category_name} · Plant {item.plant_code}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Add Equipment Modal ─────────────────────────────────────────

const EMPTY_FORM = {
    category_id: '',
    install_date: '',
    location_note: '',
    manufacturer: '',
    model: '',
    name: '',
    plant_code: '',
    serial_number: '',
    service_interval_days: 90
}

function AddEquipmentModal({ isOpen, onClose, onSaved, categories, plants, accentColor, isDark }) {
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showPlantPicker, setShowPlantPicker] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setForm(EMPTY_FORM)
            setError('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const plantLabel = form.plant_code
        ? (() => {
              const match = plants.find((p) => (p.plantCode || p.plant_code) === form.plant_code)
              return match
                  ? `${match.plantCode || match.plant_code} — ${match.plantName || match.plant_name}`
                  : form.plant_code
          })()
        : 'Select Plant'

    const handleSave = async () => {
        if (!form.name.trim()) return setError('Equipment name is required')
        if (!form.category_id) return setError('Category is required')
        if (!form.plant_code) return setError('Plant is required')
        setSaving(true)
        setError('')
        try {
            await MaintenanceLogService.createEquipment({
                category_id: form.category_id,
                install_date: form.install_date || null,
                location_note: form.location_note || null,
                manufacturer: form.manufacturer || null,
                model: form.model || null,
                name: form.name.trim(),
                plant_code: form.plant_code,
                serial_number: form.serial_number || null,
                service_interval_days: parseInt(form.service_interval_days) || 90
            })
            onSaved()
        } catch (err) {
            setError(err?.message || 'Failed to save equipment')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.65)', zIndex: 110 }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg rounded max-h-[90vh] overflow-y-auto"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="sticky top-0 z-10 flex items-center justify-between gap-2.5 px-3 py-2"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-plus text-[11px]" />
                        </div>
                        <span
                            className="text-[9.5px] font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Add Part / Unit / Component
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div
                            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium"
                            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                        >
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Equipment Name <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                            className={FIELD_INPUT_CLS}
                            style={FIELD_INPUT_STYLE}
                            placeholder="e.g. Compressor #1"
                            value={form.name}
                            onChange={(e) => update('name', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Category <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <select
                            className={SELECT_CLS}
                            style={SELECT_STYLE}
                            value={form.category_id}
                            onChange={(e) => update('category_id', e.target.value)}
                        >
                            <option value="">Select Category</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Plant <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <button
                            type="button"
                            className={`${FIELD_INPUT_CLS} text-left cursor-pointer`}
                            style={FIELD_INPUT_STYLE}
                            onClick={() => setShowPlantPicker(true)}
                        >
                            {plantLabel}
                        </button>
                        <PlantDropdownModal
                            isOpen={showPlantPicker}
                            onClose={() => setShowPlantPicker(false)}
                            plants={plants}
                            onSelect={(code) => {
                                update('plant_code', code)
                                setShowPlantPicker(false)
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Manufacturer
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. Ingersoll Rand"
                                value={form.manufacturer}
                                onChange={(e) => update('manufacturer', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Model
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. SSR-2000"
                                value={form.model}
                                onChange={(e) => update('model', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Serial Number
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. SN-12345"
                                value={form.serial_number}
                                onChange={(e) => update('serial_number', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Service Interval (days)
                            </label>
                            <input
                                className={`${FIELD_INPUT_CLS} font-mono tabular-nums`}
                                style={FIELD_INPUT_STYLE}
                                type="number"
                                min="1"
                                value={form.service_interval_days}
                                onChange={(e) => update('service_interval_days', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Install Date
                            </label>
                            <input
                                className={`${FIELD_INPUT_CLS} font-mono tabular-nums`}
                                style={FIELD_INPUT_STYLE}
                                type="date"
                                value={form.install_date}
                                onChange={(e) => update('install_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Location Note
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. Back of batch plant"
                                value={form.location_note}
                                onChange={(e) => update('location_note', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="sticky bottom-0 flex items-center justify-end gap-2 px-3 py-2"
                    style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 transition-colors hover:brightness-95"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: accentColor }}
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-plus'} text-[10px]`} />
                        {saving ? 'Saving…' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Edit Equipment Modal ─────────────────────────────────────────

function EditEquipmentModal({ isOpen, onClose, onSaved, equipment, categories, plants, accentColor }) {
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showPlantPicker, setShowPlantPicker] = useState(false)

    useEffect(() => {
        if (isOpen && equipment) {
            setForm({
                category_id: equipment.category_id || '',
                install_date: equipment.install_date ? equipment.install_date.slice(0, 10) : '',
                location_note: equipment.location_note || '',
                manufacturer: equipment.manufacturer || '',
                model: equipment.model || '',
                name: equipment.name || '',
                plant_code: equipment.plant_code || '',
                serial_number: equipment.serial_number || '',
                service_interval_days: equipment.service_interval_days ?? 90
            })
            setError('')
        }
    }, [isOpen, equipment])

    if (!isOpen || !equipment) return null

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const plantLabel = form.plant_code
        ? (() => {
              const match = plants.find((p) => (p.plantCode || p.plant_code) === form.plant_code)
              return match
                  ? `${match.plantCode || match.plant_code} — ${match.plantName || match.plant_name}`
                  : form.plant_code
          })()
        : 'Select Plant'

    const handleSave = async () => {
        if (!form.name.trim()) return setError('Equipment name is required')
        if (!form.category_id) return setError('Category is required')
        if (!form.plant_code) return setError('Plant is required')
        setSaving(true)
        setError('')
        try {
            await MaintenanceLogService.updateEquipment(equipment.id, {
                category_id: form.category_id,
                install_date: form.install_date || null,
                location_note: form.location_note || null,
                manufacturer: form.manufacturer || null,
                model: form.model || null,
                name: form.name.trim(),
                plant_code: form.plant_code,
                serial_number: form.serial_number || null,
                service_interval_days: parseInt(form.service_interval_days) || 90
            })
            onSaved()
        } catch (err) {
            setError(err?.message || 'Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = FIELD_INPUT_CLS
    const inputStyle = FIELD_INPUT_STYLE
    const labelCls = FIELD_LABEL_CLS

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.65)', zIndex: 120 }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg rounded max-h-[90vh] overflow-y-auto"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="sticky top-0 z-10 flex items-center justify-between gap-2.5 px-3 py-2"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-pen text-[11px]" />
                        </div>
                        <span
                            className="text-[9.5px] font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Edit Item
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div
                            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium"
                            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                        >
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Equipment Name <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                            className={inputCls}
                            style={inputStyle}
                            placeholder="e.g. Compressor #1"
                            value={form.name}
                            onChange={(e) => update('name', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Category <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <select
                            className={SELECT_CLS}
                            style={SELECT_STYLE}
                            value={form.category_id}
                            onChange={(e) => update('category_id', e.target.value)}
                        >
                            <option value="">Select Category</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Plant <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <button
                            type="button"
                            className={`${inputCls} text-left cursor-pointer`}
                            style={inputStyle}
                            onClick={() => setShowPlantPicker(true)}
                        >
                            {plantLabel}
                        </button>
                        <PlantDropdownModal
                            isOpen={showPlantPicker}
                            onClose={() => setShowPlantPicker(false)}
                            plants={plants}
                            onSelect={(code) => {
                                update('plant_code', code)
                                setShowPlantPicker(false)
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                Manufacturer
                            </label>
                            <input
                                className={inputCls}
                                style={inputStyle}
                                placeholder="e.g. Ingersoll Rand"
                                value={form.manufacturer}
                                onChange={(e) => update('manufacturer', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                Model
                            </label>
                            <input
                                className={inputCls}
                                style={inputStyle}
                                placeholder="e.g. SSR-2000"
                                value={form.model}
                                onChange={(e) => update('model', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                Serial Number
                            </label>
                            <input
                                className={inputCls}
                                style={inputStyle}
                                placeholder="e.g. SN-12345"
                                value={form.serial_number}
                                onChange={(e) => update('serial_number', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                Service Interval (days)
                            </label>
                            <input
                                className={inputCls}
                                style={inputStyle}
                                type="number"
                                min="1"
                                value={form.service_interval_days}
                                onChange={(e) => update('service_interval_days', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                Install Date
                            </label>
                            <input
                                className={inputCls}
                                style={inputStyle}
                                type="date"
                                value={form.install_date}
                                onChange={(e) => update('install_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                Location Note
                            </label>
                            <input
                                className={inputCls}
                                style={inputStyle}
                                placeholder="e.g. Back of batch plant"
                                value={form.location_note}
                                onChange={(e) => update('location_note', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div
                    className="sticky bottom-0 flex items-center justify-end gap-2 px-3 py-2"
                    style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 transition-colors hover:brightness-95"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: accentColor }}
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'} text-[10px]`} />
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Log Service Modal ────────────────────────────────────────────

const EMPTY_SERVICE = {
    hours_spent: '',
    notes: '',
    service_date: new Date().toISOString().slice(0, 10),
    service_type_id: ''
}

function LogServiceModal({ isOpen, onClose, onSaved, equipment, serviceTypes, accentColor }) {
    const [form, setForm] = useState(EMPTY_SERVICE)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen && equipment) {
            setForm(EMPTY_SERVICE)
            setError('')
        }
    }, [isOpen, equipment])

    if (!isOpen || !equipment) return null

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const handleSave = async () => {
        if (!form.service_date) return setError('Service date is required')
        setSaving(true)
        setError('')
        try {
            // Auto-calculate next service date from service date + equipment interval
            const nextServiceDate = equipment.service_interval_days
                ? new Date(new Date(form.service_date).getTime() + equipment.service_interval_days * MS_PER_DAY)
                      .toISOString()
                      .slice(0, 10)
                : null
            await MaintenanceLogService.createEntry({
                equipment_id: equipment.id,
                hours_spent: form.hours_spent ? parseFloat(form.hours_spent) : null,
                next_service_date: nextServiceDate,
                notes: form.notes || null,
                plant_code: equipment.plant_code,
                service_date: form.service_date,
                service_type_id: form.service_type_id || null
            })
            onSaved()
        } catch (err) {
            setError(err?.message || 'Failed to log service')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = FIELD_INPUT_CLS
    const inputStyle = FIELD_INPUT_STYLE
    const labelCls = FIELD_LABEL_CLS

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.65)', zIndex: 110 }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md rounded max-h-[90vh] overflow-y-auto"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="sticky top-0 z-10 flex items-center justify-between gap-2.5 px-3 py-2"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-wrench text-[11px]" />
                        </div>
                        <div className="min-w-0">
                            <div
                                className="text-[9.5px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Log Service
                            </div>
                            <div className="text-[10.5px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                                {equipment.name} · {equipment.plant_code}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer shrink-0"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div
                            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium"
                            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                        >
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Service Date <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                            className={inputCls}
                            style={inputStyle}
                            type="date"
                            value={form.service_date}
                            onChange={(e) => update('service_date', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Service Type
                        </label>
                        <select
                            className={SELECT_CLS}
                            style={SELECT_STYLE}
                            value={form.service_type_id}
                            onChange={(e) => update('service_type_id', e.target.value)}
                        >
                            <option value="">Select Type</option>
                            {serviceTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Hours Spent
                        </label>
                        <input
                            className={inputCls}
                            style={inputStyle}
                            type="number"
                            step="0.25"
                            min="0"
                            placeholder="e.g. 2.5"
                            value={form.hours_spent}
                            onChange={(e) => update('hours_spent', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                            Notes
                        </label>
                        <textarea
                            className={`${inputCls} resize-none`}
                            style={inputStyle}
                            rows={3}
                            placeholder="Describe work performed, parts replaced, issues found..."
                            value={form.notes}
                            onChange={(e) => update('notes', e.target.value)}
                        />
                    </div>
                </div>

                <div
                    className="sticky bottom-0 flex items-center justify-end gap-2 px-3 py-2"
                    style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 transition-colors hover:brightness-95"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: accentColor }}
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'} text-[10px]`} />
                        {saving ? 'Saving…' : 'Log Service'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Equipment Detail Panel ──────────────────────────────────────

function EquipmentDetailPanel({ equipment, onClose, onLogService, onEdit, onDelete, isDark, accentColor }) {
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    useEffect(() => {
        if (!equipment) return
        setLoadingHistory(true)
        setConfirmDelete(false)
        MaintenanceLogService.fetchServiceHistory(equipment.id)
            .then(setHistory)
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false))
    }, [equipment])

    if (!equipment) return null

    const info = getProgressInfo(equipment)
    const cfg = STATUS_CONFIG[equipment.service_status] || STATUS_CONFIG.ok

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await MaintenanceLogService.deleteEquipment(equipment.id)
            onDelete()
        } catch {
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    return (
        <div
            className="fixed inset-0 flex justify-end h-screen"
            style={{ background: 'rgba(15, 23, 42, 0.65)', zIndex: 110 }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg h-full overflow-y-auto flex flex-col"
                style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="sticky top-0 z-10 px-3 py-2 shrink-0"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                                className="flex h-7 w-7 items-center justify-center rounded shrink-0"
                                style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                            >
                                <i className={`fas ${equipment.category_icon || 'fa-cog'} text-[12px]`} />
                            </div>
                            <div className="min-w-0">
                                <div
                                    className="text-[9.5px] font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Equipment
                                </div>
                                <div
                                    className="text-[12.5px] font-semibold truncate"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {equipment.name}
                                </div>
                                <div className="text-[10.5px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                                    {equipment.category_name} · Plant {equipment.plant_code}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer shrink-0"
                            style={{ color: 'var(--text-secondary)' }}
                            aria-label="Close"
                        >
                            <i className="fas fa-times text-[11px]" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <StatusBadge status={equipment.service_status} isDark={isDark} />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onLogService(equipment)
                            }}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-2.5 py-1 border-none cursor-pointer"
                            style={{ background: accentColor }}
                        >
                            <i className="fas fa-wrench text-[10px]" />
                            Log Service
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onEdit(equipment)
                            }}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 border-none cursor-pointer transition-colors hover:brightness-95"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            <i className="fas fa-pen text-[10px]" />
                            Edit
                        </button>
                        <div className="ml-auto">
                            {confirmDelete ? (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={deleting}
                                        onClick={handleDelete}
                                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-2.5 py-1 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ background: '#dc2626' }}
                                    >
                                        <i
                                            className={`fas ${deleting ? 'fa-spinner fa-spin' : 'fa-check'} text-[10px]`}
                                        />
                                        {deleting ? 'Deleting…' : 'Confirm'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(false)}
                                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 border-none cursor-pointer"
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(true)}
                                    className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 cursor-pointer"
                                    style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                                >
                                    <i className="fas fa-trash-alt text-[10px]" />
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div className="px-4 py-3 flex-1 overflow-y-auto flex flex-col gap-3">
                    {/* Equipment Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {[
                            { label: 'Manufacturer', value: equipment.manufacturer },
                            { label: 'Model', value: equipment.model },
                            { label: 'Serial Number', value: equipment.serial_number, mono: true },
                            {
                                label: 'Service Interval',
                                mono: true,
                                value: equipment.service_interval_days
                                    ? `${equipment.service_interval_days} days`
                                    : null
                            },
                            {
                                label: 'Install Date',
                                mono: true,
                                value: equipment.install_date ? formatDate(equipment.install_date) : null
                            },
                            { label: 'Location', value: equipment.location_note }
                        ]
                            .filter((row) => row.value)
                            .map(({ label, mono, value }) => (
                                <div key={label}>
                                    <div
                                        className="text-[9.5px] font-semibold uppercase tracking-wider mb-0.5"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        {label}
                                    </div>
                                    <div
                                        className={`text-[12px] font-semibold ${mono ? 'font-mono tabular-nums' : ''}`}
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {value}
                                    </div>
                                </div>
                            ))}
                    </div>

                    {/* Service Progress */}
                    <div
                        className="rounded p-3"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="text-[9.5px] font-semibold uppercase tracking-wider mb-2"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Service Progress
                        </div>
                        <div
                            className="text-[12px] font-semibold mb-2 font-mono tabular-nums"
                            style={{
                                color:
                                    info.status === 'ok' ? 'var(--text-secondary)' : isDark ? cfg.darkColor : cfg.color
                            }}
                        >
                            {info.label}
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ background: cfg.barColor, width: `${info.pct * 100}%` }}
                            />
                        </div>
                        <div
                            className="flex justify-between mt-1.5 text-[10.5px] font-mono tabular-nums"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <span>Last: {formatDate(equipment.last_service_date)}</span>
                            <span>Next: {formatDate(equipment.next_service_date)}</span>
                        </div>
                    </div>

                    {/* Service History */}
                    <div>
                        <div
                            className="text-[9.5px] font-semibold uppercase tracking-wider mb-1.5"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Service History
                        </div>
                        {loadingHistory ? (
                            <div className="flex flex-col gap-1.5">
                                {Array.from({ length: 3 }, (_, i) => (
                                    <div
                                        key={i}
                                        className="rounded p-2.5"
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-light)'
                                        }}
                                    >
                                        <SkeletonBar className="h-3 w-32 mb-1" />
                                        <SkeletonBar className="h-2.5 w-48" />
                                    </div>
                                ))}
                            </div>
                        ) : history.length === 0 ? (
                            <p
                                className="text-[11px] italic py-3 text-center m-0"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                No service history recorded
                            </p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {history.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="rounded p-2.5"
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-light)'
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span
                                                className="text-[12px] font-semibold font-mono tabular-nums"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {formatDate(entry.service_date)}
                                            </span>
                                            {entry.maintenance_log_service_types?.name && (
                                                <span
                                                    className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-secondary)'
                                                    }}
                                                >
                                                    {entry.maintenance_log_service_types.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                                            {entry.performed_by_name}
                                            {entry.hours_spent ? ` · ${entry.hours_spent}h` : ''}
                                        </div>
                                        {entry.notes && (
                                            <p
                                                className="text-[11px] mt-1.5 leading-snug m-0"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {entry.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main View (content-only, props from MaintenanceView) ────────

export default function MaintenanceLogView({
    categories,
    categoryFilter,
    dueItems = [],
    equipment,
    formLoading = false,
    loading,
    mySubmissions = [],
    onCloseAddModal,
    onFormDataReload,
    onReload,
    pendingReviews = [],
    permissions = { canCreate: false, canReview: false },
    plants,
    recentEntries,
    reviewedSubmissions = [],
    searchText,
    selectedPlant,
    serviceTypes,
    showAddModal,
    statusFilter
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#2A3163'
    const isDark = preferences.themeMode === 'dark'
    const isMobile = useIsMobile()

    // Local UI state
    const [sortKey, setSortKey] = useState('')
    const [sortDir, setSortDir] = useState('asc')
    const [calendarDate, setCalendarDate] = useState(new Date())
    const [serviceTarget, setServiceTarget] = useState(null)
    const [detailTarget, setDetailTarget] = useState(null)
    const [editTarget, setEditTarget] = useState(null)

    // Combined-workflow selection. When set, the right pane swaps the
    // equipment table for the inline upload / review / view UI so the user
    // can act on a form without leaving the activity feed.
    const [selectedFormItem, setSelectedFormItem] = useState(null)

    // Refresh form data after the inline form view submits / reviews.
    const handleFormSubmitted = useCallback(() => {
        setSelectedFormItem(null)
        onFormDataReload?.()
    }, [onFormDataReload])

    // Soft-delete a submission from the rail without leaving the page. Wraps
    // both response + parent rows since the responses table FKs back to the
    // submission and would orphan otherwise.
    const handleDeleteSubmission = useCallback(
        async (event, submissionId) => {
            event?.stopPropagation()
            if (!window.confirm('Delete this submission?')) return
            try {
                await Database.from('maintenance_submission_responses').delete().eq('submission_id', submissionId)
                await Database.from('maintenance_submissions').delete().eq('id', submissionId)
                if (selectedFormItem?.id === submissionId) setSelectedFormItem(null)
                onFormDataReload?.()
            } catch (err) {
                console.error('Failed to delete submission:', err)
            }
        },
        [onFormDataReload, selectedFormItem]
    )

    // Inline form-detail click resolves any submission attached to a
    // completed due-item so the right pane can show the scanned upload
    // instead of relaunching the upload form.
    const handleSelectFormItem = useCallback(async (item) => {
        if (item?.__kind === 'form-due' && item.status === 'completed' && item.submission_id) {
            try {
                const submission = await MaintenanceService.fetchSubmissionById(item.submission_id)
                setSelectedFormItem({ ...item, ...submission, __kind: 'form-history', isViewOnly: true })
                return
            } catch {
                // fall through and show the upload UI in case the lookup fails
            }
        }
        setSelectedFormItem(item)
    }, [])

    // ── Filtering (uses props) ──────────────────────────────────
    const filtered = useMemo(() => {
        const query = searchText.trim().toLowerCase()
        return equipment.filter((item) => {
            if (query) {
                const searchable = [
                    item.name,
                    item.serial_number,
                    item.manufacturer,
                    item.model,
                    item.category_name,
                    item.plant_code
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                if (!searchable.includes(query)) return false
            }
            if (selectedPlant && selectedPlant !== 'All') {
                if (selectedPlant.startsWith('DISTRICT:')) {
                    const districtName = selectedPlant.slice(9)
                    const districtPlantCodes = new Set()
                    plants.forEach((p) => {
                        const code = p.plantCode || p.plant_code || ''
                        const districts = p.districts || []
                        districts.forEach((d) => {
                            const name = typeof d === 'string' ? d : d?.name
                            if (name === districtName) districtPlantCodes.add(code.trim().toUpperCase())
                        })
                    })
                    if (!districtPlantCodes.has((item.plant_code || '').trim().toUpperCase())) return false
                } else if ((item.plant_code || '').toUpperCase() !== selectedPlant.toUpperCase()) {
                    return false
                }
            }
            if (categoryFilter && item.category_name !== categoryFilter) return false
            if (statusFilter && statusFilter !== 'All Statuses') {
                const mapped = STATUS_FILTER_MAP[statusFilter]
                if (mapped && item.service_status !== mapped) return false
            }
            return true
        })
    }, [equipment, searchText, selectedPlant, categoryFilter, statusFilter, plants])

    // ── Sorting ─────────────────────────────────────────────────
    const sorted = useMemo(() => {
        if (!sortKey) {
            const priority = { overdue: 0, due_soon: 1, never_serviced: 2, ok: 3 }
            return [...filtered].sort((a, b) => (priority[a.service_status] ?? 3) - (priority[b.service_status] ?? 3))
        }
        const dir = sortDir === 'asc' ? 1 : -1
        return [...filtered].sort((a, b) => {
            let va, vb
            switch (sortKey) {
                case 'Equipment':
                    va = a.name
                    vb = b.name
                    break
                case 'Plant':
                    va = a.plant_code
                    vb = b.plant_code
                    break
                case 'Last Service':
                    va = a.last_service_date || ''
                    vb = b.last_service_date || ''
                    break
                case 'Next Due':
                    va = a.next_service_date || ''
                    vb = b.next_service_date || ''
                    break
                case 'Status': {
                    const p = { overdue: 0, due_soon: 1, never_serviced: 2, ok: 3 }
                    return ((p[a.service_status] ?? 3) - (p[b.service_status] ?? 3)) * dir
                }
                default:
                    return 0
            }
            if (va < vb) return -1 * dir
            if (va > vb) return 1 * dir
            return 0
        })
    }, [filtered, sortKey, sortDir])

    // Counts scoped to plant/search/category but NOT status (for sidebar stats)
    const handleHeaderClick = useCallback(
        (key) => {
            if (sortKey === key) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
            } else {
                setSortKey(key)
                setSortDir('asc')
            }
        },
        [sortKey]
    )

    // ── Render ──────────────────────────────────────────────────

    const headers = ['Equipment', 'Plant', 'Last Service', 'Service Progress', 'Status', '']
    const colWidths = ['', '80px', '120px', '25%', '110px', '50px']

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-12 px-6" style={{ color: 'var(--text-tertiary)' }}>
            <i className="fas fa-clipboard-list text-2xl mb-2" />
            <p className="text-[13px] font-semibold m-0" style={{ color: 'var(--text-primary)' }}>
                No equipment found
            </p>
            <p className="text-[11px] mt-1 m-0">
                {equipment.length
                    ? 'Try adjusting your filters'
                    : 'Add a part, unit, or component to start tracking maintenance'}
            </p>
        </div>
    )

    const equipmentBody = (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-5">
                {loading ? (
                    <ContentSkeleton isMobile={isMobile} />
                ) : (
                    <div className={`flex gap-3 items-start ${isMobile ? 'flex-col' : ''}`}>
                        {/* Content */}
                        <div className="flex-1 min-w-0 w-full overflow-hidden">
                            {sorted.length === 0 ? (
                                <div
                                    className="rounded overflow-hidden"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    {renderEmptyState()}
                                </div>
                            ) : (
                                <div
                                    className="rounded overflow-x-auto"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <table className="w-full border-collapse" style={{ minWidth: '700px' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                                {headers.map((h, i) => (
                                                    <th
                                                        key={h || i}
                                                        className="text-left text-[9.5px] font-semibold uppercase tracking-wider py-2 px-3 cursor-pointer select-none transition-colors hover:bg-bg-tertiary"
                                                        style={{
                                                            borderBottom: '1px solid var(--border-light)',
                                                            color: 'var(--text-secondary)',
                                                            width: colWidths[i] || 'auto'
                                                        }}
                                                        onClick={() => h && handleHeaderClick(h)}
                                                    >
                                                        <span className="inline-flex items-center gap-1">
                                                            {h}
                                                            {sortKey === h && (
                                                                <i
                                                                    className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} text-[9px]`}
                                                                    style={{ color: accentColor }}
                                                                />
                                                            )}
                                                        </span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map((item, idx) => (
                                                <tr
                                                    key={item.id}
                                                    className="cursor-pointer transition-colors hover:bg-bg-tertiary"
                                                    style={{
                                                        background:
                                                            item.service_status === 'overdue'
                                                                ? isDark
                                                                    ? 'rgba(239,68,68,0.04)'
                                                                    : 'rgba(220,53,69,0.03)'
                                                                : 'transparent',
                                                        borderBottom:
                                                            idx < sorted.length - 1
                                                                ? '1px solid var(--border-light)'
                                                                : 'none'
                                                    }}
                                                    onClick={() => setDetailTarget(item)}
                                                >
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                                                                style={{
                                                                    background: 'var(--bg-tertiary)',
                                                                    color: accentColor
                                                                }}
                                                            >
                                                                <i
                                                                    className={`fas ${item.category_icon || 'fa-cog'} text-[11px]`}
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div
                                                                    className="text-[12px] font-semibold truncate"
                                                                    style={{ color: 'var(--text-primary)' }}
                                                                >
                                                                    {item.name}
                                                                </div>
                                                                <div
                                                                    className="text-[10.5px] truncate"
                                                                    style={{ color: 'var(--text-secondary)' }}
                                                                >
                                                                    {item.category_name}
                                                                    {item.manufacturer ? ` · ${item.manufacturer}` : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="py-2 px-3 text-[12px] font-mono tabular-nums"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        {item.plant_code}
                                                    </td>
                                                    <td
                                                        className="py-2 px-3 text-[12px] font-mono tabular-nums"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                    >
                                                        {formatDate(item.last_service_date)}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <ProgressBar item={item} isDark={isDark} />
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <StatusBadge status={item.service_status} isDark={isDark} />
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <button
                                                            type="button"
                                                            className="flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer transition-colors hover:brightness-95"
                                                            style={{
                                                                background:
                                                                    item.service_status === 'overdue'
                                                                        ? isDark
                                                                            ? STATUS_CONFIG.overdue.darkBg
                                                                            : STATUS_CONFIG.overdue.bg
                                                                        : 'var(--bg-tertiary)',
                                                                color:
                                                                    item.service_status === 'overdue'
                                                                        ? isDark
                                                                            ? STATUS_CONFIG.overdue.darkColor
                                                                            : STATUS_CONFIG.overdue.color
                                                                        : 'var(--text-secondary)'
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setServiceTarget(item)
                                                            }}
                                                            title="Log service"
                                                        >
                                                            <i className="fas fa-wrench text-[10px]" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Right rail */}
                        {!isMobile && (
                            <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">
                                <div
                                    className="rounded p-3"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <MiniCalendar
                                        equipment={equipment}
                                        calendarDate={calendarDate}
                                        onCalendarDateChange={setCalendarDate}
                                        isDark={isDark}
                                        accentColor={accentColor}
                                    />
                                </div>
                                <div
                                    className="rounded p-3"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <h4
                                        className="text-[9.5px] font-semibold uppercase tracking-wider mb-2 m-0"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Upcoming & Overdue
                                    </h4>
                                    <UpcomingServices equipment={filtered} isDark={isDark} />
                                    {!filtered.some(
                                        (e) => e.service_status === 'overdue' || e.service_status === 'due_soon'
                                    ) && (
                                        <p
                                            className="text-[10.5px] italic m-0"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            All equipment up to date
                                        </p>
                                    )}
                                </div>
                                <div
                                    className="rounded p-3"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <h4
                                        className="text-[9.5px] font-semibold uppercase tracking-wider mb-2 m-0"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Recent Activity
                                    </h4>
                                    <RecentActivity entries={recentEntries} isDark={isDark} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )

    const showFormsRail = !!(
        permissions.canCreate ||
        permissions.canReview ||
        dueItems.length > 0 ||
        pendingReviews.length > 0 ||
        reviewedSubmissions.length > 0 ||
        mySubmissions.length > 0
    )

    return (
        <>
            <div
                className="flex-1 overflow-hidden flex flex-col lg:flex-row"
                style={{ background: 'var(--bg-secondary)' }}
            >
                {showFormsRail && (
                    <aside
                        className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto"
                        style={{
                            background: 'var(--bg-primary)',
                            borderBottom: isMobile ? '1px solid var(--border-light)' : 'none',
                            borderRight: isMobile ? 'none' : '1px solid var(--border-light)',
                            maxHeight: isMobile ? '50vh' : 'none'
                        }}
                    >
                        <MaintenanceFormsRail
                            accentColor={accentColor}
                            canReview={!!permissions.canReview}
                            dueItems={dueItems}
                            formLoading={formLoading}
                            mySubmissions={mySubmissions}
                            onDeleteSubmission={handleDeleteSubmission}
                            onSelectItem={handleSelectFormItem}
                            pendingReviews={pendingReviews}
                            reviewedSubmissions={reviewedSubmissions}
                            searchText={searchText}
                            selectedItemId={selectedFormItem?.id || null}
                            selectedPlant={selectedPlant}
                        />
                    </aside>
                )}
                <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
                    {selectedFormItem ? (
                        <MaintenanceFormView
                            item={selectedFormItem}
                            onBack={() => setSelectedFormItem(null)}
                            onSubmitted={handleFormSubmitted}
                        />
                    ) : (
                        equipmentBody
                    )}
                </main>
            </div>

            {/* Add Equipment Modal */}
            <AddEquipmentModal
                isOpen={showAddModal}
                onClose={onCloseAddModal}
                onSaved={() => {
                    onCloseAddModal()
                    onReload()
                }}
                categories={categories}
                plants={plants}
                accentColor={accentColor}
                isDark={isDark}
            />

            <LogServiceModal
                isOpen={!!serviceTarget}
                onClose={() => setServiceTarget(null)}
                onSaved={() => {
                    setServiceTarget(null)
                    onReload()
                }}
                equipment={serviceTarget}
                serviceTypes={serviceTypes}
                accentColor={accentColor}
            />

            <EquipmentDetailPanel
                equipment={detailTarget}
                onClose={() => setDetailTarget(null)}
                onLogService={(eq) => {
                    setDetailTarget(null)
                    setServiceTarget(eq)
                }}
                onEdit={(eq) => {
                    setDetailTarget(null)
                    setEditTarget(eq)
                }}
                onDelete={() => {
                    setDetailTarget(null)
                    onReload()
                }}
                isDark={isDark}
                accentColor={accentColor}
            />

            <EditEquipmentModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSaved={() => {
                    setEditTarget(null)
                    onReload()
                }}
                equipment={editTarget}
                categories={categories}
                plants={plants}
                accentColor={accentColor}
            />
        </>
    )
}
