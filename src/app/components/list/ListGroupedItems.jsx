/* eslint-disable react/forbid-dom-props */
import React from 'react'

import ListItemRow from './ListItemRow'

/** Returns true when the active status filter should hide this group entirely. */
function isGroupHiddenByStatusFilter(statusFilter, groupKey) {
    if (statusFilter === 'completed' && groupKey !== 'completed') return true
    if (statusFilter === 'pending' && groupKey === 'completed') return true
    if (statusFilter === 'overdue' && groupKey !== 'overdue') return true
    return false
}

/**
 * Renders one card per non-empty group, each containing a header with the
 * group icon/label/count followed by ListItemRow entries. Honors the active
 * statusFilter to suppress groups that don't match the current chip.
 */
export default function ListGroupedItems({
    accentColor,
    groupedItems,
    isMobile,
    onSelectItem,
    onToggleSelect,
    selectedIds,
    statusFilter
}) {
    return (
        <div className={`flex flex-col gap-3 w-full ${isMobile ? 'pb-4' : 'pb-6'}`}>
            {Object.entries(groupedItems).map(([key, group]) => {
                if (!group.items.length) return null
                if (isGroupHiddenByStatusFilter(statusFilter, key)) return null
                return (
                    <div key={key} className="bg-bg-primary border border-border-light overflow-hidden rounded">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-light bg-bg-tertiary">
                            <i className={`fas ${group.icon} text-[10px]`} style={{ color: accentColor }} />
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-secondary">
                                {group.label}
                            </span>
                            <span
                                className="inline-flex items-center justify-center rounded text-[9px] font-bold tabular-nums px-1 min-w-[16px] h-3.5"
                                style={{ background: `${accentColor}14`, color: accentColor }}
                            >
                                {group.items.length}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            {group.items.map((item) => (
                                <ListItemRow
                                    key={item.id}
                                    accentColor={accentColor}
                                    isMobile={isMobile}
                                    isSelected={selectedIds.has(item.id)}
                                    item={item}
                                    onSelectItem={onSelectItem}
                                    onToggleSelect={onToggleSelect}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
