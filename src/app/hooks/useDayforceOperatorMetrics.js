import { useEffect, useMemo, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { OperatorService } from '../../services/OperatorService'
import { PlantService } from '../../services/PlantService'
import {
    buildEmployeeWeekBuckets,
    buildOperatorMatchIndex,
    buildPerOperatorRollup,
    buildPerPlantRollup,
    buildPerShiftRows,
    buildPerWeekRollup,
    buildShiftPlantResolver
} from '../../utils/DayforceMetricsAggregators'
import { buildOperatorIndex, matchOperator, toDateString } from '../../utils/DayforcePayrollUtility'

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

        const positionAllowlist =
            Array.isArray(restrictToPositions) && restrictToPositions.length > 0 ? new Set(restrictToPositions) : null
        const restrictPlantCodes =
            Array.isArray(plantCodes) && plantCodes.length > 0 ? new Set(plantCodes.map(String)) : null

        const { excludedOtherPosition, excludedUnmatched, operatorByEmployeeId, passesPositionGate } =
            buildOperatorMatchIndex({ employees, matchOperator, operatorIndex, positionAllowlist })

        const resolveShiftPlant = buildShiftPlantResolver({ operatorByEmployeeId, orgsById, plantByCode })

        const filteredShifts = shifts.filter((shift) => {
            if (!passesPositionGate(shift.dayforce_employee_id)) return false
            const { code, isMapped } = resolveShiftPlant(shift)
            // Plant selector matches exact code (operator-side or org-side).
            if (selectedPlant && String(code) !== String(selectedPlant)) return false
            // Region restriction only enforced when the shift resolved to
            // a known smyrnatools plant. Unmapped Dayforce orgs (e.g.
            // RMX_TX_14002 with no plant_code seed) pass through so the
            // page isn't empty before the org-to-plant mapping is filled.
            if (restrictPlantCodes && isMapped && !restrictPlantCodes.has(String(code))) return false
            return true
        })

        const employeeWeekBuckets = buildEmployeeWeekBuckets({ filteredShifts })

        const {
            operatorCount,
            perOperator,
            totalActualHours,
            totalOtCost,
            totalOtHours,
            totalPtoHours,
            totalRegCost,
            totalRegHours,
            totalScheduledHours
        } = buildPerOperatorRollup({ employeeWeekBuckets, employeesById, operatorByEmployeeId })

        const perPlant = buildPerPlantRollup({ employeesById, filteredShifts, resolveShiftPlant })
        const perWeek = buildPerWeekRollup({ employeeWeekBuckets, employeesById })
        const perShift = buildPerShiftRows({
            employeesById,
            filteredShifts,
            operatorByEmployeeId,
            resolveShiftPlant
        })

        const exceptionsCount = filteredShifts.filter((s) => s.exception_code).length
        const exceptionEmployees = new Set(
            filteredShifts.filter((s) => s.exception_code).map((s) => s.dayforce_employee_id)
        ).size

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
                otherPosition: excludedOtherPosition.size,
                unmatched: excludedUnmatched.size
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
                operatorCount,
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
