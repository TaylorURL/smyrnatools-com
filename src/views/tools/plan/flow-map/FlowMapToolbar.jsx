/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Toolbar above the Leaflet surface — stat chips on the left, transient
 *  state pills on the right (picking banner, selected-plant chip, routing
 *  spinner). The route-count chip prefers the actual rendered polyline
 *  count and falls back to the raw assignment count before the polylines
 *  have mounted on the first paint. */
export function FlowMapToolbar({
    accentColor,
    activeRouteCount,
    pendingPlantGeocodes,
    pendingRoutes,
    pickingDestination,
    plantCount,
    selectedCode,
    setPickingDestination,
    setSelectedCode
}) {
    return (
        <div className="shrink-0 flex items-center flex-wrap gap-2 px-3 sm:px-4 py-2 bg-bg-primary border-b border-border-light">
            <div className="inline-flex rounded-lg border border-border-light bg-bg-secondary overflow-hidden shadow-sm">
                <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 transition-colors hover:bg-bg-tertiary">
                    <i className="fas fa-building text-[10px] text-text-tertiary" />
                    <span className="font-mono tabular-nums font-bold text-text-primary">{plantCount}</span>
                    <span className="text-text-secondary text-[11.5px]">plants</span>
                </span>
                <span className="w-px self-stretch bg-border-light" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 transition-colors hover:bg-bg-tertiary">
                    <i className="fas fa-route text-[10px] text-text-tertiary" />
                    <span className="font-mono tabular-nums font-bold text-text-primary">{activeRouteCount}</span>
                    <span className="text-text-secondary text-[11.5px]">help routes</span>
                </span>
            </div>
            {pickingDestination && (
                <span className="pf-tool-pill pf-tool-pill-picking inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold px-2.5 py-1 bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.4)] text-text-primary">
                    <i className="fas fa-crosshairs text-[10px]" />
                    Click a plant to set the destination
                    <button
                        type="button"
                        onClick={() => setPickingDestination(false)}
                        className="ml-1 border-none bg-transparent cursor-pointer p-0 text-text-primary font-bold transition-transform hover:scale-110"
                        aria-label="Cancel picking"
                    >
                        ×
                    </button>
                </span>
            )}
            {selectedCode && !pickingDestination && (
                <span
                    className="pf-tool-pill inline-flex items-center gap-1.5 rounded-full text-[12px] font-semibold px-2.5 py-1 transition-all"
                    style={{
                        background: `${accentColor}1a`,
                        border: `1px solid ${accentColor}55`,
                        color: accentColor
                    }}
                >
                    <i className="fas fa-map-pin text-[10px]" />
                    Plant {selectedCode}
                    <button
                        type="button"
                        onClick={() => setSelectedCode(null)}
                        className="ml-1 border-none bg-transparent cursor-pointer p-0 font-bold transition-transform hover:scale-110"
                        style={{ color: accentColor }}
                        aria-label="Clear selection"
                    >
                        ×
                    </button>
                </span>
            )}
            {(pendingPlantGeocodes > 0 || pendingRoutes > 0) && (
                <span className="pf-tool-pill inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold px-2.5 py-1 bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.35)] text-text-primary">
                    <i className="fas fa-circle-notch fa-spin text-[10px]" />
                    {pendingPlantGeocodes > 0 ? `Locating ${pendingPlantGeocodes}` : `Routing ${pendingRoutes}`}…
                </span>
            )}
            <div className="flex-1 min-w-[8px]" />
        </div>
    )
}
