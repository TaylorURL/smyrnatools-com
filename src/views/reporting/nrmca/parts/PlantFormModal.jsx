/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import { INPUT_CLS, INPUT_STYLE, SELECT_CLS, SELECT_STYLE } from '../../../../app/constants/nrmcaConstants'
import { NRMCAService } from '../../../../services/NRMCAService'
import { Field, Modal } from './NRMCASharedUI'

export function PlantFormModal({ plant, regionPlants, onClose, onSaved }) {
    const [plantCode, setPlantCode] = useState(plant?.plant_code ?? '')
    const [plantLabel, setPlantLabel] = useState(plant?.plant_label ?? '')
    const [notes, setNotes] = useState(plant?.notes ?? '')
    const [saving, setSaving] = useState(false)
    const [showPlantPicker, setShowPlantPicker] = useState(false)

    const selectedPlantName = useMemo(() => {
        if (!plantCode) return null
        const match = regionPlants.find((p) => (p.plantCode || p.plant_code) === plantCode)
        return match ? match.plantName || match.plant_name : null
    }, [plantCode, regionPlants])

    async function handleSave() {
        if (!plantCode || !plantLabel) return
        setSaving(true)
        try {
            await NRMCAService.upsertPlant({
                id: plant?.id,
                notes: notes || null,
                plant_code: plantCode,
                plant_label: plantLabel
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to save plant')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={plant ? 'Edit Plant' : 'Add Plant'} onClose={onClose} onSubmit={handleSave} submitting={saving}>
            <Field label="Plant">
                <button type="button"
                    type="button"
                    onClick={() => setShowPlantPicker(true)}
                    className={`${SELECT_CLS} text-left`}
                    style={SELECT_STYLE}
                >
                    {plantCode ? (
                        `(${plantCode}) ${selectedPlantName ?? ''}`
                    ) : (
                        <span className="text-text-tertiary">Select plant…</span>
                    )}
                </button>
                <PlantDropdownModal
                    isOpen={showPlantPicker}
                    onClose={() => setShowPlantPicker(false)}
                    plants={regionPlants}
                    onSelect={(code) => setPlantCode(code)}
                />
            </Field>
            <Field label="Plant Label">
                <input
                    type="text"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    placeholder="e.g. Main Batch Plant, Plant 1-A"
                    value={plantLabel}
                    onChange={(e) => setPlantLabel(e.target.value)}
                    required
                />
                <p className="text-[11px] text-text-tertiary">
                    Use labels to distinguish multiple batch plants at the same location.
                </p>
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
