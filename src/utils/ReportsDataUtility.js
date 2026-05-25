import { oneOffReportTypeMap, reportTypeMap } from '../app/types/ReportTypes'

/**
 * Normalizes a raw `reports` row from the database into the in-memory report
 * shape consumed by the Reports view. Handles title fallback across recurring
 * and one-off report type maps, and parses range/week dates safely.
 */
export function mapReportRow(row) {
    return {
        completed: !!row.completed,
        completedDate: row.submitted_at,
        data: row.data,
        id: row.id,
        name: row.report_name,
        report_date_range_end: row.report_date_range_end ? new Date(row.report_date_range_end) : null,
        report_date_range_start: row.report_date_range_start ? new Date(row.report_date_range_start) : null,
        title: (reportTypeMap[row.report_name] || oneOffReportTypeMap[row.report_name] || {}).title || row.report_name,
        userId: row.user_id,
        week: row.week || row.data?.week || null
    }
}

/** Normalizes a raw lost-load `reports` row into the in-memory shape. */
export function mapLostLoadRow(row) {
    return {
        data: row.data,
        id: row.id,
        submitted_at: row.submitted_at,
        userId: row.user_id,
        week: row.week
    }
}

/**
 * Builds a display name from a `users_profiles` row, falling back to a short
 * id slice when the profile is missing or has no name on file.
 */
export function getDisplayNameFromProfile(profile, userId) {
    if (profile && (profile.first_name || profile.last_name)) {
        return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    }
    return typeof userId === 'string' && userId.length > 0 ? userId.slice(0, 8) : ''
}
