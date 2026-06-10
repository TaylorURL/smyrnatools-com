import React from 'react'

import Badge from '../common/Badge'
import { MaintenanceTabSwitcher } from './MaintenanceTabSwitcher'

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

/** Refresh button — disables itself while a sync is already in flight so the
 *  user can't queue overlapping fetches. Mirrors PlanActionButtons styling so
 *  the two surfaces feel identical. */
function RefreshButton({ isMobile, isSyncing, onClick }) {
    return (
        <button
            type="button"
            onClick={() => onClick?.()}
            disabled={isSyncing}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-text-secondary bg-bg-tertiary transition-all duration-150 ease-out hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100 motion-reduce:transition-none ${FOCUS_RING}`}
            title="Refresh maintenance data"
        >
            <i className={`fas fa-rotate ${isSyncing ? 'fa-spin' : ''}`} aria-hidden="true" />
            {!isMobile && <span>{isSyncing ? 'Syncing…' : 'Refresh'}</span>}
        </button>
    )
}

/** Primary CTA — accent-coloured, optional on tabs that support an "Add" /
 *  "Create" action. Collapses to icon on mobile. */
function PrimaryActionButton({ icon, isMobile, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 ease-out hover:bg-accent-hover active:scale-[0.97] motion-reduce:transition-none ${FOCUS_RING}`}
            title={label}
            aria-label={label}
        >
            <i className={`fas ${icon}`} aria-hidden="true" />
            {!isMobile && <span>{label}</span>}
        </button>
    )
}

/** Region scope chip — single inline pill identical to the dashboard's region
 *  callout, anchors the user inside the currently selected region without
 *  occupying its own row. */
function RegionScopeChip({ regionLabel }) {
    if (!regionLabel) return null
    return (
        <Badge
            tone="neutral"
            variant="custom"
            size="lg"
            shape="rounded-md"
            weight="medium"
            uppercase={false}
            icon="location-dot"
            className="max-w-full bg-bg-secondary border border-border-light text-text-primary"
        >
            <span className="truncate">{regionLabel}</span>
        </Badge>
    )
}

/**
 * Slim sticky header shared by every Maintenance tab.
 */
export function MaintenanceHeader({
    activeTab,
    isMobile,
    isSyncing,
    onChangeTab,
    onPrimaryAction,
    onRefresh,
    primaryActionIcon,
    primaryActionLabel,
    regionLabel,
    tabs
}) {
    return (
        <div className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-2 border-b px-3 sm:px-4 py-2.5 bg-bg-primary border-border-light">
            <h1 className="font-heading text-lg font-semibold tracking-tight m-0 shrink-0 text-text-primary">
                Maintenance
            </h1>
            <RegionScopeChip regionLabel={regionLabel} />
            <div className="flex-1 min-w-[8px]" />
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {onRefresh && <RefreshButton isMobile={isMobile} isSyncing={isSyncing} onClick={onRefresh} />}
                {onPrimaryAction && primaryActionLabel && (
                    <PrimaryActionButton
                        icon={primaryActionIcon || 'fa-plus'}
                        isMobile={isMobile}
                        label={primaryActionLabel}
                        onClick={onPrimaryAction}
                    />
                )}
            </div>
            <MaintenanceTabSwitcher activeTab={activeTab} isMobile={isMobile} onChange={onChangeTab} tabs={tabs} />
        </div>
    )
}
