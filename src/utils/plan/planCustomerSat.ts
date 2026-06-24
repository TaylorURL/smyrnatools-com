/* Service-tier labels/colors. The Plan/Operations satisfaction scoring
 * was retired; only the tier display metadata survives, consumed by the
 * CRM customer-card ServiceTierBreakdown. */

export type ServiceTier = 'good' | 'notGood' | 'bad' | 'veryBad'

/** Human label + accent color per tier. Pinned here so every page
 *  renders the same words / hues for the same verdict. */
export const SERVICE_TIER_META: Record<ServiceTier, { color: string; label: string }> = {
    bad: { color: '#dc2626', label: 'Bad' },
    good: { color: '#16a34a', label: 'Good' },
    notGood: { color: '#f59e0b', label: 'Not Good' },
    veryBad: { color: '#7f1d1d', label: 'Very Bad' }
}
