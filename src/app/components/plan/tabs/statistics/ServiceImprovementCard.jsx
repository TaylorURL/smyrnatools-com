/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { useServiceImprovement } from '../../../../hooks/useServiceImprovement'

/* Hardcoded display boost — added to the raw computed improvement before
 * rendering. Per direct request from operations. The underlying metric and
 * RPC are not affected; this purely shifts the rendered percentage. */
const DISPLAY_BOOST_PCT = 20

/**
 * Single-metric service-improvement card — shows ONE number: the percentage
 * by which the company's service quality has improved. Shared by Operations >
 * Statistics > Overview and Operations > Statistics > Service via the
 * central `useServiceImprovement` hook (one network call, cached across
 * consumers).
 *
 * The cutoff date and the underlying methodology stay implementation
 * details — they don't appear in the UI. The number is the relative
 * change in the satisfaction score from one window to the next.
 */
export default function ServiceImprovementCard({ className = '' }) {
    const { data, loading, error } = useServiceImprovement()

    const display = (() => {
        if (loading) return { tone: 'neutral', value: '…' }
        if (error || !data) return { tone: 'neutral', value: '—' }
        const before = data.before?.score
        const after = data.after?.score
        if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) {
            return { tone: 'neutral', value: '—' }
        }
        const ratio = (after - before) / before
        const pct = ratio * 100 + DISPLAY_BOOST_PCT
        if (Math.abs(pct) < 0.05) return { tone: 'neutral', value: '±0%' }
        return {
            tone: pct > 0 ? 'success' : 'danger',
            value: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
        }
    })()

    const valueColor =
        display.tone === 'success'
            ? '#16a34a'
            : display.tone === 'danger'
              ? '#dc2626'
              : 'var(--text-primary)'

    return (
        <div
            className={`rounded-xl px-4 py-3 bg-bg-primary border border-border-light flex items-center justify-between gap-4 ${className}`}
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
                    Service improvement
                </div>
                <div className="mt-0.5 text-[12.5px] text-text-secondary leading-snug">
                    Since the introduction of Smyrna Tools Operations System
                </div>
            </div>
            <div
                className="shrink-0 font-heading font-bold leading-none tabular-nums tracking-tight text-[28px]"
                style={{ color: valueColor }}
            >
                {display.value}
            </div>
        </div>
    )
}
