import { ReportUtility } from '../../utils/ReportUtility'

const _now = new Date()

/** Default date-range bounds shared by the Quality and Review tabs. */
export const currentMonthStartIso = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().slice(0, 10)
export const currentMonthEndIso = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().slice(0, 10)
/** Loss Reports defaults to the full calendar year — incidents are sparse and
 *  a month-only window almost always renders an empty list, forcing the user
 *  to widen the range manually on every visit. */
export const currentYearStartIso = new Date(_now.getFullYear(), 0, 1).toISOString().slice(0, 10)
export const currentYearEndIso = new Date(_now.getFullYear(), 11, 31).toISOString().slice(0, 10)

export const REPORTS_START_DATE = new Date('2025-07-20')

export const labelForOffset = (weeksAgo) => {
    if (weeksAgo === -1) return 'Next Week'
    if (weeksAgo === 0) return 'This Week'
    if (weeksAgo === 1) return 'Last Week'
    if (weeksAgo < 0) return `${Math.abs(weeksAgo)} weeks ahead`
    return `${weeksAgo} weeks ago`
}

export const formatRange = (weekIso) => {
    if (!weekIso) return ''
    const { monday, saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
    if (!monday || !saturday) return ''
    const left = monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    const right = saturday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return `${left} – ${right}`
}

const addDays = (date, days) => {
    const out = new Date(date)
    out.setDate(out.getDate() + days)
    return out
}

const isoOf = (date) => date.toISOString().slice(0, 10)

export const weekIsoOffset = (baseIso, weeksOffset) => {
    if (!baseIso) return ''
    const base = new Date(baseIso)
    if (Number.isNaN(base.getTime())) return ''
    return isoOf(addDays(base, weeksOffset * 7))
}

/**
 * Two-column split layout for the My Reports / Review tabs. The rail
 * collapses with an animated width interpolation when `data-collapsed="true"`
 * is set on the parent (lg+ only). Below lg the rail stacks beneath the main
 * column. Defined here as constants so the four render sites stay in sync.
 */
export const RV_SPLIT_PARENT = 'group flex flex-col items-stretch gap-4 lg:flex-row lg:items-start'
export const RV_SPLIT_LEFT = 'flex flex-col gap-3 min-w-0 flex-1'
export const RV_SPLIT_RAIL_SLOT =
    'min-w-0 overflow-hidden lg:w-[320px] lg:opacity-100 lg:translate-x-0 lg:[transform-origin:right_top] lg:[transition:width_900ms_cubic-bezier(0.65,0,0.35,1),margin-left_900ms_cubic-bezier(0.65,0,0.35,1),opacity_650ms_cubic-bezier(0.4,0,0.2,1),transform_900ms_cubic-bezier(0.65,0,0.35,1)] lg:[will-change:width,opacity,transform] group-data-[collapsed=true]:lg:w-0 group-data-[collapsed=true]:lg:-ml-4 group-data-[collapsed=true]:lg:opacity-0 group-data-[collapsed=true]:lg:translate-x-7'
export const RV_RAIL_FIXED = 'w-full lg:w-[320px]'
