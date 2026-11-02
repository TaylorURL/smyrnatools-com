import React, { useState } from 'react'

import RoleModal, { RoleFormField, RoleModalFooter, RoleTextInput } from '../../../../app/components/ui/RoleModal'

const LINK_BUTTON =
    'cursor-pointer border-none bg-transparent p-0 text-[12px] font-medium text-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Adds one permission node to any number of roles at once. The node goes
 *  in the field above the list; a role that already carries it is shown
 *  greyed and cannot be selected. */
const BulkAddModal = ({ isOpen, onClose, roles, onBulkAdd, accentColor: _accentColor }) => {
    const [permission, setPermission] = useState('')
    const [selectedRoleIds, setSelectedRoleIds] = useState(new Set())
    const [saving, setSaving] = useState(false)

    const toggleRole = (id) => {
        setSelectedRoleIds((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const selectAll = () => {
        setSelectedRoleIds(new Set(roles.map((r) => r.id)))
    }

    const selectNone = () => {
        setSelectedRoleIds(new Set())
    }

    const handleSubmit = async () => {
        if (!permission.trim() || selectedRoleIds.size === 0) return
        setSaving(true)
        await onBulkAdd(selectedRoleIds, permission.trim())
        setSaving(false)
        setPermission('')
        setSelectedRoleIds(new Set())
        onClose()
    }

    if (!isOpen) return null

    const node = permission.trim()
    const sortedRoles = [...roles].sort((a, b) => (b.weight || 0) - (a.weight || 0))
    const alreadyHave = sortedRoles.filter((r) => node && Array.isArray(r.permissions) && r.permissions.includes(node))

    return (
        <RoleModal
            isOpen={isOpen}
            onClose={onClose}
            title="Add permission to roles"
            bodyClassName="p-0"
            toolbar={
                <div className="flex flex-col gap-4">
                    <RoleFormField
                        label="Permission node"
                        hint={
                            node && alreadyHave.length > 0
                                ? `Already on ${alreadyHave.map((r) => r.name).join(', ')}`
                                : undefined
                        }
                    >
                        <RoleTextInput
                            value={permission}
                            onChange={setPermission}
                            placeholder="e.g. reports.qc_strength"
                            autoFocus
                        />
                    </RoleFormField>
                    <div className="flex items-center gap-4 text-[12px]">
                        <span className="font-medium text-text-secondary">Roles</span>
                        <button type="button" onClick={selectAll} className={LINK_BUTTON}>
                            Select all
                        </button>
                        <button type="button" onClick={selectNone} className={LINK_BUTTON}>
                            Select none
                        </button>
                        <span className="ml-auto tabular-nums text-text-secondary">
                            {selectedRoleIds.size} selected
                        </span>
                    </div>
                </div>
            }
        >
            {sortedRoles.length === 0 ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center gap-1 px-6 text-center">
                    <p className="m-0 text-[15px] font-medium text-text-primary">No roles yet</p>
                    <p className="m-0 text-[13px] text-text-secondary">Create a role first, then add permissions.</p>
                </div>
            ) : (
                <div role="group" aria-label="Roles">
                    {sortedRoles.map((role) => {
                        const isSelected = selectedRoleIds.has(role.id)
                        const alreadyHasIt = node && Array.isArray(role.permissions) && role.permissions.includes(node)
                        return (
                            <label
                                key={role.id}
                                className={`flex items-center gap-3 border-b border-border-light px-6 py-2.5 text-[13px] transition-colors duration-150 ${
                                    alreadyHasIt
                                        ? 'cursor-not-allowed opacity-50'
                                        : isSelected
                                          ? 'cursor-pointer bg-bg-tertiary font-medium'
                                          : 'cursor-pointer hover:bg-bg-hover'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleRole(role.id)}
                                    disabled={alreadyHasIt}
                                    className="h-4 w-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
                                />
                                <span className="min-w-0 flex-1 truncate text-text-primary">{role.name}</span>
                                {alreadyHasIt && (
                                    <span className="shrink-0 text-[12px] font-normal text-text-tertiary">
                                        Already has it
                                    </span>
                                )}
                                <span className="shrink-0 text-[12px] font-normal tabular-nums text-text-tertiary">
                                    Weight {role.weight || 0}
                                </span>
                            </label>
                        )
                    })}
                </div>
            )}
            <RoleModalFooter
                onCancel={onClose}
                onSubmit={handleSubmit}
                submitText={`Add to ${selectedRoleIds.size} role${selectedRoleIds.size !== 1 ? 's' : ''}`}
                loadingText="Adding…"
                isLoading={saving}
                disabled={!permission.trim() || selectedRoleIds.size === 0}
            />
        </RoleModal>
    )
}

export default BulkAddModal
