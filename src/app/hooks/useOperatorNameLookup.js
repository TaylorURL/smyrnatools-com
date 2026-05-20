import { useEffect, useState } from 'react'

import { OperatorService } from '../../services/OperatorService'
import { formatPersonName } from '../../utils/OperatorNameLookupUtility'

// Re-export so existing consumers (`import { formatPersonName } from './useOperatorNameLookup'`)
// keep working without churn. The implementation now lives in the shared
// utility alongside `nameLookupVariants` so every operator-name normalizer
// has one source of truth.
export { formatPersonName }

/* Module-level promise so the operator roster is fetched once per session and
 * shared across every consumer of this hook. Subsequent mounts resolve
 * synchronously off the cached promise — no extra network round-trip when the
 * Tickets modal opens, the Operators stats tab loads, or the verification
 * flow needs the same data. */
let rosterPromise = null
let rosterCache = null

function loadRoster() {
    if (rosterCache) return Promise.resolve(rosterCache)
    if (!rosterPromise) {
        rosterPromise = OperatorService.getAllOperators()
            .then((rows) => {
                rosterCache = rows || []
                return rosterCache
            })
            .catch((err) => {
                console.warn('[useOperatorNameLookup] roster fetch failed', err?.message || err)
                rosterPromise = null
                rosterCache = []
                return rosterCache
            })
    }
    return rosterPromise
}

const normalize = (value) =>
    String(value ?? '')
        .trim()
        .toUpperCase()

/**
 * Returns a `resolve(rawName, driverNum?)` function that maps the dispatch
 * `driver_name` / `driver_num` fields to the canonical operator name stored
 * on the operator record — the same name shown on Mixer detail, the
 * verification modal, and the Statistics → Operators tab.
 *
 * Bridges in this order:
 *   1. `driverNum` ↔ `operator.smyrnaId`
 *   2. case-insensitive `driverName` ↔ `operator.name`
 *
 * Falls back to the dispatch-reported name (or `Driver #<num>`) when no
 * operator record resolves, so the column never shows blank.
 */
export function useOperatorNameLookup() {
    const [roster, setRoster] = useState(rosterCache)

    useEffect(() => {
        if (rosterCache) {
            setRoster(rosterCache)
            return undefined
        }
        let cancelled = false
        loadRoster().then((rows) => {
            if (!cancelled) setRoster(rows)
        })
        return () => {
            cancelled = true
        }
    }, [])

    const bySmyrnaId = new Map()
    const byName = new Map()
    ;(roster || []).forEach((op) => {
        const sid = String(op?.smyrnaId ?? '').trim()
        if (sid) bySmyrnaId.set(sid, op)
        const nameKey = normalize(op?.name)
        if (!nameKey) return
        const existing = byName.get(nameKey)
        if (!existing || (existing.status !== 'Active' && op.status === 'Active')) {
            byName.set(nameKey, op)
        }
    })

    const resolve = (rawName, driverNum) => {
        const num = String(driverNum ?? '').trim()
        const raw = String(rawName ?? '').trim()
        const fromId = num ? bySmyrnaId.get(num) : null
        const fromName = raw ? byName.get(normalize(raw)) : null
        const op = fromId || fromName || null
        const canonical = op?.name?.trim()
        if (canonical) return formatPersonName(canonical)
        if (raw) return formatPersonName(raw)
        if (num) return `Driver #${num}`
        return ''
    }

    return { ready: roster !== null, resolve, roster: roster || [] }
}

export default useOperatorNameLookup
