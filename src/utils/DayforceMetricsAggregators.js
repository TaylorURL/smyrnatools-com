import { computeWeeklyCost, weekKey } from './DayforcePayrollUtility'

/** Builds the `dayforce_employee_id → operator` lookup map once, plus the
 *  unmatched/other-position exclusion sets used by the position gate.
 *
 *  Returns:
 *    - `operatorByEmployeeId` — `Map<dayforce_employee_id, operator>`
 *    - `excludedUnmatched` — `Set<dayforce_employee_id>` mutated by `passesPositionGate`
 *    - `excludedOtherPosition` — `Set<dayforce_employee_id>` mutated by `passesPositionGate`
 *    - `passesPositionGate(employeeId)` — `(employeeId) => boolean` gate
 *      used to filter shifts. Records exclusions into the two sets above
 *      so the caller can surface them in the diagnostics block.
 */
export const buildOperatorMatchIndex = ({ employees, matchOperator, operatorIndex, positionAllowlist }) => {
    const operatorByEmployeeId = new Map()
    for (const employee of employees) {
        const operator = matchOperator(employee, operatorIndex)
        if (operator) operatorByEmployeeId.set(employee.dayforce_employee_id, operator)
    }

    const excludedUnmatched = new Set()
    const excludedOtherPosition = new Set()
    const passesPositionGate = (employeeId) => {
        if (!positionAllowlist) return true
        const operator = operatorByEmployeeId.get(employeeId)
        if (!operator) {
            excludedUnmatched.add(employeeId)
            return false
        }
        if (!positionAllowlist.has(operator.position)) {
            excludedOtherPosition.add(employeeId)
            return false
        }
        return true
    }

    return { excludedOtherPosition, excludedUnmatched, operatorByEmployeeId, passesPositionGate }
}

/** Per-(employee, week) bucket so OT is calculated against the weekly
 *  threshold rather than per-shift (federal OT is weekly). Each bucket
 *  also tracks per-day hours so daily OT (>8h) can be carved out before
 *  the weekly OT (>40h) calc — see `computeWeeklyCost`. */
export const buildEmployeeWeekBuckets = ({ filteredShifts }) => {
    const employeeWeekBuckets = new Map()
    for (const shift of filteredShifts) {
        const week = weekKey(shift.shift_date)
        if (!week) continue
        const key = `${shift.dayforce_employee_id}|${week}`
        const bucket = employeeWeekBuckets.get(key) || {
            actualHours: 0,
            dailyHours: new Map(),
            dayforceEmployeeId: shift.dayforce_employee_id,
            hourlyRate: null,
            ptoHours: 0,
            scheduledHours: 0,
            week
        }
        const shiftHours = Number(shift.actual_hours) || 0
        bucket.actualHours += shiftHours
        if (shift.shift_date && shiftHours > 0) {
            bucket.dailyHours.set(shift.shift_date, (bucket.dailyHours.get(shift.shift_date) || 0) + shiftHours)
        }
        bucket.scheduledHours += Number(shift.scheduled_hours) || 0
        if (shift.is_pto) bucket.ptoHours += Number(shift.pto_hours) || 0
        const snapRate = Number(shift.hourly_rate_snapshot) || null
        if (snapRate && !bucket.hourlyRate) bucket.hourlyRate = snapRate
        employeeWeekBuckets.set(key, bucket)
    }
    return employeeWeekBuckets
}

/** Resolves a friendly display name for a Dayforce employee — prefers the
 *  matched operator's name, then dayforce display_name, then first+last,
 *  then badge, finally a generic "Employee {id}" so the row is never blank. */
const resolveDisplayName = (employee, operator, dayforceEmployeeId) =>
    operator?.name ||
    employee?.display_name ||
    [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') ||
    employee?.employee_badge ||
    `Employee ${dayforceEmployeeId}`

/** Aggregates the per-(employee, week) buckets into:
 *    - `perOperator` — one row per dayforce employee (sorted by totalCost desc)
 *    - `totals` — sum of hours + cost across every bucket
 *  Both are produced in a single pass so the totals never drift from the rows. */
export const buildPerOperatorRollup = ({ employeesById, employeeWeekBuckets, operatorByEmployeeId }) => {
    let totalActualHours = 0
    let totalScheduledHours = 0
    let totalPtoHours = 0
    let totalRegHours = 0
    let totalOtHours = 0
    let totalRegCost = 0
    let totalOtCost = 0
    const perOperatorMap = new Map()

    for (const bucket of employeeWeekBuckets.values()) {
        const employee = employeesById.get(bucket.dayforceEmployeeId)
        const operator = operatorByEmployeeId.get(bucket.dayforceEmployeeId)
        const rate = bucket.hourlyRate || Number(employee?.hourly_rate) || 0
        const { otCost, otHours, regCost, regHours } = computeWeeklyCost(bucket.actualHours, rate, bucket.dailyHours)

        totalActualHours += bucket.actualHours
        totalScheduledHours += bucket.scheduledHours
        totalPtoHours += bucket.ptoHours
        totalRegHours += regHours
        totalOtHours += otHours
        totalRegCost += regCost
        totalOtCost += otCost

        const operatorRow = perOperatorMap.get(bucket.dayforceEmployeeId) || {
            actualHours: 0,
            badge: employee?.employee_badge || operator?.smyrnaId || null,
            dayforceEmployeeId: bucket.dayforceEmployeeId,
            hourlyRate: rate,
            isMatched: !!operator,
            name: resolveDisplayName(employee, operator, bucket.dayforceEmployeeId),
            operatorId: operator?.employeeId || null,
            otCost: 0,
            otHours: 0,
            plantCode: operator?.plantCode || null,
            position: operator?.position || null,
            ptoHours: 0,
            regCost: 0,
            regHours: 0,
            scheduledHours: 0,
            status: operator?.status || null
        }
        operatorRow.actualHours += bucket.actualHours
        operatorRow.scheduledHours += bucket.scheduledHours
        operatorRow.ptoHours += bucket.ptoHours
        operatorRow.regHours += regHours
        operatorRow.otHours += otHours
        operatorRow.regCost += regCost
        operatorRow.otCost += otCost
        perOperatorMap.set(bucket.dayforceEmployeeId, operatorRow)
    }

    const perOperator = Array.from(perOperatorMap.values())
        .map((row) => ({ ...row, totalCost: row.regCost + row.otCost }))
        .sort((a, b) => b.totalCost - a.totalCost)

    return {
        operatorCount: perOperatorMap.size,
        perOperator,
        totalActualHours,
        totalOtCost,
        totalOtHours,
        totalPtoHours,
        totalRegCost,
        totalRegHours,
        totalScheduledHours
    }
}

/** Per-plant rollup — uses the operator's plant assignment when matched,
 *  falling back to the Dayforce org's display code. A driver lent to
 *  another plant for a day counts toward where they're rostered
 *  (operator.plantCode) rather than where the punch was rung. */
export const buildPerPlantRollup = ({ employeesById, filteredShifts, resolveShiftPlant }) => {
    const perPlantMap = new Map()
    for (const shift of filteredShifts) {
        const { code, name } = resolveShiftPlant(shift)
        const employee = employeesById.get(shift.dayforce_employee_id)
        const rate = Number(shift.hourly_rate_snapshot) || Number(employee?.hourly_rate) || 0
        const hours = Number(shift.actual_hours) || 0
        const row = perPlantMap.get(code) || {
            actualHours: 0,
            code,
            cost: 0,
            name,
            operatorIds: new Set(),
            scheduledHours: 0
        }
        row.actualHours += hours
        row.scheduledHours += Number(shift.scheduled_hours) || 0
        row.cost += hours * rate
        row.operatorIds.add(shift.dayforce_employee_id)
        perPlantMap.set(code, row)
    }

    return Array.from(perPlantMap.values())
        .map((row) => ({
            actualHours: row.actualHours,
            code: row.code,
            cost: row.cost,
            name: row.name,
            operatorCount: row.operatorIds.size,
            scheduledHours: row.scheduledHours
        }))
        .sort((a, b) => b.cost - a.cost)
}

/** Per-week rollup — one row per ISO week with cost + hour totals and a
 *  count of operators who hit overtime that week. Sorted ascending so the
 *  chart x-axis reads naturally left-to-right. */
export const buildPerWeekRollup = ({ employeesById, employeeWeekBuckets }) => {
    const perWeekMap = new Map()
    for (const bucket of employeeWeekBuckets.values()) {
        const employee = employeesById.get(bucket.dayforceEmployeeId)
        const rate = bucket.hourlyRate || Number(employee?.hourly_rate) || 0
        const { cost, otHours, regHours } = computeWeeklyCost(bucket.actualHours, rate)
        const row = perWeekMap.get(bucket.week) || {
            actualHours: 0,
            cost: 0,
            operatorIds: new Set(),
            operatorsOverOt: new Set(),
            otHours: 0,
            regHours: 0,
            scheduledHours: 0,
            week: bucket.week
        }
        row.actualHours += bucket.actualHours
        row.scheduledHours += bucket.scheduledHours
        row.cost += cost
        row.otHours += otHours
        row.regHours += regHours
        row.operatorIds.add(bucket.dayforceEmployeeId)
        if (otHours > 0) row.operatorsOverOt.add(bucket.dayforceEmployeeId)
        perWeekMap.set(bucket.week, row)
    }

    return Array.from(perWeekMap.values())
        .map((row) => ({
            ...row,
            operatorCount: row.operatorIds.size,
            operatorIds: undefined,
            operatorsOverOt: undefined,
            operatorsOverOtCount: row.operatorsOverOt.size
        }))
        .sort((a, b) => a.week.localeCompare(b.week))
}

/** Flat per-shift list — one row per (operator × day). Feeds the Schedules
 *  sub-page where each row shows the four timestamps (scheduled in/out +
 *  actual in/out) the dispatcher needs to audit a single day. Sorted by
 *  shift_date desc then operator name so the most recent activity sits
 *  on top. */
export const buildPerShiftRows = ({ employeesById, filteredShifts, operatorByEmployeeId, resolveShiftPlant }) =>
    filteredShifts
        .map((shift) => {
            const employee = employeesById.get(shift.dayforce_employee_id)
            const operator = operatorByEmployeeId.get(shift.dayforce_employee_id)
            const { code, name } = resolveShiftPlant(shift)
            return {
                actualHours: Number(shift.actual_hours) || 0,
                actualInAt: shift.actual_in_at,
                actualInPunchAt: shift.actual_in_punch_at,
                actualOutAt: shift.actual_out_at,
                actualOutPunchAt: shift.actual_out_punch_at,
                badge: employee?.employee_badge || operator?.smyrnaId || null,
                dayforceEmployeeId: shift.dayforce_employee_id,
                dayforceShiftId: shift.dayforce_shift_id,
                exceptionText: shift.exception_text || null,
                isMatched: !!operator,
                isPto: !!shift.is_pto,
                name: resolveDisplayName(employee, operator, shift.dayforce_employee_id),
                plantCode: code,
                plantName: name,
                position: operator?.position || null,
                ptoHours: Number(shift.pto_hours) || 0,
                scheduledHours: Number(shift.scheduled_hours) || 0,
                scheduledInAt: shift.scheduled_in_at,
                scheduledOutAt: shift.scheduled_out_at,
                shiftDate: shift.shift_date
            }
        })
        .sort((a, b) => {
            const dateCmp = String(b.shiftDate).localeCompare(String(a.shiftDate))
            if (dateCmp !== 0) return dateCmp
            return String(a.name).localeCompare(String(b.name))
        })

/** Builds a `resolveShiftPlant(shift)` closure that always returns either a
 *  real smyrnatools plant_code (with the friendly plantName for display)
 *  or the "Unassigned" bucket — never the raw Dayforce display_code, which
 *  would surface as "RMX_TX_*" in the UI. Resolution order:
 *    1. Matched operator's plantCode (source of truth in smyrnatools)
 *    2. Dayforce org_unit's mapped plant_code column (if a future seed or
 *       auto-mapping fills it in)
 *    3. "Unassigned" — the operator hasn't been assigned a plant in
 *       smyrnatools yet */
export const buildShiftPlantResolver =
    ({ operatorByEmployeeId, orgsById, plantByCode }) =>
    (shift) => {
        const operator = operatorByEmployeeId.get(shift.dayforce_employee_id)
        let plantCode = null
        if (operator?.plantCode) plantCode = String(operator.plantCode)
        else {
            const org = orgsById.get(shift.dayforce_org_id)
            if (org?.plant_code) plantCode = String(org.plant_code)
        }
        if (!plantCode) return { code: 'Unassigned', isMapped: false, name: 'Unassigned' }
        const plant = plantByCode.get(plantCode)
        return { code: plantCode, isMapped: true, name: plant?.plantName || plantCode }
    }
