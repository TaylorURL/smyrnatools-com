import { useMemo } from 'react'

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24
const RETIRED_STATUSES = ['Terminated', 'No Hire']

/** Role names that disqualify a manager from "active" metrics. Matched
 *  case-insensitively. Guests and terminated accounts shouldn't contribute
 *  to coverage / role-tier / plant-distribution counts — only to surfaces
 *  that are specifically about them. */
const EXCLUDED_MANAGER_ROLE_NAMES = new Set(['guest', 'terminated', 'no hire'])

/** Returns true when a manager record should be excluded from general
 *  metrics: guest / terminated role, or no plant assigned. Plant
 *  assignment is treated as a hard requirement because every other
 *  metric (coverage gaps, per-plant rollups, role tiers in scope) keys
 *  off it. */
const isExcludedManager = (person) => {
    if (!person) return true
    const role = String(person.roleName || '')
        .trim()
        .toLowerCase()
    if (EXCLUDED_MANAGER_ROLE_NAMES.has(role)) return true
    if (!String(person.plantCode || '').trim()) return true
    return false
}

const RATING_BUCKETS = [
    { label: '0 ★', max: 0 },
    { label: '1 ★', max: 1 },
    { label: '2 ★', max: 2 },
    { label: '3 ★', max: 3 },
    { label: '4 ★', max: 4 },
    { label: '5 ★', max: 5 }
]

const LAST_LOGIN_BUCKETS = [
    { label: '< 7 d', max: 7 },
    { label: '7–30 d', max: 30 },
    { label: '31–90 d', max: 90 },
    { label: '91–180 d', max: 180 },
    { label: '> 180 d', max: Infinity }
]

const daysSince = (input) => {
    if (!input) return null
    const value = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : input
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) return null
    return Math.max(0, Math.floor((Date.now() - time) / MILLIS_PER_DAY))
}

/** Bucket a numeric days value into the first bucket whose `max` it does
 *  not exceed; falls through to the trailing bucket otherwise. */
const bucket = (buckets, days) => {
    if (days == null) return null
    const found = buckets.find((b) => days <= b.max)
    return (found || buckets[buckets.length - 1]).label
}

/**
 * Statistics derivation for people roster views (operators, managers).
 * Keeps a parallel shape to `useAssetStatistics` so the visual surfaces can
 * reuse the same Panel / chart / table primitives. The `kind` discriminator
 * lets the hook tailor logic per entity:
 *   - 'operators' → status mix + position + rating + tenure
 *   - 'managers'  → role mix + plant + last-login + tenure
 *
 * All metrics are pure memoizations of the items already loaded by the
 * caller — no fetches happen here.
 */
export default function usePersonStatistics({ dateRange, items, kind, plants, regionPlantCodes, selectedPlant }) {
    const isOperators = kind === 'operators'

    const plantNames = useMemo(() => {
        const map = new Map()
        plants?.forEach((p) => {
            const code = p?.plantCode || p?.code
            if (code) map.set(String(code).trim().toUpperCase(), p?.name || p?.plantName || code)
        })
        return map
    }, [plants])

    /** Region + plant scope, no date filter. Used by snapshot lists (Pending
     *  Starts, Currently in Training, Trainer Roster, etc.) so those tables
     *  always show the live pipeline regardless of the selected time
     *  range. */
    const regionPlantScopedItems = useMemo(() => {
        if (!Array.isArray(items)) return []
        const upper = (v) =>
            String(v || '')
                .trim()
                .toUpperCase()
        const plant = upper(selectedPlant)
        return items.filter((person) => {
            const personPlant = upper(person.plantCode)
            if (regionPlantCodes && regionPlantCodes.size > 0 && personPlant && !regionPlantCodes.has(personPlant)) {
                return false
            }
            if (plant && plant !== 'ALL' && personPlant !== plant) return false
            return true
        })
    }, [items, regionPlantCodes, selectedPlant])

    const dateRangeStartTime = useMemo(
        () => (dateRange?.start ? new Date(`${dateRange.start}T00:00:00`).getTime() : null),
        [dateRange?.start]
    )
    const dateRangeEndTime = useMemo(
        () => (dateRange?.end ? new Date(`${dateRange.end}T23:59:59.999`).getTime() : null),
        [dateRange?.end]
    )

    const isWithinRange = useMemo(() => {
        if (dateRangeStartTime == null || dateRangeEndTime == null) return null
        return (iso) => {
            if (!iso) return false
            const t = new Date(iso).getTime()
            if (!Number.isFinite(t)) return false
            return t >= dateRangeStartTime && t <= dateRangeEndTime
        }
    }, [dateRangeEndTime, dateRangeStartTime])

    /** Items in scope = region+plant-scoped items further narrowed by
     *  activity time when a date range is active. Used by every section
     *  that's interpreted as "activity in the period" (status, plants,
     *  ratings, logins, etc.). Hiring & Training intentionally uses
     *  `regionPlantScopedItems` plus its own period filters so the live
     *  pipeline lists never disappear when the user scopes to a window. */
    const scopedItems = useMemo(() => {
        if (!isWithinRange) return regionPlantScopedItems
        return regionPlantScopedItems.filter((person) => {
            const activity = person.updatedAt || person.createdAt || person.lastLoginAt || null
            return isWithinRange(activity)
        })
    }, [isWithinRange, regionPlantScopedItems])

    /** "Active" set per entity kind:
     *   - Operators: drops Terminated / No Hire (status-driven)
     *   - Managers: drops Guest / Terminated role names AND any record
     *     without a plant assignment — those records shouldn't influence
     *     coverage, role tiers, plant rollups, or any other general metric
     *     unless a surface is specifically about them.
     *
     *  Surfaces that are intentionally about excluded records (e.g. the
     *  operator Roster Status chart, the Hiring & Training "Terminated in
     *  period" list) read from `scopedItems` directly so they still
     *  surface those rows. */
    const activeItems = useMemo(() => {
        if (isOperators) {
            return scopedItems.filter((person) => !RETIRED_STATUSES.includes(person.status))
        }
        return scopedItems.filter((person) => !isExcludedManager(person))
    }, [isOperators, scopedItems])

    /** Headline KPI surface — counts, missing-data, plant spread, and
     *  entity-specific signals (rating for operators, login recency for
     *  managers). Terminated / No-Hire operators are intentionally excluded
     *  from every derived count except `retiredCount` itself — those
     *  records show up only in surfaces that are specifically about them
     *  (Roster Status chart, Hiring & Training period lists). */
    const summary = useMemo(() => {
        const total = activeItems.length
        const retired = scopedItems.length - activeItems.length
        const plantSet = new Set()
        let missingPlant = 0
        let missingName = 0
        let missingPhone = 0
        let trainerCount = 0
        let ratingSum = 0
        let ratingSamples = 0
        let lastLoginSum = 0
        let lastLoginSamples = 0
        let neverLoggedIn = 0

        activeItems.forEach((person) => {
            if (!person.plantCode) missingPlant += 1
            else plantSet.add(String(person.plantCode).trim().toUpperCase())
            const displayName =
                person.name || `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email
            if (!displayName) missingName += 1
            if (isOperators && !person.phone) missingPhone += 1
            if (isOperators && person.isTrainer) trainerCount += 1
            if (isOperators && Number.isFinite(Number(person.rating))) {
                ratingSum += Number(person.rating)
                ratingSamples += 1
            }
            if (!isOperators) {
                const loginDays = daysSince(person.lastLoginAt)
                if (loginDays == null) neverLoggedIn += 1
                else {
                    lastLoginSum += loginDays
                    lastLoginSamples += 1
                }
            }
        })

        return {
            activeCount: total,
            avgLastLoginDays: lastLoginSamples > 0 ? Math.round(lastLoginSum / lastLoginSamples) : null,
            avgRating: ratingSamples > 0 ? ratingSum / ratingSamples : null,
            isOperators,
            missingName,
            missingPhone,
            missingPlant,
            neverLoggedIn,
            plantsRepresented: plantSet.size,
            ratingSamples,
            retiredCount: retired,
            total,
            trainerCount
        }
    }, [activeItems, isOperators, scopedItems.length])

    /** Status distribution — operators have rich statuses (Active, Light
     *  Duty, Pending Start, Training, Terminated, No Hire). Managers don't
     *  have a status field, so this collapses to an empty array there. */
    const statusDistribution = useMemo(() => {
        if (!isOperators) return []
        const counts = new Map()
        scopedItems.forEach((person) => {
            const label = person.status || 'Unknown'
            counts.set(label, (counts.get(label) || 0) + 1)
        })
        return [...counts.entries()].map(([label, count]) => ({ count, label })).sort((a, b) => b.count - a.count)
    }, [isOperators, scopedItems])

    /** Position (operators) or role (managers) breakdown. Keyed by the
     *  appropriate field. Excludes terminated / no-hire operators — their
     *  position/role data isn't operationally meaningful. */
    const roleDistribution = useMemo(() => {
        const counts = new Map()
        activeItems.forEach((person) => {
            const label = isOperators ? person.position || 'Unassigned' : person.roleName || 'No Role'
            counts.set(label, (counts.get(label) || 0) + 1)
        })
        return [...counts.entries()].map(([label, count]) => ({ count, label })).sort((a, b) => b.count - a.count)
    }, [activeItems, isOperators])

    /** Per-plant rollup — counts active roster only and (for operators)
     *  trainer coverage. Terminated / no-hire records aren't part of any
     *  plant's working roster, so they're excluded entirely. */
    const perPlant = useMemo(() => {
        const map = new Map()
        activeItems.forEach((person) => {
            const code =
                String(person.plantCode || '')
                    .trim()
                    .toUpperCase() || 'UNASSIGNED'
            if (!map.has(code)) {
                map.set(code, {
                    active: 0,
                    code,
                    name: plantNames.get(code) || code,
                    total: 0,
                    trainers: 0
                })
            }
            const row = map.get(code)
            row.total += 1
            row.active += 1
            if (isOperators && person.isTrainer) row.trainers += 1
        })
        return [...map.values()].sort((a, b) => b.active - a.active || a.code.localeCompare(b.code))
    }, [activeItems, isOperators, plantNames])

    /** Hiring & training pipeline — operators-only. Two halves:
     *
     *  1. **Snapshot lists** (pending starts, currently in training, trainer
     *     roster, plants missing trainers) — always read the full
     *     region+plant pool so the live pipeline never disappears just
     *     because the user narrowed the time range.
     *  2. **Period-bound counts + lists** (hired, started training,
     *     activated, terminated, declined) — filter by `createdAt` or
     *     `statusChangedAt` against the active date range. With period =
     *     all-time the counts collapse to lifetime totals from the same
     *     fields, so the surface stays meaningful without a window.
     */
    const hiringTraining = useMemo(() => {
        if (!isOperators) return null

        const upper = (v) =>
            String(v || '')
                .trim()
                .toUpperCase()
        const personRow = (person, extras = {}) => ({
            createdAt: person.createdAt || null,
            id: person.employeeId,
            name: person.name || person.employeeId,
            plant: person.plantCode || '—',
            position: person.position || '—',
            status: person.status || 'Active',
            ...extras
        })

        /* ── Snapshot lists (region+plant scope, no date filter) ───────── */

        const pendingStarts = regionPlantScopedItems
            .filter((person) => person.status === 'Pending Start')
            .map((person) => {
                const startTime = person.pendingStartDate
                    ? new Date(`${person.pendingStartDate}T00:00:00`).getTime()
                    : null
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const daysUntilStart = Number.isFinite(startTime)
                    ? Math.round((startTime - today.getTime()) / MILLIS_PER_DAY)
                    : null
                return personRow(person, {
                    daysUntilStart,
                    pendingStartDate: person.pendingStartDate || null
                })
            })
            .sort((a, b) => {
                if (a.daysUntilStart == null && b.daysUntilStart == null) return 0
                if (a.daysUntilStart == null) return 1
                if (b.daysUntilStart == null) return -1
                return a.daysUntilStart - b.daysUntilStart
            })

        const trainerMenteeCount = new Map()
        regionPlantScopedItems.forEach((person) => {
            const trainerId = person.assignedTrainer
            if (!trainerId) return
            trainerMenteeCount.set(trainerId, (trainerMenteeCount.get(trainerId) || 0) + 1)
        })

        const trainers = regionPlantScopedItems
            .filter((person) => person.isTrainer && !RETIRED_STATUSES.includes(person.status))
            .map((person) =>
                personRow(person, {
                    mentees: trainerMenteeCount.get(person.employeeId) || 0
                })
            )
            .sort((a, b) => b.mentees - a.mentees || a.name.localeCompare(b.name))

        const trainerNameById = new Map(trainers.map((t) => [t.id, t.name]))

        const inTraining = regionPlantScopedItems
            .filter((person) => person.status === 'Training')
            .map((person) => {
                const days = daysSince(person.createdAt)
                return personRow(person, {
                    assignedTrainerId: person.assignedTrainer || null,
                    assignedTrainerName: person.assignedTrainer
                        ? trainerNameById.get(person.assignedTrainer) || null
                        : null,
                    daysInTraining: days
                })
            })
            .sort((a, b) => (b.daysInTraining ?? 0) - (a.daysInTraining ?? 0))

        const plantsWithTrainers = new Set(
            trainers.filter((t) => t.plant && t.plant !== '—').map((t) => upper(t.plant))
        )
        const plantsMissingTrainers = perPlant
            .filter((row) => row.code !== 'UNASSIGNED' && !plantsWithTrainers.has(upper(row.code)))
            .map((row) => ({ active: row.active, code: row.code, name: row.name }))
            .slice(0, 10)

        /* ── Period-bound counts + lists ──────────────────────────────── */

        /** A predicate that returns true for ISO timestamps inside the active
         *  date range, or true unconditionally when no range is set (period
         *  = all-time). Lets the counts below stay one branch each. */
        const isInPeriod = isWithinRange ? isWithinRange : () => true
        const periodActive = !!isWithinRange

        /** Build period-bound rows for a given lifecycle event. */
        const buildPeriodList = (filter, dateField, extras = {}) =>
            regionPlantScopedItems
                .filter(filter)
                .filter((person) => isInPeriod(person[dateField]))
                .map((person) =>
                    personRow(person, {
                        eventDate: person[dateField] || null,
                        ...(typeof extras === 'function' ? extras(person) : extras)
                    })
                )
                .sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''))

        const hiresInPeriod = buildPeriodList(
            (person) => !!person.createdAt && person.status !== 'No Hire',
            'createdAt'
        )
        const startedTrainingInPeriod = buildPeriodList((person) => person.status === 'Training', 'statusChangedAt')
        const activatedInPeriod = buildPeriodList((person) => person.status === 'Active', 'statusChangedAt')
        const terminatedInPeriod = buildPeriodList((person) => person.status === 'Terminated', 'statusChangedAt')
        const noHireInPeriod = buildPeriodList((person) => person.status === 'No Hire', 'statusChangedAt')

        /** Recent hires — operators added within the last 90 days (an
         *  always-on onboarding follow-up watchlist, independent of the
         *  selected period). Useful when the user is on all-time and still
         *  wants the "who joined recently?" signal. */
        const recentHires = regionPlantScopedItems
            .filter((person) => !RETIRED_STATUSES.includes(person.status))
            .map((person) => personRow(person, { tenureDays: daysSince(person.createdAt) }))
            .filter((row) => row.tenureDays != null && row.tenureDays <= 90)
            .sort((a, b) => (a.tenureDays ?? Infinity) - (b.tenureDays ?? Infinity))

        const noHireList = regionPlantScopedItems
            .filter((person) => person.status === 'No Hire')
            .map((person) => personRow(person))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

        return {
            activatedInPeriod,
            counts: {
                activated: activatedInPeriod.length,
                hired: hiresInPeriod.length,
                noHire: noHireInPeriod.length,
                startedTraining: startedTrainingInPeriod.length,
                terminated: terminatedInPeriod.length
            },
            hiresInPeriod,
            inTraining,
            noHireInPeriod,
            noHireList,
            pendingStarts,
            periodActive,
            plantsMissingTrainers,
            recentHires,
            startedTrainingInPeriod,
            terminatedInPeriod,
            trainers
        }
    }, [isOperators, isWithinRange, perPlant, regionPlantScopedItems])

    /** Operator rating distribution — rounds ratings to the nearest whole
     *  star for binning. Excludes unrated operators (rating === 0 with no
     *  signal) and terminated / no-hire records, since their ratings are
     *  historical noise rather than a working signal. */
    const ratingDistribution = useMemo(() => {
        if (!isOperators) return []
        const counts = new Map(RATING_BUCKETS.map((b) => [b.label, 0]))
        let unrated = 0
        activeItems.forEach((person) => {
            const value = Number(person.rating)
            if (!Number.isFinite(value) || value === 0) {
                unrated += 1
                return
            }
            const rounded = Math.round(value)
            const label = `${Math.max(0, Math.min(5, rounded))} ★`
            counts.set(label, (counts.get(label) || 0) + 1)
        })
        const rows = RATING_BUCKETS.filter((b) => b.label !== '0 ★').map((b) => ({
            count: counts.get(b.label) || 0,
            label: b.label
        }))
        if (unrated > 0) rows.unshift({ count: unrated, label: 'Unrated' })
        return rows
    }, [activeItems, isOperators])

    /** Manager last-login histogram — bins recency of last login so it's
     *  obvious who hasn't been around in a while. Managers don't have a
     *  retired-style status, so this filters on activeItems (functionally
     *  identical to scopedItems for managers). */
    const lastLoginDistribution = useMemo(() => {
        if (isOperators) return []
        const counts = new Map(LAST_LOGIN_BUCKETS.map((b) => [b.label, 0]))
        let never = 0
        activeItems.forEach((person) => {
            const value = daysSince(person.lastLoginAt)
            if (value == null) {
                never += 1
                return
            }
            const label = bucket(LAST_LOGIN_BUCKETS, value)
            counts.set(label, (counts.get(label) || 0) + 1)
        })
        const rows = LAST_LOGIN_BUCKETS.map((b) => ({ count: counts.get(b.label) || 0, label: b.label }))
        if (never > 0) rows.push({ count: never, label: 'Never' })
        return rows
    }, [activeItems, isOperators])

    /** Stale managers — top 15 managers by days-since-last-login (or
     *  never). Useful for cleaning up dormant accounts. */
    const staleManagers = useMemo(() => {
        if (isOperators) return []
        return activeItems
            .map((manager) => ({
                daysSince: daysSince(manager.lastLoginAt),
                id: manager.id,
                name: `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.email || '—',
                plant: manager.plantCode || '—',
                role: manager.roleName || '—'
            }))
            .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity))
            .slice(0, 15)
    }, [activeItems, isOperators])

    /** Lowest-rated operators — surfaces active operators with explicit low
     *  ratings (1–3 stars). Terminated / no-hire excluded; their ratings
     *  are historical and don't need follow-up. */
    const lowestRatedOperators = useMemo(() => {
        if (!isOperators) return []
        return activeItems
            .filter((op) => Number.isFinite(Number(op.rating)) && Number(op.rating) > 0 && Number(op.rating) <= 3)
            .map((op) => ({
                id: op.employeeId,
                name: op.name || op.employeeId,
                plant: op.plantCode || '—',
                position: op.position || '—',
                rating: Number(op.rating),
                status: op.status
            }))
            .sort((a, b) => a.rating - b.rating || b.id?.localeCompare(a.id || ''))
            .slice(0, 15)
    }, [activeItems, isOperators])

    /** Manager-specific coverage / risk derivations. Surfaces plants with
     *  no managers (gaps), single-point-of-failure plants (one manager),
     *  role-tier composition (admin / lead / manager / viewer based on
     *  roleWeight), recent additions, login health, and email-domain mix.
     *  Returns null for operators since none of these concepts apply.
     */
    const managerCoverage = useMemo(() => {
        if (isOperators) return null

        const plantsInRegion = regionPlantCodes && regionPlantCodes.size > 0 ? [...regionPlantCodes] : []
        const plantsWithManagers = new Set(perPlant.map((p) => p.code))
        const uncoveredPlants = plantsInRegion
            .filter((code) => code && !plantsWithManagers.has(code) && code !== 'UNASSIGNED')
            .map((code) => ({ code, name: plantNames.get(code) || code }))
            .sort((a, b) => a.code.localeCompare(b.code))

        /** Single-point-of-failure plants — exactly one active manager
         *  means a vacation / illness leaves the plant uncovered. */
        const spofPlants = perPlant
            .filter((p) => p.active === 1 && p.code !== 'UNASSIGNED')
            .map((p) => ({ code: p.code, count: p.active, name: p.name }))
            .sort((a, b) => a.code.localeCompare(b.code))

        /** Role tiers — bucketed off `roleWeight` so the UI can read at a
         *  glance how the admin/manager balance looks regardless of how
         *  many specific roles the project defines. Thresholds match the
         *  weights the rest of the app uses for permission gating. */
        const roleTiers = { admin: 0, lead: 0, manager: 0, viewer: 0 }
        const tierMembers = { admin: [], lead: [], manager: [], viewer: [] }
        activeItems.forEach((person) => {
            const weight = Number(person.roleWeight) || 0
            let tier
            if (weight >= 70) tier = 'admin'
            else if (weight >= 40) tier = 'lead'
            else if (weight >= 20) tier = 'manager'
            else tier = 'viewer'
            roleTiers[tier] += 1
            tierMembers[tier].push(person)
        })

        const recentAdditions = activeItems
            .map((person) => ({
                createdAt: person.createdAt || null,
                daysSince: daysSince(person.createdAt),
                email: person.email || null,
                id: person.id,
                name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || person.id || '—',
                plant: person.plantCode || '—',
                role: person.roleName || '—'
            }))
            .filter((row) => row.daysSince != null && row.daysSince <= 30)
            .sort((a, b) => (a.daysSince ?? Infinity) - (b.daysSince ?? Infinity))

        /** Email-domain composition — quick read on internal vs vendor /
         *  external accounts. Sorted by count desc. */
        const domainCounts = new Map()
        activeItems.forEach((person) => {
            const email = String(person.email || '')
                .trim()
                .toLowerCase()
            const at = email.indexOf('@')
            if (at === -1 || at === email.length - 1) return
            const domain = email.slice(at + 1)
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
        })
        const domainBreakdown = [...domainCounts.entries()]
            .map(([label, count]) => ({ count, label }))
            .sort((a, b) => b.count - a.count)

        /** Login health — recent (≤ 30 d), warm (31-90 d), stale (> 90 d),
         *  never. Useful as a single-glance summary above the existing
         *  login distribution chart. */
        const loginHealth = { never: 0, recent: 0, stale: 0, warm: 0 }
        activeItems.forEach((person) => {
            const days = daysSince(person.lastLoginAt)
            if (days == null) loginHealth.never += 1
            else if (days <= 30) loginHealth.recent += 1
            else if (days <= 90) loginHealth.warm += 1
            else loginHealth.stale += 1
        })

        return {
            domainBreakdown,
            loginHealth,
            recentAdditions,
            roleTiers,
            spofPlants,
            tierMembers,
            uncoveredPlants
        }
    }, [activeItems, isOperators, perPlant, plantNames, regionPlantCodes])

    /** Available plants for the Statistics plant filter — only plants with
     *  at least one ACTIVE person show up. Plants whose only roster is
     *  terminated would otherwise pollute the filter menu. */
    const availablePlantCodes = useMemo(() => {
        const set = new Set()
        activeItems.forEach((person) => {
            const code = String(person.plantCode || '')
                .trim()
                .toUpperCase()
            if (code) set.add(code)
        })
        return [...set].sort()
    }, [activeItems])

    return {
        availablePlantCodes,
        hiringTraining,
        lastLoginDistribution,
        lowestRatedOperators,
        managerCoverage,
        perPlant,
        plantNames,
        ratingDistribution,
        roleDistribution,
        scopedItems,
        staleManagers,
        statusDistribution,
        summary
    }
}
