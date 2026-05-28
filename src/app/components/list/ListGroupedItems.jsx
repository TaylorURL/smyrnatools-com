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
 * Renders one card per non-empty group, each containing a header with an
 * icon pill + sentence-case label + count chip, followed by ListItemRow
 * entries. Honors the active statusFilter to suppress groups that don't
 * match the current chip.
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
        <div className={`flex w-full flex-col gap-3 ${isMobile ? 'pb-4' : 'pb-8'}`}>
            {Object.entries(groupedItems).map(([key, group]) => {
                if (!group.items.length) return null
                if (isGroupHiddenByStatusFilter(statusFilter, key)) return null
                return (
                    <section key={key} className="overflow-hidden rounded-xl border border-border-light bg-bg-primary">
                        <header className="flex items-center gap-2.5 border-b border-border-light bg-bg-secondary px-3.5 py-2">
                            <span
                                className="flex h-6 w-6 items-center justify-center rounded-md"
                                style={{
                                    background: `${accentColor}1a`,
                                    color: accentColor
                                }}
                            >
                                <i className={`fas ${group.icon} text-[11px]`} aria-hidden="true" />
                            </span>
                            <h3 className="m-0 text-[13px] font-semibold tracking-tight text-text-primary">
                                {group.label}
                            </h3>
                            <span
                                className="ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums"
                                style={{ background: `${accentColor}14`, color: accentColor }}
                            >
                                {group.items.length}
                            </span>
                        </header>
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
                    </section>
                )
            })}
        </div>
    )
}
