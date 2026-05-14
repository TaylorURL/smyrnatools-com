/**
 * Weekly report computation helpers: YPH/yardage metric grading, week date calculations,
 * Monday-anchored ISO normalization, cross-plant hours adjustment, report status resolution,
 * operator exclusion detection, and AI-assisted plant production validation.
 */
const ReportUtility = {
    /**
     * Returns the Central Time UTC offset (in minutes) that applies for `date`.
     * Uses US DST rules (2nd Sun of March → 1st Sun of November), avoiding any
     * IANA-database dependency. CDT = -300, CST = -360.
     */
    _centralOffsetMinutes(date) {
        const year = date.getUTCFullYear()
        const march1 = new Date(Date.UTC(year, 2, 1))
        const dstStart = new Date(Date.UTC(year, 2, 1 + ((7 - march1.getUTCDay()) % 7) + 7, 8))
        const nov1 = new Date(Date.UTC(year, 10, 1))
        const dstEnd = new Date(Date.UTC(year, 10, 1 + ((7 - nov1.getUTCDay()) % 7), 7))
        return date >= dstStart && date < dstEnd ? -300 : -360
    },

    buildHoursReceivedByWeek(allReports, targetPlantCode) {
        const hoursReceivedByWeek = {}
        const plantCodeStr = String(targetPlantCode || '')
        if (!allReports || !Array.isArray(allReports) || !plantCodeStr) {
            return hoursReceivedByWeek
        }
        allReports.forEach((report) => {
            const weekStr = this.normalizeWeekStr(report.week)
            const helpEntries = report.data?.operators_sent_to_help || []
            if (Array.isArray(helpEntries)) {
                helpEntries.forEach((entry) => {
                    const destPlant = String(entry.destination_plant || '')
                    if (destPlant === plantCodeStr && entry.operators && Array.isArray(entry.operators)) {
                        if (!hoursReceivedByWeek[weekStr]) {
                            hoursReceivedByWeek[weekStr] = 0
                        }
                        entry.operators.forEach((op) => {
                            hoursReceivedByWeek[weekStr] += parseFloat(op.hours) || 0
                        })
                    }
                })
            }
        })
        return hoursReceivedByWeek
    },

    calculateAdjustedYph(reportData, hoursReceived = 0) {
        const yards = parseFloat(
            reportData?.total_yards_delivered || reportData?.yardage || reportData?.['Yardage'] || 0
        )
        const hours = parseFloat(
            reportData?.total_operator_hours || reportData?.total_hours || reportData?.['Total Hours'] || 0
        )
        if (hours <= 0 || yards <= 0) {
            return { adjustedYph: 0, hoursReceived: 0, hoursSent: 0, rawYph: 0 }
        }
        const rawYph = yards / hours
        const hoursSent = this.calculateHoursSent(reportData)
        const adjustedHours = hours - hoursSent + hoursReceived
        const adjustedYph = adjustedHours > 0 ? yards / adjustedHours : rawYph
        return { adjustedYph, hoursReceived, hoursSent, rawYph }
    },

    calculateHoursReceivedForWeek(allReports, targetWeekStr, targetPlantCode) {
        const normalizedTargetWeek = this.normalizeWeekStr(targetWeekStr)
        const hoursReceivedByWeek = this.buildHoursReceivedByWeek(allReports, targetPlantCode)
        return hoursReceivedByWeek[normalizedTargetWeek] || 0
    },

    calculateHoursSent(reportData) {
        let totalHoursSent = 0
        const operatorsSentToHelp = reportData?.operators_sent_to_help || []
        if (Array.isArray(operatorsSentToHelp)) {
            operatorsSentToHelp.forEach((entry) => {
                if (entry.operators && Array.isArray(entry.operators)) {
                    entry.operators.forEach((op) => {
                        totalHoursSent += parseFloat(op.hours) || 0
                    })
                }
            })
        }
        return totalHoursSent
    },

    computeMyReportStatus({ completed, hasSavedData, weekIso, today }) {
        const now = today instanceof Date ? today : new Date()
        const cutoff = this.getLateCutoff(weekIso)
        let statusText = ''
        let statusClass = ''
        let buttonLabel = ''
        if (completed) {
            statusText = 'Submitted'
            statusClass = 'success'
            buttonLabel = 'View'
        } else if (hasSavedData) {
            statusText = 'Draft'
            statusClass = 'warning'
            buttonLabel = 'Edit'
        } else if (cutoff && cutoff >= now) {
            statusText = 'Active'
            statusClass = 'info'
            buttonLabel = 'Submit'
        } else {
            statusText = 'Overdue'
            statusClass = 'error'
            buttonLabel = 'Submit'
        }
        return { buttonLabel, statusClass, statusText }
    },

    /**
     * Minute delta between two `parseTimeToMinutes` values, wrapping past
     * midnight. Returns `null` if either input is non-finite. End-before-
     * start is interpreted as an overnight shift — e.g. start 23:00 →
     * punch 11:00 resolves to 720 minutes (12 h), not −720. If a user
     * genuinely typoed the times the wrapped value lands in the >14h
     * range and the existing "excessive hours" rule flags it.
     */
    diffMinutesWrapping(startMin, endMin) {
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null
        const delta = endMin - startMin
        return delta >= 0 ? delta : delta + 1440
    },

    formatDate(dateInput, locale) {
        if (!dateInput) return ''
        const d = new Date(dateInput)
        if (isNaN(d.getTime())) return ''
        return d.toLocaleDateString(locale)
    },

    formatDateMMDDYY(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return ''
        const mm = date.getMonth() + 1
        const dd = date.getDate()
        const yy = date.getFullYear().toString().slice(-2)
        return `${mm}-${dd}-${yy}`
    },

    formatDateTime(dt, locale) {
        if (!dt) return ''
        const date = new Date(dt)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleString(locale)
    },

    formatVerboseDate(dateInput, locale) {
        if (!dateInput) return ''
        let d
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [y, m, da] = dateInput.split('-').map(Number)
            d = new Date(y, m - 1, da)
        } else {
            d = new Date(dateInput)
        }
        if (isNaN(d.getTime())) return ''
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' })
    },

    getExcludedOperators(rows, operatorOptions) {
        const r = Array.isArray(rows) ? rows : []
        const opts = Array.isArray(operatorOptions) ? operatorOptions : []
        return opts.filter((opt) => !r.some((row) => row.name === opt.value)).map((opt) => opt.value)
    },

    getFullYphMetrics(reportData, hoursReceived = 0) {
        const { rawYph, adjustedYph, hoursSent } = this.calculateAdjustedYph(reportData, hoursReceived)
        const rawGradeInfo = this.getYphGradeAndLabel(rawYph)
        const adjustedGradeInfo = this.getYphGradeAndLabel(adjustedYph)
        return {
            adjusted: adjustedYph,
            adjustedGrade: adjustedGradeInfo.grade,
            adjustedLabel: adjustedGradeInfo.label,
            hoursReceived,
            hoursSent,
            raw: rawYph,
            rawGrade: rawGradeInfo.grade,
            rawLabel: rawGradeInfo.label
        }
    },

    getLastNWeekIsos(n, fromDate) {
        const weeks = []
        const base = fromDate instanceof Date ? fromDate : new Date()
        const currentMonday = this.mondayOf(base)
        if (!currentMonday) return weeks
        const ptr = new Date(currentMonday)
        for (let i = 0; i < n; i++) {
            weeks.push(ptr.toISOString().slice(0, 10))
            ptr.setDate(ptr.getDate() - 7)
        }
        return weeks
    },

    /**
     * Reports for a given week are due by 7:00 AM Central on the FOLLOWING Monday.
     * Returns the cutoff as a UTC Date so callers can compare with `Date.now()`.
     * `null` if `weekIso` doesn't resolve to a Monday.
     *
     * Why: business policy — late status begins at Mon 07:00 CST, not Saturday EOD.
     * How to apply: use this anywhere the app decides "is this overdue?" or renders
     * a deadline countdown / cutoff label.
     */
    getLateCutoff(weekIso) {
        const { monday } = this.getWeekDatesFromIso(weekIso)
        if (!monday) return null
        const nextMonday = new Date(monday)
        nextMonday.setDate(monday.getDate() + 7)
        const y = nextMonday.getFullYear()
        const m = nextMonday.getMonth()
        const d = nextMonday.getDate()
        // Probe a midday UTC moment to determine whether Central is on DST that day,
        // then assemble the cutoff at 07:00 wall-clock Central.
        const probeUtc = new Date(Date.UTC(y, m, d, 12, 0, 0))
        const offsetMinutes = ReportUtility._centralOffsetMinutes(probeUtc)
        return new Date(Date.UTC(y, m, d, 7 - offsetMinutes / 60, 0, 0))
    },

    /** Display label for the weekly cutoff — surfaced in the UI alongside countdowns. */
    getLateCutoffLabel() {
        return 'Mon · 7:00 AM CST'
    },
    getMondayISO(dateInput) {
        const monday = this.mondayOf(dateInput || new Date())
        return monday ? monday.toISOString().slice(0, 10) : ''
    },

    /** Walks every row's basic numeric / time fields and returns either an
     *  error string for the first row that fails, or a structured plan of
     *  AI-validation work for rows that have flagged issues + a comment.
     *  Pure synchronous validation lives here so the async AI loop below
     *  can skip rows that already failed cheap checks. */
    _planPlantProductionRows(form, operatorOptions) {
        const rows = Array.isArray(form.rows) ? form.rows : []
        const aiPlan = []
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i]
            const label = Array.isArray(operatorOptions)
                ? operatorOptions.find((o) => o.value === r.name)?.label || `Operator ${i + 1}`
                : `Operator ${i + 1}`
            const start = this.parseTimeToMinutes(r.start_time)
            const first = this.parseTimeToMinutes(r.first_load)
            const eod = this.parseTimeToMinutes(r.eod_in_yard)
            const punch = this.parseTimeToMinutes(r.punch_out)
            if (!r.start_time || start === null)
                return { error: `${label}: Start Time is required and must be a valid time.` }
            if (!r.first_load || first === null)
                return { error: `${label}: 1st Load time is required and must be a valid time.` }
            if (!r.eod_in_yard || eod === null)
                return { error: `${label}: EOD In Yard time is required and must be a valid time.` }
            if (!r.punch_out || punch === null)
                return { error: `${label}: Punch Out time is required and must be a valid time.` }
            // Wrap past midnight so overnight shifts (e.g. start 23:00 →
            // punch 11:00) read as the real elapsed duration. A typoed
            // pair just lands in the >14h "excessive hours" tier below.
            const dStart = this.diffMinutesWrapping(start, first)
            const dEnd = this.diffMinutesWrapping(eod, punch)
            const totalMinutes = this.diffMinutesWrapping(start, punch)
            if (totalMinutes != null && totalMinutes <= 0)
                return { error: `${label}: Total hours must be greater than 0.` }
            const loadsVal = r.loads
            if (loadsVal === undefined || loadsVal === null || String(loadsVal) === '')
                return { error: `${label}: Total Loads is required.` }
            const loadsNum = Number(loadsVal)
            if (!Number.isFinite(loadsNum) || loadsNum < 0 || !Number.isInteger(loadsNum))
                return { error: `${label}: Total Loads must be a non-negative whole number.` }
            const hours = totalMinutes != null ? totalMinutes / 60 : null
            const startDelayed = dStart !== null && dStart > 15
            const endDelayed = dEnd !== null && dEnd > 20
            const lowLoads = loadsNum < 3
            const excessiveHours = hours !== null && hours > 14
            const hasIssues = startDelayed || endDelayed || lowLoads || excessiveHours
            if (hasIssues && (!r.comments || String(r.comments).trim() === '')) {
                return {
                    error: `${label}: Comments are required when there are performance issues (e.g., delayed start/load, low loads, or excessive hours).`
                }
            }
            if (hasIssues && r.comments && String(r.comments).trim()) {
                aiPlan.push({
                    comments: r.comments,
                    dEnd,
                    dStart,
                    endDelayed,
                    excessiveHours,
                    hours,
                    label,
                    loadsNum,
                    lowLoads,
                    startDelayed
                })
            }
        }
        return { aiPlan }
    },

    getTodayISODate() {
        return new Date().toISOString().slice(0, 10)
    },

    getTotalWeeksSince(startDate, todayDate) {
        const today = todayDate instanceof Date ? todayDate : new Date()
        const currentMonday = this.mondayOf(today)
        const startMonday = this.mondayOf(startDate)
        if (!currentMonday || !startMonday) return 0
        const diffMs = currentMonday.getTime() - startMonday.getTime()
        const weeks = Math.floor(diffMs / 604800000) + 1
        return Math.max(weeks, 0)
    },

    getTruckNumberForOperator(row, mixers) {
        if (row && row.truck_number) return row.truck_number
        if (!row || !row.name) return ''
        const mixer = (mixers || []).find((m) => m.assigned_operator === row.name)
        if (mixer && mixer.truck_number) return mixer.truck_number
        return ''
    },

    getWeekBadge(weekIso, today = new Date()) {
        const currentMonday = this.mondayOf(today)
        if (!currentMonday) return ''
        const weekMonday = new Date(weekIso)
        if (isNaN(weekMonday.getTime())) return ''
        const diffWeeks = Math.floor((currentMonday - weekMonday) / (7 * 24 * 60 * 60 * 1000))
        if (diffWeeks === 0) return 'This Week'
        if (diffWeeks === 1) return 'Last Week'
        if (diffWeeks > 1) return 'Older'
        return ''
    },

    getWeekDatesFromIso(weekIso) {
        if (!weekIso) return { monday: null, saturday: null }
        const monday = new Date(weekIso)
        if (isNaN(monday.getTime())) return { monday: null, saturday: null }
        monday.setDate(monday.getDate() + 1)
        monday.setHours(0, 0, 0, 0)
        const saturday = new Date(monday)
        saturday.setDate(monday.getDate() + 5)
        saturday.setHours(0, 0, 0, 0)
        return { monday, saturday }
    },

    getWeekVerbose(weekIso, locale) {
        if (!weekIso) return ''
        const { monday, saturday } = this.getWeekDatesFromIso(weekIso)
        if (!monday || !saturday) return ''
        const left = monday.toLocaleDateString(locale, { day: 'numeric', month: 'short', weekday: 'short' })
        const right = saturday.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            weekday: 'short',
            year: 'numeric'
        })
        return `${left}  \u2013 ${right}`
    },

    getYphGradeAndLabel(yph) {
        let grade = 'poor'
        let label = 'Poor'
        if (yph >= 6) {
            grade = 'excellent'
            label = 'Excellent'
        } else if (yph >= 4) {
            grade = 'good'
            label = 'Good'
        } else if (yph >= 3) {
            grade = 'average'
            label = 'Average'
        }
        return { grade, label }
    },

    mondayOf(dateInput) {
        const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput)
        if (isNaN(d.getTime())) return null
        const day = d.getDay()
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((day + 6) % 7))
        monday.setHours(0, 0, 0, 0)
        return monday
    },

    normalizeWeekStr(weekStr) {
        if (!weekStr) return ''
        const datePart = weekStr.split('T')[0]
        const [y, m, d] = datePart.split('-').map(Number)
        if (!y || !m || !d) return datePart
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    },

    parseTimeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null
        const parts = timeStr.split(':').map(Number)
        if (parts.length < 2) return null
        const [h, m] = parts
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null
        return h * 60 + m
    },
    /** Validates a Plant Efficiency (plant_production) report. Returns an empty
     *  string when everything is valid, or a human-readable error string for
     *  the first failure. The optional `onProgress` callback fires after each
     *  AI-validated row so the caller can show a progress bar. */
    async validatePlantProduction(form, operatorOptions, options = {}) {
        const { onProgress } = options
        if (!form || typeof form !== 'object') return 'Invalid form'
        if (!form.plant) return 'Please select a plant before submitting.'
        if (!form.report_date) return 'Please select a report date before submitting.'
        const planResult = this._planPlantProductionRows(form, operatorOptions)
        if (planResult.error) return planResult.error
        const aiPlan = planResult.aiPlan
        const total = aiPlan.length
        // Surface the denominator before the first AI call lands so the modal
        // can render its progress bar immediately.
        if (typeof onProgress === 'function') onProgress({ current: 0, total })
        if (total === 0) return ''
        const { AIService } = await import('../services/AIService')
        for (let i = 0; i < aiPlan.length; i++) {
            const row = aiPlan[i]
            const validation = await AIService.validateEfficiencyComment(row.comments, {
                endDelayed: row.endDelayed,
                endMinutes: row.dEnd,
                excessiveHours: row.excessiveHours,
                hours: row.hours,
                loads: row.loadsNum,
                lowLoads: row.lowLoads,
                startDelayed: row.startDelayed,
                startMinutes: row.dStart
            })
            if (typeof onProgress === 'function') onProgress({ current: i + 1, total })
            if (validation.error) {
                return `${row.label}: Unable to validate comment. Please ensure your explanation is detailed and specific.`
            }
            if (!validation.valid) {
                const guidance = validation.guidance || 'Provide a specific reason for the timing issues.'
                const issuesList = []
                if (row.startDelayed) issuesList.push(`Punch-in to 1st load: ${row.dStart} min (max 15)`)
                if (row.endDelayed) issuesList.push(`Washout to punch-out: ${row.dEnd} min (max 20)`)
                if (row.lowLoads) issuesList.push(`Loads: ${row.loadsNum} (min 3)`)
                if (row.excessiveHours) issuesList.push(`Hours: ${row.hours.toFixed(1)} (max 14)`)
                return `${row.label}: Comment needs improvement.\n\n${guidance}\n\nYour comment: ${row.comments}\n\nIssues: ${issuesList.join(' | ')}`
            }
        }
        return ''
    }
}
export default ReportUtility
export { ReportUtility }
