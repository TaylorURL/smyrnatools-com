import { useEffect, useMemo, useState } from 'react'

import { Database } from '../../services/DatabaseService'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Canonical name key for matching smyrnatools operator names against
 *  Dayforce employee display names. Strips punctuation, parenthesized
 *  nicknames, and trailing badge numbers, then sorts tokens alphabetically
 *  so "Gomez, Jose" and "Jose Gomez" both reduce to "gomez jose". Same
 *  canonicalization scheme used by useDayforceOperatorMetrics so the
 *  Operations → Hours and Plant Efficiency surfaces agree on who's who. */
const canonicalNameKey = (name) => {
    if (!name) return null
    const stripped = String(name)
        .toLowerCase()
        .replace(/\s+\d+\s*$/, '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const tokens = stripped.split(' ').filter(Boolean)
    if (tokens.length === 0) return null
    return tokens.sort().join(' ')
}

/** Extract HH:MM from a `timestamp` (no-TZ) column value. Dayforce punch
 *  columns are inserted as local Chicago time by the userscript, so a
 *  regex on the string is enough — no Date parsing or tz conversion. */
const extractHHMM = (timestamp) => {
    if (!timestamp) return ''
    const match = String(timestamp).match(/T?(\d{2}):(\d{2})/)
    return match ? `${match[1]}:${match[2]}` : ''
}

/**
 * Pulls Dayforce clock-in / clock-out punches for the single `reportDate`
 * and maps them per operator so the Plant Efficiency Report can auto-fill
 * `start_time` and `punch_out` from live payroll data instead of asking
 * the operator to type them in.
 *
 * Scope is intentionally ONE DAY — the report represents one operational
 * day even though the cadence is weekly. Matching strategy: canonical-name
 * match between `operatorOptions[].label` and `dayforce_employees.display_name`
 * (with first+last fallback). When an operator has multiple punches on the
 * same day (e.g., post-lunch re-punch), collapses to earliest in + latest
 * out.
 *
 * @param {Object} args
 * @param {boolean} args.enabled - When false, skip fetching entirely. The
 *   form passes false until rows + operatorOptions + reportDate are all
 *   ready so the hook doesn't fire during form init.
 * @param {string} args.reportDate - The single day this report covers, as
 *   `YYYY-MM-DD`. Sourced from `form.report_date`.
 * @param {Array<{value: string, label: string}>} args.operatorOptions -
 *   Operator dropdown options; `value` = employee_id, `label` = display name.
 *
 * @returns {{
 *   punchesByOperatorId: Object<string, {startTime: string, punchOut: string}>,
 *   loading: boolean,
 *   ready: boolean
 * }}
 */
export function useEfficiencyDayforcePunches({ enabled, reportDate, operatorOptions }) {
    const [punchesByEmployeeId, setPunchesByEmployeeId] = useState(null)
    const [employeesById, setEmployeesById] = useState(null)
    const [loading, setLoading] = useState(false)

    const normalizedDate = useMemo(() => {
        if (!reportDate || !ISO_DATE.test(reportDate)) return null
        return reportDate
    }, [reportDate])

    useEffect(() => {
        if (!enabled || !normalizedDate) {
            setPunchesByEmployeeId(null)
            setEmployeesById(null)
            return undefined
        }
        let cancelled = false
        setLoading(true)
        Promise.all([
            Database.from('dayforce_shifts')
                .select('dayforce_employee_id, actual_in_punch_at, actual_out_punch_at')
                .eq('shift_date', normalizedDate),
            Database.from('dayforce_employees').select('dayforce_employee_id, display_name, first_name, last_name')
        ])
            .then(([shiftsRes, employeesRes]) => {
                if (cancelled) return
                const shifts = Array.isArray(shiftsRes.data) ? shiftsRes.data : []
                const collapsed = new Map()
                for (const shift of shifts) {
                    const id = shift.dayforce_employee_id
                    const existing = collapsed.get(id) || { in: null, out: null }
                    if (
                        shift.actual_in_punch_at &&
                        (!existing.in || String(shift.actual_in_punch_at) < String(existing.in))
                    ) {
                        existing.in = shift.actual_in_punch_at
                    }
                    if (
                        shift.actual_out_punch_at &&
                        (!existing.out || String(shift.actual_out_punch_at) > String(existing.out))
                    ) {
                        existing.out = shift.actual_out_punch_at
                    }
                    collapsed.set(id, existing)
                }
                setPunchesByEmployeeId(collapsed)
                const employees = Array.isArray(employeesRes.data) ? employeesRes.data : []
                setEmployeesById(new Map(employees.map((e) => [e.dayforce_employee_id, e])))
            })
            .catch((err) => {
                if (cancelled) return
                console.warn('[useEfficiencyDayforcePunches] fetch error', err?.message || err)
                setPunchesByEmployeeId(new Map())
                setEmployeesById(new Map())
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [enabled, normalizedDate])

    const punchesByOperatorId = useMemo(() => {
        if (!punchesByEmployeeId || !employeesById || !Array.isArray(operatorOptions)) return {}

        const nameKeyToOperatorId = new Map()
        for (const opt of operatorOptions) {
            const key = canonicalNameKey(opt.label)
            if (key && !nameKeyToOperatorId.has(key)) nameKeyToOperatorId.set(key, opt.value)
        }

        const out = {}
        for (const [employeeId, punches] of punchesByEmployeeId.entries()) {
            const employee = employeesById.get(employeeId)
            if (!employee) continue
            const nameKey =
                canonicalNameKey(employee.display_name) ||
                canonicalNameKey([employee.first_name, employee.last_name].filter(Boolean).join(' '))
            if (!nameKey) continue
            const operatorId = nameKeyToOperatorId.get(nameKey)
            if (!operatorId) continue
            out[operatorId] = {
                punchOut: extractHHMM(punches.out),
                startTime: extractHHMM(punches.in)
            }
        }
        return out
    }, [punchesByEmployeeId, employeesById, operatorOptions])

    return {
        loading,
        punchesByOperatorId,
        ready: punchesByEmployeeId !== null && employeesById !== null
    }
}
