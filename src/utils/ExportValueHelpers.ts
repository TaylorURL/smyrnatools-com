import { COLORS } from './ExportConstants'
import { type ChangeDirection, resolveChangeColor } from './ExportExcelStyles'

/**
 * Value coercion + change-percentage formatting. `ensure`/`truncateToTenth`
 * normalize raw report values before they reach a cell; `calcChange`,
 * `getChangeText`, and `getChangeValue` produce the colored delta strings
 * (e.g. "+12%", "-3") rendered next to current-period metrics.
 */

/** A period-over-period comparison: how far the metric moved, which way it
 *  went, and the same distance as a percentage of the previous value. */
export interface ChangeSummary {
    diff: number
    direction: ChangeDirection
    pct: number
}

/** A formatted delta ready for a cell: the text to show, and the font color its
 *  direction earns. A delta with no text to show carries no color. */
export interface ChangeInfo {
    color: string | null
    text: string
}

/**
 * @param value - Raw form/report value
 * @param isNumeric - true → coerce to Number (default 0); false → keep as string (default '')
 */
export function ensure(value: unknown, isNumeric: boolean): unknown {
    if (value === null || value === undefined || value === '') return isNumeric ? 0 : ''
    return isNumeric ? Number(value) : value
}

export function truncateToTenth(n: unknown): unknown {
    if (typeof n !== 'number' || !isFinite(n)) return n
    return Math.floor(n * 10) / 10
}

export function calcChange(current: number, previous: number | null | undefined): ChangeSummary {
    if (previous === null || previous === undefined) return { diff: 0, direction: 'neutral', pct: 0 }
    const diff = current - previous
    const pct = previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100)
    if (diff > 0) return { diff, direction: 'up', pct }
    if (diff < 0) return { diff: Math.abs(diff), direction: 'down', pct: Math.abs(pct) }
    return { diff: 0, direction: 'neutral', pct: 0 }
}

function formatChange(
    current: number,
    previous: number | null | undefined,
    invertColors: boolean,
    usePercentage: boolean
): ChangeInfo {
    const change = calcChange(current, previous)
    const isNeutral = change.direction === 'neutral' || (usePercentage ? change.pct === 0 : change.diff === 0)
    if (isNeutral) return { color: COLORS.slate300, text: usePercentage ? '0%' : '0' }
    const color = resolveChangeColor(change.direction, invertColors)
    const magnitude = usePercentage ? change.pct : change.diff
    const suffix = usePercentage ? '%' : ''
    const sign = change.direction === 'up' ? '+' : '-'
    return { color, text: `${sign}${magnitude}${suffix}` }
}

export function getChangeText(current: number, previous: number | null | undefined, invertColors = false): ChangeInfo {
    return formatChange(current, previous, invertColors, true)
}

export function getChangeValue(current: number, previous: number | null | undefined, invertColors = false): ChangeInfo {
    return formatChange(current, previous, invertColors, false)
}
