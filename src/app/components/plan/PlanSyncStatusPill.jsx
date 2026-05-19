/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Live status of the Planner tab's collaborative sync pipeline.
 *
 * Drives off `syncStatus` from `usePlanData`:
 *   - `idle`   — no edit since opening this date. Renders nothing (the
 *                empty header reads cleaner than a perpetual "Saved").
 *   - `saving` — a debounced save is in flight; the pulse cues the user
 *                that their last keystroke hasn't reached the server yet.
 *   - `saved`  — last write succeeded, OR a remote update from another
 *                dispatcher just landed locally. Either way the visible
 *                state matches the bus.
 *   - `error`  — the most recent save threw. The pipeline self-recovers on
 *                the next edit — see the catch in usePlanData — but we
 *                surface it so the user knows their work hasn't shipped.
 */
const STATUS_CONFIG = {
    error: { bg: 'rgba(220, 38, 38, 0.12)', fg: '#b91c1c', icon: 'fa-circle-exclamation', label: 'Sync error' },
    saved: { bg: 'rgba(22, 163, 74, 0.12)', fg: '#15803d', icon: 'fa-circle-check', label: 'Saved' },
    saving: { bg: 'rgba(217, 119, 6, 0.16)', fg: '#92400e', icon: 'fa-arrows-rotate fa-spin', label: 'Saving…' }
}

export function PlanSyncStatusPill({ status }) {
    const cfg = STATUS_CONFIG[status]
    if (!cfg) return null
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: cfg.bg, color: cfg.fg }}
            title="Planner saves automatically and syncs to every other dispatcher viewing this date."
        >
            <i className={`fas ${cfg.icon} text-[10px]`} />
            {cfg.label}
        </span>
    )
}

export default PlanSyncStatusPill
