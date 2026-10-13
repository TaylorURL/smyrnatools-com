import { createClient } from '@supabase/supabase-js'

import APIUtility from '../utils/APIUtility'
import { ensureFreshJwt, getSessionJwt, refreshRejectedJwt, registerRealtimeAuthApplier } from './SessionService'

const databaseUrl = import.meta.env.REACT_APP_SUPABASE_URL
const databaseKey = import.meta.env.REACT_APP_SUPABASE_ANON_KEY

/** Wraps `fetch` so every Supabase REST + Storage request swaps the anon-key
 *  bearer for the current session JWT. The `apikey` header stays — Supabase's
 *  edge router needs it to identify the project — but the `Authorization`
 *  header carries the JWT, which is what PostgREST evaluates RLS against.
 *
 *  Reading the JWT on every request (rather than at client construction)
 *  keeps the client in lockstep with login / logout / token refresh without
 *  ever having to reconstruct it. The JWT lives in module memory only
 *  (see SessionService), never in sessionStorage.
 *
 *  `ensureFreshJwt` re-mints the token first if it has expired, so a tab
 *  returning from sleep does not spend its first queries on a dead JWT, and a
 *  token the server refuses anyway is replaced and the request replayed — see
 *  `refreshRejectedJwt` for why the clock alone cannot be trusted here. */
const sessionJwtFetch = async (input, init = {}) => {
    const jwt = await ensureFreshJwt()
    if (!jwt) {
        // RLS denies every table to the anon role, so a request made before
        // the session resolves can only come back 401. Synthesizing that
        // response locally keeps the Supabase client's error path intact
        // while sparing the console a burst of failed-request entries during
        // the window where AuthContext is still restoring the session.
        return new Response(JSON.stringify({ code: 'PGRST301', message: 'Not authenticated' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 401,
            statusText: 'Unauthorized'
        })
    }
    const mergedHeaders = new Headers(init.headers || {})
    if (input instanceof Request) {
        const requestHeaders = new Headers(input.headers)
        requestHeaders.forEach((value, key) => {
            if (!mergedHeaders.has(key)) mergedHeaders.set(key, value)
        })
    }
    mergedHeaders.set('Authorization', `Bearer ${jwt}`)
    // Taken before the request goes out: a Request carries its body as a
    // stream, and the first send consumes it, so a replay needs the copy.
    const replayInput = input instanceof Request ? input.clone() : input
    const response = await fetch(input, { ...init, headers: mergedHeaders })
    if (response.status !== 401) return response
    const replacementJwt = await refreshRejectedJwt(jwt)
    if (!replacementJwt || replacementJwt === jwt) return response
    const replayHeaders = new Headers(mergedHeaders)
    replayHeaders.set('Authorization', `Bearer ${replacementJwt}`)
    return fetch(replayInput, { ...init, headers: replayHeaders })
}

/**
 * Shared database client instance.
 *
 * `accessToken` is the credential for everything the client does on its own
 * account, and the realtime socket is why it has to be set. The socket asks
 * the client for a token each time it connects and again on every heartbeat.
 * Left unset, that question is answered by the client's own supplier, which
 * reads a GoTrue session — a session this app never has, since it
 * authenticates through its own auth service — and falls back to the anon key.
 * The answer becomes the socket's credential and is written into every
 * channel's join payload, so a session JWT pushed onto the socket beforehand
 * is replaced by a token RLS grants nothing, and `postgres_changes` joins are
 * refused for as long as the page stays open.
 *
 * Reading the token through `ensureFreshJwt` re-mints an expired one before it
 * reaches a request or a rejoin. The anon key stands in while signed out,
 * because the socket needs some token to present and that one carries no
 * access.
 *
 * The fetch wrapper above sets the `Authorization` header itself rather than
 * leaving it to this callback, since it also has to replay a request the
 * server refuses.
 */
const Database = createClient(databaseUrl, databaseKey, {
    accessToken: async () => (await ensureFreshJwt()) || databaseKey,
    global: { fetch: sessionJwtFetch },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

let channelSequence = 0

// Consecutive failed joins a subscription is allowed before its failure is
// reported. A refused join is retried on a widening backoff, so the first few
// failures are the recovery below still working; the fourth lands about twenty
// seconds in, by which time a re-minted token has had every chance to take.
const REALTIME_FAILURES_BEFORE_REPORT = 4

/**
 * Opens a realtime channel on a topic no other subscriber shares.
 *
 * The topic is how the server keys a subscription on a socket, so two
 * subscribers that name the same one collide: the second join is refused, and
 * the refusal reaches the client as `CHANNEL_ERROR` with no live updates behind
 * it. Two views watching the same table hit this, and so does a single view
 * that resubscribes while its previous channel is still leaving, since the
 * leave is a round trip.
 *
 * Callers pass the name of what they are watching — `mixers-realtime-changes`,
 * say — and get a channel that cannot clash with another subscriber's.
 */
const createRealtimeChannel = (name) => {
    channelSequence += 1
    return Database.channel(`${name}-${channelSequence}`)
}

/**
 * Subscribes `channel` and keeps the credential behind it current.
 *
 * A subscription is authorized by the session JWT `applyRealtimeAuth` pushes
 * onto the socket, and that token is only ever replaced from outside the
 * socket: by the refresh tick, by the visibility probe, or by a REST request
 * coming back 401. None of those watch the channel. So a socket left holding a
 * token the server no longer accepts — a tab whose timers were throttled while
 * its token aged out, a socket reconnecting after sleep — goes on rejoining
 * against that dead token for as long as the page stays open, and the view
 * behind it sits on rows that never change again.
 *
 * A refused join is therefore read the way a refused request is: as the
 * server's word that the token is spent. Re-minting it puts a live token on the
 * socket in time for the rejoin already scheduled, and at most one mint is
 * spent per refused token, so a failure with nothing to do with the credential
 * does not turn into a run of them.
 *
 * `onFailure` receives the reason for a subscription still down after
 * `REALTIME_FAILURES_BEFORE_REPORT` consecutive attempts, once per outage. A
 * subscription that comes back is not a failure; one that does not is worth the
 * reason it gives.
 *
 * `onResubscribe` is called when a channel that had failed joins again, once
 * per outage. A rejoin only resumes the stream; it carries nothing that
 * happened while the channel was down, and the server replays no backlog. So
 * every insert, update and delete inside the gap is gone, and the view goes on
 * rendering the rows it held when the channel dropped — correct-looking, never
 * corrected, and indistinguishable from a fleet that simply has not changed.
 * Recovery is the only moment the client knows it has a hole, and re-reading
 * the list is what closes it.
 */
const subscribeRealtimeChannel = (channel, onFailure, onResubscribe) => {
    let consecutiveFailures = 0
    return channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
            const missedUpdates = consecutiveFailures > 0
            consecutiveFailures = 0
            if (missedUpdates) onResubscribe?.()
            return
        }
        if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return
        consecutiveFailures += 1
        refreshRejectedJwt(getSessionJwt())
        if (consecutiveFailures === REALTIME_FAILURES_BEFORE_REPORT) onFailure?.(error?.message || status)
    })
}

/** Pushes the current JWT (or the anon key when signed out) into the realtime
 *  websocket the moment the session changes, so a channel already joined moves
 *  onto the new token instead of waiting for the next time the socket asks for
 *  one. Registered with SessionService, which calls it on every JWT change —
 *  importing this module is what wires the realtime socket to the session. */
const applyRealtimeAuth = (jwt) => {
    Promise.resolve(Database.realtime.setAuth(jwt || databaseKey)).catch(() => {})
}
registerRealtimeAuthApplier(applyRealtimeAuth)

export default Database
/** Prefer named import: `import { Database } from './DatabaseService'` */
export { Database }
/** Opens a realtime channel whose topic no other subscriber can collide with. */
export { createRealtimeChannel }
/** Subscribes a realtime channel, re-mints the token behind a refused join, and
 *  reports the rejoin that follows an outage so the caller can close the gap. */
export { subscribeRealtimeChannel }
/**
 * Tables the `DatabaseService` static methods may name. The edge function
 * takes the table as data, so this list plus `sanitizeTableName` is what
 * stands between a caller-supplied string and the query. It does not apply to
 * `Database.from(...)`, which RLS governs instead.
 */
const ALLOWED_TABLES = new Set([
    'users',
    'users_preferences',
    'users_presence',
    'users_sessions',
    'mixers',
    'operators',
    'tractors',
    'trailers',
    'equipment',
    'pickup_trucks',
    'plants',
    'regions',
    'mixer_comments',
    'mixer_history',
    'mixer_images',
    'tractor_comments',
    'tractor_history',
    'trailer_comments',
    'equipment_comments',
    'equipment_history',
    'operator_history',
    'pickup_truck_comments',
    'roles',
    'notifications',
    'notification_reads',
    'client_errors',
    'messages',
    'messages_decrypted',
    'users_pinned_conversations'
])
/**
 * Exact migration statements `executeMigration` will run. Matching is on the
 * lowercased, trimmed string, so a statement must appear here character for
 * character to be accepted.
 */
const ALLOWED_MIGRATIONS = new Set(['alter table public.operators add column if not exists phone text'])
/**
 * Strips everything but `[a-z0-9_]` from a lowercased table name, then checks
 * the result against the allowlist. Returns null when it does not match, so a
 * name that only passes after having characters removed is still rejected
 * unless the stripped form is itself allowlisted.
 */
const sanitizeTableName = (tableName) => {
    if (!tableName || typeof tableName !== 'string') return null
    const cleaned = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '')
    return ALLOWED_TABLES.has(cleaned) ? cleaned : null
}
/**
 * Schema-level operations — migrations, existence checks, whole-table reads —
 * routed through the database-service edge function. Every method that names a
 * table or a statement checks it against an allowlist first; these are the
 * only calls in the app that put a caller-chosen identifier into a query.
 */
export class DatabaseService {
    /** Runs one of the `ALLOWED_MIGRATIONS`. Throws for anything else. */
    static async executeMigration(sql) {
        const normalizedSql = sql.toLowerCase().trim()
        if (!ALLOWED_MIGRATIONS.has(normalizedSql)) {
            throw new Error('Migration not allowed')
        }
        const { res, json } = await APIUtility.post('/database-service/execute-migration', { migration: normalizedSql })
        if (!res.ok) throw new Error(json?.error || 'Failed to execute migration')
        return json?.data ?? []
    }
    /** Checks whether an allowlisted table exists. False on any request failure. */
    static async tableExists(tableName) {
        const sanitized = sanitizeTableName(tableName)
        if (!sanitized) throw new Error('Invalid or disallowed table name')
        const { res, json } = await APIUtility.post('/database-service/table-exists', { tableName: sanitized })
        if (!res.ok) return false
        return json?.exists === true
    }
    /** Fetches every row of an allowlisted table. Empty array on request failure. */
    static async getAllRecords(tableName) {
        const sanitized = sanitizeTableName(tableName)
        if (!sanitized) throw new Error('Invalid or disallowed table name')
        const { res, json } = await APIUtility.post('/database-service/get-all-records', { tableName: sanitized })
        if (!res.ok) return []
        return json?.data ?? []
    }
}
