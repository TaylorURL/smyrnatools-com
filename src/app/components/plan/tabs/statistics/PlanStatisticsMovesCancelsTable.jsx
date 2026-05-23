/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtDate, fmtInt, fmtScorePct } from '../../../../../utils/PlanStatisticsFormatUtility'

const HEAVY = '#dc2626'
const SOFT = '#f59e0b'
const NEUTRAL = '#64748b'

/** Proportional stacked bar — cancels / moves / edits as one row.
 *  Lets the eye pick up "this customer is mostly cancels" vs "mostly
 *  moves" without re-reading the count columns. */
function BreakdownBar({ cancelCount, editCount, moveCount }) {
    const total = cancelCount + moveCount + editCount
    if (total <= 0) {
        return <div className="rounded-sm h-1.5 bg-bg-tertiary opacity-50" />
    }
    return (
        <div className="rounded-sm h-1.5 overflow-hidden flex bg-bg-tertiary">
            <div style={{ background: HEAVY, width: `${(cancelCount / total) * 100}%` }} />
            <div style={{ background: SOFT, width: `${(moveCount / total) * 100}%` }} />
            <div style={{ background: NEUTRAL, width: `${(editCount / total) * 100}%` }} />
        </div>
    )
}

/** Rank chip — gold/silver/bronze for top 3, neutral chip otherwise. */
export function RankChip({ rank }) {
    const palette =
        rank === 1
            ? { background: 'rgba(217, 119, 6, 0.18)', color: '#b45309' }
            : rank === 2
              ? { background: 'rgba(148, 163, 184, 0.22)', color: '#475569' }
              : rank === 3
                ? { background: 'rgba(180, 83, 9, 0.16)', color: '#92400e' }
                : { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }
    return (
        <span
            className="inline-flex items-center justify-center font-semibold tabular-nums text-[11px] rounded-md w-7 h-6"
            style={palette}
        >
            {rank}
        </span>
    )
}

function moveDirectionLabel(direction) {
    if (!direction) return null
    const { earlier = 0, later = 0 } = direction
    if (!earlier && !later) return null
    const parts = []
    if (earlier) parts.push(`${fmtInt(earlier)}↤`)
    if (later) parts.push(`${fmtInt(later)}↦`)
    return parts.join(' ')
}

function SortHeader({ accent, activeKey, align = 'right', children, onSelect, sortKey }) {
    const isActive = activeKey === sortKey
    const alignClass = align === 'left' ? 'text-left' : 'text-right'
    return (
        <th
            scope="col"
            className={`text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 border-b border-border-light bg-bg-tertiary whitespace-nowrap ${alignClass}`}
            style={{ color: isActive ? accent || 'var(--text-primary)' : 'var(--text-tertiary)' }}
        >
            <button
                type="button"
                onClick={() => onSelect(sortKey)}
                className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider"
                style={{ color: 'inherit', fontSize: 'inherit' }}
            >
                {children}
                <i
                    className={`fas ${isActive ? 'fa-sort-down' : 'fa-sort'} text-[9px] opacity-${isActive ? '100' : '40'}`}
                />
            </button>
        </th>
    )
}

function CustomerRow({ customer, isActive, onSelect, rank }) {
    const directionHint = moveDirectionLabel(customer.moveDirection)
    return (
        <tr
            onClick={() => onSelect(customer.key)}
            className="cursor-pointer transition-colors border-b border-border-light last:border-b-0 hover:bg-bg-tertiary"
            style={{ background: isActive ? 'var(--bg-secondary)' : undefined }}
        >
            <td className="px-3 py-2.5 align-middle">
                <RankChip rank={rank} />
            </td>
            <td className="px-3 py-2.5 align-middle min-w-0">
                <div className="text-[13px] font-semibold text-text-primary truncate" title={customer.name}>
                    {customer.name || '(unnamed)'}
                </div>
                <div className="text-[10.5px] text-text-tertiary tabular-nums mt-0.5">
                    {fmtInt(customer.orderCount)} order{customer.orderCount === 1 ? '' : 's'}
                </div>
            </td>
            <td className="px-3 py-2.5 align-middle min-w-[120px]">
                <BreakdownBar
                    cancelCount={customer.cancelCount}
                    editCount={customer.editCount}
                    moveCount={customer.moveCount}
                />
            </td>
            <td className="px-3 py-2.5 align-middle text-right text-[14px] tabular-nums font-semibold whitespace-nowrap">
                {customer.cancelCount > 0 ? (
                    <span style={{ color: HEAVY }}>{fmtInt(customer.cancelCount)}</span>
                ) : (
                    <span className="text-text-tertiary">—</span>
                )}
            </td>
            <td className="px-3 py-2.5 align-middle text-right text-[14px] tabular-nums font-semibold whitespace-nowrap">
                {customer.moveCount > 0 ? (
                    <span className="inline-flex flex-col items-end leading-tight">
                        <span style={{ color: SOFT }}>{fmtInt(customer.moveCount)}</span>
                        {directionHint && (
                            <span className="text-[10px] font-normal text-text-tertiary">{directionHint}</span>
                        )}
                    </span>
                ) : (
                    <span className="text-text-tertiary">—</span>
                )}
            </td>
            <td className="px-3 py-2.5 align-middle text-right text-[13px] tabular-nums whitespace-nowrap">
                {customer.editCount > 0 ? (
                    <span style={{ color: NEUTRAL }}>{fmtInt(customer.editCount)}</span>
                ) : (
                    <span className="text-text-tertiary">—</span>
                )}
            </td>
            <td className="px-3 py-2.5 align-middle text-right text-[14px] tabular-nums font-semibold whitespace-nowrap text-text-primary">
                {fmtInt(customer.churnEvents)}
            </td>
            <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap text-[13px]">
                {fmtScorePct(customer.churnRate)}
            </td>
            <td className="px-3 py-2.5 align-middle text-right text-[11.5px] text-text-tertiary tabular-nums whitespace-nowrap">
                {customer.lastEventDate ? fmtDate(customer.lastEventDate) : '—'}
            </td>
        </tr>
    )
}

/** Sortable leaderboard table. Headers click-to-sort; row click toggles
 *  the per-customer drawer in the parent page. Extracted from the parent
 *  so the page file stays under the project's component-size budget. */
export default function PlanStatisticsMovesCancelsTable({
    customers,
    onSelectCustomer,
    onSortChange,
    selectedKey,
    sortKey
}) {
    const headerCls =
        'text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 border-b border-border-light bg-bg-tertiary text-text-tertiary'
    return (
        <div className="rounded-md bg-bg-primary border border-border-light overflow-x-auto">
            <table className="w-full border-collapse min-w-[820px]">
                <thead>
                    <tr>
                        <th scope="col" className={`${headerCls} w-10 text-left`}>
                            #
                        </th>
                        <th scope="col" className={`${headerCls} text-left`}>
                            Customer
                        </th>
                        <th scope="col" className={`${headerCls} text-left w-[130px]`}>
                            Mix
                        </th>
                        <SortHeader accent={HEAVY} activeKey={sortKey} onSelect={onSortChange} sortKey="cancels">
                            Cancels
                        </SortHeader>
                        <SortHeader accent={SOFT} activeKey={sortKey} onSelect={onSortChange} sortKey="moves">
                            Moves
                        </SortHeader>
                        <SortHeader activeKey={sortKey} onSelect={onSortChange} sortKey="edits">
                            Edits
                        </SortHeader>
                        <SortHeader activeKey={sortKey} onSelect={onSortChange} sortKey="churn">
                            Churn
                        </SortHeader>
                        <SortHeader activeKey={sortKey} onSelect={onSortChange} sortKey="rate">
                            Churn %
                        </SortHeader>
                        <SortHeader activeKey={sortKey} onSelect={onSortChange} sortKey="recent">
                            Last
                        </SortHeader>
                    </tr>
                </thead>
                <tbody>
                    {customers.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="text-[12px] text-text-tertiary text-center px-3 py-8">
                                No customers match the current search.
                            </td>
                        </tr>
                    ) : (
                        customers.map((c, index) => (
                            <CustomerRow
                                key={c.key}
                                customer={c}
                                isActive={c.key === selectedKey}
                                onSelect={onSelectCustomer}
                                rank={index + 1}
                            />
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
