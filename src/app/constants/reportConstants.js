/** Predefined reasons why a plant may exclude operators from efficiency reports. */
export const OPERATOR_EXCLUSION_REASONS = {
    operators_sent_to_other_location: 'All operators sent to another location',
    plant_shutdown: 'Plant was shut down'
}

/**
 * Per-operator thresholds that drive the Plant Manager Weekly Efficiency
 * report's warning badges and the exported spreadsheet's red/bold cells.
 * Kept in one place so the on-screen review surface
 * (`WeeklyEfficiencyReport.jsx`) and the Excel export
 * (`EfficiencyExport.js`) never drift.
 *
 * - `LATE_START_LIMIT_MIN` — minutes between punch-in and first load. Over
 *   this, the row trips "LATE START".
 * - `LATE_OFF_LIMIT_MIN` — minutes between washout (EOD in yard) and punch
 *   out. Over this, the row trips "LATE OFF".
 * - `LOW_LOADS_THRESHOLD` — strictly fewer than this many loads trips
 *   "LOW LOADS" (only counts when the operator ran > 0 loads).
 * - `LONG_HOURS_THRESHOLD` — total hours strictly greater than this trips
 *   "LONG HOURS". The on-screen table also escalates to red past
 *   `LONG_HOURS_DANGER_THRESHOLD`.
 */
export const EFFICIENCY_THRESHOLDS = {
    LATE_OFF_LIMIT_MIN: 30,
    LATE_START_LIMIT_MIN: 25,
    LONG_HOURS_DANGER_THRESHOLD: 20,
    LONG_HOURS_THRESHOLD: 14,
    LOW_LOADS_THRESHOLD: 3
}
