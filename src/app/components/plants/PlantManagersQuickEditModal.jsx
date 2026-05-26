/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

import { PlantService } from '../../../services/PlantService'
import PlantManagersEditor from './PlantManagersEditor'

/**
 * Modal sheet that lets the user attach / remove managers for a single
 * plant directly from `PlantsView` without opening the full detail surface.
 * Owns the draft list locally and persists via `PlantService.updatePlantManagers`
 * on confirm. The parent passes `onSaved(persistedIds)` to update its
 * local plant list once the write lands.
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

    /* Lock body scroll while the modal is open so the underlying list
     * doesn't shift behind the overlay. */
    useEffect(() => {
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [])

    useEffect(() => {
        const handleKey = (event) => {
            if (event.key === 'Escape' && !isSaving) onClose?.()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [isSaving, onClose])

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
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4 animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none"
            onClick={() => {
                if (!isSaving) onClose?.()
            }}
        >
            <div
                className="w-full max-w-lg rounded-2xl bg-bg-primary shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="plant-managers-modal-title"
            >
                <div className="flex items-center justify-between gap-3 border-b border-border-light px-5 py-4">
                    <div className="min-w-0">
                        <div id="plant-managers-modal-title" className="truncate text-base font-bold text-text-primary">
                            Managers · {plantName}
                        </div>
                        <div className="truncate text-[12px] text-text-tertiary">{plantCode}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-lg border border-border-light bg-bg-primary px-2.5 py-1 text-text-secondary transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover disabled:opacity-50 active:scale-[0.97] disabled:active:scale-100"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[12px]" />
                    </button>
                </div>
                <div className="px-5 py-4">
                    <PlantManagersEditor managerIds={managerIds} onChange={setManagerIds} disabled={isSaving} />
                    {error && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-text-primary">
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 border-t border-border-light px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-xl border border-border-light bg-bg-primary px-4 py-2 text-sm font-semibold text-text-secondary transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover disabled:opacity-50 active:scale-[0.97] disabled:active:scale-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-accent-hover disabled:opacity-50 active:scale-[0.97] disabled:active:scale-100"
                    >
                        {isSaving ? 'Saving…' : 'Save Managers'}
                    </button>
                </div>
            </div>
        </div>
    )
}
