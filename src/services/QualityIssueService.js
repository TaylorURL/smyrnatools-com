import APIUtility from '../utils/APIUtility'
import { UserService } from './UserService'

const SERVICE_PREFIX = '/quality-issues-service'
const PERMISSION = 'reports.qc_strength'

async function post(action, payload = {}) {
    const { res, json } = await APIUtility.post(`${SERVICE_PREFIX}/${action}`, payload)
    if (!res?.ok) throw new Error(json?.error || `Quality-issues request failed: ${action}`)
    return json
}

async function requireUser() {
    const user = await UserService.getCurrentUser()
    if (!user?.id) throw new Error('User not authenticated')
    return user
}

/** Quality Issues — active QC disputes plus closed/resolved issues with the
 *  financial cost incurred to close them. Read/write surface for the new
 *  Reports → Quality Issues tab. */
export class QualityIssueService {
    /** Returns true when the current user has permission to open this tab. */
    static async checkPermission() {
        try {
            const user = await UserService.getCurrentUser()
            if (!user?.id) return false
            return await UserService.hasPermission(user.id, PERMISSION).catch(() => false)
        } catch {
            return false
        }
    }

    /** List issues, optionally narrowed by region/status/plant. */
    static async list({ regionCode = null, status = null, plantCode = null } = {}) {
        const json = await post('list', { plantCode, regionCode, status })
        return json?.data ?? []
    }

    static async fetchById(id) {
        if (!id) return null
        const json = await post('fetch-by-id', { id })
        return json?.data ?? null
    }

    static async fetchHistory(issueId) {
        if (!issueId) return []
        const json = await post('fetch-history', { issueId })
        return json?.data ?? []
    }

    static async fetchComments(issueId) {
        if (!issueId) return []
        const json = await post('fetch-comments', { issueId })
        return json?.data ?? []
    }

    /** Create a new quality issue. Caller passes the working draft; status
     *  defaults to "active" when omitted. */
    static async create(issue) {
        const user = await requireUser()
        const json = await post('create', { ...issue, userId: user.id })
        return json?.data ?? null
    }

    /** Patch any subset of fields on an existing issue. Diffs are recorded
     *  in `quality_issues_history` server-side. */
    static async update(id, patch) {
        if (!id) throw new Error('Issue ID is required')
        const user = await requireUser()
        const json = await post('update', { ...patch, id, userId: user.id })
        return json?.data ?? null
    }

    /** Delete an issue (cascades to history + comments). */
    static async remove(id) {
        if (!id) throw new Error('Issue ID is required')
        await post('delete', { id })
        return true
    }

    static async addComment(issueId, body) {
        if (!issueId) throw new Error('Issue ID is required')
        const user = await requireUser()
        const json = await post('add-comment', { body, issueId, userId: user.id })
        return json?.data ?? null
    }
}

export default QualityIssueService
