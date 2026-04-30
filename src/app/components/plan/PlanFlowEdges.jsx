import React from 'react'

import { EDGE_PARALLEL_OFFSET, NODE_RADIUS_MIN } from '../../../utils/PlanFlowLayoutUtility'

const HIGHLIGHT_COLOR = '#f59e0b'
const RETURN_OPACITY_FACTOR = 0.55
const DIMMED_OPACITY = 0.25
const RETURN_LABEL_OPACITY = 0.85
const MUTED_LABEL_OPACITY = 0.5

/** SVG layer that draws every directed edge between plant nodes. */
export function PlanFlowEdgeLines({
    accentColor,
    activeRelatedEdges,
    bidirectionalEdgeKeys,
    edges,
    height,
    hoverEdgeKey,
    positions,
    radiusByCode,
    selectedCode,
    width
}) {
    return (
        <svg
            className="absolute inset-0 pointer-events-none"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
            <defs>
                <marker
                    id="flow-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 Z" fill={accentColor} />
                </marker>
                <marker
                    id="flow-arrow-highlight"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 Z" fill={HIGHLIGHT_COLOR} />
                </marker>
            </defs>
            {edges.map((edge) => {
                const fromPos = positions[edge.from]
                const toPos = positions[edge.to]
                if (!fromPos || !toPos) return null
                const dx = toPos.x - fromPos.x
                const dy = toPos.y - fromPos.y
                const len = Math.sqrt(dx * dx + dy * dy) || 1
                const ux = dx / len
                const uy = dy / len
                const radiusFrom = radiusByCode[edge.from] || NODE_RADIUS_MIN
                const radiusTo = radiusByCode[edge.to] || NODE_RADIUS_MIN
                const edgeKey = `${edge.from}->${edge.to}`
                // Offset perpendicular to travel direction so an opposite
                // edge (B→A) naturally lands on the other side, producing
                // two parallel lanes instead of one stacked line.
                const isBidirectional = bidirectionalEdgeKeys.has(edgeKey)
                const offsetX = isBidirectional ? uy * EDGE_PARALLEL_OFFSET : 0
                const offsetY = isBidirectional ? -ux * EDGE_PARALLEL_OFFSET : 0
                const x1 = fromPos.x + ux * radiusFrom + offsetX
                const y1 = fromPos.y + uy * radiusFrom + offsetY
                const x2 = toPos.x - ux * radiusTo + offsetX
                const y2 = toPos.y - uy * radiusTo + offsetY
                const isRelated = activeRelatedEdges.has(edgeKey)
                const isHover = hoverEdgeKey === edgeKey
                const active = isRelated || isHover
                const baseOpacity = selectedCode && !isRelated ? DIMMED_OPACITY : 1
                return (
                    <line
                        key={edgeKey}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={active ? HIGHLIGHT_COLOR : accentColor}
                        strokeWidth={active ? 3 : 2}
                        strokeOpacity={edge.isReturn ? baseOpacity * RETURN_OPACITY_FACTOR : baseOpacity}
                        strokeLinecap="round"
                        strokeDasharray={edge.isReturn ? '6 4' : undefined}
                        markerEnd={active ? 'url(#flow-arrow-highlight)' : 'url(#flow-arrow)'}
                    />
                )
            })}
        </svg>
    )
}

/** Edge label badges (`+N ops · time`) plus connector lines back to the edge. */
export function PlanFlowEdgeLabels({
    accentColor,
    activeRelatedEdges,
    edges,
    height,
    labelLayout,
    onHoverEdge,
    selectedCode,
    width
}) {
    return edges.map((edge) => {
        const edgeKey = `${edge.from}->${edge.to}`
        const layout = labelLayout[edgeKey]
        if (!layout) return null
        const isRelated = activeRelatedEdges.has(edgeKey)
        const muted = selectedCode && !isRelated
        const isOffset = layout.offset > 4
        return (
            <React.Fragment key={`lbl-${edgeKey}`}>
                {isOffset && (
                    <svg
                        className="absolute pointer-events-none"
                        width={width}
                        height={height}
                        style={{
                            left: 0,
                            opacity: muted ? 0.4 : 0.7,
                            top: 0,
                            zIndex: 15
                        }}
                    >
                        <line
                            x1={layout.anchorX}
                            y1={layout.anchorY}
                            x2={layout.x}
                            y2={layout.y}
                            stroke={isRelated ? HIGHLIGHT_COLOR : 'var(--border-medium)'}
                            strokeWidth={1.25}
                            strokeDasharray="3 3"
                        />
                    </svg>
                )}
                <div
                    onMouseEnter={() => onHoverEdge(edgeKey)}
                    onMouseLeave={() => onHoverEdge(null)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full flex items-center gap-1.5 text-[10.5px] font-semibold cursor-default"
                    style={{
                        background: 'var(--bg-primary)',
                        border: `1px solid ${isRelated ? HIGHLIGHT_COLOR : 'var(--border-light)'}`,
                        boxShadow: 'var(--shadow-sm)',
                        color: 'var(--text-primary)',
                        left: `${layout.x}px`,
                        opacity: muted ? MUTED_LABEL_OPACITY : edge.isReturn ? RETURN_LABEL_OPACITY : 1,
                        top: `${layout.y}px`,
                        zIndex: 20
                    }}
                >
                    <i
                        className={`fas ${edge.isReturn ? 'fa-rotate-left' : 'fa-truck'} text-[9px]`}
                        style={{ color: isRelated ? HIGHLIGHT_COLOR : accentColor }}
                    />
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {edge.ops > 0
                            ? `${edge.isReturn ? '−' : '+'}${edge.ops} op${edge.ops === 1 ? '' : 's'}`
                            : 'Route'}
                    </span>
                    {edge.earliest && <span style={{ color: 'var(--text-secondary)' }}>· {edge.earliest}</span>}
                </div>
            </React.Fragment>
        )
    })
}

const JOB_MARKER_RADIUS_PX = 36
const JOB_MARKER_T_ALONG_EDGE = 0.65 // Bias toward destination
const JOB_MARKER_BG = '#0ea5e9'
const JOB_MARKER_MUTED_OPACITY = 0.55

/** Job markers rendered on edges that are loading for a specific destination order. */
export function PlanFlowEdgeJobs({ activeRelatedEdges, bidirectionalEdgeKeys, edgeJobs, positions, selectedCode }) {
    return Array.from(edgeJobs.entries()).map(([edgeKey, info]) => {
        const [fromCode, toCode] = edgeKey.split('->')
        const fromPos = positions[fromCode]
        const toPos = positions[toCode]
        if (!fromPos || !toPos) return null
        const dx = toPos.x - fromPos.x
        const dy = toPos.y - fromPos.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const ux = dx / len
        const uy = dy / len
        // Match the perpendicular offset the line itself uses for
        // bidirectional pairs so the marker sits ON the outbound lane.
        const isBidirectional = bidirectionalEdgeKeys.has(edgeKey)
        const offsetX = isBidirectional ? uy * EDGE_PARALLEL_OFFSET : 0
        const offsetY = isBidirectional ? -ux * EDGE_PARALLEL_OFFSET : 0
        const markerX = fromPos.x + dx * JOB_MARKER_T_ALONG_EDGE + offsetX
        const markerY = fromPos.y + dy * JOB_MARKER_T_ALONG_EDGE + offsetY
        const isRelated = activeRelatedEdges.has(edgeKey)
        const muted = selectedCode && !isRelated
        const order = info.order
        const orderTag = order.orderNum
            ? `#${order.orderNum}`
            : order.startTime
              ? String(order.startTime).slice(0, 5)
              : 'Job'
        const customer = order.customer ? String(order.customer).trim() : ''
        const yardageText = Number.isFinite(parseFloat(order.yardage)) ? `${parseFloat(order.yardage)} yd` : null
        return (
            <div
                key={`job-${edgeKey}`}
                className="absolute rounded-full flex flex-col items-center justify-center"
                style={{
                    background: JOB_MARKER_BG,
                    border: '3px solid var(--bg-secondary)',
                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.45), var(--shadow)',
                    color: '#fff',
                    height: JOB_MARKER_RADIUS_PX * 2,
                    left: `${markerX - JOB_MARKER_RADIUS_PX}px`,
                    opacity: muted ? JOB_MARKER_MUTED_OPACITY : 1,
                    top: `${markerY - JOB_MARKER_RADIUS_PX}px`,
                    width: JOB_MARKER_RADIUS_PX * 2,
                    zIndex: 18
                }}
                title={[`Loading for ${orderTag}`, customer || null, `at plant ${toCode}`, yardageText]
                    .filter(Boolean)
                    .join(' · ')}
            >
                <i className="fas fa-clipboard-list text-[12px] mb-0.5 opacity-80" />
                <span
                    className="font-bold leading-none"
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.2px' }}
                >
                    {orderTag}
                </span>
                {yardageText && (
                    <span className="leading-none mt-0.5" style={{ fontSize: 9, fontWeight: 500, opacity: 0.85 }}>
                        {yardageText}
                    </span>
                )}
            </div>
        )
    })
}
