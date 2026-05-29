/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { Panel as SharedPanel } from '../../../ui/Panel'

/** Plan issues banner — the warnings from `usePlanInsights` (over-capacity
 *  routes, missing travel times, overtime shifts) pinned to the top of the
 *  dashboard so a dispatcher sees blocking problems before anything else.
 *  Renders nothing when the plan is clean; softer suggestions stay in
 *  `PlanInsightsList` further down. */
export function PlanIssuesBanner({ warnings = [] }) {
    if (warnings.length === 0) return null
    return (
        <section id="plan-issues" className="scroll-mt-4">
            <div className="rounded-card overflow-hidden bg-status-warning/10 border border-border-light border-l-2 border-l-status-warning">
                <div className="flex items-center gap-2 px-3 py-2">
                    <i className="fas fa-triangle-exclamation text-[12px] text-status-warning" aria-hidden="true" />
                    <h3 className="font-heading text-[13px] font-semibold m-0 text-text-primary">
                        {warnings.length} plan {warnings.length === 1 ? 'issue' : 'issues'} to resolve
                    </h3>
                </div>
                <ul className="flex flex-col gap-1.5 px-3 pb-2.5">
                    {warnings.map((warning, i) => (
                        <li
                            key={`plan-issue-${i}`}
                            className="flex items-start gap-2 text-[12.5px] leading-snug text-text-primary"
                        >
                            <span
                                className="mt-[5px] h-1.5 w-1.5 rounded-full bg-status-warning shrink-0"
                                aria-hidden="true"
                            />
                            <span>{warning.message}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}

/** Plan-insights list — warnings and suggestions surfaced from
 *  `usePlanInsights`. Two visual tones: amber bar for warnings, neutral
 *  for suggestions. */
export function PlanInsightsList({ warnings = [], suggestions = [] }) {
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
