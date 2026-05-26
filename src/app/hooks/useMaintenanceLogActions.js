import { useCallback, useState } from 'react'

import { MaintenanceService } from '../../services/MaintenanceService'
import APIUtility from '../../utils/APIUtility'
import { useConfirm } from '../context/ConfirmContext'

/**
 * Modal targets and form-rail action handlers for the maintenance log view.
 * @param {{ onFormDataReload: Function }} params
 */
export function useMaintenanceLogActions({ onFormDataReload }) {
    const confirm = useConfirm()
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
            if (!(await confirm({ title: 'Delete this submission?', confirmLabel: 'Delete' }))) return
            const { res } = await APIUtility.post('/maintenance-service/delete-submission', { submissionId })
            if (!res.ok) return
            if (selectedFormItem?.id === submissionId) setSelectedFormItem(null)
            onFormDataReload?.()
        },
        [confirm, onFormDataReload, selectedFormItem]
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
