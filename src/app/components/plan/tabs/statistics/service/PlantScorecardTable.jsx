import React, { useMemo, useState } from 'react'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel, formatColocatedPlantLabel } from '../../../../../../utils/PlantColocationUtility'
import Badge from '../../../../common/Badge'
import { fmtMinutes } from './serviceShared'

/* Semantic tone for the Good % pill. Mirrors the bands in
 * `goodPctColor` so the swap from inline hex backgrounds to the
 * shared Badge palette doesn't shift the visual hierarchy: green for
 * healthy, amber for marginal, red for failing. */
const goodPctTone = (pct) => {
    if (pct >= 0.75) return 'success'
    if (pct >= 0.6) return 'warning'
    return 'danger'
}

function ColumnHeader({ active, direction, label, numeric, onClick, title }) {
    const arrow = !active ? '' : direction === 'asc' ? ' ↑' : ' ↓'
    return (
        <th
            onClick={onClick}
            title={title}
            className={`text-[10.5px] font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap cursor-pointer select-none border-b border-border-light bg-bg-tertiary text-text-tertiary ${
                numeric ? 'text-right' : 'text-left'
            }`}
        >
            <span className={active ? 'text-text-primary' : undefined}>
                {label}
                {arrow}
            </span>
        </th>
    )
}

export default function PlantScorecardTable({ colocationMap, plantNameByCode, rows }) {
    const [sortKey, setSortKey] = useState('goodPct')
    const [sortDir, setSortDir] = useState('desc')
    const toggleSort = (key, defaultDir) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        else {
            setSortKey(key)
            setSortDir(defaultDir || 'desc')
        }
    }
    const sorted = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1
        /* Tier sort keys (`notGood`, `bad`, `veryBad`) live on the nested
         * `tierCounts` object, not directly on the row. Resolve those
         * inline before falling through to the generic numeric compare. */
        const valueOf = (row) => {
            if (sortKey === 'notGood') return row.tierCounts?.notGood ?? 0
            if (sortKey === 'bad') return row.tierCounts?.bad ?? 0
            if (sortKey === 'veryBad') return row.tierCounts?.veryBad ?? 0
            return row[sortKey]
        }
        const cmp = (a, b) => {
            if (sortKey === 'plant') {
                const al = formatColocatedPlantLabel(a.code, plantNameByCode, colocationMap)
                const bl = formatColocatedPlantLabel(b.code, plantNameByCode, colocationMap)
                return al.localeCompare(bl) * dir
            }
            const av = valueOf(a)
            const bv = valueOf(b)
            const an = av == null ? -Infinity : av
            const bn = bv == null ? -Infinity : bv
            return (an - bn) * dir
        }
        return [...rows].sort(cmp)
    }, [rows, sortKey, sortDir, plantNameByCode, colocationMap])

    return (
        <div className="overflow-x-auto rounded border border-border-light">
            <table className="w-full min-w-[820px] border-collapse">
                <thead>
                    <tr>
                        <ColumnHeader
                            active={sortKey === 'plant'}
                            direction={sortDir}
                            label="Plant"
                            onClick={() => toggleSort('plant', 'asc')}
                        />
                        <ColumnHeader
                            active={sortKey === 'jobs'}
                            direction={sortDir}
                            label="Jobs"
                            numeric
                            onClick={() => toggleSort('jobs')}
                        />
                        <ColumnHeader
                            active={sortKey === 'goodJobs'}
                            direction={sortDir}
                            label="Good"
                            numeric
                            onClick={() => toggleSort('goodJobs')}
                        />
                        <ColumnHeader
                            active={sortKey === 'notGood'}
                            direction={sortDir}
                            label="Not Good"
                            numeric
                            onClick={() => toggleSort('notGood')}
                            title="Orders 15–29 min late"
                        />
                        <ColumnHeader
                            active={sortKey === 'bad'}
                            direction={sortDir}
                            label="Bad"
                            numeric
                            onClick={() => toggleSort('bad')}
                            title="Orders 30–60 min late"
                        />
                        <ColumnHeader
                            active={sortKey === 'veryBad'}
                            direction={sortDir}
                            label="Very Bad"
                            numeric
                            onClick={() => toggleSort('veryBad')}
                            title="Orders > 60 min late"
                        />
                        <ColumnHeader
                            active={sortKey === 'slowJobs'}
                            direction={sortDir}
                            label="Slow"
                            numeric
                            onClick={() => toggleSort('slowJobs')}
                            title="Pour rate below 70% of requested — separate from lateness"
                        />
                        <ColumnHeader
                            active={sortKey === 'goodPct'}
                            direction={sortDir}
                            label="Good %"
                            numeric
                            onClick={() => toggleSort('goodPct')}
                        />
                        <ColumnHeader
                            active={sortKey === 'avgLateMin'}
                            direction={sortDir}
                            label="Avg late"
                            numeric
                            onClick={() => toggleSort('avgLateMin')}
                        />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((row) => {
                        const codeLabel = formatColocatedCodeLabel(row.code, colocationMap)
                        const plantLabel = formatColocatedPlantLabel(row.code, plantNameByCode, colocationMap)
                        return (
                            <tr key={row.code} className="border-t border-border-light">
                                <td className="px-3 py-2 text-[12.5px] text-text-primary">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                                            {codeLabel}
                                        </span>
                                        <span className="font-semibold">{plantLabel}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-primary">
                                    {fmtInt(row.jobs)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {fmtInt(row.goodJobs)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {fmtInt(row.tierCounts?.notGood || 0)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {fmtInt(row.tierCounts?.bad || 0)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums font-semibold text-text-secondary">
                                    {fmtInt(row.tierCounts?.veryBad || 0)}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {fmtInt(row.slowJobs)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {row.goodPct == null || !Number.isFinite(row.goodPct) ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        <Badge
                                            tone={goodPctTone(row.goodPct)}
                                            variant="solid"
                                            size="md"
                                            shape="rounded-md"
                                            uppercase={false}
                                            className="tabular-nums justify-center"
                                        >
                                            {Math.round(row.goodPct * 100)}%
                                        </Badge>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-text-secondary">
                                    {row.lateJobs > 0 ? fmtMinutes(row.avgLateMin) : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
