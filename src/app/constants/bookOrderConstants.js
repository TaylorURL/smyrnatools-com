export const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

export const FIELD_LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wider mb-2'

export const SCHEDULE_PREVIEW_HEADERS = [
    'Start',
    'Plant',
    'Order',
    'Customer',
    'Location',
    'Product',
    'Yards',
    'Trucks'
]

/** Reasons the system overrides the dispatcher's typed time. Mirrors the
 *  priority used by `findRecommendedStartTime` so the explanation matches
 *  which constraint actually flipped the suggestion. */
export const AFTER_HOURS_CUTOFF_MIN = 13 * 60
export const IDLE_GAP_THRESHOLD_MIN = 90

export const DECORATIVE_CYCLE_MS = 5000

/* Strict 24-hour clock pattern: HH:MM with HH = 00-23 and MM = 00-59. The
 * regex is mirrored on the input's `pattern` attribute so the browser blocks
 * non-conforming submits, AND used in JS to gate `buildBookingRequest`. */
export const MILITARY_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const isValidMilitaryTime = (value) => MILITARY_TIME_RE.test(String(value || '').trim())

/** Auto-format shortcuts → canonical HH:MM. Lets the dispatcher type fast:
 *    "9"    → "09:00"     "16"   → "16:00"
 *    "930"  → "09:30"     "1630" → "16:30"
 *    "0900" → "09:00"     "9:3"  → unchanged (let the user finish typing)
 *  Returns the original string when the digits don't fit a sensible
 *  HH/HHMM/HMM shape so the inline pattern-mismatch error still fires. */
export const normalizeMilitaryTime = (raw) => {
    const trimmed = String(raw || '').trim()
    if (!trimmed || isValidMilitaryTime(trimmed)) return trimmed
    if (trimmed.includes(':')) return trimmed
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length < 1 || digits.length > 4 || digits.length !== trimmed.length) return trimmed
    let hours
    let minutes
    if (digits.length <= 2) {
        hours = digits.padStart(2, '0')
        minutes = '00'
    } else {
        const split = digits.length - 2
        hours = digits.slice(0, split).padStart(2, '0')
        minutes = digits.slice(split)
    }
    const formatted = `${hours}:${minutes}`
    return isValidMilitaryTime(formatted) ? formatted : trimmed
}

/** "Tue, May 13" — used by the conflict panel when recommending a
 *  cross-day shift so the dispatcher reads the day at a glance. */
export const formatFullDateLabel = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(`${dateStr}T00:00:00`)
    if (!Number.isFinite(date.getTime())) return dateStr
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' })
}

/** Wraps minutes (any sign) onto a 24h clock and renders as `HH:MM`. */
export const formatMinutesAsClock = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.floor(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "Pool tone" pill color, mirroring the schedule tab — < 0 = red
 *  (overbooked), 0–2 = amber (tight margin), ≥ 3 = green (comfortable
 *  headroom). */
export const poolPillColor = (poolAfter) => {
    if (!Number.isFinite(poolAfter)) return 'var(--text-tertiary)'
    if (poolAfter < 0) return '#dc2626'
    if (poolAfter <= 2) return '#d97706'
    return '#16a34a'
}

/* ── Booking recommender — pour-math defaults ─────────────────────────── */

/** Defaults used when an explicit field isn't provided on the request or an
 *  order. Tuned to match common Smyrna pours so the recommender stays close
 *  to reality without forcing the dispatcher to pick load-size / spacing on
 *  the form. */
export const DEFAULT_LOAD_SIZE_YARDS = 10
export const DEFAULT_TRUCK_SPACING_MIN = 5
export const DEFAULT_POUR_TAIL_MIN = 30
export const DEFAULT_TRAVEL_OUT_MIN = 25

/**
 * Pre-defined pour-method profiles. Each option carries the per-truck
 * `tailMin` (the minutes the last truck spends on-site discharging +
 * cleaning up) and a typical `spacingMin` between truck arrivals. The
 * combination drives both how many trucks the recommender thinks are
 * needed AND how long the pour ties up the plant's pool.
 *
 * Pumps move concrete fastest — the truck just dumps into the pump
 * hopper and leaves — so spacing and tail are tight. Tailgating runs
 * the chute directly, slower per truck. "Various locations" assumes the
 * truck repositions multiple times for spread-out pours, which adds
 * meaningful overhead per truck.
 */
export const POUR_METHOD_OPTIONS = [
    { label: 'Large pump · fast pace', spacingMin: 4, tailMin: 20, value: 'large_pump_fast' },
    { label: 'Large pump · slow pace', spacingMin: 7, tailMin: 35, value: 'large_pump_slow' },
    { label: 'Small / ground pump · fast pace', spacingMin: 6, tailMin: 25, value: 'small_pump_fast' },
    { label: 'Small / ground pump · slow pace', spacingMin: 10, tailMin: 40, value: 'small_pump_slow' },
    { label: 'Tailgating · fast pace', spacingMin: 5, tailMin: 25, value: 'tailgate_fast' },
    { label: 'Tailgating · slow pace', spacingMin: 10, tailMin: 40, value: 'tailgate_slow' },
    { label: 'Tailgating · multiple locations', spacingMin: 12, tailMin: 50, value: 'tailgate_multi' },
    { label: 'Other · fast pace', spacingMin: 5, tailMin: 30, value: 'other_fast' },
    { label: 'Other · slow pace', spacingMin: 10, tailMin: 40, value: 'other_slow' }
]

/* Hard cap on simultaneous launches per plant. A single plant can't
 * physically load four trucks at the same minute — load + slump + chute
 * cleanup compete for the same loading bay, so dispatch reality is two
 * trucks side-by-side at most plants and three at the busiest. We
 * expose 3 as the ceiling and reject any slot suggestion that would
 * push a plant past it. */
export const MAX_CONCURRENT_LAUNCHES_PER_PLANT = 3

/* Maximum drive-time (minutes) a lender plant can sit from the plant
 * that's short on trucks and still be considered viable help. Anything
 * beyond a one-hour drive eats too much of the lender's shift to make
 * dispatching their trucks practical, so those plants are filtered out
 * of the help-availability list entirely. */
export const MAX_HELP_TRAVEL_MIN_FROM_PLANT = 60

/* Conversion of one-way travel minutes → 0..1 proximity score. 0 min ≈ 1.0,
 * a 60+ min haul collapses to 0. Linear decay reads naturally for the
 * dispatcher: a 30-min plant scores ~0.5, half as "close" as a 0-min one.
 * Same horizon doubles as the hard cutoff in `rankPlantsForBooking` —
 * plants further than this are dropped from the recommendations entirely. */
export const TRAVEL_MIN_HORIZON = 60

/* Recommendation score weights — must sum to 1.0. Capacity dominates because
 * sending a truck that doesn't exist is worse than sending one a few extra
 * miles; proximity is second; concurrent-load is a tiebreaker that prefers
 * a quieter plant when capacity & distance are roughly equal. */
export const WEIGHT_CAPACITY = 0.5
export const WEIGHT_PROXIMITY = 0.3
export const WEIGHT_LOAD_BALANCE = 0.2

/* ── Alternate-time scan window ───────────────────────────────────────── */

/* Window scanned when proposing alternate start times. The scan covers
 * the full 00:00–13:00 span — slots inside the canonical preferred
 * window rank ahead of slots outside it, but outside slots are still
 * considered when the preferred window is fully booked. */
export const ALTERNATE_SCAN_STEP_MIN = 30
export const ALTERNATE_SCAN_START_MIN = 0
export const ALTERNATE_SCAN_END_MIN = 13 * 60
export const ALTERNATE_MIN_GAP_MIN = ALTERNATE_SCAN_STEP_MIN

/* Canonical preferred booking window — fits any pour size. The
 * recommender fills this window first; once it's full, it spills BEFORE
 * (earlier in the day, bounded by the 10-hour rest reset from the prior
 * day's last ticket) and AFTER (later in the day, bounded by the
 * 14-hour shift cap from the earliest operator start). */
export const PREFERRED_WINDOW_START_MIN = 5 * 60
export const PREFERRED_WINDOW_END_MIN = 12 * 60

/* Anchor used as a within-window tiebreaker. Slots closer to the
 * middle of the preferred window beat slots near the edges — packs
 * the day naturally without pulling pours to the absolute earliest
 * or latest minute of the window. */
export const SHIFT_ANCHOR_MIN = Math.floor((PREFERRED_WINDOW_START_MIN + PREFERRED_WINDOW_END_MIN) / 2)

/* DOT 14-hour driver shift cap — clock-in to back-at-yard. Suggestions
 * whose projected back-at-yard would push the plant's earliest operator
 * past this many minutes are filtered out. */
export const SHIFT_LIMIT_MIN = 14 * 60

/* Mandated minimum off-the-clock window between an operator's last back-
 * at-yard and their next clock-in. Drives the per-plant floor derived
 * from yesterday's actual ticket times. */
export const REST_HOURS_MIN = 10 * 60

/* Single-load discharge time at the job. Each ticket = one truck load; the
 * full pour TAIL only matters at the order level. */
export const PER_LOAD_POUR_MIN = 10

/* "Materially tighter" threshold — another preferred fitting slot must
 * shave at least an hour off the chosen slot's idle gap before we
 * override the dispatcher's choice. */
export const TIGHTER_GAP_THRESHOLD_MIN = 60

/* Spread the surfaced alternate slots across the day instead of
 * returning three windows that sit within an hour of each other. */
export const DIVERSE_SPREAD_MIN = 120
