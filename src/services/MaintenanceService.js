import APIUtility from '../utils/APIUtility'
import { Database } from './DatabaseService'
import { UserService } from './UserService'

const MAINT_FUNCTION = '/maintenance-service'
const PERMISSION_CREATE = 'maintenance.create'
const AUTH_ERROR = 'User not authenticated'
const PERMISSION_DENIED_ERROR = 'Permission denied'
const FORM_WITH_FIELDS_SELECT = '*, maintenance_form_fields(*)'

/** Resolves the current authenticated user or throws if not logged in. */
async function requireAuthenticatedUser() {
    const user = await UserService.getCurrentUser()
    if (!user?.id) throw new Error(AUTH_ERROR)
    return user
}
/** Asserts that a user has a specific permission, throwing on denial. */
async function requirePermission(userId, permission) {
    const hasPermission = await UserService.hasPermission(userId, permission)
    if (!hasPermission) throw new Error(PERMISSION_DENIED_ERROR)
}
/** Posts to the maintenance edge function. */
async function postMaint(endpoint, data) {
    const { res, json } = await APIUtility.post(`${MAINT_FUNCTION}/${endpoint}`, data)
    if (!res.ok) throw new Error(json?.error || 'Operation failed')
    return json
}

/**
 * Maintenance form template service — CRUD for the admin authoring flow and
 * reads for the download-only form library. The legacy submission / review /
 * scanned-upload pipeline was retired: workers now download the PDF, complete
 * it by hand, and keep the finished sheet on file at their plant.
 */
export class MaintenanceService {
    /** Fetches all active maintenance forms, optionally filtered by region, plant, or creator. */
    static async fetchForms(filters = {}) {
        let query = Database.from('maintenance_forms')
            .select(FORM_WITH_FIELDS_SELECT)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
        if (filters.regionCode) query = query.eq('region_code', filters.regionCode)
        if (filters.plantCode) query = query.eq('plant_code', filters.plantCode)
        if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
        const { data, error } = await query
        if (error) throw error
        return data || []
    }
    /** Creates a new maintenance form with field definitions. */
    static async createForm(formData) {
        const user = await requireAuthenticatedUser()
        const result = await postMaint('create-form', { formData, userId: user.id })
        return result.data
    }
    /** Updates a form's metadata and optionally replaces its field definitions. */
    static async updateForm(formId, formData) {
        const user = await requireAuthenticatedUser()
        await requirePermission(user.id, PERMISSION_CREATE)
        const result = await postMaint('update-form', { formData, formId })
        return result.data
    }
    /** Soft-deletes a form by marking it inactive. */
    static async deleteForm(formId) {
        const user = await requireAuthenticatedUser()
        await requirePermission(user.id, PERMISSION_CREATE)
        await postMaint('delete-form', { formId })
        return true
    }
    /** Checks the current user's maintenance form authoring permission. */
    static async checkPermissions() {
        try {
            const user = await UserService.getCurrentUser()
            if (!user?.id) return { canCreate: false }
            const canCreate = await UserService.hasPermission(user.id, PERMISSION_CREATE).catch(() => false)
            return { canCreate }
        } catch (err) {
            console.error('Failed to check maintenance permissions:', err)
            return { canCreate: false }
        }
    }
}
export default MaintenanceService
