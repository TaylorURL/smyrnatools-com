import { createClient } from '@supabase/supabase-js'

import { SESSION_STORAGE_KEYS } from '../app/constants/auth'
import APIUtility from '../utils/APIUtility'

const databaseUrl = process.env.REACT_APP_SUPABASE_URL
const databaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

/** Reads the current session JWT from sessionStorage, or null if not signed
 *  in / not yet minted. We never throw here — pre-login the JWT is absent
 *  and supabase-js falls back to the anon key. */
const readSessionJwt = () => {
    try {
        return sessionStorage.getItem(SESSION_STORAGE_KEYS.JWT) || null
    } catch {
        return null
    }
}

/** Wraps `fetch` so every Supabase REST + Storage request swaps the anon-key
 *  bearer for the current session JWT. The `apikey` header stays — Supabase's
 *  edge router needs it to identify the project — but the `Authorization`
 *  header carries the JWT, which is what PostgREST evaluates RLS against.
 *
 *  Reading the JWT on every request (rather than at client construction)
 *  keeps the client in lockstep with login / logout / token refresh without
 *  ever having to reconstruct it. */
const sessionJwtFetch = (input, init = {}) => {
    const jwt = readSessionJwt()
    if (!jwt) return fetch(input, init)
    const mergedHeaders = new Headers(init.headers || {})
    if (input instanceof Request) {
        const requestHeaders = new Headers(input.headers)
        requestHeaders.forEach((value, key) => {
            if (!mergedHeaders.has(key)) mergedHeaders.set(key, value)
        })
    }
    mergedHeaders.set('Authorization', `Bearer ${jwt}`)
    return fetch(input, { ...init, headers: mergedHeaders })
}

/** Shared database client instance. The fetch wrapper above injects the
 *  current session JWT into REST + Storage requests; realtime subscriptions
 *  use `Database.realtime.setAuth(jwt)` (called from AuthContext after
 *  login / refresh / signout). */
const Database = createClient(databaseUrl, databaseKey, {
    global: { fetch: sessionJwtFetch },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

/** Updates the realtime websocket auth token. Call after login or token
 *  refresh so postgres_changes subscriptions evaluate RLS against the
 *  authenticated JWT instead of the anon key. Pass `null` after signout. */
export const setDatabaseAuth = (jwt) => {
    try {
        Database.realtime.setAuth(jwt || databaseKey)
    } catch {}
}
export default Database
/** Prefer named import: `import { Database } from './DatabaseService'` */
export { Database }
/** Base URL for constructing edge function endpoints. */
export { databaseUrl }
/** Anonymous API key for authenticating edge function requests. */
export { databaseKey }
/** Allowlisted tables for sanitized database operations to prevent injection. */
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
    'list_items',
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
    'reports',
    'notifications',
    'notification_reads',
    'documents',
    'client_errors',
    'messages',
    'messages_decrypted',
    'users_pinned_conversations'
])
/** Allowlisted SQL migrations that can be executed via the migration endpoint. */
const ALLOWED_MIGRATIONS = new Set(['alter table public.operators add column if not exists phone text'])
/** Validates and sanitizes a table name against the allowlist. Returns null if disallowed. */
const sanitizeTableName = (tableName) => {
    if (!tableName || typeof tableName !== 'string') return null
    const cleaned = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '')
    return ALLOWED_TABLES.has(cleaned) ? cleaned : null
}
/** Strips non-alphanumeric/underscore characters from a column name to prevent injection. */
const sanitizeColumnName = (columnName) => {
    if (!columnName || typeof columnName !== 'string') return null
    return columnName.replace(/[^a-zA-Z0-9_]/g, '')
}
/** Escapes SQL LIKE pattern special characters (%, _, \) in user input. */
const sanitizeLikePattern = (input) => {
    if (!input || typeof input !== 'string') return ''
    return input.trim().replace(/[%_\\]/g, (char) => '\\' + char)
}
/**
 * Provides controlled database operations (migrations, existence checks, record retrieval)
 * through the edge function API, enforcing table/migration allowlists.
 */
export class DatabaseService {
    /** Executes a pre-approved SQL migration via the edge function. */
    static async executeMigration(sql) {
        const normalizedSql = sql.toLowerCase().trim()
        if (!ALLOWED_MIGRATIONS.has(normalizedSql)) {
            throw new Error('Migration not allowed')
        }
        const { res, json } = await APIUtility.post('/database-service/execute-migration', { migration: normalizedSql })
        if (!res.ok) throw new Error(json?.error || 'Failed to execute migration')
        return json?.data ?? []
    }
    /** Checks if a table exists in the database. */
    static async tableExists(tableName) {
        const sanitized = sanitizeTableName(tableName)
        if (!sanitized) throw new Error('Invalid or disallowed table name')
        const { res, json } = await APIUtility.post('/database-service/table-exists', { tableName: sanitized })
        if (!res.ok) return false
        return json?.exists === true
    }
    /** Fetches all records from an allowlisted table. */
    static async getAllRecords(tableName) {
        const sanitized = sanitizeTableName(tableName)
        if (!sanitized) throw new Error('Invalid or disallowed table name')
        const { res, json } = await APIUtility.post('/database-service/get-all-records', { tableName: sanitized })
        if (!res.ok) return []
        return json?.data ?? []
    }
}
/** Formats a database error into a human-readable string with details, hint, and code. */
export const getDatabaseErrorDetails = (error) => {
    if (!error) return 'Unknown error'
    if (error.message) {
        if (error.details || error.hint || error.code) {
            return `${error.message}\nDetails: ${error.details || 'none'}\nHint: ${error.hint || 'none'}\nCode: ${error.code || 'none'}`
        }
        return error.message
    }
    try {
        return JSON.stringify(error)
    } catch {
        return 'Error object could not be stringified'
    }
}
/** Logs a database error with context label and full details to the console. */
export const logDatabaseError = (context, error) => {
    console.error(`Database error in ${context}:`, error)
    console.error('Details:', getDatabaseErrorDetails(error))
}
/** Converts a date value to ISO string format for database queries. Returns null on invalid input. */
export const formatDateForDatabase = (date) => {
    if (!date) return null
    if (date instanceof Date) return date.toISOString()
    try {
        const d = new Date(date)
        return isNaN(d.getTime()) ? null : d.toISOString()
    } catch {
        return null
    }
}
/** Validates that the database is properly configured with real (non-placeholder) credentials. */
export const isDatabaseConfigured = (client) => {
    if (!client) return false
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) return false
    if (!client.supabaseUrl || client.supabaseUrl.includes('example.supabase.co')) return false
    if (!client.supabaseKey || client.supabaseKey === 'your-public-anon-key') return false
    return true
}
/** Extracts an error message from a database response, or null if no error. */
export const extractDatabaseErrorMessage = (response) => {
    if (!response) return 'Empty response received'
    return response.error ? getDatabaseErrorDetails(response.error) : null
}
/** Builds a case-insensitive partial text filter object for ILIKE queries. */
export const createPartialTextFilter = (column, searchTerm) => {
    const sanitizedColumn = sanitizeColumnName(column)
    if (!searchTerm?.trim() || !sanitizedColumn) return {}
    const sanitizedTerm = sanitizeLikePattern(searchTerm)
    return { [sanitizedColumn]: { ilike: `%${sanitizedTerm}%` } }
}
/**
 * Low-level CRUD operations against allowlisted tables via the database-service edge function.
 * All table and column names are sanitized before being sent to the API.
 */
export const DatabaseUtils = {
    /** Fetches records from an allowlisted table filtered by a column/value pair. */
    async fetch(table, columns = '*', filterColumn, value) {
        const sanitizedTable = sanitizeTableName(table)
        const sanitizedColumn = sanitizeColumnName(filterColumn)
        if (!sanitizedTable) throw new Error('Invalid or disallowed table name')
        if (!sanitizedColumn || value === undefined) throw new Error('Filter column and value are required')
        const { res, json } = await APIUtility.post('/database-service/fetch', {
            columns,
            filterColumn: sanitizedColumn,
            table: sanitizedTable,
            value
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch')
        return json?.data ?? []
    },
    /** Fetches all records from an allowlisted table, ordered by ID. */
    async fetchAll(table, columns = '*') {
        const sanitizedTable = sanitizeTableName(table)
        if (!sanitizedTable) throw new Error('Invalid or disallowed table name')
        const { res, json } = await APIUtility.post('/database-service/fetch-all', {
            columns,
            orderBy: 'id',
            table: sanitizedTable
        })
        if (!res.ok) throw new Error(json?.error || 'Failed to fetch all')
        return json?.data ?? []
    }
}
