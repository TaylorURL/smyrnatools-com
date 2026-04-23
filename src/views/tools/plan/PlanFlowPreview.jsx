import React, { useEffect, useMemo, useRef, useState } from 'react'

import { timeToMinutes } from '../../../utils/PlanUtility'
import { buildEdges, computeClusterLayout, NODE_RADIUS_MIN, radiusForOps, yphColorFor } from './planFlowLayout'

/**
 * Small read-only preview of the PlanFlowView — same layout / same visual
 * vocabulary (sized nodes + directed edges + labels), just rendered to fit
 * inside a dashboard card with a fixed height. Clicking "Open Planner"
 * jumps to the full view for editing.
 */
function PlanFlowPreview({ accentColor, allPlantStats, assignments, onOpenPlanner, plantProduction }) {
    const containerRef = useRef(null)
    const [width, setWidth] = useState(800)
    const previewHeight = 360

    useEffect(() => {
        const node = containerRef.current
        if (!node) return
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(Math.max(400, entry.contentRect.width))
            }
        })
        ro.observe(node)
        return () => ro.disconnect()
    }, [])

    const nodeItems = useMemo(
        () => (allPlantStats || []).map((s) => ({ code: s.code, radius: radiusForOps(s.eff) })),
        [allPlantStats]
    )
    const radiusByCode = useMemo(() => {
        const out = {}
        nodeItems.forEach((it) => {
            out[it.code] = it.radius
        })
        return out
    }, [nodeItems])
    const layout = useMemo(
        () => computeClusterLayout(nodeItems, width, previewHeight, { horizontalOverscroll: 0, pad: 20, pinTop: 16 }),
        [nodeItems, width]
    )
    const { positions, width: layoutWidth, height: layoutHeight } = layout
    const edges = useMemo(() => buildEdges(assignments), [assignments])

    const yphByCode = useMemo(() => {
        const out = {}
        ;(allPlantStats || []).forEach((s) => {
            const prod = plantProduction[s.code] || {}
            const firstMins = timeToMinutes(prod.firstJobTime)
            const lastMins = timeToMinutes(prod.lastJobTime)
            const hours =
                firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
            const yardage = parseFloat(prod.totalYardage) || 0
            out[s.code] = hours && yardage && s.eff > 0 ? Math.round((yardage / (hours * s.eff)) * 10) / 10 : null
        })
        return out
    }, [allPlantStats, plantProduction])

    // Fit the full layout inside the preview box
    const scale = Math.min(width / layoutWidth, previewHeight / layoutHeight, 1)
    const scaledWidth = layoutWidth * scale
    const scaledHeight = layoutHeight * scale
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
            {!hasNodes && (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-project-diagram text-2xl mb-2 opacity-50" />
                    <span className="text-[12px]">Add plants or routes to see the flow</span>
                </div>
            )}
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
                    <svg
                        className="absolute inset-0 pointer-events-none"
                        width={layoutWidth}
                        height={layoutHeight}
                        viewBox={`0 0 ${layoutWidth} ${layoutHeight}`}
                    >
                        <defs>
                            <marker
                                id="plan-preview-arrow"
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
                        {edges.map((e) => {
                            const from = positions[e.from]
                            const to = positions[e.to]
                            if (!from || !to) return null
                            const dx = to.x - from.x
                            const dy = to.y - from.y
                            const len = Math.sqrt(dx * dx + dy * dy) || 1
                            const ux = dx / len
                            const uy = dy / len
                            const rFrom = radiusByCode[e.from] || NODE_RADIUS_MIN
                            const rTo = radiusByCode[e.to] || NODE_RADIUS_MIN
                            return (
                                <line
                                    key={`${e.from}->${e.to}`}
                                    x1={from.x + ux * rFrom}
                                    y1={from.y + uy * rFrom}
                                    x2={to.x - ux * rTo}
                                    y2={to.y - uy * rTo}
                                    stroke={accentColor}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    markerEnd="url(#plan-preview-arrow)"
                                />
                            )
                        })}
                    </svg>
                    {edges.map((e) => {
                        const from = positions[e.from]
                        const to = positions[e.to]
                        if (!from || !to) return null
                        const mx = (from.x + to.x) / 2
                        const my = (from.y + to.y) / 2
                        return (
                            <div
                                key={`lbl-${e.from}-${e.to}`}
                                className="absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-semibold"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)',
                                    boxShadow: 'var(--shadow-sm)',
                                    color: 'var(--text-primary)',
                                    left: mx,
                                    top: my,
                                    zIndex: 3
                                }}
                            >
                                <i className="fas fa-truck text-[8px]" style={{ color: accentColor }} />
                                <span>+{e.ops}</span>
                                {e.earliest && <span style={{ color: 'var(--text-secondary)' }}>· {e.earliest}</span>}
                            </div>
                        )
                    })}
                    {(allPlantStats || []).map((s) => {
                        const pos = positions[s.code]
                        if (!pos) return null
                        const r = radiusByCode[s.code] || NODE_RADIUS_MIN
                        const net = s.recv - s.send
                        const role =
                            s.send > 0 && s.recv === 0
                                ? 'sender'
                                : s.recv > 0 && s.send === 0
                                  ? 'receiver'
                                  : net > 0
                                    ? 'receiver'
                                    : net < 0
                                      ? 'sender'
                                      : null
                        const yph = yphByCode[s.code]
                        const ringColor = yphColorFor(yph, accentColor)
                        const codeFontSize = Math.round(Math.max(18, Math.min(34, r * 0.38)))
                        return (
                            <div
                                key={s.code}
                                className="absolute rounded-full flex flex-col items-center justify-center"
                                style={{
                                    background: 'var(--bg-primary)',
                                    boxShadow: 'var(--shadow)',
                                    height: r * 2,
                                    left: pos.x - r,
                                    top: pos.y - r,
                                    width: r * 2,
                                    zIndex: 5
                                }}
                            >
                                <span
                                    className="absolute inset-0 rounded-full pointer-events-none"
                                    style={{
                                        border: `3px solid ${ringColor}`,
                                        opacity: yph != null ? 0.8 : 0.35
                                    }}
                                />
                                {role && (
                                    <span
                                        className="absolute px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider text-white"
                                        style={{
                                            background: role === 'sender' ? '#dc2626' : '#16a34a',
                                            left: '50%',
                                            top: -8,
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        {role}
                                    </span>
                                )}
                                <span
                                    className="font-bold"
                                    style={{
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-heading)',
                                        fontSize: codeFontSize,
                                        lineHeight: 1
                                    }}
                                >
                                    {s.code}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                    {s.eff} op{s.eff === 1 ? '' : 's'}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
            {onOpenPlanner && (
                <button
                    onClick={onOpenPlanner}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white cursor-pointer border-none flex items-center gap-1.5"
                    style={{ background: accentColor, boxShadow: 'var(--shadow)' }}
                >
                    <i className="fas fa-project-diagram text-[10px]" /> Open Planner
                </button>
            )}
        </div>
    )
}

export default PlanFlowPreview
