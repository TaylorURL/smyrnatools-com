/* Plan utility constants — all of the pure numeric / string knobs the
 * planner, schedule, and demand views rely on. Kept separate from the
 * helper functions in src/utils/plan/* so a constant value is never
 * imported via a function-heavy module. */

/** Pre-trip inspection time before a truck leaves the plant. */
export const PRE_TRIP_MINUTES = 15
export const BUFFER_MINUTES = 5
/** Minutes a truck spends loading concrete at the plant. */
export const LOAD_MINUTES = 10
/** Minutes for the slump / QC test before the truck leaves the plant. */
export const SLUMP_MINUTES = 5
/** Minutes the truck should arrive at the job AHEAD of the order's start
 *  time so the operator isn't pulling up at the same moment concrete is
 *  expected on the ground. */
export const EARLY_ARRIVAL_MINUTES = 5
export const AUTOSAVE_DELAY_MS = 1000
export const DEFAULT_STAGGER_MINUTES = 5
export const OVERTIME_THRESHOLD_HOURS = 12
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
export const BIG_POUR_YARDAGE_THRESHOLD = 120
export const BIG_POUR_SPACING_THRESHOLD_MIN = 10
export const BIG_POUR_MIN_TRUCKS = 12
/** Minutes each truck spends on-site pouring at the job (load + unload +
 *  maneuvering + buffer per operator). Added into the cycle time alongside
 *  travel-to-job and travel-back so `cycleMin` reflects the real round-trip
 *  length, not just windshield time. */
export const TRUCK_ON_SITE_MINUTES = 30
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
export const PULL_UP_MIN_DELTA_MIN = 60

/** Realistic notice required to actually call a customer and confirm a moved
 *  start time. Used to chalk a "notify by HH:MM" timestamp on the row so the
 *  dispatcher knows when outreach must happen. */
export const PULL_UP_LEAD_NOTICE_MIN = 120

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
 * day-of-week" decision in PlanView anchors here. Pinning the timezone
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
export const BAD_SERVICE_LATE_THRESHOLD_MIN = 15
export const BAD_SERVICE_PACE_THRESHOLD = 0.7
/** Jobs at or below either threshold skip the slow-pace check entirely.
 *  Small pours (driveways, patches, hand-finished slabs) are routinely
 *  paced slower than the planned truck-spacing implies, and treating that
 *  as "Poor Service" is a false positive. The on-time start check still
 *  applies — late dispatch is bad regardless of pour size. */
export const SMALL_JOB_TRUCK_THRESHOLD = 3
export const SMALL_JOB_YARDAGE_THRESHOLD = 30

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

export const SLOT_DAY_START_MIN = 6 * 60
export const SLOT_DAY_END_MIN = 18 * 60
export const SLOT_GRID_MIN = 30
