import { useCallback } from 'react'

import { ReportService } from '../../services/ReportService'
import { reportTypes } from '../types/ReportTypes'

/**
 * Form/review/edit/track handlers for the Reports hub. All return values
 * are stable across renders where possible — the orchestrator passes these
 * down to the tab panels.
 */
export function useReportsHandlers({
    fetchReportForEdit,
    markReportReviewed,
    overdueSourceItems,
    selectedWeekIso,
    setEditingLabReport,
    setEditingLostLoad,
    setEditingQcReport,
    setManagerEditUser,
    setReviewData,
    setShowForm,
    setShowReview,
    setSubmitInitialData,
    submitManagerEdit,
    submitReport,
    user,
    getUserName,
    managerEditUser,
    showForm
}) {
    const handleSubmitReport = async (formData, completed = true) => {
        const result = await submitReport({ completed, formData, showForm })
        if (result.success) setShowForm(null)
    }
    const handleManagerEditSubmit = async (formData) => {
        const result = await submitManagerEdit({ formData, managerEditUser, showForm })
        if (result.success) {
            setShowForm(null)
            setManagerEditUser(null)
        }
    }
    const handleReview = async (report) => {
        if (report.userId !== user?.id) {
            const success = await ReportService.markReviewed(report.id, user.id)
            if (success) markReportReviewed(report.id)
        }
        setReviewData(report)
        setShowReview(reportTypes.find((rt) => rt.name === report.name))
    }
    const handleManagerEdit = (reportType, reportData) => {
        setShowReview(null)
        setReviewData(null)
        setShowForm({ ...reportType, name: reportType.name, weekIso: reportData.week || reportData.data?.week })
        setSubmitInitialData({ ...reportData, data: reportData.data })
        setManagerEditUser(reportData.userId)
    }
    const handleShowForm = useCallback(
        async (item) => {
            setSubmitInitialData(null)
            if (user && item?.name && item.weekIso) {
                const existingData = await fetchReportForEdit({ item, userId: user.id })
                if (existingData) setSubmitInitialData(existingData)
            }
            setShowForm(item)
        },
        [fetchReportForEdit, user, setShowForm, setSubmitInitialData]
    )
    const handleBack = () => {
        setShowForm(null)
        setManagerEditUser(null)
    }
    const handleReviewBack = () => {
        setShowReview(null)
        setReviewData(null)
    }
    const handleFormSubmit = (form, submitType) =>
        managerEditUser ? handleManagerEditSubmit(form) : handleSubmitReport(form, submitType === 'submit')
    const handleTrackAction = useCallback(
        (item) => handleShowForm({ ...item, weekIso: item.weekIso || selectedWeekIso }),
        [handleShowForm, selectedWeekIso]
    )
    const handleSubmitOldestOverdue = useCallback(() => {
        const oldest = overdueSourceItems[0]
        if (oldest) handleShowForm({ ...oldest, weekIso: oldest.weekIso })
    }, [handleShowForm, overdueSourceItems])
    const handleNudge = useCallback(
        (item) => {
            const name = item?.submitter || (item?.user_id ? getUserName?.(item.user_id) : 'the submitter')
            // Nudge is currently a client-side acknowledgement until a notification hook is wired.
            window.alert(`Nudged ${name} about: ${item?.reportTitle || item?.title || item?.report_name}`)
        },
        [getUserName]
    )
    const handleEditMyOneOff = useCallback(
        (report) => {
            if (!report) return
            if (report.name === 'qc_strength') setEditingQcReport(report)
            else if (report.name === 'third_party_lab') setEditingLabReport(report)
            else if (report.name === 'lost_load') setEditingLostLoad(report)
        },
        [setEditingQcReport, setEditingLabReport, setEditingLostLoad]
    )

    return {
        handleBack,
        handleEditMyOneOff,
        handleFormSubmit,
        handleManagerEdit,
        handleNudge,
        handleReview,
        handleReviewBack,
        handleShowForm,
        handleSubmitOldestOverdue,
        handleTrackAction
    }
}
