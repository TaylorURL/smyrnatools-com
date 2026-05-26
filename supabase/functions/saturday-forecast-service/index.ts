// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

/**
 * Saturday Operator Forecast edge function.
 *
 * Pre-bloom skeleton — the `edge-fn-and-migration` Nexus fills in every
 * action body during Phase 1. The route table here is the contract the
 * frontend service is coded against.
 */

const FORECASTS_TABLE = 'saturday_operator_forecasts'
const PLANTS_TABLE = 'plants'

function getAdminClient(): any {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
}

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    const body = await parseBody(req)
    const supabase = getAdminClient()
    const auth = await requireAuthenticated(supabase, req, headers, body)
    if (auth instanceof Response) return auth
    const userId = auth as string

    const pathname = new URL(req.url).pathname
    const action = pathname.split('/').filter(Boolean).pop() || body?.action || ''

    try {
        switch (action) {
            case 'fetch-pending-for-user':
                return jsonResponse(
                    { pendingPlants: [], saturdayDate: '', submittedPlants: [], success: true, weekIso: '' },
                    headers
                )
            case 'fetch-for-week':
                return jsonResponse({ forecastsByPlant: {}, success: true }, headers)
            case 'submit-forecast':
                return jsonResponse({ forecast: null, success: true }, headers)
            case 'submit-bulk':
                return jsonResponse({ savedCount: 0, success: true }, headers)
            default:
                return errorResponse(`Unknown action: ${action}`, headers, 400)
        }
    } catch (err: any) {
        return errorResponse(err?.message || 'Internal error', headers, 500)
    } finally {
        // Suppress unused-variable warnings in the stub; the bloom Nexus
        // consumes both of these.
        void userId
        void FORECASTS_TABLE
        void PLANTS_TABLE
    }
})
