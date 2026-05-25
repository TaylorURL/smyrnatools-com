import { useCallback, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { ReportService } from '../../services/ReportService'
import { mapLostLoadRow } from '../../utils/ReportsDataUtility'

/**
 * Owns the lost-load report list and its lazy loader. Lost loads load on
 * demand (first time the tab is opened) and stay cached for the session.
 * `addLostLoadReport` lets the submit flow optimistically append a new row
 * without a full refetch.
 */
export function useReportsLostLoads({ fetchProfilesFor, isLoadingPermissions, user }) {
    const [lostLoadReports, setLostLoadReports] = useState([])
    const [isLoadingLostLoads, setIsLoadingLostLoads] = useState(false)
    const [lostLoadsLoaded, setLostLoadsLoaded] = useState(false)

    const loadLostLoadReports = useCallback(async () => {
        if (!user || isLoadingPermissions || lostLoadsLoaded) return
        setIsLoadingLostLoads(true)
        try {
            const { data, error } = await Database.from('reports')
                .select('id,user_id,submitted_at,data,week')
                .eq('report_name', 'lost_load')
                .eq('completed', true)
                .order('submitted_at', { ascending: false })
            if (!error && Array.isArray(data)) {
                setLostLoadReports(data.map(mapLostLoadRow))
                const ids = Array.from(new Set(data.map((r) => r.user_id).filter(Boolean)))
                await fetchProfilesFor(ids)
            }
        } catch (err) {
            console.error('Failed to load lost load reports:', err)
        }
        setIsLoadingLostLoads(false)
        setLostLoadsLoaded(true)
    }, [user, isLoadingPermissions, lostLoadsLoaded, fetchProfilesFor])

    const addLostLoadReport = useCallback((report) => {
        if (!report) return
        setLostLoadReports((prev) => [mapLostLoadRow(report), ...prev])
    }, [])

    const deleteLostLoadReport = useCallback(async (reportId) => {
        await ReportService.deleteReport(reportId)
        setLostLoadReports((prev) => prev.filter((r) => r.id !== reportId))
    }, [])

    return {
        addLostLoadReport,
        deleteLostLoadReport,
        isLoadingLostLoads,
        loadLostLoadReports,
        lostLoadReports
    }
}
