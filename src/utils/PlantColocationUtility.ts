/** Just trims the code. The colocation map that would join sibling codes with
 *  "/" is never supplied by any caller, so that branch was dead. */
export function formatColocatedCodeLabel(primaryCode: string | null | undefined): string {
    return String(primaryCode ?? '').trim()
}
