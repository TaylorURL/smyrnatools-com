import { ReportUtility } from './ReportUtility'

/** Maps a performance grade key to its display label. */
const GRADE_LABELS = { average: 'Average', excellent: 'Excellent', good: 'Good', poor: 'Poor' }

/** Maps a yardage performance grade to its Tailwind text color class. */
const YPH_GRADE_COLORS = {
    average: 'text-yellow-500',
    excellent: 'text-emerald-500',
    good: 'text-green-500',
    poor: 'text-red-500'
}

/** Formats a week ISO into a human-readable "MM-DD-YY through MM-DD-YY" range. */
export function getWeekRangeFromIso(weekIso) {
    const { monday, saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
    if (!monday || !saturday) return ''
    return `${ReportUtility.formatDateMMDDYY(monday)} through ${ReportUtility.formatDateMMDDYY(saturday)}`
}

/** Calculates the Monday and Saturday bounding a given date. */
export function getMondayAndSaturday(date = new Date()) {
    const monday = ReportUtility.mondayOf(date)
    if (!monday) return { monday: null, saturday: null }
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(0, 0, 0, 0)
    return { monday, saturday }
}

/** Returns the ISO date string (YYYY-MM-DD) for the Monday of a given date's week. */
export function getMondayISO(date) {
    return ReportUtility.getMondayISO(date)
}

/** Formats two Date objects into a "MM-DD-YY through MM-DD-YY" range string. */
export function getWeekRangeString(monday, saturday) {
    return `${ReportUtility.formatDateMMDDYY(monday)} through ${ReportUtility.formatDateMMDDYY(saturday)}`
}

/** Extracts the plant code from a report's data structure. */
export function getPlantNameFromReport(report) {
    if (report.data?.plant) return report.data.plant
    if (report.data?.rows?.[0]?.plant_code) return report.data.rows[0].plant_code
    return ''
}

export function getPlantNameFromWeekItem(item) {
    if (item.report?.data?.plant) return item.report.data.plant
    if (item.report?.data?.rows?.[0]?.plant_code) return item.report.data.rows[0].plant_code
    return ''
}

/** Parses a "HH:MM" time string into total minutes. */
export function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
}

/** Resolves an operator's display name from row data and operator options. */
export function getOperatorName(row, operatorOptions) {
    if (!row?.name) return ''
    if (Array.isArray(operatorOptions)) {
        const found = operatorOptions.find((opt) => opt.value === row.name)
        if (found) return found.label
    }
    if (row.displayName) return row.displayName
    return row.name
}

/**
 * Computes yardage efficiency metrics (yards per hour, lost yardage)
 * with performance grades from form data using multiple possible field name formats.
 */
export function getYardageMetrics(form) {
    let yards = parseFloat(form.total_yards_delivered || form['Yardage'] || form['yardage'])
    let hours = parseFloat(
        form.total_operator_hours || form['Total Hours'] || form['total_hours'] || form['total_operator_hours']
    )
    let yph = !isNaN(yards) && !isNaN(hours) && hours > 0 ? yards / hours : null
    let yphGrade = ''
    if (yph !== null) {
        if (yph >= 6) yphGrade = 'excellent'
        else if (yph >= 4) yphGrade = 'good'
        else if (yph >= 3) yphGrade = 'average'
        else yphGrade = 'poor'
    }
    const yphLabel = GRADE_LABELS[yphGrade] || ''
    let lost = null
    if (
        typeof form.total_yards_lost !== 'undefined' &&
        form.total_yards_lost !== '' &&
        !isNaN(Number(form.total_yards_lost))
    )
        lost = Number(form.total_yards_lost)
    else if (typeof form.yardage_lost !== 'undefined' && form.yardage_lost !== '' && !isNaN(Number(form.yardage_lost)))
        lost = Number(form.yardage_lost)
    else if (typeof form.lost_yardage !== 'undefined' && form.lost_yardage !== '' && !isNaN(Number(form.lost_yardage)))
        lost = Number(form.lost_yardage)
    else if (
        typeof form['Yardage Lost'] !== 'undefined' &&
        form['Yardage Lost'] !== '' &&
        !isNaN(Number(form['Yardage Lost']))
    )
        lost = Number(form['Yardage Lost'])
    else if (
        typeof form['yardage_lost'] !== 'undefined' &&
        form['yardage_lost'] !== '' &&
        !isNaN(Number(form['yardage_lost']))
    )
        lost = Number(form['yardage_lost'])
    if (lost !== null && lost < 0) lost = 0
    let lostGrade = ''
    if (lost !== null) {
        if (lost === 0) lostGrade = 'excellent'
        else if (lost < 5) lostGrade = 'good'
        else if (lost < 10) lostGrade = 'average'
        else lostGrade = 'poor'
    }
    const lostLabel = GRADE_LABELS[lostGrade] || ''
    return { lost, lostGrade, lostLabel, yph, yphGrade, yphLabel }
}

/** Maps a yardage performance grade to its Tailwind text color class. */
export function getYphColor(grade) {
    return YPH_GRADE_COLORS[grade] ?? ''
}

/**
 * Analyzes per-row production data for a plant, computing totals, averages,
 * and flagging efficiency warnings (late starts, long hours, low loads).
 */
export function getPlantProductionInsights(rows) {
    const parseTime = (timeStr) => parseTimeToMinutes(timeStr)
    function isExcludedRow(row) {
        if (!row) return true
        const keys = Object.keys(row).filter((k) => k !== 'name' && k !== 'truck_number')
        return keys.every((k) => row[k] === '' || row[k] === undefined || row[k] === null || row[k] === 0)
    }
    let totalLoads = 0
    let totalHours = 0
    let totalElapsedStart = 0
    let totalElapsedEnd = 0
    let countElapsedStart = 0
    let countElapsedEnd = 0
    let warnings = []
    let loadsPerHourSum = 0
    let loadsPerHourCount = 0
    const includedRows = rows.filter((row) => !isExcludedRow(row))
    includedRows.forEach((row) => {
        const start = parseTime(row.start_time)
        const firstLoad = parseTime(row.first_load)
        const punchOut = parseTime(row.punch_out)
        const eod = parseTime(row.eod_in_yard)
        const loads = Number(row.loads)
        let hours = null
        // Wrap past midnight so overnight shifts read as real elapsed
        // time rather than a 12-hour negative.
        const totalMinutes = ReportUtility.diffMinutesWrapping(start, punchOut)
        if (totalMinutes !== null) {
            hours = totalMinutes / 60
            if (hours > 0) totalHours += hours
        }
        if (!isNaN(loads)) totalLoads += loads
        const elapsedStart = ReportUtility.diffMinutesWrapping(start, firstLoad)
        if (elapsedStart !== null) {
            totalElapsedStart += elapsedStart
            countElapsedStart++
            if (elapsedStart > 15)
                warnings.push({
                    message: `Start to 1st Load is ${elapsedStart} min (> 15 min)`,
                    row: rows.indexOf(row)
                })
        }
        const elapsedEnd = ReportUtility.diffMinutesWrapping(eod, punchOut)
        if (elapsedEnd !== null) {
            totalElapsedEnd += elapsedEnd
            countElapsedEnd++
            if (elapsedEnd > 20)
                warnings.push({
                    message: `EOD to Punch Out is ${elapsedEnd} min (> 20 min)`,
                    row: rows.indexOf(row)
                })
        }
        if (!isNaN(loads) && hours && hours > 0) {
            loadsPerHourSum += loads / hours
            loadsPerHourCount++
        }
        if (!isNaN(loads) && loads < 3)
            warnings.push({
                message: `Total Loads is ${loads} (< 3)`,
                row: rows.indexOf(row)
            })
        if (hours !== null && hours > 14)
            warnings.push({
                message: `Total Hours is ${hours.toFixed(2)} (> 14 hours)`,
                row: rows.indexOf(row)
            })
    })
    const avgElapsedStart = countElapsedStart ? totalElapsedStart / countElapsedStart : null
    const avgElapsedEnd = countElapsedEnd ? totalElapsedEnd / countElapsedEnd : null
    const avgLoads = includedRows.length ? totalLoads / includedRows.length : null
    const avgHours = includedRows.length ? totalHours / includedRows.length : null
    const avgLoadsPerHour = loadsPerHourCount ? loadsPerHourSum / loadsPerHourCount : null
    let avgWarnings = []
    if (avgElapsedStart !== null && avgElapsedStart < 0)
        avgWarnings.push(
            'Reported Start and 1st Load times produce a negative elapsed duration (likely an AM/PM entry error). Please review and correct the time entries.'
        )
    if (avgElapsedEnd !== null && avgElapsedEnd < 0)
        avgWarnings.push(
            'Reported Washout -> Punch Out times produce a negative elapsed duration (likely an AM/PM entry error). Please review and correct the time entries.'
        )
    if (avgElapsedStart !== null && avgElapsedStart > 15)
        avgWarnings.push(`Avg Punch In to 1st Load is ${avgElapsedStart.toFixed(1)} min (> 15 min)`)
    if (avgElapsedEnd !== null && avgElapsedEnd > 20)
        avgWarnings.push(`Washout to Punch Out is ${avgElapsedEnd.toFixed(1)} min (> 20 min)`)
    if (avgLoads !== null && avgLoads < 3) avgWarnings.push(`Avg Total Loads is ${avgLoads.toFixed(2)} (< 3)`)
    if (avgHours !== null && avgHours > 14) avgWarnings.push(`Avg Total Hours is ${avgHours.toFixed(2)} (> 14 hours)`)
    return {
        avgElapsedEnd,
        avgElapsedStart,
        avgHours,
        avgLoads,
        avgLoadsPerHour,
        avgWarnings,
        totalHours,
        totalLoads,
        warnings
    }
}
