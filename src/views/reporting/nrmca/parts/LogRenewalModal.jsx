/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { INPUT_CLS, INPUT_STYLE } from '../../../../app/constants/nrmcaConstants'
import { NRMCAService } from '../../../../services/NRMCAService'
import { Field, Modal } from './NRMCASharedUI'

export function LogRenewalModal({ plant, onClose, onSaved }) {
    const today = new Date().toISOString().slice(0, 10)
    const threeYearsOut = new Date(Date.now() + 3 * 365 * 86400000).toISOString().slice(0, 10)
    const [renewedAt, setRenewedAt] = useState(today)
    const [expiresAt, setExpiresAt] = useState(threeYearsOut)
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        setSaving(true)
        try {
            await NRMCAService.logRenewal({
                notes: notes || null,
                nrmca_plant_id: plant.id,
                renewal_expires_at: expiresAt || null,
                renewed_at: renewedAt
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to log renewal')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={`Log Renewal — ${plant.plant_label}`} onClose={onClose} onSubmit={handleSave} submitting={saving}>
            <Field label="Renewal Date">
                <input
                    type="date"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    value={renewedAt}
                    onChange={(e) => setRenewedAt(e.target.value)}
                    required
                />
            </Field>
            <Field label="Expiration Date">
                <input
                    type="date"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
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
