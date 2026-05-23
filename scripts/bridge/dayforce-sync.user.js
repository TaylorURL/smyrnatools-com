// ==UserScript==
// @name         Smyrna Dayforce Sync
// @namespace    smyrna-tools
// @version      1.0.0
// @description  Syncs Houston RMX_TX_* timesheet bundles + raw clock punches from Dayforce (wkdus261) to Supabase every 5 minutes. Captures the session GUID + CSRF token from the live UI's own traffic, calls the same internal endpoints the timesheet view calls (ObfuscatingTimesheet/GetManagerTimesheetLoadBundle, EmployeeSelfService/TimeAndAttendance/GetManagerEmployeeRawPunches), POSTs structured JSON to the dayforce-import edge function which decodes and upserts. Manual triggers under window.dayforceSync.
// @match        https://wkdus261.dayforcehcm.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      wkdus261.dayforcehcm.com
// @connect      db.smyrnatools.com
// @run-at       document-start
// ==/UserScript==

;(function () {
    'use strict'

    // ============================================================
    // CONFIG
    // ============================================================
    const SUPABASE_URL = 'https://db.smyrnatools.com'
    const SUPABASE_SERVICE_KEY =
        'REDACTED-ROTATED-CREDENTIAL'
    const IMPORT_ENDPOINT = `${SUPABASE_URL}/functions/v1/dayforce-import`

    const DAYFORCE_HOST = 'wkdus261.dayforcehcm.com'
    const DAYFORCE_BASE = `https://${DAYFORCE_HOST}/MyDayforce`

    // Houston RMX_TX_* org units the bridge syncs. dayforce_org_id (internal)
    // -> display code so we can log meaningfully. The display code is also
    // what the migration seed uses, so the edge function can resolve back
    // either way.
    const RMX_ORG_UNITS = [
        { id: 3627, label: 'RMX_TX_14001 Flintlock' },
        { id: 3628, label: 'RMX_TX_14002 Lake Houston' },
        { id: 3624, label: 'RMX_TX_14003 Baytown' },
        { id: 3634, label: 'RMX_TX_14005 San Leon' },
        { id: 3629, label: 'RMX_TX_14006 Winfield' },
        { id: 3632, label: 'RMX_TX_14007 New Waverly' },
        { id: 3625, label: 'RMX_TX_14008 Conroe' },
        { id: 3626, label: 'RMX_TX_14010 Freeport' },
        { id: 3633, label: 'RMX_TX_14053 Bryan' },
        { id: 3630, label: 'RMX_TX_14055 Huntsville' },
        { id: 3631, label: 'RMX_TX_14061 Navasota' },
        { id: 6641, label: 'RMX_TX_14068 Madisonville' }
    ]

    const INTERVAL_MS = 5 * 60 * 1000
    // Concurrent workers for fanned-out per-org / per-employee calls. The
    // Dayforce gateway is HTTPS to the cloud and tolerates a handful of
    // simultaneous calls; tune down if we ever see 429.
    const WORKER_CONCURRENCY = 4

    // Active sync window in America/Chicago. Dayforce is the system of
    // record outside dispatch hours too (PTO requests, late-night maintenance
    // shifts) so we sync 24/7 — narrowing the window only saves API calls,
    // not data integrity. Override via window.dayforceSync.setWindow() if a
    // throttle is ever needed.
    const SYNC_WINDOW_START_MINUTES = 0
    const SYNC_WINDOW_END_MINUTES = 24 * 60

    // Keys used by the obfuscated ObfuscatingTimesheet response — we don't
    // decode here (that's the edge function's job) but we do need to know
    // which key holds the employee array so we can fan out raw-punch
    // queries per-employee in this cycle.
    const TS_EMPLOYEES_KEY = 'j6'
    const TS_DAYFORCE_EMPLOYEE_ID_KEY = 'e4'

    // ============================================================
    // STATE
    // ============================================================
    let csrfToken = null
    let sessionGuid = null
    let lastSync = null
    let syncing = false
    let earlyKickScheduled = false

    const log = (...args) => console.log('[Dayforce Sync]', ...args)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    function getCentralMinutesOfDay() {
        const parts = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            hourCycle: 'h23',
            minute: '2-digit',
            timeZone: 'America/Chicago'
        }).formatToParts(new Date())
        const hour = Number(parts.find((p) => p.type === 'hour')?.value)
        const minute = Number(parts.find((p) => p.type === 'minute')?.value)
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
        return (hour % 24) * 60 + minute
    }

    function isWithinSyncWindow() {
        const m = getCentralMinutesOfDay()
        return m >= SYNC_WINDOW_START_MINUTES && m < SYNC_WINDOW_END_MINUTES
    }

    function kickSyncSoon() {
        if (earlyKickScheduled) return
        earlyKickScheduled = true
        setTimeout(() => {
            earlyKickScheduled = false
            try {
                runSync()
            } catch (e) {
                log('Early sync error:', e?.message || e)
            }
        }, 500)
    }

    // ============================================================
    // SESSION GUID + CSRF TOKEN INTERCEPTION
    //
    // Dayforce URLs include a per-session GUID:
    //   /MyDayforce/u/<sessionGuid>/Timesheet/...
    // We grab it from any matching URL we see go past, plus the x-csrf-token
    // header the UI attaches to every state-changing call.
    // ============================================================
    const SESSION_GUID_RE = /\/MyDayforce\/u\/([^/]+)\//

    function captureFromUrl(url) {
        if (!url || typeof url !== 'string') return
        const m = url.match(SESSION_GUID_RE)
        if (m && sessionGuid !== m[1]) {
            const wasUnset = !sessionGuid
            sessionGuid = m[1]
            log('Captured session GUID from URL')
            if (wasUnset) kickSyncSoon()
        }
    }

    function captureHeader(name, value) {
        if (!name || !value) return
        const lname = name.toLowerCase()
        if (lname === 'x-csrf-token' && csrfToken !== value) {
            csrfToken = value
            log('Captured x-csrf-token')
        }
    }

    function installInterceptors() {
        // XHR — capture both the URL (for session GUID) and headers (CSRF).
        const origOpen = XMLHttpRequest.prototype.open
        XMLHttpRequest.prototype.open = function (method, url) {
            captureFromUrl(url)
            return origOpen.apply(this, arguments)
        }
        const origSetHeader = XMLHttpRequest.prototype.setRequestHeader
        XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
            captureHeader(name, value)
            return origSetHeader.apply(this, arguments)
        }

        // fetch — same idea.
        const origFetch = window.fetch
        window.fetch = function (input, init) {
            try {
                const url = typeof input === 'string' ? input : input?.url
                captureFromUrl(url)
                const headers = init?.headers
                if (headers) {
                    const readHeader = (key) => {
                        if (headers instanceof Headers) return headers.get(key)
                        if (Array.isArray(headers)) {
                            const h = headers.find((x) => x[0]?.toLowerCase() === key.toLowerCase())
                            return h ? h[1] : null
                        }
                        if (typeof headers === 'object') {
                            for (const k in headers) if (k.toLowerCase() === key.toLowerCase()) return headers[k]
                        }
                        return null
                    }
                    captureHeader('x-csrf-token', readHeader('x-csrf-token'))
                }
            } catch {
                // ignore — interceptor failures must never break the host page
            }
            return origFetch.apply(this, arguments)
        }
    }
    installInterceptors()

    // ============================================================
    // DAYFORCE API CALLS (via GM_xmlhttpRequest to attach the session cookie
    // automatically AND let us add the x-csrf-token header)
    // ============================================================
    function dayforcePost(path, body) {
        return new Promise((resolve, reject) => {
            const url = `${DAYFORCE_BASE}/u/${sessionGuid}${path}`
            GM_xmlhttpRequest({
                method: 'POST',
                url,
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                    Origin: `https://${DAYFORCE_HOST}`,
                    Referer: `https://${DAYFORCE_HOST}/MyDayforce/u/${sessionGuid}/Common/`,
                    'X-Requested-With': 'XMLHttpRequest',
                    'x-csrf-token': csrfToken || ''
                },
                data: JSON.stringify(body),
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText))
                        } catch (e) {
                            reject(new Error(`Bad JSON from ${path}: ${e.message}`))
                        }
                        return
                    }
                    const err = new Error(`${path} returned ${res.status}: ${(res.responseText || '').slice(0, 200)}`)
                    err.status = res.status
                    reject(err)
                },
                onerror: (e) => reject(new Error(`network error: ${e?.error}`))
            })
        })
    }

    // GET — used for GetUserOrg/ (no body required, plain XHR pattern)
    function dayforceGet(path) {
        return new Promise((resolve, reject) => {
            const url = `${DAYFORCE_BASE}/u/${sessionGuid}${path}`
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {
                    Accept: 'application/json, text/plain, */*',
                    Origin: `https://${DAYFORCE_HOST}`,
                    Referer: `https://${DAYFORCE_HOST}/MyDayforce/u/${sessionGuid}/Common/`,
                    'X-Requested-With': 'XMLHttpRequest',
                    'x-csrf-token': csrfToken || ''
                },
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText))
                        } catch (e) {
                            reject(new Error(`Bad JSON from ${path}: ${e.message}`))
                        }
                        return
                    }
                    const err = new Error(`${path} returned ${res.status}: ${(res.responseText || '').slice(0, 200)}`)
                    err.status = res.status
                    reject(err)
                },
                onerror: (e) => reject(new Error(`network error: ${e?.error}`))
            })
        })
    }

    // ============================================================
    // SUPABASE EDGE FUNCTION
    // ============================================================
    function postToImport(payload) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: IMPORT_ENDPOINT,
                headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                    apikey: SUPABASE_SERVICE_KEY,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(payload),
                timeout: 120000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve({ body: JSON.parse(res.responseText), ok: true })
                        } catch {
                            resolve({ body: res.responseText, ok: true })
                        }
                    } else {
                        resolve({ error: `${res.status}: ${(res.responseText || '').slice(0, 300)}`, ok: false })
                    }
                },
                onerror: (err) => resolve({ error: err?.error || 'network', ok: false }),
                ontimeout: () => resolve({ error: 'timeout', ok: false })
            })
        })
    }

    // ============================================================
    // DATE HELPERS
    // ============================================================
    // Sunday-start week containing `date`. Dayforce pay weeks start Sunday;
    // periodStart / periodEnd from the UI's own request use the same boundary.
    function getPayWeekRange(date) {
        const d = new Date(date)
        const dow = d.getDay() // 0=Sun
        const start = new Date(d)
        start.setDate(d.getDate() - dow)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 7)
        return { end, start }
    }

    function toDayforceDateString(d) {
        // Format: 2026-05-17T00:00:00.000-05:00 (CT). Dayforce stores
        // tenant-local time; the offset is informational.
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}T00:00:00.000-05:00`
    }

    // ============================================================
    // SYNC FLOW
    // ============================================================
    function buildTimesheetBody(orgUnitId, periodStart, periodEnd) {
        return {
            filters: { FilterGrouping: '', Filters: [] },
            isRealTimeEnabled: false,
            orgUnitIds: [String(orgUnitId)],
            paginationParameters: {
                pageIndex: 0,
                pageSize: 500,
                sortingParameters: [
                    { isDescending: false, sortType: 2 },
                    { isDescending: false, sortType: 3 },
                    { isDescending: false, sortType: 4 }
                ]
            },
            periodEnd,
            periodStart,
            tryToApplyExceptionFilter: false
        }
    }

    function buildRawPunchBody(employeeId, periodStart, periodEnd) {
        return {
            employeeId,
            endDate: periodEnd,
            isPunchCheckSumRequired: false,
            startDate: periodStart
        }
    }

    // One sync cycle:
    //   1. Refresh org units (cheap, once per cycle)
    //   2. For every RMX org × current week: pull timesheet bundle
    //   3. For every employee surfaced in step 2: pull last 9 days of
    //      raw punches (covers the current + prior week so a Sunday-edited
    //      Saturday punch still lands)
    //   4. POST each slice to the import edge function as soon as it's ready
    async function runSync() {
        if (syncing) {
            log('Already syncing, skipping tick')
            return
        }
        if (!isWithinSyncWindow()) {
            updateBadge('paused', 'outside sync window')
            return
        }
        if (!sessionGuid) {
            log('No session GUID captured yet — waiting for UI traffic')
            updateBadge('waiting')
            return
        }

        syncing = true
        const cycleStart = Date.now()
        const results = { employees: 0, punches: 0, shifts: 0, timesheets: 0 }
        updateBadge('syncing', '0%')

        try {
            // -------- 1. Refresh org units --------
            try {
                const orgData = await dayforceGet('/Framework/Org/GetUserOrg/')
                if (Array.isArray(orgData) && orgData.length > 0) {
                    const orgRes = await postToImport({ orgUnits: orgData })
                    if (!orgRes.ok) log(`Org unit sync failed: ${orgRes.error}`)
                }
            } catch (err) {
                log(`Org unit refresh failed (non-fatal): ${err.message}`)
            }

            // -------- 2. Pull timesheets for each RMX org (current week) --------
            const { end: weekEnd, start: weekStart } = getPayWeekRange(new Date())
            const periodStart = toDayforceDateString(weekStart)
            const periodEnd = toDayforceDateString(weekEnd)
            log(`Cycle: ${periodStart.slice(0, 10)} -> ${periodEnd.slice(0, 10)} across ${RMX_ORG_UNITS.length} orgs`)

            const employeeIds = new Set()
            const timesheetSlices = []

            let orgCursor = 0
            const orgWorker = async () => {
                while (true) {
                    const idx = orgCursor++
                    if (idx >= RMX_ORG_UNITS.length) return
                    const org = RMX_ORG_UNITS[idx]
                    try {
                        const bundle = await dayforcePost(
                            '/Timesheet/ObfuscatingTimesheet/GetManagerTimesheetLoadBundle',
                            buildTimesheetBody(org.id, periodStart, periodEnd)
                        )
                        timesheetSlices.push({ bundle, orgUnitId: org.id, periodEnd, periodStart })
                        const empList = bundle?.Result?.[TS_EMPLOYEES_KEY]
                        if (Array.isArray(empList)) {
                            for (const emp of empList) {
                                const id = Number(emp?.[TS_DAYFORCE_EMPLOYEE_ID_KEY])
                                if (Number.isFinite(id)) employeeIds.add(id)
                            }
                        }
                        results.timesheets++
                    } catch (err) {
                        log(`  TS fail ${org.label}: ${err.message}`)
                    }
                    updateBadge(
                        'syncing',
                        `ts ${results.timesheets}/${RMX_ORG_UNITS.length}`
                    )
                }
            }
            await Promise.all(
                Array.from({ length: Math.min(WORKER_CONCURRENCY, RMX_ORG_UNITS.length) }, orgWorker)
            )

            // Push timesheets to the import endpoint as one batch — the
            // edge function handles dedup across slices.
            if (timesheetSlices.length > 0) {
                const tsRes = await postToImport({ timesheets: timesheetSlices })
                if (tsRes.ok) {
                    results.employees = tsRes.body?.stats?.employees ?? 0
                    results.shifts = tsRes.body?.stats?.shifts ?? 0
                    log(
                        `Timesheets imported: ${results.timesheets} bundles -> ${results.employees} employees, ${results.shifts} shifts`
                    )
                } else {
                    log(`Timesheet import failed: ${tsRes.error}`)
                }
            }

            // -------- 3. Per-employee raw punches (current + prior week) --------
            const punchWindowStart = new Date(weekStart)
            punchWindowStart.setDate(weekStart.getDate() - 7)
            const punchStartStr = toDayforceDateString(punchWindowStart)
            const punchEndStr = toDayforceDateString(weekEnd)
            const employeeIdList = Array.from(employeeIds)
            log(`Pulling raw punches for ${employeeIdList.length} employees`)

            const punchSlices = []
            let empCursor = 0
            const punchWorker = async () => {
                while (true) {
                    const idx = empCursor++
                    if (idx >= employeeIdList.length) return
                    const eid = employeeIdList[idx]
                    try {
                        const res = await dayforcePost(
                            '/EmployeeSelfService/TimeAndAttendance/GetManagerEmployeeRawPunches',
                            buildRawPunchBody(eid, punchStartStr, punchEndStr)
                        )
                        const punches = res?.Result
                        if (Array.isArray(punches) && punches.length > 0) {
                            punchSlices.push({ employeeId: eid, punches })
                        }
                    } catch (err) {
                        log(`  Punch fail ${eid}: ${err.message}`)
                    }
                    if ((idx + 1) % 25 === 0 || idx + 1 === employeeIdList.length) {
                        updateBadge('syncing', `punches ${idx + 1}/${employeeIdList.length}`)
                    }
                }
            }
            await Promise.all(
                Array.from({ length: Math.min(WORKER_CONCURRENCY, employeeIdList.length) }, punchWorker)
            )

            // Punches POST'd in chunks to keep request bodies under the
            // edge function payload ceiling. 50 employees * ~5 punches each
            // is well under 1 MB; the edge function dedupes across chunks.
            const CHUNK = 50
            for (let i = 0; i < punchSlices.length; i += CHUNK) {
                const chunk = punchSlices.slice(i, i + CHUNK)
                const punchRes = await postToImport({ rawPunches: chunk })
                if (punchRes.ok) results.punches += punchRes.body?.stats?.punches ?? 0
                else log(`Punch import chunk failed: ${punchRes.error}`)
            }
            log(`Raw punches imported: ${results.punches}`)

            lastSync = new Date()
            const elapsed = Math.round((Date.now() - cycleStart) / 1000)
            log(
                `Cycle done in ${elapsed}s — ${results.timesheets} TS bundles, ${results.employees} employees, ${results.shifts} shifts, ${results.punches} punches`
            )
            updateBadge('ok')
        } catch (err) {
            log(`Sync error: ${err.message}`)
            updateBadge('error', err.message)
        } finally {
            syncing = false
        }
    }

    // ============================================================
    // STATUS BADGE
    // ============================================================
    let badge
    function ensureBadge() {
        if (badge || !document.body) return
        badge = document.createElement('div')
        badge.style.cssText = `
            position: fixed; bottom: 12px; right: 12px; z-index: 999999;
            font-family: monospace; font-size: 12px; padding: 6px 10px;
            border-radius: 4px; color: #fff; background: #333;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3); pointer-events: none;
            max-width: 320px;
        `
        document.body.appendChild(badge)
    }

    function updateBadge(state, detail) {
        ensureBadge()
        if (!badge) return
        const ts = lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
        if (state === 'syncing') {
            badge.style.background = '#555'
            badge.textContent = `DAYFORCE SYNC ${detail || ''} | last ok ${ts}`
        } else if (state === 'waiting') {
            badge.style.background = '#666'
            badge.textContent = `DAYFORCE waiting for session...`
        } else if (state === 'paused') {
            badge.style.background = '#444'
            badge.textContent = `DAYFORCE paused — ${detail || ''} | last ok ${ts}`
        } else if (state === 'ok') {
            badge.style.background = '#2d7a2d'
            badge.textContent = `DAYFORCE OK ${ts}`
        } else if (state === 'error') {
            badge.style.background = '#a33'
            badge.textContent = `DAYFORCE FAIL | last ok ${ts}`
            if (detail) badge.title = detail
        }
    }

    // ============================================================
    // KICKOFF
    // ============================================================
    log(
        `Smyrna Dayforce Sync v1.0.0 loaded — host ${DAYFORCE_HOST}, ${WORKER_CONCURRENCY} parallel workers, ${RMX_ORG_UNITS.length} RMX orgs. Manual triggers under window.dayforceSync`
    )

    setTimeout(() => {
        updateBadge('waiting')
        // First run after 10s — gives the UI time to fire requests so we
        // capture the session GUID + CSRF token.
        setTimeout(runSync, 10000)
        setInterval(runSync, INTERVAL_MS)
    }, 1000)

    // ============================================================
    // MANUAL DEVTOOLS TRIGGERS
    // ============================================================
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
    pageWindow.dayforceSync = {
        runNow() {
            log('Manual: running sync cycle now')
            return runSync()
        },
        status() {
            const snap = {
                csrfCaptured: !!csrfToken,
                lastSync: lastSync ? lastSync.toISOString() : null,
                sessionGuid: sessionGuid ? `${sessionGuid.slice(0, 8)}…` : null,
                syncing,
                withinWindow: isWithinSyncWindow()
            }
            log('Manual: status', snap)
            return snap
        },
        // Escape hatch: if the captured session GUID ever sticks to a dead
        // session, this clears it so the next UI XHR re-populates from scratch.
        resetSession() {
            sessionGuid = null
            csrfToken = null
            log('Manual: session GUID + CSRF cleared')
        }
    }
    log('Manual triggers ready — call dayforceSync.runNow() from devtools to test')
})()
