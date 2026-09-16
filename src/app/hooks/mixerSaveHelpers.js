import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'
import { UserService } from '../../services/UserService'
import { DateUtility } from '../../utils/DateUtility'
import { ValidationUtility } from '../../utils/ValidationUtility'

/**
 * Keys the save flow reads off `overrideValues` to control how the save runs
 * rather than what it writes. They carry no field data, so they must not make
 * an otherwise empty override map look like a pending edit.
 */
const SAVE_META_KEYS = ['silent', 'prevAssignedOperator']

/** True when `overrideValues` carries at least one real field change. */
export function hasMaterialOverrides(overrideValues) {
    return Object.keys(overrideValues || {}).filter((k) => !SAVE_META_KEYS.includes(k)).length > 0
}

/** Returns the merged value, preferring override if explicitly present. */
function pickOverride(overrideValues, key, fallback) {
    return Object.prototype.hasOwnProperty.call(overrideValues, key) ? overrideValues[key] : fallback
}

/**
 * Applies the business rules that reconcile (operator, status):
 *  - Moving from Active -> non-Active drops the assigned operator
 *  - Any assigned operator forces status back to Active
 *  - No operator + Active falls back to Spare
 */
export function reconcileOperatorAndStatus({ assignedOperatorValue, originalStatus, statusValue }) {
    let nextOperator = assignedOperatorValue
    let nextStatus = statusValue
    if (originalStatus === 'Active' && nextStatus !== 'Active' && nextOperator) nextOperator = null
    if (nextOperator && nextStatus !== 'Active') nextStatus = 'Active'
    if ((!nextOperator || nextOperator === '' || nextOperator === null) && nextStatus === 'Active') nextStatus = 'Spare'
    return { nextOperator, nextStatus }
}

/** An issue counts as open until it is stamped with a completion time. */
export async function hasOpenMaintenanceIssues(mixerId) {
    const issues = await MixerService.fetchIssues(mixerId)
    return Array.isArray(issues) && issues.some((issue) => !issue?.time_completed)
}

function parsePositiveHours(raw) {
    if (raw === '' || raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
}

/** Cleanliness is a 1-based rating, so anything unusable becomes the floor. */
function clampCleanliness(raw) {
    if (!raw || isNaN(raw) || raw < 1) return 1
    return raw
}

/**
 * Builds the full updated mixer payload merging current form state, the
 * original mixer record, and any override fields the caller passed.
 */
export function buildUpdatedMixerPayload({
    assignedOperatorValue,
    formState,
    mixer,
    overrideValues,
    shopStatusForSave,
    statusValue,
    userId
}) {
    return {
        ...mixer,
        assignedOperator: assignedOperatorValue || null,
        assignedPlant: overrideValues.assignedPlant ?? formState.assignedPlant,
        cleanlinessRating: clampCleanliness(overrideValues.cleanlinessRating ?? formState.cleanlinessRating),
        hours: parsePositiveHours(overrideValues.hours ?? formState.hours),
        id: mixer.id,
        lastChipDate: DateUtility.toDbDate(overrideValues.lastChipDate ?? formState.lastChipDate),
        lastServiceDate: DateUtility.toDbDate(overrideValues.lastServiceDate ?? formState.lastServiceDate),
        make: overrideValues.make ?? formState.make,
        model: overrideValues.model ?? formState.model,
        shopStatus: shopStatusForSave,
        status: statusValue,
        truckNumber: overrideValues.truckNumber ?? formState.truckNumber,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
        updatedLast: mixer.updatedLast,
        vin: ((overrideValues.vin ?? formState.vin) || '').toUpperCase(),
        year: overrideValues.year ?? formState.year
    }
}

/**
 * Returns the `shopStatus` value to persist. The field only carries meaning
 * while the mixer is In Shop, so every other status clears it to null rather
 * than leaving a stale shop stage attached to a working truck.
 */
export function resolveShopStatusForSave(statusValue, overrideValues, currentShopStatus) {
    if (statusValue !== 'In Shop') return null
    return overrideValues.shopStatus ?? currentShopStatus ?? 'in_shop'
}

/**
 * Records the assignment change as `assigned_mixer` history on each operator
 * it touches: the outgoing operator gets an entry losing the truck number, the
 * incoming one gets an entry gaining it. History lives on the operator, not the
 * mixer, so an unchanged assignment writes nothing.
 */
async function recordAssignmentHistory({ mixerForHistory, updatedMixer, userId }) {
    if (mixerForHistory.assignedOperator === updatedMixer.assignedOperator) return
    if (mixerForHistory.assignedOperator) {
        await OperatorService.createHistoryEntry(
            mixerForHistory.assignedOperator,
            'assigned_mixer',
            updatedMixer.truckNumber,
            null,
            userId
        )
    }
    if (updatedMixer.assignedOperator) {
        await OperatorService.createHistoryEntry(
            updatedMixer.assignedOperator,
            'assigned_mixer',
            null,
            updatedMixer.truckNumber,
            userId
        )
    }
}

/**
 * Turns a save failure into text worth showing a user. Only the truck-number
 * unique violation gets a rewrite, because it is the one failure a user can
 * actually act on; everything else surfaces the raw message.
 */
export function formatSaveError(error) {
    if (!error?.message || typeof error.message !== 'string') return 'Unknown error'
    if (error.message.includes('duplicate key') && error.message.includes('mixers_truck_number_key')) {
        return 'This truck number already exists. Please use a different truck number.'
    }
    return error.message
}

/** Normalizes `getCurrentUser`, which resolves to either a user object or a bare id. */
export async function fetchCurrentUserId() {
    const userObj = await UserService.getCurrentUser()
    return typeof userObj === 'object' && userObj !== null ? userObj.id : userObj
}

/**
 * Resolves the two fields the operator/status reconciliation runs on. Presence
 * decides, not truthiness, so a caller can override the assigned operator to
 * null to mean "unassign" rather than "leave the form value alone".
 */
export function resolveSaveInputs({ formState, overrideValues }) {
    return {
        assignedOperatorValue: pickOverride(overrideValues, 'assignedOperator', formState.assignedOperator),
        statusValue: pickOverride(overrideValues, 'status', formState.status)
    }
}

/**
 * Produces the "before" mixer that history and the service layer diff the save
 * against. A `prevAssignedOperator` override lets the caller name the outgoing
 * operator explicitly, for assignment changes where the loaded mixer record is
 * not a reliable witness to who held the truck.
 */
export function buildHistoryMixer(mixer, overrideValues) {
    return {
        ...mixer,
        assignedOperator: pickOverride(overrideValues, 'prevAssignedOperator', mixer.assignedOperator)
    }
}

/**
 * Gates verification on the identity fields a verified mixer must carry: a
 * valid VIN, non-blank make/model/year, and a non-negative engine hours
 * reading. `errorMessage` names the specific failure for VIN and hours and
 * otherwise falls back to a generic prompt.
 */
export function computeVerificationRequirements({ hours, make, mixer: _mixer, model, vin, year }) {
    const vinOk = ValidationUtility.isVIN(vin)
    const makeOk = !!String(make ?? '').trim()
    const modelOk = !!String(model ?? '').trim()
    const yearOk = !!String(year ?? '').trim()
    const hoursOk = isValidHoursValue(hours)
    const allOk = vinOk && makeOk && modelOk && yearOk && hoursOk
    let errorMessage = 'Please fill all required fields before verifying.'
    if (!vinOk) errorMessage = 'Invalid VIN. Please enter a valid 17-character VIN.'
    else if (!hoursOk) errorMessage = 'Please enter a valid engine hours reading (0 or greater).'
    return { allOk, errorMessage }
}

function isValidHoursValue(value) {
    const raw = String(value ?? '').trim()
    if (!raw) return false
    const num = Number(raw)
    return Number.isFinite(num) && num >= 0
}

/**
 * Builds the override map that the verification save runs with: trimmed
 * VIN/make/model/year, plus hours and service/chip dates only where they
 * differ from what is already persisted. Verification is a confirmation
 * rather than an edit, so the map is marked `silent` to suppress the
 * "changes saved" notice.
 */
export function buildVerificationOverrides({ hours, lastChipDate, lastServiceDate, make, mixer, model, vin, year }) {
    const overrides = { silent: true }
    if (vin && vin.trim()) overrides.vin = String(vin).trim().toUpperCase()
    if (make && make.trim()) overrides.make = String(make).trim()
    if (model && model.trim()) overrides.model = String(model).trim()
    if (year && year.trim()) overrides.year = String(year).trim()
    const trimmedHours = String(hours ?? '').trim()
    if (trimmedHours) {
        const parsedHours = Number(trimmedHours)
        if (Number.isFinite(parsedHours) && parsedHours >= 0 && parsedHours !== mixer.hours) {
            overrides.hours = parsedHours
        }
    }
    const existingService = mixer.lastServiceDate ? new Date(mixer.lastServiceDate) : null
    const existingChip = mixer.lastChipDate ? new Date(mixer.lastChipDate) : null
    const incomingService = lastServiceDate
        ? lastServiceDate instanceof Date
            ? lastServiceDate
            : new Date(lastServiceDate)
        : null
    const incomingChip = lastChipDate ? (lastChipDate instanceof Date ? lastChipDate : new Date(lastChipDate)) : null
    if (incomingService && (!existingService || existingService.getTime() !== incomingService.getTime())) {
        overrides.lastServiceDate = incomingService
    }
    if (incomingChip && (!existingChip || existingChip.getTime() !== incomingChip.getTime())) {
        overrides.lastChipDate = incomingChip
    }
    return overrides
}

/**
 * Writes the mixer and then its operator-side assignment history. The history
 * write is deliberately second: a failed update must not leave history claiming
 * an assignment that never landed.
 */
export async function persistMixerUpdate({ mixerForHistory, updatedMixer, userId }) {
    await MixerService.updateMixer(updatedMixer.id, updatedMixer, undefined, mixerForHistory)
    await recordAssignmentHistory({ mixerForHistory, updatedMixer, userId })
}
