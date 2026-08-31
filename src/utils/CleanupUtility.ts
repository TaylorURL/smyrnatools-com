import { UserService } from '../services/UserService'
import { hasNoOperator } from './BaseAssetUtility'
import ValidationUtility from './ValidationUtility'
import VerifiedUtility from './VerifiedUtility'

/** A fleet record as the sweeps read it. The named fields are the ones these
 *  checks look at; the index signature carries the rest of the row, whose
 *  columns differ from one asset type to the next. */
interface FleetItem {
    [column: string]: unknown
    assignedOperator?: string | number | null
    equipmentMake?: string
    equipmentModel?: string
    id: string
    make?: string
    model?: string
    status?: string
    tractorMake?: string
    tractorModel?: string
    tractorYear?: string | number
    trailerMake?: string
    trailerModel?: string
    trailerYear?: string | number
    truckNumber?: string
    truck_number?: string
    updatedAt: string
    updatedBy?: string | null
    updatedLast?: string | null
    vin?: string
    year?: string | number
    yearMade?: string | number
}

/** Roster entry an asset's assigned operator is matched against. */
interface RosterOperator {
    employeeId: string
}

/** Writes one asset's changes through the caller's own service, crediting the
 *  acting user. */
type UpdateItemFn = (id: string, updates: Record<string, unknown>, userId: string) => Promise<unknown>

/** Reads make, model, or year off an asset regardless of which asset type it is.
 *  Each type names these columns after itself, so the completeness checks below
 *  have to try every spelling before calling a field missing. */
function getFieldValue(item: FleetItem, fieldType: 'make' | 'model' | 'year') {
    switch (fieldType) {
        case 'make':
            return item.make || item.equipmentMake || item.tractorMake || item.trailerMake
        case 'model':
            return item.model || item.equipmentModel || item.tractorModel || item.trailerModel
        case 'year':
            return item.year || item.yearMade || item.tractorYear || item.trailerYear
        default:
            return null
    }
}

/**
 * Data-integrity sweeps over a fleet list. Both entries here find records whose
 * stored state contradicts the rules the rest of the app assumes, and repair
 * them through the caller's own update function, so the writes go through the
 * normal service path and are recorded in history like any other edit.
 *
 * Failures are absorbed per record: each sweep reports how many of the records
 * it identified were actually fixed, and one rejected update never abandons the
 * rest.
 */
class CleanupUtility {
    /** Clears the "0" placeholder some rows carry in place of a real operator.
     *  An Active asset with no operator is not a valid state, so those are
     *  dropped to Spare in the same write. */
    static async cleanupNullOperators(
        items: FleetItem[] | null,
        updateItemFn: UpdateItemFn,
        getAllItemsFn: (() => Promise<FleetItem[]>) | null = null
    ) {
        const allItems = items || (getAllItemsFn ? await getAllItemsFn() : [])
        const itemsWithNullOperators = allItems.filter(
            (item) => item.assignedOperator === '0' || item.assignedOperator === 0
        )
        if (itemsWithNullOperators.length === 0) {
            return { fixed: 0, total: 0 }
        }
        const user = await UserService.getCurrentUser()
        const userId = user?.id || user
        if (!userId) {
            return {
                error: 'No user ID available',
                fixed: 0,
                total: itemsWithNullOperators.length
            }
        }
        const results = await Promise.allSettled(
            itemsWithNullOperators.map((item) =>
                updateItemFn(
                    item.id,
                    {
                        assignedOperator: null,
                        ...(item.status === 'Active' && { status: 'Spare' })
                    },
                    userId
                )
            )
        )
        const fixed = results.filter((r) => r.status === 'fulfilled').length
        return {
            fixed,
            total: itemsWithNullOperators.length
        }
    }
    /** Revokes verification from assets that are verified but no longer satisfy
     *  the requirements for it. Verification is expressed as a recent
     *  `updatedLast`, so it is revoked by backdating that stamp a week, which
     *  puts the asset outside every "verified this week" window without needing
     *  a separate flag. Assets that were not verified to begin with are left
     *  alone. */
    static async verificationCheck(
        items: FleetItem[] | null,
        updateItemFn: UpdateItemFn,
        assetType = 'mixer',
        operators: RosterOperator[] = []
    ) {
        if (!items || items.length === 0) {
            return { fixed: 0, invalidItems: [], total: 0 }
        }
        const user = await UserService.getCurrentUser()
        const userId = user?.id || user
        if (!userId) {
            return {
                error: 'No user ID available',
                fixed: 0,
                invalidItems: [],
                total: 0
            }
        }
        const invalidItems = items.filter((item) => {
            if (!VerifiedUtility.isVerified(item.updatedLast, item.updatedAt, item.updatedBy)) {
                return false
            }
            return CleanupUtility._getVerificationIssues(item, assetType, operators).length > 0
        })
        if (invalidItems.length === 0) {
            return { fixed: 0, invalidItems: [], total: 0 }
        }
        const results = await Promise.allSettled(
            invalidItems.map((item) => {
                const oneWeekAgo = new Date()
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
                return updateItemFn(
                    item.id,
                    {
                        updatedLast: oneWeekAgo.toISOString()
                    },
                    userId
                )
            })
        )
        const fixed = results.filter((r) => r.status === 'fulfilled').length
        return {
            fixed,
            invalidItems: invalidItems.map((item) => ({
                id: item.id,
                issues: CleanupUtility._getVerificationIssues(item, assetType, operators),
                number: item.truckNumber || item.truck_number || 'Unknown'
            })),
            total: invalidItems.length
        }
    }
    /** Everything disqualifying an asset from being verified, as display-ready
     *  strings. The rules vary by type: equipment has no VIN to validate, and
     *  only mixers and tractors require an operator, which must also still exist
     *  in the roster the caller passes in. An empty list means the asset may
     *  hold its verification. */
    static _getVerificationIssues(item: FleetItem, assetType: string, operators: RosterOperator[] = []) {
        const issues = []
        if (item.status === 'Retired') {
            issues.push('Retired assets cannot be verified')
        }
        if (assetType !== 'equipment') {
            const hasValidVIN = item.vin && ValidationUtility.isVIN(item.vin)
            if (!hasValidVIN) {
                issues.push('Invalid or missing VIN')
            }
        }
        if (!getFieldValue(item, 'make')) {
            issues.push('Missing Make')
        }
        if (!getFieldValue(item, 'model')) {
            issues.push('Missing Model')
        }
        if (!getFieldValue(item, 'year')) {
            issues.push('Missing Year')
        }
        if ((assetType === 'mixer' || assetType === 'tractor') && item.status === 'Active') {
            if (hasNoOperator(item)) {
                issues.push(`Missing or invalid operator for active ${assetType}`)
            } else if (operators && operators.length > 0) {
                const operatorExists = operators.some((op) => op.employeeId === item.assignedOperator)
                if (!operatorExists) {
                    issues.push('Assigned operator does not exist')
                }
            }
        }
        return issues
    }
}
export default CleanupUtility
