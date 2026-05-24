import { CALIBRATION_WARN_DAYS, RENEWAL_WARN_DAYS } from './nrmcaConstants'

export const fmt = (d) =>
    d
        ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        : null

export const daysFromNow = (d) => (d ? Math.ceil((new Date(d + 'T12:00:00') - Date.now()) / 86400000) : null)

export function getRenewalStatus(expiresAt) {
    const days = daysFromNow(expiresAt)
    if (days === null) return 'unknown'
    if (days < 0) return 'expired'
    if (days <= RENEWAL_WARN_DAYS) return 'expiring'
    return 'valid'
}

export function getCalibrationStatus(calibratedAt, intervalDays) {
    if (!calibratedAt) return 'unknown'
    const nextDueDate = new Date(new Date(calibratedAt + 'T12:00:00').getTime() + intervalDays * 86400000)
        .toISOString()
        .slice(0, 10)
    const days = daysFromNow(nextDueDate)
    if (days < 0) return 'overdue'
    if (days <= CALIBRATION_WARN_DAYS) return 'due_soon'
    return 'ok'
}

export function getNextCalibrationDueDate(calibratedAt, intervalDays) {
    if (!calibratedAt) return null
    return new Date(new Date(calibratedAt + 'T12:00:00').getTime() + intervalDays * 86400000).toISOString().slice(0, 10)
}
