import { useEffect, useState } from 'react'

import MaintenanceService from '../../services/MaintenanceService'

export function useFormLoader(item, submissionId) {
    const [loading, setLoading] = useState(true)
    const [formObj, setFormObj] = useState(null)
    const [submission, setSubmission] = useState(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                let sub = null
                let formId = item?.form_id || item?.maintenance_forms?.id || item?.form?.id || null
                if (submissionId) {
                    sub = await MaintenanceService.fetchSubmissionById(submissionId).catch(() => null)
                    if (sub) formId = formId || sub.form_id || sub.maintenance_forms?.id
                }
                let form = sub?.maintenance_forms || item?.maintenance_forms || item?.form || null
                if (!form && formId) {
                    form = await MaintenanceService.fetchFormById(formId).catch(() => null)
                }
                if (!cancelled) {
                    setSubmission(sub)
                    setFormObj(form)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [item, submissionId])

    return { formObj, loading, submission }
}
