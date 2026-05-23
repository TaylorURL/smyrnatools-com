import { useMemo, useState } from 'react'

/** Available sort modes per page. Each entry is `[id, label, comparator]`
 *  — comparator returns the b > a delta so default order is descending
 *  for "biggest first" (which is what users want for cost / hours). */
export const SORT_OPTIONS = {
    cost: { compare: (a, b) => b.totalCost - a.totalCost, label: 'Highest cost' },
    // Most-recent shift first. Tie-break by operator name so a single
    // day reads predictably across rows. Schedules page default.
    dateDesc: {
        compare: (a, b) => {
            const cmp = String(b.shiftDate).localeCompare(String(a.shiftDate))
            return cmp !== 0 ? cmp : String(a.name).localeCompare(String(b.name))
        },
        label: 'Most recent day'
    },
    hours: { compare: (a, b) => b.actualHours - a.actualHours, label: 'Most hours' },
    name: { compare: (a, b) => String(a.name).localeCompare(String(b.name)), label: 'Name (A–Z)' },
    // Operator name, then chronological — useful for "show me this
    // operator's whole week".
    operator: {
        compare: (a, b) => {
            const cmp = String(a.name).localeCompare(String(b.name))
            return cmp !== 0 ? cmp : String(a.shiftDate).localeCompare(String(b.shiftDate))
        },
        label: 'Operator (A–Z)'
    },
    ot: { compare: (a, b) => b.otHours - a.otHours, label: 'Most overtime' },
    varianceDesc: {
        compare: (a, b) => Math.abs(b.actualHours - b.scheduledHours) - Math.abs(a.actualHours - a.scheduledHours),
        label: 'Largest variance'
    },
    yards: { compare: (a, b) => (b.yards || 0) - (a.yards || 0), label: 'Most yards' },
    yph: { compare: (a, b) => (b.yph || 0) - (a.yph || 0), label: 'Highest YPH' }
}

/** Distinct, sorted list of operator positions present in the rows.
 *  Built lazily inside the hook so the dropdown only ever offers values
 *  that exist in the current data set. */
const collectPositions = (rows) => {
    const set = new Set()
    for (const r of rows) if (r.position) set.add(r.position)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/**
 * Filter + sort state for the Dayforce operator pages. Holds search
 * text, role/position selection, and sort mode; returns a
 * filtered/sorted copy of `rows` plus the controls.
 *
 * Same hook used by both Hours and Labor Cost so the filter UI behaves
 * identically across the two surfaces.
 */
export default function useDayforceOperatorFilters({ defaultSort = 'hours', rows }) {
    const [search, setSearch] = useState('')
    const [position, setPosition] = useState('all')
    const [sort, setSort] = useState(defaultSort)

    const availablePositions = useMemo(() => collectPositions(rows), [rows])

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        let out = rows
        if (term) {
            out = out.filter(
                (r) =>
                    String(r.name).toLowerCase().includes(term) ||
                    String(r.badge || '')
                        .toLowerCase()
                        .includes(term) ||
                    String(r.plantCode || '')
                        .toLowerCase()
                        .includes(term)
            )
        }
        if (position !== 'all') out = out.filter((r) => r.position === position)
        const cmp = SORT_OPTIONS[sort]?.compare
        if (cmp) out = [...out].sort(cmp)
        return out
    }, [position, rows, search, sort])

    return {
        availablePositions,
        controls: { position, search, sort },
        filtered,
        reset() {
            setSearch('')
            setPosition('all')
            setSort(defaultSort)
        },
        setPosition,
        setSearch,
        setSort
    }
}
