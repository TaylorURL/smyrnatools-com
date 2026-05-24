import 'leaflet/dist/leaflet.css'

import React, { useEffect, useMemo, useRef } from 'react'

import { PlanFlowRouteEditor } from '../../../app/components/plan/tabs/flow/PlanFlowRouteEditor'
import { PlanFlowEmptyPanel, PlanFlowPlantOverview } from '../../../app/components/plan/tabs/flow/PlanFlowSidePanel'
import { PlanFlowTimeScrubber } from '../../../app/components/plan/tabs/flow/PlanFlowTimeScrubber'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useAutoplay } from '../../../app/hooks/useAutoplay'
import { useDirectLoadLines } from '../../../app/hooks/useDirectLoadLines'
import { useDraftRoute } from '../../../app/hooks/useDraftRoute'
import { useFitToPlants } from '../../../app/hooks/useFitToPlants'
import { useFlowMapInstance } from '../../../app/hooks/useFlowMapInstance'
import { useJobPins } from '../../../app/hooks/useJobPins'
import { useJobRoutes } from '../../../app/hooks/useJobRoutes'
import { usePlanFlowEditor } from '../../../app/hooks/usePlanFlowEditor'
import { usePlanFlowMetrics } from '../../../app/hooks/usePlanFlowMetrics'
import { usePlantGeocoding } from '../../../app/hooks/usePlantGeocoding'
import { usePlantMarkers } from '../../../app/hooks/usePlantMarkers'
import { useRouteFetching } from '../../../app/hooks/useRouteFetching'
import { useRoutePolylines } from '../../../app/hooks/useRoutePolylines'
import { yphColorFor } from '../../../utils/PlanFlowLayoutUtility'
import {
    getMissingOperators,
    getSaturdayOverride,
    isSaturday,
    setMissingOperators,
    setSaturdayOverride
} from '../../../utils/PlanUtility'
import { resolveStateHint } from './flow-map/flowMapShared'
import { FlowMapStyleSheet } from './flow-map/FlowMapStyleSheet'
import { FlowMapToolbar } from './flow-map/FlowMapToolbar'

/**
 * PlanFlowMapView — Planner tab backed by a real OpenStreetMap surface.
 *
 *   • Plants render as DivIcon markers at their real lat/lng (from the
 *     `plants` table or geocoded via Nominatim).
 *   • Each assignment renders as a Leaflet polyline that follows the
 *     actual driving route returned by OSRM, instead of a straight
 *     schematic line. While a route is still loading we draw a dashed
 *     straight-line placeholder so the edge is visible immediately.
 *   • The side rail (overview / route editor) is unchanged from the
 *     legacy schematic Planner — node clicks, "Send Help" picking, and
 *     edit / delete flows route through the same `usePlanFlowEditor`
 *     hook so behaviour stays identical.
 */
function PlanFlowMapView({
    accentColor,
    assignments,
    calcClockIn,
    canEdit = false,
    getTravelTime,
    mixerCountsByPlant,
    planDate,
    plantProduction,
    plants = [],
    setAssignments,
    setPlantProduction,
    stats
}) {
    const { preferences } = usePreferences()
    const stateHint = resolveStateHint(preferences?.selectedRegion)

    const {
        containerRef,
        directLinesByKeyRef,
        draftPolylineRef,
        initiallyFitRef,
        jobLayerRef,
        jobMarkersByKeyRef,
        mapRef,
        markersByCodeRef,
        plantLayerRef,
        polylinesByEdgeRef,
        routeLayerRef
    } = useFlowMapInstance()

    const { geocodedPlants, pendingPlantGeocodes } = usePlantGeocoding(plants, stateHint)
    const { pendingRoutes, routesByEdgeKey } = useRouteFetching(assignments, geocodedPlants)
    const jobRoutesByIdx = useJobRoutes({ assignments, geocodedPlants, plantProduction, plants, stateHint })

    const {
        cancelEditor,
        deleteAssignment,
        draft,
        editingIndex,
        handleNodeClick,
        openAddRoute,
        openEditRoute,
        panelMode,
        pickingDestination,
        selectedCode,
        setDraft,
        setPickingDestination,
        setSelectedCode,
        submitEditor
    } = usePlanFlowEditor({ assignments, setAssignments })

    const { handlePlayToggle, isPlaying, setViewTime, viewTime } = useAutoplay(panelMode)

    /* Leaflet marker click handlers are bound once when the marker is
     * created and never re-bound, so a closure over `handleNodeClick`
     * captures the React state at that moment. Without this ref, opening
     * the route editor toggles `pickingDestination` in React state but
     * the marker still fires the original handler — which only ever sees
     * `pickingDestination=false` and falls through to plain selection
     * instead of setting the destination. The ref always points at the
     * latest handler so the click sees current state. */
    const handleNodeClickRef = useRef(handleNodeClick)
    useEffect(() => {
        handleNodeClickRef.current = handleNodeClick
    }, [handleNodeClick])

    /* ── All-plants stats (mirrors PlanFlowView) ────────────────── */
    const allPlantStats = useMemo(() => {
        const existing = new Map(stats.map((stat) => [stat.code, stat]))
        const list = (plants || []).map((plant) => {
            const code = plant.plant_code
            if (existing.has(code)) return existing.get(code)
            const base = mixerCountsByPlant?.[code] || 0
            return { base, code, eff: base, recv: 0, send: 0 }
        })
        stats.forEach((stat) => {
            if (!list.some((entry) => entry.code === stat.code)) list.push(stat)
        })
        return list.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [plants, stats, mixerCountsByPlant])

    const { activeOrdersAtTime, effAtViewTime, leaveOffByCode, minPoolByCode, poolAtViewTime, thresholds, yphByCode } =
        usePlanFlowMetrics({ assignments, getTravelTime, planDate, plantProduction, stats, viewTime })

    useFitToPlants({ geocodedPlants, initiallyFitRef, mapRef })

    usePlantMarkers({
        accentColor,
        activeOrdersAtTime,
        allPlantStats,
        draft,
        effAtViewTime,
        geocodedPlants,
        handleNodeClickRef,
        leaveOffByCode,
        markersByCodeRef,
        minPoolByCode,
        pickingDestination,
        planDate,
        plantLayerRef,
        plantProduction,
        poolAtViewTime,
        selectedCode,
        thresholds,
        viewTime,
        yphByCode
    })

    useRoutePolylines({
        assignments,
        geocodedPlants,
        getTravelTime,
        jobRoutesByIdx,
        polylinesByEdgeRef,
        routeLayerRef,
        routesByEdgeKey,
        selectedCode,
        viewTime
    })

    useJobPins({ assignments, jobLayerRef, jobMarkersByKeyRef, jobRoutesByIdx, viewTime })

    useDirectLoadLines({ assignments, directLinesByKeyRef, geocodedPlants, jobRoutesByIdx, routeLayerRef })

    useDraftRoute({ draft, draftPolylineRef, geocodedPlants, panelMode, routeLayerRef })

    const selected = selectedCode ? allPlantStats.find((stat) => stat.code === selectedCode) : null

    const outbound = useMemo(() => {
        if (!selectedCode) return []
        return assignments
            .map((assignment, idx) => ({ ...assignment, idx }))
            .filter((assignment) => assignment.fromPlant === selectedCode && assignment.toPlant)
    }, [assignments, selectedCode])
    const inbound = useMemo(() => {
        if (!selectedCode) return []
        return assignments
            .map((assignment, idx) => ({ ...assignment, idx }))
            .filter((assignment) => assignment.toPlant === selectedCode && assignment.fromPlant)
    }, [assignments, selectedCode])

    const draftTravel =
        draft?.fromPlant && draft?.toPlant && getTravelTime ? getTravelTime(draft.fromPlant, draft.toPlant) : null
    const draftClockIn =
        draft?.fromPlant && draft?.toPlant && draft?.time && calcClockIn
            ? calcClockIn(draft.time, draft.fromPlant, draft.toPlant)
            : null

    const scrubberActivityCount = Number.isFinite(viewTime) ? Object.keys(activeOrdersAtTime || {}).length : null

    const activeRouteCount =
        Object.keys(polylinesByEdgeRef.current).length ||
        assignments.filter((a) => a.fromPlant && a.toPlant && a.fromPlant !== a.toPlant).length

    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <FlowMapStyleSheet />

            <div className="pf-flow-shell relative flex-1 flex flex-col">
                <FlowMapToolbar
                    accentColor={accentColor}
                    activeRouteCount={activeRouteCount}
                    pendingPlantGeocodes={pendingPlantGeocodes}
                    pendingRoutes={pendingRoutes}
                    pickingDestination={pickingDestination}
                    plantCount={allPlantStats.length}
                    selectedCode={selectedCode}
                    setPickingDestination={setPickingDestination}
                    setSelectedCode={setSelectedCode}
                />

                <div className="flex-1 min-h-0 relative">
                    <div className="h-full w-full" ref={containerRef} />
                    {/* Scrubber docks flush in the bottom-right corner so
                     * it sits directly over the Leaflet attribution
                     * watermark instead of leaving a strip of map behind
                     * it. The wrapper z-index has to clear Leaflet's
                     * default `.leaflet-control` (z=800) — otherwise the
                     * attribution renders on top of the scrubber.
                     * `pointer-events-none` on the wrapper keeps the
                     * map draggable everywhere the scrubber doesn't
                     * physically occupy. */}
                    <div className="absolute bottom-0 right-0 z-[1000] pointer-events-none">
                        <PlanFlowTimeScrubber
                            accentColor={accentColor}
                            hasActivity={scrubberActivityCount}
                            isPlaying={isPlaying}
                            onChange={setViewTime}
                            onPlayToggle={handlePlayToggle}
                            viewTime={viewTime}
                        />
                    </div>
                </div>
            </div>

            <aside className="w-[360px] shrink-0 overflow-y-auto flex flex-col bg-bg-primary border-l border-border-light">
                {!selected && panelMode === 'overview' && <PlanFlowEmptyPanel accentColor={accentColor} />}
                {selected && panelMode === 'overview' && (
                    <PlanFlowPlantOverview
                        accentColor={accentColor}
                        selected={selected}
                        mixerCountsByPlant={mixerCountsByPlant}
                        missingOperators={getMissingOperators(plantProduction, selected.code)}
                        onMissingOperatorsChange={(count) =>
                            setMissingOperators(setPlantProduction, selected.code, count)
                        }
                        isSaturday={isSaturday(planDate)}
                        saturdayOverride={getSaturdayOverride(plantProduction, selected.code)}
                        onSaturdayOverrideChange={(count) =>
                            setSaturdayOverride(setPlantProduction, selected.code, count)
                        }
                        yphByCode={yphByCode}
                        yphColorFor={yphColorFor}
                        production={plantProduction[selected.code] || {}}
                        outbound={outbound}
                        inbound={inbound}
                        canEdit={canEdit}
                        onAddRoute={() => openAddRoute(selected)}
                        onEditRoute={openEditRoute}
                        onDeleteRoute={deleteAssignment}
                        calcClockIn={calcClockIn}
                        getTravelTime={getTravelTime}
                    />
                )}
                {(panelMode === 'add' || panelMode === 'edit') && draft && (
                    <PlanFlowRouteEditor
                        accentColor={accentColor}
                        mode={panelMode}
                        draft={draft}
                        setDraft={setDraft}
                        plantProduction={plantProduction}
                        plants={plants}
                        stats={allPlantStats}
                        travel={draftTravel}
                        clockIn={draftClockIn}
                        pickingDestination={pickingDestination}
                        setPickingDestination={setPickingDestination}
                        onCancel={cancelEditor}
                        onSubmit={submitEditor}
                        onDelete={panelMode === 'edit' ? () => deleteAssignment(editingIndex) : null}
                    />
                )}
            </aside>

            {effAtViewTime && null /* keep linter happy until v2 surfaces this in the marker label */}
        </div>
    )
}

export default PlanFlowMapView
