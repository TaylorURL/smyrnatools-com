/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { MaintenanceTabSwitcher } from './MaintenanceTabSwitcher'

/** Refresh button — disables itself while a sync is already in flight so the
 *  user can't queue overlapping fetches. Mirrors PlanActionButtons styling so
 *  the two surfaces feel identical. */
function RefreshButton({ isMobile, isSyncing, onClick }) {
    return (
        <button
            type="button"
            onClick={() => onClick?.()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 disabled:opacity-60 bg-bg-tertiary text-text-secondary"
            title="Refresh maintenance data"
        >
            <i className={`fas fa-rotate ${isSyncing ? 'fa-spin' : ''}`} />
            {!isMobile && <span>{isSyncing ? 'Syncing…' : 'Refresh'}</span>}
        </button>
    )
}

/** Primary CTA — accent-coloured, optional on tabs that support an "Add" /
 *  "Create" action. Collapses to icon on mobile. */
function PrimaryActionButton({ accentColor, icon, isMobile, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-1.5 border-none rounded-lg cursor-pointer text-xs font-semibold px-3 py-2 text-white"
            style={{ backgroundColor: accentColor }}
            title={label}
        >
            <i className={`fas ${icon}`} />
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
        <span className="inline-flex items-center gap-2 rounded text-[12px] font-medium px-2.5 py-1 max-w-full bg-bg-secondary border border-border-light text-text-primary">
            <i className="fas fa-location-dot text-[10px] text-text-primary" />
            <span className="truncate">{regionLabel}</span>
        </span>
    )
}

/**
 * Slim sticky header shared by every Maintenance tab. Composes a single row:
 *
 *   1. Title.
 *   2. `RegionScopeChip` — current region context.
 *   3. `RefreshButton` + optional primary action (Add/Create).
 *   4. `MaintenanceTabSwitcher` — desktop-only tab toggle.
 *
 * Wraps on narrow viewports so the action buttons never clip off the right
 * edge. Mobile users keep the full row minus tab labels (icon-only switcher).
 */
export function MaintenanceHeader({
    accentColor,
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
            <h1 className="text-lg font-bold tracking-tight m-0 shrink-0 text-text-primary">Maintenance</h1>
            <RegionScopeChip regionLabel={regionLabel} />
            <div className="flex-1 min-w-[8px]" />
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {onRefresh && <RefreshButton isMobile={isMobile} isSyncing={isSyncing} onClick={onRefresh} />}
                {onPrimaryAction && primaryActionLabel && (
                    <PrimaryActionButton
                        accentColor={accentColor}
                        icon={primaryActionIcon || 'fa-plus'}
                        isMobile={isMobile}
                        label={primaryActionLabel}
                        onClick={onPrimaryAction}
                    />
                )}
            </div>
            <MaintenanceTabSwitcher
                accentColor={accentColor}
                activeTab={activeTab}
                isMobile={isMobile}
                onChange={onChangeTab}
                tabs={tabs}
            />
        </div>
    )
}
