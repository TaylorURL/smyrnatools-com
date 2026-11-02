import React from 'react'

import { HistoryUtility } from '../../../utils/HistoryUtility'
import UserLabel from '../common/UserLabel'
import HistoryEmptyState from '../ui/HistoryEmptyState'
import HistoryAiSummary from './HistoryAiSummary'

/** One ruled history row: which field, when, what it was and became, and who changed it. */
function HistoryChangeRow({ entry, formatValue, type }) {
    const fieldName = entry.fieldName ?? entry.field_name
    const isCreatedEntry = fieldName === 'created'
    return (
        <div className="border-b border-border-light py-3">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium capitalize text-text-primary">
                    {HistoryUtility.formatFieldName(fieldName, type)}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">
                    {HistoryUtility.formatHistoryTimestamp(entry.changedAt ?? entry.changed_at)}
                </span>
            </div>
            {isCreatedEntry ? (
                <div className="mt-0.5 text-[13px] font-medium text-text-primary">
                    {formatValue(fieldName, entry.newValue ?? entry.new_value)}
                </div>
            ) : (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <span className="text-text-tertiary line-through">
                        {formatValue(fieldName, entry.oldValue ?? entry.old_value)}
                    </span>
                    <i className="fas fa-arrow-right text-[10px] text-text-tertiary" aria-hidden="true" />
                    <span className="font-medium text-text-primary">
                        {formatValue(fieldName, entry.newValue ?? entry.new_value)}
                    </span>
                </div>
            )}
            <div className="mt-1 text-[12px] text-text-tertiary">
                <UserLabel userId={entry.changedBy ?? entry.changed_by} showIcon />
            </div>
        </div>
    )
}

/**
 * Two-column timeline tab: left side is the sorted list of every history change,
 * right side is the collapsible AI analysis panel. The right panel's width
 * animates in and out as the reader scrolls past the first viewport.
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
    const listColumnClass = analysisVisible ? 'flex-[3]' : 'flex-1'
    const sidebarColumnClass = analysisVisible
        ? 'flex-[2] opacity-100 pl-5 border-l border-border-light'
        : 'flex-none w-0 opacity-0 pl-0 border-l-0'

    return (
        <div className="flex gap-5">
            <div className={`flex flex-col min-w-0 pr-1 transition duration-500 ease-in-out ${listColumnClass}`}>
                {sortedHistory.length === 0 ? (
                    <HistoryEmptyState
                        title={`No history records found for this ${type}.`}
                        subtitle={`History entries will appear here when changes are made to this ${type}.`}
                    />
                ) : (
                    sortedHistory.map((entry, index) => (
                        <HistoryChangeRow key={entry.id ?? index} entry={entry} formatValue={formatValue} type={type} />
                    ))
                )}
            </div>
            <div
                className={`min-w-0 overflow-hidden transition duration-500 ease-in-out border-border-light ${sidebarColumnClass}`}
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
