/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useMemo, useState } from 'react'

import { OperatorService } from '../../../../../../services/OperatorService'
import { fmtInt, fmtRange, fmtYards } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { useOperatorSegments } from '../../../../../hooks/useOperatorSegments'
import CommentModalSection from '../../../../sections/CommentModalSection'
import HistoryViewSection from '../../../../sections/HistoryViewSection'
import { Panel } from '../../../../ui/Panel'
import { openOperatorsPrintWindow } from './operators/operatorPrint'
import { OperatorRow } from './operators/OperatorRow'
import { OperatorSegmentHeader } from './operators/OperatorRowCells'
import { EmptySection, RefreshingHint } from './planStatsShared'

/* ──────────────────────────────────────────────────────────────────────────
 * Operators sub-page — per-driver load count + yardage across the active
 * window, derived from ticket-level data. Each row cross-references the
 * driven truck(s) against the operator's assigned-active mixer so the page
 * surfaces wrong-truck / wrong-plant / unassigned / multi-truck mismatches.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsOperatorsPage({
    accentColor,
    currentDays,
    loading,
    loadsByOperator = [],
    range,
    selectedPlant
}) {
    const totals = useMemo(() => {
        let loads = 0
        let yardage = 0
        let mismatched = 0
        loadsByOperator.forEach((row) => {
            loads += row.loads
            yardage += row.yardage
            if (row.mismatches.length > 0) mismatched += 1
        })
        return { drivers: loadsByOperator.length, loads, mismatched, yardage }
    }, [loadsByOperator])

    /* Operator-modal state — when a dispatcher hits Comments / History on
     * a row we mount the same `CommentModalSection` / `HistoryViewSection`
     * pair the assets pages use, scoped to the operator's `employeeId`.
     * Stored as the full `{ employeeId, name }` object so the modal can
     * show the operator's display name without a roster re-lookup. */
    const [commentTarget, setCommentTarget] = useState(null)
    const [historyTarget, setHistoryTarget] = useState(null)
    const handleShowComments = useCallback((operator) => setCommentTarget(operator), [])
    const handleShowHistory = useCallback((operator) => setHistoryTarget(operator), [])

    /* When a single plant is filtered, dispatch wants to see who's actually
     * assigned to that plant vs. who only happened to load there. */
    const operatorSegments = useOperatorSegments(loadsByOperator, selectedPlant)

    const handlePrint = useCallback(
        () => openOperatorsPrintWindow({ loadsByOperator, operatorSegments, range, selectedPlant, totals }),
        [loadsByOperator, operatorSegments, range, selectedPlant, totals]
    )

    if (loading && currentDays.length === 0) {
        return <div className="rounded animate-pulse bg-bg-secondary border border-border-light h-[320px]" />
    }
    if (!loading && currentDays.length === 0) {
        return (
            <Panel title="Operators Loads" innerClassName="p-0">
                <EmptySection
                    icon="fa-id-badge"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    const maxLoads = loadsByOperator.length > 0 ? loadsByOperator[0].loads : 0
    return (
        <Panel
            title="Loads per operator"
            innerClassName="p-0"
            right={
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {loading ? (
                        <RefreshingHint when />
                    ) : totals.drivers > 0 ? (
                        <span className="text-[11px] text-text-tertiary">
                            {fmtInt(totals.drivers)} operator{totals.drivers === 1 ? '' : 's'} · {fmtInt(totals.loads)}{' '}
                            load{totals.loads === 1 ? '' : 's'} · {fmtYards(totals.yardage)} yd³
                            {totals.mismatched > 0 && (
                                <>
                                    {' · '}
                                    <span className="font-semibold text-text-primary">
                                        {fmtInt(totals.mismatched)} mismatch{totals.mismatched === 1 ? '' : 'es'}
                                    </span>
                                </>
                            )}
                        </span>
                    ) : null}
                    <button
                        className="inline-flex items-center gap-1.5 rounded bg-bg-secondary border border-border-light text-text-secondary text-[11px] font-semibold px-2 py-1 hover:bg-bg-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={loadsByOperator.length === 0 || loading}
                        onClick={handlePrint}
                        title="Print the operator list"
                        type="button"
                    >
                        <i className="fas fa-print text-[10px]" />
                        <span>Print</span>
                    </button>
                </div>
            }
        >
            {loadsByOperator.length === 0 ? (
                <EmptySection
                    icon="fa-id-badge"
                    loading={loading}
                    message={(() => {
                        if (loading) return 'Loading tickets…'
                        if (selectedPlant) {
                            return `No operators loaded at plant ${selectedPlant} in ${fmtRange(range.start, range.end)}.`
                        }
                        return `No ticket data available for ${fmtRange(range.start, range.end)}.`
                    })()}
                />
            ) : (
                <div className="flex flex-col">
                    <div className="grid grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_4.5rem_5rem] gap-3 items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b border-border-light bg-bg-secondary text-text-tertiary">
                        <span className="text-right">#</span>
                        <span>Operator</span>
                        <span>Assigned</span>
                        <span>Loads by plant</span>
                        <span>Trucks driven</span>
                        <span>Flags</span>
                        <span className="text-right">Loads</span>
                        <span className="text-right" title="Average yards per load — yardage ÷ loads">
                            Yds / load
                        </span>
                        <span className="text-right">Yardage</span>
                    </div>
                    {operatorSegments.map((segment) => (
                        <React.Fragment key={segment.key}>
                            {segment.header && (
                                <OperatorSegmentHeader
                                    count={segment.header.count}
                                    hint={segment.header.hint}
                                    title={segment.header.title}
                                />
                            )}
                            {segment.rows.map((row, idxInSegment) => (
                                <OperatorRow
                                    key={row.key}
                                    accentColor={accentColor}
                                    idxInSegment={idxInSegment}
                                    maxLoads={maxLoads}
                                    onShowComments={handleShowComments}
                                    onShowHistory={handleShowHistory}
                                    row={row}
                                />
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}
            {commentTarget && (
                <CommentModalSection
                    itemId={commentTarget.employeeId}
                    itemNumber={commentTarget.name}
                    itemType="Operator"
                    onClose={() => setCommentTarget(null)}
                    service={OperatorService}
                />
            )}
            {historyTarget && (
                <HistoryViewSection item={historyTarget} onClose={() => setHistoryTarget(null)} type="operator" />
            )}
        </Panel>
    )
}
