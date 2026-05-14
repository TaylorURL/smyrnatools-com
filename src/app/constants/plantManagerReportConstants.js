/* Plant Manager report constants — table/input class strings and YPH
 * grading vocabulary. Shared design tokens live in
 * weeklyReportConstants.js. */

import { SECTION_LABEL_CLASS } from './weeklyReportConstants'

export const PM_TH = `${SECTION_LABEL_CLASS} text-left px-3 py-2 whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`

export const PM_TD = 'px-3 py-2 text-[12px] align-top text-text-primary border-t border-border-light'

export const PM_INPUT =
    'rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-1 focus:ring-[var(--border-medium)] box-border'

export const GRADE_COLORS = {
    average: '#d97706',
    excellent: '#16a34a',
    good: '#0ea5e9',
    poor: '#dc2626'
}

export const YPH_GRADES = ['excellent', 'good', 'average', 'poor']

/** Format a numeric YPH for display — two-decimal fixed string, or "--"
 *  when the value isn't a finite number. */
export function formatYphValue(value) {
    const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '--'
}
