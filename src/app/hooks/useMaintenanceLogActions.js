import { useCallback, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { MaintenanceService } from '../../services/MaintenanceService'

/**
 * Modal targets and form-rail action handlers for the maintenance log view.
 * @param {{ onFormDataReload: Function }} params
 */
export function useMaintenanceLogActions({ onFormDataReload }) {
    const [serviceTarget, setServiceTarget] = useState(null)
    const [detailTarget, setDetailTarget] = useState(null)
    const [editTarget, setEditTarget] = useState(null)
    const [selectedFormItem, setSelectedFormItem] = useState(null)

    const handleFormSubmitted = useCallback(() => {
        setSelectedFormItem(null)
        onFormDataReload?.()
    }, [onFormDataReload])

    const handleDeleteSubmission = useCallback(
        async (event, submissionId) => {
            event?.stopPropagation()
            if (!window.confirm('Delete this submission?')) return
            try {
                await Database.from('maintenance_submission_responses').delete().eq('submission_id', submissionId)
                await Database.from('maintenance_submissions').delete().eq('id', submissionId)
                if (selectedFormItem?.id === submissionId) setSelectedFormItem(null)
                onFormDataReload?.()
            } catch (err) {
                console.error('Failed to delete submission:', err)
            }
        },
        [onFormDataReload, selectedFormItem]
    )

    const handleSelectFormItem = useCallback(async (item) => {
        if (item?.__kind === 'form-due' && item.status === 'completed' && item.submission_id) {
            try {
                const submission = await MaintenanceService.fetchSubmissionById(item.submission_id)
                setSelectedFormItem({ ...item, ...submission, __kind: 'form-history', isViewOnly: true })
                return
            } catch {
                // fall through and show the upload UI in case the lookup fails
            }
        }
        setSelectedFormItem(item)
    }, [])

    const openLogService = useCallback((equipment) => {
        setDetailTarget(null)
        setServiceTarget(equipment)
    }, [])

    const openEdit = useCallback((equipment) => {
        setDetailTarget(null)
        setEditTarget(equipment)
    }, [])

    return {
        detailTarget,
        editTarget,
        handleDeleteSubmission,
        handleFormSubmitted,
        handleSelectFormItem,
        openEdit,
        openLogService,
        selectedFormItem,
        serviceTarget,
        setDetailTarget,
        setEditTarget,
        setSelectedFormItem,
        setServiceTarget
    }
}
