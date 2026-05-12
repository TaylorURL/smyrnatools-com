/** Constants and pure helpers for the maintenance-log equipment view. */

export const STATUS_CONFIG = {
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

export const STATUS_FILTER_MAP = {
    'Due Soon': 'due_soon',
    'Never Serviced': 'never_serviced',
    OK: 'ok',
    Overdue: 'overdue'
}

export const MS_PER_DAY = 86_400_000

export const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export const CHEVRON_BG =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")"

export const SELECT_CLS =
    'w-full appearance-none rounded bg-no-repeat px-2.5 py-1.5 pr-8 text-[12.5px] outline-none cursor-pointer'

export const SELECT_STYLE = {
    background: 'var(--bg-secondary)',
    backgroundImage: CHEVRON_BG,
    backgroundPosition: 'right 8px center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '14px',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

export const FIELD_INPUT_CLS = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none'

export const FIELD_INPUT_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

export const FIELD_LABEL_CLS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'

export const EMPTY_EQUIPMENT_FORM = {
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

export const EMPTY_SERVICE_FORM = {
    hours_spent: '',
    notes: '',
    service_date: new Date().toISOString().slice(0, 10),
    service_type_id: ''
}

/** @returns {string} Formatted date like "May 12, 2026" or em-dash for missing values */
export function formatLogDate(dateStr) {
    if (!dateStr) return '\u2014'
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysBetween(dateA, dateB) {
    return Math.round((new Date(dateB) - new Date(dateA)) / MS_PER_DAY)
}

export function getProgressInfo(item) {
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
            label: `${elapsed} of ${interval} days \u2014 due ${formatLogDate(item.next_service_date)}`,
            overdueDays: 0,
            pct,
            status: 'due_soon'
        }
    }
    return { label: `${elapsed} of ${interval} days`, overdueDays: 0, pct, status: 'ok' }
}

export function getCalendarDays(year, month) {
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

export function toDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Status-priority sort value — lower = more urgent */
export const STATUS_PRIORITY = { overdue: 0, due_soon: 1, never_serviced: 2, ok: 3 }
