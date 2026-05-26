/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { getNamespace, NAMESPACE_ICONS } from './permissionMeta'
import PermissionRow from './PermissionRow'

const PASTE_STATUS_TIMEOUT_MS = 2000
const COPY_STATUS_TIMEOUT_MS = 1500
const ELEVATED_WEIGHT_THRESHOLD = 75

/** Expandable role card showing name, weight, permission count, and permission list. */
const RoleCard = ({
    role,
    isExpanded,
    onToggle,
    hasITAccess,
    accentColor,
    onRemovePermission,
    onAddPermission,
    onPastePermissions,
    onEditWeight,
    savingPerms
}) => {
    const [addingPerm, setAddingPerm] = useState(false)
    const [newPerm, setNewPerm] = useState('')
    const [copied, setCopied] = useState(false)
    const [pasteStatus, setPasteStatus] = useState(null)
    const permissions = Array.isArray(role.permissions) ? [...role.permissions].sort() : []
    const namespaces = [...new Set(permissions.map(getNamespace))].sort()
    const isElevated = (role.weight || 0) > ELEVATED_WEIGHT_THRESHOLD

    const handleAddPerm = () => {
        const trimmed = newPerm.trim()
        if (!trimmed) return
        onAddPermission(role.id, trimmed)
        setNewPerm('')
        setAddingPerm(false)
    }

    const handlePastePermissions = async () => {
        try {
            const text = await navigator.clipboard.readText()
            const incoming = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            if (incoming.length === 0) {
                setPasteStatus({ text: 'Clipboard is empty', type: 'error' })
                setTimeout(() => setPasteStatus(null), PASTE_STATUS_TIMEOUT_MS)
                return
            }
            const existing = new Set(permissions)
            const toAdd = incoming.filter((p) => !existing.has(p))
            if (toAdd.length === 0) {
                setPasteStatus({ text: 'Already has all', type: 'info' })
                setTimeout(() => setPasteStatus(null), PASTE_STATUS_TIMEOUT_MS)
                return
            }
            await onPastePermissions(role.id, [...permissions, ...toAdd])
            setPasteStatus({ text: `Added ${toAdd.length}`, type: 'success' })
            setTimeout(() => setPasteStatus(null), PASTE_STATUS_TIMEOUT_MS)
        } catch {
            setPasteStatus({ text: 'Paste failed', type: 'error' })
            setTimeout(() => setPasteStatus(null), PASTE_STATUS_TIMEOUT_MS)
        }
    }

    const handleCopyPermissions = async () => {
        if (permissions.length === 0) return
        try {
            await navigator.clipboard.writeText(permissions.join('\n'))
            setCopied(true)
            setTimeout(() => setCopied(false), COPY_STATUS_TIMEOUT_MS)
        } catch {
            const textarea = document.createElement('textarea')
            textarea.value = permissions.join('\n')
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopied(true)
            setTimeout(() => setCopied(false), COPY_STATUS_TIMEOUT_MS)
        }
    }

    return (
        <div className="overflow-hidden rounded border border-border-light bg-bg-primary shadow-sm transition-all duration-200 hover:shadow-lg">
            {/* Header — asset-card visual rhythm: 40x40 accent icon + bold name + stat pills + chevron. */}
            <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50"
                onClick={onToggle}
            >
                <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white text-lg flex-shrink-0"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-shield-alt" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-extrabold tracking-tight truncate text-text-primary">
                            {role.name}
                        </span>
                        {isElevated && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-text-primary">
                                Elevated
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                            <i className="fas fa-balance-scale text-[9px]" />
                            <span className="font-mono tabular-nums">{role.weight || 0}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-teal-50 text-text-primary">
                            <span className="font-mono tabular-nums">{permissions.length}</span>
                            <span>perms</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-50 text-text-primary">
                            <span className="font-mono tabular-nums">{namespaces.length}</span>
                            <span>namespaces</span>
                        </span>
                    </div>
                </div>
                <i
                    className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-300 text-xs transition-transform`}
                />
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div className="border-t border-border-light">
                    {/* Actions bar */}
                    <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-border-light">
                        {hasITAccess && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setAddingPerm(true)
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer transition-colors"
                                    style={{ background: `${accentColor}15`, color: accentColor }}
                                >
                                    <i className="fas fa-plus text-[9px]" />
                                    Add Permission
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEditWeight(role)
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600 border-none cursor-pointer hover:bg-slate-300 transition-colors"
                                >
                                    <i className="fas fa-balance-scale text-[9px]" />
                                    Edit Weight
                                </button>
                            </>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                            {pasteStatus && (
                                <span className="text-[11px] font-semibold text-text-primary">{pasteStatus.text}</span>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyPermissions()
                                }}
                                disabled={permissions.length === 0}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600 border-none cursor-pointer hover:bg-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Copy all permission nodes — one per line"
                            >
                                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[9px]`} />
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                            {hasITAccess && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handlePastePermissions()
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-tertiary text-text-secondary border-none cursor-pointer outline-none hover:bg-bg-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors duration-150"
                                    title="Paste permissions from clipboard — merges with existing"
                                >
                                    <i className="fas fa-paste text-[9px]" />
                                    Paste
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Add permission inline */}
                    {addingPerm && (
                        <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-blue-100">
                            <input
                                type="text"
                                value={newPerm}
                                onChange={(e) => setNewPerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPerm()}
                                placeholder="e.g. reports.qc_strength"
                                autoFocus
                                className="flex-1 bg-bg-primary border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 hover:border-border-medium focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                            />
                            <button
                                onClick={handleAddPerm}
                                disabled={!newPerm.trim()}
                                className="px-3 py-2 rounded-lg text-xs font-semibold text-white border-none cursor-pointer disabled:opacity-40"
                                style={{ background: accentColor }}
                            >
                                Add
                            </button>
                            <button
                                onClick={() => {
                                    setAddingPerm(false)
                                    setNewPerm('')
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-bg-tertiary text-text-secondary border-none cursor-pointer outline-none hover:bg-bg-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors duration-150"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Permissions grouped by namespace */}
                    <div className="px-4 py-3">
                        {permissions.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                <i className="fas fa-lock text-2xl mb-2 block" />
                                No permissions assigned
                            </div>
                        ) : (
                            namespaces.map((ns) => {
                                const nsPerms = permissions.filter((p) => getNamespace(p) === ns)
                                const icon = NAMESPACE_ICONS[ns] || 'fa-key'
                                return (
                                    <div key={ns} className="mb-3 last:mb-0">
                                        <div className="flex items-center gap-2 px-1 mb-1">
                                            <i className={`fas ${icon} text-[10px] text-slate-400`} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                {ns}
                                            </span>
                                            <span className="text-[10px] text-slate-300">{nsPerms.length}</span>
                                        </div>
                                        {nsPerms.map((perm) => (
                                            <PermissionRow
                                                key={perm}
                                                permission={perm}
                                                hasITAccess={hasITAccess}
                                                isSaving={savingPerms.has(`${role.id}:${perm}`)}
                                                onRemove={(p) => onRemovePermission(role.id, p)}
                                            />
                                        ))}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default RoleCard
