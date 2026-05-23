import { useEffect, useMemo, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { OperatorService } from '../../services/OperatorService'
import { PlantService } from '../../services/PlantService'

/** Federal OT threshold — anything beyond this in a single workweek is
 *  paid at the OT multiplier. Lives here (not in a per-region settings
 *  table) because the bridge currently only covers Texas RMX sites and
 *  federal rules apply uniformly there. */
const OT_WEEKLY_THRESHOLD_HOURS = 40
const OT_MULTIPLIER = 1.5

const toDateString = (date) => {
    if (!date) return null
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** ISO week key (YYYY-Www) for grouping shifts into pay weeks. Using a
 *  string key keeps the aggregation grouping trivially serializable and
 *  sortable. */
const weekKey = (dateString) => {
    if (!dateString) return null
    const d = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = target.getUTCDay() || 7
    target.setUTCDate(target.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
    return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Splits a week's total hours into regular + overtime buckets and
 *  returns the corresponding labor cost at the given hourly rate. */
const computeWeeklyCost = (hours, hourlyRate) => {
    if (!hourlyRate || !hours) return { cost: 0, otCost: 0, otHours: 0, regCost: 0, regHours: 0 }
    const regHours = Math.min(hours, OT_WEEKLY_THRESHOLD_HOURS)
    const otHours = Math.max(0, hours - OT_WEEKLY_THRESHOLD_HOURS)
    const regCost = regHours * hourlyRate
    const otCost = otHours * hourlyRate * OT_MULTIPLIER
    return { cost: regCost + otCost, otCost, otHours, regCost, regHours }
}

/**
 * Canonical name key for fuzzy-matching across two systems. Strips
 * punctuation, parenthesized nicknames, trailing badge numbers, and
 * sorts the remaining tokens alphabetically so "Gomez, Jose (Jose) 007943"
 * and "Jose Gomez" both normalize to "gomez jose".
 *
 * Sorting tokens lets us ignore whether the source put first-name or
 * last-name first without needing to know which side is which.
 */
const canonicalNameKey = (name) => {
    if (!name) return null
    let s = String(name).toLowerCase()
    s = s.replace(/\s+\d+\s*$/, '') // trailing badge number
    s = s.replace(/\s*\([^)]*\)\s*/g, ' ') // (Nickname)
    s = s
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const tokens = s.split(' ').filter(Boolean)
    if (tokens.length === 0) return null
    return tokens.sort().join(' ')
}

/** Builds a name → operator lookup. Skips operators without a usable name
 *  so that "Unknown" or empty rows don't collide with real matches. */
const buildOperatorIndex = (operators) => {
    const byName = new Map()
    const byBadge = new Map()
    for (const op of operators) {
        if (!op) continue
        const key = canonicalNameKey(op.name)
        if (key && !byName.has(key)) byName.set(key, op)
        const badge = String(op.smyrnaId ?? '').trim()
        if (badge && !byBadge.has(badge)) byBadge.set(badge, op)
    }
    return { byBadge, byName }
}

/** Matches a Dayforce employee to a smyrnatools operator. Name first,
 *  badge as fallback. Returns null when neither path resolves so the
 *  caller can decide whether to show or hide the row. */
const matchOperator = (employee, operatorIndex) => {
    if (!employee) return null
    const nameKey =
        canonicalNameKey(employee.display_name) ||
        canonicalNameKey([employee.first_name, employee.last_name].filter(Boolean).join(' '))
    if (nameKey) {
        const hit = operatorIndex.byName.get(nameKey)
        if (hit) return hit
    }
    const badge = String(employee.employee_badge ?? '').trim()
    if (badge && operatorIndex.byBadge.has(badge)) return operatorIndex.byBadge.get(badge)
    return null
}

/**
 * Loads Dayforce shift data, joins each employee to the corresponding
 * smyrnatools operator (name match first, badge fallback), and aggregates
 * into the rollups the Hours and Labor Cost pages render. Filters by the
 * same date range and plant selector the rest of the surface uses; when
 * a Dayforce employee has no matching operator the row is still surfaced
 * but flagged as unmatched so payroll data is never silently hidden.
 *
 * Returns `{ isLoading, hasSyncedData, totals, perOperator, perPlant,
 * perWeek }` — every field falls back to a safe empty default when the
 * Dayforce bridge hasn't populated the tables yet.
 */
/** Positions whose data the Dayforce surfaces care about. Plant managers,
 *  office staff, and other roles are excluded by default because the
 *  Hours / Labor Cost pages are operator-scoped — payroll for non-driving
 *  roles is tracked elsewhere. Override by passing `restrictToPositions`
 *  to surface a different cut. */
export const DEFAULT_OPERATOR_POSITIONS = ['Mixer Operator', 'Tractor Operator']

export default function useDayforceOperatorMetrics({
    dateRange,
    operators: operatorsProp,
    plantCodes,
    restrictToPositions = DEFAULT_OPERATOR_POSITIONS,
    selectedPlant
}) {
    const [shifts, setShifts] = useState([])
    const [employees, setEmployees] = useState([])
    const [orgUnits, setOrgUnits] = useState([])
    const [plants, setPlants] = useState([])
    const [fetchedOperators, setFetchedOperators] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)

    // Self-load operators when none are passed in (Plan / Operations
    // surface). The roster is small and cached server-side; PersonStatistics
    // still passes its already-loaded `items` to skip the duplicate fetch.
    const shouldFetchOperators = !Array.isArray(operatorsProp)
    useEffect(() => {
        if (!shouldFetchOperators) return
        let cancelled = false
        ;(async () => {
            try {
                const rows = await OperatorService.fetchOperators()
                if (!cancelled) setFetchedOperators(Array.isArray(rows) ? rows : [])
            } catch {
                if (!cancelled) setFetchedOperators([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [shouldFetchOperators])
    const operators = shouldFetchOperators ? fetchedOperators : operatorsProp

    // Plants are loaded once for the friendly display name on the per-plant
    // rollup. Without this we'd be showing the raw plant_code ("401")
    // alongside "RMX_TX_*" fallbacks; with it, every shift attributes to
    // a smyrnatools plant + name even when the Dayforce-side mapping
    // hasn't been populated yet.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const rows = await PlantService.fetchPlants()
                if (!cancelled) setPlants(Array.isArray(rows) ? rows : [])
            } catch {
                if (!cancelled) setPlants([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const startDateString = toDateString(dateRange?.start)
    const endDateString = toDateString(dateRange?.end)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setIsLoading(true)
            setLoadError(null)
            try {
                let shiftsQuery = Database.from('dayforce_shifts').select(
                    'dayforce_shift_id, dayforce_employee_id, employee_badge, dayforce_org_id, ' +
                        'shift_date, scheduled_in_at, scheduled_out_at, scheduled_hours, ' +
                        'actual_in_at, actual_out_at, actual_hours, actual_in_punch_at, actual_out_punch_at, ' +
                        'exception_code, exception_text, pay_code, is_pto, pto_hours, hourly_rate_snapshot'
                )
                if (startDateString) shiftsQuery = shiftsQuery.gte('shift_date', startDateString)
                if (endDateString) shiftsQuery = shiftsQuery.lte('shift_date', endDateString)

                const [shiftsRes, employeesRes, orgUnitsRes] = await Promise.all([
                    shiftsQuery,
                    Database.from('dayforce_employees').select(
                        'dayforce_employee_id, employee_badge, display_name, first_name, last_name, ' +
                            'nickname, hourly_rate, annual_salary, hours_per_week, home_dayforce_org_id, is_active'
                    ),
                    Database.from('dayforce_org_units').select(
                        'dayforce_org_id, display_code, display_name, plant_code, org_type'
                    )
                ])

                if (cancelled) return

                // PostgREST errors come back on the response object (not as a
                // thrown exception). Surface the first one we see so the
                // page can render a real diagnostic instead of an empty
                // grid that looks like "no data yet."
                const firstError = shiftsRes.error || employeesRes.error || orgUnitsRes.error
                if (firstError) {
                    const tag = shiftsRes.error
                        ? 'dayforce_shifts'
                        : employeesRes.error
                          ? 'dayforce_employees'
                          : 'dayforce_org_units'
                    const msg = `${tag}: ${firstError.message || firstError.code || 'unknown error'}`
                    console.error('[useDayforceOperatorMetrics] query error', {
                        employeesRes,
                        msg,
                        orgUnitsRes,
                        shiftsRes
                    })
                    setLoadError(msg)
                }

                setShifts(Array.isArray(shiftsRes.data) ? shiftsRes.data : [])
                setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : [])
                setOrgUnits(Array.isArray(orgUnitsRes.data) ? orgUnitsRes.data : [])
            } catch (err) {
                if (cancelled) return
                const msg = err instanceof Error ? err.message : String(err)
                console.error('[useDayforceOperatorMetrics] fetch threw', err)
                setLoadError(msg)
                setShifts([])
                setEmployees([])
                setOrgUnits([])
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [endDateString, startDateString])

    return useMemo(() => {
        const employeesById = new Map(employees.map((e) => [e.dayforce_employee_id, e]))
        const orgsById = new Map(orgUnits.map((o) => [o.dayforce_org_id, o]))
        const plantByCode = new Map(plants.map((p) => [String(p.plantCode), p]))
        const operatorIndex = buildOperatorIndex(Array.isArray(operators) ? operators : [])

        // Match every dayforce employee to a smyrnatools operator once,
        // up-front. Subsequent loops just read this map.
        const operatorByEmployeeId = new Map()
        for (const emp of employees) {
            const op = matchOperator(emp, operatorIndex)
            if (op) operatorByEmployeeId.set(emp.dayforce_employee_id, op)
        }

        const restrictPlantCodes =
            Array.isArray(plantCodes) && plantCodes.length > 0 ? new Set(plantCodes.map(String)) : null
        const positionAllowlist =
            Array.isArray(restrictToPositions) && restrictToPositions.length > 0 ? new Set(restrictToPositions) : null

        // Resolves the smyrnatools-side plant code for a shift. Always
        // returns either a real smyrnatools plant_code (with the friendly
        // plantName for display) or the "Unassigned" bucket — never the
        // raw Dayforce display_code, which would surface as "RMX_TX_*" in
        // the UI. Order:
        //   1. Matched operator's plantCode (source of truth in smyrnatools)
        //   2. Dayforce org_unit's mapped plant_code column (if a future
        //      seed or auto-mapping fills it in)
        //   3. "Unassigned" — the operator hasn't been assigned a plant
        //      in smyrnatools yet
        const resolveShiftPlant = (shift) => {
            const op = operatorByEmployeeId.get(shift.dayforce_employee_id)
            let plantCode = null
            if (op?.plantCode) plantCode = String(op.plantCode)
            else {
                const org = orgsById.get(shift.dayforce_org_id)
                if (org?.plant_code) plantCode = String(org.plant_code)
            }
            if (!plantCode) return { code: 'Unassigned', isMapped: false, name: 'Unassigned' }
            const plant = plantByCode.get(plantCode)
            return { code: plantCode, isMapped: true, name: plant?.plantName || plantCode }
        }

        // Position gate. Dayforce employees who have no smyrnatools match
        // (plant managers, office staff, mismatched names) are excluded
        // — Hours / Labor Cost are operator-only views. Same logic for
        // matched employees whose position isn't in the allowlist.
        const excludedEmployeesUnmatched = new Set()
        const excludedEmployeesOtherPosition = new Set()
        const passesPositionGate = (employeeId) => {
            if (!positionAllowlist) return true
            const op = operatorByEmployeeId.get(employeeId)
            if (!op) {
                excludedEmployeesUnmatched.add(employeeId)
                return false
            }
            if (!positionAllowlist.has(op.position)) {
                excludedEmployeesOtherPosition.add(employeeId)
                return false
            }
            return true
        }

        const filteredShifts = shifts.filter((s) => {
            if (!passesPositionGate(s.dayforce_employee_id)) return false
            const { code, isMapped } = resolveShiftPlant(s)
            // Plant selector matches exact code (operator-side or org-side).
            if (selectedPlant && String(code) !== String(selectedPlant)) return false
            // Region restriction only enforced when the shift resolved to
            // a known smyrnatools plant. Unmapped Dayforce orgs (e.g.
            // RMX_TX_14002 with no plant_code seed) pass through so the
            // page isn't empty before the org-to-plant mapping is filled.
            if (restrictPlantCodes && isMapped && !restrictPlantCodes.has(String(code))) return false
            return true
        })

        // Per-(employee, week) bucket so OT is calculated against the
        // weekly threshold rather than per-shift (federal OT is weekly).
        const employeeWeekBuckets = new Map()
        for (const shift of filteredShifts) {
            const wk = weekKey(shift.shift_date)
            if (!wk) continue
            const key = `${shift.dayforce_employee_id}|${wk}`
            const bucket = employeeWeekBuckets.get(key) || {
                actualHours: 0,
                dayforceEmployeeId: shift.dayforce_employee_id,
                hourlyRate: null,
                ptoHours: 0,
                scheduledHours: 0,
                week: wk
            }
            bucket.actualHours += Number(shift.actual_hours) || 0
            bucket.scheduledHours += Number(shift.scheduled_hours) || 0
            if (shift.is_pto) bucket.ptoHours += Number(shift.pto_hours) || 0
            const snapRate = Number(shift.hourly_rate_snapshot) || null
            if (snapRate && !bucket.hourlyRate) bucket.hourlyRate = snapRate
            employeeWeekBuckets.set(key, bucket)
        }

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
            const { otCost, otHours, regCost, regHours } = computeWeeklyCost(bucket.actualHours, rate)

            totalActualHours += bucket.actualHours
            totalScheduledHours += bucket.scheduledHours
            totalPtoHours += bucket.ptoHours
            totalRegHours += regHours
            totalOtHours += otHours
            totalRegCost += regCost
            totalOtCost += otCost

            const displayName =
                operator?.name ||
                employee?.display_name ||
                [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') ||
                employee?.employee_badge ||
                `Employee ${bucket.dayforceEmployeeId}`

            const operatorRow = perOperatorMap.get(bucket.dayforceEmployeeId) || {
                actualHours: 0,
                badge: employee?.employee_badge || operator?.smyrnaId || null,
                dayforceEmployeeId: bucket.dayforceEmployeeId,
                hourlyRate: rate,
                isMatched: !!operator,
                name: displayName,
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

        // Per-plant rollup — uses the operator's plant assignment when
        // matched, falling back to the Dayforce org's display code. A
        // driver lent to another plant for a day counts toward where
        // they're rostered (operator.plantCode) rather than where the
        // punch was rung.
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

        const perPlant = Array.from(perPlantMap.values())
            .map((row) => ({
                actualHours: row.actualHours,
                code: row.code,
                cost: row.cost,
                name: row.name,
                operatorCount: row.operatorIds.size,
                scheduledHours: row.scheduledHours
            }))
            .sort((a, b) => b.cost - a.cost)

        const perWeekMap = new Map()
        for (const bucket of employeeWeekBuckets.values()) {
            const employee = employeesById.get(bucket.dayforceEmployeeId)
            const rate = bucket.hourlyRate || Number(employee?.hourly_rate) || 0
            const { cost } = computeWeeklyCost(bucket.actualHours, rate)
            const row = perWeekMap.get(bucket.week) || {
                actualHours: 0,
                cost: 0,
                operatorIds: new Set(),
                scheduledHours: 0,
                week: bucket.week
            }
            row.actualHours += bucket.actualHours
            row.scheduledHours += bucket.scheduledHours
            row.cost += cost
            row.operatorIds.add(bucket.dayforceEmployeeId)
            perWeekMap.set(bucket.week, row)
        }
        const perWeek = Array.from(perWeekMap.values())
            .map((row) => ({ ...row, operatorCount: row.operatorIds.size, operatorIds: undefined }))
            .sort((a, b) => a.week.localeCompare(b.week))

        const exceptionsCount = filteredShifts.filter((s) => s.exception_code).length
        const exceptionEmployees = new Set(
            filteredShifts.filter((s) => s.exception_code).map((s) => s.dayforce_employee_id)
        ).size

        // Flat per-shift list — one row per (operator × day). Feeds the
        // Schedules sub-page where each row shows the four timestamps
        // (scheduled in/out + actual in/out) the dispatcher needs to
        // audit a single day. Sorted by shift_date desc then operator
        // name so the most recent activity sits on top.
        const perShift = filteredShifts
            .map((shift) => {
                const employee = employeesById.get(shift.dayforce_employee_id)
                const operator = operatorByEmployeeId.get(shift.dayforce_employee_id)
                const { code, name } = resolveShiftPlant(shift)
                const displayName =
                    operator?.name ||
                    employee?.display_name ||
                    [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') ||
                    employee?.employee_badge ||
                    `Employee ${shift.dayforce_employee_id}`
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
                    name: displayName,
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
                // Most recent first; tie-break by operator name so the
                // table reads predictably within a single day.
                const dateCmp = String(b.shiftDate).localeCompare(String(a.shiftDate))
                if (dateCmp !== 0) return dateCmp
                return String(a.name).localeCompare(String(b.name))
            })

        return {
            // Diagnostic counts so the empty-state messaging can tell
            // "tables empty" apart from "rows loaded but filtered out."
            diagnostics: {
                employeesLoaded: employees.length,
                filteredShiftCount: filteredShifts.length,
                loadError,
                operatorsAvailable: Array.isArray(operators) ? operators.length : 0,
                orgUnitsLoaded: orgUnits.length,
                shiftsLoaded: shifts.length
            },
            // Visibility into the position gate — how many Dayforce
            // employees were excluded for being unmatched (probably
            // non-operators) vs. matched-but-wrong-position. Used by the
            // filter bar header so the reduced row count is transparent.
            excluded: {
                otherPosition: excludedEmployeesOtherPosition.size,
                unmatched: excludedEmployeesUnmatched.size
            },
            hasSyncedData: shifts.length > 0,
            isLoading,
            matchStats: {
                matched: perOperator.filter((r) => r.isMatched).length,
                total: perOperator.length,
                unmatched: perOperator.filter((r) => !r.isMatched).length
            },
            perOperator,
            perPlant,
            perShift,
            perWeek,
            totals: {
                avgHourlyRate: totalActualHours > 0 ? (totalRegCost + totalOtCost) / totalActualHours : 0,
                exceptionEmployees,
                exceptionsCount,
                operatorCount: perOperatorMap.size,
                otCost: totalOtCost,
                otHours: totalOtHours,
                ptoHours: totalPtoHours,
                regCost: totalRegCost,
                regHours: totalRegHours,
                scheduledHours: totalScheduledHours,
                totalActualHours,
                totalCost: totalRegCost + totalOtCost,
                varianceHours: totalActualHours - totalScheduledHours,
                variancePct:
                    totalScheduledHours > 0 ? ((totalActualHours - totalScheduledHours) / totalScheduledHours) * 100 : 0
            }
        }
    }, [
        employees,
        isLoading,
        loadError,
        operators,
        orgUnits,
        plantCodes,
        plants,
        restrictToPositions,
        selectedPlant,
        shifts
    ])
}
