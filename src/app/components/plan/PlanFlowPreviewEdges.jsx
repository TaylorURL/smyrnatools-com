import React from 'react'

import { EDGE_PARALLEL_OFFSET, NODE_RADIUS_MIN } from '../../../utils/PlanFlowLayoutUtility'

const ARROW_MARKER_ID = 'plan-preview-arrow'

/**
 * Edge geometry helper — returns unit vector and lane offset for the edge,
 * shared by both the SVG line layer and the floating label layer so they
 * always render onto the exact same path.
 */
function edgeGeometry(edge, positions, bidirectionalEdgeKeys) {
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) return null
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    const key = `${edge.from}->${edge.to}`
    const isBidirectional = bidirectionalEdgeKeys.has(key)
    const laneOffX = isBidirectional ? uy * EDGE_PARALLEL_OFFSET : 0
    const laneOffY = isBidirectional ? -ux * EDGE_PARALLEL_OFFSET : 0
    return { from, key, laneOffX, laneOffY, to, ux, uy }
}

/** SVG layer of the preview canvas — arrowhead marker + every edge line. */
export function PlanFlowPreviewEdgeLines({
    accentColor,
    bidirectionalEdgeKeys,
    edges,
    layoutHeight,
    layoutWidth,
    positions,
    radiusByCode
}) {
    return (
        <svg
            className="absolute inset-0 pointer-events-none"
            width={layoutWidth}
            height={layoutHeight}
            viewBox={`0 0 ${layoutWidth} ${layoutHeight}`}
        >
            <defs>
                <marker
                    id={ARROW_MARKER_ID}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 Z" fill={accentColor} />
                </marker>
            </defs>
            {edges.map((edge) => {
                const geom = edgeGeometry(edge, positions, bidirectionalEdgeKeys)
                if (!geom) return null
                const { from, key, laneOffX, laneOffY, to, ux, uy } = geom
                const rFrom = radiusByCode[edge.from] || NODE_RADIUS_MIN
                const rTo = radiusByCode[edge.to] || NODE_RADIUS_MIN
                return (
                    <line
                        key={key}
                        x1={from.x + ux * rFrom + laneOffX}
                        y1={from.y + uy * rFrom + laneOffY}
                        x2={to.x - ux * rTo + laneOffX}
                        y2={to.y - uy * rTo + laneOffY}
                        stroke={accentColor}
                        strokeWidth={2}
                        strokeOpacity={edge.isReturn ? 0.55 : 1}
                        strokeLinecap="round"
                        strokeDasharray={edge.isReturn ? '6 4' : undefined}
                        markerEnd={`url(#${ARROW_MARKER_ID})`}
                    />
                )
            })}
        </svg>
    )
}

/** Floating label layer — one badge per edge centred on its path midpoint. */
export function PlanFlowPreviewEdgeLabels({ accentColor, bidirectionalEdgeKeys, edges, positions }) {
    return edges.map((edge) => {
        const geom = edgeGeometry(edge, positions, bidirectionalEdgeKeys)
        if (!geom) return null
        const { from, key, laneOffX, laneOffY, to } = geom
        const mx = (from.x + to.x) / 2 + laneOffX
        const my = (from.y + to.y) / 2 + laneOffY
        const sign = edge.isReturn ? '−' : '+'
        return (
            <div
                key={`lbl-${key}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-semibold"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)',
                    color: 'var(--text-primary)',
                    left: mx,
                    opacity: edge.isReturn ? 0.85 : 1,
                    top: my,
                    zIndex: 3
                }}
            >
                <i
                    className={`fas ${edge.isReturn ? 'fa-rotate-left' : 'fa-truck'} text-[8px]`}
                    style={{ color: accentColor }}
                />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {edge.ops > 0 ? `${sign}${edge.ops}` : 'Route'}
                </span>
                {edge.earliest && <span style={{ color: 'var(--text-secondary)' }}>{`· ${edge.earliest}`}</span>}
            </div>
        )
    })
}
