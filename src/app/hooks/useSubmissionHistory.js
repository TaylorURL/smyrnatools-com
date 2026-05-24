import { useCallback, useEffect, useState } from 'react'

import MaintenanceService from '../../services/MaintenanceService'

export function useSubmissionHistory(formId) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const refresh = useCallback(async () => {
        if (!formId) {
            setHistory([])
            return
        }
        setLoading(true)
        try {
            const rows = await MaintenanceService.fetchSubmissionsByFormId(formId)
            setHistory(Array.isArray(rows) ? rows : [])
        } finally {
            setLoading(false)
        }
    }, [formId])
    useEffect(() => {
        refresh()
    }, [refresh])
    return { history, loading, refresh }
}
