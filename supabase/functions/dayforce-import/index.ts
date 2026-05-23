// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { isInternalServiceCall } from '../_shared/internalAuth.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

// ============================================================================
// Dayforce import.
//
// Receives JSON slices from the dayforce-bridge Tampermonkey userscript and
// upserts into dayforce_org_units / dayforce_employees / dayforce_shifts /
// dayforce_raw_punches. The userscript posts any combination of three
// slices per call — orgUnits, timesheet bundles, raw punches — so the
// worker pool in the script can push each piece as soon as it lands
// without waiting for the rest of the cycle.
//
// The timesheet endpoint Dayforce serves is `ObfuscatingTimesheet/...`,
// which scrambles property names per-build (j6 = employees, b4 = shifts,
// fl = clockIn, etc.). The decoder below walks the known map; everything
// is also stored in `raw_shift` / `raw_employment_record` jsonb columns
// so a future schema drift can be re-processed without re-scraping.
//
// Body shape:
//   {
//     orgUnits?:  [...],                    // GetUserOrg/ array
//     timesheets?: [                        // GetManagerTimesheetLoadBundle
//       { orgUnitId: number, periodStart: string, periodEnd: string, bundle: {...} },
//       ...
//     ],
//     rawPunches?: [                        // GetManagerEmployeeRawPunches
//       { employeeId: number, punches: [...] },
//       ...
//     ]
//   }
// ============================================================================

// Known obfuscated-key map for the ObfuscatingTimesheet payload.
// Captured from the wkdus261 HAR (build 72.0.51.12814). When Dayforce
// rotates these, update here and the bridge keeps running unchanged.
const TS_KEYS = {
    actualHours: 'fh',
    badge: 'ao',
    clockIn: 'fl',
    clockOut: 'fj',
    employees: 'j6',
    employmentHistory: 'bg',
    exceptionText: 'go',
    firstName: 'b0',
    hireDate: 'bb',
    homeOrgHistory: 'bd',
    lastName: 'b8',
    payCodes: 'bk',
    payCodeType: 'hv',
    payDate: 'fx',
    payGroupId: 'be',
    payHours: 'fh',
    rateAnnual: 'ap',
    rateHourly: 'an',
    rateHoursPerDay: 'bm',
    rateHoursPerWeek: 'ar',
    scheduled: 'mp',
    shiftDate: 'fx',
    shiftId: 'bt',
    shifts: 'b4',
    timeRounded: 'bx',
    timeRaw: 'kl',
    name: 'b5',
    nickname: 'b1',
    birthDate: 'ay',
    dayforceEmployeeId: 'e4'
} as const

const TS_PAY_CODE_PTO_TYPES = new Set([1, 2, 3, 4, 5, 6, 7]) // pay code IDs that count as time-off; refine as we learn more

const toIsoDate = (v: unknown): string | null => {
    if (!v || typeof v !== 'string') return null
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
}

const toIsoTimestamp = (v: unknown): string | null => {
    if (!v || typeof v !== 'string') return null
    // Dayforce serializes timestamps without timezone; treat them as the
    // tenant's local clock and let Postgres store them as TIMESTAMP
    // (without tz). The bridge only runs against US Central plants today.
    return v.replace(/\.\d+$/, '') || null
}

const numOrNull = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const boolOrFalse = (v: unknown): boolean => v === true || v === 'true'

// Resolves `dayforce_org_id` from the textual PunchDeviceName string Dayforce
// stamps on each raw punch (e.g. "RMX_TX_14002_Houston Lake Houston"). Falls
// back to null when no org row matches — the punch still imports.
function buildOrgLookupByName(orgRows: any[]): Map<string, number> {
    const out = new Map<string, number>()
    for (const o of orgRows) {
        if (!o?.dayforce_org_id) continue
        if (o.display_code) out.set(String(o.display_code).toLowerCase(), o.dayforce_org_id)
        if (o.display_name) out.set(String(o.display_name).toLowerCase(), o.dayforce_org_id)
        // PunchDeviceName combines code + " " + name as a single string.
        if (o.display_code && o.display_name) {
            out.set(`${o.display_code}_${o.display_name}`.toLowerCase(), o.dayforce_org_id)
        }
    }
    return out
}

function resolveOrgFromDeviceName(deviceName: string | null, lookup: Map<string, number>): number | null {
    if (!deviceName) return null
    const key = String(deviceName).toLowerCase()
    if (lookup.has(key)) return lookup.get(key) ?? null
    // PunchDeviceName is "RMX_TX_14002_Houston Lake Houston" — try the
    // leading underscore-prefix tokens.
    const parts = key.split('_')
    for (let i = parts.length; i >= 2; i--) {
        const candidate = parts.slice(0, i).join('_')
        if (lookup.has(candidate)) return lookup.get(candidate) ?? null
    }
    return null
}

interface OrgUnitRow {
    dayforce_org_id: number
    display_code: string
    display_name: string
    org_type: string | null
    state_code: string | null
    location_number: number | null
    parent_dayforce_org_id: number | null
    parent_name: string | null
    last_synced_at: string
}

/** Decodes GetUserOrg/ shape into the dayforce_org_units row schema. */
function normalizeOrgUnits(orgUnits: any[]): OrgUnitRow[] {
    const now = new Date().toISOString()
    const rows: OrgUnitRow[] = []
    const parentNameById = new Map<number, string>()
    for (const u of orgUnits) {
        const id = Number(u?.id)
        if (Number.isFinite(id)) parentNameById.set(id, String(u?.name ?? ''))
    }
    for (const u of orgUnits) {
        const id = Number(u?.id)
        if (!Number.isFinite(id) || u?.id === 'root') continue
        const name = String(u?.name ?? '')
        // Name pattern: ORGTYPE_STATE_NUMBER_DisplayName, e.g.
        // "RMX_TX_14002_Houston Lake Houston". Split out the prefix tokens
        // so the UI can render them without re-parsing on every render.
        const match = name.match(/^([A-Z_]+?)_([A-Z]{2})_(\d+)_(.+)$/)
        const orgType = match?.[1] ?? null
        const stateCode = match?.[2] ?? null
        const locationNumber = match ? Number(match[3]) : null
        const displayName = match?.[4] ?? name
        const displayCode = match ? `${orgType}_${stateCode}_${match[3]}` : name
        const parentId = Number(u?.parent)
        rows.push({
            dayforce_org_id: id,
            display_code: displayCode,
            display_name: displayName,
            last_synced_at: now,
            location_number: locationNumber,
            org_type: orgType,
            parent_dayforce_org_id: Number.isFinite(parentId) ? parentId : null,
            parent_name: Number.isFinite(parentId) ? parentNameById.get(parentId) ?? null : null,
            state_code: stateCode
        })
    }
    return rows
}

interface EmployeeRow {
    dayforce_employee_id: number
    employee_badge: string
    first_name: string | null
    last_name: string | null
    nickname: string | null
    display_name: string | null
    hire_date: string | null
    birth_date: string | null
    annual_salary: number | null
    hourly_rate: number | null
    hours_per_week: number | null
    hours_per_day: number | null
    home_dayforce_org_id: number | null
    pay_group_id: number | null
    employment_status_reason_id: number | null
    is_active: boolean
    raw_employment_record: unknown
    last_synced_at: string
}

interface ShiftRow {
    dayforce_shift_id: number | null
    dayforce_employee_id: number
    employee_badge: string | null
    dayforce_org_id: number | null
    shift_date: string
    scheduled_in_at: string | null
    scheduled_out_at: string | null
    scheduled_hours: number | null
    actual_in_at: string | null
    actual_out_at: string | null
    actual_hours: number | null
    actual_in_punch_at: string | null
    actual_out_punch_at: string | null
    exception_code: string | null
    exception_text: string | null
    pay_code: string | null
    is_pto: boolean
    pto_hours: number | null
    hourly_rate_snapshot: number | null
    raw_shift: unknown
    last_synced_at: string
}

/** Decodes a single timesheet bundle (one org × one week) into employee +
 *  shift upsert rows. Tolerant to missing keys — anything unrecognized is
 *  preserved in `raw_employment_record` / `raw_shift` jsonb. */
function decodeTimesheetBundle(
    bundle: any,
    orgUnitId: number
): { employees: EmployeeRow[]; shifts: ShiftRow[] } {
    const now = new Date().toISOString()
    const employees: EmployeeRow[] = []
    const shifts: ShiftRow[] = []
    const employeeList = bundle?.Result?.[TS_KEYS.employees]
    if (!Array.isArray(employeeList)) return { employees, shifts }

    for (const emp of employeeList) {
        const dayforceEmployeeId = numOrNull(emp?.[TS_KEYS.dayforceEmployeeId])
        if (!dayforceEmployeeId) continue
        const employmentRow = Array.isArray(emp?.[TS_KEYS.employmentHistory])
            ? emp[TS_KEYS.employmentHistory][0]
            : null
        const homeOrg = Array.isArray(emp?.[TS_KEYS.homeOrgHistory]) ? emp[TS_KEYS.homeOrgHistory][0] : null
        const badge = String(
            employmentRow?.[TS_KEYS.badge] ?? (emp?.[TS_KEYS.name] || '').toString().match(/(\d+)\s*$/)?.[1] ?? ''
        )

        const hourlyRate = numOrNull(employmentRow?.[TS_KEYS.rateHourly])

        employees.push({
            annual_salary: numOrNull(employmentRow?.[TS_KEYS.rateAnnual]),
            birth_date: toIsoDate(emp?.[TS_KEYS.birthDate]),
            dayforce_employee_id: dayforceEmployeeId,
            display_name: emp?.[TS_KEYS.name] ?? null,
            employee_badge: badge || String(dayforceEmployeeId),
            employment_status_reason_id: numOrNull(employmentRow?.EmploymentStatusReasonId),
            first_name: emp?.[TS_KEYS.firstName] ?? null,
            hire_date: toIsoDate(emp?.[TS_KEYS.hireDate]),
            home_dayforce_org_id: numOrNull(homeOrg?.[TS_KEYS.payGroupId]) ?? orgUnitId,
            hourly_rate: hourlyRate,
            hours_per_day: numOrNull(employmentRow?.[TS_KEYS.rateHoursPerDay]),
            hours_per_week: numOrNull(employmentRow?.[TS_KEYS.rateHoursPerWeek]),
            is_active: !employmentRow?.fn,
            last_name: emp?.[TS_KEYS.lastName] ?? null,
            last_synced_at: now,
            nickname: emp?.[TS_KEYS.nickname] ?? null,
            pay_group_id: numOrNull(homeOrg?.[TS_KEYS.payGroupId]),
            raw_employment_record: employmentRow ?? null
        })

        const shiftList = Array.isArray(emp?.[TS_KEYS.shifts]) ? emp[TS_KEYS.shifts] : []
        for (const sh of shiftList) {
            const shiftDate = toIsoDate(sh?.[TS_KEYS.shiftDate])
            if (!shiftDate) continue
            const scheduled = sh?.[TS_KEYS.scheduled] ?? {}
            const clockIn = sh?.[TS_KEYS.clockIn] ?? {}
            const clockOut = sh?.[TS_KEYS.clockOut] ?? {}
            shifts.push({
                actual_hours: numOrNull(sh?.[TS_KEYS.actualHours]),
                actual_in_at: toIsoTimestamp(clockIn?.[TS_KEYS.timeRounded]),
                actual_in_punch_at: toIsoTimestamp(clockIn?.[TS_KEYS.timeRaw]),
                actual_out_at: toIsoTimestamp(clockOut?.[TS_KEYS.timeRounded]),
                actual_out_punch_at: toIsoTimestamp(clockOut?.[TS_KEYS.timeRaw]),
                dayforce_employee_id: dayforceEmployeeId,
                dayforce_org_id: orgUnitId,
                dayforce_shift_id: numOrNull(sh?.[TS_KEYS.shiftId]),
                employee_badge: badge || String(dayforceEmployeeId),
                exception_code: null,
                exception_text: sh?.[TS_KEYS.exceptionText] ?? null,
                hourly_rate_snapshot: hourlyRate,
                is_pto: false,
                last_synced_at: now,
                pay_code: null,
                pto_hours: null,
                raw_shift: sh,
                scheduled_hours: numOrNull(scheduled?.[TS_KEYS.actualHours]),
                scheduled_in_at: toIsoTimestamp(scheduled?.[TS_KEYS.clockIn]?.[TS_KEYS.timeRounded]),
                scheduled_out_at: toIsoTimestamp(scheduled?.[TS_KEYS.clockOut]?.[TS_KEYS.timeRounded]),
                shift_date: shiftDate
            })
        }

        // PTO / holiday days come on a separate array, not as regular shifts.
        const payCodeList = Array.isArray(emp?.[TS_KEYS.payCodes]) ? emp[TS_KEYS.payCodes] : []
        for (const pc of payCodeList) {
            const shiftDate = toIsoDate(pc?.[TS_KEYS.payDate])
            if (!shiftDate) continue
            const payCodeType = numOrNull(pc?.[TS_KEYS.payCodeType])
            shifts.push({
                actual_hours: null,
                actual_in_at: null,
                actual_in_punch_at: null,
                actual_out_at: null,
                actual_out_punch_at: null,
                dayforce_employee_id: dayforceEmployeeId,
                dayforce_org_id: orgUnitId,
                dayforce_shift_id: numOrNull(pc?.jx),
                employee_badge: badge || String(dayforceEmployeeId),
                exception_code: null,
                exception_text: null,
                hourly_rate_snapshot: hourlyRate,
                is_pto: payCodeType !== null && TS_PAY_CODE_PTO_TYPES.has(payCodeType),
                last_synced_at: now,
                pay_code: payCodeType !== null ? String(payCodeType) : null,
                pto_hours: numOrNull(pc?.[TS_KEYS.payHours]),
                raw_shift: pc,
                scheduled_hours: numOrNull(pc?.[TS_KEYS.payHours]),
                scheduled_in_at: null,
                scheduled_out_at: null,
                shift_date: shiftDate
            })
        }
    }

    return { employees, shifts }
}

interface RawPunchRow {
    raw_punch_id: number
    dayforce_employee_id: number
    employee_badge: string | null
    punch_type: string
    punch_time: string
    process_time: string | null
    punch_device_name: string | null
    dayforce_org_id: number | null
    punch_state: string | null
    punch_origin: string | null
    was_offline: boolean
    was_validated: boolean
    raw_payload: unknown
    last_synced_at: string
}

function normalizeRawPunches(
    punches: any[],
    fallbackEmployeeId: number | null,
    orgLookup: Map<string, number>
): RawPunchRow[] {
    const now = new Date().toISOString()
    const rows: RawPunchRow[] = []
    for (const p of punches) {
        const rawId = numOrNull(p?.RawPunchId)
        const employeeId = numOrNull(p?.EmployeeId) ?? fallbackEmployeeId
        const punchTime = toIsoTimestamp(p?.RawPunchTime)
        if (!rawId || !employeeId || !punchTime) continue
        rows.push({
            dayforce_employee_id: employeeId,
            dayforce_org_id: resolveOrgFromDeviceName(p?.PunchDeviceName ?? null, orgLookup),
            employee_badge: p?.EmployeeBadge ?? null,
            last_synced_at: now,
            process_time: toIsoTimestamp(p?.ProcessTime),
            punch_device_name: p?.PunchDeviceName ?? null,
            punch_origin: p?.PunchOriginName ?? null,
            punch_state: p?.PunchState ?? null,
            punch_time: punchTime,
            punch_type: String(p?.PunchType ?? 'Unknown'),
            raw_payload: p,
            raw_punch_id: rawId,
            was_offline: boolOrFalse(p?.WasOfflinePunch),
            was_validated: p?.WasValidated !== false
        })
    }
    return rows
}

// Dedupes by primary natural key — we sometimes get the same shift twice
// across slices (e.g. the bridge re-sends overlapping windows). Last
// occurrence wins which matches the upsert semantics.
function dedupeShifts(rows: ShiftRow[]): ShiftRow[] {
    const map = new Map<string, ShiftRow>()
    for (const r of rows) map.set(`${r.dayforce_employee_id}|${r.shift_date}`, r)
    return Array.from(map.values())
}

function dedupeEmployees(rows: EmployeeRow[]): EmployeeRow[] {
    const map = new Map<number, EmployeeRow>()
    for (const r of rows) map.set(r.dayforce_employee_id, r)
    return Array.from(map.values())
}

function dedupePunches(rows: RawPunchRow[]): RawPunchRow[] {
    const map = new Map<number, RawPunchRow>()
    for (const r of rows) map.set(r.raw_punch_id, r)
    return Array.from(map.values())
}

// @ts-ignore Deno serve
Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    const headers = getCorsHeaders(origin)

    if (req.method === 'OPTIONS') return handleOptions(origin)
    if (req.method !== 'POST') return errorResponse('Method not allowed', headers, 405)

    let body: {
        orgUnits?: any[]
        rawPunches?: { employeeId: number; punches: any[] }[]
        timesheets?: { bundle: any; orgUnitId: number; periodEnd?: string; periodStart?: string }[]
    } = {}
    try {
        body = await req.json().catch(() => ({}))
    } catch {
        body = {}
    }

    // Auth acceptance order matches dispatch-import: internal token →
    // service role key → user session. The unattended bridge uses the
    // service role key (same pattern as smyrna-dispatch-sync), web app
    // manual triggers use the user session.
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    // @ts-ignore Deno env
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const isServiceRoleCall = serviceRoleKey.length > 0 && authHeader === serviceRoleKey
    if (!isInternalServiceCall(req) && !isServiceRoleCall) {
        const auth = await requireAuthenticated(null, req, headers, body)
        if (auth instanceof Response) return auth
    }

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const stats = { errors: [] as string[], orgUnits: 0, punches: 0, shifts: 0, employees: 0 }

    try {
        // 1. Org units
        if (Array.isArray(body.orgUnits) && body.orgUnits.length > 0) {
            const rows = normalizeOrgUnits(body.orgUnits)
            if (rows.length > 0) {
                const { error } = await supabase.from('dayforce_org_units').upsert(rows, {
                    onConflict: 'dayforce_org_id'
                })
                if (error) stats.errors.push(`orgUnits: ${error.message}`)
                else stats.orgUnits = rows.length
            }
        }

        // 2. Timesheets — decode each bundle, accumulate, dedupe, upsert once
        if (Array.isArray(body.timesheets) && body.timesheets.length > 0) {
            const allEmployees: EmployeeRow[] = []
            const allShifts: ShiftRow[] = []
            for (const t of body.timesheets) {
                if (!t?.bundle || !Number.isFinite(t?.orgUnitId)) continue
                const { employees, shifts } = decodeTimesheetBundle(t.bundle, Number(t.orgUnitId))
                allEmployees.push(...employees)
                allShifts.push(...shifts)
            }
            const dedupedEmployees = dedupeEmployees(allEmployees)
            const dedupedShifts = dedupeShifts(allShifts)
            if (dedupedEmployees.length > 0) {
                const { error } = await supabase
                    .from('dayforce_employees')
                    .upsert(dedupedEmployees, { onConflict: 'dayforce_employee_id' })
                if (error) stats.errors.push(`employees: ${error.message}`)
                else stats.employees = dedupedEmployees.length
            }
            if (dedupedShifts.length > 0) {
                const { error } = await supabase
                    .from('dayforce_shifts')
                    .upsert(dedupedShifts, { onConflict: 'dayforce_employee_id,shift_date' })
                if (error) stats.errors.push(`shifts: ${error.message}`)
                else stats.shifts = dedupedShifts.length
            }
        }

        // 3. Raw punches
        if (Array.isArray(body.rawPunches) && body.rawPunches.length > 0) {
            const { data: orgRows } = await supabase
                .from('dayforce_org_units')
                .select('dayforce_org_id, display_code, display_name')
            const orgLookup = buildOrgLookupByName(orgRows ?? [])

            const allPunches: RawPunchRow[] = []
            for (const rp of body.rawPunches) {
                if (!Array.isArray(rp?.punches)) continue
                allPunches.push(...normalizeRawPunches(rp.punches, numOrNull(rp.employeeId), orgLookup))
            }
            const deduped = dedupePunches(allPunches)
            if (deduped.length > 0) {
                const { error } = await supabase
                    .from('dayforce_raw_punches')
                    .upsert(deduped, { onConflict: 'raw_punch_id' })
                if (error) stats.errors.push(`punches: ${error.message}`)
                else stats.punches = deduped.length
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return errorResponse(`Import failed: ${message}`, headers, 500, { stats })
    }

    const ok = stats.errors.length === 0
    return jsonResponse({ ok, stats }, headers, ok ? 200 : 207)
})
