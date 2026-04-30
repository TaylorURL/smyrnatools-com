import React from 'react'

const ZOOM_DISABLED_EPSILON = 0.001

/**
 * Sticky top bar above the flow canvas: title chip, destination-picker
 * cancel chip, "Clear selection" button, and the zoom pill (out / reset / in).
 */
export function PlanFlowToolbar({
    accentColor,
    edgeCount,
    onCancelPicking,
    onClearSelection,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    pickingDestination,
    plantCount,
    selectedCode,
    zoom,
    zoomLimits
}) {
    const zoomOutDisabled = zoom <= zoomLimits.min + ZOOM_DISABLED_EPSILON
    const zoomInDisabled = zoom >= zoomLimits.max - ZOOM_DISABLED_EPSILON

    return (
        <div className="sticky top-0 z-30 flex items-start justify-between gap-3 p-4 pointer-events-none">
            <div
                className="pointer-events-auto px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <i className="fas fa-project-diagram text-[11px]" style={{ color: accentColor }} />
                <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Flow</b>
                <span style={{ color: 'var(--text-secondary)' }}>
                    · {edgeCount} route{edgeCount === 1 ? '' : 's'} · {plantCount} plant{plantCount === 1 ? '' : 's'}
                </span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
                {pickingDestination && (
                    <div
                        className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold animate-pulse"
                        style={{ background: '#f59e0b', color: '#fff' }}
                    >
                        <i className="fas fa-crosshairs text-[11px]" />
                        Click a plant to set destination
                        <button
                            onClick={onCancelPicking}
                            className="border-none bg-white/20 rounded px-1.5 py-0.5 text-[10px] cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                )}
                {selectedCode && !pickingDestination && (
                    <button
                        onClick={onClearSelection}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 border-none"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <i className="fas fa-times text-[10px]" /> Clear
                    </button>
                )}
                <div
                    className="flex items-center rounded-lg overflow-hidden"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    <button
                        onClick={onZoomOut}
                        disabled={zoomOutDisabled}
                        className="px-2.5 py-1.5 border-none bg-transparent cursor-pointer text-xs"
                        style={{ color: 'var(--text-secondary)', opacity: zoomOutDisabled ? 0.4 : 1 }}
                        title="Zoom out"
                    >
                        <i className="fas fa-magnifying-glass-minus" />
                    </button>
                    <button
                        onClick={onZoomReset}
                        className="px-2.5 py-1.5 border-none bg-transparent cursor-pointer text-[11px] font-semibold"
                        style={{
                            color: 'var(--text-primary)',
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 46
                        }}
                        title="Reset zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        onClick={onZoomIn}
                        disabled={zoomInDisabled}
                        className="px-2.5 py-1.5 border-none bg-transparent cursor-pointer text-xs"
                        style={{ color: 'var(--text-secondary)', opacity: zoomInDisabled ? 0.4 : 1 }}
                        title="Zoom in"
                    >
                        <i className="fas fa-magnifying-glass-plus" />
                    </button>
                </div>
            </div>
        </div>
    )
}
