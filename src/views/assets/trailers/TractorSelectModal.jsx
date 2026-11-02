import React, { useState } from 'react'

import Badge from '../../../app/components/common/Badge'
import DialogListRow from '../../../app/components/common/DialogListRow'
import DialogSearchField from '../../../app/components/common/DialogSearchField'
import useDialogClose from '../../../app/components/common/useDialogClose'
import Dialog from '../../../app/components/ui/Dialog'

/**
 * Tractor picker for a trailer. The list is whatever the caller passes;
 * `assignedPlant` is shown as a caption above it and narrows nothing.
 *
 * A tractor already pulling another trailer is left out entirely, so a double
 * assignment cannot be made here. This trailer is excluded from that test, so
 * the tractor already on it stays selectable when the picker is reopened.
 * Read-only mode drops the exclusion and shows the whole roster.
 */
function TractorSelectModal({
    isOpen,
    onClose,
    onSelect,
    currentValue,
    trailers,
    assignedPlant,
    readOnly,
    tractors,
    onRefresh,
    trailerId
}) {
    const [searchText, setSearchText] = useState('')
    const [sortAvailableFirst, setSortAvailableFirst] = useState(true)
    const { anchorRef, handleClose } = useDialogClose(onClose)
    function isTractorAssigned(tractorId) {
        if (!tractorId || tractorId === '0' || !Array.isArray(trailers)) return false
        return trailers.some((trailer) => trailer.assignedTractor === tractorId && trailer.id !== trailerId)
    }
    const filteredTractors = (tractors || [])
        .filter(
            (tractor) =>
                tractor.id === currentValue ||
                searchText.trim() === '' ||
                (tractor.truckNumber && tractor.truckNumber.toLowerCase().includes(searchText.toLowerCase())) ||
                (tractor.assignedPlant && tractor.assignedPlant.toLowerCase().includes(searchText.toLowerCase()))
        )
        .sort((a, b) => {
            if (sortAvailableFirst) {
                const aAssigned = isTractorAssigned(a.id)
                const bAssigned = isTractorAssigned(b.id)
                if (!aAssigned && bAssigned) return -1
                if (aAssigned && !bAssigned) return 1
            }
            return (a.truckNumber || '').localeCompare(b.truckNumber || '')
        })
    if (!isOpen) return null
    const shownCount = filteredTractors.filter(
        (t) => readOnly || !isTractorAssigned(t.id) || t.id === currentValue
    ).length
    const noneSelected = currentValue === null || currentValue === '' || currentValue === '0'
    return (
        <Dialog
            open
            onClose={handleClose}
            size="md"
            tall
            eyebrow={assignedPlant ? `Plant ${assignedPlant}` : undefined}
            title="Select tractor"
            zClassName="z-system"
            bodyClassName="p-0"
            toolbar={
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogSearchField
                            autoFocus
                            className="min-w-[200px] flex-1"
                            label="Search tractors"
                            onChange={setSearchText}
                            placeholder="Search tractors"
                            type="search"
                            value={searchText}
                        />
                        <button
                            type="button"
                            aria-pressed={sortAvailableFirst}
                            className={`btn-secondary ${sortAvailableFirst ? 'bg-bg-tertiary' : ''}`}
                            onClick={() => setSortAvailableFirst(!sortAvailableFirst)}
                        >
                            Available first
                        </button>
                        <button
                            type="button"
                            aria-label="Refresh tractor list"
                            className="btn-secondary"
                            onClick={() => onRefresh && onRefresh()}
                        >
                            <i className="fas fa-sync text-[12px]" aria-hidden="true" />
                            Refresh
                        </button>
                    </div>
                    <div className="text-[12px] tabular-nums text-text-secondary">
                        {shownCount} tractor{shownCount !== 1 ? 's' : ''} found
                    </div>
                </div>
            }
            footer={
                <button type="button" className="btn-secondary" onClick={onClose}>
                    Cancel
                </button>
            }
        >
            <div ref={anchorRef} className="h-full">
                {filteredTractors.length === 0 ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-1 px-6 text-center">
                        <p className="m-0 text-[15px] font-medium text-text-primary">No tractors found</p>
                        <p className="m-0 text-[13px] text-text-secondary">Try adjusting your search.</p>
                        <div className="mt-4">
                            <button type="button" className="btn-secondary" onClick={() => setSearchText('')}>
                                Reset search
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogListRow
                            current={noneSelected}
                            title="None"
                            detail="Unassign tractor"
                            onClick={() => {
                                if (!readOnly) {
                                    onSelect('0')
                                    onClose()
                                }
                            }}
                        />
                        {filteredTractors.map((tractor) => {
                            const isAssigned = isTractorAssigned(tractor.id)
                            const isUnavailable = isAssigned && !readOnly
                            const isSelected = tractor.id === currentValue
                            if (isAssigned && !readOnly && tractor.id !== currentValue) return null
                            const detail = [
                                tractor.assignedPlant && `Plant ${tractor.assignedPlant}`,
                                isAssigned && 'Already assigned'
                            ]
                                .filter(Boolean)
                                .join(' · ')
                            return (
                                <DialogListRow
                                    key={tractor.id}
                                    current={isSelected}
                                    disabled={isUnavailable}
                                    title={`Tractor #${tractor.truckNumber || 'Unknown'}`}
                                    detail={detail}
                                    aside={
                                        tractor.status &&
                                        tractor.status !== 'Active' && <Badge tone="warning">{tractor.status}</Badge>
                                    }
                                    onClick={() => {
                                        if (readOnly || !isUnavailable) {
                                            onSelect(tractor.id)
                                            onClose()
                                        }
                                    }}
                                />
                            )
                        })}
                    </>
                )}
            </div>
        </Dialog>
    )
}
export default TractorSelectModal
