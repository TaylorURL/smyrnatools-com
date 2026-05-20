/**
 * Plant co-location lookup.
 *
 * Some plant codes are physically the SAME location — they exist as
 * separate codes in dispatch because the dispatcher tracks them as
 * logically distinct, but operationally they share trucks, drivers, and
 * load-out infrastructure (e.g. Baytown 403/404, Conroe 408/409). When a
 * "404" mixer loads a "403" order, the truck physically didn't go
 * anywhere — it's not actually cross-plant help. Stats and visualisations
 * that compare plant-vs-plant flow should collapse aliases to a single
 * primary code before grouping so the numbers reflect real movement.
 *
 * Source of truth is the `plants.location_group_id` column — two plants
 * sharing the same uuid are at the same physical site. NULL = standalone.
 * Build a `ColocationMap` from the runtime plants list with
 * `buildColocationMap()` and pass it through to every consumer.
 *
 * The PRIMARY code for a group is the lowest plant code (numeric sort on
 * the zero-padded strings already in use). Aliases map to that primary.
 */

/** Minimal plant shape this module needs. Accepts both snake_case
 *  (database row) and camelCase (`Plant` model) keys so callers can pass
 *  whichever they happen to have on hand. */
interface PlantInput {
    plant_code?: string
    plantCode?: string
    location_group_id?: string | null
    locationGroupId?: string | null
    colocated_alias_codes?: string[] | null
    colocatedAliasCodes?: string[] | null
}

/** Alias → primary lookup. Codes not in the map are standalone. */
export interface ColocationMap {
    /** Returns the primary plant code for `code`, or `code` itself when standalone. */
    resolvePrimary: (code: string | null | undefined) => string
    /** Every code in the group containing `primaryCode`, primary first. */
    getGroupCodes: (primaryCode: string | null | undefined) => string[]
    /** True iff this code has at least one co-located sibling. */
    hasSiblings: (code: string | null | undefined) => boolean
    /** Just the sibling codes (excludes `code` itself). */
    getSiblings: (code: string | null | undefined) => string[]
}

/** Empty co-location map — every code resolves to itself, no siblings.
 *  Used as the default when callers don't have plant data yet so they
 *  don't have to null-check on every call site. */
export const EMPTY_COLOCATION_MAP: ColocationMap = {
    getGroupCodes: (code) => {
        const trimmed = String(code ?? '').trim()
        return trimmed ? [trimmed] : []
    },
    getSiblings: () => [],
    hasSiblings: () => false,
    resolvePrimary: (code) => String(code ?? '').trim()
}

const readPlantCode = (plant: PlantInput): string => String(plant?.plant_code ?? plant?.plantCode ?? '').trim()

const readGroupId = (plant: PlantInput): string =>
    String(plant?.location_group_id ?? plant?.locationGroupId ?? '').trim()

const readAliasCodes = (plant: PlantInput): string[] => {
    const raw = plant?.colocated_alias_codes ?? plant?.colocatedAliasCodes
    if (!Array.isArray(raw)) return []
    return raw.map((c) => String(c ?? '').trim()).filter((c) => c.length > 0)
}

/**
 * Builds a `ColocationMap` from a list of plants. Plants with the same
 * non-empty `location_group_id` are grouped together; the primary for a
 * group is the lowest plant code in it.
 *
 * Returns the canonical `EMPTY_COLOCATION_MAP` when the input has zero
 * grouped plants so consumers can compare against it by reference.
 */
export function buildColocationMap(plants: PlantInput[] | null | undefined): ColocationMap {
    /* Phase 1 — group real plants together by location_group_id. */
    const groupToCodes = new Map<string, string[]>()
    /* Phase 1b — collect each plant's phantom alias codes so we can
     * splice them into the relevant group in Phase 2. Keyed by the
     * real plant code that owns them. */
    const aliasesByOwner = new Map<string, string[]>()
    ;(plants ?? []).forEach((plant) => {
        const code = readPlantCode(plant)
        if (!code) return
        const groupId = readGroupId(plant)
        if (groupId) {
            const list = groupToCodes.get(groupId) ?? []
            list.push(code)
            groupToCodes.set(groupId, list)
        }
        const aliases = readAliasCodes(plant).filter((a) => a !== code)
        if (aliases.length > 0) {
            aliasesByOwner.set(code, aliases)
        }
    })

    /* Phase 2 — fold every real-plant group into the alias map. A plant
     * with phantom aliases joins its real-plant group (if any) so the
     * aliases attach to the same primary. Plants with aliases but no
     * real group form a standalone group of (plant + aliases). */
    const aliasToPrimary = new Map<string, string>()
    const groupByPrimary = new Map<string, string[]>()

    /* Real-plant groups first. */
    const handledOwners = new Set<string>()
    groupToCodes.forEach((codes) => {
        const realMembers = [...new Set(codes)]
        if (realMembers.length === 0) return
        const allMembers = new Set<string>(realMembers)
        realMembers.forEach((code) => {
            const aliases = aliasesByOwner.get(code)
            if (aliases) {
                aliases.forEach((a) => allMembers.add(a))
                handledOwners.add(code)
            }
        })
        if (allMembers.size < 2) return
        const sorted = [...allMembers].sort()
        const primary = sorted[0]
        groupByPrimary.set(primary, sorted)
        sorted.forEach((code) => aliasToPrimary.set(code, primary))
    })

    /* Plants that have aliases but no real-plant group of their own —
     * form a (plant + aliases) standalone group. The plant code is
     * always the primary even if alphabetically later than its
     * aliases, because the alias codes have no plant rows of their own
     * to anchor to. */
    aliasesByOwner.forEach((aliases, ownerCode) => {
        if (handledOwners.has(ownerCode)) return
        const members = [...new Set([ownerCode, ...aliases])]
        if (members.length < 2) return
        const sorted = [...members].sort()
        const primary = ownerCode
        groupByPrimary.set(primary, [primary, ...sorted.filter((c) => c !== primary)])
        members.forEach((code) => aliasToPrimary.set(code, primary))
    })

    if (aliasToPrimary.size === 0) return EMPTY_COLOCATION_MAP

    return {
        getGroupCodes: (code) => {
            const trimmed = String(code ?? '').trim()
            if (!trimmed) return []
            const primary = aliasToPrimary.get(trimmed) ?? trimmed
            return groupByPrimary.get(primary) ?? [trimmed]
        },
        getSiblings: (code) => {
            const trimmed = String(code ?? '').trim()
            if (!trimmed) return []
            const primary = aliasToPrimary.get(trimmed)
            if (!primary) return []
            return (groupByPrimary.get(primary) ?? []).filter((c) => c !== trimmed)
        },
        hasSiblings: (code) => {
            const trimmed = String(code ?? '').trim()
            return trimmed ? aliasToPrimary.has(trimmed) : false
        },
        resolvePrimary: (code) => {
            const trimmed = String(code ?? '').trim()
            return aliasToPrimary.get(trimmed) ?? trimmed
        }
    }
}

/** Compact code label — "403/404" when siblings exist, "405" when not. */
export function formatColocatedCodeLabel(
    primaryCode: string | null | undefined,
    map: ColocationMap = EMPTY_COLOCATION_MAP
): string {
    const codes = map.getGroupCodes(primaryCode)
    return codes.join('/')
}

/** Combined display label — "403/404 — Baytown" when siblings exist,
 *  "405 — San Leon" when not. Falls back to bare codes when the name
 *  lookup misses. */
export function formatColocatedPlantLabel(
    primaryCode: string | null | undefined,
    plantNameByCode: Record<string, string> | null | undefined,
    map: ColocationMap = EMPTY_COLOCATION_MAP,
    separator: string = ' — '
): string {
    const codes = map.getGroupCodes(primaryCode)
    if (codes.length === 0) return ''
    const name = plantNameByCode?.[codes[0]] || ''
    const codeLabel = codes.join('/')
    return name ? `${codeLabel}${separator}${name}` : codeLabel
}
