// ==UserScript==
// @name         Smyrna Dayforce Sync
// @namespace    smyrna-tools
// @version      1.4.0
// @description  Syncs Houston RMX_TX_* timesheet bundles + raw clock punches from Dayforce (wkdus261) to Supabase every 5 minutes. Captures the session GUID + CSRF token from the live UI's own traffic, calls the same internal endpoints the timesheet view calls (ObfuscatingTimesheet/GetManagerTimesheetLoadBundle, EmployeeSelfService/TimeAndAttendance/GetManagerEmployeeRawPunches), POSTs structured JSON to the dayforce-import edge function which decodes and upserts. Manual triggers under window.dayforceSync. On session expiry navigates to the Dayforce IdP (dfid.dayforcehcm.com) and auto-submits stored credentials — fully unattended re-login. Falls back to silent-reload + banner if credentials aren't stored or MFA is enforced. On first install (or any time the GM-stored completed-year flag is older than the current year) the script runs a one-shot YTD backfill: weekly slices from Jan 1 of the current year → today, gap-checked against Supabase so existing data isn't re-fetched, resumable across reloads, throttled at 1s/week so Dayforce doesn't 429.
// @match        https://wkdus261.dayforcehcm.com/*
// @match        https://dfid.dayforcehcm.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @connect      wkdus261.dayforcehcm.com
// @connect      dfid.dayforcehcm.com
// @connect      db.smyrnatools.com
// @run-at       document-start
// ==/UserScript==

;(function () {
    'use strict'

    // ============================================================
    // CROSS-DOMAIN AUTO-LOGIN HANDLER
    //
    // The userscript matches both wkdus261 (the Dayforce app) and dfid
    // (the Dayforce OIDC IdP). On wkdus261 the existing sync logic runs.
    // On dfid we run a focused handler that:
    //   1. Detects the login form (resilient to field-name variants)
    //   2. Fills it from credentials stored via GM_setValue
    //   3. Clicks submit, letting the OIDC chain redirect back to
    //      wkdus261 with a fresh authorization code → fresh session GUID
    //
    // The wkdus261 sync code already calls window.location.reload() on
    // session expiry. The server 302s the reload to dfid, this handler
    // fires, credentials submit, IdP 302s back to wkdus261 with a new
    // code, /MyDayforce/oidc/signin issues a fresh session GUID, and the
    // existing capture interceptor catches it — sync resumes automatically.
    //
    // Failure cases handled:
    //   - No stored credentials: handler logs + bails (script falls back
    //     to the existing banner flow on the wkdus261 side)
    //   - MFA prompt detected: handler bails (no programmatic bypass)
    //   - Bad credentials: page reloads showing an error; the handler
    //     detects the error on the next load, increments an attempts
    //     counter in sessionStorage, and refuses to keep retrying once
    //     it hits MAX_ATTEMPTS — prevents infinite redirect loops
    //   - Login form populated already: handler assumes a human is
    //     working and skips auto-fill
    //
    // Credentials live in Tampermonkey's GM_setValue store (browser-local,
    // userscript-scoped). Set once via window.dayforceSync.setCredentials
    // on the app tab. Treat the credential pair like the Supabase service
    // key that's already in this file — same trust boundary.
    //
    // CSS selectors are best-effort. If the IdP's actual form uses
    // unexpected field names, capture a fresh HAR of the login page and
    // adjust findField().
    // ============================================================
    function runLoginPageHandler() {
        const ATTEMPT_KEY = 'dayforce-auto-login-attempts'
        const MAX_ATTEMPTS = 3
        const NAMESPACE = 'srm360'

        const log = (...args) => console.log('[Dayforce Auto-Login]', ...args)
        const warn = (...args) => console.warn('[Dayforce Auto-Login]', ...args)

        const readAttempts = () => {
            try {
                return Number(sessionStorage.getItem(ATTEMPT_KEY) || '0')
            } catch {
                return 0
            }
        }
        const writeAttempts = (n) => {
            try {
                sessionStorage.setItem(ATTEMPT_KEY, String(n))
            } catch {
                // ignore — without sessionStorage the counter resets each load
            }
        }

        const findField = (kind) => {
            if (kind === 'username') {
                return (
                    document.querySelector('input[name="Username"]') ||
                    document.querySelector('input[name="username"]') ||
                    document.querySelector('input[autocomplete="username"]') ||
                    document.querySelector('input[type="email"]') ||
                    document.querySelector('input[id*="user" i]:not([type="password"]):not([type="hidden"])') ||
                    document.querySelector('input[id*="email" i]')
                )
            }
            if (kind === 'password') {
                return (
                    document.querySelector('input[name="Password"]') ||
                    document.querySelector('input[name="password"]') ||
                    document.querySelector('input[autocomplete="current-password"]') ||
                    document.querySelector('input[type="password"]')
                )
            }
            if (kind === 'namespace') {
                return (
                    document.querySelector('input[name="Namespace"]') ||
                    document.querySelector('input[name="ClientName"]') ||
                    document.querySelector('input[name="clientName"]') ||
                    document.querySelector('input[id*="namespace" i]') ||
                    document.querySelector('input[id*="company" i]')
                )
            }
            if (kind === 'submit') {
                const form = document.querySelector('form')
                const inForm =
                    form &&
                    (form.querySelector('button[type="submit"]') ||
                        form.querySelector('input[type="submit"]') ||
                        form.querySelector('button:not([type="button"])'))
                return (
                    inForm ||
                    document.querySelector('button[type="submit"]') ||
                    document.querySelector('input[type="submit"]')
                )
            }
            return null
        }

        // React/Vue/Angular bind input values via their own descriptors —
        // assigning .value directly does NOT notify them. Use the native
        // setter + dispatch input/change so framework-bound state flushes
        // before we click submit.
        const setNativeValue = (input, value) => {
            const proto = window.HTMLInputElement.prototype
            const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
            if (valueSetter) valueSetter.call(input, value)
            else input.value = value
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
        }

        const detectMfa = () => {
            const text = (document.body?.innerText || '').toLowerCase()
            if (
                text.includes('verification code') ||
                text.includes('authenticator') ||
                text.includes('two-factor') ||
                text.includes('two factor') ||
                text.includes('multi-factor')
            ) {
                return true
            }
            return (
                !!document.querySelector('input[autocomplete*="one-time"]') ||
                !!document.querySelector('input[name*="otp" i]') ||
                !!document.querySelector('input[name="Code"][type="text"]')
            )
        }

        const detectLoginError = () => {
            const candidates = document.querySelectorAll(
                '.validation-summary-errors, .field-validation-error, [class*="error" i]:not(input):not(form):not(label), [role="alert"]'
            )
            for (const node of candidates) {
                const text = (node.innerText || '').trim().toLowerCase()
                if (
                    text.length > 0 &&
                    text.length < 300 &&
                    (text.includes('incorrect') ||
                        text.includes('invalid') ||
                        text.includes('locked') ||
                        text.includes('failed') ||
                        text.includes('try again') ||
                        text.includes('does not match'))
                ) {
                    return text
                }
            }
            return null
        }

        const waitForDom = () =>
            new Promise((resolve) => {
                if (document.readyState !== 'loading') resolve()
                else document.addEventListener('DOMContentLoaded', resolve, { once: true })
            })

        ;(async () => {
            log('Running on', window.location.href)
            await waitForDom()
            // SPA-rendered forms (if Dayforce ever changes the IdP shell)
            // need a tick to mount — server-rendered forms aren't affected.
            await new Promise((r) => setTimeout(r, 500))

            if (detectMfa()) {
                warn('MFA prompt detected — no programmatic bypass. Manual completion required.')
                return
            }

            const previousError = detectLoginError()
            if (previousError) {
                const next = readAttempts() + 1
                writeAttempts(next)
                warn(`Login error detected (attempt ${next}/${MAX_ATTEMPTS}): ${previousError}`)
                return
            }

            if (readAttempts() >= MAX_ATTEMPTS) {
                warn(
                    `Halted — ${MAX_ATTEMPTS} failed attempts this tab session. Update credentials via dayforceSync.setCredentials and reload to retry.`
                )
                return
            }

            const username =
                typeof GM_getValue === 'function' ? GM_getValue('dayforce_username', '') || '' : ''
            const password =
                typeof GM_getValue === 'function' ? GM_getValue('dayforce_password', '') || '' : ''
            if (!username || !password) {
                warn(
                    'No stored credentials. On the Dayforce app tab run window.dayforceSync.setCredentials("<user>", "<pass>") once to enable unattended re-login.'
                )
                return
            }

            const usernameInput = findField('username')
            const passwordInput = findField('password')
            const submitBtn = findField('submit')
            if (!usernameInput || !passwordInput || !submitBtn) {
                warn('Could not locate login form fields', {
                    password: !!passwordInput,
                    submit: !!submitBtn,
                    username: !!usernameInput
                })
                return
            }

            if (usernameInput.value.trim() || passwordInput.value.trim()) {
                log('Form already populated — assuming a human is logging in. Skipping.')
                return
            }

            const namespaceInput = findField('namespace')
            if (namespaceInput && !namespaceInput.value.trim()) {
                setNativeValue(namespaceInput, NAMESPACE)
            }
            setNativeValue(usernameInput, username)
            setNativeValue(passwordInput, password)
            log('Submitting credentials')

            // Brief delay so framework input bindings flush before submit.
            setTimeout(() => {
                try {
                    submitBtn.click()
                } catch (e) {
                    warn('Submit click failed:', e?.message || e)
                }
            }, 150)
        })()
    }

    if (window.location.hostname === 'dfid.dayforcehcm.com') {
        runLoginPageHandler()
        return
    }
    if (window.location.hostname !== 'wkdus261.dayforcehcm.com') return

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

    // Heartbeat cadence. Dayforce's idle timeout is 90 minutes (sliding —
    // resets on any authenticated request). The 5-minute sync cycle already
    // resets it indirectly, but a dedicated heartbeat at a shorter cadence
    // is cheap insurance against a missed cycle. 2.5 min matches the
    // typical pattern for inactivity keep-alives and stays well under the
    // page's own 5-min KeepAlive interval observed in the HAR.
    const HEARTBEAT_INTERVAL_MS = 2.5 * 60 * 1000

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
    // BACKFILL CONFIG
    //
    // The live cycle only fetches the current pay week. On first install
    // (or when the GM-stored completed-year flag is older than the current
    // year) the script also runs a one-shot YTD backfill: weekly slices
    // from Jan 1 of current year → today, gap-checked against Supabase so
    // we don't re-fetch weeks already imported. Resumable across reloads
    // via BACKFILL_GM_KEY_LAST_WEEK so an interrupted run picks up where
    // it left off. The edge function already dedupes, so overlap is safe.
    // ============================================================
    const BACKFILL_GM_KEY_COMPLETED_YEAR = 'dayforce_backfill_completed_year'
    const BACKFILL_GM_KEY_LAST_WEEK = 'dayforce_backfill_last_week_iso'
    const BACKFILL_THROTTLE_MS = 1000

    // ============================================================
    // STATE
    //
    // syncState is the source of truth:
    //   'idle'             — ready to run, no cycle in flight
    //   'syncing'          — a live 5-min cycle is actively running
    //   'backfilling'      — the YTD backfill is iterating historical weeks
    //   'paused-window'    — outside sync window; reserved for future throttling
    //   'session-expired'  — server rejected our auth; recovery in progress
    //   'recovering'       — transitioning back to idle (fresh GUID captured)
    //
    // currentRunToken bumps on every cycle start AND on every state transition
    // out of 'syncing' / 'backfilling'. Workers inside a cycle compare their
    // captured token against currentRunToken after each await — if it changed,
    // they bail cleanly without trying to cancel in-flight GM_xmlhttpRequests.
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
        // Any transition out of an in-flight cycle (live or backfill) bumps
        // the run token so workers still awaiting will bail on their next
        // checkpoint without trying to cancel pending GM_xmlhttpRequests.
        if (prev === 'syncing' || prev === 'backfilling') currentRunToken++
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

    // Direct Supabase REST query for gap detection during backfill. Uses
    // the same service-role key as postToImport (RLS is bypassed by the
    // service role). Returns parsed JSON or throws — callers gate on the
    // throw and fall back to a full YTD backfill if the REST endpoint is
    // unreachable.
    function supabaseRestGet(path) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${SUPABASE_URL}/rest/v1/${path}`,
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                    apikey: SUPABASE_SERVICE_KEY
                },
                timeout: 30000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText))
                        } catch (e) {
                            reject(new Error(`Bad JSON from REST ${path}: ${e.message}`))
                        }
                    } else {
                        reject(new Error(`REST ${path} returned ${res.status}: ${(res.responseText || '').slice(0, 200)}`))
                    }
                },
                onerror: (err) => reject(new Error(`REST network error: ${err?.error || 'unknown'}`)),
                ontimeout: () => reject(new Error('REST timeout'))
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

    // ============================================================
    // SESSION HEARTBEAT
    //
    // Dayforce's server-side idle timeout is 90 minutes; the page itself
    // pings /Framework/Timeout/SendHeartbeat (and /KeepAlive) every 5 min
    // to keep that timer reset. We do the same here so the session never
    // dies from inactivity — independent of the 5-min sync cycle, so a
    // missed cycle (e.g. throttled by an outside-window guard, or a slow
    // backfill week) doesn't leave the session unprotected.
    //
    // Also dispatches a synthetic mousemove on document so any client-side
    // idle detector on the page (Dayforce's UI sometimes shows its own
    // "still there?" modal independent of the server timer) stays quiet.
    //
    // Heartbeat failures are deliberately silent — the next sync cycle or
    // heartbeat will surface any real problem, and if the session actually
    // died the existing handleSessionExpired path is already triggered by
    // dayforcePost's error handling.
    // ============================================================
    async function sendHeartbeat() {
        if (!sessionGuid) return
        if (syncState === 'session-expired' || syncState === 'recovering') return

        try {
            document.dispatchEvent(
                new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: Math.floor(Math.random() * (window.innerWidth || 800)),
                    clientY: Math.floor(Math.random() * (window.innerHeight || 600))
                })
            )
        } catch {
            // non-essential — the API ping is the load-bearing part
        }

        try {
            await dayforcePost('/Framework/Timeout/SendHeartbeat', {})
        } catch (err) {
            if (err?.sessionExpired) return
            // Quiet on transient failures — they're non-fatal and noise
            // here would flood the console every 2.5 min.
        }
    }

    // ============================================================
    // PER-WEEK FETCH HELPERS
    //
    // Shared between the live 5-min cycle (current week) and the YTD
    // backfill (each historical week). They preserve the same fan-out
    // concurrency, cancellation token plumbing, and session-expiry
    // propagation as the original inline implementation — extracted so
    // backfill doesn't duplicate ~100 lines of worker logic.
    // ============================================================
    async function pullTimesheetsForWeek({ isCancelled = () => false, onProgress, periodEnd, periodStart }) {
        const employeeIds = new Set()
        const timesheetSlices = []
        let count = 0
        let orgCursor = 0
        const worker = async () => {
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
                    count++
                } catch (err) {
                    if (err?.sessionExpired) throw err
                    log(`  TS fail ${org.label}: ${err.message}`)
                }
                if (onProgress) onProgress({ count, total: RMX_ORG_UNITS.length })
            }
        }
        await Promise.all(
            Array.from({ length: Math.min(WORKER_CONCURRENCY, RMX_ORG_UNITS.length) }, worker)
        )
        return { count, employeeIds: Array.from(employeeIds), timesheetSlices }
    }

    async function pullPunchesForRange({ employeeIdList, isCancelled = () => false, onProgress, periodEnd, periodStart }) {
        const punchSlices = []
        let empCursor = 0
        const worker = async () => {
            while (true) {
                if (isCancelled()) return
                const idx = empCursor++
                if (idx >= employeeIdList.length) return
                const eid = employeeIdList[idx]
                try {
                    const res = await dayforcePost(
                        '/EmployeeSelfService/TimeAndAttendance/GetManagerEmployeeRawPunches',
                        buildRawPunchBody(eid, periodStart, periodEnd)
                    )
                    if (isCancelled()) return
                    const punches = res?.Result
                    if (Array.isArray(punches) && punches.length > 0) {
                        punchSlices.push({ employeeId: eid, punches })
                    }
                } catch (err) {
                    if (err?.sessionExpired) throw err
                    log(`  Punch fail ${eid}: ${err.message}`)
                }
                if (onProgress && ((idx + 1) % 25 === 0 || idx + 1 === employeeIdList.length)) {
                    onProgress({ count: idx + 1, total: employeeIdList.length })
                }
            }
        }
        await Promise.all(
            Array.from({ length: Math.min(WORKER_CONCURRENCY, employeeIdList.length) }, worker)
        )
        return { punchSlices }
    }

    // Punches POST'd in chunks to keep request bodies under the edge
    // function payload ceiling. 50 employees * ~5 punches each is well
    // under 1 MB; the edge function dedupes across chunks.
    async function postPunchesInChunks(punchSlices, isCancelled = () => false) {
        const CHUNK = 50
        let total = 0
        for (let i = 0; i < punchSlices.length; i += CHUNK) {
            if (isCancelled()) return total
            const chunk = punchSlices.slice(i, i + CHUNK)
            const punchRes = await postToImport({ rawPunches: chunk })
            if (punchRes.ok) total += punchRes.body?.stats?.punches ?? 0
            else log(`Punch import chunk failed: ${punchRes.error}`)
        }
        return total
    }

    // One sync cycle:
    //   1. Refresh org units (cheap, once per cycle)
    //   2. For every RMX org × current week: pull timesheet bundle
    //   3. For every employee surfaced in step 2: pull last 9 days of
    //      raw punches (covers the current + prior week so a Sunday-edited
    //      Saturday punch still lands)
    //   4. POST each slice to the import edge function as soon as it's ready
    async function runSync() {
        if (syncState === 'syncing' || syncState === 'backfilling') {
            log(`Skipping tick — already ${syncState}`)
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

            // -------- 2. Timesheets for current week --------
            const { end: weekEnd, start: weekStart } = getPayWeekRange(new Date())
            const periodStart = toDayforceDateString(weekStart)
            const periodEnd = toDayforceDateString(weekEnd)
            log(`Cycle: ${periodStart.slice(0, 10)} -> ${periodEnd.slice(0, 10)} across ${RMX_ORG_UNITS.length} orgs`)

            const ts = await pullTimesheetsForWeek({
                isCancelled,
                onProgress: ({ count, total }) => updateBadge('syncing', `ts ${count}/${total}`),
                periodEnd,
                periodStart
            })
            if (isCancelled()) return
            results.timesheets = ts.count

            if (ts.timesheetSlices.length > 0) {
                const tsRes = await postToImport({ timesheets: ts.timesheetSlices })
                if (tsRes.ok) {
                    results.employees = tsRes.body?.stats?.employees ?? 0
                    results.shifts = tsRes.body?.stats?.shifts ?? 0
                    log(`Timesheets imported: ${ts.count} bundles -> ${results.employees} employees, ${results.shifts} shifts`)
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
            log(`Pulling raw punches for ${ts.employeeIds.length} employees`)

            const { punchSlices } = await pullPunchesForRange({
                employeeIdList: ts.employeeIds,
                isCancelled,
                onProgress: ({ count, total }) => updateBadge('syncing', `punches ${count}/${total}`),
                periodEnd: punchEndStr,
                periodStart: punchStartStr
            })
            if (isCancelled()) return

            results.punches = await postPunchesInChunks(punchSlices, isCancelled)
            log(`Raw punches imported: ${results.punches}`)

            lastSync = new Date()
            const elapsed = Math.round((Date.now() - cycleStart) / 1000)
            log(
                `Cycle done in ${elapsed}s — ${results.timesheets} TS bundles, ${results.employees} employees, ${results.shifts} shifts, ${results.punches} punches`
            )
            updateBadge('ok')

            // First-successful-cycle hook: trigger the one-time YTD backfill
            // if it hasn't completed for the current year yet. Gated by a
            // GM-stored year flag so it runs once per year regardless of
            // how many times the userscript reloads.
            maybeKickBackfill()
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
    // YTD BACKFILL
    //
    // Loops Sunday-start weekly ranges from the earliest gap → current
    // week, using the same Dayforce endpoints as the live cycle but
    // scoped per week. Throttled at BACKFILL_THROTTLE_MS between weeks
    // so the Dayforce gateway doesn't 429. Resumable via the GM-stored
    // last-week-iso flag — an interrupted run picks up where it left off.
    // On completion (all weeks succeeded) the completed-year flag is set
    // and the last-week marker is cleared.
    // ============================================================
    let backfillKickAttempted = false

    function maybeKickBackfill() {
        if (backfillKickAttempted) return
        backfillKickAttempted = true
        const currentYear = new Date().getFullYear()
        const completedYear = Number(GM_getValue(BACKFILL_GM_KEY_COMPLETED_YEAR, 0)) || 0
        if (completedYear >= currentYear) return
        log(`First sync OK — kicking one-time ${currentYear} YTD backfill in 5s`)
        setTimeout(() => {
            runBackfill().catch((e) => log(`Backfill kick error: ${e.message}`))
        }, 5000)
    }

    async function findBackfillStartDate(yearStart) {
        // Check the EARLIEST existing shift_date. If it's at or before
        // Jan 1 of the current year, the historical period is already
        // covered and we skip. Otherwise we backfill the full year from
        // Jan 1 → today — the edge function dedupes any weeks that are
        // already imported (cheap, no DB writes), so we never worry about
        // overlap. Per-week gap detection isn't worth the complexity:
        // re-pulling a fully-imported week is just a handful of Dayforce
        // API calls the edge function discards.
        //
        // Returns null to signal "no backfill needed" — callers should
        // mark the year complete and exit cleanly.
        try {
            const shifts = await supabaseRestGet(
                'dayforce_shifts?select=shift_date&order=shift_date.asc&limit=1'
            )
            if (Array.isArray(shifts) && shifts.length > 0 && shifts[0].shift_date) {
                const earliest = new Date(shifts[0].shift_date)
                earliest.setHours(0, 0, 0, 0)
                if (earliest <= yearStart) {
                    log(
                        `Backfill gap check: earliest shift ${shifts[0].shift_date} <= ${yearStart.toISOString().slice(0, 10)} — year already covered, skipping`
                    )
                    return null
                }
                log(
                    `Backfill gap check: earliest shift ${shifts[0].shift_date} > Jan 1 — backfilling full YTD (edge function dedupes overlap)`
                )
                return yearStart
            }
            log('Backfill gap check: no existing shifts — full YTD backfill')
            return yearStart
        } catch (e) {
            log(`Backfill gap check failed (falling back to full YTD): ${e.message}`)
            return yearStart
        }
    }

    async function runBackfill({ force = false } = {}) {
        if (syncState === 'syncing' || syncState === 'backfilling') {
            log(`Backfill: already ${syncState}, skipping`)
            return
        }
        if (syncState === 'session-expired' || syncState === 'recovering') {
            log('Backfill: session expired — auto-login will resume things, retry afterwards')
            return
        }
        if (!sessionGuid) {
            log('Backfill: no session GUID yet — let the live sync capture one first')
            return
        }

        setSyncState('backfilling')
        const startedAt = Date.now()
        const myRunToken = ++currentRunToken
        const isCancelled = () => myRunToken !== currentRunToken

        try {
            const currentYear = new Date().getFullYear()
            const yearStart = new Date(currentYear, 0, 1)

            let backfillFrom = force ? yearStart : await findBackfillStartDate(yearStart)
            if (backfillFrom === null) {
                // Gap check returned null — year is already covered. Mark
                // complete and exit so we don't re-kick on every reload.
                log('Backfill: year already covered, marking complete')
                GM_setValue(BACKFILL_GM_KEY_COMPLETED_YEAR, currentYear)
                GM_deleteValue(BACKFILL_GM_KEY_LAST_WEEK)
                updateBadge('ok')
                return
            }

            // Resume from last completed week if we have one and the user
            // didn't force a full restart. This handles tab reloads, session
            // expiries mid-backfill, and re-installs of the userscript.
            if (!force) {
                const lastWeekIso = GM_getValue(BACKFILL_GM_KEY_LAST_WEEK, null)
                if (lastWeekIso) {
                    const lastWeek = new Date(lastWeekIso)
                    if (lastWeek > backfillFrom) {
                        log(`Backfill: resuming from last completed week ${lastWeek.toISOString().slice(0, 10)}`)
                        // Start at the week AFTER the last completed one.
                        const next = new Date(lastWeek)
                        next.setDate(next.getDate() + 7)
                        backfillFrom = next
                    }
                }
            }

            const todayWeek = getPayWeekRange(new Date()).start
            const weeks = []
            let cursor = getPayWeekRange(backfillFrom).start
            while (cursor < todayWeek) {
                weeks.push(new Date(cursor))
                cursor = new Date(cursor)
                cursor.setDate(cursor.getDate() + 7)
            }

            if (weeks.length === 0) {
                log('Backfill: no historical weeks missing — data is current')
                GM_setValue(BACKFILL_GM_KEY_COMPLETED_YEAR, currentYear)
                GM_deleteValue(BACKFILL_GM_KEY_LAST_WEEK)
                updateBadge('ok')
                return
            }

            log(
                `Backfill: ${weeks.length} weeks from ${weeks[0].toISOString().slice(0, 10)} -> ${weeks[weeks.length - 1].toISOString().slice(0, 10)}`
            )

            const totals = { employees: 0, punches: 0, shifts: 0, timesheets: 0, weeks: 0 }

            for (let i = 0; i < weeks.length; i++) {
                if (isCancelled()) {
                    log('Backfill: cancelled mid-run')
                    break
                }
                const weekStart = weeks[i]
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 7)
                const periodStart = toDayforceDateString(weekStart)
                const periodEnd = toDayforceDateString(weekEnd)
                const label = `${i + 1}/${weeks.length} ${weekStart.toISOString().slice(0, 10)}`

                updateBadge('backfill', `wk ${label}`)

                try {
                    const ts = await pullTimesheetsForWeek({
                        isCancelled,
                        onProgress: ({ count, total }) =>
                            updateBadge('backfill', `wk ${label} ts ${count}/${total}`),
                        periodEnd,
                        periodStart
                    })
                    if (isCancelled()) break

                    let employees = 0
                    let shifts = 0
                    if (ts.timesheetSlices.length > 0) {
                        const tsRes = await postToImport({ timesheets: ts.timesheetSlices })
                        if (tsRes.ok) {
                            employees = tsRes.body?.stats?.employees ?? 0
                            shifts = tsRes.body?.stats?.shifts ?? 0
                        } else {
                            log(`  Backfill TS import failed: ${tsRes.error}`)
                        }
                    }

                    const { punchSlices } = await pullPunchesForRange({
                        employeeIdList: ts.employeeIds,
                        isCancelled,
                        onProgress: ({ count, total }) =>
                            updateBadge('backfill', `wk ${label} punches ${count}/${total}`),
                        periodEnd,
                        periodStart
                    })
                    if (isCancelled()) break

                    const punches = await postPunchesInChunks(punchSlices, isCancelled)

                    totals.weeks++
                    totals.timesheets += ts.count
                    totals.employees += employees
                    totals.shifts += shifts
                    totals.punches += punches

                    log(
                        `Backfill ${label}: ${ts.count} TS bundles, ${employees} employees, ${shifts} shifts, ${punches} punches`
                    )

                    // Persist progress after each successful week so a
                    // mid-backfill reload/expiry resumes cleanly.
                    GM_setValue(BACKFILL_GM_KEY_LAST_WEEK, weekStart.toISOString())
                } catch (err) {
                    if (err?.sessionExpired) {
                        log('Backfill: session expired mid-week — pausing. Auto-login will recover; retry via dayforceSync.backfillYear()')
                        return
                    }
                    log(`Backfill ${label} failed: ${err.message}`)
                }

                // Throttle between weeks so Dayforce doesn't 429.
                if (i < weeks.length - 1 && !isCancelled()) await sleep(BACKFILL_THROTTLE_MS)
            }

            const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
            log(
                `Backfill complete in ${elapsedSec}s — ${totals.weeks}/${weeks.length} weeks, ${totals.timesheets} TS bundles, ${totals.employees} employees, ${totals.shifts} shifts, ${totals.punches} punches`
            )

            if (totals.weeks === weeks.length) {
                GM_setValue(BACKFILL_GM_KEY_COMPLETED_YEAR, currentYear)
                GM_deleteValue(BACKFILL_GM_KEY_LAST_WEEK)
            }
            updateBadge('ok')
        } catch (err) {
            log(`Backfill error: ${err.message}`)
            updateBadge('error', err.message)
        } finally {
            if (syncState === 'backfilling') setSyncState('idle')
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
        } else if (state === 'backfill') {
            badge.style.background = '#5a4a8a'
            badge.textContent = `DAYFORCE BACKFILL ${detail || ''}`
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
    const autoLoginEnabled =
        typeof GM_getValue === 'function' &&
        !!(GM_getValue('dayforce_username', '') && GM_getValue('dayforce_password', ''))
    const backfillCompletedYear = Number(GM_getValue(BACKFILL_GM_KEY_COMPLETED_YEAR, 0)) || 0
    const backfillPending = backfillCompletedYear < new Date().getFullYear()
    log(
        `Smyrna Dayforce Sync v1.4.0 loaded — host ${DAYFORCE_HOST}, ${WORKER_CONCURRENCY} parallel workers, ${RMX_ORG_UNITS.length} RMX orgs. Auto-login: ${autoLoginEnabled ? 'ENABLED' : 'DISABLED — run dayforceSync.setCredentials(user, pass)'}. YTD backfill: ${backfillPending ? 'PENDING (will kick after first live sync)' : `COMPLETED for ${backfillCompletedYear}`}. Heartbeat: every ${Math.round(HEARTBEAT_INTERVAL_MS / 1000)}s. Manual triggers under window.dayforceSync`
    )

    setTimeout(() => {
        updateBadge('waiting')
        // First run after 10s — gives the UI time to fire requests so we
        // capture the session GUID + CSRF token.
        setTimeout(runSync, 10000)
        setInterval(runSync, INTERVAL_MS)
        // Heartbeat starts after a short delay so the initial session
        // capture happens first. Runs continuously thereafter to keep the
        // Dayforce idle timer reset regardless of sync cadence.
        setTimeout(sendHeartbeat, 30000)
        setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
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
        },
        // ============================================================
        // CREDENTIAL MANAGEMENT — unattended re-login
        //
        // setCredentials persists the Dayforce username + password to
        // Tampermonkey's GM_setValue store (browser-local, userscript-
        // scoped). When the wkdus261 session dies the existing reload
        // sends the tab to the dfid IdP, and the cross-domain handler at
        // the top of this script auto-fills + submits the form. The OIDC
        // redirect chain then lands back on wkdus261 with a fresh GUID
        // and the sync resumes — zero human involvement.
        //
        // Recommend using a dedicated low-privilege service account so a
        // credential leak isn't your primary user. MFA on the account
        // breaks the unattended flow (no programmatic bypass exists).
        // ============================================================
        setCredentials(username, password) {
            if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
                log('Manual: setCredentials("<username>", "<password>") — both args required as non-empty strings')
                return false
            }
            GM_setValue('dayforce_username', username)
            GM_setValue('dayforce_password', password)
            log('Manual: credentials stored. Auto-login enabled — the next session expiry will recover without human action.')
            return true
        },
        clearCredentials() {
            GM_deleteValue('dayforce_username')
            GM_deleteValue('dayforce_password')
            log('Manual: credentials cleared. Auto-login disabled — falling back to silent-reload + banner flow.')
        },
        hasCredentials() {
            return !!(GM_getValue('dayforce_username', '') && GM_getValue('dayforce_password', ''))
        },
        // ============================================================
        // YTD BACKFILL TRIGGERS
        //
        // backfillYear() — manually start (or resume) the year-to-date
        // backfill. Pass { force: true } to ignore the gap check and the
        // resume marker and re-pull every week from Jan 1.
        //
        // resetBackfillProgress() — clears the GM-stored completed-year
        // flag + last-completed-week marker so the next live sync re-kicks
        // the backfill from scratch. Useful after a manual data wipe or
        // when investigating data gaps.
        // ============================================================
        backfillYear(opts) {
            const force = !!(opts && opts.force === true)
            log(`Manual: starting YTD backfill${force ? ' (forced full pull)' : ''}`)
            return runBackfill({ force })
        },
        resetBackfillProgress() {
            GM_deleteValue(BACKFILL_GM_KEY_COMPLETED_YEAR)
            GM_deleteValue(BACKFILL_GM_KEY_LAST_WEEK)
            backfillKickAttempted = false
            log('Manual: backfill progress flags cleared — next live sync will re-kick the YTD backfill')
        },
        backfillStatus() {
            const snap = {
                completedYear: Number(GM_getValue(BACKFILL_GM_KEY_COMPLETED_YEAR, 0)) || 0,
                kickAttempted: backfillKickAttempted,
                lastCompletedWeek: GM_getValue(BACKFILL_GM_KEY_LAST_WEEK, null),
                state: syncState
            }
            log('Manual: backfill status', snap)
            return snap
        },
        // Manual heartbeat — verifies the keep-alive endpoint is reachable
        // with the captured session. Useful for confirming the session is
        // still alive without waiting for the next 2.5-min interval.
        pingHeartbeat() {
            log('Manual: sending heartbeat now')
            return sendHeartbeat()
        }
    }
    log('Manual triggers ready — call dayforceSync.runNow() from devtools to test')
})()
