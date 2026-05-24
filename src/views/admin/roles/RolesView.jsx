import React, { useCallback, useEffect, useMemo, useState } from 'react'

import TopSection from '../../../app/components/sections/TopSection'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useRolesData } from '../../../app/hooks/useRolesData'
import BulkAddModal from './parts/BulkAddModal'
import CreateRoleModal from './parts/CreateRoleModal'
import EditWeightModal from './parts/EditWeightModal'
import RoleCard from './parts/RoleCard'
import RolesLoadingSkeleton from './parts/RolesLoadingSkeleton'
import { useRolePermissionHandlers } from './parts/useRolePermissionHandlers'

const ELEVATED_WEIGHT_THRESHOLD = 75
const DEFAULT_ACCENT_COLOR = '#1e3a5f'

function RolesView() {
    const {
        bulkAddPermissions,
        createRole,
        error,
        hasITAccess,
        isLoading,
        loadData,
        message,
        removePermissionFromAllRoles: _removePermissionFromAllRoles,
        removePermissionFromRole: _removePermissionFromRole,
        roles,
        setError,
        updateRolePermissions,
        updateRoleWeight
    } = useRolesData()
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || DEFAULT_ACCENT_COLOR
    const [searchQuery, setSearchQuery] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showBulkAddModal, setShowBulkAddModal] = useState(false)
    const [editingWeightRole, setEditingWeightRole] = useState(null)
    const [expandedRoleId, setExpandedRoleId] = useState(null)

    useEffect(() => {
        loadData()
    }, [loadData])

    const sortedRoles = useMemo(() => {
        let filtered = [...roles].sort((a, b) => (b.weight || 0) - (a.weight || 0))
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase()
            filtered = filtered.filter((r) => {
                const perms = Array.isArray(r.permissions) ? r.permissions : []
                return r.name.toLowerCase().includes(q) || perms.some((p) => p.toLowerCase().includes(q))
            })
        }
        return filtered
    }, [roles, searchQuery])

    const totalPermissions = useMemo(() => {
        const permSet = new Set()
        for (const role of roles) {
            if (Array.isArray(role.permissions)) {
                for (const p of role.permissions) permSet.add(p)
            }
        }
        return permSet.size
    }, [roles])

    /** Number of roles whose weight crosses the elevated threshold (> 75). */
    const elevatedCount = useMemo(
        () => roles.filter((r) => (r.weight || 0) > ELEVATED_WEIGHT_THRESHOLD).length,
        [roles]
    )

    const { savingPerms, handleRemovePermission, handleAddPermission, handlePastePermissions } =
        useRolePermissionHandlers({ hasITAccess, roles, setError, updateRolePermissions })

    const handleCreateRole = useCallback(
        async (name, weight) => {
            try {
                await createRole(name, weight)
            } catch (err) {
                setError(`Failed to create role: ${err.message}`)
            }
        },
        [createRole, setError]
    )

    const handleSaveWeight = useCallback(
        async (roleId, weight) => {
            try {
                await updateRoleWeight(roleId, weight)
            } catch (err) {
                setError(`Failed to update weight: ${err.message}`)
            }
        },
        [updateRoleWeight, setError]
    )

    const handleBulkAdd = useCallback(
        async (roleIds, permission) => {
            try {
                await bulkAddPermissions(roleIds, permission)
            } catch (err) {
                setError(`Bulk add failed: ${err.message}`)
            }
        },
        [bulkAddPermissions, setError]
    )

    const badge = `${roles.length} Roles · ${totalPermissions} Permissions · ${elevatedCount} Elevated`

    if (isLoading && roles.length === 0) return <RolesLoadingSkeleton />

    return (
        <div className="min-h-screen bg-slate-50 pb-16">
            <TopSection
                title="Roles & Permissions"
                badge={badge}
                hideViewModeToggle
                hidePlantFilter
                sticky
                searchPlaceholder="Search roles or permissions..."
                searchInput={searchQuery}
                onSearchInputChange={setSearchQuery}
                onClearSearch={() => setSearchQuery('')}
                addButtonLabel={hasITAccess ? 'New Role' : undefined}
                onAddClick={hasITAccess ? () => setShowCreateModal(true) : undefined}
                customActions={
                    hasITAccess ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBulkAddModal(true)}
                                className="flex items-center gap-2 border-none rounded-xl text-sm font-semibold px-5 py-3 cursor-pointer transition-all bg-slate-100 text-slate-600 hover:bg-slate-200"
                            >
                                <i className="fas fa-layer-group" />
                                Bulk Add
                            </button>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-text-primary rounded-lg text-xs font-semibold">
                                <i className="fas fa-shield-alt text-[10px]" />
                                IT Access
                            </div>
                        </div>
                    ) : null
                }
            />

            <div className="px-3 py-4 sm:px-4 md:px-6 lg:px-8">
                {/* Alerts */}
                {message && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-text-primary text-sm">
                        <i className="fas fa-check-circle shrink-0" />
                        {message}
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-text-primary text-sm">
                        <i className="fas fa-exclamation-circle shrink-0" />
                        {error}
                    </div>
                )}

                {/* Role cards */}
                <div className="space-y-3">
                    {sortedRoles.map((role) => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            isExpanded={expandedRoleId === role.id}
                            onToggle={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
                            hasITAccess={hasITAccess}
                            accentColor={accentColor}
                            onRemovePermission={handleRemovePermission}
                            onAddPermission={handleAddPermission}
                            onPastePermissions={handlePastePermissions}
                            onEditWeight={setEditingWeightRole}
                            savingPerms={savingPerms}
                        />
                    ))}
                    {sortedRoles.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white border border-border-light rounded">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                <i className="fas fa-shield-alt text-3xl text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">No Roles Found</h3>
                            <p className="text-slate-500 max-w-md">
                                {searchQuery ? 'No roles match your search.' : 'There are no roles in the system yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <CreateRoleModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreateRole}
            />
            <EditWeightModal
                role={editingWeightRole}
                onClose={() => setEditingWeightRole(null)}
                onSave={handleSaveWeight}
            />
            <BulkAddModal
                isOpen={showBulkAddModal}
                onClose={() => setShowBulkAddModal(false)}
                roles={roles}
                accentColor={accentColor}
                onBulkAdd={handleBulkAdd}
            />
        </div>
    )
}

export default RolesView
