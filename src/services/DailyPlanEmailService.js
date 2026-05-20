import APIUtility from '../utils/APIUtility'
import {
    buildAssignmentDriverTimes,
    getCalculatedTruckCount,
    isExcludedOrder,
    parseDurationMinutes,
    timeToMinutes
} from '../utils/PlanUtility'

/**
 * Client-side wrapper around the `daily-plan-email` edge function.
 *
 * The function expects each plant's payload pre-assembled — the cron we'll
 * wire up later will replay the same plan record server-side, but routing
 * through the client right now lets us iterate on the email shape without
 * re-deploying the function on every tweak. This module owns the
 * extraction logic so PlanReviewSendModal stays a thin presentation
 * component.
 */

const ENDPOINT_PREVIEW = '/daily-plan-email/preview'
const ENDPOINT_SEND = '/daily-plan-email/send'

/** Format minutes-of-day as `HH:MM`, returning '' for invalid input. */
function formatMinutesAsHHMM(mins) {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function composeAddress(order) {
    const parts = [order?.address, order?.city, order?.state]
        .map((p) => (p == null ? '' : String(p).trim()))
        .filter(Boolean)
    return parts.join(', ')
}

/**
 * Extract one plant's email payload from the in-memory plan. Pure — same
 * inputs produce the same payload regardless of UI state — so the same
 * function can drive the modal preview AND the eventual cron pre-render.
 *
 * @param {Object} args
 * @param {string} args.plantCode
 * @param {string} [args.plantName]
 * @param {Object} args.plantProduction - The raw `plans.plant_production` map.
 * @param {Array}  args.assignments - The raw `plans.assignments` array (cross-plant help).
 * @param {string} [args.notes]
 * @param {Object} [args.poolTimeline] - Per-order pool entries, keyed by order id.
 *                 When present, orders inherit a `needsHelp` flag from
 *                 `poolAfterDispatchEffective < 0`.
 * @param {Object} [args.clockInRowsByPlant] - Pre-grouped clock-in rows.
 */
export function buildPerPlantEmailPayload({
    plantCode,
    plantName,
    plantProduction,
    assignments = [],
    notes = '',
    poolTimeline = null,
    clockInRowsByPlant = {},
    plantNameByCode = {}
}) {
    const block = plantProduction?.[plantCode] || {}
    const rawOrders = Array.isArray(block.orders) ? block.orders : []
    const liveOrders = rawOrders.filter((o) => !isExcludedOrder(o))

    /* Orders — sorted by start, with needs-help inferred from the pool
     * timeline so the email matches the schedule tab's coverage view. */
    const orders = liveOrders
        .map((order) => {
            const truckCount = getCalculatedTruckCount(order) || parseFloat(order?.truckCount) || 0
            const poolEntry = order?.orderId ? poolTimeline?.[order.orderId] : null
            const after = poolEntry?.poolAfterDispatchEffective
            const needsHelp = Number.isFinite(after) && after < 0
            const spacingMin = parseDurationMinutes(order?.rate)
            return {
                address: composeAddress(order),
                customer: (order.customer || '').trim() || 'Unknown customer',
                needsHelp,
                orderNum: order.orderNum || '',
                productCode: order.productCode || order.description || '',
                spacingMin: Number.isFinite(spacingMin) ? spacingMin : null,
                startTime: order.startTime || '',
                truckCount,
                yardage: parseFloat(order.yardage) || 0
            }
        })
        .sort((a, b) => {
            const am = timeToMinutes(a.startTime) ?? Infinity
            const bm = timeToMinutes(b.startTime) ?? Infinity
            return am - bm
        })

    /* KPI summary — counts that match the dispatcher's Schedule tab strip
     * but trimmed to this plant. customerCount dedupes by trimmed name so
     * "ACME" and "Acme  " collapse into one. */
    const customerSet = new Set(orders.map((o) => o.customer.trim().toUpperCase()).filter(Boolean))
    const yardage = orders.reduce((sum, o) => sum + o.yardage, 0)
    const loadCount = orders.reduce((sum, o) => sum + o.truckCount, 0)
    const startMinutes = orders.map((o) => timeToMinutes(o.startTime)).filter((m) => Number.isFinite(m))
    const firstStart = startMinutes.length ? formatMinutesAsHHMM(Math.min(...startMinutes)) : ''
    const lastStart = startMinutes.length ? formatMinutesAsHHMM(Math.max(...startMinutes)) : ''
    const kpi = {
        customerCount: customerSet.size,
        firstStart,
        lastStart,
        loadCount,
        orderCount: orders.length,
        yardage
    }

    /* Cross-plant help — one row per driver per direction so the email
     * reads like a dispatch sheet: exact arrive / leave times, the
     * specific order they're loading direct for (if the assignment was
     * tied to one), and the plant they turn back to afterwards. The
     * schedule tab buckets stagger groups for density; the email keeps
     * each driver on their own line because the plant manager needs to
     * know which seat is yours and when. */
    const helpIn = []
    const helpOut = []
    const formatRange = (startMin, endMin) => {
        const s = Number.isFinite(startMin) ? formatMinutesAsHHMM(startMin) : ''
        const e = Number.isFinite(endMin) ? formatMinutesAsHHMM(endMin) : ''
        if (!s) return ''
        if (!e || e === s) return s
        return `${s} – ${e}`
    }
    const buildForOrderSummary = (assignment, destPlantCode) => {
        if (!assignment?.forOrderId) return null
        const destOrders = plantProduction?.[destPlantCode]?.orders || []
        const match = destOrders.find((o) => (o.orderId || o.orderNum) === assignment.forOrderId)
        if (!match) return null
        return {
            customer: (match.customer || '').trim() || 'Unknown customer',
            orderNum: match.orderNum || '',
            productCode: match.productCode || match.description || '',
            startTime: match.startTime || ''
        }
    }
    ;(assignments || []).forEach((a) => {
        if (!a?.fromPlant || !a?.toPlant || a.fromPlant === a.toPlant) return
        const driverCount = parseInt(a.driverCount, 10) || 0
        if (driverCount <= 0) return
        const driverTimes = buildAssignmentDriverTimes(a)
        const returnPlant = a.returnPlant || a.fromPlant
        const forOrder = buildForOrderSummary(a, a.toPlant)
        driverTimes.forEach((dt, idx) => {
            const driverLabel = driverCount === 1 ? 'Driver' : `Driver ${idx + 1} of ${driverCount}`
            const arriveTime = Number.isFinite(dt.arriveMin) ? formatMinutesAsHHMM(dt.arriveMin) : ''
            const leaveTime = Number.isFinite(dt.leaveMin) ? formatMinutesAsHHMM(dt.leaveMin) : ''
            const durationLabel =
                Number.isFinite(dt.arriveMin) && Number.isFinite(dt.leaveMin) && dt.leaveMin > dt.arriveMin
                    ? formatRange(dt.arriveMin, dt.leaveMin)
                    : ''
            const row = {
                arriveTime,
                counterPlantCode: '',
                counterPlantName: '',
                driverLabel,
                durationLabel,
                forOrder,
                leaveTime,
                returnPlantCode: returnPlant,
                returnPlantName: plantNameByCode?.[returnPlant] || ''
            }
            if (a.toPlant === plantCode) {
                /* INBOUND — this plant is the destination. Counter-plant is
                 * where the driver came from. They leave us at `leaveTime`
                 * and head to `returnPlant`. */
                helpIn.push({
                    ...row,
                    counterPlantCode: a.fromPlant,
                    counterPlantName: plantNameByCode?.[a.fromPlant] || ''
                })
            }
            if (a.fromPlant === plantCode) {
                /* OUTBOUND — this plant sends the driver. Counter-plant is
                 * where they go. `arriveTime` is arrival at the
                 * destination; `leaveTime` is when they leave it. */
                helpOut.push({
                    ...row,
                    counterPlantCode: a.toPlant,
                    counterPlantName: plantNameByCode?.[a.toPlant] || ''
                })
            }
        })
    })
    const byArrive = (a, b) => {
        const am = timeToMinutes(a.arriveTime) ?? Infinity
        const bm = timeToMinutes(b.arriveTime) ?? Infinity
        return am - bm
    }
    helpIn.sort(byArrive)
    helpOut.sort(byArrive)

    /* Clock-in roster — slot-numbered rows that match the cron's
     * server-side shape so both delivery paths render the same way.
     * `clockInRowsByPlant` is pre-grouped by the caller from
     * `usePlanScheduleData`'s local clock-in computation; outbound /
     * leave-off enrichment lives on the dashboard board and isn't
     * surfaced through this service yet, so the manual button is
     * intentionally narrower than the cron output. The cron path
     * fills in outbound destination tags and leave-off slots via
     * `buildPlantRosterInternal` in the edge function. */
    const localClockIns = (clockInRowsByPlant?.[plantCode] || [])
        .map((row) => (Number.isFinite(row?.time) ? row.time : null))
        .filter((t) => t != null)
        .sort((a, b) => a - b)
    const roster = localClockIns.map((time, idx) => ({
        clockIn: formatMinutesAsHHMM(time),
        destinationPlant: '',
        flag: '',
        index: idx + 1,
        isLeaveOff: false,
        isOutbound: false
    }))

    return {
        code: plantCode,
        helpIn,
        helpOut,
        kpi,
        name: plantName || '',
        notes,
        orders,
        roster
    }
}

/**
 * Build every plant payload that has at least one live order today —
 * idle plants stay out of the email round so managers don't get a "Plan
 * for today" message with an empty schedule.
 */
export function buildAllPlantEmailPayloads({
    plantProduction,
    plantNameByCode = {},
    assignments = [],
    notes = '',
    poolTimeline = null,
    clockInRowsByPlant = {}
}) {
    if (!plantProduction || typeof plantProduction !== 'object') return []
    const codes = Object.keys(plantProduction).filter((code) => code !== '_meta')
    return codes
        .map((plantCode) =>
            buildPerPlantEmailPayload({
                assignments,
                clockInRowsByPlant,
                notes,
                plantCode,
                plantName: plantNameByCode[plantCode] || '',
                plantNameByCode,
                plantProduction,
                poolTimeline
            })
        )
        .filter((payload) => payload.kpi.orderCount > 0 || payload.helpIn.length > 0 || payload.helpOut.length > 0)
        .sort((a, b) => String(a.code).localeCompare(String(b.code)))
}

/**
 * Group flat `clockInRows` (from usePlanScheduleData) into a `{ plantCode:
 * rows[] }` map sorted by clock-in time so each plant's roster reads
 * top-to-bottom from earliest in.
 */
export function groupClockInRowsByPlant(clockInRows) {
    const out = {}
    ;(clockInRows || []).forEach((row) => {
        const code = row?.plantCode
        if (!code) return
        if (!out[code]) out[code] = []
        out[code].push(row)
    })
    Object.values(out).forEach((rows) => rows.sort((a, b) => (a.time ?? 0) - (b.time ?? 0)))
    return out
}

class DailyPlanEmailServiceImpl {
    async preview({ planDate, plants }) {
        if (!planDate) throw new Error('planDate is required')
        if (!Array.isArray(plants)) throw new Error('plants must be an array')
        const { res, json } = await APIUtility.post(ENDPOINT_PREVIEW, { planDate, plants })
        if (!res.ok) throw new Error(json?.error || 'Failed to preview daily plan email')
        return json
    }

    async send({ planDate, plants }) {
        if (!planDate) throw new Error('planDate is required')
        if (!Array.isArray(plants)) throw new Error('plants must be an array')
        const { res, json } = await APIUtility.post(ENDPOINT_SEND, { planDate, plants })
        if (!res.ok) throw new Error(json?.error || 'Failed to send daily plan email')
        return json
    }
}

export const DailyPlanEmailService = new DailyPlanEmailServiceImpl()
export default DailyPlanEmailService
