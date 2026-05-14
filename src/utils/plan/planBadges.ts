import { PLANT_BADGE_COLORS } from '../../app/constants/planConstants'

/** Canonical per-plant color lookup. Falls back to the caller's `fallback`
 *  when the plant isn't in the shared map. */
export const plantBadgeColor = (code, fallback) => PLANT_BADGE_COLORS[String(code)] || fallback
