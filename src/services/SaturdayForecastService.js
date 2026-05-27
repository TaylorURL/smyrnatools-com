import APIUtility from '../utils/APIUtility'

const SERVICE_PREFIX = 'saturday-forecast-service'

/**
 * Frontend access layer for the Saturday Operator Forecast feature.
 *
 * Every method round-trips through the `saturday-forecast-service` edge
 * function, which runs `requireAuthenticated` and enforces that the
 * caller is in `plants.manager_user_ids` for any plant they touch.
 *
 * NOTE: This is the pre-bloom contract stub. Nexus `service-and-hooks`
 * fills in the bodies during Phase 1. The method signatures and
 * response shapes are fixed by the API contract at
 * `.infinity/saturday-operator-forecast/api-contract.md`.
 */
class SaturdayForecastServiceImpl {
    /** Returns the upcoming-Saturday context for the authenticated user:
     *  which plants they manage that still need a forecast (`pendingPlants`)
     *  and which they've already submitted (`submittedPlants`).
     *  @returns {Promise<{ weekIso: string, saturdayDate: string, pendingPlants: Array, submittedPlants: Array }>} */
    async fetchPendingForUser() {
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-pending-for-user`, {})
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to fetch pending forecasts')
        return {
            pendingPlants: Array.isArray(json.pendingPlants) ? json.pendingPlants : [],
            saturdayDate: json.saturdayDate || '',
            submittedPlants: Array.isArray(json.submittedPlants) ? json.submittedPlants : [],
            weekIso: json.weekIso || ''
        }
    }

    /** Fetches all forecasts for a given Saturday, optionally narrowed by plant codes.
     *  @param {string} saturdayDate YYYY-MM-DD
     *  @param {string[]} [plantCodes] optional plant scope
     *  @returns {Promise<Record<string, { operatorCount: number, submittedAt: string, submittedByUserId: string, submittedByName: string | null }>>} */
    async fetchForWeek(saturdayDate, plantCodes) {
        if (!saturdayDate) throw new Error('saturdayDate is required')
        const payload = { saturdayDate }
        if (Array.isArray(plantCodes) && plantCodes.length > 0) payload.plantCodes = plantCodes
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/fetch-for-week`, payload)
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to fetch week forecasts')
        return json.forecastsByPlant && typeof json.forecastsByPlant === 'object' ? json.forecastsByPlant : {}
    }

    /** Inserts or upserts a single forecast.
     *  @returns {Promise<{ plantCode: string, saturdayDate: string, operatorCount: number, submittedAt: string }>} */
    async submitForecast(plantCode, saturdayDate, operatorCount) {
        if (!plantCode) throw new Error('plantCode is required')
        if (!saturdayDate) throw new Error('saturdayDate is required')
        const count = Number(operatorCount)
        if (!Number.isFinite(count) || count < 0) throw new Error('operatorCount must be a non-negative number')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/submit-forecast`, {
            operatorCount: count,
            plantCode,
            saturdayDate
        })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to submit forecast')
        return json.forecast
    }

    /** Atomic bulk submit. All entries land or none do — used by the
     *  Dashboard modal so a partial save doesn't leave the manager with
     *  half-filled state. */
    async submitBulk(saturdayDate, entries) {
        if (!saturdayDate) throw new Error('saturdayDate is required')
        if (!Array.isArray(entries) || entries.length === 0) throw new Error('entries must be a non-empty array')
        const { res, json } = await APIUtility.post(`/${SERVICE_PREFIX}/submit-bulk`, { entries, saturdayDate })
        if (!res.ok || json?.success !== true) throw new Error(json?.error || 'Failed to submit forecasts')
        return Number(json.savedCount) || 0
    }
}

export const SaturdayForecastService = new SaturdayForecastServiceImpl()
