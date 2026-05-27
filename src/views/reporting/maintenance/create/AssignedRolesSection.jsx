/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../../app/components/common/Badge'
import { SECTION_LABEL_CLASS } from '../../../../app/constants/maintenanceCreateConstants'
import { Card, CardHeader, Chip, ErrorText } from './atoms'

export function AssignedRolesSection({
    accentColor,
    assignedRoles,
    availableRoles,
    errors,
    setShowRoleSelector,
    showRoleSelector,
    toggleRole
}) {
    return (
        <Card>
            <CardHeader
                accentColor={accentColor}
                icon="fa-user-shield"
                title="Assigned Roles"
                description="Pick which roles are responsible for this form"
                required
            />
            <div className="px-4 py-3 flex flex-col gap-2">
                {errors.assignment && <ErrorText>{errors.assignment}</ErrorText>}
                <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                    <button
                        type="button"
                        onClick={() => setShowRoleSelector((v) => !v)}
                        className="flex w-full items-center justify-between px-3 py-2 cursor-pointer border-none transition-colors hover:bg-bg-tertiary bg-bg-secondary"
                    >
                        <div className="flex items-center gap-2">
                            <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Roles
                            </span>
                            <Badge tone="neutral" size="xs" weight="bold" className="font-mono tabular-nums">
                                {assignedRoles.length} selected
                            </Badge>
                        </div>
                        <i
                            className={`fas fa-chevron-${showRoleSelector ? 'up' : 'down'} text-[10px] text-text-tertiary`}
                        />
                    </button>
                    {showRoleSelector && (
                        <div className="max-h-60 overflow-y-auto">
                            {availableRoles.length === 0 ? (
                                <div className="text-center py-4 text-[12px] text-text-tertiary">
                                    No roles available
                                </div>
                            ) : (
                                availableRoles.map((role, idx) => (
                                    <label
                                        key={role.id}
                                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary"
                                        style={{
                                            borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={assignedRoles.includes(role.id)}
                                            onChange={() => toggleRole(role.id)}
                                            className="w-3.5 h-3.5 cursor-pointer"
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[12px] font-semibold truncate text-text-primary">
                                                {role.name}
                                            </span>
                                            {role.description && (
                                                <span className="text-[10.5px] truncate text-text-secondary">
                                                    {role.description}
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    )}
                    {assignedRoles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-bg-secondary border-t border-border-light">
                            {assignedRoles.map((roleId) => {
                                const role = availableRoles.find((r) => r.id === roleId)
                                return role ? (
                                    <Chip key={roleId} accentColor={accentColor} onRemove={() => toggleRole(roleId)}>
                                        {role.name}
                                    </Chip>
                                ) : null
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
}
