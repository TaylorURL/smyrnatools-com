import { useCallback, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { UserService } from '../../services/UserService'
import APIUtility from '../../utils/APIUtility'
import { useConfirm } from '../context/ConfirmContext'

/**
 * Owns the QC strength / third-party lab report list and the loader for it.
 * The `currentUserWeight` and `userWeights` map are used to gate delete
 * actions — a reviewer can only delete a report submitted by someone with a
 * lower role weight.
 */
export function useReportsQc({ fetchProfilesFor, user }) {
    const confirm = useConfirm()
    const [qcReports, setQcReports] = useState([])
    const [isLoadingQC, setIsLoadingQC] = useState(false)
    const [qcLoaded, setQcLoaded] = useState(false)
    const [currentUserWeight, setCurrentUserWeight] = useState(0)
    const [userWeights, setUserWeights] = useState({})

    const loadQCReports = useCallback(async () => {
        if (!user || qcLoaded) return
        setIsLoadingQC(true)
        try {
            const { data, error } = await Database.from('reports')
                .select('id,report_name,user_id,submitted_at,data,completed,week,been_reviewed')
                .in('report_name', ['qc_strength', 'third_party_lab'])
                .eq('completed', true)
                .order('submitted_at', { ascending: false })
            if (!error && Array.isArray(data)) {
                const mapped = data.map((r) => ({
                    data: r.data,
                    id: r.id,
                    name: r.report_name,
                    reviewed: r.been_reviewed,
                    submittedAt: r.submitted_at,
                    userId: r.user_id,
                    week: r.week
                }))
                setQcReports(mapped)
                const uniqueUserIds = [...new Set(mapped.map((r) => r.userId).filter(Boolean))]
                if (uniqueUserIds.length > 0) fetchProfilesFor(uniqueUserIds)
            }
        } catch (err) {
            console.error('Failed to load QC reports:', err)
        }
        setIsLoadingQC(false)
        setQcLoaded(true)
        UserService.getUserWeight(user.id)
            .then(setCurrentUserWeight)
            .catch(() => {})
    }, [user, qcLoaded, fetchProfilesFor])

    const fetchWeightForUser = useCallback(
        async (userId) => {
            if (userWeights[userId] !== undefined) return userWeights[userId]
            const weight = await UserService.getUserWeight(userId).catch(() => 0)
            setUserWeights((prev) => ({ ...prev, [userId]: weight }))
            return weight
        },
        [userWeights]
    )

    const handleDeleteQCReport = useCallback(
        async (report) => {
            const submitterWeight = await fetchWeightForUser(report.userId)
            if (currentUserWeight < submitterWeight) return
            if (!(await confirm({ confirmLabel: 'Delete', title: 'Delete this QC Strength Report?' }))) return
            const { res } = await APIUtility.post('/report-service/delete-report', { reportId: report.id })
            if (!res.ok) return
            setQcReports((prev) => prev.filter((r) => r.id !== report.id))
        },
        [confirm, currentUserWeight, fetchWeightForUser]
    )

    return {
        handleDeleteQCReport,
        isLoadingQC,
        loadQCReports,
        qcLoaded,
        qcReports,
        setQcLoaded,
        setQcReports
    }
}
