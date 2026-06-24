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
// upserts into dayforce_shifts. The userscript posts timesheet bundles per
// org-week; this function decodes each bundle's shift array and writes one
// row per (employee × shift_date).
//
// The timesheet endpoint Dayforce serves is `ObfuscatingTimesheet/...`,
// which scrambles property names per-build (j6 = employees, b4 = shifts,
// fl = clockIn, etc.). The decoder below walks the known map; everything
// is also stored in the `raw_shift` jsonb column so a future schema drift
// can be re-processed without re-scraping.
//
// Body shape:
//   {
//     timesheets: [                         // GetManagerTimesheetLoadBundle
//       { orgUnitId: number, periodStart: string, periodEnd: string, bundle: {...} },
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
    dayforceEmployeeId: 'e4',
    employees: 'j6',
    employmentHistory: 'bg',
    exceptionText: 'go',
    name: 'b5',
    payCodes: 'bk',
    payCodeType: 'hv',
    payDate: 'fx',
    payHours: 'fh',
    rateHourly: 'an',
    scheduled: 'mp',
    shiftDate: 'fx',
    shiftId: 'bt',
    shifts: 'b4',
    timeRounded: 'bx',
    timeRaw: 'kl'
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

/** Decodes a single timesheet bundle (one org × one week) into shift upsert
 *  rows. Tolerant to missing keys — anything unrecognized is preserved in
 *  the `raw_shift` jsonb. The employee array is iterated only to walk to
 *  each employee's shift list; no employee profile is persisted. */
function decodeTimesheetBundle(bundle: any, orgUnitId: number): ShiftRow[] {
    const now = new Date().toISOString()
    const shifts: ShiftRow[] = []
    const employeeList = bundle?.Result?.[TS_KEYS.employees]
    if (!Array.isArray(employeeList)) return shifts

    for (const emp of employeeList) {
        const dayforceEmployeeId = numOrNull(emp?.[TS_KEYS.dayforceEmployeeId])
        if (!dayforceEmployeeId) continue
        const employmentRow = Array.isArray(emp?.[TS_KEYS.employmentHistory])
            ? emp[TS_KEYS.employmentHistory][0]
            : null
        const badge = String(
            employmentRow?.[TS_KEYS.badge] ?? (emp?.[TS_KEYS.name] || '').toString().match(/(\d+)\s*$/)?.[1] ?? ''
        )
        const hourlyRate = numOrNull(employmentRow?.[TS_KEYS.rateHourly])

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

    return shifts
}

// Dedupes by primary natural key — we sometimes get the same shift twice
// across slices (e.g. the bridge re-sends overlapping windows). Last
// occurrence wins which matches the upsert semantics.
function dedupeShifts(rows: ShiftRow[]): ShiftRow[] {
    const map = new Map<string, ShiftRow>()
    for (const r of rows) map.set(`${r.dayforce_employee_id}|${r.shift_date}`, r)
    return Array.from(map.values())
}

// @ts-ignore Deno serve
Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    const headers = getCorsHeaders(origin)

    if (req.method === 'OPTIONS') return handleOptions(origin)
    if (req.method !== 'POST') return errorResponse('Method not allowed', headers, 405)

    let body: {
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

    const stats = { errors: [] as string[], shifts: 0 }

    try {
        if (Array.isArray(body.timesheets) && body.timesheets.length > 0) {
            const allShifts: ShiftRow[] = []
            for (const t of body.timesheets) {
                if (!t?.bundle || !Number.isFinite(t?.orgUnitId)) continue
                allShifts.push(...decodeTimesheetBundle(t.bundle, Number(t.orgUnitId)))
            }
            const dedupedShifts = dedupeShifts(allShifts)
            if (dedupedShifts.length > 0) {
                const { error } = await supabase
                    .from('dayforce_shifts')
                    .upsert(dedupedShifts, { onConflict: 'dayforce_employee_id,shift_date' })
                if (error) stats.errors.push(`shifts: ${error.message}`)
                else stats.shifts = dedupedShifts.length
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return errorResponse(`Import failed: ${message}`, headers, 500, { stats })
    }

    const ok = stats.errors.length === 0
    return jsonResponse({ ok, stats }, headers, ok ? 200 : 207)
})
