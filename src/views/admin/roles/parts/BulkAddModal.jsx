import React, { useState } from 'react'

import RoleModal, {
    RoleFormField,
    RoleModalBody,
    RoleModalFooter,
    RoleTextInput
} from '../../../../app/components/ui/RoleModal'

/** Modal for bulk-adding a permission to one or more roles. */
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

    const sortedRoles = [...roles].sort((a, b) => (b.weight || 0) - (a.weight || 0))
    const alreadyHave = sortedRoles.filter(
        (r) => permission.trim() && Array.isArray(r.permissions) && r.permissions.includes(permission.trim())
    )

    return (
        <RoleModal isOpen={isOpen} onClose={onClose} title="Bulk Add Permission">
            <RoleModalBody>
                <RoleFormField label="Permission Node">
                    <RoleTextInput
                        value={permission}
                        onChange={setPermission}
                        placeholder="e.g. reports.qc_strength"
                        autoFocus
                    />
                </RoleFormField>
                {permission.trim() && alreadyHave.length > 0 && (
                    <div className="text-xs text-slate-400 -mt-2 mb-2 px-1">
                        Already on: {alreadyHave.map((r) => r.name).join(', ')}
                    </div>
                )}
                <RoleFormField label="Add to Roles">
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={selectAll}
                            className="text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600 border-none cursor-pointer hover:bg-slate-200"
                        >
                            Select All
                        </button>
                        <button
                            onClick={selectNone}
                            className="text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600 border-none cursor-pointer hover:bg-slate-200"
                        >
                            Select None
                        </button>
                        <span className="text-[11px] text-slate-400 ml-auto">{selectedRoleIds.size} selected</span>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto border border-border-light rounded-lg">
                        {sortedRoles.map((role) => {
                            const isSelected = selectedRoleIds.has(role.id)
                            const alreadyHasIt =
                                permission.trim() &&
                                Array.isArray(role.permissions) &&
                                role.permissions.includes(permission.trim())
                            return (
                                <label
                                    key={role.id}
                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-border-light last:border-b-0 ${
                                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                    } ${alreadyHasIt ? 'opacity-40' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleRole(role.id)}
                                        disabled={alreadyHasIt}
                                        className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-slate-800">{role.name}</span>
                                        <span className="text-xs text-slate-400 ml-2">w:{role.weight || 0}</span>
                                    </div>
                                    {alreadyHasIt && (
                                        <span className="text-[10px] text-slate-400 shrink-0">already has</span>
                                    )}
                                </label>
                            )
                        })}
                    </div>
                </RoleFormField>
            </RoleModalBody>
            <RoleModalFooter
                onCancel={onClose}
                onSubmit={handleSubmit}
                submitText={`Add to ${selectedRoleIds.size} Role${selectedRoleIds.size !== 1 ? 's' : ''}`}
                loadingText="Adding..."
                isLoading={saving}
                disabled={!permission.trim() || selectedRoleIds.size === 0}
            />
        </RoleModal>
    )
}

export default BulkAddModal
