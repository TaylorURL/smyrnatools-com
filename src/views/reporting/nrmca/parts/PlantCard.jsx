/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { useConfirm } from '../../../../app/context/ConfirmContext'
import { NRMCAService } from '../../../../services/NRMCAService'
import { LogRenewalModal } from './LogRenewalModal'
import { daysFromNow, fmt, getRenewalStatus } from './nrmcaHelpers'
import { IconBtn, StatusBadge } from './NRMCASharedUI'
import { PlantFormModal } from './PlantFormModal'
import { ScaleFormModal } from './ScaleFormModal'
import { ScaleRow } from './ScaleRow'

/**
 * Self-contained plant card — header (label, code, renewal status, action
 * buttons) plus nested scale rows and an "Add scale" footer. Each card is a
 * single grid cell in the page's 2-column layout, mirroring the flat panel
 * aesthetic used throughout the Plan tab.
 */
export function PlantCard({ plant, scales, allPlants, regionPlants, onReload, accentColor }) {
    const confirm = useConfirm()
    const [renewModal, setRenewModal] = useState(false)
    const [editModal, setEditModal] = useState(false)
    const [addScaleModal, setAddScaleModal] = useState(false)

    const renewalStatus = getRenewalStatus(plant.renewal_expires_at)
    const plantScales = scales.filter((s) => s.nrmca_plant_id === plant.id)
    const expiryDays = daysFromNow(plant.renewal_expires_at)

    const contextLine = plant.renewal_expires_at
        ? renewalStatus === 'expired'
            ? `Expired ${fmt(plant.renewal_expires_at)}${expiryDays !== null ? ` · ${Math.abs(expiryDays)}d ago` : ''}`
            : `Expires ${fmt(plant.renewal_expires_at)}${expiryDays !== null && expiryDays >= 0 ? ` · ${expiryDays}d left` : ''}`
        : plant.renewed_at
          ? `Renewed ${fmt(plant.renewed_at)}`
          : 'No certification on file'

    async function confirmDeletePlant() {
        const ok = await confirm({
            confirmLabel: 'Delete',
            message: 'This will also remove all associated scales and history.',
            title: `Delete "${plant.plant_label}"?`
        })
        if (!ok) return
        NRMCAService.deletePlant(plant.id)
            .then(onReload)
            .catch((e) => alert(e?.message))
    }

    return (
        <>
            <section className="rounded overflow-hidden flex flex-col bg-bg-primary border border-border-light">
                <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary border-b border-border-light">
                    <div
                        className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}22`, color: accentColor }}
                    >
                        <i className="fas fa-certificate text-[10px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[12px] truncate text-text-primary">
                            {plant.plant_label}
                            <span className="ml-1.5 font-semibold uppercase tracking-wider text-text-tertiary">
                                · {plant.plant_code}
                            </span>
                        </div>
                        <div className="text-[10.5px] mt-0.5 truncate text-text-secondary">
                            NRMCA Certification · {contextLine}
                        </div>
                    </div>
                    <StatusBadge status={renewalStatus} />
                    <button
                        type="button"
                        onClick={() => setRenewModal(true)}
                        className="text-white text-[10.5px] font-semibold px-2 py-1 rounded shrink-0 hidden sm:inline-flex items-center gap-1 uppercase tracking-wider"
                        style={{ background: accentColor }}
                    >
                        Log Renewal
                    </button>
                    <IconBtn icon="fa-pencil-alt" onClick={() => setEditModal(true)} title="Edit plant" />
                    <IconBtn icon="fa-trash-alt" onClick={confirmDeletePlant} danger title="Delete plant" />
                </div>

                {plantScales.length > 0 ? (
                    plantScales.map((scale) => (
                        <ScaleRow
                            key={scale.id}
                            scale={scale}
                            allPlants={allPlants}
                            onReload={onReload}
                            accentColor={accentColor}
                        />
                    ))
                ) : (
                    <div className="px-3 py-3 text-[11.5px] text-center border-b border-border-light text-text-tertiary">
                        No scales tracked for this plant yet.
                    </div>
                )}

                <div className="flex items-center gap-2.5 px-3 py-1.5">
                    <div className="w-4 shrink-0" />
                    <div className="w-6 shrink-0" />
                    <button
                        type="button"
                        onClick={() => setAddScaleModal(true)}
                        className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary"
                    >
                        <i className="fas fa-plus text-[9px]" />
                        Add scale
                    </button>
                </div>
            </section>

            {renewModal && (
                <LogRenewalModal
                    plant={plant}
                    onClose={() => setRenewModal(false)}
                    onSaved={() => {
                        setRenewModal(false)
                        onReload()
                    }}
                />
            )}
            {editModal && (
                <PlantFormModal
                    plant={plant}
                    regionPlants={regionPlants}
                    onClose={() => setEditModal(false)}
                    onSaved={() => {
                        setEditModal(false)
                        onReload()
                    }}
                />
            )}
            {addScaleModal && (
                <ScaleFormModal
                    defaultPlantId={plant.id}
                    nrmcaPlants={allPlants}
                    onClose={() => setAddScaleModal(false)}
                    onSaved={() => {
                        setAddScaleModal(false)
                        onReload()
                    }}
                />
            )}
        </>
    )
}
