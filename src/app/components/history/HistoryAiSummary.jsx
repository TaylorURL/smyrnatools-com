import React from 'react'

import { ASSET_TYPES_WITH_OPERATORS } from '../../constants/historyConstants'
import StatCard from '../ui/StatCard'
import StatCardGrid from '../ui/StatCardGrid'

/** A short centred message: a 15px line and an optional 13px line under it. */
function SummaryNotice({ children, line, title }) {
    return (
        <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
            <p className="m-0 text-[15px] font-medium text-text-primary">{title}</p>
            {line && <p className="m-0 text-[13px] text-text-secondary">{line}</p>}
            {children}
        </div>
    )
}

/**
 * Right-hand analysis panel for the timeline tab — handles loading, error, empty,
 * and ready states for the AI summary, plus the typed text and aggregate stats grid.
 */
export default function HistoryAiSummary({
    aiDisplayText,
    aiSummary,
    aiSummaryError,
    aiSummaryLoading,
    handleRegenerateAISummary,
    history,
    issues,
    isTypingComplete,
    operatorData,
    statusData,
    type
}) {
    if (aiSummaryLoading) {
        return <SummaryNotice title="Analyzing history" line="This may take a moment." />
    }
    if (aiSummaryError) {
        return (
            <SummaryNotice title="Couldn't generate the analysis" line="Try again in a moment.">
                <button type="button" onClick={handleRegenerateAISummary} className="btn-secondary mt-3">
                    Try again
                </button>
            </SummaryNotice>
        )
    }
    if (!aiSummary) {
        return <SummaryNotice title="No analysis available" />
    }
    const showOperatorStats = ASSET_TYPES_WITH_OPERATORS.includes(type)
    return (
        <div className="flex flex-col gap-3">
            <div>
                <div className="mb-1 text-[12px] font-medium text-text-secondary">
                    Analysis · {history.length} entries
                </div>
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-primary">
                    {aiDisplayText}
                    {!isTypingComplete && (
                        <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse align-text-bottom bg-text-tertiary motion-reduce:animate-none" />
                    )}
                </div>
            </div>
            {isTypingComplete && (
                <StatCardGrid columns={2}>
                    <StatCard value={history.length} label="Total changes" />
                    <StatCard value={statusData.length} label="Status changes" />
                    {showOperatorStats && <StatCard value={operatorData.length} label="Operator changes" />}
                    <StatCard value={issues.length} label="Total issues" />
                </StatCardGrid>
            )}
            {isTypingComplete && (
                <button type="button" onClick={handleRegenerateAISummary} className="btn-secondary self-start">
                    <i className="fas fa-sync-alt text-[12px]" aria-hidden="true" />
                    Regenerate analysis
                </button>
            )}
        </div>
    )
}
