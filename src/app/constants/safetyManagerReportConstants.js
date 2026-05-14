/* Safety Manager report constants — tag vocabulary, palette, and small
 * normalization helpers used by both the editable and review views. */

/** Incident categories — order preserved from the original eight tags
 *  so reports filed before the expansion still render in the same
 *  sequence. Grouped loosely: severity → person impact → operational →
 *  general categories. */
export const TAG_OPTIONS = [
    'Accident',
    'DOT',
    'DOT Recordable',
    'Non-DOT',
    'Property Damage',
    'Injury',
    'Medical',
    'First Aid',
    'Backing / Chute Incident',
    'Spill',
    'Compliance',
    'Environmental',
    'Reprimand',
    'Safety'
]

/** Color + icon palette for each tag — used by the picker, the chip
 *  rows on cards, and the read-only review view. */
export const TAG_COLORS = {
    Accident: { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', icon: 'fas fa-car-crash' },
    'Backing / Chute Incident': {
        bg: 'rgba(217, 119, 6, 0.15)',
        color: '#92400e',
        icon: 'fas fa-truck-arrow-right'
    },
    Compliance: { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', icon: 'fas fa-clipboard-check' },
    DOT: { bg: 'rgba(234, 179, 8, 0.15)', color: '#a16207', icon: 'fas fa-truck' },
    'DOT Recordable': { bg: 'rgba(234, 179, 8, 0.20)', color: '#854d0e', icon: 'fas fa-triangle-exclamation' },
    Environmental: { bg: 'rgba(34, 197, 94, 0.15)', color: '#15803d', icon: 'fas fa-leaf' },
    'First Aid': { bg: 'rgba(20, 184, 166, 0.15)', color: '#0f766e', icon: 'fas fa-kit-medical' },
    Injury: { bg: 'rgba(220, 38, 38, 0.15)', color: '#b91c1c', icon: 'fas fa-user-injured' },
    Medical: { bg: 'rgba(244, 63, 94, 0.15)', color: '#be123c', icon: 'fas fa-briefcase-medical' },
    'Non-DOT': { bg: 'rgba(249, 115, 22, 0.15)', color: '#c2410c', icon: 'fas fa-file-alt' },
    'Property Damage': { bg: 'rgba(234, 88, 12, 0.18)', color: '#9a3412', icon: 'fas fa-car-burst' },
    Reprimand: { bg: 'rgba(168, 85, 247, 0.15)', color: '#7c3aed', icon: 'fas fa-exclamation-triangle' },
    Safety: { bg: 'rgba(14, 165, 233, 0.15)', color: '#0369a1', icon: 'fas fa-shield-alt' },
    Spill: { bg: 'rgba(6, 182, 212, 0.15)', color: '#0e7490', icon: 'fas fa-droplet' }
}

/** Fallback tag style for unknown tag names. */
export const DEFAULT_TAG_STYLE = {
    bg: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    icon: 'fas fa-tag'
}

/** Tolerates legacy data: an array, a single string description, or null. */
export function normalizeIssues(formIssues) {
    if (Array.isArray(formIssues)) return formIssues
    if (typeof formIssues === 'string' && formIssues) {
        return [{ affectsEfficiency: false, date: '', description: formIssues, id: 0, plant: '', tag: '', tags: [] }]
    }
    return []
}

/** Returns the issue's tag array, falling back to `[tag]` for legacy
 *  single-tag rows. */
export function getIssueTags(issue) {
    return Array.isArray(issue.tags) ? issue.tags : issue.tag ? [issue.tag] : []
}
