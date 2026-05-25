/** YPH target — yards-per-hour below this counts as "not doing well"
 *  per the dispatcher's threshold. Mirrors `TARGET_YPH` from
 *  `planConstants.js` so the schedule grid and the plant scorecard read
 *  off the same number. */
export const YPH_TARGET = 3

export const SCHEDULE_SORT_IDS = ['operator', 'hours', 'varianceDesc']

/** Mon–Sat working-week labels for the column header. Sunday is excluded
 *  everywhere — plants don't run that day. */
export const WEEKDAYS = [
    { full: 'Monday', label: 'Mon', offset: 0 },
    { full: 'Tuesday', label: 'Tue', offset: 1 },
    { full: 'Wednesday', label: 'Wed', offset: 2 },
    { full: 'Thursday', label: 'Thu', offset: 3 },
    { full: 'Friday', label: 'Fri', offset: 4 },
    { full: 'Saturday', label: 'Sat', offset: 5 }
]

/** Threshold beyond which a shift counts as "long" and triggers the
 *  same red treatment as a late punch. Mirrors the LONG HOURS efficiency
 *  threshold from `reportConstants.js`. */
export const LONG_SHIFT_HOURS = 14
