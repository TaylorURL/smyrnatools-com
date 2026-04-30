import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
    buildEdges,
    computeBidirectionalEdgeKeys,
    computeClusterLayout,
    radiusForOps
} from '../../../utils/PlanFlowLayoutUtility'
import { usePlanFlowPreviewMetrics } from '../../hooks/usePlanFlowPreviewMetrics'
import { PlanFlowPreviewEdgeLabels, PlanFlowPreviewEdgeLines } from './PlanFlowPreviewEdges'
import { PlanFlowPreviewNode } from './PlanFlowPreviewNode'

const MIN_WIDTH_PX = 280
const NARROW_WIDTH_PX = 480
const TABLET_WIDTH_PX = 768
const HEIGHT_NARROW_PX = 240
const HEIGHT_TABLET_PX = 300
const HEIGHT_WIDE_PX = 360

/**
 * Read-only mini-canvas that mirrors the full PlanFlowView. Same node sizing,
 * same edge geometry, same Needs Help / Leave Off badges — just scaled to fit
 * inside a dashboard card. Clicking the corner button hands control off to
 * the full Planner.
 */
export function PlanFlowPreview({ accentColor, allPlantStats, assignments, onOpenPlanner, plantProduction }) {
    const containerRef = useRef(null)
    const [width, setWidth] = useState(800)
    const [previewHeight, setPreviewHeight] = useState(HEIGHT_WIDE_PX)

    useEffect(() => {
        const node = containerRef.current
        if (!node) return
        const updateForWidth = (w) => {
            setWidth(Math.max(MIN_WIDTH_PX, w))
            // Shrink the preview height on narrow phones so the canvas
            // doesn't dominate the screen when the flow scales down.
            setPreviewHeight(
                w < NARROW_WIDTH_PX ? HEIGHT_NARROW_PX : w < TABLET_WIDTH_PX ? HEIGHT_TABLET_PX : HEIGHT_WIDE_PX
            )
        }
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) updateForWidth(entry.contentRect.width)
        })
        resizeObserver.observe(node)
        return () => resizeObserver.disconnect()
    }, [])

    const nodeItems = useMemo(
        () => (allPlantStats || []).map((stat) => ({ code: stat.code, radius: radiusForOps(stat.eff) })),
        [allPlantStats]
    )
    const radiusByCode = useMemo(() => Object.fromEntries(nodeItems.map((it) => [it.code, it.radius])), [nodeItems])
    const layout = useMemo(
        () => computeClusterLayout(nodeItems, width, previewHeight, { horizontalOverscroll: 0, pad: 20, pinTop: 16 }),
        [nodeItems, width, previewHeight]
    )
    const { positions, width: layoutWidth, height: layoutHeight } = layout
    const edges = useMemo(() => buildEdges(assignments), [assignments])
    const bidirectionalEdgeKeys = useMemo(() => computeBidirectionalEdgeKeys(edges), [edges])
    const { leaveOffByCode, minPoolByCode, yphByCode } = usePlanFlowPreviewMetrics({
        allPlantStats,
        assignments,
        plantProduction
    })

    const scale = Math.min(width / layoutWidth, previewHeight / layoutHeight, 1)
    const scaledWidth = layoutWidth * scale
    const offsetX = Math.max(0, (width - scaledWidth) / 2)
    const hasNodes = nodeItems.length > 0

    return (
        <div className="relative" ref={containerRef} style={{ height: previewHeight }}>
            <div
                className="absolute inset-0 rounded-lg overflow-hidden"
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    backgroundImage: 'radial-gradient(circle at 12px 12px, var(--border-light) 1px, transparent 1.5px)',
                    backgroundSize: '24px 24px'
                }}
            />
            {!hasNodes && <PlanFlowPreviewEmptyState />}
            {hasNodes && (
                <div
                    className="absolute top-0"
                    style={{
                        height: layoutHeight,
                        left: offsetX,
                        transform: `scale(${scale})`,
                        transformOrigin: '0 0',
                        width: layoutWidth
                    }}
                >
                    <PlanFlowPreviewEdgeLines
                        accentColor={accentColor}
                        bidirectionalEdgeKeys={bidirectionalEdgeKeys}
                        edges={edges}
                        layoutHeight={layoutHeight}
                        layoutWidth={layoutWidth}
                        positions={positions}
                        radiusByCode={radiusByCode}
                    />
                    <PlanFlowPreviewEdgeLabels
                        accentColor={accentColor}
                        bidirectionalEdgeKeys={bidirectionalEdgeKeys}
                        edges={edges}
                        positions={positions}
                    />
                    {(allPlantStats || []).map((stat) => {
                        const position = positions[stat.code]
                        if (!position) return null
                        return (
                            <PlanFlowPreviewNode
                                key={stat.code}
                                accentColor={accentColor}
                                leaveOff={leaveOffByCode[stat.code] || 0}
                                minPool={minPoolByCode[stat.code]}
                                position={position}
                                radius={radiusByCode[stat.code]}
                                stat={stat}
                                yph={yphByCode[stat.code]}
                            />
                        )
                    })}
                </div>
            )}
            {onOpenPlanner && <PlanFlowPreviewOpenButton accentColor={accentColor} onClick={onOpenPlanner} />}
        </div>
    )
}

function PlanFlowPreviewEmptyState() {
    return (
        <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
        >
            <i className="fas fa-project-diagram text-2xl mb-2 opacity-50" />
            <span className="text-[12px]">Add plants or routes to see the flow</span>
        </div>
    )
}

function PlanFlowPreviewOpenButton({ accentColor, onClick }) {
    return (
        <button
            onClick={onClick}
            className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white cursor-pointer border-none flex items-center gap-1.5"
            style={{ background: accentColor, boxShadow: 'var(--shadow)' }}
        >
            <i className="fas fa-project-diagram text-[10px]" /> Open Planner
        </button>
    )
}

export default PlanFlowPreview
