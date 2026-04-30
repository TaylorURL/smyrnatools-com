import React, { useEffect, useState } from 'react'

import { createEmptyJob } from '../../../utils/PlanDashboardUtility'
import { Panel as SharedPanel } from '../ui/Panel'

/**
 * Edit form for a Special Attention or QC job. Holds a local draft so
 * the user can cancel without polluting the parent's state. `onSave`
 * fires only when the title is non-empty.
 */
function JobEditor({ accent, job, onCancel, onSave, plants, tint, titleLabel = 'Title' }) {
    const [draft, setDraft] = useState(job)
    const isNew = !job.title && !job.description
    useEffect(() => {
        setDraft(job)
    }, [job])
    const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))
    const canSave = (draft.title || '').trim().length > 0
    return (
        <div
            className="rounded-lg p-3 flex flex-col gap-2"
            style={{
                background: 'var(--bg-primary)',
                border: `1.5px solid ${tint || accent}`,
                boxShadow: 'var(--shadow-sm)'
            }}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                    autoFocus
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder={titleLabel}
                    className="sm:col-span-2 w-full px-3 py-2 rounded-md text-sm font-semibold outline-none"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)'
                    }}
                />
                <select
                    value={draft.plant || ''}
                    onChange={(e) => update('plant', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <option value="">Plant…</option>
                    {(plants || []).map((p) => (
                        <option key={p.plant_code} value={p.plant_code}>
                            {p.plant_code}
                            {p.plant_name ? ` — ${p.plant_name}` : ''}
                        </option>
                    ))}
                </select>
                <input
                    type="time"
                    value={draft.time || ''}
                    onChange={(e) => update('time', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm font-mono"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
                <input
                    type="text"
                    value={draft.contractor || ''}
                    onChange={(e) => update('contractor', e.target.value)}
                    placeholder="Contractor or job ref"
                    className="sm:col-span-2 w-full px-3 py-2 rounded-md text-sm"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
                <textarea
                    value={draft.description || ''}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="What needs attention? Any crew / spec / timing notes…"
                    rows={3}
                    className="sm:col-span-2 w-full px-3 py-2 rounded-md text-sm outline-none resize-none"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
            </div>
            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => canSave && onSave(draft)}
                    disabled={!canSave}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                    style={{ background: tint || accent }}
                >
                    <i className="fas fa-check mr-1" />
                    {isNew ? 'Add job' : 'Save changes'}
                </button>
            </div>
        </div>
    )
}

/** Display-only row for a saved Special / QC job, with edit + delete
 *  affordances when `canEdit` is true. */
function JobRow({ accent, canEdit = true, job, onDelete, onEdit, plantNameByCode, tint }) {
    return (
        <div
            className="rounded-lg p-3 flex items-start gap-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${tint || accent}18`, color: tint || accent }}
            >
                <i className="fas fa-circle-exclamation text-[12px]" />
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[14px] font-semibold"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {job.title || 'Untitled'}
                </div>
                <div
                    className="text-[11px] flex items-center gap-1.5 flex-wrap"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {job.plant && (
                        <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ background: 'var(--bg-tertiary)' }}
                        >
                            <i className="fas fa-industry text-[9px]" />
                            {job.plant}
                            {plantNameByCode?.[job.plant] ? ` · ${plantNameByCode[job.plant]}` : ''}
                        </span>
                    )}
                    {job.time && (
                        <span className="inline-flex items-center gap-1 font-mono">
                            <i className="fas fa-clock text-[9px]" />
                            {job.time}
                        </span>
                    )}
                    {job.contractor && (
                        <span className="inline-flex items-center gap-1">
                            <i className="fas fa-helmet-safety text-[9px]" />
                            {job.contractor}
                        </span>
                    )}
                </div>
                {job.description && (
                    <div className="text-[12px] mt-1.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {job.description}
                    </div>
                )}
            </div>
            {canEdit && (
                <div className="flex flex-col gap-1 shrink-0">
                    <button
                        onClick={onEdit}
                        className="w-7 h-7 rounded-md border-none cursor-pointer"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                        title="Edit"
                    >
                        <i className="fas fa-pen text-[10px]" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-7 h-7 rounded-md border-none cursor-pointer"
                        style={{ background: 'var(--bg-primary)', color: '#dc2626' }}
                        title="Delete"
                    >
                        <i className="fas fa-trash text-[10px]" />
                    </button>
                </div>
            )}
        </div>
    )
}

/**
 * List of attention-flagged jobs (Special or QC) with inline create / edit
 * affordances. Owns the editor draft state so the parent only needs to
 * supply `jobs`, plant context, and the four mutation callbacks.
 */
export function PlanDashboardJobsSection({
    accent,
    canEdit = true,
    emptyHint,
    id,
    jobs,
    onCreate,
    onDelete,
    onSave,
    plantNameByCode,
    plants,
    tint,
    title,
    titleLabel
}) {
    const [editingId, setEditingId] = useState(null)
    const [draftJob, setDraftJob] = useState(null)

    const startCreate = () => {
        const fresh = createEmptyJob()
        setDraftJob(fresh)
        setEditingId(fresh.id)
    }
    const startEdit = (job) => {
        setDraftJob(job)
        setEditingId(job.id)
    }
    const cancel = () => {
        setDraftJob(null)
        setEditingId(null)
    }
    const save = (draft) => {
        if (jobs.some((j) => j.id === draft.id)) onSave(draft)
        else onCreate(draft)
        cancel()
    }

    return (
        <SharedPanel
            id={id}
            title={`${title} · ${jobs.length}`}
            right={
                canEdit && (
                    <button
                        onClick={startCreate}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white border-none cursor-pointer"
                        style={{ background: tint || accent }}
                    >
                        <i className="fas fa-plus mr-1" /> Add
                    </button>
                )
            }
        >
            <div className="flex flex-col gap-2">
                {jobs.length === 0 && !draftJob && (
                    <div
                        className="rounded-lg p-4 text-center text-[12px] italic"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                    >
                        {emptyHint}
                    </div>
                )}
                {jobs.map((job) =>
                    editingId === job.id ? (
                        <JobEditor
                            key={job.id}
                            accent={accent}
                            tint={tint}
                            job={draftJob}
                            plants={plants}
                            onCancel={cancel}
                            onSave={save}
                            titleLabel={titleLabel}
                        />
                    ) : (
                        <JobRow
                            key={job.id}
                            accent={accent}
                            canEdit={canEdit}
                            tint={tint}
                            job={job}
                            plantNameByCode={plantNameByCode}
                            onEdit={() => startEdit(job)}
                            onDelete={() => onDelete(job.id)}
                        />
                    )
                )}
                {draftJob && editingId === draftJob.id && !jobs.some((j) => j.id === draftJob.id) && (
                    <JobEditor
                        accent={accent}
                        tint={tint}
                        job={draftJob}
                        plants={plants}
                        onCancel={cancel}
                        onSave={save}
                        titleLabel={titleLabel}
                    />
                )}
            </div>
        </SharedPanel>
    )
}
