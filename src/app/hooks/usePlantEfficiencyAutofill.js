import { useEffect } from 'react'

/**
 * Pushes ticket-aggregate and Dayforce-punch data into the Plant Efficiency
 * Report's `form.rows` whenever either source refreshes.
 *
 * Override-aware semantics (applied per field, per row):
 *   - `_overrides[field] === true` → user opted into manual entry; auto-fill
 *     skips this field for this row entirely.
 *   - Auto value present + no override → write the auto value.
 *   - Auto value MISSING + no override → preserve whatever the user already
 *     typed instead of wiping it. Dummy-proof fallback so an offline ticket
 *     fetch (or a brand-new operator with no name match) doesn't blow away a
 *     manual entry.
 *
 * Reference-equality bail-out: when no row's target values changed, the
 * `setForm` updater returns the existing state so unrelated field edits
 * don't cascade through autosave or re-renders.
 *
 * `eod_in_yard` stays manual — it's the truck-back-in-yard time, distinct
 * from the operator's Dayforce clock-out.
 *
 * @param {Object} args
 * @param {boolean} args.isPlantProduction - True only for the Plant Efficiency Report.
 * @param {boolean} args.efficiencyTicketsReady - Ticket aggregates finished loading.
 * @param {Object} args.efficiencyAggregates - { [operatorName]: { firstLoad, loads } }.
 * @param {boolean} args.dayforcePunchesReady - Dayforce punches finished loading.
 * @param {Object} args.dayforcePunches - { [operatorName]: { startTime, punchOut } }.
 * @param {Function} args.setForm - State setter from useSubmitForm.
 */
export function usePlantEfficiencyAutofill({
    dayforcePunches,
    dayforcePunchesReady,
    efficiencyAggregates,
    efficiencyTicketsReady,
    isPlantProduction,
    setForm
}) {
    useEffect(() => {
        if (!isPlantProduction || !efficiencyTicketsReady) return
        setForm((f) => {
            const rows = Array.isArray(f.rows) ? f.rows : []
            if (rows.length === 0) return f
            let changed = false
            const nextRows = rows.map((row) => {
                const agg = efficiencyAggregates[row.name]
                const overrides = row._overrides || {}
                const dayforceFirstLoad = agg?.firstLoad || ''
                const dayforceLoads = agg?.loads != null ? String(agg.loads) : ''
                const targetFirstLoad = overrides.first_load ? row.first_load : dayforceFirstLoad || row.first_load
                const targetLoads = overrides.loads ? row.loads : dayforceLoads || row.loads
                if (row.first_load === targetFirstLoad && row.loads === targetLoads) return row
                changed = true
                return { ...row, first_load: targetFirstLoad, loads: targetLoads }
            })
            return changed ? { ...f, rows: nextRows } : f
        })
    }, [isPlantProduction, efficiencyTicketsReady, efficiencyAggregates, setForm])

    useEffect(() => {
        if (!isPlantProduction || !dayforcePunchesReady) return
        setForm((f) => {
            const rows = Array.isArray(f.rows) ? f.rows : []
            if (rows.length === 0) return f
            let changed = false
            const nextRows = rows.map((row) => {
                const punch = dayforcePunches[row.name]
                const overrides = row._overrides || {}
                const targetStartTime = overrides.start_time ? row.start_time : punch?.startTime || row.start_time
                const targetPunchOut = overrides.punch_out ? row.punch_out : punch?.punchOut || row.punch_out
                if (row.start_time === targetStartTime && row.punch_out === targetPunchOut) return row
                changed = true
                return { ...row, punch_out: targetPunchOut, start_time: targetStartTime }
            })
            return changed ? { ...f, rows: nextRows } : f
        })
    }, [isPlantProduction, dayforcePunchesReady, dayforcePunches, setForm])
}
