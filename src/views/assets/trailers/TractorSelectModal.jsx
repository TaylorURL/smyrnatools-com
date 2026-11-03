import React, { useState } from 'react'

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
 * Read-only mode drops the exclusion and shows the whole roster. As in the
 * operator picker, a status other than Active is part of the row's detail
 * line, and unassigning is the detail card's Unassign button (which also sets
 * the status and offers an undo), so there is no "None" row.
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
    const [isLoading, setIsLoading] = useState(false)
    const { anchorRef, handleClose } = useDialogClose(onClose)
    function isTractorAssigned(tractorId) {
        if (!tractorId || tractorId === '0' || !Array.isArray(trailers)) return false
        return trailers.some((trailer) => trailer.assignedTractor === tractorId && trailer.id !== trailerId)
    }
    // The list gives way to the loading line while a refresh is in flight,
    // the same way the operator picker does.
    async function handleRefresh() {
        if (!onRefresh) return
        setIsLoading(true)
        try {
            await onRefresh()
        } finally {
            setIsLoading(false)
        }
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
                            disabled={isLoading}
                            onClick={handleRefresh}
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
        >
            <div ref={anchorRef} className="h-full">
                {isLoading ? (
                    <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-[13px] text-text-secondary">
                        <i className="fas fa-spinner fa-spin text-[13px]" aria-hidden="true" />
                        Loading tractors
                    </div>
                ) : shownCount === 0 ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-1 px-6 text-center">
                        <p className="m-0 text-[15px] font-medium text-text-primary">No tractors found</p>
                        <p className="m-0 text-[13px] text-text-secondary">Try adjusting your search.</p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <button type="button" className="btn-secondary" onClick={() => setSearchText('')}>
                                Reset search
                            </button>
                        </div>
                    </div>
                ) : (
                    filteredTractors.map((tractor) => {
                        const isAssigned = isTractorAssigned(tractor.id)
                        const isUnavailable = isAssigned && !readOnly
                        const isSelected = tractor.id === currentValue
                        if (isAssigned && !readOnly && tractor.id !== currentValue) return null
                        const detail = [
                            tractor.assignedPlant && `Plant ${tractor.assignedPlant}`,
                            tractor.status && tractor.status !== 'Active' && tractor.status,
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
                                onClick={() => {
                                    if (readOnly || !isUnavailable) {
                                        onSelect(tractor.id)
                                        onClose()
                                    }
                                }}
                            />
                        )
                    })
                )}
            </div>
        </Dialog>
    )
}
export default TractorSelectModal
