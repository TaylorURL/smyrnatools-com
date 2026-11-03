import React, { useEffect, useState } from 'react'

import DialogListRow from '../../../app/components/common/DialogListRow'
import DialogSearchField from '../../../app/components/common/DialogSearchField'
import useDialogClose from '../../../app/components/common/useDialogClose'
import Dialog from '../../../app/components/ui/Dialog'

/**
 * Operator picker for a mixer or a tractor, scoped to that asset's plant.
 * `assets` is the roster of the same kind (every mixer, or every tractor) and
 * `assetLabel` names one of them ("mixer") for the no-plant notice.
 *
 * An operator already driving another active asset is left out of the list
 * entirely, so a double assignment cannot be made here; one who is merely
 * inactive is shown and marked unavailable. Read-only mode drops the
 * exclusion, since nothing can be picked and the roster is what a reader
 * wants to see. The operator already assigned to this asset always appears,
 * whatever the filters say. Unassigning is the detail card's Unassign button,
 * which also sets the status and offers an undo, so there is no "None" row.
 */
function OperatorSelectModal({
    isOpen,
    onClose,
    onSelect,
    currentValue,
    assets = [],
    assetLabel = 'asset',
    assignedPlant = '',
    readOnly = false,
    operators,
    onRefresh
}) {
    const [searchText, setSearchText] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [, setFilterPlant] = useState(assignedPlant)
    const [filterPosition, setFilterPosition] = useState('')
    const [sortAvailableFirst, setSortAvailableFirst] = useState(true)
    const { anchorRef, handleClose } = useDialogClose(onClose)
    useEffect(() => {
        if (assignedPlant) setFilterPlant(assignedPlant)
    }, [assignedPlant])
    /** Returns true if the operator is already assigned to an active asset (prevents double-assignment). */
    function isOperatorAssigned(operatorId) {
        if (!operatorId || operatorId === '0' || !Array.isArray(assets)) return false
        return assets.some((asset) => asset.assignedOperator === operatorId && asset.status === 'Active')
    }
    // The list gives way to the loading line while a refresh is in flight,
    // the same way the tractor picker does.
    async function handleRefresh() {
        if (!onRefresh) return
        setIsLoading(true)
        try {
            await onRefresh()
        } finally {
            setIsLoading(false)
        }
    }
    const filteredOperators = operators
        .filter(
            (operator) =>
                operator.employeeId === currentValue ||
                ((searchText.trim() === '' ||
                    operator.name.toLowerCase().includes(searchText.toLowerCase()) ||
                    (operator.smyrnaId && operator.smyrnaId.toLowerCase().includes(searchText.toLowerCase())) ||
                    operator.employeeId.toLowerCase().includes(searchText.toLowerCase())) &&
                    (!filterPosition || operator.position === filterPosition) &&
                    operator.plantCode === assignedPlant)
        )
        .sort((a, b) => {
            if (sortAvailableFirst) {
                const aAssigned = isOperatorAssigned(a.employeeId) || a.status !== 'Active'
                const bAssigned = isOperatorAssigned(b.employeeId) || b.status !== 'Active'
                if (!aAssigned && bAssigned) return -1
                if (aAssigned && !bAssigned) return 1
            }
            return a.name.localeCompare(b.name)
        })
    if (!isOpen) return null
    const shownCount = filteredOperators.filter(
        (op) => readOnly || !isOperatorAssigned(op.employeeId) || op.employeeId === currentValue
    ).length
    return (
        <Dialog
            open
            onClose={handleClose}
            size="md"
            tall
            eyebrow={assignedPlant ? `Plant ${assignedPlant}` : undefined}
            title="Select operator"
            zClassName="z-system"
            bodyClassName="p-0"
            toolbar={
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogSearchField
                            autoFocus
                            className="min-w-[200px] flex-1"
                            label="Search operators"
                            onChange={setSearchText}
                            placeholder="Search operators"
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
                            aria-label="Refresh operator list"
                            className="btn-secondary"
                            disabled={isLoading}
                            onClick={handleRefresh}
                        >
                            <i className="fas fa-sync text-[12px]" aria-hidden="true" />
                            Refresh
                        </button>
                    </div>
                    <div className="text-[12px] tabular-nums text-text-secondary">
                        {shownCount} operator{shownCount !== 1 ? 's' : ''} found
                    </div>
                    {!assignedPlant && (
                        <div className="rounded-[4px] border border-[color:var(--notice-warning-border)] bg-[color:var(--notice-warning-bg)] px-3 py-2 text-[13px] text-[color:var(--notice-warning-strong)]">
                            No plant selected. Give this {assetLabel} a plant to see its operators.
                        </div>
                    )}
                </div>
            }
        >
            <div ref={anchorRef} className="h-full">
                {isLoading ? (
                    <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-[13px] text-text-secondary">
                        <i className="fas fa-spinner fa-spin text-[13px]" aria-hidden="true" />
                        Loading operators
                    </div>
                ) : shownCount === 0 ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-1 px-6 text-center">
                        <p className="m-0 text-[15px] font-medium text-text-primary">
                            {assignedPlant ? `No operators found at plant ${assignedPlant}` : 'No plant selected'}
                        </p>
                        <p className="m-0 text-[13px] text-text-secondary">
                            {assignedPlant
                                ? 'Add operators with this plant code in the Operators section.'
                                : 'Select a plant first.'}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setFilterPosition('')
                                    setSearchText('')
                                }}
                            >
                                Reset search
                            </button>
                            <a
                                href="/operators/add"
                                className="btn-primary no-underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <i className="fas fa-plus text-[12px]" aria-hidden="true" />
                                Add operator
                            </a>
                        </div>
                    </div>
                ) : (
                    filteredOperators.map((operator) => {
                        const isAssigned = isOperatorAssigned(operator.employeeId)
                        const isInactive = operator.status !== 'Active'
                        const isUnavailable = (isAssigned && !readOnly) || isInactive
                        const isSelected = operator.employeeId === currentValue
                        if (isAssigned && !readOnly && operator.employeeId !== currentValue) return null
                        const detail = [
                            operator.position || 'No position',
                            operator.plantCode && `Plant ${operator.plantCode}`,
                            isInactive && operator.status,
                            isAssigned && operator.status === 'Active' && 'Already assigned'
                        ]
                            .filter(Boolean)
                            .join(' · ')
                        return (
                            <DialogListRow
                                key={operator.employeeId}
                                current={isSelected}
                                disabled={!readOnly && isUnavailable}
                                title={operator.name}
                                detail={detail}
                                aside={
                                    operator.smyrnaId && (
                                        <span className="font-mono text-[12px] tabular-nums text-text-tertiary">
                                            {operator.smyrnaId}
                                        </span>
                                    )
                                }
                                onClick={() => {
                                    if (readOnly || !isUnavailable) {
                                        onSelect(operator.employeeId)
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
export default OperatorSelectModal
