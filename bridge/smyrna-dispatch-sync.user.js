// ==UserScript==
// @name         Smyrna Dispatch Sync
// @namespace    smyrna-tools
// @version      2.6.0
// @description  Syncs today + next 7 days of DailyOrder and per-plant DetailOrderAnalysis reports to Supabase storage every 5 minutes, and backfills any missing files for the current year
// @match        http://srm-c03.aujs.local:8181/*
// @grant        GM_xmlhttpRequest
// @connect      srm-c03.aujs.local
// @connect      db.smyrnatools.com
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict'

    // ============================================================
    // CONFIG
    // ============================================================
    const SUPABASE_URL = 'https://db.smyrnatools.com'
    const SUPABASE_SERVICE_KEY =
        'REDACTED-ROTATED-CREDENTIAL'
    const BUCKET = 'dispatch-reports'
    const INTERVAL_MS = 5 * 60 * 1000
    // Concurrent workers in the task pool. The dispatch server runs locally
    // on the same workstation as this script, so it tolerates a handful of
    // simultaneous report generations comfortably. Tune down if the server
    // ever starts dropping requests.
    const WORKER_CONCURRENCY = 6

    const API_BASE = 'http://srm-c03.aujs.local:8484'
    const FORM_ID = '1001000'

    // Plants we care about. DailyOrder takes a comma-joined list in one call;
    // DetailOrderAnalysis only accepts a single plant per request, so we fan out.
    const PLANT_IDS = ['401', '402', '403', '405', '406', '407', '408', '410', '453', '455', '461', '468']

    // Report definitions. Each report knows how to build its POST body, where
    // the rendered HTML lands on the dispatch server, and how to name the file
    // in Supabase storage. perPlant reports are run once per plant per date.
    const REPORTS = [
        {
            name: 'DailyOrder',
            reportId: 'DailyOrder',
            storagePrefix: '',
            perPlant: false,
            // DailyOrder is the schedule itself, so we re-pull the full
            // rolling window (today + the next 7 days) every cycle to catch
            // edits dispatchers make to upcoming days.
            daysAhead: 7,
            buildBody(date) {
                return {
                    object: 'customReportRequest',
                    reportId: 'DailyOrder',
                    reportType: 'HTML',
                    reportAction: 0,
                    requestType: 'REPORT',
                    parameters: [
                        { id: 'SystemTypeId', value: '1' },
                        { id: 'OrderDate', value: date },
                        { id: 'IncludeOtherProducts', value: '0' },
                        { id: 'ExcludeCancelledOrders', value: '0' },
                        { id: 'FobOption', value: '0' },
                        { id: 'OrderTypeOption', value: '2' },
                        { id: 'PlantId', value: PLANT_IDS.join(',') }
                    ],
                    filename: 'DailyOrder.HTML'
                }
            },
            storagePath(date) {
                return `${date}.html`
            }
        },
        {
            name: 'DetailOrderAnalysis',
            reportId: 'DetailOrderAnalysis',
            storagePrefix: 'detail/',
            perPlant: true,
            // DetailOrderAnalysis only changes as trucks load through the
            // current day. Future dates have no tickets yet, and past dates
            // are immutable once dispatch closes them out — so the rolling
            // window is just today; older missing files are picked up by
            // backfill (one-shot per file).
            daysAhead: 0,
            buildBody(date, plantId) {
                return {
                    object: 'customReportRequest',
                    reportId: 'DetailOrderAnalysis',
                    reportType: 'HTML',
                    reportAction: 0,
                    requestType: 'REPORT',
                    parameters: [
                        { id: 'intSystemTypeId', value: '1' },
                        { id: 'dtOrderDate', value: date },
                        { id: 'intPumperId', value: '0' },
                        { id: 'OrderType', value: '2' },
                        { id: 'FobOption', value: '0' },
                        { id: 'intPlantId', value: plantId }
                    ],
                    filename: 'DetailOrderAnalysis.HTML'
                }
            },
            storagePath(date, plantId) {
                return `detail/${date}_${plantId}.html`
            }
        }
    ]

    // ============================================================
    // STATE
    // ============================================================
    let seatToken = null // captured from the UI's own API calls
    // The dispatch UI does not send an Authorization header — only seat_token.
    // We still capture Authorization in case a future server build requires it,
    // but the sync flow does NOT gate on it.
    let authToken = null
    let lastSync = null
    let syncing = false
    let earlyKickScheduled = false

    // Kicks an immediate sync the first time we capture a seat_token, so the
    // user doesn't have to wait the next 5-minute tick after install.
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
        }, 250)
    }

    const log = (...args) => console.log('[Smyrna Sync]', ...args)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    // ============================================================
    // TOKEN INTERCEPTION
    // The UI sends seat_token with every API call. We monkey-patch XHR
    // and fetch so we can steal the current token as the UI uses it.
    // Declared (not IIFE) because Prettier strips the trailing semicolon
    // from the previous statement; an IIFE starting with `(` would be
    // parsed as a call against `sleep` and the interceptor would never
    // install.
    // ============================================================
    function installTokenInterceptor() {
        // XHR interception
        const origSetHeader = XMLHttpRequest.prototype.setRequestHeader
        XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
            if (name && value) {
                const lname = name.toLowerCase()
                if (lname === 'seat_token' && seatToken !== value) {
                    const wasUnset = !seatToken
                    seatToken = value
                    log('Captured seat_token from XHR')
                    if (wasUnset) kickSyncSoon()
                } else if (lname === 'authorization' && authToken !== value) {
                    authToken = value
                    log('Captured Authorization from XHR')
                }
            }
            return origSetHeader.apply(this, arguments)
        }

        // fetch interception (in case UI uses fetch)
        const origFetch = window.fetch
        window.fetch = function (input, init) {
            try {
                const headers = init && init.headers
                if (headers) {
                    const readHeader = (key) => {
                        if (headers instanceof Headers) return headers.get(key)
                        if (Array.isArray(headers)) {
                            const h = headers.find((x) => x[0] && x[0].toLowerCase() === key.toLowerCase())
                            return h ? h[1] : null
                        }
                        if (typeof headers === 'object') {
                            for (const k in headers) {
                                if (k.toLowerCase() === key.toLowerCase()) return headers[k]
                            }
                        }
                        return null
                    }
                    const st = readHeader('seat_token')
                    if (st && seatToken !== st) {
                        const wasUnset = !seatToken
                        seatToken = st
                        log('Captured seat_token from fetch')
                        if (wasUnset) kickSyncSoon()
                    }
                    const at = readHeader('authorization')
                    if (at && authToken !== at) {
                        authToken = at
                        log('Captured Authorization from fetch')
                    }
                }
            } catch (e) {
                // ignore
            }
            return origFetch.apply(this, arguments)
        }
    }
    installTokenInterceptor()

    // ============================================================
    // DISPATCH API CALLS (via GM_xmlhttpRequest to bypass CORS)
    // ============================================================
    function buildDispatchHeaders(extra = {}) {
        // The UI sends seat_token + form_id + database (empty); Authorization
        // is not part of normal traffic. We only include Authorization when
        // we've actually captured one, otherwise GM_xmlhttpRequest may emit a
        // literal "null" / "undefined" header value that the server rejects.
        const headers = {
            Accept: 'application/json, text/plain, */*',
            database: '',
            form_id: FORM_ID,
            seat_token: seatToken,
            Origin: 'http://srm-c03.aujs.local:8181',
            Referer: 'http://srm-c03.aujs.local:8181/',
            ...extra
        }
        if (authToken) headers.Authorization = authToken
        return headers
    }

    function apiPost(path, bodyObj) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE}${path}`,
                headers: buildDispatchHeaders({ 'Content-Type': 'application/json' }),
                data: JSON.stringify(bodyObj),
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText))
                        } catch (e) {
                            reject(new Error(`Bad JSON from ${path}: ${e.message}`))
                        }
                    } else {
                        reject(new Error(`${path} returned ${res.status}: ${res.responseText}`))
                    }
                },
                onerror: reject
            })
        })
    }

    function apiGetHtml(path) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}${path}`,
                headers: buildDispatchHeaders(),
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) resolve(res.responseText)
                    else {
                        const err = new Error(`${path} returned ${res.status}`)
                        err.status = res.status
                        reject(err)
                    }
                },
                onerror: reject
            })
        })
    }

    // Poll the static report URL until it exists. Report generation is async -
    // POST returns a reqId immediately but the file takes a few seconds to render,
    // longer for future-dated or data-heavy reports.
    async function waitForReportHtml(path, maxWaitMs = 30000) {
        const start = Date.now()
        let attempt = 0
        while (Date.now() - start < maxWaitMs) {
            try {
                return await apiGetHtml(path)
            } catch (err) {
                if (err.status !== 404) throw err
                attempt++
                await sleep(Math.min(500 + attempt * 500, 3000)) // 0.5s, 1s, 1.5s, ... capped at 3s
            }
        }
        throw new Error(`Timed out waiting for ${path}`)
    }

    // ============================================================
    // SUPABASE STORAGE
    // ============================================================
    // Lists every object under a prefix (paginated, 1000 per page). Supabase
    // storage list is non-recursive, so each prefix must be listed separately.
    // Returns a Set of full storage paths (prefix + name).
    async function listBucketFiles(prefix = '') {
        const existing = new Set()
        const pageSize = 1000
        let offset = 0
        while (true) {
            const page = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
                    headers: {
                        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                        apikey: SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        prefix,
                        limit: pageSize,
                        offset,
                        sortBy: { column: 'name', order: 'asc' }
                    }),
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            try {
                                resolve(JSON.parse(res.responseText))
                            } catch (e) {
                                reject(new Error(`Bad list JSON: ${e.message}`))
                            }
                        } else {
                            reject(new Error(`List ${res.status}: ${res.responseText}`))
                        }
                    },
                    onerror: reject
                })
            })
            if (!Array.isArray(page) || page.length === 0) break
            for (const obj of page) if (obj && obj.name) existing.add(`${prefix}${obj.name}`)
            if (page.length < pageSize) break
            offset += pageSize
        }
        return existing
    }

    function uploadToSupabase(html, filename) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`,
                headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                    apikey: SUPABASE_SERVICE_KEY,
                    'Content-Type': 'text/html',
                    'x-upsert': 'true',
                    'cache-control': 'no-cache'
                },
                data: html,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) resolve(res)
                    else reject(new Error(`Supabase ${res.status}: ${res.responseText}`))
                },
                onerror: reject
            })
        })
    }

    // ============================================================
    // SYNC FLOW
    // ============================================================
    function isoDate(d) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    // Rolling window of dates a report should re-pull every cycle. Today is
    // always included; `daysAhead` extends the window into the future.
    function getRollingDatesForReport(report) {
        const dates = []
        const today = new Date()
        const daysAhead = Number.isFinite(report.daysAhead) ? report.daysAhead : 0
        for (let i = 0; i <= daysAhead; i++) {
            const d = new Date(today)
            d.setDate(today.getDate() + i)
            dates.push(isoDate(d))
        }
        return dates
    }

    // Every date from Jan 1 of the current year through today, inclusive.
    function getCurrentYearDatesThroughToday() {
        const dates = []
        const today = new Date()
        const year = today.getFullYear()
        const cursor = new Date(year, 0, 1)
        const end = new Date(year, today.getMonth(), today.getDate())
        while (cursor <= end) {
            dates.push(isoDate(cursor))
            cursor.setDate(cursor.getDate() + 1)
        }
        return dates
    }

    // A task is the unit of sync work: one report for one date (and one plant
    // when the report is per-plant). buildBody/storagePath are wired here so
    // the runner doesn't need to know report shapes.
    function buildTasksForDate(report, date) {
        if (report.perPlant) {
            return PLANT_IDS.map((plantId) => ({
                report,
                date,
                plantId,
                storagePath: report.storagePath(date, plantId),
                label: `${report.name} ${date} plant ${plantId}`
            }))
        }
        return [
            {
                report,
                date,
                plantId: null,
                storagePath: report.storagePath(date),
                label: `${report.name} ${date}`
            }
        ]
    }

    // Runs one task end-to-end: POST the report request, poll until the
    // rendered HTML is on the dispatch server, then upload it to Supabase.
    async function syncTask(task) {
        const { report, date, plantId, storagePath, label } = task
        const body = report.perPlant ? report.buildBody(date, plantId) : report.buildBody(date)

        const genRes = await apiPost('/api/v1/reports/custom', body)
        const reqId = genRes && genRes.data && genRes.data[0] && genRes.data[0].ReportRequestId
        if (!reqId) throw new Error(`No ReportRequestId in response for ${label}`)

        const html = await waitForReportHtml(`/static/reports/${report.reportId}_${reqId}.html`, 30000)
        if (!html || html.length < 500) throw new Error(`HTML suspiciously small for ${label}: ${html && html.length}`)

        await uploadToSupabase(html, storagePath)
        log(`  uploaded ${storagePath} (${html.length} bytes)`)
    }

    // Builds backfill tasks for every (report, date[, plant]) combination
    // missing from storage for the current year through today. Each report's
    // own rolling window is excluded so we don't double-process today/future
    // dates the rolling pass already covers.
    async function buildBackfillTasks(rollingByReport) {
        const tasks = []
        const yearDates = getCurrentYearDatesThroughToday()
        for (const report of REPORTS) {
            let existing
            try {
                existing = await listBucketFiles(report.storagePrefix)
            } catch (err) {
                log(`Backfill list failed for ${report.name}, skipping: ${err.message}`)
                continue
            }
            const rollingSet = rollingByReport.get(report) || new Set()
            for (const date of yearDates) {
                if (rollingSet.has(date)) continue
                for (const task of buildTasksForDate(report, date)) {
                    if (!existing.has(task.storagePath)) tasks.push(task)
                }
            }
        }
        return tasks
    }

    async function runSync() {
        if (syncing) {
            log('Already syncing, skipping tick')
            return
        }
        if (!seatToken) {
            log('Waiting for seat_token to be captured from the UI...')
            updateBadge('waiting')
            return
        }
        syncing = true

        // Each report has its own rolling window — DailyOrder pulls today + 7
        // future days every cycle, DetailOrderAnalysis pulls only today.
        const rollingByReport = new Map()
        const rollingTasks = []
        for (const report of REPORTS) {
            const rollingDates = getRollingDatesForReport(report)
            rollingByReport.set(report, new Set(rollingDates))
            for (const date of rollingDates) rollingTasks.push(...buildTasksForDate(report, date))
        }
        const backfillTasks = await buildBackfillTasks(rollingByReport)
        if (backfillTasks.length > 0) {
            log(`Backfill: ${backfillTasks.length} missing file(s) for current year`)
        }

        const tasks = [...rollingTasks, ...backfillTasks]
        const results = { ok: 0, fail: 0, total: tasks.length }
        updateBadge('syncing', `0/${results.total}`)

        // Worker-pool execution. Each worker pulls the next task from a
        // shared cursor and runs syncTask end-to-end. The dispatch server
        // tolerates several concurrent report generations, and crucially
        // the polling wait inside one task no longer blocks the next.
        let cursor = 0
        const runWorker = async () => {
            while (true) {
                const idx = cursor++
                if (idx >= tasks.length) return
                const task = tasks[idx]
                try {
                    await syncTask(task)
                    results.ok++
                } catch (err) {
                    log(`  FAILED ${task.label}:`, err.message)
                    results.fail++
                }
                updateBadge('syncing', `${results.ok + results.fail}/${results.total}`)
            }
        }
        const workerCount = Math.min(WORKER_CONCURRENCY, tasks.length)
        await Promise.all(Array.from({ length: workerCount }, runWorker))

        if (results.fail === 0) {
            lastSync = new Date()
            log(`Batch OK: ${results.ok}/${results.total} files synced at ${lastSync.toISOString()}`)
            updateBadge('ok')
        } else if (results.ok > 0) {
            lastSync = new Date()
            log(`Partial: ${results.ok} ok, ${results.fail} failed`)
            updateBadge('partial', `${results.ok}/${results.total}`)
        } else {
            log('Batch failed entirely')
            updateBadge('error', 'All files failed')
        }

        syncing = false
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
      max-width: 300px;
    `
        document.body.appendChild(badge)
    }

    function updateBadge(state, detail) {
        ensureBadge()
        if (!badge) return
        const ts = lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
        const baseTitle = document.title.replace(/^\[SYNC.*?\]\s*/, '')
        if (state === 'syncing') {
            badge.style.background = '#555'
            badge.textContent = `SYNC ${detail || ''} | last ok ${ts}`
        } else if (state === 'waiting') {
            badge.style.background = '#666'
            badge.textContent = `SYNC waiting for token...`
        } else if (state === 'ok') {
            badge.style.background = '#2d7a2d'
            badge.textContent = `SYNC OK ${ts}`
            document.title = `[SYNC OK ${ts}] ${baseTitle}`
        } else if (state === 'partial') {
            badge.style.background = '#b87a00'
            badge.textContent = `SYNC PARTIAL ${detail || ''} | ${ts}`
            document.title = `[SYNC PARTIAL] ${baseTitle}`
        } else if (state === 'error') {
            badge.style.background = '#a33'
            badge.textContent = `SYNC FAIL | last ok ${ts}`
            document.title = `[SYNC FAIL] ${baseTitle}`
            if (detail) badge.title = detail
        }
    }

    // ============================================================
    // KICKOFF
    // ============================================================
    log(`Smyrna Dispatch Sync v2.6.0 loaded - ${WORKER_CONCURRENCY} parallel workers, DailyOrder (today + 7) + DetailOrderAnalysis (today only), plus current-year backfill`)
    setTimeout(() => {
        updateBadge('waiting')
        setTimeout(runSync, 10000) // first run after 10s (gives UI time to make a call so we capture token)
        setInterval(runSync, INTERVAL_MS)
    }, 1000)
})()
