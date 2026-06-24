import { sundayMyClient } from './client'

const BUCKET = 'sunday-files'
const STORAGE_PREFIX = 'smyrnatools-workbook'
// Coupled to "smyrnatools workbook insert" RLS policy on sunday-my — must match the policy's user_id check
const TRENTON_USER_ID = '07a1299d-d63d-4b4c-b862-53ea44a02b1a'
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function sanitizeForPath(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function uploadWorkbookToFiles(blob, filename, { folder = null, source = 'smyrnatools-workbook' } = {}) {
    if (!sundayMyClient) {
        throw new Error('Sunday Files is not configured — set REACT_APP_SUNDAY_MY_SUPABASE_URL and REACT_APP_SUNDAY_MY_SUPABASE_ANON_KEY')
    }

    const datePrefix = new Date().toISOString().slice(0, 10)
    const safeName = sanitizeForPath(filename)
    const storagePath = `${STORAGE_PREFIX}/${datePrefix}/${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await sundayMyClient.storage
        .from(BUCKET)
        .upload(storagePath, blob, { contentType: XLSX_MIME_TYPE, upsert: false })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = sundayMyClient.storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

    const { data: fileRow, error: insertError } = await sundayMyClient
        .from('sunday_files')
        .insert({
            folder,
            mime_type: XLSX_MIME_TYPE,
            name: filename,
            public_url: publicUrl,
            size_bytes: blob.size,
            source,
            storage_path: storagePath,
            user_id: TRENTON_USER_ID,
        })
        .select()
        .single()

    if (insertError) throw new Error(`File record insert failed: ${insertError.message}`)

    return { fileRow, publicUrl }
}
