/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { NRMCAService } from '../../../../services/NRMCAService'
import { INPUT_CLS, INPUT_STYLE, SCALE_TYPES, SELECT_CLS } from './nrmcaConstants'
import { Field, Modal } from './NRMCASharedUI'

export function ScaleFormModal({ scale, nrmcaPlants, defaultPlantId, onClose, onSaved }) {
    const [nrmcaPlantId, setNrmcaPlantId] = useState(scale?.nrmca_plant_id ?? defaultPlantId ?? '')
    const [scaleName, setScaleName] = useState(scale?.scale_name ?? '')
    const [scaleType, setScaleType] = useState(scale?.scale_type ?? 'batch')
    const [intervalDays, setIntervalDays] = useState(String(scale?.calibration_interval_days ?? 365))
    const [notes, setNotes] = useState(scale?.notes ?? '')
    const [saving, setSaving] = useState(false)

    const selectedPlant = nrmcaPlants.find((p) => p.id === nrmcaPlantId)

    async function handleSave() {
        if (!nrmcaPlantId || !scaleName) return
        setSaving(true)
        try {
            await NRMCAService.upsertScale({
                calibration_interval_days: parseInt(intervalDays) || 365,
                id: scale?.id,
                notes: notes || null,
                nrmca_plant_id: nrmcaPlantId,
                plant_code: selectedPlant?.plant_code ?? null,
                scale_name: scaleName,
                scale_type: scaleType
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to save scale')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={scale ? 'Edit Scale' : 'Add Scale'} onClose={onClose} onSubmit={handleSave} submitting={saving}>
            <Field label="Plant">
                <select
                    className={SELECT_CLS}
                    style={INPUT_STYLE}
                    value={nrmcaPlantId}
                    onChange={(e) => setNrmcaPlantId(e.target.value)}
                    required
                >
                    <option value="">Select plant…</option>
                    {nrmcaPlants.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.plant_code} — {p.plant_label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Scale Name">
                <input
                    type="text"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    placeholder="e.g. Batch Scale 1"
                    value={scaleName}
                    onChange={(e) => setScaleName(e.target.value)}
                    required
                />
            </Field>
            <Field label="Scale Type">
                <select
                    className={SELECT_CLS}
                    style={INPUT_STYLE}
                    value={scaleType}
                    onChange={(e) => setScaleType(e.target.value)}
                >
                    {SCALE_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Calibration Interval (days)">
                <input
                    type="number"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    min="1"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                />
                <p className="text-[11px] text-text-tertiary">365 = annual · 180 = semi-annual</p>
            </Field>
            <Field label="Notes (optional)">
                <textarea
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </Field>
        </Modal>
    )
}
