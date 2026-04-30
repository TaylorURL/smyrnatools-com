import { EDGE_PARALLEL_OFFSET, NODE_RADIUS_MIN } from './PlanFlowLayoutUtility'
import { isExcludedOrder } from './PlanUtility'

const LABEL_HALF_HEIGHT_PX = 14
const LABEL_OBSTACLE_PADDING_PX = 10
const LABEL_PUSH_MIN_PX = 30
const LABEL_PUSH_MAX_PX = 260
const LABEL_PUSH_STEP_PX = 20

/**
 * Build a map of outbound edge key (`from->to`) → `{ assignment, order }`
 * for assignments that are loading directly for a specific destination job.
 * Only outbound edges qualify — return legs are ignored.
 */
export function computeEdgeJobs(edges, assignments, plantProduction) {
    const jobsByEdge = new Map()
    for (const edge of edges) {
        if (edge.isReturn) continue
        const edgeKey = `${edge.from}->${edge.to}`
        for (const assignmentIndex of edge.assignmentIndexes || []) {
            const assignment = assignments?.[assignmentIndex]
            if (!assignment?.forOrderId) continue
            const destinationOrders = plantProduction?.[edge.to]?.orders || []
            const matchingJob = destinationOrders.find(
                (order) => (order.orderId || order.orderNum) === assignment.forOrderId
            )
            if (matchingJob) {
                jobsByEdge.set(edgeKey, { assignment, order: matchingJob })
                break
            }
        }
    }
    return jobsByEdge
}

/**
 * Position each edge label so it doesn't get hidden by a third-party node
 * sitting on top of the line. Start at the edge midpoint, and if any
 * non-endpoint node would obscure it, push the label perpendicular to the
 * edge until clear. The original midpoint is also returned so a small
 * connector line can be drawn back to the edge.
 */
export function computeLabelLayout({ allPlantStats, bidirectionalEdgeKeys, edges, positions, radiusByCode }) {
    const labelLayoutByEdgeKey = {}
    const obstacles = allPlantStats
        .map((stat) => ({
            code: stat.code,
            pos: positions[stat.code],
            radius: radiusByCode[stat.code] || NODE_RADIUS_MIN
        }))
        .filter((obstacle) => obstacle.pos)

    for (const edge of edges) {
        const fromPos = positions[edge.from]
        const toPos = positions[edge.to]
        if (!fromPos || !toPos) continue

        const dx = toPos.x - fromPos.x
        const dy = toPos.y - fromPos.y
        const length = Math.sqrt(dx * dx + dy * dy) || 1
        const ux = dx / length
        const uy = dy / length

        const edgeKey = `${edge.from}->${edge.to}`
        const isBidirectional = bidirectionalEdgeKeys.has(edgeKey)
        const laneOffsetX = isBidirectional ? uy * EDGE_PARALLEL_OFFSET : 0
        const laneOffsetY = isBidirectional ? -ux * EDGE_PARALLEL_OFFSET : 0

        const midX = (fromPos.x + toPos.x) / 2 + laneOffsetX
        const midY = (fromPos.y + toPos.y) / 2 + laneOffsetY
        const perpX = -uy
        const perpY = ux

        const blockers = obstacles.filter((obstacle) => obstacle.code !== edge.from && obstacle.code !== edge.to)
        const isPositionOccluded = (x, y) => {
            for (const blocker of blockers) {
                const minClearance = blocker.radius + LABEL_HALF_HEIGHT_PX + LABEL_OBSTACLE_PADDING_PX
                const ddx = blocker.pos.x - x
                const ddy = blocker.pos.y - y
                if (ddx * ddx + ddy * ddy < minClearance * minClearance) return true
            }
            return false
        }

        let labelX = midX
        let labelY = midY
        if (isPositionOccluded(midX, midY)) {
            let foundClearPosition = false
            for (
                let pushDistance = LABEL_PUSH_MIN_PX;
                pushDistance <= LABEL_PUSH_MAX_PX && !foundClearPosition;
                pushDistance += LABEL_PUSH_STEP_PX
            ) {
                for (const sign of [1, -1]) {
                    const candidateX = midX + perpX * pushDistance * sign
                    const candidateY = midY + perpY * pushDistance * sign
                    if (!isPositionOccluded(candidateX, candidateY)) {
                        labelX = candidateX
                        labelY = candidateY
                        foundClearPosition = true
                        break
                    }
                }
            }
        }

        const offset = Math.hypot(labelX - midX, labelY - midY)
        labelLayoutByEdgeKey[edgeKey] = { anchorX: midX, anchorY: midY, offset, x: labelX, y: labelY }
    }
    return labelLayoutByEdgeKey
}

/**
 * Flatten plant production into one orders list with `plantCode` attached.
 * Cancelled (17:00) and dispatcher test (18:00) sentinel rows are filtered
 * here so the point-in-time "active orders" view never falsely counts them.
 */
export function flattenPlantOrders(stats, plantProduction) {
    const flatOrders = []
    ;(stats || []).forEach((stat) => {
        const production = plantProduction[stat.code] || {}
        const orders = Array.isArray(production.orders) ? production.orders : []
        orders.forEach((order) => {
            if (isExcludedOrder(order)) return
            flatOrders.push({ ...order, plantCode: stat.code })
        })
    })
    return flatOrders
}
