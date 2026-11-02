import React, { useCallback, useMemo, useState } from 'react'

import { Panel } from '../ui/Panel'
import { getAssetViewType } from './shared/DashboardSharedComponents'

const COLLAPSED_LIMIT = 3
const STAGGER_MS = 40
const NO_ROWS = []

/** Severity → icon and colour. Keeping them in one record means a row and
 *  the header count can't disagree on what "warning" looks like. */
const SEVERITY_CONFIG = {
    danger: {
        icon: 'fas fa-circle-exclamation',
        iconColor: 'text-status-danger',
        label: 'Critical',
        plural: 'critical'
    },
    info: {
        icon: 'fas fa-circle-info',
        iconColor: 'text-text-tertiary',
        label: 'Info',
        plural: 'info'
    },
    warning: {
        icon: 'fas fa-triangle-exclamation',
        iconColor: 'text-status-warning',
        label: 'Warning',
        plural: 'warnings'
    }
}

/** One triage row, ruled off from the next: severity icon, identifier,
 *  message, the figure on the right and a chevron when it opens something.
 *  It's a button when it opens something, so the keyboard reaches it. */
function AlertRow({ id, index, message, metric, onClick, severity = 'info', staggerOffset }) {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info
    const Wrapper = onClick ? 'button' : 'div'
    const interactive = !!onClick
    const shouldAnimate = staggerOffset != null && index >= staggerOffset
    const animationStyle = shouldAnimate ? { animationDelay: `${(index - staggerOffset) * STAGGER_MS}ms` } : undefined

    return (
        <Wrapper
            onClick={onClick}
            type={interactive ? 'button' : undefined}
            style={animationStyle}
            className={[
                'group flex items-center gap-3 w-full px-4 py-2.5 text-left bg-transparent border-0 border-b border-solid border-border-light last:border-b-0',
                'transition-colors duration-150 ease-out',
                interactive ? 'cursor-pointer hover:bg-bg-hover' : '',
                interactive
                    ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'
                    : '',
                shouldAnimate ? 'animate-dv-fade-in motion-reduce:animate-none' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <i className={`${config.icon} text-[12px] w-3.5 shrink-0 ${config.iconColor}`} aria-label={config.label} />
            {id && (
                <span className="font-mono text-[12px] font-medium shrink-0 min-w-[56px] text-text-primary">{id}</span>
            )}
            <span className="text-[13px] flex-1 min-w-0 truncate text-text-secondary">{message}</span>
            {metric != null && (
                <span className="text-[13px] tabular-nums font-semibold shrink-0 text-text-primary">{metric}</span>
            )}
            {interactive && (
                <i
                    aria-hidden="true"
                    className="fas fa-chevron-right text-[10px] shrink-0 text-text-tertiary transition-colors duration-150 ease-out group-hover:text-text-secondary"
                />
            )}
        </Wrapper>
    )
}

/** The header's tally, as a line of text: "3 warnings · 2 info". */
function severitySummary(counts) {
    return ['danger', 'warning', 'info']
        .filter((severity) => counts[severity] > 0)
        .map((severity) => `${counts[severity]} ${SEVERITY_CONFIG[severity].plural}`)
        .join(' · ')
}

/**
 * Active alerts panel — flat row list sourced from `plantNotifications`.
 * Caps at three rows by default; users opt into the full list with a
 * "View more" toggle so the dashboard hero stays compact. Severity chips
 * in the header give triage at a glance without expanding.
 */
export default function DashboardAlertsPanel({
    plantNotifications,
    setEmbeddedView,
    setEmbeddedViewProps,
    setEmbeddedViewSearch
}) {
    const [expanded, setExpanded] = useState(false)
    // A fresh `[]` per render would give the memo below a new dependency
    // identity every time; one shared empty array keeps an absent list stable.
    const {
        longTermShopAssets = NO_ROWS,
        pendingOperators = NO_ROWS,
        shopIssue,
        trainingOperators = NO_ROWS,
        unassignedOperators = NO_ROWS
    } = plantNotifications || {}

    const openOnAsset = useCallback(
        (asset) => () => {
            setEmbeddedView?.(getAssetViewType(asset.type))
            setEmbeddedViewSearch?.(asset.identifier || '')
            setEmbeddedViewProps?.(null)
        },
        [setEmbeddedView, setEmbeddedViewProps, setEmbeddedViewSearch]
    )
    /* Each Operators alert pre-applies the status filter that matches the
     * row's intent so the popup opens on the relevant subset instead of the
     * full roster. The filter strings must match `OperatorsView`'s status
     * options exactly (see `statuses` / synthetic options in that view). */
    const openOperators = useCallback(
        (initialStatusFilter) => () => {
            setEmbeddedView?.('operators')
            setEmbeddedViewSearch?.('')
            setEmbeddedViewProps?.(initialStatusFilter ? { initialStatusFilter } : null)
        },
        [setEmbeddedView, setEmbeddedViewProps, setEmbeddedViewSearch]
    )

    /* Single ordered list — fleet bottleneck first, then long-term shop
     * assets, then operator pipeline counts. Per-truck open-issue rollups
     * stay in the asset views where they read better.
     *
     * Built once per notification payload rather than per render: the expand
     * toggle is a click handler, and rebuilding the list inside it puts the
     * whole walk on the interaction's critical path. */
    const allRows = useMemo(() => {
        const rows = []
        if (shopIssue) {
            rows.push({
                id: 'FLEET',
                key: 'shop',
                message: 'In-shop count crossed bottleneck threshold',
                metric: `${shopIssue.inShopCount} / ${shopIssue.spareCount}`,
                severity: 'danger'
            })
        }
        longTermShopAssets.forEach((asset, i) => {
            rows.push({
                id: asset.identifier || asset.type,
                key: `long-${i}`,
                message: `${asset.type} long-term in shop${asset.downInYard ? ' (down in yard)' : ''}`,
                metric: `${asset.daysInShop}d`,
                onClick: openOnAsset(asset),
                severity: 'warning'
            })
        })
        if (unassignedOperators.length > 0) {
            rows.push({
                id: 'OPS',
                key: 'unassigned',
                message: 'Unassigned operators',
                metric: unassignedOperators.length,
                onClick: openOperators('Unassigned Active'),
                severity: 'warning'
            })
        }
        if (pendingOperators.length > 0) {
            rows.push({
                id: 'OPS',
                key: 'pending',
                message: 'Operators awaiting start date',
                metric: pendingOperators.length,
                onClick: openOperators('Pending Start'),
                severity: 'info'
            })
        }
        if (trainingOperators.length > 0) {
            rows.push({
                id: 'OPS',
                key: 'training',
                message: 'Operators currently in training',
                metric: trainingOperators.length,
                onClick: openOperators('Training'),
                severity: 'info'
            })
        }
        return rows
    }, [
        longTermShopAssets,
        openOnAsset,
        openOperators,
        pendingOperators,
        shopIssue,
        trainingOperators,
        unassignedOperators
    ])

    const counts = useMemo(
        () =>
            allRows.reduce(
                (acc, row) => {
                    acc[row.severity] = (acc[row.severity] || 0) + 1
                    return acc
                },
                { danger: 0, info: 0, warning: 0 }
            ),
        [allRows]
    )

    const totalCount = allRows.length

    if (totalCount === 0) {
        return (
            <Panel id="alerts" title="Alerts">
                <p className="m-0 text-[13px] text-text-secondary">All clear. No active alerts.</p>
            </Panel>
        )
    }

    const visibleRows = expanded ? allRows : allRows.slice(0, COLLAPSED_LIMIT)
    const hiddenCount = totalCount - visibleRows.length
    const canExpand = totalCount > COLLAPSED_LIMIT
    /* Stagger only the newly revealed rows on expand — the first batch is
     * already on screen and shouldn't re-animate when the user toggles. */
    const staggerOffset = expanded ? COLLAPSED_LIMIT : visibleRows.length

    const headerRight = <span className="text-[12px] tabular-nums text-text-secondary">{severitySummary(counts)}</span>

    return (
        <Panel id="alerts" title="Alerts" right={headerRight} innerClassName="">
            <div className="flex flex-col">
                {visibleRows.map((row, idx) => (
                    <AlertRow
                        key={row.key}
                        id={row.id}
                        index={idx}
                        message={row.message}
                        metric={row.metric}
                        onClick={row.onClick}
                        severity={row.severity}
                        staggerOffset={staggerOffset}
                    />
                ))}
                {canExpand && (
                    <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        aria-expanded={expanded}
                        className="flex w-full items-center gap-1.5 border-0 bg-transparent px-4 py-2.5 text-left text-[13px] font-medium cursor-pointer text-text-secondary transition-colors duration-150 ease-out hover:text-text-primary hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                        <span>{expanded ? 'Show less' : `View ${hiddenCount} more`}</span>
                        <i
                            aria-hidden="true"
                            className={`fas fa-chevron-down text-[9px] transition-transform duration-200 ease-out motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                        />
                    </button>
                )}
            </div>
        </Panel>
    )
}
