import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'

export const GOOD = '#16a34a'
export const BAD = '#dc2626'
export const LATE = '#f59e0b'
export const SLOW = '#ea580c'
export const SAME_DAY = '#d97706'

/** Format a yardage value with a trailing unit. Drops the decimal when
 *  the kicker lands on a whole yard so the table reads cleanly. */
export const fmtYards = (n) => {
    if (n == null || !Number.isFinite(n) || n <= 0) return null
    if (Math.round(n) === n) return `${fmtInt(n)} yd`
    return `${n.toFixed(1)} yd`
}

export const fmtMinutes = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (n < 60) return `${Math.round(n)} min`
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/* Tier-aware verdict palette. Lateness severity tiers (Not Good / Bad /
 * Very Bad) and slow are SEPARATE dimensions — slow is a pour-pace
 * failure, lateness is an arrival-time failure. Used as the dot fill in
 * `VerdictTrail` so the timeline reads as a colored sparkline. */
const TIER_TO_COLOR = { bad: BAD, good: GOOD, notGood: LATE, veryBad: '#7f1d1d' }

export const verdictColor = (m) => {
    if (m.tier && m.tier !== 'good') return TIER_TO_COLOR[m.tier]
    if (m.isSlow) return SLOW
    return GOOD
}

/* Tier-aware verdict tone for the unified `<Badge />` component. Mirrors
 * `verdictColor` but maps to the project's semantic tone names instead of
 * hex codes, so verdict pills render through the same brutalist treatment
 * as every other badge in the app (saturated bg + white text + hard shadow)
 * with WCAG AA contrast guarantees. */
const TIER_TO_TONE = { bad: 'danger', good: 'success', notGood: 'warning', veryBad: 'danger' }

export const verdictTone = (m) => {
    if (m.tier && m.tier !== 'good') return TIER_TO_TONE[m.tier]
    if (m.isSlow) return 'warning'
    return 'success'
}

export const verdictLabel = (m) => {
    const slowSuffix = m.isSlow ? ' + slow' : ''
    switch (m.tier) {
        case 'veryBad':
            return `Very Bad${slowSuffix}`
        case 'bad':
            return `Bad${slowSuffix}`
        case 'notGood':
            return `Not Good${slowSuffix}`
        default:
            return m.isSlow ? 'Slow' : 'Good'
    }
}

export const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'bad', label: 'Bad service', test: (c) => c.badJobs > 0 },
    { key: 'late', label: 'Late', test: (c) => c.lateJobs > 0 },
    { key: 'slow', label: 'Slow', test: (c) => c.slowJobs > 0 },
    { key: 'perfect', label: 'Perfect', test: (c) => c.badJobs === 0 && c.jobs > 0 }
]

export const SORTS = [
    { key: 'badJobs', label: 'Most bad service' },
    { key: 'recent', label: 'Most recent pour' },
    { key: 'jobs', label: 'Most jobs' },
    { key: 'goodPctAsc', label: 'Lowest good %' },
    { key: 'name', label: 'Name (A–Z)' }
]
