/** Bare plant code label. Previously joined co-located sibling codes with
 *  "/" but no live caller ever supplied the colocation map that made that
 *  branch fire, so the helper now just trims the code. */
export function formatColocatedCodeLabel(primaryCode: string | null | undefined): string {
    return String(primaryCode ?? '').trim()
}

/** Plant code label — name lookup wasn't wired into any live consumer, so
 *  the helper currently mirrors `formatColocatedCodeLabel`. Kept as a
 *  distinct export to leave room for a future name-rendering variant. */
export function formatColocatedPlantLabel(primaryCode: string | null | undefined): string {
    return formatColocatedCodeLabel(primaryCode)
}
