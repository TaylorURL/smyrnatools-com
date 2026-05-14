import { useCallback, useState } from 'react'

import { ReportService } from '../../services/ReportService'

/**
 * Owns the "missing reports" list (assignments overdue beyond the current
 * week's grace period) and the loader that pulls them. The caller decides
 * when to call `loadMissingReports` (typically when the Review tab opens).
 */
export function useReportsMissing({ allowedReviewReportNames, isLoadingPermissions, previousTwoWeekIsos, user }) {
    const [missingReports, setMissingReports] = useState([])
    const [isLoadingMissing, setIsLoadingMissing] = useState(false)
    const [missingLoaded, setMissingLoaded] = useState(false)

    const loadMissingReports = useCallback(async () => {
        if (!user || isLoadingPermissions || missingLoaded) return
        if (allowedReviewReportNames.length === 0) {
            setMissingReports([])
            setMissingLoaded(true)
            return
        }
        setIsLoadingMissing(true)
        try {
            const overdue = await ReportService.fetchOverdueAssignments(new Date(), {
                allowedReview: allowedReviewReportNames
            })
            const weekSet = new Set(previousTwoWeekIsos)
            setMissingReports(
                (Array.isArray(overdue) ? overdue : []).filter((item) => item.week && weekSet.has(item.week))
            )
        } catch (err) {
            console.error('Failed to load missing reports:', err)
            setMissingReports([])
        }
        setIsLoadingMissing(false)
        setMissingLoaded(true)
    }, [user, isLoadingPermissions, missingLoaded, allowedReviewReportNames, previousTwoWeekIsos])

    return {
        isLoadingMissing,
        loadMissingReports,
        missingReports
    }
}
