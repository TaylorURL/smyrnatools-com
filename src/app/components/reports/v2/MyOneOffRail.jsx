import React from 'react'

const TINTS = {
    lost_load: { bg: 'bg-red-100', fg: 'text-red-600', icon: 'fa-truck' },
    qc_strength: { bg: 'bg-violet-100', fg: 'text-violet-700', icon: 'fa-flask' },
    third_party_lab: { bg: 'bg-rose-100', fg: 'text-rose-700', icon: 'fa-vial' }
}

const LABELS = {
    lost_load: 'Lost Load',
    qc_strength: 'QC Strength',
    third_party_lab: 'Third-Party Lab'
}

const formatShortDate = (value) => {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const titleFor = (report) => {
    const d = report.data || {}
    if (report.name === 'qc_strength') {
        return d.contractor || d.project || d.mix_id || 'QC Strength Report'
    }
    if (report.name === 'third_party_lab') {
        return d.lab_company_name || d.customer || 'Third-Party Lab Report'
    }
    if (report.name === 'lost_load') {
        const truck = d.truck_number ? `#${d.truck_number}` : ''
        return `Lost Load${truck ? ` · ${truck}` : ''}`
    }
    return LABELS[report.name] || 'Report'
}

/**
 * Side rail for the Quality and Loss tabs. Lists the current user's own
 * submissions of the rail's tab type with an Edit button that opens the
 * submission modal pre-filled for editing.
 */
function MyOneOffRail({ reports = [], title = 'Your submissions', onEdit, emptyLabel = 'Nothing submitted yet' }) {
    return (
        <aside
            className="rounded-xl p-4 border"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
        >
            <div className="flex items-center gap-2 mb-3">
                <i className="fas fa-user-pen text-[13px]" style={{ color: 'var(--text-secondary)' }} />
                <span
                    className="font-bold text-[14px]"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {title}
                </span>
                <span
                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    {reports.length}
                </span>
            </div>
            {reports.length === 0 ? (
                <div
                    className="flex flex-col items-center justify-center py-8"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-inbox text-2xl mb-2" />
                    <div className="text-[12px]">{emptyLabel}</div>
                </div>
            ) : (
                <div className="flex flex-col">
                    {reports.map((report) => {
                        const tint = TINTS[report.name] || {
                            bg: 'bg-slate-100',
                            fg: 'text-slate-600',
                            icon: 'fa-file-alt'
                        }
                        const when = formatShortDate(report.submittedAt || report.submitted_at)
                        return (
                            <div
                                key={`rail-mine-${report.id}`}
                                className="flex items-start gap-2.5 py-2.5 border-b last:border-b-0"
                                style={{ borderColor: 'var(--border-light)' }}
                            >
                                <div
                                    className={`w-7 h-7 rounded-md ${tint.bg} ${tint.fg} flex items-center justify-center shrink-0 mt-0.5`}
                                >
                                    <i className={`fas ${tint.icon} text-[11px]`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div
                                        className="text-[12px] font-semibold truncate"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {titleFor(report)}
                                    </div>
                                    <div className="text-[10.5px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                        {LABELS[report.name] || report.name}
                                        {when && <> · {when}</>}
                                        {report.reviewed && (
                                            <>
                                                {' · '}
                                                <span className="text-emerald-600 font-semibold">Reviewed</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onEdit?.(report)}
                                    className="px-2.5 py-1 text-[10.5px] font-semibold rounded-md border shrink-0 mt-0.5 inline-flex items-center gap-1 cursor-pointer hover:opacity-90"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        borderColor: 'var(--border-light)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <i className="fas fa-pen text-[9px]" /> Edit
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </aside>
    )
}

export default MyOneOffRail
