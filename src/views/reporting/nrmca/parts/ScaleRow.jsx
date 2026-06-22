/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { SCALE_ICON_TONE_CLASS } from '../../../../app/constants/nrmcaConstants'
import { useConfirm } from '../../../../app/context/ConfirmContext'
import { NRMCAService } from '../../../../services/NRMCAService'
import { LogCalibrationModal } from './LogCalibrationModal'
import { daysFromNow, fmt, getCalibrationStatus, getNextCalibrationDueDate } from './nrmcaHelpers'
import { IconBtn, StatusBadge } from './NRMCASharedUI'
import { ScaleFormModal } from './ScaleFormModal'

export function ScaleRow({ scale, allPlants, onReload, accentColor }) {
    const confirm = useConfirm()
    const [calibModal, setCalibModal] = useState(false)
    const [editModal, setEditModal] = useState(false)

    const status = getCalibrationStatus(scale.calibrated_at, scale.calibration_interval_days)
    const nextDue = getNextCalibrationDueDate(scale.calibrated_at, scale.calibration_interval_days)
    const days = nextDue ? daysFromNow(nextDue) : null
    const iconToneClass = SCALE_ICON_TONE_CLASS[status] ?? SCALE_ICON_TONE_CLASS.unknown

    async function confirmDelete() {
        const ok = await confirm({
            confirmLabel: 'Delete',
            title: `Delete scale "${scale.scale_name}"?`
        })
        if (!ok) return
        NRMCAService.deleteScale(scale.id)
            .then(onReload)
            .catch((e) => alert(e?.message))
    }

    return (
        <>
            <div className="flex items-center gap-2.5 px-3 py-2 transition-colors border-b border-border-light">
                <div className="w-4 shrink-0" />
                <div className={`${iconToneClass} w-6 h-6 rounded flex items-center justify-center shrink-0`}>
                    <i className="fas fa-balance-scale text-[10px]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[12px] truncate text-text-primary">
                        {scale.scale_name}
                        <span className="ml-1.5 capitalize font-normal text-text-tertiary">· {scale.scale_type}</span>
                    </div>
                    <div className="text-[10.5px] mt-0.5 truncate text-text-secondary">
                        {scale.calibrated_at ? `Calibrated ${fmt(scale.calibrated_at)}` : 'Never calibrated'}
                        {scale.calibrated_by ? ` · ${scale.calibrated_by}` : ''}
                        {nextDue &&
                            ` · due ${fmt(nextDue)}${days !== null ? ` (${days < 0 ? `${Math.abs(days)}d late` : `${days}d`})` : ''}`}
                    </div>
                </div>
                <StatusBadge status={status} />
                <button type="button"
                    type="button"
                    onClick={() => setCalibModal(true)}
                    className="text-white text-[10.5px] font-semibold px-2 py-1 rounded shrink-0 hidden sm:inline-flex items-center gap-1 uppercase tracking-wider"
                    style={{ background: accentColor }}
                >
                    Log
                </button>
                <IconBtn icon="fa-pencil-alt" onClick={() => setEditModal(true)} title="Edit scale" />
                <IconBtn icon="fa-trash-alt" onClick={confirmDelete} danger title="Delete scale" />
            </div>

            {calibModal && (
                <LogCalibrationModal
                    scale={scale}
                    onClose={() => setCalibModal(false)}
                    onSaved={() => {
                        setCalibModal(false)
                        onReload()
                    }}
                />
            )}
            {editModal && (
                <ScaleFormModal
                    scale={scale}
                    nrmcaPlants={allPlants}
                    onClose={() => setEditModal(false)}
                    onSaved={() => {
                        setEditModal(false)
                        onReload()
                    }}
                />
            )}
        </>
    )
}
