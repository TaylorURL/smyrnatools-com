/* Plan Settings schema — describes every operational knob the
 * `plan_settings` migration exposes through the Settings tab UI. The
 * inline validator and the hook layer both read from this single
 * source of truth so labels / defaults / ranges stay in lockstep with
 * the DB constraints in `supabase/migrations/20260521_plan_settings.sql`.
 *
 * Each field carries:
 *   column     — SQL column name (DB source of truth)
 *   label      — human title shown in the form
 *   helper     — one-line description below the input
 *   unit       — short trailing label (e.g. "minutes", "hours", "yards")
 *   step       — input granularity (1 for ints, 0.01 for ratios)
 *   min / max  — DB CHECK range, mirrored as inline validation
 *   default    — historical hardcoded value the JS constants used
 *
 * Find-a-Spot-only knobs (`pull_up_*`, slot scanner window /
 * granularity, `per_load_pour_minutes`, `required_rest_hours`) are
 * deliberately omitted — that feature is disabled at the tab level,
 * so exposing them in the form would be misleading. The SQL columns
 * stay on the table and the runtime hydrators still wire them up, so
 * re-enabling Find a Spot only requires putting the fields back in
 * the schema below. */

export const PLAN_SETTINGS_FIELDS = [
    {
        description: 'Truck cycle times that feed every pool / schedule / pull-up calculation.',
        fields: [
            {
                column: 'pre_trip_minutes',
                default: 15,
                helper: 'Pre-trip inspection time before a truck leaves the plant.',
                label: 'Pre-trip inspection',
                max: 240,
                min: 0,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'plant_load_minutes',
                default: 10,
                helper: 'Time a truck spends loading concrete at the silo.',
                label: 'Plant load',
                max: 240,
                min: 0,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'slump_test_minutes',
                default: 5,
                helper: 'Slump / QC test time before the truck leaves the plant.',
                label: 'Slump / QC test',
                max: 240,
                min: 0,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'early_arrival_minutes',
                default: 5,
                helper: 'How early the first truck should arrive on site versus the order start.',
                label: 'Early arrival',
                max: 240,
                min: 0,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'on_site_minutes_per_truck',
                default: 30,
                helper: 'Total minutes a truck spends on site (maneuver + unload + buffer).',
                label: 'On-site per truck',
                max: 480,
                min: 1,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'default_truck_spacing_minutes',
                default: 5,
                helper: 'Default cadence between consecutive truck dispatches when the order omits a rate.',
                label: 'Default truck spacing',
                max: 120,
                min: 1,
                step: 1,
                unit: 'minutes'
            }
        ],
        icon: 'fa-truck-moving',
        key: 'truck_cycle',
        title: 'Truck cycle times'
    },
    {
        description: 'Shift caps, warning bands, and travel ceilings the schedule honours.',
        fields: [
            {
                column: 'dot_shift_cap_hours',
                default: 14,
                helper: 'DOT driver-shift cap from first load-out to back-at-yard.',
                label: 'DOT shift cap',
                max: 24,
                min: 1,
                step: 1,
                unit: 'hours'
            },
            {
                column: 'overtime_warning_hours',
                default: 12,
                helper: 'Warning band before the DOT cap. Fatigue indicators light up here.',
                label: 'Overtime warning',
                max: 24,
                min: 0,
                step: 1,
                unit: 'hours'
            },
            {
                column: 'max_travel_minutes',
                default: 180,
                helper: 'Sanity ceiling on a single travel-time entry. Anything bigger is discarded as bad data.',
                label: 'Max travel time',
                max: 1440,
                min: 1,
                step: 1,
                unit: 'minutes'
            }
        ],
        icon: 'fa-shield-halved',
        key: 'dot',
        title: 'DOT compliance'
    },
    {
        description: 'Thresholds for late, slow, small, and big-pour classifications.',
        fields: [
            {
                column: 'late_threshold_minutes',
                default: 15,
                helper: 'Minutes past the scheduled start before the first load is flagged late.',
                label: 'Late threshold',
                max: 240,
                min: 0,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'slow_pace_min_ratio',
                default: 1.0,
                helper: 'Achieved-yd-per-hour ÷ requested. Pours below this ratio are flagged slow.',
                label: 'Slow-pace ratio',
                max: 2,
                min: 0,
                step: 0.01,
                unit: 'ratio'
            },
            {
                column: 'small_pour_max_trucks',
                default: 3,
                helper: 'Truck count at or below which the slow-pace check is skipped.',
                label: 'Small pour · max trucks',
                max: 50,
                min: 0,
                step: 1,
                unit: 'trucks'
            },
            {
                column: 'small_pour_max_yardage',
                default: 30,
                helper: 'Yardage at or below which the slow-pace check is skipped.',
                label: 'Small pour · max yardage',
                max: 500,
                min: 0,
                step: 1,
                unit: 'yards'
            },
            {
                column: 'big_pour_min_yardage',
                default: 120,
                helper: 'Yardage at or above which the big-pour rule starts evaluating.',
                label: 'Big pour · min yardage',
                max: 5000,
                min: 1,
                step: 1,
                unit: 'yards'
            },
            {
                column: 'big_pour_max_spacing_minutes',
                default: 10,
                helper: 'Truck spacing at or below which (combined with yardage) the big-pour rule fires.',
                label: 'Big pour · max spacing',
                max: 120,
                min: 1,
                step: 1,
                unit: 'minutes'
            },
            {
                column: 'big_pour_min_trucks',
                default: 12,
                helper: 'Truck floor enforced once the big-pour rule fires.',
                label: 'Big pour · min trucks',
                max: 100,
                min: 1,
                step: 1,
                unit: 'trucks'
            }
        ],
        icon: 'fa-gauge-high',
        key: 'service_quality',
        title: 'Service quality thresholds'
    }
]

/** Flat map of column → default value. Used by the form hook to seed the
 *  initial state when no DB row exists and by the diff builder to skip
 *  unchanged values. */
export const PLAN_SETTINGS_DEFAULTS = Object.freeze(
    PLAN_SETTINGS_FIELDS.flatMap((section) => section.fields).reduce((acc, field) => {
        acc[field.column] = field.default
        return acc
    }, {})
)

/** Flat map of column → field metadata (label / helper / range / unit).
 *  Convenient for error messages and per-field lookups outside the
 *  section iteration. */
export const PLAN_SETTINGS_FIELD_BY_COLUMN = Object.freeze(
    PLAN_SETTINGS_FIELDS.flatMap((section) => section.fields).reduce((acc, field) => {
        acc[field.column] = field
        return acc
    }, {})
)

/**
 * Inline cross-column validator. Mirrors every cross-column CHECK
 * constraint in the migration so the user sees the problem before
 * saving and the DB stops being the last line of defence. Returns a
 * map of column → error message; an empty object means the form is
 * valid. The function is null-safe — empty / non-finite values are
 * treated as "not set" and skipped.
 */
export function validatePlanSettings(values) {
    const numeric = (column) => {
        const raw = values?.[column]
        if (raw === '' || raw == null) return null
        const n = typeof raw === 'number' ? raw : parseFloat(raw)
        return Number.isFinite(n) ? n : null
    }
    const errors = {}
    const set = (column, message) => {
        if (!errors[column]) errors[column] = message
    }

    // Per-column range checks (mirror per-column CHECK constraints).
    for (const field of Object.values(PLAN_SETTINGS_FIELD_BY_COLUMN)) {
        const value = numeric(field.column)
        if (value == null) continue
        if (value < field.min || value > field.max) {
            set(field.column, `Must be between ${field.min} and ${field.max} ${field.unit}.`)
        }
    }

    const dotCap = numeric('dot_shift_cap_hours')
    const overtime = numeric('overtime_warning_hours')
    if (dotCap != null && overtime != null && overtime >= dotCap) {
        set('overtime_warning_hours', 'Overtime warning must fire before the DOT cap.')
    }
    const smallYard = numeric('small_pour_max_yardage')
    const bigYard = numeric('big_pour_min_yardage')
    if (smallYard != null && bigYard != null && smallYard >= bigYard) {
        set('big_pour_min_yardage', 'Big-pour yardage must exceed the small-pour ceiling.')
    }
    const smallTrucks = numeric('small_pour_max_trucks')
    const bigTrucks = numeric('big_pour_min_trucks')
    if (smallTrucks != null && bigTrucks != null && bigTrucks <= smallTrucks) {
        set('big_pour_min_trucks', 'Big-pour truck floor must exceed the small-pour ceiling.')
    }
    const onSite = numeric('on_site_minutes_per_truck')
    const preTrip = numeric('pre_trip_minutes')
    const load = numeric('plant_load_minutes')
    const slump = numeric('slump_test_minutes')
    if (dotCap != null && preTrip != null && load != null && slump != null && onSite != null) {
        const staticCycle = preTrip + load + slump + onSite
        if (staticCycle >= dotCap * 60) {
            set('on_site_minutes_per_truck', "Pre-trip + load + slump + on-site can't fit inside the DOT cap.")
        }
    }
    const late = numeric('late_threshold_minutes')
    if (dotCap != null && late != null && late > dotCap * 60) {
        set('late_threshold_minutes', "Late threshold can't exceed a full shift.")
    }
    const maxTravel = numeric('max_travel_minutes')
    if (dotCap != null && maxTravel != null && maxTravel >= dotCap * 60) {
        set('max_travel_minutes', "Max travel can't equal or exceed a full shift.")
    }
    const pullUpNotice = numeric('pull_up_customer_notice_minutes')
    if (dotCap != null && pullUpNotice != null && pullUpNotice > dotCap * 60) {
        set('pull_up_customer_notice_minutes', 'Pull-up notice must fit inside a shift.')
    }
    return errors
}
