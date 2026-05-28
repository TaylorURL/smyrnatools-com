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
 * for the card list per column. Honors the active status chip — when set,
 * only the matching column is shown.
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
            className={`flex w-full gap-3 overflow-x-auto overscroll-x-contain pb-3 ${
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
                        className={`flex shrink-0 flex-col rounded-xl border border-border-light bg-bg-secondary ${
                            isMobile ? 'w-[84vw] snap-start' : 'w-[300px]'
                        }`}
                    >
                        <header
                            className="flex items-center gap-2 rounded-t-xl border-b px-3 py-2"
                            style={{
                                background: color.bg,
                                borderColor: color.border
                            }}
                        >
                            <span
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[10px]"
                                style={{ background: 'var(--bg-primary)', color: color.text }}
                            >
                                <i className={`fas ${group.icon}`} aria-hidden="true" />
                            </span>
                            <h3 className="m-0 text-[12.5px] font-semibold tracking-tight text-text-primary">
                                {group.label}
                            </h3>
                            <span
                                className="ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums"
                                style={{ background: `${accentColor}1a`, color: accentColor }}
                            >
                                {count}
                            </span>
                        </header>
                        <div className="flex min-h-[140px] flex-col gap-2 p-2">
                            {count === 0 ? (
                                <div className="flex h-[100px] items-center justify-center text-[11.5px] italic text-text-tertiary">
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
