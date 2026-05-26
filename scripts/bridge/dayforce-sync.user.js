// ==UserScript==
// @name         Smyrna Dayforce Sync
// @namespace    smyrna-tools
// @version      1.1.0
// @description  Syncs Houston RMX_TX_* timesheet bundles + raw clock punches from Dayforce (wkdus261) to Supabase every 5 minutes. Captures the session GUID + CSRF token from the live UI's own traffic, calls the same internal endpoints the timesheet view calls (ObfuscatingTimesheet/GetManagerTimesheetLoadBundle, EmployeeSelfService/TimeAndAttendance/GetManagerEmployeeRawPunches), POSTs structured JSON to the dayforce-import edge function which decodes and upserts. Manual triggers under window.dayforceSync. Auto-recovers from session expiry by reloading once for silent SSO re-auth, then shows a prominent re-login banner if SSO is also dead.
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
    //
    // syncState is the source of truth:
    //   'idle'             — ready to run, no cycle in flight
    //   'syncing'          — a cycle is actively running
    //   'paused-window'    — outside sync window; reserved for future throttling
    //   'session-expired'  — server rejected our auth; recovery in progress
    //   'recovering'       — transitioning back to idle (fresh GUID captured)
    //
    // currentRunToken bumps on every cycle start AND on every state transition
    // out of 'syncing'. Workers inside a cycle compare their captured token
    // against currentRunToken after each await — if it changed, they bail
    // cleanly without trying to cancel in-flight GM_xmlhttpRequests.
    // ============================================================
    const RELOAD_GUARD_KEY = 'dayforce-sync-reload-attempted'

    let csrfToken = null
    let sessionGuid = null
    let lastSync = null
    let syncState = 'idle'
    let currentRunToken = 0
    let earlyKickScheduled = false
    let originalDocumentTitle = null

    const log = (...args) => console.log('[Dayforce Sync]', ...args)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    function setSyncState(next) {
        if (syncState === next) return
        const prev = syncState
        syncState = next
        // Any transition out of 'syncing' bumps the run token so any
        // workers still awaiting will bail on their next checkpoint.
        if (prev === 'syncing') currentRunToken++
    }

    // ============================================================
    // SESSION EXPIRY DETECTION + RECOVERY
    //
    // When the Dayforce server-side session dies, our captured GUID + CSRF
    // go stale. The server responds in one of three ways:
    //   1. 401 / 403  — explicit auth failure
    //   2. 302 / 303  — gateway redirect to the login page
    //   3. 200 + HTML — gateway swallowed the redirect and served the login
    //                   page directly (the live API endpoints we hit always
    //                   return JSON when alive, so HTML means we're logged out)
    //   4. status 0   — GM_xmlhttpRequest can't classify a blocked redirect
    //
    // On detection we:
    //   - clear the stale GUID + CSRF so interceptors recapture from scratch
    //   - bump the run token so in-flight workers exit cleanly
    //   - reload once (silent SSO) on the FIRST detection per tab
    //   - on a SECOND detection (the reload didn't help), show the banner
    //     and wait for the user to log back in
    // ============================================================
    function parseResponseHeaders(headerBlob) {
        // GM_xmlhttpRequest returns response headers as one CRLF-delimited
        // string. Parse case-insensitively into a plain object.
        const out = {}
        if (!headerBlob || typeof headerBlob !== 'string') return out
        for (const line of headerBlob.split(/\r?\n/)) {
            const idx = line.indexOf(':')
            if (idx <= 0) continue
            const key = line.slice(0, idx).trim().toLowerCase()
            const val = line.slice(idx + 1).trim()
            if (key) out[key] = val
        }
        return out
    }

    function isSessionExpiredResponse(res) {
        if (!res) return false
        const status = res.status
        if (status === 0) return true
        if (status === 401 || status === 403) return true
        if (status === 302 || status === 303) return true
        if (status === 200) {
            // The live JSON endpoints we call should NEVER return HTML.
            // If they do, the gateway short-circuited us to a login page.
            const headers = parseResponseHeaders(res.responseHeaders)
            const contentType = (headers['content-type'] || '').toLowerCase()
            if (contentType.includes('text/html')) return true
        }
        return false
    }

    function reloadGuardWasAttempted() {
        try {
            return sessionStorage.getItem(RELOAD_GUARD_KEY) === '1'
        } catch {
            return false
        }
    }

    function markReloadAttempted() {
        try {
            sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
        } catch {
            // sessionStorage may be unavailable in unusual contexts — if so
            // we just lose the loop guard and accept the (small) risk of
            // reloading twice. Better than crashing.
        }
    }

    function clearReloadGuard() {
        try {
            sessionStorage.removeItem(RELOAD_GUARD_KEY)
        } catch {
            // ignore — see markReloadAttempted
        }
    }

    function applyExpiredTitleFlag() {
        if (originalDocumentTitle === null) originalDocumentTitle = document.title
        const flag = '⚠ LOGIN — '
        if (!document.title.startsWith(flag)) {
            document.title = flag + (originalDocumentTitle || '')
        }
    }

    function restoreOriginalTitle() {
        if (originalDocumentTitle !== null) {
            document.title = originalDocumentTitle
            originalDocumentTitle = null
        }
    }

    function handleSessionExpired() {
        // Idempotent — once we're already in the expired state, ignore
        // further expiry signals from in-flight workers.
        if (syncState === 'session-expired') return

        log('Session expired — clearing captured GUID + CSRF')
        setSyncState('session-expired')
        sessionGuid = null
        csrfToken = null
        earlyKickScheduled = false

        applyExpiredTitleFlag()
        updateBadge('expired')
        showReloginBanner()

        if (!reloadGuardWasAttempted()) {
            markReloadAttempted()
            log('Reloading tab once to attempt silent SSO re-auth')
            // Defer slightly so the banner renders before the reload
            // (helps when the SSO chain returns instantly).
            setTimeout(() => {
                try {
                    window.location.reload()
                } catch (e) {
                    log('Reload failed:', e?.message || e)
                }
            }, 250)
            return
        }
        log('Reload already attempted this tab — waiting for fresh session capture')
    }

    function handleFreshSessionCaptured() {
        // Called from captureFromUrl when a new sessionGuid lands AFTER we
        // were stuck in session-expired. The interceptors caught a live
        // request from the (now logged-in) UI, so we're back in business.
        if (syncState !== 'session-expired') return
        log('Fresh session captured after expiry — resuming')
        clearReloadGuard()
        hideReloginBanner()
        restoreOriginalTitle()
        setSyncState('recovering')
        // Brief tick to let CSRF capture also land before we kick a cycle.
        setTimeout(() => {
            setSyncState('idle')
            kickSyncSoon()
        }, 500)
    }

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
            const wasExpired = syncState === 'session-expired'
            sessionGuid = m[1]
            log('Captured session GUID from URL')
            if (wasExpired) {
                handleFreshSessionCaptured()
            } else if (wasUnset) {
                kickSyncSoon()
            }
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
    function makeExpiredError(path, res) {
        const err = new Error(
            `${path} returned ${res.status} (session expired)`
        )
        err.status = res.status
        err.sessionExpired = true
        return err
    }

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
                    if (isSessionExpiredResponse(res)) {
                        handleSessionExpired()
                        reject(makeExpiredError(path, res))
                        return
                    }
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
                onerror: (e) => {
                    // Treat as expired-style; the gateway sometimes blocks
                    // the redirect chain at the network layer and we get
                    // here with no status at all.
                    handleSessionExpired()
                    const err = new Error(`network error: ${e?.error}`)
                    err.sessionExpired = true
                    reject(err)
                }
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
                    if (isSessionExpiredResponse(res)) {
                        handleSessionExpired()
                        reject(makeExpiredError(path, res))
                        return
                    }
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
                onerror: (e) => {
                    handleSessionExpired()
                    const err = new Error(`network error: ${e?.error}`)
                    err.sessionExpired = true
                    reject(err)
                }
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
        if (syncState === 'syncing') {
            log('Already syncing, skipping tick')
            return
        }
        if (syncState === 'session-expired' || syncState === 'recovering') {
            log('Skipping cycle — session expired, awaiting re-login')
            return
        }
        if (!isWithinSyncWindow()) {
            setSyncState('paused-window')
            updateBadge('paused', 'outside sync window')
            return
        }
        if (!sessionGuid) {
            log('No session GUID captured yet — waiting for UI traffic')
            updateBadge('waiting')
            return
        }

        setSyncState('syncing')
        const cycleStart = Date.now()
        const myRunToken = ++currentRunToken
        const isCancelled = () => myRunToken !== currentRunToken
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
                    if (isCancelled()) return
                    const idx = orgCursor++
                    if (idx >= RMX_ORG_UNITS.length) return
                    const org = RMX_ORG_UNITS[idx]
                    try {
                        const bundle = await dayforcePost(
                            '/Timesheet/ObfuscatingTimesheet/GetManagerTimesheetLoadBundle',
                            buildTimesheetBody(org.id, periodStart, periodEnd)
                        )
                        if (isCancelled()) return
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
                        if (err?.sessionExpired) return
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
            if (isCancelled()) return

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
            if (isCancelled()) return

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
                    if (isCancelled()) return
                    const idx = empCursor++
                    if (idx >= employeeIdList.length) return
                    const eid = employeeIdList[idx]
                    try {
                        const res = await dayforcePost(
                            '/EmployeeSelfService/TimeAndAttendance/GetManagerEmployeeRawPunches',
                            buildRawPunchBody(eid, punchStartStr, punchEndStr)
                        )
                        if (isCancelled()) return
                        const punches = res?.Result
                        if (Array.isArray(punches) && punches.length > 0) {
                            punchSlices.push({ employeeId: eid, punches })
                        }
                    } catch (err) {
                        if (err?.sessionExpired) return
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
            if (isCancelled()) return

            // Punches POST'd in chunks to keep request bodies under the
            // edge function payload ceiling. 50 employees * ~5 punches each
            // is well under 1 MB; the edge function dedupes across chunks.
            const CHUNK = 50
            for (let i = 0; i < punchSlices.length; i += CHUNK) {
                if (isCancelled()) return
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
            if (err?.sessionExpired) {
                // handleSessionExpired already transitioned state + UI.
                // Don't overwrite the badge or log a generic error.
                return
            }
            log(`Sync error: ${err.message}`)
            updateBadge('error', err.message)
        } finally {
            // Only flip out of 'syncing' if we're still in it — handleSessionExpired
            // may have moved us to 'session-expired' mid-cycle, and we don't want
            // to clobber that transition with 'idle'.
            if (syncState === 'syncing') setSyncState('idle')
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
        } else if (state === 'expired') {
            badge.style.background = '#a02020'
            badge.textContent = `DAYFORCE session expired — re-login required`
        } else if (state === 'error') {
            badge.style.background = '#a33'
            badge.textContent = `DAYFORCE FAIL | last ok ${ts}`
            if (detail) badge.title = detail
        }
    }

    // ============================================================
    // RE-LOGIN BANNER
    //
    // Full-width red banner docked to the top of the page when the session
    // is dead AND the silent-reload attempt has already been used. Cannot be
    // dismissed by the user — only auto-hides when state transitions back
    // to idle (fresh session captured). A "Reload now" button on the right
    // clears the reload guard and forces a manual reload.
    // ============================================================
    let banner
    function ensureBanner() {
        if (banner || !document.body) return
        banner = document.createElement('div')
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
            background: #a02020; color: #fff; padding: 14px 20px;
            font-family: monospace; font-size: 14px; font-weight: 600;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            display: none; align-items: center; justify-content: space-between;
            gap: 16px;
        `
        const message = document.createElement('span')
        message.textContent =
            'Smyrna Dayforce Sync — session expired. Click anywhere in this tab and complete the Dayforce login.'
        const reloadBtn = document.createElement('button')
        reloadBtn.textContent = 'Reload now'
        reloadBtn.style.cssText = `
            background: #fff; color: #a02020; border: none;
            padding: 6px 14px; border-radius: 3px;
            font-family: monospace; font-size: 13px; font-weight: 700;
            cursor: pointer; flex-shrink: 0;
        `
        reloadBtn.addEventListener('click', () => {
            clearReloadGuard()
            try {
                window.location.reload()
            } catch (e) {
                log('Manual reload failed:', e?.message || e)
            }
        })
        banner.appendChild(message)
        banner.appendChild(reloadBtn)
        document.body.appendChild(banner)
    }

    function showReloginBanner() {
        ensureBanner()
        if (!banner) {
            // body not ready yet — retry once it is
            const retry = () => {
                ensureBanner()
                if (banner) banner.style.display = 'flex'
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', retry, { once: true })
            } else {
                setTimeout(retry, 100)
            }
            return
        }
        banner.style.display = 'flex'
    }

    function hideReloginBanner() {
        if (banner) banner.style.display = 'none'
    }

    // ============================================================
    // KICKOFF
    // ============================================================
    log(
        `Smyrna Dayforce Sync v1.1.0 loaded — host ${DAYFORCE_HOST}, ${WORKER_CONCURRENCY} parallel workers, ${RMX_ORG_UNITS.length} RMX orgs. Manual triggers under window.dayforceSync`
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
                reloadGuard: reloadGuardWasAttempted(),
                sessionGuid: sessionGuid ? `${sessionGuid.slice(0, 8)}…` : null,
                state: syncState,
                withinWindow: isWithinSyncWindow()
            }
            log('Manual: status', snap)
            return snap
        },
        // Escape hatch: if the captured session GUID ever sticks to a dead
        // session, this clears it + the state machine so the next UI XHR
        // re-populates from scratch.
        resetSession() {
            sessionGuid = null
            csrfToken = null
            earlyKickScheduled = false
            if (syncState === 'session-expired') {
                hideReloginBanner()
                restoreOriginalTitle()
            }
            setSyncState('idle')
            log('Manual: session GUID + CSRF cleared, state reset to idle')
        },
        // Force a fresh reload — clears the sessionStorage guard first so
        // the reload counts as a fresh attempt (not a loop).
        manualLogin() {
            log('Manual: clearing reload guard and reloading for fresh SSO')
            clearReloadGuard()
            try {
                window.location.reload()
            } catch (e) {
                log('Manual reload failed:', e?.message || e)
            }
        },
        getState() {
            return syncState
        },
        // Debug helper — if the user got stuck on the banner because the
        // reload guard fired prematurely, this lets them try the silent
        // reload path again on the next expiry.
        clearReloadGuard() {
            clearReloadGuard()
            log('Manual: reload guard cleared')
        }
    }
    log('Manual triggers ready — call dayforceSync.runNow() from devtools to test')
})()
