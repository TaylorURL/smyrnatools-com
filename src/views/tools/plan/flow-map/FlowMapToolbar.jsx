import React from 'react'

import Badge from '../../../../app/components/common/Badge'
import { SELECTED_FILL_COLOR } from './flowMapShared'

/** Toolbar above the Leaflet surface — stat chips on the left, transient
 *  state pills on the right (picking banner, selected-plant chip, routing
 *  spinner). The selected-plant chip uses the fixed map-highlight color
 *  (sky-900) so its tint matches the selected pin's fill — the map's
 *  visual language stays accent-independent. The route-count chip prefers
 *  the actual rendered polyline count and falls back to the raw assignment
 *  count before the polylines have mounted on the first paint. */
export function FlowMapToolbar({
    activeRouteCount,
    pendingPlantGeocodes,
    pendingRoutes,
    pickingDestination,
    plantCount,
    selectedCode,
    setPickingDestination,
    setSelectedCode
}) {
    const loadingLabel = pendingPlantGeocodes > 0 ? `Locating ${pendingPlantGeocodes}…` : `Routing ${pendingRoutes}…`

    return (
        <div className="shrink-0 flex items-center flex-wrap gap-2 px-3 sm:px-4 py-2 bg-bg-primary border-b border-border-light">
            <div className="inline-flex rounded-lg border border-border-light bg-bg-secondary overflow-hidden shadow-sm">
                <Badge
                    tone="neutral"
                    variant="custom"
                    size="lg"
                    shape="square"
                    weight="medium"
                    uppercase={false}
                    icon={<i className="fas fa-building text-[10px] text-text-tertiary" aria-hidden="true" />}
                    className="px-3 py-1.5 text-[12px] transition-colors hover:bg-bg-tertiary rounded-none"
                >
                    <span className="font-mono tabular-nums font-bold text-text-primary">{plantCount}</span>
                    <span className="text-text-secondary text-[11.5px] ml-1">plants</span>
                </Badge>
                <span className="w-px self-stretch bg-border-light" aria-hidden="true" />
                <Badge
                    tone="neutral"
                    variant="custom"
                    size="lg"
                    shape="square"
                    weight="medium"
                    uppercase={false}
                    icon={<i className="fas fa-route text-[10px] text-text-tertiary" aria-hidden="true" />}
                    className="px-3 py-1.5 text-[12px] transition-colors hover:bg-bg-tertiary rounded-none"
                >
                    <span className="font-mono tabular-nums font-bold text-text-primary">{activeRouteCount}</span>
                    <span className="text-text-secondary text-[11.5px] ml-1">help routes</span>
                </Badge>
            </div>
            {pickingDestination && (
                <Badge
                    tone="warning"
                    size="md"
                    shape="pill"
                    weight="semibold"
                    pulse
                    uppercase={false}
                    icon={<i className="fas fa-crosshairs text-[10px]" aria-hidden="true" />}
                    className="pf-tool-pill pf-tool-pill-picking"
                    trailingIcon={
                        <button type="button"
                            type="button"
                            onClick={() => setPickingDestination(false)}
                            className="ml-1 border-none bg-transparent cursor-pointer p-0 text-text-primary font-bold transition-transform hover:scale-110"
                            aria-label="Cancel picking"
                        >
                            ×
                        </button>
                    }
                >
                    Click a plant to set the destination
                </Badge>
            )}
            {selectedCode && !pickingDestination && (
                <Badge
                    variant="custom"
                    bg={`${SELECTED_FILL_COLOR}1a`}
                    fg={SELECTED_FILL_COLOR}
                    size="lg"
                    shape="pill"
                    weight="semibold"
                    uppercase={false}
                    icon={<i className="fas fa-map-pin text-[10px]" aria-hidden="true" />}
                    className="pf-tool-pill transition-all border border-current/30"
                    trailingIcon={
                        <button type="button"
                            type="button"
                            onClick={() => setSelectedCode(null)}
                            className="ml-1 border-none bg-transparent cursor-pointer p-0 font-bold transition-transform hover:scale-110"
                            // eslint-disable-next-line react/forbid-dom-props -- color is paired with the parent badge fg
                            style={{ color: SELECTED_FILL_COLOR }}
                            aria-label="Clear selection"
                        >
                            ×
                        </button>
                    }
                >
                    Plant {selectedCode}
                </Badge>
            )}
            {(pendingPlantGeocodes > 0 || pendingRoutes > 0) && (
                <Badge
                    tone="info"
                    size="md"
                    shape="pill"
                    weight="semibold"
                    uppercase={false}
                    icon={<i className="fas fa-circle-notch fa-spin text-[10px]" aria-hidden="true" />}
                    className="pf-tool-pill"
                >
                    {loadingLabel}
                </Badge>
            )}
            <div className="flex-1 min-w-[8px]" />
        </div>
    )
}
