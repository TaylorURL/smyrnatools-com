import React, { useEffect, useState } from 'react'

import { MaintenanceLogService } from '../../../services/MaintenanceLogService'
import {
    EMPTY_SERVICE_FORM,
    FIELD_INPUT_CLS,
    FIELD_INPUT_STYLE,
    FIELD_LABEL_CLS,
    MS_PER_DAY,
    SELECT_CLS,
    SELECT_STYLE
} from '../../../utils/MaintenanceLogUtility'

/** Modal for logging a completed service against a piece of equipment. */
export function MaintenanceServiceModal({ isOpen, onClose, onSaved, equipment, serviceTypes, accentColor }) {
    const [form, setForm] = useState(EMPTY_SERVICE_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen && equipment) {
            setForm(EMPTY_SERVICE_FORM)
            setError('')
        }
    }, [isOpen, equipment])

    if (!isOpen || !equipment) return null

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const handleSave = async () => {
        if (!form.service_date) return setError('Service date is required')
        setSaving(true)
        setError('')
        try {
            const nextServiceDate = equipment.service_interval_days
                ? new Date(new Date(form.service_date).getTime() + equipment.service_interval_days * MS_PER_DAY)
                      .toISOString()
                      .slice(0, 10)
                : null
            await MaintenanceLogService.createEntry({
                equipment_id: equipment.id,
                hours_spent: form.hours_spent ? parseFloat(form.hours_spent) : null,
                next_service_date: nextServiceDate,
                notes: form.notes || null,
                plant_code: equipment.plant_code,
                service_date: form.service_date,
                service_type_id: form.service_type_id || null
            })
            onSaved()
        } catch (err) {
            setError(err?.message || 'Failed to log service')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)] z-[110]"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md rounded max-h-[90vh] overflow-y-auto bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2.5 px-3 py-2 bg-bg-primary border-b border-border-light">
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-wrench text-[11px]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[9.5px] font-semibold uppercase tracking-wider text-text-secondary">
                                Log Service
                            </div>
                            <div className="text-[10.5px] truncate text-text-tertiary">
                                {equipment.name} · {equipment.plant_code}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer shrink-0 text-text-secondary"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium bg-red-100 border border-red-300 text-red-700">
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Service Date <span className="text-red-600">*</span>
                        </label>
                        <input
                            className={FIELD_INPUT_CLS}
                            style={FIELD_INPUT_STYLE}
                            type="date"
                            value={form.service_date}
                            onChange={(e) => update('service_date', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Service Type
                        </label>
                        <select
                            className={SELECT_CLS}
                            style={SELECT_STYLE}
                            value={form.service_type_id}
                            onChange={(e) => update('service_type_id', e.target.value)}
                        >
                            <option value="">Select Type</option>
                            {serviceTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Hours Spent
                        </label>
                        <input
                            className={FIELD_INPUT_CLS}
                            style={FIELD_INPUT_STYLE}
                            type="number"
                            step="0.25"
                            min="0"
                            placeholder="e.g. 2.5"
                            value={form.hours_spent}
                            onChange={(e) => update('hours_spent', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Notes
                        </label>
                        <textarea
                            className={`${FIELD_INPUT_CLS} resize-none`}
                            style={FIELD_INPUT_STYLE}
                            rows={3}
                            placeholder="Describe work performed, parts replaced, issues found..."
                            value={form.notes}
                            onChange={(e) => update('notes', e.target.value)}
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-2 px-3 py-2 bg-bg-secondary border-t border-border-light">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 transition-colors hover:brightness-95 bg-bg-primary border border-border-light text-text-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: accentColor }}
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'} text-[10px]`} />
                        {saving ? 'Saving\u2026' : 'Log Service'}
                    </button>
                </div>
            </div>
        </div>
    )
}
