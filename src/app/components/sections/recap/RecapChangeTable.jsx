import React from 'react'

import { formatDate, formatFieldName, formatValue, isTerminatedGroup } from './recapHelpers'

/** Column widths shared by the header and every row, from the md breakpoint up. */
const COLUMNS = 'md:grid-cols-[88px_minmax(120px,1.1fr)_minmax(110px,0.9fr)_minmax(180px,2fr)_minmax(110px,1fr)]'

/**
 * Every change in the recap as one table, newest first: when, which truck or
 * operator, which field, what it was and what it became, and who changed
 * it. On a phone each change stacks into a short block.
 */
function RecapChangeTable({ isLoading, operatorNames, rows, userNames }) {
    if (isLoading) {
        return (
            <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-[13px] text-text-secondary">
                <i className="fas fa-spinner fa-spin text-[13px]" aria-hidden="true" />
                Loading changes
            </div>
        )
    }
    if (rows.length === 0) {
        return (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-1 px-6 text-center">
                <p className="m-0 text-[15px] font-medium text-text-primary">No changes in this period</p>
                <p className="m-0 text-[13px] text-text-secondary">Try a longer period or clear the filters.</p>
            </div>
        )
    }
    return (
        <div role="table" aria-label="Changes" className="text-[13px]">
            <div
                role="row"
                className={`sticky top-0 z-raised hidden gap-4 border-b border-border-light bg-bg-secondary px-6 py-2 text-[12px] font-medium text-text-secondary md:grid ${COLUMNS}`}
            >
                <span role="columnheader">When</span>
                <span role="columnheader">Record</span>
                <span role="columnheader">Field</span>
                <span role="columnheader">Change</span>
                <span role="columnheader">By</span>
            </div>
            {rows.map(({ change, group }, index) => {
                const terminated = isTerminatedGroup(group)
                const by = change.changed_by ? userNames[change.changed_by] : null
                return (
                    <div
                        role="row"
                        key={change.id || `${group.type}-${group.id}-${index}`}
                        className={`flex flex-col gap-1 border-b border-border-light px-6 py-3 md:grid md:items-baseline md:gap-4 md:py-2.5 ${COLUMNS}`}
                    >
                        <span role="cell" className="order-3 text-[12px] tabular-nums text-text-tertiary md:order-none">
                            {formatDate(change.changed_at)}
                        </span>
                        <span role="cell" className="order-1 min-w-0 truncate md:order-none">
                            <span className="mr-2 text-[12px] text-text-tertiary">
                                {group.type === 'mixer' ? 'Mixer' : 'Operator'}
                            </span>
                            <span
                                className={`font-medium ${terminated ? 'text-text-secondary line-through' : 'text-text-primary'}`}
                            >
                                {group.name}
                            </span>
                        </span>
                        <span role="cell" className="order-2 text-text-secondary md:order-none">
                            {formatFieldName(change.field_name)}
                        </span>
                        <span
                            role="cell"
                            className="order-2 flex min-w-0 flex-wrap items-baseline gap-x-2 md:order-none"
                        >
                            <span className="text-text-tertiary line-through">
                                {formatValue(change.old_value, change.field_name, operatorNames)}
                            </span>
                            <i className="fas fa-arrow-right text-[10px] text-text-tertiary" aria-hidden="true" />
                            <span className="font-medium text-text-primary">
                                {formatValue(change.new_value, change.field_name, operatorNames)}
                            </span>
                        </span>
                        <span
                            role="cell"
                            className="order-3 truncate text-[12px] text-text-secondary md:order-none md:text-[13px]"
                        >
                            {by || '—'}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

export default RecapChangeTable
