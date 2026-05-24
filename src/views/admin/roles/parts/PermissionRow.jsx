import React from 'react'

import { getNamespace, NAMESPACE_COLORS, NAMESPACE_ICONS } from './permissionMeta'

/** Single permission row inside a role card. */
const PermissionRow = ({ permission, onRemove, hasITAccess, isSaving }) => {
    const ns = getNamespace(permission)
    const icon = NAMESPACE_ICONS[ns] || 'fa-key'
    const bgColor = NAMESPACE_COLORS[ns] || 'bg-slate-500'
    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 group transition-colors">
            <div className={`w-5 h-5 rounded ${bgColor} flex items-center justify-center shrink-0`}>
                <i className={`fas ${icon} text-white text-[8px]`} />
            </div>
            <span className="text-sm text-slate-700 flex-1 font-mono text-[13px]">{permission}</span>
            {hasITAccess && (
                <button
                    onClick={() => onRemove(permission)}
                    disabled={isSaving}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-text-primary hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer border-none bg-transparent shrink-0 disabled:opacity-30"
                    title="Remove permission"
                >
                    <i className="fas fa-times text-[10px]" />
                </button>
            )}
        </div>
    )
}

export default PermissionRow
