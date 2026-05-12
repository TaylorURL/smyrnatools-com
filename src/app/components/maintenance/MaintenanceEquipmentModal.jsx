import React, { useEffect, useState } from 'react'

import { MaintenanceLogService } from '../../../services/MaintenanceLogService'
import {
    EMPTY_EQUIPMENT_FORM,
    FIELD_INPUT_CLS,
    FIELD_INPUT_STYLE,
    FIELD_LABEL_CLS,
    SELECT_CLS,
    SELECT_STYLE
} from '../../../utils/MaintenanceLogUtility'
import PlantDropdownModal from '../common/PlantDropdownModal'

/**
 * Unified add / edit equipment modal.
 * @param {{ mode: 'add'|'edit', isOpen: boolean, onClose: Function, onSaved: Function, equipment?: object, categories: Array, plants: Array, accentColor: string }} props
 */
export function MaintenanceEquipmentModal({ mode = 'add', isOpen, onClose, onSaved, equipment, categories, plants, accentColor }) {
    const [form, setForm] = useState(EMPTY_EQUIPMENT_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showPlantPicker, setShowPlantPicker] = useState(false)

    const isEdit = mode === 'edit'

    useEffect(() => {
        if (!isOpen) return
        if (isEdit && equipment) {
            setForm({
                category_id: equipment.category_id || '',
                install_date: equipment.install_date ? equipment.install_date.slice(0, 10) : '',
                location_note: equipment.location_note || '',
                manufacturer: equipment.manufacturer || '',
                model: equipment.model || '',
                name: equipment.name || '',
                plant_code: equipment.plant_code || '',
                serial_number: equipment.serial_number || '',
                service_interval_days: equipment.service_interval_days ?? 90
            })
        } else {
            setForm(EMPTY_EQUIPMENT_FORM)
        }
        setError('')
    }, [isOpen, isEdit, equipment])

    if (!isOpen) return null
    if (isEdit && !equipment) return null

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const plantLabel = form.plant_code
        ? (() => {
              const match = plants.find((p) => (p.plantCode || p.plant_code) === form.plant_code)
              return match
                  ? `${match.plantCode || match.plant_code} — ${match.plantName || match.plant_name}`
                  : form.plant_code
          })()
        : 'Select Plant'

    const handleSave = async () => {
        if (!form.name.trim()) return setError('Equipment name is required')
        if (!form.category_id) return setError('Category is required')
        if (!form.plant_code) return setError('Plant is required')
        setSaving(true)
        setError('')
        try {
            const payload = {
                category_id: form.category_id,
                install_date: form.install_date || null,
                location_note: form.location_note || null,
                manufacturer: form.manufacturer || null,
                model: form.model || null,
                name: form.name.trim(),
                plant_code: form.plant_code,
                serial_number: form.serial_number || null,
                service_interval_days: parseInt(form.service_interval_days) || 90
            }
            if (isEdit) {
                await MaintenanceLogService.updateEquipment(equipment.id, payload)
            } else {
                await MaintenanceLogService.createEquipment(payload)
            }
            onSaved()
        } catch (err) {
            setError(err?.message || (isEdit ? 'Failed to save changes' : 'Failed to save equipment'))
        } finally {
            setSaving(false)
        }
    }

    const headerIcon = isEdit ? 'fa-pen' : 'fa-plus'
    const headerLabel = isEdit ? 'Edit Item' : 'Add Part / Unit / Component'
    const saveIcon = isEdit ? 'fa-check' : 'fa-plus'
    const saveLabel = isEdit ? 'Save Changes' : 'Add'

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)] z-[120]"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg rounded max-h-[90vh] overflow-y-auto bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2.5 px-3 py-2 bg-bg-primary border-b border-border-light">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className={`fas ${headerIcon} text-[11px]`} />
                        </div>
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-text-secondary">
                            {headerLabel}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer text-text-secondary"
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
                            Equipment Name <span className="text-red-600">*</span>
                        </label>
                        <input
                            className={FIELD_INPUT_CLS}
                            style={FIELD_INPUT_STYLE}
                            placeholder="e.g. Compressor #1"
                            value={form.name}
                            onChange={(e) => update('name', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Category <span className="text-red-600">*</span>
                        </label>
                        <select
                            className={SELECT_CLS}
                            style={SELECT_STYLE}
                            value={form.category_id}
                            onChange={(e) => update('category_id', e.target.value)}
                        >
                            <option value="">Select Category</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                            Plant <span className="text-red-600">*</span>
                        </label>
                        <button
                            type="button"
                            className={`${FIELD_INPUT_CLS} text-left cursor-pointer`}
                            style={FIELD_INPUT_STYLE}
                            onClick={() => setShowPlantPicker(true)}
                        >
                            {plantLabel}
                        </button>
                        <PlantDropdownModal
                            isOpen={showPlantPicker}
                            onClose={() => setShowPlantPicker(false)}
                            plants={plants}
                            onSelect={(code) => {
                                update('plant_code', code)
                                setShowPlantPicker(false)
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Manufacturer
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. Ingersoll Rand"
                                value={form.manufacturer}
                                onChange={(e) => update('manufacturer', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Model
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. SSR-2000"
                                value={form.model}
                                onChange={(e) => update('model', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Serial Number
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. SN-12345"
                                value={form.serial_number}
                                onChange={(e) => update('serial_number', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Service Interval (days)
                            </label>
                            <input
                                className={`${FIELD_INPUT_CLS} font-mono tabular-nums`}
                                style={FIELD_INPUT_STYLE}
                                type="number"
                                min="1"
                                value={form.service_interval_days}
                                onChange={(e) => update('service_interval_days', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Install Date
                            </label>
                            <input
                                className={`${FIELD_INPUT_CLS} font-mono tabular-nums`}
                                style={FIELD_INPUT_STYLE}
                                type="date"
                                value={form.install_date}
                                onChange={(e) => update('install_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={FIELD_LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
                                Location Note
                            </label>
                            <input
                                className={FIELD_INPUT_CLS}
                                style={FIELD_INPUT_STYLE}
                                placeholder="e.g. Back of batch plant"
                                value={form.location_note}
                                onChange={(e) => update('location_note', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
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
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : saveIcon} text-[10px]`} />
                        {saving ? 'Saving\u2026' : saveLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
