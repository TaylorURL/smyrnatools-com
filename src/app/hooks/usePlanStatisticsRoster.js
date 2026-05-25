import { useEffect, useState } from 'react'

import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'

/**
 * Owns the active-mixer + operator-roster fetches used by `usePlanStatistics`.
 *
 * Both fetches are gated behind `operatorsEnabled` and run at most once per
 * session — the rosters rarely change while the Statistics tab is open, so
 * subsequent visits reuse the cached state.
 *
 * IMPORTANT: the loading flags (`mixersLoading` / `operatorRosterLoading`)
 * are deliberately NOT in the deps arrays. They get flipped to `true` INSIDE
 * each effect, which would otherwise:
 *   1. Trigger a re-render
 *   2. Re-fire the effect (loading flag changed)
 *   3. Run cleanup on the previous closure → `cancelled = true`
 *   4. Skip the guard (loading is true now), bail out
 *   5. The original fetch completes, hits `if (cancelled) return`, and
 *      NEVER calls `setActiveMixers`/`setOperatorRoster`
 * → both rosters stay null forever, every ticket falls into the unmatched
 *   bucket. The guard uses the data state itself (`!== null`) so the loading
 *   flag is still surfaced to the UI but doesn't participate in dep diffing.
 *
 * @param {Object} args
 * @param {boolean} args.operatorsEnabled - When false the hook does nothing.
 * @returns {{
 *   activeMixers: Array | null,
 *   mixersLoading: boolean,
 *   operatorRoster: Array | null,
 *   operatorRosterLoading: boolean
 * }}
 */
export function usePlanStatisticsRoster({ operatorsEnabled }) {
    const [activeMixers, setActiveMixers] = useState(null)
    const [mixersLoading, setMixersLoading] = useState(false)
    const [operatorRoster, setOperatorRoster] = useState(null)
    const [operatorRosterLoading, setOperatorRosterLoading] = useState(false)

    useEffect(() => {
        if (!operatorsEnabled) return undefined
        if (activeMixers !== null) return undefined
        let cancelled = false
        setMixersLoading(true)
        ;(async () => {
            try {
                const mixers = await MixerService.fetchMixers()
                if (cancelled) return
                const active = (mixers || []).filter(
                    (m) => m && m.status === 'Active' && m.assignedOperator && m.truckNumber
                )
                setActiveMixers(active)
            } catch (err) {
                console.warn('[usePlanStatisticsRoster] mixer fetch failed', err?.message || err)
                if (!cancelled) setActiveMixers([])
            } finally {
                if (!cancelled) setMixersLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operatorsEnabled, activeMixers])

    useEffect(() => {
        if (!operatorsEnabled) return undefined
        if (operatorRoster !== null) return undefined
        let cancelled = false
        setOperatorRosterLoading(true)
        ;(async () => {
            try {
                const operators = await OperatorService.getAllOperators()
                if (cancelled) return
                setOperatorRoster(operators || [])
            } catch (err) {
                console.warn('[usePlanStatisticsRoster] operator fetch failed', err?.message || err)
                if (!cancelled) setOperatorRoster([])
            } finally {
                if (!cancelled) setOperatorRosterLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [operatorsEnabled, operatorRoster])

    return { activeMixers, mixersLoading, operatorRoster, operatorRosterLoading }
}

export default usePlanStatisticsRoster
