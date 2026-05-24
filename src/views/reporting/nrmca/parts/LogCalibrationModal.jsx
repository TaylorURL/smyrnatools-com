/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { NRMCAService } from '../../../../services/NRMCAService'
import { INPUT_CLS, INPUT_STYLE } from './nrmcaConstants'
import { Field, Modal } from './NRMCASharedUI'

export function LogCalibrationModal({ scale, onClose, onSaved }) {
    const today = new Date().toISOString().slice(0, 10)
    const [calibratedAt, setCalibratedAt] = useState(today)
    const [calibratedBy, setCalibratedBy] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        setSaving(true)
        try {
            await NRMCAService.logCalibration({
                calibrated_at: calibratedAt,
                calibrated_by: calibratedBy || null,
                notes: notes || null,
                scale_id: scale.id
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to log calibration')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={`Log Calibration — ${scale.scale_name}`}
            onClose={onClose}
            onSubmit={handleSave}
            submitting={saving}
        >
            <Field label="Calibration Date">
                <input
                    type="date"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    value={calibratedAt}
                    onChange={(e) => setCalibratedAt(e.target.value)}
                    required
                />
            </Field>
            <Field label="Calibrated By (optional)">
                <input
                    type="text"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    placeholder="Company or technician name"
                    value={calibratedBy}
                    onChange={(e) => setCalibratedBy(e.target.value)}
                />
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
