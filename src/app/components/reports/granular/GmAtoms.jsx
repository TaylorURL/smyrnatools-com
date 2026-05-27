import React from 'react'

import { formatVarianceFromValues } from '../../../constants/generalManagerReportConstants'
import Badge from '../../common/Badge'

/** Variance pill — arrow icon + signed percentage. Renders an em-dash
 *  pill when either side is missing or non-numeric. */
export function VarianceCell({ currentValue, lastValue }) {
    const variance = formatVarianceFromValues(lastValue, currentValue)
    if (!variance) {
        return (
            <Badge tone="neutral" size="lg" shape="rounded" weight="semibold" uppercase={false}>
                —
            </Badge>
        )
    }
    const n = parseFloat(variance)
    const tone = n > 0 ? 'success' : n < 0 ? 'danger' : 'neutral'
    const symbol = n > 0 ? '▲' : n < 0 ? '▼' : ''
    return (
        <Badge tone={tone} size="lg" shape="rounded" weight="semibold" uppercase={false} className="tabular-nums">
            {symbol && <span className="text-[0.6875rem]">{symbol}</span>}
            <span>{variance}</span>
        </Badge>
    )
}

/** Header strip with icon + title + subtitle inside the AI analysis card. */
function AiAnalysisHeader({ plantsCount }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent text-base">
                <i className="fas fa-robot"></i>
            </div>
            <div>
                <div className="font-semibold text-[0.9375rem] text-slate-800 m-0">AI Regional Analysis</div>
                <div className="text-xs text-slate-500 m-0">
                    Based on report data for {plantsCount} plant{plantsCount !== 1 ? 's' : ''}
                </div>
            </div>
        </div>
    )
}

/** AI analysis section — handles loading / error / success states. */
export function AiAnalysisCard({ aiAnalysis, aiError, aiLoading, onRegenerate, plantsCount }) {
    if (aiLoading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 mb-6">
                <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500">
                    <i className="fas fa-circle-notch fa-spin"></i>
                    <span>Generating AI Analysis...</span>
                </div>
            </div>
        )
    }
    if (aiError) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-text-primary mb-6">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Failed to generate AI analysis.
                <button
                    onClick={onRegenerate}
                    className="ml-2 cursor-pointer underline bg-transparent border-none text-inherit"
                >
                    Try again
                </button>
            </div>
        )
    }
    if (!aiAnalysis) return null
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 mb-6">
            <AiAnalysisHeader plantsCount={plantsCount} />
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{aiAnalysis}</div>
            <button
                className="mt-3 rounded-md border border-slate-300 bg-bg-primary px-3 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={onRegenerate}
            >
                <i className="fas fa-sync-alt mr-1.5"></i>
                Regenerate Analysis
            </button>
        </div>
    )
}

/** Inline empty-state for any GM report section. */
export function GmEmptyState({ message }) {
    return <div className="text-center p-8 rounded-lg text-[0.9375rem] text-slate-500 bg-slate-50">{message}</div>
}

/** Section heading with optional badge on the right. */
export function GmSectionHeader({ badge, title }) {
    return (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="text-lg font-semibold text-slate-800 m-0">{title}</div>
            {badge}
        </div>
    )
}
