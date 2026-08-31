import { Operator } from '../app/models/operators/Operator'
import { OperatorHistory } from '../app/models/operators/OperatorHistory'
import {
    apiPost,
    apiPostOrThrow,
    apiPostRequireSuccess,
    fetchAllCountsFromTable,
    fetchStatusHistoryMap,
    filterByRegionCodes,
    getDuplicateFieldValues
} from '../utils/BaseAssetUtility'
import ValidationUtility from '../utils/ValidationUtility'
import { Database } from './DatabaseService'
import { MixerService } from './MixerService'
import { TractorService } from './TractorService'

const SERVICE_PREFIX = '/operator-service'
/**
 * The caller-facing boundary over the `operator-service` edge function, which
 * is where authorization lives: a write is refused at the far end unless the
 * session holds asset access for the operator's plant, so nothing here checks.
 *
 * Two read paths exist and are not interchangeable. `getAllOperators` and
 * `getOperatorByEmployeeId` go through the edge function and return `Operator`
 * models; `fetchOperators` and `fetchTrainers` query the tables directly and
 * answer with plain objects carrying extra derived fields.
 */
class OperatorServiceImpl {
    async fetchAllCommentsCounts(operatorIds) {
        return fetchAllCountsFromTable('operators_comments', 'operator_id', operatorIds)
    }
    /** Newest first. */
    async fetchComments(operatorId) {
        ValidationUtility.requireUUID(operatorId, 'Operator ID is required')
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/fetch-comments`,
            { operatorId },
            'Failed to fetch comments'
        )
        return json?.data ?? []
    }
    async addComment(operatorId, text, userId) {
        ValidationUtility.requireUUID(operatorId, 'Operator ID is required')
        if (!text?.trim()) throw new Error('Comment text is required')
        if (!userId) throw new Error('User ID is required')
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/add-comment`,
            { operatorId, text: text.trim(), userId },
            'Failed to add comment'
        )
        return json?.data ?? null
    }
    async deleteComment(commentId) {
        ValidationUtility.requireUUID(commentId, 'Comment ID is required')
        return apiPostRequireSuccess(`${SERVICE_PREFIX}/delete-comment`, { commentId }, 'Failed to delete comment')
    }
    async getAllOperators() {
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/list`, {}, 'Failed to fetch operators')
        return (json?.data ?? []).map((op) => new Operator(op))
    }
    /**
     * Answers null for an employee ID that does not exist, and throws only for
     * one that is not a UUID: a caller looking someone up gets a miss, not an
     * error to handle.
     */
    async getOperatorByEmployeeId(employeeId) {
        if (!employeeId || !ValidationUtility.isUUID(employeeId)) throw new Error('Invalid Employee ID')
        const { res, json } = await apiPost(`${SERVICE_PREFIX}/get-by-employee-id`, { employeeId })
        if (!res.ok) return null
        const data = json?.data ?? null
        if (!data) return null
        data.smyrna_id = data.smyrna_id ?? ''
        return new Operator(data)
    }
    /**
     * An employee ID that is not a UUID is replaced rather than rejected, so a
     * caller cannot choose the identifier a new operator ends up with.
     */
    async createOperator(operator) {
        const op = operator instanceof Operator ? operator : new Operator(operator)
        if (!(await ValidationUtility.isValidUUID(op.employeeId)))
            op.employeeId = await ValidationUtility.generateUUID()
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/create`,
            { operator: op.toApiFormat() },
            'Failed to create operator'
        )
        return new Operator(json?.data)
    }
    /**
     * Moving an operator to another plant frees every Active mixer and tractor
     * they held at the old one, dropping each to Spare. That runs here rather
     * than in a caller so a transfer cannot leave equipment assigned to someone
     * who is no longer on site, whichever screen made the change.
     */
    async updateOperator(operator) {
        if (!operator.employeeId || !ValidationUtility.isUUID(operator.employeeId))
            throw new Error('Invalid Employee ID')
        const op = operator instanceof Operator ? operator : new Operator(operator)
        const update = op.toApiFormat()
        delete update.created_at
        const currentOperator = await this.getOperatorByEmployeeId(operator.employeeId)
        if (currentOperator?.plantCode !== op.plantCode) {
            const [assignedMixers, assignedTractors] = await Promise.all([
                MixerService.getMixersByOperator(operator.employeeId),
                TractorService.getTractorsByOperator(operator.employeeId)
            ])
            const mixerUpdates = assignedMixers
                .filter((mixer) => mixer.status === 'Active')
                .map((mixer) =>
                    MixerService.updateMixer(mixer.id, { ...mixer, assignedOperator: null, status: 'Spare' })
                )
            const tractorUpdates = assignedTractors
                .filter((tractor) => tractor.status === 'Active')
                .map((tractor) =>
                    TractorService.updateTractor(tractor.id, { ...tractor, assignedOperator: null, status: 'Spare' })
                )
            await Promise.all([...mixerUpdates, ...tractorUpdates])
        }
        const json = await apiPostOrThrow(`${SERVICE_PREFIX}/update`, { operator: update }, 'Failed to update operator')
        return new Operator(json?.data)
    }
    async deleteOperator(employeeId) {
        if (!employeeId || !ValidationUtility.isUUID(employeeId)) throw new Error('Invalid Employee ID')
        return apiPostRequireSuccess(`${SERVICE_PREFIX}/delete`, { employeeId }, 'Operator was not deleted')
    }
    /**
     * Adds `statusChangedAt` from the history table, which the operator row
     * itself does not carry, and falls back to the creation time for an
     * operator whose status has never moved.
     *
     * Answers an empty list on failure rather than throwing, because the views
     * calling it render a table and have nothing to show for an exception.
     */
    async fetchOperators(regionCodes = null) {
        try {
            const { data, error } = await Database.from('operators').select('*')
            if (error) throw error
            const operatorIds = (data || []).map((op) => op.employee_id).filter(Boolean)
            const statusHistoryMap = await fetchStatusHistoryMap('operators_history', 'operator_id', operatorIds)
            const formattedOperators = data.map((op) => {
                const model = new Operator(op)
                return {
                    ...model,
                    phone: model.phone || '',
                    rating: typeof op.rating === 'number' ? op.rating : Number(op.rating) || 0,
                    smyrnaId: model.smyrnaId || '',
                    statusChangedAt: statusHistoryMap[op.employee_id] || op.created_at || null
                }
            })
            return filterByRegionCodes(formattedOperators, regionCodes, 'plantCode')
        } catch (err) {
            console.error('Failed to fetch operators:', err)
            return []
        }
    }
    async fetchTrainers() {
        try {
            const { data, error } = await Database.from('operators').select('employee_id, name').eq('is_trainer', true)
            if (error) throw error
            return data.map((t) => ({ employeeId: t.employee_id, name: t.name }))
        } catch (err) {
            console.error('Failed to fetch trainers:', err)
            return []
        }
    }
    /**
     * Reached through HISTORY_SERVICE_MAP in useHistoryDataFetchers rather than
     * by a direct call, so a search for callers finds none.
     */
    async getOperatorHistory(operatorId, limit = null) {
        const payload = { limit, operatorId }
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/fetch-history`,
            payload,
            'Failed to fetch operator history'
        )
        return (json?.data ?? []).map((entry) => new OperatorHistory(entry))
    }
    /** Case- and whitespace-insensitive, so "Bob Ray " and "bob ray" collide. */
    getDuplicateNames(operators) {
        return getDuplicateFieldValues(operators, (op) => {
            const key = (op?.name || '').trim().toLowerCase()
            return key || null
        })
    }
    async createHistoryEntry(operatorId, fieldName, oldValue, newValue, changedBy) {
        const json = await apiPostOrThrow(
            `${SERVICE_PREFIX}/add-history`,
            {
                changedBy,
                fieldName,
                newValue,
                oldValue,
                operatorId
            },
            'Failed to create history entry'
        )
        return json?.data
    }
}
export const OperatorService = new OperatorServiceImpl()
