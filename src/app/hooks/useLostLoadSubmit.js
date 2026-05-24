import { useState } from 'react'

import { EmailService } from '../../services/EmailService'
import APIUtility from '../../utils/APIUtility'
import { getCurrentWeekBounds, uploadWriteup } from '../components/reports/tabs/lost-loads/modal/helpers'

/**
 * Handles validation, attachment upload, edge function call, and GM notification
 * for both create and edit flows of the lost load report modal.
 */
export function useLostLoadSubmit({ user, isEditing, initialReport, onClose, onSubmitted }) {
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [emailError, setEmailError] = useState('')

    const submit = async (form) => {
        const {
            plant,
            lostLoadDate,
            yardage,
            truckNumber,
            customerName,
            ticketNumber,
            reason,
            explanation,
            dumpLocation,
            dumpLocationOther,
            operatorReprimanded,
            plantManagerReprimanded,
            attachment,
            selectedOperatorId,
            selectedOperatorName
        } = form
        const initialData = initialReport?.data || {}

        if (!plant || !lostLoadDate || !yardage || !truckNumber.trim() || !reason || !dumpLocation) {
            setError('Please fill out all required fields.')
            return
        }
        if (dumpLocation === 'Other' && !dumpLocationOther.trim()) {
            setError('Please specify where the concrete was dumped.')
            return
        }
        if (!explanation.trim()) {
            setError('Please explain what happened and what will be done to prevent this in the future.')
            return
        }
        if (isNaN(Number(yardage)) || Number(yardage) <= 0) {
            setError('Yardage must be a positive number.')
            return
        }
        const resolvedDumpLocation = dumpLocation === 'Other' ? dumpLocationOther.trim() : dumpLocation
        setSubmitting(true)
        setError('')
        try {
            // Upload attachment if a new one was chosen; otherwise keep any
            // existing attachment URL when editing.
            let attachmentUrl = isEditing ? initialData.attachment_url || null : null
            if (attachment) {
                attachmentUrl = await uploadWriteup(attachment, user.id)
            }

            const { monday, saturday } = getCurrentWeekBounds()
            const fullReason = reason === 'Other' ? `Other: ${explanation.trim()}` : `${reason}: ${explanation.trim()}`
            const payloadData = {
                attachment_url: attachmentUrl,
                customer_name: customerName.trim() || null,
                dump_location: resolvedDumpLocation,
                lost_load_date: lostLoadDate,
                operator_id: selectedOperatorId,
                operator_name: selectedOperatorName || null,
                operator_reprimanded: !!operatorReprimanded,
                plant,
                plant_manager_reprimanded: !!plantManagerReprimanded,
                reason: fullReason,
                ticket_number: ticketNumber.trim() || null,
                truck_number: truckNumber.trim(),
                yardage: Number(yardage)
            }
            let payload
            if (isEditing) {
                payload = { existingId: initialReport.id, upsertData: { data: payloadData } }
            } else {
                payload = {
                    upsertData: {
                        completed: true,
                        data: payloadData,
                        report_date_range_end: saturday,
                        report_date_range_start: monday,
                        report_name: 'lost_load',
                        submitted_at: new Date().toISOString(),
                        week: monday
                    }
                }
            }
            const { json, res } = await APIUtility.post('/report-service/save-report', payload)
            if (!res.ok) throw new Error(json?.error || 'Failed to submit report')
            const data = json

            onSubmitted?.(data)

            if (isEditing) {
                onClose()
                return
            }

            // Notify GMs — await so failures are visible, but don't block the success flow
            try {
                await EmailService.notifyReportSubmitted({
                    attachmentUrl,
                    reportFields: [
                        {
                            label: 'Date of Lost Load',
                            value: new Date(lostLoadDate + 'T12:00:00').toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })
                        },
                        { label: 'Plant', value: plant },
                        { label: 'Truck Number', value: truckNumber.trim() },
                        { label: 'Yardage', value: String(Number(yardage)) },
                        { label: 'Dump Location', value: resolvedDumpLocation },
                        ...(customerName.trim() ? [{ label: 'Customer', value: customerName.trim() }] : []),
                        ...(ticketNumber.trim() ? [{ label: 'Ticket Number', value: ticketNumber.trim() }] : []),
                        { label: 'Reason', value: fullReason },
                        ...(attachmentUrl ? [{ label: 'Writeup', value: 'PDF attached' }] : [])
                    ],
                    reportTitle: 'Lost Load Report',
                    userId: user.id,
                    weekLabel: ''
                })
                onClose()
            } catch (emailErr) {
                setEmailError(emailErr.message || 'Email notification failed to send.')
            }
        } catch (err) {
            setError(err.message || 'Error submitting report.')
        } finally {
            setSubmitting(false)
        }
    }

    return { emailError, error, setError, submit, submitting }
}
