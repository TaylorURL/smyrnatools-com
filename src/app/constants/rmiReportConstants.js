/* Ready Mix Instructor report constants — position vocabulary, icons,
 * and small helpers used by the granular components and the orchestrator
 * plugin. Shared design tokens live in weeklyReportConstants.js. */

export const POSITIONS = {
    MIXER: 'Mixer Operator',
    TRACTOR: 'Tractor Operator'
}

export const CATEGORY_ICONS = {
    [POSITIONS.MIXER]: 'fa-truck-loading',
    [POSITIONS.TRACTOR]: 'fa-tractor'
}

/** Resolves a plant code to a display name from the report's plants prop. */
export function getPlantNameFromList(plantCode, plants) {
    const plant = plants?.find((p) => (p.plant_code || p.code) === plantCode)
    return plant?.name || plantCode || '—'
}

/** Render a Pending-Start date — pulled either from the live operator feed
 *  (`2026-04-28T00:00:00+00:00`) or from a manually entered date input
 *  (`2026-04-28`). Both should display as a short readable date. */
export function formatPendingStartDate(value) {
    if (!value) return '—'
    const raw = String(value).trim()
    if (!raw) return '—'
    // Plain `YYYY-MM-DD` from <input type="date"> — parse as local to avoid UTC drift.
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (ymd) {
        const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        }
    }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return raw
    return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** End-of-report-week reference date for "days in training" math. Falls back
 *  to now if weekIso is missing so the column is still informative when used
 *  outside the standard weekly snapshot flow. */
export function getTrainingReferenceDate(weekIso) {
    if (!weekIso) return new Date()
    const monday = new Date(weekIso)
    if (Number.isNaN(monday.getTime())) return new Date()
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)
    return saturday
}

/** Whole days between a status-change timestamp and the report's reference
 *  date. Negative diffs (timestamp in the future) clamp to 0. */
export function computeDaysInTraining(trainingSince, referenceDate) {
    if (!trainingSince) return null
    const start = new Date(trainingSince)
    if (Number.isNaN(start.getTime())) return null
    const diffMs = referenceDate.getTime() - start.getTime()
    if (diffMs < 0) return 0
    return Math.floor(diffMs / 86400000)
}
