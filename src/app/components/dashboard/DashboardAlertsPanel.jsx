import React, { useState } from 'react'

import { Panel } from '../ui/Panel'
import { getAssetViewType } from './shared/DashboardSharedComponents'

const COLLAPSED_LIMIT = 3

const SEVERITY_STRIPE = {
    danger: 'border-l-status-danger',
    warning: 'border-l-status-warning',
    info: 'border-l-accent'
}

/** Inline alert row — left-edge severity stripe, monospace identifier,
 *  message, and a right-aligned metric. Becomes a focusable button when
 *  actionable so keyboard users get the same affordances as mouse users. */
function AlertRow({ id, message, metric, onClick, severity = 'info' }) {
    const Wrapper = onClick ? 'button' : 'div'
    const stripeClass = SEVERITY_STRIPE[severity] || SEVERITY_STRIPE.info
    const interactiveClass = onClick
        ? 'cursor-pointer hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
        : ''
    return (
        <Wrapper
            onClick={onClick}
            type={onClick ? 'button' : undefined}
            className={`flex items-baseline gap-3 py-1.5 pl-2.5 pr-1 text-left w-full rounded-md border-l-4 ${stripeClass} bg-transparent transition-colors duration-150 ${interactiveClass}`}
        >
            {id && (
                <span className="font-mono text-[11.5px] font-semibold shrink-0 min-w-[56px] text-text-primary">
                    {id}
                </span>
            )}
            <span className="text-[12.5px] flex-1 min-w-0 truncate text-text-secondary">{message}</span>
            {metric != null && (
                <span className="font-mono text-[12px] tabular-nums font-semibold shrink-0 text-text-primary">
                    {metric}
                </span>
            )}
        </Wrapper>
    )
}

/**
 * Active alerts panel — flat row list sourced from `plantNotifications`.
 * Caps at three rows by default; users opt into the full list with a
 * "View more" toggle so the dashboard hero stays compact.
 */
export default function DashboardAlertsPanel({
    plantNotifications,
    setEmbeddedView,
    setEmbeddedViewProps,
    setEmbeddedViewSearch
}) {
    const [expanded, setExpanded] = useState(false)
    const {
        longTermShopAssets = [],
        pendingOperators = [],
        shopIssue,
        trainingOperators = [],
        unassignedOperators = []
    } = plantNotifications || {}

    const openOnAsset = (asset) => () => {
        setEmbeddedView?.(getAssetViewType(asset.type))
        setEmbeddedViewSearch?.(asset.identifier || '')
        setEmbeddedViewProps?.(null)
    }
    /* Each Operators alert pre-applies the status filter that matches
     * the row's intent so the popup opens on the relevant subset
     * instead of the full roster. The filter strings must match
     * `OperatorsView`'s status options exactly (see `statuses` /
     * synthetic options in that view). */
    const openOperators = (initialStatusFilter) => () => {
        setEmbeddedView?.('operators')
        setEmbeddedViewSearch?.('')
        setEmbeddedViewProps?.(initialStatusFilter ? { initialStatusFilter } : null)
    }

    /* Build a single ordered list — fleet bottleneck first, then long-term
     * shop assets, then operator pipeline counts. Per-truck open-issue alerts
     * intentionally excluded; that rollup is more meaningful in the asset views. */
    const allRows = []
    if (shopIssue) {
        allRows.push({
            id: 'FLEET',
            key: 'shop',
            message: 'In-shop count crossed bottleneck threshold',
            metric: `${shopIssue.inShopCount} / ${shopIssue.spareCount}`,
            severity: 'danger'
        })
    }
    longTermShopAssets.forEach((asset, i) => {
        allRows.push({
            id: asset.identifier || asset.type,
            key: `long-${i}`,
            message: `${asset.type} long-term in shop${asset.downInYard ? ' (down in yard)' : ''}`,
            metric: `${asset.daysInShop}d`,
            onClick: openOnAsset(asset),
            severity: 'warning'
        })
    })
    if (unassignedOperators.length > 0) {
        allRows.push({
            id: 'OPS',
            key: 'unassigned',
            message: 'Unassigned operators',
            metric: unassignedOperators.length,
            onClick: openOperators('Unassigned Active'),
            severity: 'warning'
        })
    }
    if (pendingOperators.length > 0) {
        allRows.push({
            id: 'OPS',
            key: 'pending',
            message: 'Operators awaiting start date',
            metric: pendingOperators.length,
            onClick: openOperators('Pending Start'),
            severity: 'info'
        })
    }
    if (trainingOperators.length > 0) {
        allRows.push({
            id: 'OPS',
            key: 'training',
            message: 'Operators currently in training',
            metric: trainingOperators.length,
            onClick: openOperators('Training'),
            severity: 'info'
        })
    }

    const totalCount = allRows.length

    if (totalCount === 0) {
        return (
            <Panel id="alerts" title="Alerts">
                <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                    <i className="fas fa-check-circle text-status-active" aria-hidden="true" />
                    <span>No active alerts.</span>
                </div>
            </Panel>
        )
    }

    const visibleRows = expanded ? allRows : allRows.slice(0, COLLAPSED_LIMIT)
    const hiddenCount = totalCount - visibleRows.length
    const canExpand = totalCount > COLLAPSED_LIMIT

    return (
        <Panel id="alerts" title={`Alerts · ${totalCount}`}>
            <div className="flex flex-col gap-0.5">
                {visibleRows.map((row) => (
                    <AlertRow
                        key={row.key}
                        id={row.id}
                        message={row.message}
                        metric={row.metric}
                        onClick={row.onClick}
                        severity={row.severity}
                    />
                ))}
                {canExpand && (
                    <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        className="self-start text-[12px] font-semibold mt-1.5 px-2 py-1 rounded-md bg-transparent cursor-pointer transition-colors duration-150 text-text-secondary hover:text-text-primary hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                        aria-expanded={expanded}
                    >
                        {expanded ? 'Show less' : `View more (${hiddenCount})`}
                    </button>
                )}
            </div>
        </Panel>
    )
}
