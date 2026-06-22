/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { fmtInt, fmtRange, fmtYards } from '../../../../../utils/PlanStatisticsFormatUtility'
import { formatColocatedCodeLabel } from '../../../../../utils/PlantColocationUtility'
import { plantBadgeColor } from '../../../../../utils/PlanUtility'
import Badge from '../../../common/Badge'
import StarRating from '../../../common/StarRating'
import { Panel } from '../../../ui/Panel'

/** 1-to-5 star score row. Null score renders as an em-dash so a plant that
 *  simply didn't participate isn't conflated with a balanced one. */
function StarScore({ score, total = 5 }) {
    if (score == null) {
        return <span className="text-[12px] text-text-tertiary">—</span>
    }
    return (
        <StarRating
            value={score}
            max={total}
            tone="warning"
            size="sm"
            ariaLabel={`Help score ${Math.round(score)} of ${total}`}
        />
    )
}

/** Recipients column — each destination plant on its own line with
 *  the directional arrow + full plant label + count and explicit unit,
 *  so the dispatcher reads "→ 403 Baytown — 8 operators" instead of
 *  guessing what the bare number means. */
function RecipientList({ items, getPrimary, max = 4, plantNameByCode, unitLabel, colocationMap }) {
    const ranked = useMemo(
        () => [...items].filter((it) => getPrimary(it) > 0).sort((a, b) => getPrimary(b) - getPrimary(a)),
        [items, getPrimary]
    )
    if (ranked.length === 0) {
        return <span className="text-text-tertiary text-[11.5px]">None</span>
    }
    const shown = ranked.slice(0, max)
    const extra = ranked.length - shown.length
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            {shown.map((it) => {
                const codeLabel = formatColocatedCodeLabel(it.code, colocationMap)
                const name = plantNameByCode?.[it.code] || ''
                const count = getPrimary(it)
                /* Choose the right formatter per unit — yards must preserve
                 * halves; driver / ticket / order counts stay integers. */
                const isYardage = unitLabel === 'yd³'
                const formatted = isYardage ? fmtYards(count) : fmtInt(count)
                return (
                    <div
                        key={it.code}
                        className="flex items-center gap-1.5 text-[11.5px] min-w-0"
                        title={`${formatted} ${unitLabel} → ${name || codeLabel}`}
                    >
                        <i
                            className="fas fa-arrow-right text-[9px] shrink-0"
                            aria-hidden="true"
                            style={{ color: 'var(--text-primary)' }}
                        />
                        <span className="font-mono tabular-nums font-semibold text-text-primary shrink-0">
                            {codeLabel}
                        </span>
                        {name && <span className="truncate text-text-secondary">{name}</span>}
                        <span className="text-text-tertiary">—</span>
                        <span
                            className="font-mono tabular-nums font-semibold whitespace-nowrap"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {formatted} {unitLabel}
                        </span>
                    </div>
                )
            })}
            {extra > 0 && (
                <span className="text-[10.5px] text-text-tertiary">
                    + {extra} more recipient{extra === 1 ? '' : 's'}
                </span>
            )}
        </div>
    )
}

const SCORE_BANDS = [
    { label: 'Heavy net giver — gives ≥ 10% more than receives', stars: 5 },
    { label: 'Mild net giver — gives 3–10% more', stars: 4 },
    { label: 'Balanced — within ±3% (or no production data)', stars: 3 },
    { label: 'Mild net receiver — receives 3–10% more', stars: 2 },
    { label: 'Heavy net receiver — receives ≥ 10% more', stars: 1 }
]

/** Inline star row used inside the help-score legend popover so the
 *  band labels read in the same visual language as the table column. */
function PopoverStarRow({ filled, total = 5 }) {
    return <StarRating value={filled} max={total} tone="warning" size="xs" />
}

/** Help-score info trigger + styled hover/focus popover.
 *
 * Hover OR keyboard focus on the question-mark button reveals the
 * popover via the `group` / `peer` Tailwind pattern — no portal, no
 * state, no JS. The popover anchors to the trigger and positions
 * itself BELOW + LEFT so it never spills off the right edge of the
 * table (this is the rightmost column). The container is
 * `position: relative` so the absolutely-positioned popover sticks to
 * the trigger as the user scrolls horizontally. */
function HelpScoreInfo() {
    return (
        <span className="relative inline-flex items-center group">
            <button type="button"
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border-none bg-transparent text-text-tertiary hover:text-text-primary focus:text-text-primary focus:outline-none cursor-help peer active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none"
                aria-label="How the help score is calculated"
            >
                <i className="fas fa-circle-info text-[12px]" aria-hidden="true" />
            </button>
            <div
                role="tooltip"
                className="invisible opacity-0 pointer-events-none absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-border-light bg-bg-primary p-3 text-left normal-case tracking-normal text-text-primary shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 peer-focus:visible peer-focus:opacity-100"
                style={{ boxShadow: 'var(--shadow-lg, 0 10px 24px rgba(0, 0, 0, 0.18))' }}
            >
                <div className="text-[12.5px] font-semibold text-text-primary">How the help score is calculated</div>
                <div className="mt-1 text-[11.5px] text-text-secondary">
                    Each plant is rated 1–5 stars based on the net cross-load yardage it contributes, normalised against
                    its own scheduled production so small plants aren&apos;t washed out by larger ones.
                </div>
                <div className="mt-2.5 rounded border border-border-light bg-bg-secondary px-2 py-1.5 text-[11px] font-mono tabular-nums text-text-primary">
                    ratio = (given − received) ÷ produced
                </div>
                <div className="mt-2.5 flex flex-col gap-1">
                    {SCORE_BANDS.map((band) => (
                        <div key={band.stars} className="flex items-center gap-2 text-[11px] text-text-secondary">
                            <PopoverStarRow filled={band.stars} />
                            <span className="truncate">{band.label}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2.5 border-t border-border-light pt-2 text-[10.5px] text-text-tertiary leading-relaxed">
                    Co-located plants (e.g. 403/404) are merged before scoring. Plants with no give or receive activity
                    render as <span className="font-semibold text-text-secondary">—</span> instead of a star row.
                </div>
            </div>
        </span>
    )
}

/**
 * "Help breakdown by plant" — the main table in the Help &
 * Cross-Loading sub-page. Two grouped column blocks (planned deadhead
 * vs actual cross-loaded) each followed by their recipient breakdown,
 * with a per-plant 1–5 star help score column at the end.
 */
export default function HelpBreakdownTable({ accentColor, colocationMap, helpByGiverPlant, plantNameByCode, range }) {
    return (
        <Panel
            title="Help breakdown by plant"
            right={<span className="text-[11px] text-text-tertiary">{fmtRange(range?.start, range?.end)}</span>}
            innerClassName="p-0"
        >
            <div className="px-3 pt-3 text-[11.5px] text-text-secondary">
                One row per <span className="font-semibold">giver plant</span>. The first group of columns shows planned
                deadhead help; the second group shows actual cross-loaded ticket help. The right side lists which plants
                received that help.
            </div>
            <div className="overflow-x-auto mt-2">
                <table className="w-full text-[12px] border-collapse">
                    <thead>
                        <tr className="text-text-tertiary bg-bg-secondary">
                            <th
                                className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                rowSpan={2}
                            >
                                Giver plant
                            </th>
                            <th
                                className="text-center font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-l border-border-light"
                                colSpan={2}
                            >
                                Planned deadhead help
                            </th>
                            <th
                                className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-l border-border-light"
                                rowSpan={2}
                            >
                                Where the operators went
                            </th>
                            <th
                                className="text-center font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-l border-border-light"
                                colSpan={3}
                            >
                                Actual cross-loaded help
                            </th>
                            <th
                                className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2 border-l border-border-light"
                                rowSpan={2}
                            >
                                Whose orders they loaded
                            </th>
                            <th
                                className="text-center font-semibold uppercase tracking-wider text-[10px] px-3 py-2 border-l border-border-light"
                                rowSpan={2}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span>Help score</span>
                                    <HelpScoreInfo />
                                </span>
                            </th>
                        </tr>
                        <tr className="text-text-tertiary bg-bg-secondary">
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-l border-border-light"
                                title="Total number of operators the dispatcher planned to send out from this plant to help others"
                            >
                                Operators sent
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Number of distinct planned deadhead trips (Planner tab assignments)"
                            >
                                Trips
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2 border-l border-border-light"
                                title="Total yardage this plant loaded for other plants' orders"
                            >
                                Yardage loaded
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Number of tickets this plant loaded for other plants' orders"
                            >
                                Tickets
                            </th>
                            <th
                                className="text-right font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                title="Number of distinct orders (belonging to other plants) this plant helped load"
                            >
                                Orders helped
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {helpByGiverPlant.map((row) => {
                            const name = plantNameByCode?.[row.code]
                            const codeLabel = formatColocatedCodeLabel(row.code, colocationMap)
                            const netYardage = (row.crossLoadYardage || 0) - (row.receivedYardage || 0)
                            const scoreTitle = `Help score: ${row.helpScore ?? '—'}/5 — gave ${fmtYards(
                                row.crossLoadYardage
                            )} yd³, received ${fmtYards(row.receivedYardage)} yd³ (net ${
                                netYardage >= 0 ? '+' : ''
                            }${fmtYards(netYardage)} yd³) against ${fmtYards(row.producedYardage)} yd³ produced.`
                            return (
                                <tr className="border-t border-border-light" key={row.code}>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Badge
                                                variant="custom"
                                                bg={plantBadgeColor(row.code, accentColor)}
                                                fg="#ffffff"
                                                size="md"
                                                weight="semibold"
                                                className="font-mono tabular-nums"
                                            >
                                                {codeLabel}
                                            </Badge>
                                            {name && <span className="truncate text-text-secondary">{name}</span>}
                                        </div>
                                    </td>
                                    <td
                                        className={`px-2 py-2 text-right font-mono tabular-nums font-semibold align-top border-l border-border-light ${
                                            row.deadheadDrivers > 0 ? 'text-text-primary' : 'text-text-tertiary'
                                        }`}
                                    >
                                        {row.deadheadDrivers > 0 ? `${fmtInt(row.deadheadDrivers)} op` : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary align-top">
                                        {row.deadheadTrips > 0 ? fmtInt(row.deadheadTrips) : '—'}
                                    </td>
                                    <td className="px-2 py-2 align-top border-l border-border-light">
                                        <RecipientList
                                            colocationMap={colocationMap}
                                            getPrimary={(r) => r.deadheadDrivers}
                                            items={row.recipients}
                                            plantNameByCode={plantNameByCode}
                                            unitLabel="operators"
                                        />
                                    </td>
                                    <td
                                        className={`px-2 py-2 text-right font-mono tabular-nums font-semibold align-top border-l border-border-light ${
                                            row.crossLoadYardage > 0 ? 'text-text-primary' : 'text-text-tertiary'
                                        }`}
                                    >
                                        {row.crossLoadYardage > 0 ? `${fmtYards(row.crossLoadYardage)} yd³` : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary align-top">
                                        {row.crossLoadTickets > 0 ? fmtInt(row.crossLoadTickets) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary align-top">
                                        {row.crossLoadOrders > 0 ? fmtInt(row.crossLoadOrders) : '—'}
                                    </td>
                                    <td className="px-3 py-2 align-top border-l border-border-light">
                                        <RecipientList
                                            colocationMap={colocationMap}
                                            getPrimary={(r) => r.crossLoadYardage}
                                            items={row.recipients}
                                            plantNameByCode={plantNameByCode}
                                            unitLabel="yd³"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top border-l border-border-light" title={scoreTitle}>
                                        <StarScore score={row.helpScore} />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Panel>
    )
}
