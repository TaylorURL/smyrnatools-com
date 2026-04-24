import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
    adjustPoolForDate,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    createEmptyAssignment,
    getOrderPourDurationMinutes,
    MAX_YPH,
    minutesToTime,
    poolAtTime,
    TARGET_YPH,
    timeToMinutes
} from '../../../utils/PlanUtility'
import { buildEdges, computeBidirectionalEdgeKeys, EDGE_PARALLEL_OFFSET, relaxLayoutForEdges } from './planFlowLayout'

const NEEDS_HELP_COLOR = '#dc2626'
const LEAVE_OFF_COLOR = '#d97706'

const NODE_RADIUS_MIN = 48
const NODE_RADIUS_MAX = 110
// Minimum gap between any two node edges. Tight enough to keep the cluster
// compact, just wide enough for a `+N ops · 13:00` badge to sit on the edge
// without touching either node. The stretch pass in relaxLayoutForEdges
// nudges any specific labelled edge that still ends up shorter than this.
const EDGE_GAP = 100
const CANVAS_PADDING = 40
const TOOLBAR_CLEAR = 64
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.15

/** Scale a plant's render radius from its effective operator count. */
function radiusForOps(ops) {
    const n = Math.max(0, Number.isFinite(ops) ? ops : 0)
    const scaled = NODE_RADIUS_MIN + Math.sqrt(n) * 14
    return Math.round(Math.max(NODE_RADIUS_MIN, Math.min(NODE_RADIUS_MAX, scaled)))
}

/** Deterministic PRNG so a given plant-code set always lays out the same way. */
function mulberry32(seed) {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
function hashString(str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    return h >>> 0
}

/**
 * Lay out nodes as an organic cluster: biggest at the centre, satellites
 * placed at random angles off the hub on expanding rings, with collision
 * rejection so nothing overlaps. After placement the canvas tightens to
 * the cluster bounds and pins it near the top.
 */
function computeClusterLayout(items, viewportWidth, viewportHeight) {
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
    const targetSide = Math.sqrt(totalNodeArea * 4.2) + maxR * 2 + CANVAS_PADDING * 2
    const side = Math.max(viewportWidth, viewportHeight, targetSide)
    const cx = side / 2
    const cy = side / 2
    const placed = []
    const positions = {}
    const tryPlace = (item, x, y) => {
        if (x - item.radius < CANVAS_PADDING || x + item.radius > side - CANVAS_PADDING) return false
        if (y - item.radius < CANVAS_PADDING || y + item.radius > side - CANVAS_PADDING) return false
        for (const p of placed) {
            const dx = p.x - x
            const dy = p.y - y
            if (dx * dx + dy * dy < (p.radius + item.radius + EDGE_GAP) ** 2) return false
        }
        placed.push({ ...item, x, y })
        positions[item.code] = { x, y }
        return true
    }
    const hub = sorted[0]
    tryPlace(hub, cx, cy)
    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i]
        const baseDistance = hub.radius + item.radius + EDGE_GAP
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
            const r = Math.min(side, viewportHeight) / 2 - item.radius - CANVAS_PADDING - 20
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
    const clusterWidth = maxX - minX + CANVAS_PADDING * 2
    const clusterHeight = maxY - minY + CANVAS_PADDING * 2
    const finalWidth = Math.max(viewportWidth, clusterWidth)
    const finalHeight = Math.max(viewportHeight, clusterHeight + TOOLBAR_CLEAR)
    const hShift = CANVAS_PADDING - minX + (finalWidth - clusterWidth) / 2
    const vShift = CANVAS_PADDING - minY + TOOLBAR_CLEAR
    Object.keys(positions).forEach((code) => {
        positions[code] = { x: positions[code].x + hShift, y: positions[code].y + vShift }
    })
    return { height: finalHeight, positions, width: finalWidth }
}

const yphColorFor = (yph, accentColor) => {
    if (yph == null) return accentColor
    if (yph > MAX_YPH) return '#ef4444'
    if (yph < TARGET_YPH - 0.3) return '#d97706'
    return '#16a34a'
}

/**
 * PlanFlowView — plants as nodes, assignments as directed edges. The side
 * rail doubles as the planner: click a plant to see its routes, "Send Trucks"
 * opens an inline form where the destination can be picked from a dropdown
 * or by clicking another node on the canvas. Zoom controls sit in the
 * top-right for working with dense plans.
 */
function PlanFlowView({
    accentColor,
    assignments,
    calcClockIn,
    canEdit = false,
    getTravelTime,
    mixerCountsByPlant,
    onSwitchToPlanner,
    planDate,
    plantProduction,
    plants = [],
    setAssignments,
    stats,
    updateAssignment: _updateAssignment
}) {
    const canvasRef = useRef(null)
    const [canvasSize, setCanvasSize] = useState({ height: 600, width: 800 })
    const [selectedCode, setSelectedCode] = useState(null)
    const [hoverEdgeKey, setHoverEdgeKey] = useState(null)
    const [zoom, setZoom] = useState(1)
    const [isPanning, setIsPanning] = useState(false)
    const panStateRef = useRef(null)
    // Panel editor state
    const [panelMode, setPanelMode] = useState('overview') // overview | add | edit
    const [draft, setDraft] = useState(null) // { fromPlant, toPlant, time, driverCount, staggerMinutes }
    const [editingIndex, setEditingIndex] = useState(null)
    const [pickingDestination, setPickingDestination] = useState(false)

    useEffect(() => {
        const node = canvasRef.current
        if (!node) return
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                setCanvasSize({ height: Math.max(420, height), width: Math.max(420, width) })
            }
        })
        ro.observe(node)
        return () => ro.disconnect()
    }, [])

    // Reset the editor when the selection changes.
    useEffect(() => {
        setPanelMode('overview')
        setDraft(null)
        setEditingIndex(null)
        setPickingDestination(false)
    }, [selectedCode])

    /* ── Click-and-drag panning ───────────────────────────────────────────
       Panning hijacks mousedown on the canvas background only — clicks on
       node buttons or edge labels pass through so selection still works.
       While dragging we attach listeners to the window so the user can pan
       past the canvas edge without losing grip, and we clamp to the scroll
       container's natural bounds (the layout itself already sizes so every
       node stays reachable). */
    const beginPan = (event) => {
        if (pickingDestination) return
        if (event.button !== 0) return
        const target = event.target
        if (target && target.closest && target.closest('button, a, input, select, textarea')) return
        const container = canvasRef.current
        if (!container) return
        panStateRef.current = {
            startScrollLeft: container.scrollLeft,
            startScrollTop: container.scrollTop,
            startX: event.clientX,
            startY: event.clientY
        }
        setIsPanning(true)
        event.preventDefault()
    }
    useEffect(() => {
        if (!isPanning) return undefined
        const container = canvasRef.current
        if (!container) return undefined
        const onMove = (event) => {
            const state = panStateRef.current
            if (!state) return
            const dx = event.clientX - state.startX
            const dy = event.clientY - state.startY
            container.scrollLeft = state.startScrollLeft - dx
            container.scrollTop = state.startScrollTop - dy
        }
        const onUp = () => {
            panStateRef.current = null
            setIsPanning(false)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        window.addEventListener('mouseleave', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            window.removeEventListener('mouseleave', onUp)
        }
    }, [isPanning])

    // Build a stats list that includes EVERY plant — not just ones with mixers
    // or assignments. Guarantees every plant shows up as a node and can be
    // picked from the flow view without detouring to the Planner tab.
    const allPlantStats = useMemo(() => {
        const existing = new Map(stats.map((s) => [s.code, s]))
        const list = (plants || []).map((p) => {
            const code = p.plant_code
            if (existing.has(code)) return existing.get(code)
            const base = mixerCountsByPlant?.[code] || 0
            return { base, code, eff: base, recv: 0, send: 0 }
        })
        // Plants may exist only via an assignment's fromPlant/toPlant. Keep those.
        stats.forEach((s) => {
            if (!list.some((x) => x.code === s.code)) list.push(s)
        })
        return list.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [plants, stats, mixerCountsByPlant])
    const nodeItems = useMemo(
        () => allPlantStats.map((s) => ({ code: s.code, radius: radiusForOps(s.eff) })),
        [allPlantStats]
    )
    const radiusByCode = useMemo(() => {
        const out = {}
        nodeItems.forEach((it) => {
            out[it.code] = it.radius
        })
        return out
    }, [nodeItems])
    const baseLayout = useMemo(
        () => computeClusterLayout(nodeItems, canvasSize.width, canvasSize.height),
        [nodeItems, canvasSize]
    )
    const edges = useMemo(() => buildEdges(assignments), [assignments])
    const bidirectionalEdgeKeys = useMemo(() => computeBidirectionalEdgeKeys(edges), [edges])
    // Push any plant whose centre lies on top of an edge perpendicular to that
    // edge so the route line never has to pass straight through a third node.
    const layout = useMemo(() => relaxLayoutForEdges(baseLayout, nodeItems, edges), [baseLayout, nodeItems, edges])
    const { positions, width: layoutWidth, height: layoutHeight } = layout

    const yphByCode = useMemo(() => {
        const out = {}
        stats.forEach((s) => {
            const prod = plantProduction[s.code] || {}
            const firstMins = timeToMinutes(prod.firstJobTime)
            const lastMins = timeToMinutes(prod.lastJobTime)
            const hours =
                firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
            const yardage = parseFloat(prod.totalYardage) || 0
            out[s.code] = hours && yardage && s.eff > 0 ? Math.round((yardage / (hours * s.eff)) * 10) / 10 : null
        })
        return out
    }, [stats, plantProduction])

    /** Flattened order list with `plantCode` attached — fed to both the
     *  byOrder pool summary and the per-plant timeline. */
    const flatOrders = useMemo(() => {
        const out = []
        ;(stats || []).forEach((s) => {
            const prod = plantProduction[s.code] || {}
            const orders = Array.isArray(prod.orders) ? prod.orders : []
            orders.forEach((o) => out.push({ ...o, plantCode: s.code }))
        })
        return out
    }, [stats, plantProduction])

    /** Initial pool is the plant's base mixer count, adjusted for day-of-week
     *  (Saturday halves crew; Sunday closes plants entirely). Help is applied
     *  as time-aware events so the pool only shifts when help actually leaves
     *  or returns. */
    const initialPoolByCode = useMemo(() => {
        const out = {}
        ;(stats || []).forEach((s) => {
            if (!s?.code) return
            const base = Number.isFinite(s.base) ? s.base : 0
            out[s.code] = adjustPoolForDate(base, planDate)
        })
        return out
    }, [stats, planDate])

    /** Help transfers derived from planner assignments — each assignment yields
     *  an outbound handoff at `time` (sender −, receiver +) and, if a valid
     *  `leaveTime > time` is set, a return at `leaveTime` (receiver −, sender +). */
    const helpTransfers = useMemo(() => {
        const out = []
        ;(assignments || []).forEach((a) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const count = parseInt(a.driverCount, 10) || 0
            if (count <= 0) return
            const arrivalMin = timeToMinutes(a.time)
            if (!Number.isFinite(arrivalMin)) return
            out.push({ delta: -count, plantCode: a.fromPlant, time: arrivalMin })
            out.push({ delta: count, plantCode: a.toPlant, time: arrivalMin })
            const leaveMin = timeToMinutes(a.leaveTime)
            if (Number.isFinite(leaveMin) && leaveMin > arrivalMin) {
                out.push({ delta: -count, plantCode: a.toPlant, time: leaveMin })
                out.push({ delta: count, plantCode: a.fromPlant, time: leaveMin })
            }
        })
        return out
    }, [assignments])

    /** Per-plant peak concurrent truck demand from the big-pour-aware pool
     *  simulation. Used by both the leave-off math (can only leave off as many
     *  as are idle at the plant's busiest moment) and the needs-help badge
     *  (if peak demand exceeds eff, plant is overbooked at some point). */
    const poolTimeline = useMemo(
        () => computePlantPoolTimeline(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )

    /** Per-plant pool timelines used to answer "what's the pool at time T?"
     *  for the time scrubber. */
    const poolTimelinesByPlant = useMemo(
        () => computePlantPoolTimelines(flatOrders, initialPoolByCode, null, helpTransfers),
        [flatOrders, initialPoolByCode, helpTransfers]
    )

    /** Min pool value per plant across the day (lowest the pool drops to).
     *  minPool < 0 ⇒ plant is overbooked — needs inbound help.
     *  minPool ≥ 0 ⇒ minPool trucks are idle at the busiest moment. */
    const minPoolByCode = useMemo(() => {
        const out = {}
        Object.values(poolTimeline || {}).forEach((entry) => {
            // Use the effective pool (counts help landing during the pour
            // window) so "needs help" doesn't light up when late-arriving
            // help already covers the deficit.
            const value = Number.isFinite(entry?.poolAfterDispatchEffective)
                ? entry.poolAfterDispatchEffective
                : entry?.poolAfterDispatch
            if (!entry?.plantCode || !Number.isFinite(value)) return
            const cur = out[entry.plantCode]
            if (cur == null || value < cur) out[entry.plantCode] = value
        })
        return out
    }, [poolTimeline])

    /** How many drivers a plant could safely leave off. Tightest of:
     *   - yph slack (avg TARGET_YPH math — good for plants with small jobs),
     *   - peak-demand slack (how many trucks sit idle at the busiest moment,
     *     which respects per-order big-pour truck requirements). */
    const leaveOffByCode = useMemo(() => {
        const out = {}
        stats.forEach((s) => {
            const prod = plantProduction[s.code] || {}
            const firstMins = timeToMinutes(prod.firstJobTime)
            const lastMins = timeToMinutes(prod.lastJobTime)
            const hours =
                firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
            const yardage = parseFloat(prod.totalYardage) || 0
            if (!hours || yardage <= 0 || s.eff <= 1) {
                out[s.code] = { adjustedYph: null, count: 0 }
                return
            }
            const yphSlack = Math.max(0, s.eff - Math.max(1, Math.ceil(yardage / (TARGET_YPH * hours))))
            const minPool = minPoolByCode[s.code]
            // If any order overbooked the plant (minPool < 0), we can't leave
            // anyone off — plant actually needs more trucks, not fewer.
            // Otherwise cap leave-off at the idle-truck count during peak.
            const peakSlack = Number.isFinite(minPool) ? Math.max(0, minPool) : yphSlack
            const slack = Math.max(0, Math.min(yphSlack, peakSlack))
            const remaining = s.eff - slack
            const adjustedYph =
                slack > 0 && remaining > 0 ? Math.round((yardage / (hours * remaining)) * 10) / 10 : null
            out[s.code] = { adjustedYph, count: slack }
        })
        return out
    }, [stats, plantProduction, minPoolByCode])

    /* ── Time scrubber ────────────────────────────────────────────────────
       `viewTime` in minutes since midnight (null = whole-day view). When
       set, the "needs help" badge flips from day-aggregate peak-overbook to
       a point-in-time check: pool(t) < 0 AND the plant has an order actively
       pouring at t. Idle plants are never flagged — no jobs, no help. */
    const [viewTime, setViewTime] = useState(null)

    /** Orders actively pouring at a given minute, grouped by plant. An order
     *  is active from its start time until its last-return moment (the full
     *  pour window including round-trip cycles). */
    const activeOrdersAtTime = useMemo(() => {
        if (!Number.isFinite(viewTime)) return null
        const byPlant = {}
        flatOrders.forEach((order) => {
            const startMin = timeToMinutes(order?.startTime)
            if (!Number.isFinite(startMin)) return
            const key = order.orderId || `${order.plantCode ?? 'unknown'}-${startMin}-${order.orderNum ?? ''}`
            const entry = poolTimeline?.[key]
            const endMin = Number.isFinite(entry?.lastReturnMinutes)
                ? entry.lastReturnMinutes
                : startMin + (getOrderPourDurationMinutes(order) ?? 60)
            if (viewTime < startMin || viewTime > endMin) return
            const list = (byPlant[order.plantCode] ||= [])
            list.push({ endMin, order, startMin })
        })
        return byPlant
    }, [viewTime, flatOrders, poolTimeline])

    /** Per-plant pool value at `viewTime`. Null when no time is selected or
     *  the plant has no timeline. */
    const poolAtViewTime = useMemo(() => {
        if (!Number.isFinite(viewTime)) return null
        const out = {}
        Object.entries(poolTimelinesByPlant || {}).forEach(([code, timeline]) => {
            out[code] = poolAtTime(timeline, viewTime)
        })
        return out
    }, [viewTime, poolTimelinesByPlant])

    /** Effective operator count at `viewTime` — base roster adjusted for help
     *  that's active right now (outbound sent but not yet returned, inbound
     *  arrived but not yet returned). This is what the node badge should read
     *  when the scrubber is engaged: total operators currently assigned to
     *  this plant, regardless of whether they're out on a job or idle. */
    const effAtViewTime = useMemo(() => {
        if (!Number.isFinite(viewTime)) return null
        const out = {}
        ;(stats || []).forEach((s) => {
            if (s?.code) out[s.code] = Number.isFinite(s.base) ? s.base : 0
        })
        ;(assignments || []).forEach((a) => {
            if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
            const count = parseInt(a.driverCount, 10) || 0
            if (count <= 0) return
            const arrivalMin = timeToMinutes(a.time)
            if (!Number.isFinite(arrivalMin) || viewTime < arrivalMin) return
            const leaveMin = timeToMinutes(a.leaveTime)
            const stillOut = !Number.isFinite(leaveMin) || viewTime < leaveMin
            if (!stillOut) return
            out[a.fromPlant] = (out[a.fromPlant] ?? 0) - count
            out[a.toPlant] = (out[a.toPlant] ?? 0) + count
        })
        return out
    }, [viewTime, stats, assignments])

    const selected = selectedCode ? allPlantStats.find((s) => s.code === selectedCode) : null
    const hasNodes = nodeItems.length > 0 && Object.keys(positions).length > 0

    /* ── Node interaction ─────────────────────────────────────────────── */
    const handleNodeClick = (code) => {
        if (pickingDestination && draft && code !== draft.fromPlant) {
            setDraft({ ...draft, toPlant: code })
            setPickingDestination(false)
            return
        }
        setSelectedCode((prev) => (prev === code ? null : code))
    }

    /* ── Editor lifecycle ─────────────────────────────────────────────── */
    const openAddRoute = () => {
        if (!selected) return
        setPanelMode('add')
        setDraft({
            driverCount: 1,
            fromPlant: selected.code,
            leaveTime: '',
            staggerMinutes: 5,
            time: '',
            toPlant: ''
        })
        setEditingIndex(null)
        setPickingDestination(true)
    }
    const openEditRoute = (assignmentIndex) => {
        const a = assignments[assignmentIndex]
        if (!a) return
        setPanelMode('edit')
        setEditingIndex(assignmentIndex)
        setDraft({
            driverCount: parseInt(a.driverCount, 10) || 1,
            fromPlant: a.fromPlant,
            leaveTime: a.leaveTime || '',
            staggerMinutes: parseInt(a.staggerMinutes, 10) || 5,
            time: a.time || '',
            toPlant: a.toPlant
        })
        setPickingDestination(false)
    }
    const cancelEditor = () => {
        setPanelMode('overview')
        setDraft(null)
        setEditingIndex(null)
        setPickingDestination(false)
    }
    const submitEditor = () => {
        if (!draft?.fromPlant || !draft?.toPlant) return
        const payload = {
            driverCount: Math.max(0, parseInt(draft.driverCount, 10) || 0),
            fromPlant: draft.fromPlant,
            leaveTime: draft.leaveTime || '',
            staggerMinutes: Math.max(0, parseInt(draft.staggerMinutes, 10) || 0),
            time: draft.time,
            toPlant: draft.toPlant
        }
        if (panelMode === 'edit' && editingIndex != null) {
            setAssignments((prev) => prev.map((a, idx) => (idx === editingIndex ? { ...a, ...payload } : a)))
        } else {
            const newAssignment = { ...createEmptyAssignment(), ...payload }
            setAssignments((prev) => [...prev, newAssignment])
        }
        cancelEditor()
    }
    const deleteAssignment = (assignmentIndex) => {
        const a = assignments[assignmentIndex]
        if (!a) return
        if (!window.confirm(`Delete ${a.fromPlant || '?'} → ${a.toPlant || '?'} route?`)) return
        setAssignments((prev) => prev.filter((_, idx) => idx !== assignmentIndex))
        cancelEditor()
    }
    /* ── Zoom helpers ─────────────────────────────────────────────────── */
    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))
    const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))
    const zoomReset = () => setZoom(1)

    /* ── Data derived for panel ───────────────────────────────────────── */
    // `allPlantStats` already contains every plant — there's no separate
    // "not in plan" bucket to surface anymore.

    const outbound = useMemo(() => {
        if (!selectedCode) return []
        return assignments.map((a, idx) => ({ ...a, idx })).filter((a) => a.fromPlant === selectedCode && a.toPlant)
    }, [assignments, selectedCode])
    const inbound = useMemo(() => {
        if (!selectedCode) return []
        return assignments.map((a, idx) => ({ ...a, idx })).filter((a) => a.toPlant === selectedCode && a.fromPlant)
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
            edges.filter((e) => e.from === selectedCode || e.to === selectedCode).map((e) => `${e.from}->${e.to}`)
        )
    }, [edges, selectedCode])

    /**
     * Position each edge label so it doesn't get hidden by a third-party node
     * sitting on top of the line. We start at the edge midpoint, then if any
     * non-endpoint node would obscure it, push the label perpendicular to the
     * edge until it's clear. The original midpoint is also returned so we can
     * draw a small connector line back to the edge.
     */
    const labelLayout = useMemo(() => {
        const out = {}
        const LABEL_HALF = 14 // approx label half-height in px
        const PADDING = 10
        const obstacles = allPlantStats
            .map((s) => ({ code: s.code, pos: positions[s.code], radius: radiusByCode[s.code] || NODE_RADIUS_MIN }))
            .filter((o) => o.pos)
        for (const e of edges) {
            const from = positions[e.from]
            const to = positions[e.to]
            if (!from || !to) continue
            const dx = to.x - from.x
            const dy = to.y - from.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const ux = dx / len
            const uy = dy / len
            // Match the SVG's perpendicular offset for bidirectional edges so
            // each direction's label floats over its own arrow, not between.
            const key = `${e.from}->${e.to}`
            const isBidirectional = bidirectionalEdgeKeys.has(key)
            const laneOffX = isBidirectional ? uy * EDGE_PARALLEL_OFFSET : 0
            const laneOffY = isBidirectional ? -ux * EDGE_PARALLEL_OFFSET : 0
            const midX = (from.x + to.x) / 2 + laneOffX
            const midY = (from.y + to.y) / 2 + laneOffY
            const px = -uy
            const py = ux
            const blockers = obstacles.filter((o) => o.code !== e.from && o.code !== e.to)
            const isOccluded = (x, y) => {
                for (const o of blockers) {
                    const r = o.radius + LABEL_HALF + PADDING
                    const ddx = o.pos.x - x
                    const ddy = o.pos.y - y
                    if (ddx * ddx + ddy * ddy < r * r) return true
                }
                return false
            }
            let lx = midX
            let ly = midY
            if (isOccluded(midX, midY)) {
                let foundClear = false
                for (let step = 30; step <= 260 && !foundClear; step += 20) {
                    for (const sign of [1, -1]) {
                        const tx = midX + px * step * sign
                        const ty = midY + py * step * sign
                        if (!isOccluded(tx, ty)) {
                            lx = tx
                            ly = ty
                            foundClear = true
                            break
                        }
                    }
                }
            }
            const offset = Math.hypot(lx - midX, ly - midY)
            out[key] = { anchorX: midX, anchorY: midY, offset, x: lx, y: ly }
        }
        return out
    }, [edges, positions, allPlantStats, radiusByCode, bidirectionalEdgeKeys])

    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Canvas */}
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
                {/* Sticky toolbar — stays in viewport while the content scrolls */}
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
                            · {edges.length} route{edges.length === 1 ? '' : 's'} · {allPlantStats.length} plant
                            {allPlantStats.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                        {pickingDestination && (
                            <div
                                className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold animate-pulse"
                                style={{
                                    background: '#f59e0b',
                                    color: '#fff'
                                }}
                            >
                                <i className="fas fa-crosshairs text-[11px]" />
                                Click a plant to set destination
                                <button
                                    onClick={() => setPickingDestination(false)}
                                    className="border-none bg-white/20 rounded px-1.5 py-0.5 text-[10px] cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                        {selectedCode && !pickingDestination && (
                            <button
                                onClick={() => setSelectedCode(null)}
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
                        {/* Zoom pill */}
                        <div
                            className="flex items-center rounded-lg overflow-hidden"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-light)',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <button
                                onClick={zoomOut}
                                disabled={zoom <= MIN_ZOOM + 0.001}
                                className="px-2.5 py-1.5 border-none bg-transparent cursor-pointer text-xs"
                                style={{ color: 'var(--text-secondary)', opacity: zoom <= MIN_ZOOM + 0.001 ? 0.4 : 1 }}
                                title="Zoom out"
                            >
                                <i className="fas fa-magnifying-glass-minus" />
                            </button>
                            <button
                                onClick={zoomReset}
                                className="px-2.5 py-1.5 border-none bg-transparent cursor-pointer text-[11px] font-semibold"
                                style={{
                                    color: 'var(--text-primary)',
                                    minWidth: 46,
                                    fontVariantNumeric: 'tabular-nums'
                                }}
                                title="Reset zoom"
                            >
                                {Math.round(zoom * 100)}%
                            </button>
                            <button
                                onClick={zoomIn}
                                disabled={zoom >= MAX_ZOOM - 0.001}
                                className="px-2.5 py-1.5 border-none bg-transparent cursor-pointer text-xs"
                                style={{ color: 'var(--text-secondary)', opacity: zoom >= MAX_ZOOM - 0.001 ? 0.4 : 1 }}
                                title="Zoom in"
                            >
                                <i className="fas fa-magnifying-glass-plus" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Time scrubber — 24-hour slider that drives the point-in-time
                    "needs help" view. Sticky below the main toolbar. */}
                <TimeScrubber
                    accentColor={accentColor}
                    viewTime={viewTime}
                    onChange={setViewTime}
                    hasActivity={Number.isFinite(viewTime) ? Object.keys(activeOrdersAtTime || {}).length : null}
                />

                {/* Zoomable layer — wrapped in a flex centerer so that when the
                    scaled content is narrower than the viewport it stays
                    horizontally centered (instead of clinging to the left edge),
                    and when wider the scroll container still pans normally. */}
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
                                <svg
                                    className="absolute inset-0 pointer-events-none"
                                    width={layoutWidth}
                                    height={layoutHeight}
                                    viewBox={`0 0 ${layoutWidth} ${layoutHeight}`}
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
                                            <path d="M 0 0 L 10 5 L 0 10 Z" fill="#f59e0b" />
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
                                        const key = `${e.from}->${e.to}`
                                        // Offset perpendicular to travel direction so an opposite
                                        // edge (B→A) naturally lands on the other side, producing
                                        // two parallel lanes instead of one stacked line.
                                        const isBidirectional = bidirectionalEdgeKeys.has(key)
                                        const offX = isBidirectional ? uy * EDGE_PARALLEL_OFFSET : 0
                                        const offY = isBidirectional ? -ux * EDGE_PARALLEL_OFFSET : 0
                                        const x1 = from.x + ux * rFrom + offX
                                        const y1 = from.y + uy * rFrom + offY
                                        const x2 = to.x - ux * rTo + offX
                                        const y2 = to.y - uy * rTo + offY
                                        const isRelated = activeRelatedEdges.has(key)
                                        const isHover = hoverEdgeKey === key
                                        const active = isRelated || isHover
                                        const baseOpacity = selectedCode && !isRelated ? 0.25 : 1
                                        return (
                                            <line
                                                key={key}
                                                x1={x1}
                                                y1={y1}
                                                x2={x2}
                                                y2={y2}
                                                stroke={active ? '#f59e0b' : accentColor}
                                                strokeWidth={active ? 3 : 2}
                                                strokeOpacity={e.isReturn ? baseOpacity * 0.55 : baseOpacity}
                                                strokeLinecap="round"
                                                strokeDasharray={e.isReturn ? '6 4' : undefined}
                                                markerEnd={active ? 'url(#flow-arrow-highlight)' : 'url(#flow-arrow)'}
                                            />
                                        )
                                    })}
                                </svg>
                            )}

                            {hasNodes &&
                                edges.map((e) => {
                                    const key = `${e.from}->${e.to}`
                                    const layout = labelLayout[key]
                                    if (!layout) return null
                                    const isRelated = activeRelatedEdges.has(key)
                                    const muted = selectedCode && !isRelated
                                    const isOffset = layout.offset > 4
                                    return (
                                        <React.Fragment key={`lbl-${key}`}>
                                            {isOffset && (
                                                <svg
                                                    className="absolute pointer-events-none"
                                                    width={layoutWidth}
                                                    height={layoutHeight}
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
                                                        stroke={isRelated ? '#f59e0b' : 'var(--border-medium)'}
                                                        strokeWidth={1.25}
                                                        strokeDasharray="3 3"
                                                    />
                                                </svg>
                                            )}
                                            <div
                                                onMouseEnter={() => setHoverEdgeKey(key)}
                                                onMouseLeave={() => setHoverEdgeKey(null)}
                                                className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full flex items-center gap-1.5 text-[10.5px] font-semibold cursor-default"
                                                style={{
                                                    background: 'var(--bg-primary)',
                                                    border: `1px solid ${isRelated ? '#f59e0b' : 'var(--border-light)'}`,
                                                    boxShadow: 'var(--shadow-sm)',
                                                    color: 'var(--text-primary)',
                                                    left: `${layout.x}px`,
                                                    opacity: muted ? 0.5 : e.isReturn ? 0.85 : 1,
                                                    top: `${layout.y}px`,
                                                    zIndex: 20
                                                }}
                                            >
                                                <i
                                                    className={`fas ${e.isReturn ? 'fa-rotate-left' : 'fa-truck'} text-[9px]`}
                                                    style={{ color: isRelated ? '#f59e0b' : accentColor }}
                                                />
                                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                    {e.ops > 0
                                                        ? `${e.isReturn ? '−' : '+'}${e.ops} op${e.ops === 1 ? '' : 's'}`
                                                        : 'Route'}
                                                </span>
                                                {e.earliest && (
                                                    <span style={{ color: 'var(--text-secondary)' }}>
                                                        · {e.earliest}
                                                    </span>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    )
                                })}

                            {allPlantStats.map((s) => {
                                const pos = positions[s.code]
                                if (!pos) return null
                                const isSelected = selectedCode === s.code
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
                                const minPool = minPoolByCode[s.code]
                                // When the scrubber is set to a specific time, "needs
                                // help" is point-in-time: pool(t) < 0 AND a job is
                                // actively pouring at t. Idle plants never flag.
                                // Whole-day view falls back to the day-aggregate
                                // peak-overbook signal + YPH > MAX heuristic.
                                const isTimeView = Number.isFinite(viewTime)
                                const poolNow = isTimeView ? poolAtViewTime?.[s.code] : null
                                const activeNow = isTimeView ? activeOrdersAtTime?.[s.code]?.length || 0 : 0
                                const timeDeficit =
                                    isTimeView && Number.isFinite(poolNow) && poolNow < 0 && activeNow > 0
                                        ? -poolNow
                                        : 0
                                const peakOverbookShortage = isTimeView
                                    ? timeDeficit
                                    : Number.isFinite(minPool) && minPool < 0
                                      ? -minPool
                                      : 0
                                const needsHelp = isTimeView
                                    ? timeDeficit > 0
                                    : (yph != null && yph > MAX_YPH) || peakOverbookShortage > 0
                                const leaveOffInfo =
                                    !needsHelp && !isTimeView
                                        ? leaveOffByCode[s.code] || { adjustedYph: null, count: 0 }
                                        : { adjustedYph: null, count: 0 }
                                const leaveOff = leaveOffInfo.count
                                const adjustedYph = leaveOffInfo.adjustedYph
                                const hasLeaveOff = leaveOff > 0
                                const r = radiusByCode[s.code] || NODE_RADIUS_MIN
                                const codeFontSize = Math.round(Math.max(18, Math.min(34, r * 0.38)))
                                const isDestinationCandidate = pickingDestination && draft && s.code !== draft.fromPlant
                                const boxShadow = isSelected
                                    ? `0 0 0 3px ${accentColor}, var(--shadow)`
                                    : isDestinationCandidate
                                      ? '0 0 0 3px #f59e0b, var(--shadow)'
                                      : needsHelp
                                        ? `0 0 0 2px ${NEEDS_HELP_COLOR}44, var(--shadow)`
                                        : hasLeaveOff
                                          ? `0 0 0 2px ${LEAVE_OFF_COLOR}44, var(--shadow)`
                                          : 'var(--shadow)'
                                return (
                                    <button
                                        key={s.code}
                                        onClick={() => handleNodeClick(s.code)}
                                        className="absolute cursor-pointer border-none rounded-full p-0"
                                        style={{
                                            background: isSelected ? `${accentColor}14` : 'var(--bg-primary)',
                                            boxShadow,
                                            height: r * 2,
                                            left: `${pos.x - r}px`,
                                            top: `${pos.y - r}px`,
                                            transition: 'box-shadow 0.2s, background 0.2s',
                                            width: r * 2,
                                            zIndex: 10
                                        }}
                                        title={(() => {
                                            const base = `Plant ${s.code} · ${s.eff} op${s.eff === 1 ? '' : 's'}`
                                            if (isTimeView) {
                                                const t = minutesToTime(viewTime)
                                                if (activeNow === 0) return `${base} · Idle at ${t} — no help needed`
                                                if (needsHelp) {
                                                    return `${base} · NEEDS HELP at ${t} — short ${timeDeficit} truck${timeDeficit === 1 ? '' : 's'} (${activeNow} active order${activeNow === 1 ? '' : 's'})`
                                                }
                                                return `${base} · Covered at ${t} — pool ${Number.isFinite(poolNow) ? poolNow : '—'}, ${activeNow} active`
                                            }
                                            if (needsHelp) {
                                                const parts = []
                                                if (yph != null && yph > MAX_YPH) parts.push(`YPH ${yph} > ${MAX_YPH}`)
                                                if (peakOverbookShortage > 0) {
                                                    parts.push(
                                                        `peak demand overbooks by ${peakOverbookShortage} truck${peakOverbookShortage === 1 ? '' : 's'}`
                                                    )
                                                }
                                                return `${base} · NEEDS HELP (${parts.join(' · ')})`
                                            }
                                            if (hasLeaveOff) {
                                                return `${base} · low YPH ${yph ?? ''} — leave off ${leaveOff} driver${leaveOff === 1 ? '' : 's'}${adjustedYph != null ? ` → adjusted YPH ${adjustedYph.toFixed(1)}` : ''}`
                                            }
                                            return base
                                        })()}
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
                                                className="absolute px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white"
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
                                        {needsHelp && (
                                            <span
                                                className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap animate-pulse"
                                                style={{
                                                    background: NEEDS_HELP_COLOR,
                                                    bottom: -9,
                                                    boxShadow: `0 0 0 2px var(--bg-secondary), 0 2px 6px ${NEEDS_HELP_COLOR}55`,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 2
                                                }}
                                                title={
                                                    isTimeView
                                                        ? `At ${minutesToTime(viewTime)} — short ${timeDeficit} truck${timeDeficit === 1 ? '' : 's'} (${activeNow} order${activeNow === 1 ? '' : 's'} actively pouring)`
                                                        : peakOverbookShortage > 0
                                                          ? `Peak demand overbooks this plant by ${peakOverbookShortage} truck${peakOverbookShortage === 1 ? '' : 's'} — big-pour requirements exceed current pool${yph != null && yph > MAX_YPH ? ` (YPH ${yph} > ${MAX_YPH})` : ''}`
                                                          : `YPH ${yph} exceeds max (${MAX_YPH}) — operators overloaded`
                                                }
                                            >
                                                <i className="fas fa-triangle-exclamation text-[8px]" />
                                                Needs Help
                                            </span>
                                        )}
                                        {hasLeaveOff && (
                                            <span
                                                className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                                                style={{
                                                    background: LEAVE_OFF_COLOR,
                                                    bottom: -9,
                                                    boxShadow: `0 0 0 2px var(--bg-secondary), 0 2px 6px ${LEAVE_OFF_COLOR}55`,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 2
                                                }}
                                                title={`YPH ${yph} below target ${TARGET_YPH} — leave off ${leaveOff} driver${leaveOff === 1 ? '' : 's'}${adjustedYph != null ? ` to bring YPH to ${adjustedYph.toFixed(1)}` : ''}`}
                                            >
                                                <i className="fas fa-user-minus text-[8px]" />
                                                Leave off {leaveOff}
                                                {adjustedYph != null && (
                                                    <span className="opacity-90 normal-case font-semibold">
                                                        → {adjustedYph.toFixed(1)} yph
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        <div className="flex flex-col items-center justify-center h-full gap-0.5">
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
                                            {isTimeView ? (
                                                <>
                                                    {(() => {
                                                        const effNow = effAtViewTime?.[s.code]
                                                        const effDisplay = Number.isFinite(effNow) ? effNow : s.base
                                                        const effDelta = Number.isFinite(effNow)
                                                            ? effNow - (s.base ?? 0)
                                                            : 0
                                                        return (
                                                            <span
                                                                className="text-[11px]"
                                                                style={{ color: 'var(--text-secondary)' }}
                                                            >
                                                                {effDisplay} op{effDisplay === 1 ? '' : 's'}
                                                                {effDelta !== 0 && (
                                                                    <>
                                                                        {' '}
                                                                        <span
                                                                            style={{
                                                                                color:
                                                                                    effDelta > 0
                                                                                        ? '#16a34a'
                                                                                        : '#dc2626',
                                                                                fontWeight: 700
                                                                            }}
                                                                        >
                                                                            ({effDelta > 0 ? '+' : ''}
                                                                            {effDelta})
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </span>
                                                        )
                                                    })()}
                                                    {(() => {
                                                        const poolNow = poolAtViewTime?.[s.code]
                                                        if (!Number.isFinite(poolNow)) return null
                                                        const poolColor =
                                                            poolNow < 0
                                                                ? NEEDS_HELP_COLOR
                                                                : poolNow === 0
                                                                  ? '#d97706'
                                                                  : '#16a34a'
                                                        return (
                                                            <span
                                                                className="text-[10px] font-bold"
                                                                style={{
                                                                    color: poolColor,
                                                                    fontFamily: 'var(--font-heading)'
                                                                }}
                                                                title={`${poolNow} truck${poolNow === 1 ? '' : 's'} at plant, ready to dispatch at ${minutesToTime(viewTime)}`}
                                                            >
                                                                avail {poolNow}
                                                            </span>
                                                        )
                                                    })()}
                                                </>
                                            ) : (
                                                <>
                                                    <span
                                                        className="text-[11px]"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                    >
                                                        {s.eff} op{s.eff === 1 ? '' : 's'}
                                                        {net !== 0 && (
                                                            <>
                                                                {' '}
                                                                <span
                                                                    style={{
                                                                        color: net > 0 ? '#16a34a' : '#dc2626',
                                                                        fontWeight: 700
                                                                    }}
                                                                >
                                                                    ({net > 0 ? '+' : ''}
                                                                    {net})
                                                                </span>
                                                            </>
                                                        )}
                                                    </span>
                                                    {yph != null && (
                                                        <span
                                                            className="text-[10px] font-bold"
                                                            style={{
                                                                color: ringColor,
                                                                fontFamily: 'var(--font-heading)'
                                                            }}
                                                        >
                                                            {yph} yph
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </button>
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

            {/* Side panel — plant overview / route editor */}
            <aside
                className="w-[360px] shrink-0 overflow-y-auto flex flex-col"
                style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-light)' }}
            >
                {!selected && panelMode === 'overview' && <EmptyPanel accentColor={accentColor} />}

                {selected && panelMode === 'overview' && (
                    <PlantOverview
                        accentColor={accentColor}
                        selected={selected}
                        mixerCountsByPlant={mixerCountsByPlant}
                        yphByCode={yphByCode}
                        yphColorFor={yphColorFor}
                        production={plantProduction[selected.code] || {}}
                        outbound={outbound}
                        inbound={inbound}
                        canEdit={canEdit}
                        onAddRoute={openAddRoute}
                        onEditRoute={openEditRoute}
                        onDeleteRoute={deleteAssignment}
                        calcClockIn={calcClockIn}
                        getTravelTime={getTravelTime}
                    />
                )}

                {(panelMode === 'add' || panelMode === 'edit') && draft && (
                    <RouteEditor
                        accentColor={accentColor}
                        mode={panelMode}
                        draft={draft}
                        setDraft={setDraft}
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

/* ═══════════════════════════════════════════════════════════════════════
   Time scrubber — 24-hour horizontal slider for point-in-time help view
   ═══════════════════════════════════════════════════════════════════════ */

const SCRUB_MIN = 0
const SCRUB_MAX = 24 * 60 - 1
const SCRUB_STEP = 15

function TimeScrubber({ accentColor, hasActivity, onChange, viewTime }) {
    const active = Number.isFinite(viewTime)
    const displayValue = active ? viewTime : 12 * 60
    const clockLabel = active ? minutesToTime(displayValue) : 'All day'
    const activityNote = !active
        ? null
        : hasActivity === 0
          ? 'No plants active at this time'
          : `${hasActivity} plant${hasActivity === 1 ? '' : 's'} actively pouring`
    return (
        <div className="sticky z-20 flex justify-center px-4 pb-3 pointer-events-none" style={{ top: '60px' }}>
            <div
                className="pointer-events-auto w-full max-w-2xl rounded-lg flex items-center gap-3 px-3 py-2"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <button
                    type="button"
                    onClick={() => onChange(active ? null : 12 * 60)}
                    className="border-none rounded cursor-pointer px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                        background: active ? accentColor : 'var(--bg-secondary)',
                        color: active ? '#fff' : 'var(--text-secondary)'
                    }}
                    title={active ? 'Return to whole-day view' : 'Enable point-in-time view'}
                >
                    <i className={`fas ${active ? 'fa-clock' : 'fa-calendar-day'} mr-1 text-[9px]`} />
                    {active ? 'At time' : 'All day'}
                </button>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    <input
                        type="range"
                        min={SCRUB_MIN}
                        max={SCRUB_MAX}
                        step={SCRUB_STEP}
                        value={displayValue}
                        onChange={(event) => onChange(parseInt(event.target.value, 10))}
                        className="flex-1"
                        style={{ accentColor }}
                        title={active ? `Viewing ${clockLabel}` : 'Drag to pick a time'}
                    />
                    <div
                        className="font-mono font-bold text-[13px] shrink-0 min-w-[62px] text-right"
                        style={{ color: active ? accentColor : 'var(--text-tertiary)' }}
                    >
                        {clockLabel}
                    </div>
                </div>
                {active && activityNote && (
                    <span
                        className="text-[10.5px] font-semibold whitespace-nowrap hidden sm:inline"
                        style={{ color: hasActivity === 0 ? 'var(--text-tertiary)' : '#16a34a' }}
                    >
                        <i className={`fas ${hasActivity === 0 ? 'fa-moon' : 'fa-truck'} mr-1 text-[9px]`} />
                        {activityNote}
                    </span>
                )}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
   Side-panel subcomponents
   ═══════════════════════════════════════════════════════════════════════ */

function EmptyPanel({ accentColor }) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-6 flex-1">
            <i className="fas fa-arrow-pointer text-3xl mb-3 opacity-60" style={{ color: accentColor }} />
            <div
                className="font-bold text-[15px] mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
            >
                Pick a plant
            </div>
            <div className="text-[12px] max-w-[240px]" style={{ color: 'var(--text-secondary)' }}>
                Click a node to inspect it, edit its routes, or send trucks to another plant.
            </div>
        </div>
    )
}

function PlantOverview({
    accentColor,
    calcClockIn,
    canEdit,
    getTravelTime,
    inbound,
    mixerCountsByPlant,
    onAddRoute,
    onDeleteRoute,
    onEditRoute,
    outbound,
    production,
    selected,
    yphByCode,
    yphColorFor
}) {
    const yph = yphByCode[selected.code]
    return (
        <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center rounded-xl"
                    style={{
                        background: accentColor,
                        color: '#fff',
                        fontFamily: 'var(--font-heading)',
                        fontSize: 16,
                        fontWeight: 700,
                        height: 44,
                        width: 44
                    }}
                >
                    {selected.code}
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        className="font-bold text-[18px]"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                    >
                        Plant {selected.code}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {mixerCountsByPlant[selected.code] || 0} base ·{' '}
                        <span style={{ color: '#dc2626' }}>-{selected.send || 0} sent</span> ·{' '}
                        <span style={{ color: '#16a34a' }}>+{selected.recv || 0} recv</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <StatTile label="Eff ops" value={selected.eff} />
                <StatTile label="Yardage" value={production.totalYardage || '—'} />
                <StatTile
                    label="YPH"
                    value={yph ?? '—'}
                    color={yph != null ? yphColorFor(yph, accentColor) : undefined}
                />
            </div>

            {canEdit && (
                <button
                    onClick={onAddRoute}
                    className="border-none rounded-lg cursor-pointer text-sm font-semibold text-white flex items-center justify-center gap-2 py-2.5"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-truck" />
                    Send Trucks from {selected.code}
                </button>
            )}

            <Section title="Outbound" count={outbound.length} icon="fa-arrow-up-from-bracket">
                {outbound.length === 0 && <EmptyHint>No outbound routes from {selected.code}</EmptyHint>}
                {outbound.map((a) => (
                    <RouteRow
                        key={`out-${a.idx}`}
                        accentColor={accentColor}
                        assignment={a}
                        canEdit={canEdit}
                        onEdit={() => onEditRoute(a.idx)}
                        onDelete={() => onDeleteRoute(a.idx)}
                        travel={getTravelTime?.(a.fromPlant, a.toPlant)}
                        clockIn={a.time && calcClockIn ? calcClockIn(a.time, a.fromPlant, a.toPlant) : null}
                    />
                ))}
            </Section>

            <Section title="Inbound" count={inbound.length} icon="fa-arrow-down-to-bracket">
                {inbound.length === 0 && <EmptyHint>No inbound routes to {selected.code}</EmptyHint>}
                {inbound.map((a) => (
                    <RouteRow
                        key={`in-${a.idx}`}
                        accentColor={accentColor}
                        assignment={a}
                        canEdit={canEdit}
                        onEdit={() => onEditRoute(a.idx)}
                        onDelete={() => onDeleteRoute(a.idx)}
                        travel={getTravelTime?.(a.fromPlant, a.toPlant)}
                        clockIn={a.time && calcClockIn ? calcClockIn(a.time, a.fromPlant, a.toPlant) : null}
                    />
                ))}
            </Section>
        </div>
    )
}

function RouteEditor({
    accentColor,
    clockIn,
    draft,
    mode,
    onCancel,
    onDelete,
    onSubmit,
    pickingDestination,
    plants,
    setDraft,
    setPickingDestination,
    stats,
    travel
}) {
    const leaveMins = timeToMinutes(draft.leaveTime)
    const returnTime = leaveMins != null && travel != null ? minutesToTime(leaveMins + travel) : null

    const destinationOptions = useMemo(() => {
        // Show all plants except the sender; prefer ones already in the plan.
        const inPlanCodes = new Set(stats.map((s) => s.code))
        const all = (plants || []).filter((p) => p.plant_code !== draft.fromPlant)
        return [...all].sort((a, b) => {
            const ai = inPlanCodes.has(a.plant_code) ? 0 : 1
            const bi = inPlanCodes.has(b.plant_code) ? 0 : 1
            if (ai !== bi) return ai - bi
            return a.plant_code.localeCompare(b.plant_code)
        })
    }, [plants, draft.fromPlant, stats])

    return (
        <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={onCancel}
                    className="border-none bg-transparent cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-chevron-left text-[10px]" /> Back
                </button>
                <div
                    className="font-bold text-[16px] ml-auto"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {mode === 'edit' ? 'Edit Route' : 'New Route'}
                </div>
            </div>

            {/* From → To flow summary */}
            <div
                className="rounded-xl p-3 flex items-center justify-between gap-2"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
                <div
                    className="rounded-lg px-3 py-2 text-center flex-1"
                    style={{ background: `${accentColor}14`, color: accentColor }}
                >
                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">From</div>
                    <div className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                        {draft.fromPlant || '—'}
                    </div>
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>
                    <i className="fas fa-arrow-right" />
                </div>
                <div
                    className="rounded-lg px-3 py-2 text-center flex-1"
                    style={{
                        background: draft.toPlant ? `${accentColor}14` : 'var(--bg-primary)',
                        border: draft.toPlant ? 'none' : '1px dashed var(--border-medium)',
                        color: draft.toPlant ? accentColor : 'var(--text-tertiary)'
                    }}
                >
                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">To</div>
                    <div className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                        {draft.toPlant || 'Pick…'}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <select
                    value={draft.toPlant || ''}
                    onChange={(e) => {
                        setDraft({ ...draft, toPlant: e.target.value })
                        setPickingDestination(false)
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-sm border"
                    style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <option value="">Select destination…</option>
                    {destinationOptions.map((p) => (
                        <option key={p.plant_code} value={p.plant_code}>
                            {p.plant_code}
                            {p.plant_name ? ` — ${p.plant_name}` : ''}
                        </option>
                    ))}
                </select>
                <button
                    onClick={() => setPickingDestination((v) => !v)}
                    className="px-2.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                    style={{
                        background: pickingDestination ? '#f59e0b' : 'var(--bg-primary)',
                        borderColor: pickingDestination ? '#f59e0b' : 'var(--border-medium)',
                        color: pickingDestination ? '#fff' : 'var(--text-secondary)'
                    }}
                    title="Click a plant on the canvas"
                >
                    <i className="fas fa-crosshairs" />
                </button>
            </div>

            <LabeledField label="Trucks">
                <input
                    type="number"
                    min={0}
                    value={draft.driverCount}
                    onChange={(e) => setDraft({ ...draft, driverCount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                    style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
            </LabeledField>

            <div className="grid grid-cols-2 gap-2">
                <LabeledField label="Arrival time">
                    <input
                        type="time"
                        value={draft.time || ''}
                        onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                        style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-medium)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </LabeledField>
                <LabeledField
                    label={
                        <>
                            Leave time <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· return</span>
                        </>
                    }
                >
                    <input
                        type="time"
                        value={draft.leaveTime || ''}
                        onChange={(e) => setDraft({ ...draft, leaveTime: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                        style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-medium)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </LabeledField>
            </div>

            <LabeledField
                label={
                    <>
                        Stagger{' '}
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>
                            · {draft.staggerMinutes || 0} min
                        </span>
                    </>
                }
            >
                <input
                    type="range"
                    min={0}
                    max={15}
                    step={1}
                    value={draft.staggerMinutes || 0}
                    onChange={(e) => setDraft({ ...draft, staggerMinutes: parseInt(e.target.value, 10) })}
                    className="w-full"
                    style={{ accentColor }}
                />
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span>0m</span>
                    <span>15m</span>
                </div>
            </LabeledField>

            <div
                className="rounded-lg p-3 grid grid-cols-3 gap-2"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
                <div>
                    <div
                        className="text-[9px] uppercase tracking-wider font-bold"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        Travel
                    </div>
                    <div
                        className="font-bold text-base"
                        style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
                    >
                        {travel != null ? `${travel}m` : '—'}
                    </div>
                </div>
                <div>
                    <div
                        className="text-[9px] uppercase tracking-wider font-bold"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        Clock-in
                    </div>
                    <div
                        className="font-bold text-base"
                        style={{
                            color: clockIn ? '#16a34a' : 'var(--text-tertiary)',
                            fontFamily: 'var(--font-heading)'
                        }}
                    >
                        {clockIn || '—'}
                    </div>
                </div>
                <div>
                    <div
                        className="text-[9px] uppercase tracking-wider font-bold"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        Return
                    </div>
                    <div
                        className="font-bold text-base"
                        style={{
                            color: returnTime ? accentColor : 'var(--text-tertiary)',
                            fontFamily: 'var(--font-heading)'
                        }}
                    >
                        {returnTime || '—'}
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-auto">
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border"
                        style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-medium)',
                            color: '#dc2626'
                        }}
                    >
                        <i className="fas fa-trash mr-1" /> Delete
                    </button>
                )}
                <button
                    onClick={onCancel}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border"
                    style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-medium)',
                        color: 'var(--text-secondary)'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={!draft.toPlant}
                    className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-check mr-1" /> {mode === 'edit' ? 'Save changes' : 'Create route'}
                </button>
            </div>
        </div>
    )
}

function Section({ children, count, icon, title }) {
    return (
        <div>
            <div
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-secondary)' }}
            >
                <i className={`fas ${icon} text-[9px]`} />
                {title} ({count})
            </div>
            <div className="flex flex-col gap-1.5">{children}</div>
        </div>
    )
}

function EmptyHint({ children }) {
    return (
        <div
            className="text-[12px] italic px-3 py-4 text-center rounded-lg"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
        >
            {children}
        </div>
    )
}

function RouteRow({ accentColor, assignment, canEdit, clockIn, onDelete, onEdit, travel }) {
    const ops = parseInt(assignment.driverCount, 10) || 0
    return (
        <div
            className="rounded-lg p-2.5 flex items-center gap-2.5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="flex items-center gap-1 font-bold text-[12px]"
                style={{ color: accentColor, fontFamily: 'var(--font-heading)' }}
            >
                <span>{assignment.fromPlant}</span>
                <i className="fas fa-arrow-right text-[9px]" />
                <span>{assignment.toPlant}</span>
            </div>
            <div className="flex-1" />
            <div className="text-right">
                <div
                    className="text-[13px] font-bold leading-none"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
                >
                    {assignment.time || '—'}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {ops} op{ops === 1 ? '' : 's'}
                    {travel != null && <> · {travel}m</>}
                </div>
                {clockIn && (
                    <div className="text-[10px] font-semibold" style={{ color: '#16a34a' }}>
                        clock {clockIn}
                    </div>
                )}
                {assignment.leaveTime && (
                    <div className="text-[10px] font-semibold" style={{ color: accentColor }}>
                        leave {assignment.leaveTime}
                    </div>
                )}
            </div>
            {canEdit && (
                <div className="flex flex-col gap-1">
                    <button
                        onClick={onEdit}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Edit"
                    >
                        <i className="fas fa-pen text-[10px]" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer"
                        style={{ color: '#dc2626' }}
                        title="Delete"
                    >
                        <i className="fas fa-trash text-[10px]" />
                    </button>
                </div>
            )}
        </div>
    )
}

function StatTile({ color, label, value }) {
    return (
        <div
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {label}
            </div>
            <div
                className="font-bold text-[18px]"
                style={{ color: color || 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
            >
                {value}
            </div>
        </div>
    )
}

function LabeledField({ children, label }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {label}
            </div>
            {children}
        </div>
    )
}

export default PlanFlowView
