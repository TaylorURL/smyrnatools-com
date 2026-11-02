import React, { useCallback, useEffect, useRef, useState } from 'react'

import { PlantService } from '../../../services/PlantService'
import Dialog from '../ui/Dialog'
import PlantManagersEditor from './PlantManagersEditor'

/**
 * Dialog that lets the user attach / remove managers for a single plant
 * directly from `PlantsView` without opening the full detail surface.
 * Owns the draft list locally and persists via `PlantService.updatePlantManagers`
 * on confirm. The parent passes `onSaved(persistedIds)` to update its
 * local plant list once the write lands. It can't be closed mid-save.
 */
export default function PlantManagersQuickEditModal({ plant, onClose, onSaved }) {
    const plantCode = plant?.plant_code || plant?.plantCode || ''
    const plantName = plant?.plant_name || plant?.plantName || plantCode
    const initialIds = Array.isArray(plant?.manager_user_ids)
        ? plant.manager_user_ids
        : Array.isArray(plant?.managerUserIds)
          ? plant.managerUserIds
          : []
    const [managerIds, setManagerIds] = useState(initialIds)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    // One stable close for the dialog — it re-runs its focus handling when
    // `onClose` changes — that reads the latest prop and saving flag.
    const latestRef = useRef({ isSaving, onClose })
    useEffect(() => {
        latestRef.current = { isSaving, onClose }
    })
    const handleClose = useCallback(() => {
        if (!latestRef.current.isSaving) latestRef.current.onClose?.()
    }, [])

    const handleSave = async () => {
        if (!plantCode) return
        setIsSaving(true)
        setError('')
        try {
            const persisted = await PlantService.updatePlantManagers(plantCode, managerIds)
            onSaved?.(persisted)
            onClose?.()
        } catch (err) {
            setError(err?.message || 'Failed to save managers')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog
            open
            onClose={handleClose}
            size="md"
            eyebrow={[plantCode && `Plant ${plantCode}`, plantName !== plantCode && plantName]
                .filter(Boolean)
                .join(' · ')}
            title="Managers"
            footer={
                <>
                    <button type="button" onClick={handleClose} disabled={isSaving} className="btn-secondary">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSaving} className="btn-primary">
                        {isSaving && <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />}
                        {isSaving ? 'Saving…' : 'Save managers'}
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <PlantManagersEditor managerIds={managerIds} onChange={setManagerIds} disabled={isSaving} />
                {error && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="rounded-[4px] border border-[color:var(--notice-danger-border)] bg-[color:var(--notice-danger-bg)] px-3 py-2 text-[13px] text-[color:var(--notice-danger-strong)]"
                    >
                        {error}
                    </div>
                )}
            </div>
        </Dialog>
    )
}
