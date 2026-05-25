/* Plan utility constants — all of the pure numeric / string knobs the
 * planner, schedule, and demand views rely on. Kept separate from the
 * helper functions in src/utils/plan/* so a constant value is never
 * imported via a function-heavy module.
 *
 * Many of these are dispatcher-tunable per region via the `plan_settings`
 * table. Those values are declared with `let` so a single
 * `hydratePlanSettings(snapshot)` call at startup can swap them in via
 * ESM live bindings — every consumer that does `import { X }` from this
 * module reads the latest value at access time without code changes at
 * the call site. The defaults below mirror the historical hardcoded
 * values so behavior is identical when no DB row exists. */

/** Pre-trip inspection time before a truck leaves the plant. */
export let PRE_TRIP_MINUTES = 15
export const BUFFER_MINUTES = 5
/** Minutes a truck spends loading concrete at the plant. */
export let LOAD_MINUTES = 10
/** Minutes for the slump / QC test before the truck leaves the plant. */
export let SLUMP_MINUTES = 5
/** Minutes the truck should arrive at the job AHEAD of the order's start
 *  time so the operator isn't pulling up at the same moment concrete is
 *  expected on the ground. */
export let EARLY_ARRIVAL_MINUTES = 5
/** Debounce window before flushing the planner autosave. Short enough that
 *  edits propagate to other browsers in under a second via realtime, long
 *  enough that a burst of keystrokes (typing notes, scrubbing a slider) only
 *  produces one save when the burst settles. */
export const AUTOSAVE_DELAY_MS = 250
export let DEFAULT_STAGGER_MINUTES = 5
export let OVERTIME_THRESHOLD_HOURS = 12
export const GAP_THRESHOLD_MINUTES = 30
export const TARGET_YPH = 3 // minimum yards/hr/op target
export const MAX_YPH = 5 // above this, operators can't keep up

/** Sentinel start times the dispatch HTML uses to flag special order states.
 *  17:00 means the order was cancelled — we keep showing it for transparency
 *  but exclude it from yardage / truck / KPI totals.
 *  18:00 flags a dispatcher test order — not a real pour, always excluded. */
export const CANCELLED_ORDER_START = '17:00'
export const SAME_DAY_ORDER_START = '15:00'
export const TEST_ORDER_START = '18:00'

/**
 * Big-pour rule — fires on any order that's ≥ 120 yd total AND scheduled
 * with back-to-back spacing (< 10 min between trucks). "Back-to-back" means
 * we're loading trucks as fast as we can, typically 5–10 min apart. Jobs
 * this size run long, and at that cadence the pool stays locked until the
 * whole pour is done — so if we under-staff the floor, the rest of the
 * day's schedule slips while trucks finish cycling this one.
 */
export let BIG_POUR_YARDAGE_THRESHOLD = 120
export let BIG_POUR_SPACING_THRESHOLD_MIN = 10
export let BIG_POUR_MIN_TRUCKS = 12
/** Minutes each truck spends on-site pouring at the job (load + unload +
 *  maneuvering + buffer per operator). Added into the cycle time alongside
 *  travel-to-job and travel-back so `cycleMin` reflects the real round-trip
 *  length, not just windshield time. */
export let TRUCK_ON_SITE_MINUTES = 30
/** Max yards a single concrete truck can physically haul. Used as both a
 *  per-order load-size cap and the upper bound on every yards-per-load
 *  metric — anything above this is a data inconsistency, not a real number. */
export const FLEET_MAX_LOAD_SIZE = 10

/** Key under which plan-level metadata rides on the plantProduction object.
 *  Other plant-code keys store real production data; this one stashes
 *  operator shortfalls, special-job flags, etc. */
export const PLAN_META_KEY = '_meta'

/** Kicker reserve config — every Nth job at a plant holds a truck back from
 *  the pool to absorb late yardage additions ("kickers"). When any job in
 *  the block is a big pour, the reserve doubles since kickers there can
 *  swallow several extra trucks at once. Reserves release after a 2–3 hour
 *  window scaled to how spread out the block's jobs are. */
export const KICKER_RESERVE_BLOCK_SIZE = 4
export const KICKER_RESERVE_BASE_TRUCKS = 1
export const KICKER_RESERVE_BIG_POUR_TRUCKS = 2
export const KICKER_RESERVE_MIN_DURATION_MIN = 120
export const KICKER_RESERVE_MAX_DURATION_MIN = 180

/** Minimum pull-up delta worth recommending. Moving a customer by less than
 *  this is more disruption than it's worth — trivial nudges aren't surfaced. */
export let PULL_UP_MIN_DELTA_MIN = 60

/** Realistic notice required to actually call a customer and confirm a moved
 *  start time. Used to chalk a "notify by HH:MM" timestamp on the row so the
 *  dispatcher knows when outreach must happen. */
export let PULL_UP_LEAD_NOTICE_MIN = 120

/** Inline SVG dropdown caret used by the planner's truck-count widgets. */
export const DROPDOWN_ARROW_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`

export const TIMELINE_START_HOUR = 0
export const TIMELINE_END_HOUR = 24
export const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR
export const LABEL_WIDTH = 150
export const DAY_WIDTH = 900 // px per day column

export const LANE_COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1'
]

/* Smyrna's operations run on Central Standard Time regardless of where
 * the dispatcher (or developer) is sitting, so every "today / now /
 * day-of-week" decision in OperationsView anchors here. Pinning the timezone
 * keeps the date math stable when an East-Coast user opens the planner
 * at 11pm — UTC is already tomorrow, but CST is still today. */
export const PLAN_TIME_ZONE = 'America/Chicago'

/* Customer Satisfaction — per-order score is a weighted blend of two
 *  sub-scores derived from actual ticket load times:
 *    pace    — 0.6 weight. Did trucks load on the planned cadence?
 *    onTime  — 0.4 weight. Did the first truck load on or before the
 *              scheduled job start? */
export const CUSTOMER_SAT_PACE_WEIGHT = 0.6
export const CUSTOMER_SAT_ONTIME_WEIGHT = 0.4
export const CUSTOMER_SAT_LATE_WINDOW_MIN = 60
export let BAD_SERVICE_LATE_THRESHOLD_MIN = 15
/** Achieved-yd-per-hour ÷ requested-yd-per-hour. Anything STRICTLY below
 *  this flags the order as slow. Set at 1.0 so any pour that finished
 *  under the requested pace (after kicker exclusion and the small-pour
 *  exemption) is recorded as a bad experience — matches the View Tickets
 *  popup, which shows the actual-vs-target ratio with red/amber any time
 *  the achieved rate dips below target. The earlier 0.7 buffer let jobs
 *  read as "Good service" even when the popup flagged them slow. */
export let BAD_SERVICE_PACE_THRESHOLD = 1.0
/** Jobs at or below either threshold skip the slow-pace check entirely.
 *  Small pours (driveways, patches, hand-finished slabs) are routinely
 *  paced slower than the planned truck-spacing implies, and treating that
 *  as "Poor Service" is a false positive. The on-time start check still
 *  applies — late dispatch is bad regardless of pour size. */
export let SMALL_JOB_TRUCK_THRESHOLD = 3
export let SMALL_JOB_YARDAGE_THRESHOLD = 30

/**
 * Canonical plant-badge colors. Shared across every view that draws a plant
 * marker (Schedule badge, Demand charts, Planner node hints, …) so the same
 * plant always reads as the same hue. Values picked to work in both light
 * and dark themes with a white foreground; `eab308` gets dark text.
 */
export const PLANT_BADGE_COLORS = {
    401: '#f97316', // orange
    402: '#15803d', // dark green
    403: '#7c3aed', // purple
    405: '#b98a50', // tan
    406: '#06b6d4', // cyan
    407: '#0d9488', // teal
    408: '#4f46e5', // indigo — Conroe
    410: '#6b7280', // gray
    453: '#a855f7', // lighter purple
    455: '#d4a373', // lighter tan
    461: '#2563eb', // blue
    468: '#eab308' // yellow
}

/**
 * Pre-defined order-size slots the dispatcher might be asked to take on.
 * Each entry captures the MINIMUM truck floor plus a conservative duration
 * estimate used to find a window where the plant has enough idle capacity.
 *
 *   - Large pour: 6–12+ trucks (needs 6 floor; big pours run ~3h)
 *   - Medium pour: 3–5 trucks (needs 3 floor; ~60 min round)
 *   - Small pour: 1–2 trucks (needs 1 floor; ~30 min round)
 */
export const SUGGESTED_SLOT_TYPES = [
    { durationMin: 180, key: 'large', label: 'Large pour · 6–12+ trucks', minTrucks: 6, truckRange: '6–12+' },
    { durationMin: 60, key: 'medium', label: 'Medium pour · 3–5 trucks', minTrucks: 3, truckRange: '3–5' },
    { durationMin: 30, key: 'small', label: 'Small pour · 1–2 trucks', minTrucks: 1, truckRange: '1–2' }
]

export let SLOT_DAY_START_MIN = 6 * 60
export let SLOT_DAY_END_MIN = 18 * 60
export let SLOT_GRID_MIN = 30

/* ── Runtime hydration ───────────────────────────────────────────────
 * `hydratePlanSettings(snapshot)` mutates every `let`-declared constant
 * above from a `plan_settings` row. Consumers don't observe the swap
 * directly — they import the symbols once and rely on ESM live bindings
 * to read the latest value at each access. Pass a partial snapshot to
 * patch only the keys you care about; missing keys leave their current
 * value untouched. `null` / `undefined` / non-finite numerics are
 * skipped so a sparse server payload can't blank a constant out. */

/** Shape of one row from the `plan_settings` table. All numeric columns
 *  arrive as `number`; `slow_pace_min_ratio` is `numeric(4,2)` so it can
 *  also surface as a string from PostgREST — `coerceNumber` handles it.
 *
 *  Encoded as a JSDoc typedef rather than a `.ts` interface so the
 *  project's plain-ESLint parser (no @typescript-eslint plugin) can lint
 *  this file. Editors still pick up the typedef for autocomplete.
 *
 *  @typedef {Object} PlanSettingsSnapshot
 *  @property {number|string|null} [pre_trip_minutes]
 *  @property {number|string|null} [plant_load_minutes]
 *  @property {number|string|null} [slump_test_minutes]
 *  @property {number|string|null} [early_arrival_minutes]
 *  @property {number|string|null} [on_site_minutes_per_truck]
 *  @property {number|string|null} [default_truck_spacing_minutes]
 *  @property {number|string|null} [overtime_warning_hours]
 *  @property {number|string|null} [late_threshold_minutes]
 *  @property {number|string|null} [slow_pace_min_ratio]
 *  @property {number|string|null} [small_pour_max_trucks]
 *  @property {number|string|null} [small_pour_max_yardage]
 *  @property {number|string|null} [big_pour_min_yardage]
 *  @property {number|string|null} [big_pour_max_spacing_minutes]
 *  @property {number|string|null} [big_pour_min_trucks]
 *  @property {number|string|null} [pull_up_min_savings_minutes]
 *  @property {number|string|null} [pull_up_customer_notice_minutes]
 *  @property {number|string|null} [day_start_minutes]
 *  @property {number|string|null} [day_end_minutes]
 *  @property {number|string|null} [slot_granularity_minutes]
 */

const coerceNumber = (raw) => {
    if (raw == null) return null
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
    return Number.isFinite(n) ? n : null
}

const assignIfFinite = (raw, apply) => {
    const value = coerceNumber(raw)
    if (value != null) apply(value)
}

/**
 * Hydrate plan-related runtime constants from a `plan_settings` row.
 * Safe to call repeatedly (e.g. on region change or after dispatcher
 * saves new values). A `null` or empty snapshot is a no-op — the
 * baked-in defaults stand in for any unconfigured region.
 *
 * @param {PlanSettingsSnapshot | null | undefined} snapshot
 */
export function hydratePlanSettings(snapshot) {
    if (!snapshot) return
    assignIfFinite(snapshot.pre_trip_minutes, (v) => (PRE_TRIP_MINUTES = v))
    assignIfFinite(snapshot.plant_load_minutes, (v) => (LOAD_MINUTES = v))
    assignIfFinite(snapshot.slump_test_minutes, (v) => (SLUMP_MINUTES = v))
    assignIfFinite(snapshot.early_arrival_minutes, (v) => (EARLY_ARRIVAL_MINUTES = v))
    assignIfFinite(snapshot.on_site_minutes_per_truck, (v) => (TRUCK_ON_SITE_MINUTES = v))
    assignIfFinite(snapshot.default_truck_spacing_minutes, (v) => (DEFAULT_STAGGER_MINUTES = v))
    assignIfFinite(snapshot.overtime_warning_hours, (v) => (OVERTIME_THRESHOLD_HOURS = v))
    assignIfFinite(snapshot.late_threshold_minutes, (v) => (BAD_SERVICE_LATE_THRESHOLD_MIN = v))
    assignIfFinite(snapshot.slow_pace_min_ratio, (v) => (BAD_SERVICE_PACE_THRESHOLD = v))
    assignIfFinite(snapshot.small_pour_max_trucks, (v) => (SMALL_JOB_TRUCK_THRESHOLD = v))
    assignIfFinite(snapshot.small_pour_max_yardage, (v) => (SMALL_JOB_YARDAGE_THRESHOLD = v))
    assignIfFinite(snapshot.big_pour_min_yardage, (v) => (BIG_POUR_YARDAGE_THRESHOLD = v))
    assignIfFinite(snapshot.big_pour_max_spacing_minutes, (v) => (BIG_POUR_SPACING_THRESHOLD_MIN = v))
    assignIfFinite(snapshot.big_pour_min_trucks, (v) => (BIG_POUR_MIN_TRUCKS = v))
    assignIfFinite(snapshot.pull_up_min_savings_minutes, (v) => (PULL_UP_MIN_DELTA_MIN = v))
    assignIfFinite(snapshot.pull_up_customer_notice_minutes, (v) => (PULL_UP_LEAD_NOTICE_MIN = v))
    assignIfFinite(snapshot.day_start_minutes, (v) => (SLOT_DAY_START_MIN = v))
    assignIfFinite(snapshot.day_end_minutes, (v) => (SLOT_DAY_END_MIN = v))
    assignIfFinite(snapshot.slot_granularity_minutes, (v) => (SLOT_GRID_MIN = v))
}
