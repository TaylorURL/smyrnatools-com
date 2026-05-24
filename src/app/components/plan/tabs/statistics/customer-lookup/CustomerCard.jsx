/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtDate, fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import ScorePercent from '../ScorePercent'
import ServiceTierBreakdown from '../ServiceTierBreakdown'
import MixBar from './MixBar'
import VerdictTrail from './VerdictTrail'

export default function CustomerCard({ customer, isActive, onSelect, orders }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(customer.key)}
            className="text-left rounded-md p-3 flex flex-col gap-2 cursor-pointer border transition-colors"
            style={{
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                borderColor: isActive ? 'var(--text-secondary)' : 'var(--border-light)'
            }}
        >
            <div className="flex items-baseline justify-between gap-3 min-w-0">
                <div className="min-w-0">
                    <div
                        className="text-[13.5px] font-semibold text-text-primary truncate leading-tight"
                        title={customer.name}
                    >
                        {customer.name || '(unnamed)'}
                    </div>
                    {customer.lastPourDate && (
                        <div className="text-[10.5px] text-text-tertiary tabular-nums mt-0.5">
                            Last pour {fmtDate(customer.lastPourDate)}
                        </div>
                    )}
                </div>
                <div className="shrink-0">
                    <ScorePercent value={customer.goodPct} />
                </div>
            </div>
            <MixBar
                badJobs={customer.badJobs}
                goodJobs={customer.goodJobs}
                jobs={customer.jobs}
                lateJobs={customer.lateJobs}
                slowJobs={customer.slowJobs}
            />
            <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-text-tertiary tabular-nums">
                    {fmtInt(customer.jobs)} jobs
                    {customer.lateJobs > 0 && (
                        <>
                            <span className="mx-1.5">·</span>
                            <span className="text-text-secondary">{fmtInt(customer.lateJobs)} late</span>
                        </>
                    )}
                    {customer.slowJobs > 0 && (
                        <>
                            <span className="mx-1.5">·</span>
                            <span className="text-text-secondary">{fmtInt(customer.slowJobs)} slow</span>
                        </>
                    )}
                </div>
                <VerdictTrail orders={orders} />
            </div>
            {customer.tierCounts && customer.badJobs > 0 && (
                <ServiceTierBreakdown tierCounts={customer.tierCounts} compact />
            )}
        </button>
    )
}
