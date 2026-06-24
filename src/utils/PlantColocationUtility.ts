/**
 * Plant code display helpers.
 *
 * Co-location grouping (collapsing logically-separate plant codes that
 * physically share a site) lived here but no live caller ever built a real
 * `ColocationMap`, so the format helpers below simply render the plant code
 * (and optional plant name lookup) as-is.
 */

/** Bare plant code label. */
export function formatColocatedCodeLabel(primaryCode: string | null | undefined): string {
    return String(primaryCode ?? '').trim()
}

/** "405 — San Leon" when a name is available, "405" otherwise. */
export function formatColocatedPlantLabel(
    primaryCode: string | null | undefined,
    plantNameByCode: Record<string, string> | null | undefined,
    separator: string = ' — '
): string {
    const code = formatColocatedCodeLabel(primaryCode)
    if (!code) return ''
    const name = plantNameByCode?.[code] || ''
    return name ? `${code}${separator}${name}` : code
}
