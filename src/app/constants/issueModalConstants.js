/**
 * Severity styling tokens for the issue modal. `badgeClass` maps to the
 * project's canonical theme-aware status pills (`status-badge-*`) so the
 * pill background tints correctly across light, dark, and grayed themes
 * — previously the palette hardcoded light-mode hex values that washed
 * out in dark mode. `fg` carries the saturated accent for non-pill
 * accents (e.g. the left-border on the send-issue modal card). `icon`
 * is the FontAwesome glyph rendered inside the pill.
 *
 * Severity follows the universal red → amber → green ramp:
 *   High   = danger (red)   — needs immediate attention
 *   Medium = warning (amber) — important but not urgent
 *   Low    = success (green) — informational / minor
 */
export const SEVERITY_PALETTE = {
    High: { badgeClass: 'status-badge-danger', fg: '#dc2626', icon: 'fa-triangle-exclamation' },
    Low: { badgeClass: 'status-badge-success', fg: '#16a34a', icon: 'fa-circle-info' },
    Medium: { badgeClass: 'status-badge-warning', fg: '#d97706', icon: 'fa-circle-exclamation' }
}

export const PILL_BASE =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider'
