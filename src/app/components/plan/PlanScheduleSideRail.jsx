import React from 'react'

import { plantBadgeColor } from '../../../utils/PlanUtility'

const ICON_SIZE = 28

/** Plant-scope identity chip — solid colored badge with the plant code, or a
 *  quiet hollow chip when no plant is filtered. */
function PlantScopeChip({ accentColor, activePlantName, plantFilter, plantNotSelected }) {
    const badgeColor = plantNotSelected ? null : plantBadgeColor(plantFilter, accentColor)
    return (
        <div
            className="rounded-md flex items-center justify-center font-bold tabular-nums"
            style={{
                background: plantNotSelected ? 'var(--bg-tertiary)' : badgeColor,
                border: `1px solid ${plantNotSelected ? 'var(--border-light)' : badgeColor}`,
                color: plantNotSelected ? 'var(--text-tertiary)' : '#fff',
                fontSize: 10,
                height: ICON_SIZE,
                width: ICON_SIZE
            }}
            title={
                plantNotSelected
                    ? 'No plant selected'
                    : activePlantName
                      ? `${plantFilter} · ${activePlantName}`
                      : plantFilter
            }
        >
            {plantNotSelected ? <i className="fas fa-circle-dot" style={{ fontSize: 9 }} /> : plantFilter}
        </div>
    )
}

/** Copy-roster button — turns green for ~1.5s after a successful copy. */
function CopyRosterButton({ accentColor, copied, disabled, onClick, plantFilter, plantNotSelected }) {
    const ready = !disabled
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-md flex items-center justify-center border-none cursor-pointer transition-colors disabled:cursor-not-allowed"
            style={{
                background: copied ? '#16a34a' : ready ? accentColor : 'var(--bg-secondary)',
                border: `1px solid ${copied ? '#16a34a' : ready ? accentColor : 'var(--border-light)'}`,
                color: copied || ready ? '#fff' : 'var(--text-tertiary)',
                height: ICON_SIZE,
                opacity: ready || copied ? 1 : 0.7,
                width: ICON_SIZE
            }}
            title={
                plantNotSelected
                    ? 'Pick a single plant first.'
                    : copied
                      ? 'Copied operator clock-in times'
                      : `Copy operator clock-in times for ${plantFilter}. Off-shift operators included.`
            }
            aria-label="Copy operator clock-in times"
        >
            <i className={`fas fa-${copied ? 'check' : 'copy'}`} style={{ fontSize: 10 }} />
        </button>
    )
}

/** Extras toggle — flips the synthetic schedule rows on/off. Carries an
 *  accent dot when active so it's visible at a glance even when minimized. */
function ExtrasToggleButton({ accentColor, active, disabled, onClick, plantNotSelected, showExtraRows }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-md flex items-center justify-center border-none cursor-pointer disabled:cursor-not-allowed relative"
            style={{
                background: active ? `${accentColor}20` : 'var(--bg-secondary)',
                border: `1px solid ${active ? accentColor : 'var(--border-light)'}`,
                color: active ? accentColor : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                height: ICON_SIZE,
                opacity: disabled ? 0.6 : 1,
                width: ICON_SIZE
            }}
            title={
                plantNotSelected
                    ? 'Pick a single plant to enable.'
                    : `${showExtraRows ? 'Hide' : 'Show'} extra rows — returns, help moves, send-home, slot suggestions, pull-ups.`
            }
            aria-label="Toggle extra schedule rows"
            aria-pressed={active}
        >
            <i className="fas fa-layer-group" style={{ fontSize: 10 }} />
            {active && (
                <span
                    className="absolute rounded-full"
                    style={{
                        background: accentColor,
                        bottom: 3,
                        boxShadow: '0 0 0 1.5px var(--bg-primary)',
                        height: 5,
                        right: 3,
                        width: 5
                    }}
                />
            )}
        </button>
    )
}

/**
 * Compact icon rail (desktop) / inline pill cluster (mobile) hosting
 * per-plant quick actions: a colored plant-scope chip, copy the operator
 * roster, and toggle the synthetic schedule rows. Always minimized — labels
 * live in tooltips and short legends so the rail takes minimal horizontal /
 * vertical space and never crowds the schedule.
 *
 * The same JSX backs the desktop sticky rail and the mobile horizontal
 * cluster — `direction` flips the flex layout.
 */
export default function PlanScheduleSideRail({
    accentColor,
    activePlantName,
    direction = 'col',
    onCopyRoster,
    onToggleExtraRows,
    operatorRosterCopied,
    operatorRosterReady,
    plantFilter,
    showExtraRows
}) {
    const plantNotSelected = plantFilter === 'all'
    const extrasToggleEnabled = !plantNotSelected
    const wrapperClass =
        direction === 'row'
            ? 'flex flex-row items-center gap-2 px-2 py-1.5'
            : 'flex flex-col items-center gap-1.5 px-1 py-1.5'
    return (
        <div className={wrapperClass}>
            <PlantScopeChip
                accentColor={accentColor}
                activePlantName={activePlantName}
                plantFilter={plantFilter}
                plantNotSelected={plantNotSelected}
            />
            {/* Hairline separator visually grouping the scope chip apart
                from the action buttons — kept in both row and column
                layouts so the desktop and mobile rails stay identical. */}
            <div style={{ background: 'var(--border-light)', height: 1, width: 18 }} />
            <CopyRosterButton
                accentColor={accentColor}
                copied={operatorRosterCopied}
                disabled={!operatorRosterReady}
                onClick={onCopyRoster}
                plantFilter={plantFilter}
                plantNotSelected={plantNotSelected}
            />
            <ExtrasToggleButton
                accentColor={accentColor}
                active={extrasToggleEnabled && showExtraRows}
                disabled={!extrasToggleEnabled}
                onClick={() => extrasToggleEnabled && onToggleExtraRows()}
                plantNotSelected={plantNotSelected}
                showExtraRows={showExtraRows}
            />
        </div>
    )
}
