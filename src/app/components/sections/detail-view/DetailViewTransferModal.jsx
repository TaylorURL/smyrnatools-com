import React, { useCallback, useEffect, useRef } from 'react'

import { DETAIL_SELECT_CLS } from '../../../constants/detailFormClasses'
import Dialog, { DialogField } from '../../ui/Dialog'

/**
 * Moves the open asset to a plant in another region: pick the region, then
 * a plant in it. The current region is the line under the title.
 */
export default function DetailViewTransferModal({
    accent: _accent,
    assetType,
    closeTransfer,
    currentRegion,
    doTransfer,
    plants,
    regions,
    setTargetPlant,
    setTargetRegion,
    show,
    targetPlant,
    targetRegion,
    transferErr,
    transferring
}) {
    // `closeTransfer` is rebuilt on every render of the record page, and
    // picking a region re-renders it. The dialog re-runs its focus handling
    // whenever `onClose` changes, so it gets one stable close instead.
    const closeRef = useRef(closeTransfer)
    useEffect(() => {
        closeRef.current = closeTransfer
    })
    const handleClose = useCallback(() => closeRef.current?.(), [])

    const canTransfer = !transferring && targetRegion && targetPlant
    return (
        <Dialog
            open={show}
            onClose={handleClose}
            size="md"
            title="Transfer to another region"
            description={`Current region: ${currentRegion || 'Unknown'}`}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={handleClose} disabled={transferring}>
                        Cancel
                    </button>
                    <button type="button" className="btn-primary" onClick={doTransfer} disabled={!canTransfer}>
                        {transferring && <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />}
                        {transferring ? 'Transferring…' : 'Transfer'}
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <DialogField label="Target region" htmlFor="transfer-target-region">
                    <select
                        id="transfer-target-region"
                        aria-label="Target region"
                        className={DETAIL_SELECT_CLS}
                        value={targetRegion}
                        onChange={(e) => setTargetRegion(e.target.value)}
                        disabled={transferring}
                    >
                        <option value="">Select a region</option>
                        {/* Office regions own no plants to land in, and an
                            Aggregate region has no work for a mixer, so
                            neither is offered as a destination. */}
                        {regions
                            .filter(
                                (r) =>
                                    r.regionCode !== currentRegion &&
                                    r.type !== 'Office' &&
                                    !(assetType === 'mixer' && r.type === 'Aggregate')
                            )
                            .map((r) => (
                                <option key={r.regionCode} value={r.regionCode}>
                                    {r.regionName}
                                </option>
                            ))}
                    </select>
                </DialogField>
                {targetRegion && (
                    <DialogField label="Target plant" htmlFor="transfer-target-plant">
                        <select
                            id="transfer-target-plant"
                            aria-label="Target plant"
                            className={DETAIL_SELECT_CLS}
                            value={targetPlant}
                            onChange={(e) => setTargetPlant(e.target.value)}
                            disabled={transferring || !plants.length}
                        >
                            <option value="">Select a plant</option>
                            {plants.map((p) => (
                                <option key={p.plantCode || p.plant_code} value={p.plantCode || p.plant_code}>
                                    {p.plantName || p.plant_name}
                                </option>
                            ))}
                        </select>
                    </DialogField>
                )}
                {transferErr && (
                    <div
                        role="alert"
                        className="rounded-[4px] border border-[color:var(--notice-danger-border)] bg-[color:var(--notice-danger-bg)] px-3 py-2 text-[13px] text-[color:var(--notice-danger-strong)]"
                    >
                        {transferErr}
                    </div>
                )}
            </div>
        </Dialog>
    )
}
