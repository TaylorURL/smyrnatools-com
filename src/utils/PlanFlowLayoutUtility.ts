import { MAX_YPH, TARGET_YPH } from './PlanUtility'

export const NODE_RADIUS_MIN = 48
export const NODE_RADIUS_MAX = 110
// Tight enough to keep the cluster compact while still leaving room for a
// `+N ops · time` label between two adjacent nodes. Edges that need extra
// length get individually stretched by `relaxLayoutForEdges` after the
// initial placement.
export const EDGE_GAP = 100
export const CANVAS_PADDING = 40
export const TOOLBAR_CLEAR = 64
/** Extra horizontal breathing room on each side of the cluster so users can
 *  pan past the outermost nodes without hitting a wall immediately. */
export const HORIZONTAL_OVERSCROLL = 900

interface LayoutItem {
    code: string
    radius: number
}

interface Position {
    x: number
    y: number
}

interface LayoutResult {
    width: number
    height: number
    positions: Record<string, Position>
}

interface Edge {
    from: string
    to: string
    ops: number
    earliest: string | null
    isReturn: boolean
    assignmentIndexes: number[]
}

interface Assignment {
    fromPlant?: string
    toPlant?: string
    driverCount?: string | number
    time?: string
    leaveTime?: string
    forOrderId?: string
    [key: string]: unknown
}

interface ClusterLayoutOptions {
    pinTop?: number
    pad?: number
    edgeGap?: number
    horizontalOverscroll?: number
}

interface RelaxLayoutOptions {
    edgeBuffer?: number
    edgePasses?: number
    collisionPasses?: number
    pad?: number
    minLabelClearance?: number
    stretchPasses?: number
}

/**
 * Perpendicular offset (px) applied to bidirectional route pairs so the
 * outbound and return arrows render as two parallel lanes instead of
 * stacking on top of each other.
 */
export const EDGE_PARALLEL_OFFSET = 26

/** Scale a plant's render radius from its effective operator count. */
export function radiusForOps(ops: number | null | undefined): number {
    const n = Math.max(0, Number.isFinite(ops) ? (ops as number) : 0)
    const scaled = NODE_RADIUS_MIN + Math.sqrt(n) * 14
    return Math.round(Math.max(NODE_RADIUS_MIN, Math.min(NODE_RADIUS_MAX, scaled)))
}

/**
 * Aggregate assignments into directed edges with operator totals + earliest
 * time. When an assignment has a `leaveTime`, the same drivers also make the
 * return trip back to their origin plant — we emit an implicit reverse edge
 * tagged `isReturn: true` so rendering can style it differently.
 */
export function buildEdges(assignments: Assignment[] | null | undefined): Edge[] {
    const map = new Map<string, Edge>()
    const upsert = (from: string, to: string, ops: number, time: string | undefined, idx: number, isReturn: boolean) => {
        const key = `${from}->${to}`
        if (!map.has(key)) {
            map.set(key, { assignmentIndexes: [], earliest: null, from, isReturn, ops: 0, to })
        }
        const edge = map.get(key)!
        edge.ops += ops
        if (time && (!edge.earliest || time < edge.earliest)) edge.earliest = time
        edge.assignmentIndexes.push(idx)
        // A real outbound assignment on the same pair outranks a return-only
        // edge — clear the flag so styling reflects the outbound.
        if (!isReturn) edge.isReturn = false
    }
    ;(assignments || []).forEach((a, idx) => {
        if (!a.fromPlant || !a.toPlant) return
        const ops = parseInt(String(a.driverCount), 10) || 0
        upsert(a.fromPlant, a.toPlant, ops, a.time, idx, false)
        if (a.leaveTime) upsert(a.toPlant, a.fromPlant, ops, a.leaveTime, idx, true)
    })
    return Array.from(map.values())
}

/** Keys of edges that have an opposite counterpart (A->B and B->A both
 *  present). Used to decide which edges need perpendicular offset. */
export function computeBidirectionalEdgeKeys(edges: Edge[] | null | undefined): Set<string> {
    const keys = new Set((edges || []).map((e) => `${e.from}->${e.to}`))
    const out = new Set<string>()
    for (const key of keys) {
        const [from, to] = key.split('->')
        if (keys.has(`${to}->${from}`)) out.add(key)
    }
    return out
}

/** Deterministic PRNG so a given plant-code set always lays out the same way. */
export function mulberry32(seed: number): () => number {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
export function hashString(str: string): number {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    return h >>> 0
}

/**
 * Organic cluster layout — biggest node at the centre, satellites placed
 * at random angles on expanding rings with collision rejection. Canvas
 * tightens to the cluster bounds and pins it near the top.
 */
export function computeClusterLayout(
    items: LayoutItem[],
    viewportWidth: number,
    viewportHeight: number,
    options: ClusterLayoutOptions = {}
): LayoutResult {
    const {
        pinTop = TOOLBAR_CLEAR,
        pad = CANVAS_PADDING,
        edgeGap = EDGE_GAP,
        horizontalOverscroll = HORIZONTAL_OVERSCROLL
    } = options
    const n = items.length
    if (n === 0) return { height: viewportHeight, positions: {}, width: viewportWidth }
    const sorted = [...items].sort((a, b) => b.radius - a.radius)
    const seed = hashString(
        items
            .map((i) => i.code)
            .sort()
            .join('|')
    )
    const rng = mulberry32(seed)
    const totalNodeArea = items.reduce((s, it) => s + Math.PI * it.radius * it.radius, 0)
    const maxR = Math.max(...items.map((i) => i.radius))
    const targetSide = Math.sqrt(totalNodeArea * 4.2) + maxR * 2 + pad * 2
    const side = Math.max(viewportWidth, viewportHeight, targetSide)
    const cx = side / 2
    const cy = side / 2
    const placed: Array<LayoutItem & Position> = []
    const positions: Record<string, Position> = {}
    const tryPlace = (item: LayoutItem, x: number, y: number): boolean => {
        if (x - item.radius < pad || x + item.radius > side - pad) return false
        if (y - item.radius < pad || y + item.radius > side - pad) return false
        for (const p of placed) {
            const dx = p.x - x
            const dy = p.y - y
            if (dx * dx + dy * dy < (p.radius + item.radius + edgeGap) ** 2) return false
        }
        placed.push({ ...item, x, y })
        positions[item.code] = { x, y }
        return true
    }
    const hub = sorted[0]
    tryPlace(hub, cx, cy)
    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i]
        const baseDistance = hub.radius + item.radius + edgeGap
        let done = false
        for (let attempt = 0; attempt < 900 && !done; attempt++) {
            const angle = rng() * Math.PI * 2
            const ringGrowth = Math.floor(attempt / 40) * 32
            const jitter = rng() * rng() * 100
            const distance = baseDistance + ringGrowth + jitter
            done = tryPlace(item, cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance)
        }
        if (!done) {
            const angle = rng() * Math.PI * 2
            const r = Math.min(side, viewportHeight) / 2 - item.radius - pad - 20
            const fx = cx + Math.cos(angle) * r
            const fy = cy + Math.sin(angle) * r
            placed.push({ ...item, x: fx, y: fy })
            positions[item.code] = { x: fx, y: fy }
        }
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of placed) {
        if (p.x - p.radius < minX) minX = p.x - p.radius
        if (p.y - p.radius < minY) minY = p.y - p.radius
        if (p.x + p.radius > maxX) maxX = p.x + p.radius
        if (p.y + p.radius > maxY) maxY = p.y + p.radius
    }
    const clusterWidth = maxX - minX + pad * 2
    const clusterHeight = maxY - minY + pad * 2
    // Widen the canvas on both sides so users can drag-pan past the cluster
    const paddedWidth = clusterWidth + horizontalOverscroll * 2
    const finalWidth = Math.max(viewportWidth, paddedWidth)
    const finalHeight = Math.max(viewportHeight, clusterHeight + pinTop)
    const hShift = pad - minX + (finalWidth - clusterWidth) / 2
    const vShift = pad - minY + pinTop
    Object.keys(positions).forEach((code) => {
        positions[code] = { x: positions[code].x + hShift, y: positions[code].y + vShift }
    })
    return { height: finalHeight, positions, width: finalWidth }
}

/**
 * Edge-aware relaxation pass — runs *after* the initial cluster layout once
 * we know which routes (edges) actually exist. Any non-endpoint node that
 * sits across an edge's straight-line path is shoved perpendicular to the
 * line until it's clear, then a couple of node-collision passes resolve any
 * new overlaps the shoves introduced. Bounds are recomputed afterwards so
 * nothing slips off-canvas.
 */
export function relaxLayoutForEdges(
    layout: LayoutResult,
    items: LayoutItem[],
    edges: Edge[] | null | undefined,
    options: RelaxLayoutOptions = {}
): LayoutResult {
    if (!edges?.length) return layout
    const {
        edgeBuffer = 14,
        edgePasses = 6,
        collisionPasses = 4,
        pad = CANVAS_PADDING,
        // Required visible line length between two endpoints (after subtracting
        // their radii) so the badge fits with a few px of visible line on each
        // side. ~96 px label + 2x ~8 px padding = 112.
        minLabelClearance = 112,
        stretchPasses = 4
    } = options
    const positions: Record<string, Position> = Object.fromEntries(
        Object.entries(layout.positions).map(([code, p]) => [code, { x: p.x, y: p.y }])
    )
    const radiusByCode: Record<string, number> = Object.fromEntries(items.map((i) => [i.code, i.radius]))

    // Stretch-pass: if an edge's visible line is shorter than the label needs,
    // push its endpoints apart along the line.
    for (let iter = 0; iter < stretchPasses; iter++) {
        let stretched = false
        for (const edge of edges) {
            const a = positions[edge.from]
            const b = positions[edge.to]
            if (!a || !b) continue
            const ra = radiusByCode[edge.from] ?? NODE_RADIUS_MIN
            const rb = radiusByCode[edge.to] ?? NODE_RADIUS_MIN
            const dx = b.x - a.x
            const dy = b.y - a.y
            const centerDist = Math.sqrt(dx * dx + dy * dy) || 0.001
            const visibleLine = centerDist - ra - rb
            const required = minLabelClearance
            if (visibleLine < required) {
                const need = required - visibleLine + 4
                const ux = dx / centerDist
                const uy = dy / centerDist
                positions[edge.from] = { x: a.x - ux * (need / 2), y: a.y - uy * (need / 2) }
                positions[edge.to] = { x: b.x + ux * (need / 2), y: b.y + uy * (need / 2) }
                stretched = true
            }
        }
        if (!stretched) break
    }

    for (let iter = 0; iter < edgePasses; iter++) {
        let moved = false
        for (const edge of edges) {
            const a = positions[edge.from]
            const b = positions[edge.to]
            if (!a || !b) continue
            const dx = b.x - a.x
            const dy = b.y - a.y
            const lenSq = dx * dx + dy * dy
            if (lenSq < 1) continue
            const len = Math.sqrt(lenSq)
            const px = -(dy / len)
            const py = dx / len
            for (const item of items) {
                if (item.code === edge.from || item.code === edge.to) continue
                const p = positions[item.code]
                if (!p) continue
                const radius = radiusByCode[item.code] ?? NODE_RADIUS_MIN
                // Project node centre onto the edge as a normalized parameter t.
                const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
                if (t < 0.05 || t > 0.95) continue // not actually crossing this segment
                const closestX = a.x + dx * t
                const closestY = a.y + dy * t
                const ddx = p.x - closestX
                const ddy = p.y - closestY
                const distance = Math.sqrt(ddx * ddx + ddy * ddy)
                const minDistance = radius + edgeBuffer
                if (distance < minDistance) {
                    const overlap = minDistance - distance + 2
                    const sign = distance > 0.001 ? Math.sign(ddx * px + ddy * py) || 1 : 1
                    positions[item.code] = {
                        x: p.x + px * sign * overlap,
                        y: p.y + py * sign * overlap
                    }
                    moved = true
                }
            }
        }
        if (!moved) break
    }

    // Resolve any node-vs-node overlaps the perpendicular shoves may have introduced.
    for (let iter = 0; iter < collisionPasses; iter++) {
        let collided = false
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = items[i]
                const b = items[j]
                const pa = positions[a.code]
                const pb = positions[b.code]
                if (!pa || !pb) continue
                const dx = pb.x - pa.x
                const dy = pb.y - pa.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
                const minDist = a.radius + b.radius + 24
                if (dist < minDist) {
                    const half = (minDist - dist) / 2
                    const ux = dx / dist
                    const uy = dy / dist
                    positions[a.code] = { x: pa.x - ux * half, y: pa.y - uy * half }
                    positions[b.code] = { x: pb.x + ux * half, y: pb.y + uy * half }
                    collided = true
                }
            }
        }
        if (!collided) break
    }

    // Re-fit bounds and shift everything positive so nothing drifts off-canvas.
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const item of items) {
        const p = positions[item.code]
        if (!p) continue
        minX = Math.min(minX, p.x - item.radius)
        minY = Math.min(minY, p.y - item.radius)
        maxX = Math.max(maxX, p.x + item.radius)
        maxY = Math.max(maxY, p.y + item.radius)
    }
    const shiftX = minX < pad ? pad - minX : 0
    const shiftY = minY < pad ? pad - minY : 0
    if (shiftX || shiftY) {
        for (const code of Object.keys(positions)) {
            positions[code] = { x: positions[code].x + shiftX, y: positions[code].y + shiftY }
        }
        maxX += shiftX
        maxY += shiftY
    }
    const newWidth = Math.max(layout.width, maxX + pad)
    const newHeight = Math.max(layout.height, maxY + pad)
    return { height: newHeight, positions, width: newWidth }
}

export const yphColorFor = (yph: number | null | undefined, accentColor: string): string => {
    if (yph == null) return accentColor
    if (yph > MAX_YPH) return '#ef4444'
    if (yph < TARGET_YPH - 0.3) return '#d97706'
    return '#16a34a'
}
