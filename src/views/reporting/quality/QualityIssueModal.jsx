/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

import { useConfirm } from '../../../app/context/ConfirmContext'
import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { QualityIssueService } from '../../../services/QualityIssueService'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const FIELD_INPUT_CLASS = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'

const STATUS_OPTIONS = [
    { label: 'Active', value: 'active' },
    { label: 'Follow Up', value: 'follow_up' },
    { label: 'Holding', value: 'holding' },
    { label: 'Closed', value: 'closed' }
]
const SEVERITY_OPTIONS = [
    { label: '— None —', value: '' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' }
]

function emptyDraft() {
    return {
        cost_to_close: '',
        description: '',
        plant_code: '',
        severity: '',
        status: 'active',
        title: ''
    }
}

function FieldLabel({ children, icon, required }) {
    return (
        <label className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5 text-text-tertiary`}>
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
            {required && <span className="ml-0.5 text-text-primary">*</span>}
        </label>
    )
}

export default function QualityIssueModal({ issue, onClose, onDeleted, onSaved, plants = [], regionCode = '' }) {
    const accentColor = useAccentColor()
    const confirm = useConfirm()
    const isEditing = !!issue?.id
    const [draft, setDraft] = useState(emptyDraft())
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (issue) {
            setDraft({
                cost_to_close: issue.cost_to_close ?? '',
                description: issue.description || '',
                plant_code: issue.plant_code || '',
                severity: issue.severity || '',
                status: issue.status || 'active',
                title: issue.title || ''
            })
        } else {
            setDraft(emptyDraft())
        }
    }, [issue])

    const plantOptions = useMemo(() => {
        return (plants || [])
            .map((p) => ({
                code: p.plant_code || p.code,
                name: p.plant_name || p.name
            }))
            .filter((p) => p.code)
            .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    }, [plants])

    const update = (patch) => setDraft((prev) => ({ ...prev, ...patch }))

    const isClosed = draft.status === 'closed'

    const save = async () => {
        if (!draft.title.trim()) {
            setError('Title is required.')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            const payload = {
                cost_to_close: isClosed && draft.cost_to_close !== '' ? Number(draft.cost_to_close) : null,
                description: draft.description.trim() || null,
                plant_code: draft.plant_code || null,
                region_code: regionCode || null,
                severity: draft.severity || null,
                status: draft.status,
                title: draft.title.trim()
            }
            const result = isEditing
                ? await QualityIssueService.update(issue.id, payload)
                : await QualityIssueService.create(payload)
            if (onSaved) onSaved(result)
        } catch (err) {
            setError(err?.message || 'Failed to save issue.')
        } finally {
            setSubmitting(false)
        }
    }

    const remove = async () => {
        if (!isEditing) return
        if (
            !(await confirm({
                title: 'Delete this quality issue?',
                message: 'This action cannot be undone.',
                confirmLabel: 'Delete'
            }))
        )
            return
        setDeleting(true)
        setError('')
        try {
            await QualityIssueService.remove(issue.id)
            if (onDeleted) onDeleted(issue.id)
        } catch (err) {
            setError(err?.message || 'Failed to delete issue.')
            setDeleting(false)
        }
    }

    if (typeof document === 'undefined') return null

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded shadow-2xl"
                style={CARD_STYLE}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-3 py-2.5 bg-bg-secondary border-b border-border-light">
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-flask text-[11px]" />
                        </div>
                        <div className="min-w-0">
                            <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Quality Issue
                            </div>
                            <div className="text-[12.5px] font-semibold leading-tight text-text-primary">
                                {isEditing ? 'Edit issue' : 'New issue'}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border-none cursor-pointer bg-bg-tertiary text-text-secondary h-6 w-6"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                </div>

                <div className="p-3 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <FieldLabel icon="fa-heading" required>
                            Title
                        </FieldLabel>
                        <input
                            type="text"
                            value={draft.title}
                            onChange={(e) => update({ title: e.target.value })}
                            placeholder="Short summary of the issue"
                            className={FIELD_INPUT_CLASS}
                            style={FIELD_STYLE}
                            autoFocus
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <FieldLabel icon="fa-align-left">Description</FieldLabel>
                        <textarea
                            value={draft.description}
                            onChange={(e) => update({ description: e.target.value })}
                            rows={4}
                            placeholder="Background, mix design, customer dispute, follow-up plan…"
                            className={`${FIELD_INPUT_CLASS} resize-y min-h-[88px]`}
                            style={FIELD_STYLE}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <FieldLabel icon="fa-industry">Plant</FieldLabel>
                            <select
                                value={draft.plant_code}
                                onChange={(e) => update({ plant_code: e.target.value })}
                                className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                                style={FIELD_STYLE}
                            >
                                <option value="">— Region-wide —</option>
                                {plantOptions.map((p) => (
                                    <option key={p.code} value={p.code}>
                                        {p.code}
                                        {p.name ? ` · ${p.name}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <FieldLabel icon="fa-triangle-exclamation">Severity</FieldLabel>
                            <select
                                value={draft.severity}
                                onChange={(e) => update({ severity: e.target.value })}
                                className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                                style={FIELD_STYLE}
                            >
                                {SEVERITY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <FieldLabel icon="fa-circle-dot" required>
                                Status
                            </FieldLabel>
                            <select
                                value={draft.status}
                                onChange={(e) => update({ status: e.target.value })}
                                className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                                style={FIELD_STYLE}
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <FieldLabel icon="fa-dollar-sign">Cost to close</FieldLabel>
                            <input
                                type="number"
                                value={draft.cost_to_close}
                                onChange={(e) => update({ cost_to_close: e.target.value })}
                                placeholder={isClosed ? '0.00' : 'Closed issues only'}
                                disabled={!isClosed}
                                step="0.01"
                                min="0"
                                className={`${FIELD_INPUT_CLASS} tabular-nums`}
                                style={FIELD_STYLE}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium bg-red-100 border border-red-300 text-text-primary">
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-1.5 px-3 py-2.5 bg-bg-secondary border-t border-border-light">
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={deleting || submitting}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-50 bg-red-600"
                        >
                            <i className={`fas ${deleting ? 'fa-circle-notch fa-spin' : 'fa-trash-alt'} text-[10px]`} />
                            Delete
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-1.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none bg-bg-tertiary border border-border-light text-text-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={submitting || deleting}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: accentColor }}
                        >
                            <i
                                className={`fas ${submitting ? 'fa-circle-notch fa-spin' : isEditing ? 'fa-save' : 'fa-plus'} text-[10px]`}
                            />
                            {isEditing ? 'Save' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
