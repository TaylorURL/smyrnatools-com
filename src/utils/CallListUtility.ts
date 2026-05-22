/** Shared constants + tiny helpers for the Plan -> Call List tab. Lives in
 *  utils so the row, detail panel, and view file can all import from one
 *  source without circular references. */

interface CallOutcomeButton {
    color: string
    icon: string
    key: string
    label: string
}

interface SortOption {
    key: string
    label: string
}

interface CallListRow {
    contact_name?: string | null
    customer_name?: string | null
    customer_num?: string | null
    last_call_at?: string | null
    last_pour_date?: string | null
    phone?: string | null
    pour_days_last_year?: number | null
    [key: string]: unknown
}

export const CALL_OUTCOME_BUTTONS: CallOutcomeButton[] = [
    { color: '#64748b', icon: 'fa-phone-slash', key: 'no_answer', label: 'No Answer' },
    { color: '#2563eb', icon: 'fa-rotate-right', key: 'will_book_again', label: 'Will Book Again' },
    { color: '#16a34a', icon: 'fa-circle-check', key: 'booked', label: 'Booked' },
    { color: '#dc2626', icon: 'fa-circle-xmark', key: 'not_interested', label: 'Not Interested' }
]

export const CALL_OUTCOME_LABELS: Record<string, string> = {
    booked: 'Booked',
    no_answer: 'No Answer',
    not_interested: 'Not Interested',
    note: 'Note',
    will_book_again: 'Will Book Again'
}

export const CALL_OUTCOME_COLORS: Record<string, string> = {
    booked: '#16a34a',
    no_answer: '#64748b',
    not_interested: '#dc2626',
    note: '#7c3aed',
    will_book_again: '#2563eb'
}

export const CALL_LIST_SORT_OPTIONS: SortOption[] = [
    { key: 'oldest', label: 'Longest dormant' },
    { key: 'newest', label: 'Most recent pour' },
    { key: 'volume', label: 'Most pours / yr' },
    { key: 'name', label: 'Customer name' }
]

/** Pretty-print a phone number. Accepts US 10- or 11-digit strings; falls
 *  back to the original input for anything else (intl, vanity, etc.). */
export const formatCallListPhone = (phone: string | null | undefined): string => {
    if (!phone) return ''
    const digits = String(phone).replace(/\D/g, '')
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    }
    return phone
}

interface ParsedPhone {
    /** Pretty-printed form for display, e.g. `(713) 555-0001`. */
    display: string
    /** `tel:` href value — strips formatting, keeps leading `+` if present. */
    href: string
    /** Optional inline label captured from the source, e.g. `Office`,
     *  `Mobile`, `Alt`. Empty when no label was found. */
    label: string
    /** Stable identity for `key=` props + the "tried" multi-select set —
     *  digits-only so cosmetic formatting changes don't fragment selection. */
    key: string
    /** The exact raw substring we extracted, preserved for logging back
     *  into the call entry so audit history shows what the dispatcher
     *  actually saw on screen. */
    raw: string
}

/** Splits a dispatch-imported `phone` field into one or more parsed phone
 *  entries. The Daily Order Listing crams multiple numbers into a single
 *  string — typical separators are comma, semicolon, slash, the word
 *  "or", or a newline. Inline labels in parentheses or after a colon are
 *  extracted into the `label` field so the UI can render them as
 *  `(713) 555-0001 · Office` instead of mashing the label into the
 *  formatted number. Returns an empty array for blank input. */
export const parsePhoneNumbers = (raw: string | null | undefined): ParsedPhone[] => {
    if (!raw) return []
    const text = String(raw).trim()
    if (!text) return []
    // Split on common separators. The dispatch import sometimes uses the
    // literal word "or" between numbers ("(713) 555-0001 or (713) 555-0002")
    // so we substitute that to a comma first.
    const normalized = text
        .replace(/\bor\b/gi, ',')
        .replace(/\b(?:and|cell|office|mobile|fax|alt)\s*[:#-]?\s*/gi, (match) => `, ${match.trim()}: `)
    const chunks = normalized
        .split(/[,;|\n\r/]+/)
        .map((c) => c.trim())
        .filter(Boolean)
    const out: ParsedPhone[] = []
    const seen = new Set<string>()
    for (const chunk of chunks) {
        // Pull a trailing or leading label like "Office:", "(office)", "mobile -"
        let label = ''
        let numberPart = chunk
        const parenLabel = chunk.match(/\(([^()0-9]+)\)/)
        if (parenLabel && parenLabel[1] && /[a-z]/i.test(parenLabel[1])) {
            label = parenLabel[1].trim()
            numberPart = chunk.replace(parenLabel[0], '').trim()
        }
        const colonLabel = numberPart.match(/^([A-Za-z][A-Za-z\s]*)[:\-#]\s*/)
        if (colonLabel) {
            label = label || colonLabel[1].trim()
            numberPart = numberPart.slice(colonLabel[0].length).trim()
        }
        const trailingLabel = numberPart.match(/[\s\-:]([A-Za-z][A-Za-z\s]*)$/)
        if (!label && trailingLabel) {
            label = trailingLabel[1].trim()
            numberPart = numberPart.slice(0, trailingLabel.index).trim()
        }
        const digits = numberPart.replace(/\D/g, '')
        if (digits.length < 7) continue
        const key = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
            display: formatCallListPhone(numberPart) || numberPart,
            href: numberPart.startsWith('+') ? `+${digits}` : digits,
            key,
            label: label.replace(/\s+/g, ' ').trim(),
            raw: numberPart
        })
    }
    return out
}

/** Returns the ISO date (YYYY-MM-DD) for `value` in the user's local
 *  timezone. Used to bucket call entries into "today" for the goal bar. */
export const localIsoDate = (value: string | Date | null | undefined): string => {
    if (!value) return ''
    const d = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** Default daily call target — used as the denominator for the goal bar
 *  at the top of the Call List view. Tuned for a focused cold-calling
 *  session (~30 min of calls at ~1.5 min each). The user can adjust this
 *  via the goal pill inline once a session settings table exists. */
export const DEFAULT_DAILY_CALL_TARGET = 20

/** Per-outcome weight for the "session momentum" hint shown next to the
 *  goal bar. Booked is worth the most because it's the only outcome that
 *  directly drives yardage; will-book-again is the warm follow-up;
 *  no-answer and notes get a small boost for the effort. */
export const CALL_OUTCOME_MOMENTUM_WEIGHTS: Record<string, number> = {
    booked: 5,
    not_interested: 1,
    no_answer: 1,
    note: 1,
    will_book_again: 3
}

/** Color tone for the days-dormant badge — same red/amber/green tiers used
 *  by the schedule tab's other health indicators. Negative days mean the
 *  customer is on the schedule for a future pour (their `last_pour_date` is
 *  ahead of today), which is the healthiest state — render as green. */
export const dormancyTone = (days: number): string => {
    if (days < 0) return '#16a34a'
    if (days >= 180) return '#dc2626'
    if (days >= 90) return '#d97706'
    return '#16a34a'
}

/** True when the customer's most recent recorded pour is in the future,
 *  i.e. they're booked on an upcoming schedule but haven't poured yet.
 *  The aggregator reports this as a negative day count. */
export const isCustomerOnSchedule = (days: number | null | undefined): boolean =>
    Number.isFinite(days as number) && (days as number) < 0

/** Formats the days-since-last-pour value for display. Customers booked for
 *  a future pour (negative days) read as "On Schedule" rather than a
 *  meaningless `-3d`. Falls back to `Nd` for normal dormant rows. */
export const formatDormancyLabel = (days: number | null | undefined, suffix = ''): string => {
    if (!Number.isFinite(days as number)) return '—'
    if ((days as number) < 0) return 'On Schedule'
    return `${days}d${suffix}`
}

/** Cooldown after a logged call. Customers contacted within this window are
 *  pushed to the bottom of the list regardless of dormancy — once a month
 *  has passed since the last contact they re-enter the main tier and rise
 *  back to the top by their longest-dormant ranking. */
export const RECENT_CALL_COOLDOWN_DAYS = 30

/** Whole days between `from` (ISO timestamp/string) and now. Returns null
 *  for missing/unparseable input. Used to label rows like "called 3d ago". */
export const daysSinceTimestamp = (from: string | null | undefined): number | null => {
    if (!from) return null
    const ms = Date.parse(from)
    if (Number.isNaN(ms)) return null
    const diff = Math.max(0, Date.now() - ms)
    return Math.floor(diff / 86_400_000)
}

/** Short relative-day label for the row's "called X" badge. */
export const formatRelativeDays = (from: string | null | undefined): string => {
    const days = daysSinceTimestamp(from)
    if (days == null) return ''
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.round(days / 7)}w ago`
    return `${Math.round(days / 30)}mo ago`
}

/** True when the customer has been logged inside the cooldown window. */
export const wasRecentlyCalled = (lastCallAt: string | null | undefined): boolean => {
    const days = daysSinceTimestamp(lastCallAt)
    return days != null && days < RECENT_CALL_COOLDOWN_DAYS
}

/** Case-insensitive substring search across the row's display fields. */
export const matchesCallListQuery = (row: CallListRow, query: string | null | undefined): boolean => {
    if (!query) return true
    const haystack = [row.customer_name, row.customer_num, row.contact_name, row.phone]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(' | ')
    return haystack.includes(query)
}

const compareWithinTier = (a: CallListRow, b: CallListRow, sortKey: string): number => {
    if (sortKey === 'newest') return String(b.last_pour_date || '').localeCompare(String(a.last_pour_date || ''))
    if (sortKey === 'volume') return (b.pour_days_last_year || 0) - (a.pour_days_last_year || 0)
    if (sortKey === 'name') return String(a.customer_name || '').localeCompare(String(b.customer_name || ''))
    return String(a.last_pour_date || '').localeCompare(String(b.last_pour_date || ''))
}

/** Two-tier sort: customers contacted inside the cooldown window drop to a
 *  bottom tier (most recently called LAST so the dispatcher sees the next
 *  callable customer at the top). Within each tier the chosen sortKey
 *  applies — default 'oldest' surfaces the longest-dormant first. */
export const sortCallListRoster = (rows: CallListRow[], sortKey: string): CallListRow[] => {
    const fresh: CallListRow[] = []
    const recent: CallListRow[] = []
    for (const row of rows) {
        if (wasRecentlyCalled(row.last_call_at)) recent.push(row)
        else fresh.push(row)
    }
    fresh.sort((a, b) => compareWithinTier(a, b, sortKey))
    recent.sort((a, b) => {
        const aMs = Date.parse(a.last_call_at || '') || 0
        const bMs = Date.parse(b.last_call_at || '') || 0
        return aMs - bMs
    })
    return [...fresh, ...recent]
}
