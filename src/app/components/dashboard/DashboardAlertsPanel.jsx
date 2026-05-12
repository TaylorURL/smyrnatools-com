/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { Panel } from '../ui/Panel'
import { getAssetViewType } from './shared/DashboardSharedComponents'

const COLLAPSED_LIMIT = 3

/** Inline alert row — monospace identifier on the left, message in the
 *  middle, terse metric on the right. Becomes a button when actionable. */
function AlertRow({ id, message, metric, onClick }) {
    const Wrapper = onClick ? 'button' : 'div'
    return (
        <Wrapper
            onClick={onClick}
            type={onClick ? 'button' : undefined}
            className={`flex items-baseline gap-3 py-1.5 text-left bg-transparent border-none w-full ${
                onClick ? 'cursor-pointer hover:opacity-70' : ''
            }`}
        >
            {id && (
                <span
                    className="font-mono text-[11.5px] font-semibold shrink-0 text-text-primary"
                    style={{ minWidth: 56 }}
                >
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
export default function DashboardAlertsPanel({ plantNotifications, setEmbeddedView, setEmbeddedViewSearch }) {
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
    }
    const openOperators = () => {
        setEmbeddedView?.('operators')
        setEmbeddedViewSearch?.('')
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
            metric: `${shopIssue.inShopCount} / ${shopIssue.spareCount}`
        })
    }
    longTermShopAssets.forEach((asset, i) => {
        allRows.push({
            id: asset.identifier || asset.type,
            key: `long-${i}`,
            message: `${asset.type} long-term in shop${asset.downInYard ? ' (down in yard)' : ''}`,
            metric: `${asset.daysInShop}d`,
            onClick: openOnAsset(asset)
        })
    })
    if (unassignedOperators.length > 0) {
        allRows.push({
            id: 'OPS',
            key: 'unassigned',
            message: 'Unassigned operators',
            metric: unassignedOperators.length,
            onClick: openOperators
        })
    }
    if (pendingOperators.length > 0) {
        allRows.push({
            id: 'OPS',
            key: 'pending',
            message: 'Operators awaiting start date',
            metric: pendingOperators.length,
            onClick: openOperators
        })
    }
    if (trainingOperators.length > 0) {
        allRows.push({
            id: 'OPS',
            key: 'training',
            message: 'Operators currently in training',
            metric: trainingOperators.length,
            onClick: openOperators
        })
    }

    const totalCount = allRows.length

    if (totalCount === 0) {
        return (
            <Panel id="alerts" title="Alerts">
                <div className="text-[12.5px] text-text-secondary">No active alerts.</div>
            </Panel>
        )
    }

    const visibleRows = expanded ? allRows : allRows.slice(0, COLLAPSED_LIMIT)
    const hiddenCount = totalCount - visibleRows.length
    const canExpand = totalCount > COLLAPSED_LIMIT

    return (
        <Panel id="alerts" title={`Alerts · ${totalCount}`}>
            <div className="flex flex-col">
                {visibleRows.map((row) => (
                    <AlertRow
                        key={row.key}
                        id={row.id}
                        message={row.message}
                        metric={row.metric}
                        onClick={row.onClick}
                    />
                ))}
                {canExpand && (
                    <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        className="self-start text-[12px] font-semibold mt-1 px-0 py-1 bg-transparent border-none cursor-pointer hover:underline text-text-secondary"
                    >
                        {expanded ? 'Show less' : `View more (${hiddenCount})`}
                    </button>
                )}
            </div>
        </Panel>
    )
}
