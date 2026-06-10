// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.45.4' // @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

// Form template CRUD for the download-only Maintenance library. The legacy
// submission / review / equipment-log endpoints were retired when the client
// pipeline was removed; historical rows remain in their tables untouched.
const FORMS_TABLE = 'maintenance_forms'
const FIELDS_TABLE = 'maintenance_form_fields'
const FORM_WITH_FIELDS_SELECT = '*, maintenance_form_fields(*)'

function createSupabaseClient() {
    return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
        auth: { autoRefreshToken: false, persistSession: false }
    })
}

async function parseBody(req: Request): Promise<any> {
    try {
        return await req.json()
    } catch {
        return {}
    }
}

function nowISO(): string {
    return new Date().toISOString()
}

function buildFieldRows(fields: any[], formId: string): any[] {
    const timestamp = nowISO()
    return fields.map((field: any, index: number) => ({
        created_at: timestamp,
        description: field.description || null,
        field_order: index,
        field_type: field.field_type,
        form_id: formId,
        image_required: field.image_required || false,
        is_required: field.is_required || false,
        label: field.label,
        options: field.options || null,
        updated_at: timestamp
    }))
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)
    try {
        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()

        const auth = await requireAuthenticated(null, req, headers)
        if (auth instanceof Response) return auth

        const supabase = createSupabaseClient()

        switch (endpoint) {
            case 'create-form': {
                const body = await parseBody(req)
                const userId = body?.userId
                if (!userId) return errorResponse('User ID is required', headers, 400)
                const { fields, plant_codes, ...formInfo } = body.formData || {}
                const timestamp = nowISO()
                const { data: form, error: formError } = await supabase
                    .from(FORMS_TABLE)
                    .insert({
                        ...formInfo,
                        created_at: timestamp,
                        created_by: userId,
                        plant_codes: plant_codes || [],
                        updated_at: timestamp
                    })
                    .select()
                    .single()
                if (formError) return errorResponse('Failed to create form', headers, 400)
                if (fields?.length) {
                    const { error: fieldsError } = await supabase
                        .from(FIELDS_TABLE)
                        .insert(buildFieldRows(fields, form.id))
                    if (fieldsError) return errorResponse('Failed to insert fields', headers, 400)
                }
                const { data: fullForm } = await supabase
                    .from(FORMS_TABLE)
                    .select(FORM_WITH_FIELDS_SELECT)
                    .eq('id', form.id)
                    .single()
                return jsonResponse({ data: fullForm, success: true }, headers)
            }
            case 'update-form': {
                const body = await parseBody(req)
                const formId = body?.formId
                if (!formId) return errorResponse('Form ID is required', headers, 400)
                const { fields, plant_codes, ...formInfo } = body.formData || {}
                const { error: formError } = await supabase
                    .from(FORMS_TABLE)
                    .update({ ...formInfo, plant_codes: plant_codes || [], updated_at: nowISO() })
                    .eq('id', formId)
                if (formError) return errorResponse('Failed to update form', headers, 400)
                if (fields) {
                    await supabase.from(FIELDS_TABLE).delete().eq('form_id', formId)
                    if (fields.length) {
                        const { error: fieldsError } = await supabase
                            .from(FIELDS_TABLE)
                            .insert(buildFieldRows(fields, formId))
                        if (fieldsError) return errorResponse('Failed to insert fields', headers, 400)
                    }
                }
                const { data: fullForm } = await supabase
                    .from(FORMS_TABLE)
                    .select(FORM_WITH_FIELDS_SELECT)
                    .eq('id', formId)
                    .single()
                return jsonResponse({ data: fullForm, success: true }, headers)
            }
            case 'delete-form': {
                const body = await parseBody(req)
                const formId = body?.formId
                if (!formId) return errorResponse('Form ID is required', headers, 400)
                const { error } = await supabase
                    .from(FORMS_TABLE)
                    .update({ is_active: false, updated_at: nowISO() })
                    .eq('id', formId)
                if (error) return errorResponse('Failed to delete form', headers, 400)
                return jsonResponse({ success: true }, headers)
            }

            default:
                return errorResponse('Invalid endpoint', headers, 404, { path: url.pathname })
        }
    } catch (error) {
        return errorResponse('Internal server error', headers, 500)
    }
})
