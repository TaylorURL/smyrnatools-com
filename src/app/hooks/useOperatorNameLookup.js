import { useEffect, useState } from 'react'

import { OperatorService } from '../../services/OperatorService'

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

/** Roman numerals + generation suffixes that should stay uppercase. */
const KEEP_UPPER = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'])

/**
 * Normalises a person's name to a consistent Title Case display. The dispatch
 * data and the operator records themselves are a mix of ALL-CAPS, mixed-case,
 * and the occasional all-lowercase row. Every consumer (Tickets modal,
 * Operators stats tab, etc.) routes through this helper so the same person
 * reads the same way no matter where they appear.
 *
 *   "BOBBY JOHNSON JR."      → "Bobby Johnson Jr."
 *   "mary-anne o'brien"      → "Mary-Anne O'Brien"
 *   "JOHN III"               → "John III"
 */
export function formatPersonName(name) {
    const raw = String(name ?? '').trim()
    if (!raw) return ''
    // Split on whitespace, hyphens and apostrophes but KEEP the delimiters so
    // "Mary-Anne O'Brien" rebuilds with its original punctuation.
    return raw
        .toLowerCase()
        .split(/(\s+|-|')/)
        .map((part) => {
            if (!part || /^[\s\-']+$/.test(part)) return part
            const upper = part.toUpperCase()
            if (KEEP_UPPER.has(upper)) return upper
            return part.charAt(0).toUpperCase() + part.slice(1)
        })
        .join('')
}

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
