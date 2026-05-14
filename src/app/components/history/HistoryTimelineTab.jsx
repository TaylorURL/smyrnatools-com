/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { HistoryUtility } from '../../../utils/HistoryUtility'
import UserLabel from '../common/UserLabel'
import HistoryEmptyState from '../ui/HistoryEmptyState'
import HistoryAiSummary from './HistoryAiSummary'

/** Single history-row card showing field name, before/after values, and author. */
function HistoryChangeCard({ entry, formatValue, type }) {
    const fieldName = entry.fieldName ?? entry.field_name
    const isCreatedEntry = fieldName === 'created'
    return (
        <div className="rounded p-2.5 bg-bg-secondary border border-border-light">
            <div className="flex justify-between items-center mb-1.5">
                <div className="text-[12.5px] font-semibold capitalize text-text-primary">
                    {HistoryUtility.formatFieldName(fieldName, type)}
                </div>
                <div className="text-[11px] tabular-nums text-text-tertiary">
                    {HistoryUtility.formatHistoryTimestamp(entry.changedAt ?? entry.changed_at)}
                </div>
            </div>
            {isCreatedEntry ? (
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-green-700">
                        {formatValue(fieldName, entry.newValue ?? entry.new_value)}
                    </span>
                </div>
            ) : (
                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                    <span className="text-[12px] text-text-tertiary">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider mr-1">From</span>
                        {formatValue(fieldName, entry.oldValue ?? entry.old_value)}
                    </span>
                    <i className="fas fa-arrow-right text-[10px] text-[var(--accent, #1e3a5f)]" />
                    <span className="text-[12px] font-semibold text-text-primary">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider mr-1">To</span>
                        {formatValue(fieldName, entry.newValue ?? entry.new_value)}
                    </span>
                </div>
            )}
            <div className="text-[11px] text-text-tertiary">
                <UserLabel userId={entry.changedBy ?? entry.changed_by} showIcon />
            </div>
        </div>
    )
}

/**
 * Two-column timeline tab: left side is the sorted list of every history change,
 * right side is the collapsible AI analysis panel. The right panel's width
 * animates in/out as the user scrolls past the first viewport.
 */
export default function HistoryTimelineTab({
    aiDisplayText,
    aiSummary,
    aiSummaryError,
    aiSummaryLoading,
    analysisVisible,
    formatValue,
    handleRegenerateAISummary,
    history,
    issues,
    isTypingComplete,
    operatorData,
    sortedHistory,
    statusData,
    type
}) {
    return (
        <div className="flex gap-5">
            <div
                className="flex flex-col gap-3 min-w-0 pr-1 transition-all duration-500 ease-in-out"
                style={{ flex: analysisVisible ? '3' : '1' }}
            >
                {sortedHistory.length === 0 ? (
                    <HistoryEmptyState
                        title={`No history records found for this ${type}.`}
                        subtitle={`History entries will appear here when changes are made to this ${type}.`}
                    />
                ) : (
                    sortedHistory.map((entry, index) => (
                        <HistoryChangeCard
                            key={entry.id ?? index}
                            entry={entry}
                            formatValue={formatValue}
                            type={type}
                        />
                    ))
                )}
            </div>
            <div
                className="min-w-0 transition-all duration-500 ease-in-out border-border-light overflow-hidden"
                style={{
                    borderLeftWidth: analysisVisible ? '1px' : '0px',
                    flex: analysisVisible ? '2' : '0',
                    opacity: analysisVisible ? 1 : 0,
                    paddingLeft: analysisVisible ? '1.25rem' : '0px'
                }}
            >
                <HistoryAiSummary
                    aiDisplayText={aiDisplayText}
                    aiSummary={aiSummary}
                    aiSummaryError={aiSummaryError}
                    aiSummaryLoading={aiSummaryLoading}
                    handleRegenerateAISummary={handleRegenerateAISummary}
                    history={history}
                    isTypingComplete={isTypingComplete}
                    issues={issues}
                    operatorData={operatorData}
                    statusData={statusData}
                    type={type}
                />
            </div>
        </div>
    )
}
