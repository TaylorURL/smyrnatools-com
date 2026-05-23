/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { clean, getOrderStatus } from '../../../../../utils/PlanScheduleUtility'
import { diffScheduleAgainstSnapshot, SCHEDULE_DIFF_FIELDS } from '../../../../../utils/ScheduleDiffUtility'

/* Field-level breakdown shown inside the "Changed" pill. The order
 * mirrors `ScheduleDiffUtility.TRACKED_FIELDS` so the most operationally
 * relevant signals (time, spacing, yardage, plant, address) lead. Each
 * tuple is [diff field key, short display label]. Any tracked field not
 * listed rolls into the trailing "Other" bucket so the strip stays
 * compact without losing the rest of the diff. */
const PRIMARY_FIELDS = [
    ['startTime', 'Time'],
    ['rate', 'Spacing'],
    ['yardage', 'Yardage'],
    ['truckCount', 'Trucks'],
    ['plantCode', 'Plant'],
    ['address', 'Address'],
    ['city', 'City'],
    ['customer', 'Customer'],
    ['productCode', 'Product'],
    ['loadSize', 'Load size']
]
const PRIMARY_KEY_SET = new Set(PRIMARY_FIELDS.map(([key]) => key))
const HAS_OTHER_TRACKED_FIELDS = SCHEDULE_DIFF_FIELDS.some(({ key }) => !PRIMARY_KEY_SET.has(key))

/* `clean` lowercases + trims for case-insensitive query matching;
 * mirrors the predicate used by `computeScheduleHeadlineMetrics` so the
 * change strip respects the same filter pipeline as the headline numbers
 * — the dispatcher's filter selection narrows both views identically. */
function matchesFilters(order, filters, isViewingToday) {
    if (!order) return false
    const {
        minYards = 0,
        plantFilterSet,
        productFilter = 'all',
        query = '',
        showCancelled = false,
        showTest = false,
        statusFilter = 'all'
    } = filters || {}
    if (plantFilterSet?.size > 0 && !plantFilterSet.has(order.plantCode)) return false
    const kind = getOrderStatus(order.startTime, { isToday: isViewingToday })?.kind || 'scheduled'
    if (kind === 'cancelled' && !showCancelled) return false
    if (kind === 'test' && !showTest) return false
    if (statusFilter && statusFilter !== 'all' && kind !== statusFilter) return false
    if (productFilter && productFilter !== 'all' && clean(order.productCode) !== productFilter) return false
    const minYd = parseFloat(minYards) || 0
    if (minYd > 0 && (parseFloat(order.yardage) || 0) < minYd) return false
    const q = String(query || '')
        .trim()
        .toLowerCase()
    if (q) {
        const haystack = [
            order.orderNum,
            order.customer,
            order.customerNum,
            order.address,
            order.city,
            order.productCode,
            order.description,
            order.contact,
            order.phone,
            order.poNumber,
            order.jobNumber,
            order.plantCode
        ]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase())
            .join(' | ')
        if (!haystack.includes(q)) return false
    }
    return true
}

/* Diff entries point at the live order for added/changed and the
 * snapshot order for removed; the filter has to inspect whichever one
 * exists so a "removed" order doesn't get rendered out by a plant filter
 * that already excluded it from the live schedule. */
function entryMatchesFilters(entry, filters, isViewingToday) {
    const order = entry.liveOrder || entry.snapshotOrder
    return matchesFilters(order, filters, isViewingToday)
}

/* Distinguish "moved earlier" from "moved later" within the time
 * change bucket — the dispatcher reads those two scenarios very
 * differently (earlier = pull-up risk, later = customer pushed). Falls
 * back to a single "Time" count when neither direction is meaningful
 * (e.g. only the seconds shifted). */
function classifyTimeShift(change) {
    if (!change) return null
    const beforeStr = String(change.before || '').trim()
    const afterStr = String(change.after || '').trim()
    if (!beforeStr || !afterStr || beforeStr === '—' || afterStr === '—') return null
    const toMinutes = (value) => {
        const m = value.match(/^(\d{1,2}):(\d{2})$/)
        if (!m) return null
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    }
    const before = toMinutes(beforeStr)
    const after = toMinutes(afterStr)
    if (before == null || after == null || before === after) return null
    return after < before ? 'earlier' : 'later'
}

const PILL_TONES = {
    added: { background: 'rgba(22, 163, 74, 0.12)', color: 'var(--text-primary)' },
    changed: { background: 'rgba(245, 158, 11, 0.14)', color: 'var(--text-primary)' },
    neutral: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
    removed: { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--text-primary)' }
}

function ChangePill({ count, label, tone = 'neutral', sign = '' }) {
    const palette = PILL_TONES[tone] || PILL_TONES.neutral
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums"
            style={palette}
        >
            <span className="font-mono font-bold tracking-tight">
                {sign}
                {count.toLocaleString()}
            </span>
            <span className="font-medium">{label}</span>
        </span>
    )
}

/**
 * Compare-mode strip surfacing how the live schedule has shifted from
 * its 5:30 PM snapshot. Renders three headline counts (added / removed
 * / changed) plus a per-field breakdown of what's actually different on
 * the changed orders — so the dispatcher reads "12 changed (5 Time · 3
 * Spacing · 2 Yardage)" instead of just a net total. The strip respects
 * the same filter pipeline as the headline `PlanScheduleStatStrip`, so
 * filtering down to one plant narrows the change metrics to that plant
 * too. Renders nothing when there are zero diffs after filtering — the
 * "no changes" state is more usefully expressed by the absence of the
 * strip than a flat zero row.
 */
export default function PlanScheduleChangeStrip({ filters, isViewingToday = false, rawPlantProduction, snapshot }) {
    const diff = useMemo(() => {
        if (!snapshot?.plant_production || !rawPlantProduction) return null
        return diffScheduleAgainstSnapshot(snapshot, rawPlantProduction)
    }, [snapshot, rawPlantProduction])

    const tally = useMemo(() => {
        if (!diff) return null
        const filteredAdded = diff.added.filter((e) => entryMatchesFilters(e, filters, isViewingToday))
        const filteredRemoved = diff.removed.filter((e) => entryMatchesFilters(e, filters, isViewingToday))
        const filteredChanged = diff.changed.filter((e) => entryMatchesFilters(e, filters, isViewingToday))
        const fieldCounts = new Map()
        let earlierMoves = 0
        let laterMoves = 0
        let otherCount = 0
        for (const entry of filteredChanged) {
            for (const change of entry.changes) {
                if (change.field === 'startTime') {
                    const direction = classifyTimeShift(change)
                    if (direction === 'earlier') earlierMoves += 1
                    else if (direction === 'later') laterMoves += 1
                    fieldCounts.set('startTime', (fieldCounts.get('startTime') || 0) + 1)
                    continue
                }
                if (PRIMARY_KEY_SET.has(change.field)) {
                    fieldCounts.set(change.field, (fieldCounts.get(change.field) || 0) + 1)
                } else {
                    otherCount += 1
                }
            }
        }
        return {
            added: filteredAdded.length,
            changed: filteredChanged.length,
            earlierMoves,
            fieldCounts,
            laterMoves,
            otherCount,
            removed: filteredRemoved.length
        }
    }, [diff, filters, isViewingToday])

    if (!tally) return null
    const totalDiff = tally.added + tally.removed + tally.changed
    if (totalDiff === 0) return null

    return (
        <div
            className="rounded-xl flex flex-wrap items-center gap-2 px-3 py-2.5 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-sm)' }}
        >
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mr-1">
                Changes since 5:30 PM
            </span>
            {tally.added > 0 && <ChangePill tone="added" sign="+" count={tally.added} label="Added" />}
            {tally.removed > 0 && <ChangePill tone="removed" sign="-" count={tally.removed} label="Removed" />}
            {tally.changed > 0 && <ChangePill tone="changed" count={tally.changed} label="Changed" />}
            {tally.changed > 0 && (
                <span className="text-[11px] text-text-tertiary mx-0.5" aria-hidden="true">
                    ·
                </span>
            )}
            {PRIMARY_FIELDS.map(([key, label]) => {
                const count = tally.fieldCounts.get(key)
                if (!count) return null
                /* Split the time bucket into "X earlier / Y later" when
                 * both directions are represented; collapse to a single
                 * "Time" pill when every move went the same way. */
                if (key === 'startTime' && (tally.earlierMoves > 0 || tally.laterMoves > 0)) {
                    const labels = []
                    if (tally.earlierMoves > 0) labels.push(`${tally.earlierMoves} earlier`)
                    if (tally.laterMoves > 0) labels.push(`${tally.laterMoves} later`)
                    return <ChangePill key={key} count={count} label={`Time (${labels.join(' · ')})`} />
                }
                return <ChangePill key={key} count={count} label={label} />
            })}
            {HAS_OTHER_TRACKED_FIELDS && tally.otherCount > 0 && (
                <ChangePill count={tally.otherCount} label="Other fields" />
            )}
        </div>
    )
}
