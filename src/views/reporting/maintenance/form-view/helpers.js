export function statusForSubmission(submission) {
    const status = (submission?.status || '').toLowerCase()
    if (status === 'approved') return { color: '#16a34a', label: 'Approved' }
    if (status === 'rejected') return { color: '#dc2626', label: 'Rejected' }
    if (status === 'submitted') return { color: '#0ea5e9', label: 'Pending Review' }
    if (status === 'draft') return { color: '#d97706', label: 'Draft' }
    return { color: 'var(--text-tertiary)', label: status || 'Unknown' }
}

export function formatHistoryDateTime(value) {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}
