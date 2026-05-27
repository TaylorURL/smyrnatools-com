/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useMemo, useState } from 'react'

import { fmtInt, fmtYards } from '../../../../../../../utils/PlanStatisticsFormatUtility'
import Badge from '../../../../../common/Badge'

/** Build a plain-text report of every unmatched driver name in the
 *  window. Tab-separated so it pastes into Sheets / Excel cleanly and
 *  also reads as a sane block in Slack / email. The dispatcher hits
 *  "Copy list" and forwards this to whoever maintains operator names. */
function buildUnmatchedNamesReport(rows) {
    const header = ['Operator name (ticket)', 'Operator #', 'Loads', 'Yd³', 'Trucks', 'Plants'].join('\t')
    const body = rows.map((r) =>
        [
            r.name || '(no name)',
            r.driverNums.join(', ') || '—',
            String(r.loads),
            r.yardage > 0 ? r.yardage.toFixed(1) : '—',
            r.trucks.join(', ') || '—',
            r.plants.join(', ') || '—'
        ].join('\t')
    )
    return [header, ...body].join('\n')
}

/** Aggregate row at the bottom of the Operators table for every ticket
 *  whose `driver_name` doesn't resolve to an operator record in Tools.
 *  Spans the whole table width with a warning tint, names the cause
 *  (Jonel ↔ Tools name mismatch), then renders an actionable per-name
 *  breakdown of every unique offender — load count, yardage, driver #,
 *  trucks, loading plants — so the dispatcher can hand the full list
 *  to whoever maintains operator records.
 *
 *  When the operator roster genuinely failed to load (empty array after
 *  fetch settled), the message swaps to point at THAT problem instead of
 *  blaming name spellings — otherwise every ticket would always end up
 *  here and the dispatcher would chase ghost name-mismatch fixes. */
export function UnmatchedDriversRow({
    accentColor,
    avgYardage,
    isFirst,
    maxLoads,
    operatorRosterCount,
    operatorRosterReady,
    row
}) {
    const unmatchedNames = useMemo(
        () => (Array.isArray(row.unmatchedNames) ? row.unmatchedNames : []),
        [row.unmatchedNames]
    )
    const [copyState, setCopyState] = useState('idle')
    const handleCopy = useCallback(async () => {
        const text = buildUnmatchedNamesReport(unmatchedNames)
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
            } else {
                const textarea = document.createElement('textarea')
                textarea.value = text
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
            }
            setCopyState('copied')
            setTimeout(() => setCopyState('idle'), 1800)
        } catch {
            setCopyState('error')
            setTimeout(() => setCopyState('idle'), 1800)
        }
    }, [unmatchedNames])
    return (
        <div
            className="px-3 py-2.5 text-[12.5px] flex flex-col gap-2.5"
            style={{
                background: 'rgba(202, 138, 4, 0.07)',
                borderTop: isFirst ? 'none' : '1px solid var(--border-light)'
            }}
        >
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <i className="fas fa-triangle-exclamation text-[13px] text-text-primary" aria-hidden="true" />
                        <span className="font-semibold text-text-primary">Unmatched operators</span>
                        <Badge tone="warning" size="md" weight="semibold" uppercase={false} className="italic">
                            {fmtInt(unmatchedNames.length)} unique · {fmtInt(row.loads)} load
                            {row.loads === 1 ? '' : 's'} · {fmtYards(row.yardage)} yd³
                        </Badge>
                    </div>
                    <div className="text-[11px] mt-1 text-text-secondary leading-snug max-w-2xl">
                        {operatorRosterReady && operatorRosterCount === 0 ? (
                            <>
                                <b>Operator roster failed to load.</b> Tools couldn&apos;t fetch any operator records,
                                so every ticket lands here by default. Refresh the page; if the problem persists, check
                                the operator-service edge function.
                            </>
                        ) : (
                            <>
                                These tickets reference operator names that don&apos;t match any of the{' '}
                                {operatorRosterReady ? <b>{fmtInt(operatorRosterCount)}</b> : '—'} operator records in
                                Tools. Usually caused by a spelling mismatch between Jonel and Tools — fix the
                                operator&apos;s name on either side to roll these loads into the right operator row.
                            </>
                        )}
                    </div>
                </div>
                {unmatchedNames.length > 0 && (
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border border-border-light shrink-0 text-text-primary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{
                            background:
                                copyState === 'copied'
                                    ? 'rgba(22, 163, 74, 0.15)'
                                    : copyState === 'error'
                                      ? 'rgba(220, 38, 38, 0.15)'
                                      : 'var(--bg-primary)'
                        }}
                        title="Copy the full unmatched-names list to your clipboard (tab-separated; pastes into Sheets / Excel / Slack cleanly)"
                    >
                        <i
                            className={`fas ${
                                copyState === 'copied'
                                    ? 'fa-circle-check'
                                    : copyState === 'error'
                                      ? 'fa-circle-exclamation'
                                      : 'fa-copy'
                            } text-[11px]`}
                        />
                        {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy list'}
                    </button>
                )}
            </div>
            {unmatchedNames.length === 0 ? (
                <div className="text-[11px] text-text-tertiary italic">
                    No unmatched operator names captured in this window.
                </div>
            ) : (
                <div
                    className="rounded border overflow-hidden"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
                >
                    <div
                        className="grid gap-3 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-light"
                        style={{
                            gridTemplateColumns:
                                'minmax(0, 1.6fr) minmax(0, 0.7fr) 3.5rem 4rem minmax(0, 1fr) minmax(0, 0.9fr)'
                        }}
                    >
                        <span>Operator name (ticket)</span>
                        <span>Operator #</span>
                        <span className="text-right">Loads</span>
                        <span className="text-right">Yd³</span>
                        <span>Trucks</span>
                        <span>Loaded at</span>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                        {unmatchedNames.map((entry, idx) => (
                            <div
                                key={entry.key}
                                className="grid gap-3 px-3 py-1.5 text-[12px] items-center"
                                style={{
                                    background: idx % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                                    borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)',
                                    gridTemplateColumns:
                                        'minmax(0, 1.6fr) minmax(0, 0.7fr) 3.5rem 4rem minmax(0, 1fr) minmax(0, 0.9fr)'
                                }}
                            >
                                <span className="font-mono text-text-primary truncate" title={entry.name}>
                                    {entry.name || '(no name)'}
                                </span>
                                <span className="font-mono tabular-nums text-text-secondary truncate">
                                    {entry.driverNums.length === 0 ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        entry.driverNums.join(', ')
                                    )}
                                </span>
                                <span className="font-mono tabular-nums text-right font-semibold text-text-primary">
                                    {fmtInt(entry.loads)}
                                </span>
                                <span className="font-mono tabular-nums text-right text-text-secondary">
                                    {entry.yardage > 0 ? entry.yardage.toFixed(1) : '—'}
                                </span>
                                <span className="font-mono tabular-nums text-text-secondary truncate">
                                    {entry.trucks.length === 0 ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        entry.trucks.map((t) => `#${t}`).join(', ')
                                    )}
                                </span>
                                <span className="font-mono tabular-nums text-text-secondary truncate">
                                    {entry.plants.length === 0 ? (
                                        <span className="text-text-tertiary">—</span>
                                    ) : (
                                        entry.plants.join(', ')
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-end gap-3 text-[10.5px] text-text-tertiary tabular-nums">
                <span>
                    Avg yd³/load:{' '}
                    <span className="font-mono text-text-secondary">{row.loads > 0 ? avgYardage.toFixed(1) : '—'}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    Share of bad loads
                    <div className="h-1.5 rounded-sm overflow-hidden bg-bg-tertiary w-16 inline-block">
                        <div
                            className="h-full rounded-sm"
                            style={{
                                background: accentColor,
                                width: `${maxLoads > 0 ? (row.loads / maxLoads) * 100 : 0}%`
                            }}
                        />
                    </div>
                </span>
            </div>
        </div>
    )
}
