/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt, fmtYards } from '../../../../../../../utils/PlanStatisticsFormatUtility'
import { AssignedCell, MismatchBadge, OperatorActionButtons, TruckCell } from './OperatorRowCells'
import { UnmatchedDriversRow } from './UnmatchedDriversRow'

/**
 * Single operator row rendered inside the Loads-per-operator table. Falls
 * through to `UnmatchedDriversRow` for the aggregate "couldn't resolve to
 * an operator record" bucket so the table only renders one component type
 * per row from the parent's perspective.
 */
export function OperatorRow({ accentColor, idxInSegment, maxLoads, onShowComments, onShowHistory, row }) {
    const avgYardage = row.loads > 0 ? row.yardage / row.loads : 0
    const statusLabel = row.operatorStatus && row.operatorStatus !== 'Active' ? row.operatorStatus : null
    if (row.unmatched) {
        return (
            <UnmatchedDriversRow
                accentColor={accentColor}
                avgYardage={avgYardage}
                isFirst={idxInSegment === 0}
                maxLoads={maxLoads}
                row={row}
            />
        )
    }
    return (
        <div
            className="grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_4.5rem_5rem] gap-3 items-center px-3 py-2 text-[12.5px]"
            style={{
                borderTop: idxInSegment === 0 ? 'none' : '1px solid var(--border-light)'
            }}
        >
            <span className="font-mono tabular-nums text-right text-text-tertiary">{idxInSegment + 1}</span>
            <div className="min-w-0">
                <div className="truncate font-semibold text-text-primary">{row.name}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {row.driverNum && (
                        <span
                            className="font-mono tabular-nums text-[10.5px] text-text-tertiary"
                            title="Dispatch operator number (smyrna_id)"
                        >
                            #{row.driverNum}
                        </span>
                    )}
                    {statusLabel && (
                        <span
                            className="inline-flex items-center rounded px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                            style={{ background: 'rgba(220, 38, 38, 0.12)', color: 'var(--text-primary)' }}
                            title={`Operator status: ${statusLabel}`}
                        >
                            {statusLabel}
                        </span>
                    )}
                </div>
                {row.employeeId && (
                    <OperatorActionButtons
                        operator={{ employeeId: row.employeeId, name: row.name }}
                        onComments={onShowComments}
                        onHistory={onShowHistory}
                    />
                )}
            </div>
            <AssignedCell assignedPlant={row.homePlant} assignedTruck={row.assignedTruck} />
            <div className="flex flex-wrap items-center gap-1 min-w-0">
                {row.plantLoads.length === 0 ? (
                    <span className="text-[11px] text-text-tertiary">—</span>
                ) : (
                    row.plantLoads.map(({ plant, loads }) => {
                        const isHome = plant === row.homePlant
                        return (
                            <span
                                key={plant}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-mono tabular-nums text-text-primary"
                                style={{
                                    background: isHome ? 'rgba(22, 163, 74, 0.14)' : 'var(--bg-tertiary)'
                                }}
                                title={
                                    isHome
                                        ? `${plant} · home plant · ${loads} load${loads === 1 ? '' : 's'}`
                                        : `${plant} · cross-plant · ${loads} load${loads === 1 ? '' : 's'}`
                                }
                            >
                                <span className="font-semibold">{plant}</span>
                                <span className="text-text-tertiary">×</span>
                                <span className="font-semibold">{loads}</span>
                            </span>
                        )
                    })
                )}
            </div>
            <TruckCell assignedTruck={row.assignedTruck} trucksDriven={row.trucksDriven} />
            <div className="flex flex-wrap items-center gap-1 min-w-0">
                {row.mismatches.length === 0 ? (
                    <span className="text-[11px] text-text-tertiary">—</span>
                ) : (
                    row.mismatches.map((tone) => <MismatchBadge key={tone} tone={tone} />)
                )}
            </div>
            <div className="flex flex-col items-end gap-1 min-w-0">
                <span className="font-mono tabular-nums font-semibold text-text-primary">{fmtInt(row.loads)}</span>
                <div className="h-1.5 rounded-sm overflow-hidden relative bg-bg-tertiary w-12">
                    <div
                        className="h-full rounded-sm"
                        style={{
                            background: accentColor,
                            width: `${maxLoads > 0 ? (row.loads / maxLoads) * 100 : 0}%`
                        }}
                    />
                </div>
            </div>
            <span
                className="font-mono tabular-nums text-right text-text-secondary"
                title={
                    row.loads > 0
                        ? `Average yardage per load · ${row.loads} load${row.loads === 1 ? '' : 's'}`
                        : 'No loads recorded'
                }
            >
                {row.loads > 0 ? avgYardage.toFixed(1) : '—'}
            </span>
            <span className="font-mono tabular-nums text-right text-text-secondary">{fmtYards(row.yardage)} yd³</span>
        </div>
    )
}
