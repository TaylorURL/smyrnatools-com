import { buildAssignmentDriverTimes } from './PlanUtility'

/** Format a minute-of-day count as `HH:MM`. Wraps around 24h so a value of
 *  1500 (25h) displays as `01:00`. Mirrors the formatter the planner uses
 *  in the on-screen timeline. */
const formatHHMM = (mins) => {
    if (!Number.isFinite(mins)) return null
    const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(wrapped / 60)
    const m = Math.round(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Format the plan-date header label for the dispatch text — "Mon, Apr 27". */
const formatDateLabel = (planDate) => {
    if (!planDate) return ''
    return new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
    })
}

/** Build the "for #461 BROOKS" tail when an assignment is loading directly
 *  for a specific destination order. Returns an empty string if the
 *  assignment isn't tied to an order or the order can't be found. */
const buildJobFragment = (assignment, plantProduction) => {
    if (!assignment.forOrderId) return ''
    const destOrders = plantProduction?.[assignment.toPlant]?.orders || []
    const job = destOrders.find((o) => (o.orderId || o.orderNum) === assignment.forOrderId)
    if (!job) return ''
    const tag = job.orderNum ? `#${job.orderNum}` : job.startTime || 'job'
    const customer = job.customer ? ` ${String(job.customer).trim()}` : ''
    return ` for ${tag}${customer}`
}

/** Build the trailing return-leg fragment. Default home is `fromPlant`;
 *  only call out the destination when the dispatcher chose a different
 *  return plant, otherwise just emit the leave time(s). */
const buildReturnFragment = (assignment, leaveFrag) => {
    const home = assignment.returnPlant || assignment.fromPlant
    if (home !== assignment.fromPlant) return `, then to ${home}${leaveFrag}`
    return leaveFrag ? `, leave${leaveFrag}` : ''
}

/** Render arrival times as either ` arrive 07:30` (single) or
 *  ` arrive 07:30, 07:45` (multiple, deduped). */
const buildArriveFragment = (driverTimes) => {
    const unique = Array.from(new Set(driverTimes.map((dt) => formatHHMM(dt.arriveMin)).filter(Boolean)))
    if (unique.length === 0) return ''
    if (unique.length === 1) return ` arrive ${unique[0]}`
    return ` arrive ${unique.join(', ')}`
}

/** Render leave times as `07:30` or `07:30/08:00` (joined with slashes). */
const buildLeaveFragment = (driverTimes) => {
    const unique = Array.from(new Set(driverTimes.map((dt) => formatHHMM(dt.leaveMin)).filter(Boolean)))
    return unique.length > 0 ? ` ${unique.join('/')}` : ''
}

/**
 * Build the plant-manager dispatch text for a plan day. One line per help
 * route — where to send trucks, how many, when each arrives, whether
 * they're loading for a specific job at the destination, and where they
 * return after.
 *
 * @param {Object} args
 * @param {string} args.planDate - ISO date the plan is for.
 * @param {Array} args.assignments - Help-route assignments.
 * @param {Object} args.plantProduction - Plant code → production block lookup
 *   (used to resolve `forOrderId` to a customer/order tag).
 * @returns {string} Multi-line text ready to drop into a chat / email.
 */
export const buildPlanDispatchText = ({ assignments = [], planDate, plantProduction = {} }) => {
    const lines = [`Plan ${formatDateLabel(planDate) || planDate}`]

    const validAssignments = assignments.filter(
        (a) => a.fromPlant && a.toPlant && (parseInt(a.driverCount, 10) || 0) > 0
    )
    if (validAssignments.length === 0) {
        lines.push('No help routes — keep trucks at home plant.')
        return lines.join('\n').trim()
    }

    validAssignments.forEach((a) => {
        const count = parseInt(a.driverCount, 10) || 0
        const noun = count === 1 ? 'truck' : 'trucks'
        const driverTimes = buildAssignmentDriverTimes(a)
        const arriveFrag = buildArriveFragment(driverTimes)
        const jobFrag = buildJobFragment(a, plantProduction)
        const leaveFrag = buildLeaveFragment(driverTimes)
        const returnFrag = buildReturnFragment(a, leaveFrag)
        lines.push(`${a.fromPlant} → ${a.toPlant}: ${count} ${noun}${arriveFrag}${jobFrag}${returnFrag}`)
    })

    return lines.join('\n').trim()
}
