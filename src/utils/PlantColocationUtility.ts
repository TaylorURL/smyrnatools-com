/** Display label for a plant in colocation-aware UI — the trimmed primary code. */
export function formatColocatedCodeLabel(primaryCode: string | null | undefined): string {
    return String(primaryCode ?? '').trim()
}
