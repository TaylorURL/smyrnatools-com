import { useMemo } from 'react'

/**
 * Split the flat `loadsByOperator` array into segments when a single plant
 * is filtered — Assigned / Visiting / Unmatched — so dispatchers can tell
 * who's home-planted there versus who only loaded there in this window.
 * When no plant is filtered, returns a single "all" segment so the
 * cross-fleet "Most loads overall" view still works untouched.
 */
export function useOperatorSegments(loadsByOperator, selectedPlant) {
    return useMemo(() => {
        if (loadsByOperator.length === 0) return []
        const target = selectedPlant ? String(selectedPlant).trim() : ''
        if (!target) return [{ header: null, key: 'all', rows: loadsByOperator }]
        const assigned = []
        const visiting = []
        const unmatched = []
        for (const row of loadsByOperator) {
            if (row.unmatched) {
                unmatched.push(row)
                continue
            }
            if (row.homePlant && String(row.homePlant).trim() === target) {
                assigned.push(row)
            } else {
                visiting.push(row)
            }
        }
        const segments = []
        if (assigned.length > 0) {
            segments.push({
                header: {
                    count: assigned.length,
                    hint: `Home plant · ${target}`,
                    title: `Assigned to ${target}`
                },
                key: 'assigned',
                rows: assigned
            })
        }
        if (visiting.length > 0) {
            segments.push({
                header: {
                    count: visiting.length,
                    hint: 'Loaded here but assigned to another plant',
                    title: `Visiting · loaded at ${target}`
                },
                key: 'visiting',
                rows: visiting
            })
        }
        if (unmatched.length > 0) {
            segments.push({
                header: {
                    count: unmatched.length,
                    hint: 'Ticket name did not resolve to an operator record',
                    title: 'Unmatched'
                },
                key: 'unmatched',
                rows: unmatched
            })
        }
        return segments
    }, [loadsByOperator, selectedPlant])
}
