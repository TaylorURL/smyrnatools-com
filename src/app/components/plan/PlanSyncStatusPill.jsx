import React from 'react'

import Badge from '../common/Badge'

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
    error: { icon: 'circle-exclamation', label: 'Sync error', tone: 'danger' },
    saved: { icon: 'circle-check', label: 'Saved', tone: 'success' },
    saving: { icon: 'arrows-rotate fa-spin', label: 'Saving…', tone: 'info' }
}

export function PlanSyncStatusPill({ status }) {
    const cfg = STATUS_CONFIG[status]
    if (!cfg) return null
    return (
        <Badge
            tone={cfg.tone}
            size="md"
            shape="pill"
            weight="semibold"
            uppercase={false}
            icon={cfg.icon}
            title="Planner saves automatically and syncs to every other dispatcher viewing this date."
            role="status"
            aria-live="polite"
        >
            {cfg.label}
        </Badge>
    )
}

export default PlanSyncStatusPill
