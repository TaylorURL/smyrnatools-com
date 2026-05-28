/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { Panel as SharedPanel } from '../../../ui/Panel'

/** Plan-insights list — warnings and suggestions surfaced from
 *  `usePlanInsights`. Two visual tones: amber bar for warnings, neutral
 *  for suggestions. */
export function PlanInsightsList({ warnings, suggestions }) {
    return (
        <SharedPanel id="insights" title={`Plan insights · ${warnings.length + suggestions.length}`}>
            <div className="flex flex-col gap-1.5">
                {warnings.map((warning, i) => (
                    <div
                        key={`w-${i}`}
                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                        style={{ borderLeft: '2px solid #f59e0b', paddingLeft: 10 }}
                    >
                        <span className="text-text-primary">{warning.message}</span>
                    </div>
                ))}
                {suggestions.map((suggestion, i) => (
                    <div
                        key={`s-${i}`}
                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                        style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 10 }}
                    >
                        <span className="text-text-secondary">{suggestion.message}</span>
                    </div>
                ))}
            </div>
        </SharedPanel>
    )
}
