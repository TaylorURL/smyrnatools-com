/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { STATUS_COLORS, STATUS_MAP, STATUS_OPTIONS } from '../../constants/listViewConstants'
import ListCardItem from './ListCardItem'

const COLUMN_KEYS = STATUS_OPTIONS.map((label) => Object.keys(STATUS_MAP).find((k) => STATUS_MAP[k] === label)).filter(
    Boolean
)

/** Returns true when the active status filter chip should hide this column entirely. */
function isColumnHiddenByStatusFilter(statusFilter, columnKey) {
    if (!statusFilter) return false
    return statusFilter !== columnKey
}

/**
 * Horizontal Cards board with one column per status. Reuses `groupedByStatus`
 * for the card list per column and renders compact ListCardItem entries.
 * Honors the active statusFilter chip — when a filter is set, only the
 * matching column is shown.
 */
export default function ListCardsBoard({
    accentColor,
    groupedByStatus,
    isMobile,
    onSelectItem,
    onToggleSelect,
    selectedIds,
    statusFilter
}) {
    const visibleColumns = COLUMN_KEYS.filter((key) => !isColumnHiddenByStatusFilter(statusFilter, key))

    return (
        <div
            className={`flex gap-3 w-full overflow-x-auto overscroll-x-contain pb-3 ${
                isMobile ? 'snap-x snap-mandatory' : ''
            }`}
        >
            {visibleColumns.map((key) => {
                const group = groupedByStatus[key]
                if (!group) return null
                const color = STATUS_COLORS[key] || STATUS_COLORS.pending
                const count = group.items.length

                return (
                    <div
                        key={key}
                        className={`shrink-0 flex flex-col rounded-lg border border-border-light bg-bg-secondary ${
                            isMobile ? 'w-[82vw] snap-start' : 'w-[280px]'
                        }`}
                    >
                        <div
                            className="flex items-center gap-2 px-3 py-2 border-b border-border-light rounded-t-lg"
                            style={{ background: color.bg }}
                        >
                            <span
                                className="flex items-center justify-center h-5 w-5 rounded-md text-[10px]"
                                style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
                            >
                                <i className={`fas ${group.icon}`} />
                            </span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-text-primary">
                                {group.label}
                            </span>
                            <span
                                className="ml-auto inline-flex items-center justify-center rounded text-[10px] font-bold tabular-nums px-1.5 min-w-[18px] h-4"
                                style={{ background: `${accentColor}14`, color: accentColor }}
                            >
                                {count}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                            {count === 0 ? (
                                <div className="flex items-center justify-center h-[80px] text-[11px] text-text-tertiary italic">
                                    No tasks
                                </div>
                            ) : (
                                group.items.map((item) => (
                                    <ListCardItem
                                        key={item.id}
                                        accentColor={accentColor}
                                        isSelected={selectedIds.has(item.id)}
                                        item={item}
                                        onSelectItem={onSelectItem}
                                        onToggleSelect={onToggleSelect}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
