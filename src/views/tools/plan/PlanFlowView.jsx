import React, { useMemo, useState } from 'react'

import { PlanFlowEdgeJobs, PlanFlowEdgeLabels, PlanFlowEdgeLines } from '../../../app/components/plan/PlanFlowEdges'
import { PlanFlowNode } from '../../../app/components/plan/PlanFlowNode'
import { PlanFlowRouteEditor } from '../../../app/components/plan/PlanFlowRouteEditor'
import { PlanFlowEmptyPanel, PlanFlowPlantOverview } from '../../../app/components/plan/PlanFlowSidePanel'
import { PlanFlowTimeScrubber } from '../../../app/components/plan/PlanFlowTimeScrubber'
import { PlanFlowToolbar } from '../../../app/components/plan/PlanFlowToolbar'
import { usePlanFlowCanvas } from '../../../app/hooks/usePlanFlowCanvas'
import { usePlanFlowEditor } from '../../../app/hooks/usePlanFlowEditor'
import { usePlanFlowMetrics } from '../../../app/hooks/usePlanFlowMetrics'
import { computeEdgeJobs, computeLabelLayout } from '../../../utils/PlanFlowUtility'
import { getMissingOperators, setMissingOperators } from '../../../utils/PlanUtility'
import {
    buildEdges,
    computeBidirectionalEdgeKeys,
    computeClusterLayout,
    radiusForOps,
    relaxLayoutForEdges,
    yphColorFor
} from '../../../utils/PlanFlowLayoutUtility'

/**
 * PlanFlowView — plants as nodes, assignments as directed edges. The side
 * rail doubles as the planner: click a plant to see its routes, "Send
 * Trucks" opens an inline form where the destination can be picked from a
 * dropdown or by clicking another node on the canvas. Zoom controls sit
 * in the top-right for working with dense plans.
 */
function PlanFlowView({
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
    const [hoverEdgeKey, setHoverEdgeKey] = useState(null)
    // viewTime: minutes since midnight (null = whole-day view). When set,
    // the "needs help" badge flips from day-aggregate peak-overbook to a
    // point-in-time check: pool(t) < 0 AND a job is actively pouring at t.
    const [viewTime, setViewTime] = useState(null)

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

    const { beginPan, canvasRef, canvasSize, isPanning, zoom, zoomIn, zoomLimits, zoomOut, zoomReset } =
        usePlanFlowCanvas({ pickingDestination })

    // Build a stats list that includes EVERY plant — not just ones with
    // mixers or assignments. Guarantees every plant shows up as a node and
    // can be picked from the flow view without detouring to the Planner tab.
    const allPlantStats = useMemo(() => {
        const existing = new Map(stats.map((stat) => [stat.code, stat]))
        const list = (plants || []).map((plant) => {
            const code = plant.plant_code
            if (existing.has(code)) return existing.get(code)
            const base = mixerCountsByPlant?.[code] || 0
            return { base, code, eff: base, recv: 0, send: 0 }
        })
        // Plants may exist only via an assignment's fromPlant/toPlant.
        stats.forEach((stat) => {
            if (!list.some((entry) => entry.code === stat.code)) list.push(stat)
        })
        return list.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [plants, stats, mixerCountsByPlant])

    const nodeItems = useMemo(
        () => allPlantStats.map((stat) => ({ code: stat.code, radius: radiusForOps(stat.eff) })),
        [allPlantStats]
    )
    const radiusByCode = useMemo(() => {
        const out = {}
        nodeItems.forEach((item) => {
            out[item.code] = item.radius
        })
        return out
    }, [nodeItems])

    const baseLayout = useMemo(
        () => computeClusterLayout(nodeItems, canvasSize.width, canvasSize.height),
        [nodeItems, canvasSize]
    )
    const edges = useMemo(() => buildEdges(assignments), [assignments])
    const bidirectionalEdgeKeys = useMemo(() => computeBidirectionalEdgeKeys(edges), [edges])
    const edgeJobs = useMemo(
        () => computeEdgeJobs(edges, assignments, plantProduction),
        [edges, assignments, plantProduction]
    )
    // Push any plant whose centre lies on top of an edge perpendicular to
    // that edge so the route line never has to pass straight through a
    // third node.
    const layout = useMemo(() => relaxLayoutForEdges(baseLayout, nodeItems, edges), [baseLayout, nodeItems, edges])
    const { positions, width: layoutWidth, height: layoutHeight } = layout

    const { activeOrdersAtTime, effAtViewTime, leaveOffByCode, minPoolByCode, poolAtViewTime, thresholds, yphByCode } =
        usePlanFlowMetrics({ assignments, planDate, plantProduction, stats, viewTime })

    const selected = selectedCode ? allPlantStats.find((stat) => stat.code === selectedCode) : null
    const hasNodes = nodeItems.length > 0 && Object.keys(positions).length > 0

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

    const activeRelatedEdges = useMemo(() => {
        if (!selectedCode) return new Set()
        return new Set(
            edges
                .filter((edge) => edge.from === selectedCode || edge.to === selectedCode)
                .map((edge) => `${edge.from}->${edge.to}`)
        )
    }, [edges, selectedCode])

    const labelLayout = useMemo(
        () =>
            computeLabelLayout({
                allPlantStats,
                bidirectionalEdgeKeys,
                edges,
                positions,
                radiusByCode
            }),
        [edges, positions, allPlantStats, radiusByCode, bidirectionalEdgeKeys]
    )

    const scrubberActivityCount = Number.isFinite(viewTime) ? Object.keys(activeOrdersAtTime || {}).length : null

    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <div
                ref={canvasRef}
                onMouseDown={beginPan}
                className="relative flex-1 overflow-auto select-none"
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    backgroundImage: 'radial-gradient(circle at 12px 12px, var(--border-light) 1px, transparent 1.5px)',
                    backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                    cursor: pickingDestination ? 'crosshair' : isPanning ? 'grabbing' : 'grab'
                }}
            >
                <PlanFlowToolbar
                    accentColor={accentColor}
                    edgeCount={edges.length}
                    onCancelPicking={() => setPickingDestination(false)}
                    onClearSelection={() => setSelectedCode(null)}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onZoomReset={zoomReset}
                    pickingDestination={pickingDestination}
                    plantCount={allPlantStats.length}
                    selectedCode={selectedCode}
                    zoom={zoom}
                    zoomLimits={zoomLimits}
                />

                <PlanFlowTimeScrubber
                    accentColor={accentColor}
                    viewTime={viewTime}
                    onChange={setViewTime}
                    hasActivity={scrubberActivityCount}
                />

                {/* Zoomable layer — wrapped in a flex centerer so when the scaled
                    content is narrower than the viewport it stays horizontally
                    centered (instead of clinging to the left edge), and when
                    wider the scroll container still pans normally. */}
                <div className="flex justify-center" style={{ minHeight: 'calc(100% - 0px)', minWidth: '100%' }}>
                    <div
                        className="relative shrink-0"
                        style={{
                            height: `${layoutHeight * zoom}px`,
                            width: `${layoutWidth * zoom}px`
                        }}
                    >
                        <div
                            className="absolute top-0 left-0"
                            style={{
                                height: `${layoutHeight}px`,
                                transform: `scale(${zoom})`,
                                transformOrigin: '0 0',
                                width: `${layoutWidth}px`
                            }}
                        >
                            {hasNodes && (
                                <PlanFlowEdgeLines
                                    accentColor={accentColor}
                                    activeRelatedEdges={activeRelatedEdges}
                                    bidirectionalEdgeKeys={bidirectionalEdgeKeys}
                                    edges={edges}
                                    height={layoutHeight}
                                    hoverEdgeKey={hoverEdgeKey}
                                    positions={positions}
                                    radiusByCode={radiusByCode}
                                    selectedCode={selectedCode}
                                    width={layoutWidth}
                                />
                            )}

                            {hasNodes && (
                                <PlanFlowEdgeLabels
                                    accentColor={accentColor}
                                    activeRelatedEdges={activeRelatedEdges}
                                    edges={edges}
                                    height={layoutHeight}
                                    labelLayout={labelLayout}
                                    onHoverEdge={setHoverEdgeKey}
                                    selectedCode={selectedCode}
                                    width={layoutWidth}
                                />
                            )}

                            {hasNodes && (
                                <PlanFlowEdgeJobs
                                    activeRelatedEdges={activeRelatedEdges}
                                    bidirectionalEdgeKeys={bidirectionalEdgeKeys}
                                    edgeJobs={edgeJobs}
                                    positions={positions}
                                    selectedCode={selectedCode}
                                />
                            )}

                            {allPlantStats.map((stat) => {
                                const position = positions[stat.code]
                                if (!position) return null
                                return (
                                    <PlanFlowNode
                                        key={stat.code}
                                        accentColor={accentColor}
                                        activeOrdersAtTime={activeOrdersAtTime}
                                        draft={draft}
                                        effAtViewTime={effAtViewTime}
                                        leaveOffByCode={leaveOffByCode}
                                        maxYph={thresholds.MAX_YPH}
                                        minPoolByCode={minPoolByCode}
                                        onClick={handleNodeClick}
                                        pickingDestination={pickingDestination}
                                        plantProduction={plantProduction}
                                        poolAtViewTime={poolAtViewTime}
                                        position={position}
                                        radius={radiusByCode[stat.code]}
                                        selectedCode={selectedCode}
                                        stat={stat}
                                        targetYph={thresholds.TARGET_YPH}
                                        viewTime={viewTime}
                                        yphByCode={yphByCode}
                                    />
                                )
                            })}

                            {!hasNodes && (
                                <div
                                    className="absolute inset-0 flex flex-col items-center justify-center"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    <i className="fas fa-project-diagram text-3xl mb-3 opacity-50" />
                                    <span className="text-sm">
                                        Add plants with production or assignments to see the flow
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <aside
                className="w-[360px] shrink-0 overflow-y-auto flex flex-col"
                style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-light)' }}
            >
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
        </div>
    )
}

export default PlanFlowView
