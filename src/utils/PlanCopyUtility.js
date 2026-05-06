import { buildAssignmentDriverTimes } from './PlanUtility'

/** Single blank line between any two stacked blocks. */
const BLOCK_BREAK = '\n\n'

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

/** Format the plan-date header label — "Mon, Apr 27". */
const formatDateLabel = (planDate) => {
    if (!planDate) return ''
    return new Date(`${planDate}T00:00:00`).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
    })
}

const truckNoun = (count) => (count === 1 ? 'truck' : 'trucks')

/** Resolve `forOrderId` to a "#461 NESTLE"-style tag. Returns null when the
 *  assignment isn't a direct-load or the order can't be found. */
const resolveDirectLoadJob = (assignment, plantProduction) => {
    if (!assignment.forOrderId) return null
    const destOrders = plantProduction?.[assignment.toPlant]?.orders || []
    const job = destOrders.find((o) => (o.orderId || o.orderNum) === assignment.forOrderId)
    if (!job) return null
    const tag = job.orderNum ? `#${job.orderNum}` : job.startTime || 'job'
    const customer = job.customer ? ` ${String(job.customer).trim()}` : ''
    return `${tag}${customer}`
}

/** Bucket valid assignments by plant into outgoing (`send`) and incoming
 *  (`receive`) lists so each plant manager sees both sides of their day. */
const groupAssignmentsByPlant = (validAssignments) => {
    const map = new Map()
    const ensure = (plant) => {
        if (!map.has(plant)) map.set(plant, { receive: [], send: [] })
        return map.get(plant)
    }
    validAssignments.forEach((a) => {
        ensure(a.fromPlant).send.push(a)
        ensure(a.toPlant).receive.push(a)
    })
    return map
}

/** Render the staggered per-truck rows for a route. Truck numbers are padded
 *  so columns line up cleanly when there are 10+ trucks on a single route. */
const buildTruckRows = (driverTimes, includeLeave) => {
    const labelWidth = String(driverTimes.length).length
    return driverTimes.map((dt, i) => {
        const num = String(i + 1).padStart(labelWidth)
        const arrive = formatHHMM(dt.arriveMin) || '—'
        if (!includeLeave) return `    Truck ${num}   arrives ${arrive}`
        const leave = formatHHMM(dt.leaveMin) || '—'
        return `    Truck ${num}   arrive ${arrive}   leave ${leave}`
    })
}

/** "Send N to X" block — direct-load callout (when applicable) plus a row
 *  per truck with arrive + leave times. */
const buildSendRoute = (assignment, plantProduction) => {
    const count = parseInt(assignment.driverCount, 10) || 0
    const job = resolveDirectLoadJob(assignment, plantProduction)
    const lines = [`  Send ${count} ${truckNoun(count)} to ${assignment.toPlant}`]
    if (job) lines.push(`  Loading direct for ${job}`)
    lines.push('')
    lines.push(...buildTruckRows(buildAssignmentDriverTimes(assignment), true))
    return lines.join('\n')
}

/** "Receiving N from X" block — arrive-only rows since the receiving plant
 *  manager mainly tracks when help shows up. */
const buildReceiveRoute = (assignment, plantProduction) => {
    const count = parseInt(assignment.driverCount, 10) || 0
    const job = resolveDirectLoadJob(assignment, plantProduction)
    const lines = [`  Receiving ${count} ${truckNoun(count)} from ${assignment.fromPlant}`]
    if (job) lines.push(`  Loading direct for ${job}`)
    lines.push('')
    lines.push(...buildTruckRows(buildAssignmentDriverTimes(assignment), false))
    return lines.join('\n')
}

/** One plant block: name header, blank line, then send routes followed by
 *  receive routes separated by single blank lines. */
const buildPlantSection = (plantName, activity, plantProduction) => {
    const routes = [
        ...activity.send.map((a) => buildSendRoute(a, plantProduction)),
        ...activity.receive.map((a) => buildReceiveRoute(a, plantProduction))
    ]
    return `${plantName}${BLOCK_BREAK}${routes.join(BLOCK_BREAK)}`
}

/** Plain-English summary lines: total trucks, top sender (when there's a
 *  clear winner), and one callout per direct-load destination. */
const buildSummary = (validAssignments, plantProduction) => {
    const totalTrucks = validAssignments.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
    const sentByPlant = new Map()
    validAssignments.forEach((a) => {
        const c = parseInt(a.driverCount, 10) || 0
        sentByPlant.set(a.fromPlant, (sentByPlant.get(a.fromPlant) || 0) + c)
    })
    const sortedSenders = [...sentByPlant.entries()].sort((a, b) => b[1] - a[1])
    const lines = [`${totalTrucks} ${truckNoun(totalTrucks)} moving today.`]
    if (sortedSenders.length > 1 && sortedSenders[0][1] > sortedSenders[1][1]) {
        lines.push(`${sortedSenders[0][0]} is sending the most.`)
    }
    const directCallouts = new Set()
    validAssignments.forEach((a) => {
        const job = resolveDirectLoadJob(a, plantProduction)
        if (job) directCallouts.add(`${a.toPlant} is loading direct for ${job}.`)
    })
    directCallouts.forEach((line) => lines.push(line))
    return lines.join('\n')
}

/**
 * Build the plan-day briefing for paste into chat / SMS / email. Output is
 * a date header, a plain-English summary, then one block per plant with
 * outgoing routes followed by incoming routes — each with per-truck
 * staggered times so plant managers can read off exact arrive/leave clocks.
 *
 * @param {Object} args
 * @param {string} args.planDate - ISO date the plan is for.
 * @param {Array} args.assignments - Help-route assignments.
 * @param {Object} args.plantProduction - Plant code → production block lookup
 *   (used to resolve `forOrderId` to a customer/order tag).
 * @returns {string} Multi-section briefing.
 */
export const buildPlanDispatchText = ({ assignments = [], planDate, plantProduction = {} }) => {
    const header = `Plan · ${formatDateLabel(planDate) || planDate}`

    const validAssignments = assignments.filter(
        (a) => a.fromPlant && a.toPlant && (parseInt(a.driverCount, 10) || 0) > 0
    )
    if (validAssignments.length === 0) {
        return `${header}${BLOCK_BREAK}No help routes today.\nAll plants run their own trucks.`
    }

    const summary = buildSummary(validAssignments, plantProduction)
    const plantSections = [...groupAssignmentsByPlant(validAssignments).entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([plant, activity]) => buildPlantSection(plant, activity, plantProduction))

    return [header, summary, ...plantSections].join(BLOCK_BREAK)
}
