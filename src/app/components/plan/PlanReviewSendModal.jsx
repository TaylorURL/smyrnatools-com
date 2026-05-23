/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

import {
    buildAllPlantEmailPayloads,
    DailyPlanEmailService,
    groupClockInRowsByPlant
} from '../../../services/DailyPlanEmailService'
import { DEFAULT_SCHEDULE_FILTERS } from '../../constants/planScheduleViewConstants'
import { usePlanScheduleData } from '../../hooks/usePlanScheduleData'

/**
 * "Review & Send" modal — the dispatch manager's final-check surface for
 * the daily plan email. Opens from the Plan header after the schedule is
 * locked. The flow is intentionally framed as a manager confirmation, not
 * a technical preview: prominent target date ("Monday's plan"), audience
 * spelled out (plant managers TO, district managers CC), per-plant
 * accordion for last-look at each plant's rendered email, and a single
 * Send button that fans out via `/daily-plan-email/send`. The modal
 * inherits the same coverage classification + clock-in roster the
 * Schedule tab shows so what they see here matches what each plant
 * manager will read.
 */

function Pill({ children, tone = 'neutral' }) {
    const palette = {
        amber: { bg: 'rgba(217, 119, 6, 0.16)', fg: '#92400e' },
        blue: { bg: 'rgba(14, 165, 233, 0.14)', fg: '#0369a1' },
        green: { bg: 'rgba(22, 163, 74, 0.14)', fg: '#15803d' },
        neutral: { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' },
        red: { bg: 'rgba(220, 38, 38, 0.14)', fg: '#b91c1c' }
    }
    const t = palette[tone] || palette.neutral
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide"
            style={{ background: t.bg, color: t.fg }}
        >
            {children}
        </span>
    )
}

function RecipientList({ items, emptyLabel }) {
    if (!items || items.length === 0) {
        return <span className="text-[12px] italic text-text-tertiary">{emptyLabel}</span>
    }
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((r) => (
                <span
                    key={r.email}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] bg-bg-secondary border border-border-light text-text-primary"
                    title={r.email}
                >
                    {r.name ? <strong className="font-semibold">{r.name}</strong> : null}
                    <span className="font-mono text-text-secondary">{r.email}</span>
                </span>
            ))}
        </div>
    )
}

/**
 * Blob URL wrapper for the email preview. `srcDoc` shares origin with the
 * parent during dev, so Vite's HMR client tries to inject its script and
 * Safari logs the sandbox warning even though the iframe HTML has no
 * `<script>` of its own. A Blob URL opens a fresh document with no shared
 * scope — no injection, no warning, same rendered output.
 */
function useBlobHtml(html) {
    const url = useMemo(() => {
        if (!html) return ''
        return URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    }, [html])
    useEffect(() => {
        if (!url) return undefined
        return () => URL.revokeObjectURL(url)
    }, [url])
    return url
}

function PlantAccordionRow({ plant, expanded, onToggle }) {
    const previewUrl = useBlobHtml(expanded ? plant.html : '')
    return (
        <div className="border border-border-light rounded-lg overflow-hidden bg-bg-primary">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 cursor-pointer hover:bg-bg-tertiary"
            >
                <span className="font-mono font-bold text-[13px] text-text-primary">{plant.code}</span>
                <span className="text-[13px] font-semibold text-text-primary">{plant.name || ''}</span>
                <Pill tone={plant.to.length === 0 ? 'red' : 'green'}>
                    {plant.to.length} manager{plant.to.length === 1 ? '' : 's'}
                </Pill>
                <Pill tone={plant.cc.length === 0 ? 'neutral' : 'blue'}>{plant.cc.length} DM CC</Pill>
                {plant.skip && <Pill tone="red">Skipped</Pill>}
                <span className="ml-auto text-[12px] text-text-tertiary">
                    <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-[10px]`} />
                </span>
            </button>
            {expanded && (
                <div className="border-t border-border-light bg-bg-secondary">
                    <div className="px-4 py-3 flex flex-col gap-3">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
                                Intended TO (Plant Manager)
                            </div>
                            <RecipientList items={plant.to} emptyLabel="No plant manager found for this plant." />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
                                Intended CC (District Manager)
                            </div>
                            <RecipientList items={plant.cc} emptyLabel="No district manager assigned to this plant." />
                            {plant.cc.length === 0 && plant.dmDebug && (
                                <pre className="mt-2 max-h-[200px] overflow-auto rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] font-mono text-text-primary whitespace-pre-wrap">
                                    {JSON.stringify(plant.dmDebug, null, 2)}
                                </pre>
                            )}
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">
                                Subject
                            </div>
                            <div className="text-[12.5px] font-mono text-text-primary">{plant.subject}</div>
                        </div>
                    </div>
                    <div className="border-t border-border-light bg-bg-primary">
                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                            Rendered email
                        </div>
                        {previewUrl ? (
                            <iframe
                                title={`Email preview — ${plant.code}`}
                                src={previewUrl}
                                sandbox="allow-same-origin"
                                className="block w-full border-0"
                                style={{ background: '#f3f4f6', height: '640px' }}
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    )
}

export function PlanReviewSendModal({
    accentColor,
    assignments,
    detailByOrderId,
    getTravelTime,
    onClose,
    planDate,
    plantAddressByCode,
    plantNameByCode,
    plantProduction,
    stats,
    notes
}) {
    /* Run the same data hook the Schedule tab uses so the email inherits
     * its coverage classification + clock-in roster. Default filters
     * (no plant filter, all statuses) — we want the FULL plan in the
     * email, not whatever the dispatcher happens to be filtered to. */
    const scheduleData = usePlanScheduleData({
        assignments,
        detailByOrderId: detailByOrderId || {},
        filters: DEFAULT_SCHEDULE_FILTERS,
        getTravelTime,
        planDate,
        plantAddressByCode,
        plantNameByCode,
        rawPlantProduction: plantProduction,
        stats
    })
    const { clockInRows, poolTimeline } = scheduleData

    const payloads = useMemo(() => {
        const clockInRowsByPlant = groupClockInRowsByPlant(clockInRows)
        return buildAllPlantEmailPayloads({
            assignments,
            clockInRowsByPlant,
            notes,
            plantNameByCode,
            plantProduction,
            poolTimeline
        })
    }, [assignments, clockInRows, notes, plantNameByCode, plantProduction, poolTimeline])

    const [previewState, setPreviewState] = useState({ data: null, error: null, loading: true })
    const [expandedCode, setExpandedCode] = useState(null)
    const [sendState, setSendState] = useState({ error: null, loading: false, result: null })

    useEffect(() => {
        let cancelled = false
        async function load() {
            setPreviewState({ data: null, error: null, loading: true })
            try {
                const result = await DailyPlanEmailService.preview({ planDate, plants: payloads })
                if (cancelled) return
                setPreviewState({ data: result, error: null, loading: false })
                if (result?.plants?.length && !expandedCode) setExpandedCode(result.plants[0].code)
            } catch (err) {
                if (cancelled) return
                setPreviewState({ data: null, error: err?.message || 'Preview failed', loading: false })
            }
        }
        if (payloads.length > 0) load()
        else
            setPreviewState({
                data: { plants: [], testMode: true, testRedirectEmail: '' },
                error: null,
                loading: false
            })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planDate, JSON.stringify(payloads)])

    const handleSend = async () => {
        if (!payloads.length || sendState.loading) return
        setSendState({ error: null, loading: true, result: null })
        try {
            const result = await DailyPlanEmailService.send({ planDate, plants: payloads })
            setSendState({ error: null, loading: false, result })
        } catch (err) {
            setSendState({ error: err?.message || 'Send failed', loading: false, result: null })
        }
    }

    if (typeof document === 'undefined' || !document.body) return null
    const data = previewState.data
    const plantsResolved = data?.plants || []
    const sentCount = sendState.result?.sent ?? null
    const totalCount = sendState.result?.total ?? plantsResolved.length

    /* Friendly day label for the dispatch manager — they think in
     * weekday names, not ISO dates. The string sits in the header so
     * everyone in the modal knows which day's plan is going out. */
    const planDateLabel = (() => {
        if (!planDate || typeof planDate !== 'string') return ''
        const [year, month, day] = planDate.split('-').map((n) => parseInt(n, 10))
        if (!year || !month || !day) return planDate
        const date = new Date(year, month - 1, day)
        if (!Number.isFinite(date.getTime())) return planDate
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            weekday: 'long',
            year: 'numeric'
        })
    })()
    const recipientCount = plantsResolved.reduce((sum, plant) => sum + plant.to.length + plant.cc.length, 0)
    const plantsMissingManager = plantsResolved.filter((plant) => plant.to.length === 0).length
    const plantsMissingDM = plantsResolved.filter((plant) => plant.cc.length === 0).length
    const testMode = data?.testMode
    const testInbox = data?.testRedirectEmail || 'tbtaylor@smyrnareadymix.com'

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[rgba(15,23,42,0.55)] backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="flex w-full max-w-[960px] flex-col overflow-hidden rounded-xl bg-bg-primary border border-border-light shadow-2xl"
                style={{ maxHeight: '92vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-light">
                    <div className="min-w-0">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                            Dispatch manager · final review
                        </div>
                        <h2 className="mt-1 text-[18px] font-semibold leading-tight text-text-primary m-0">
                            Send the daily plan
                            {planDateLabel ? (
                                <span className="ml-2 font-normal text-text-secondary">{`for ${planDateLabel}`}</span>
                            ) : null}
                        </h2>
                        <p className="mt-1.5 text-[12.5px] leading-snug text-text-secondary">
                            Each plant gets one email — addressed to the plant manager with the district manager on CC.
                            Use the per-plant cards below to confirm recipients and skim the rendered email before you
                            release. Hit <span className="font-semibold text-text-primary">Send to all plants</span>{' '}
                            when you&apos;re ready.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent border-0 text-text-secondary hover:bg-bg-tertiary cursor-pointer"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[13px]" />
                    </button>
                </div>

                {/* At-a-glance summary strip — three counts the dispatch
                    manager actually wants to see before pressing send. */}
                {!previewState.loading && !previewState.error && plantsResolved.length > 0 && (
                    <div className="grid grid-cols-3 gap-px bg-border-light border-b border-border-light">
                        <div className="flex flex-col items-start gap-0.5 bg-bg-primary px-5 py-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                Plants ready
                            </span>
                            <span className="text-[18px] font-bold text-text-primary leading-none font-mono tabular-nums">
                                {plantsResolved.length}
                            </span>
                            <span className="text-[11px] text-text-tertiary">{recipientCount} recipients total</span>
                        </div>
                        <div className="flex flex-col items-start gap-0.5 bg-bg-primary px-5 py-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                Missing plant manager
                            </span>
                            <span
                                className="text-[18px] font-bold leading-none font-mono tabular-nums"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {plantsMissingManager}
                            </span>
                            <span className="text-[11px] text-text-tertiary">
                                {plantsMissingManager > 0 ? 'review before sending' : 'every plant covered'}
                            </span>
                        </div>
                        <div className="flex flex-col items-start gap-0.5 bg-bg-primary px-5 py-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                Missing district manager
                            </span>
                            <span
                                className="text-[18px] font-bold leading-none font-mono tabular-nums"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {plantsMissingDM}
                            </span>
                            <span className="text-[11px] text-text-tertiary">
                                {plantsMissingDM > 0 ? 'DM CC will be empty' : 'every plant CC’d'}
                            </span>
                        </div>
                    </div>
                )}

                {testMode && !previewState.loading && (
                    <div className="px-5 py-2 text-[11.5px] border-b border-border-light bg-amber-50 text-text-primary">
                        <i className="fas fa-vial mr-1.5" />
                        <span className="font-semibold">Test mode is on</span> — every email will route to{' '}
                        <span className="font-mono">{testInbox}</span> instead of the real recipients. The intended TO
                        and CC lists are printed at the top of each message so you can verify routing.
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-bg-secondary">
                    {previewState.loading && (
                        <div className="flex items-center justify-center py-12 text-text-tertiary text-[13px]">
                            <i className="fas fa-spinner fa-spin mr-2" />
                            Resolving recipients and rendering previews…
                        </div>
                    )}
                    {previewState.error && (
                        <div className="rounded-md border border-red-200 bg-red-50 text-text-primary text-[12.5px] p-3">
                            <strong>Preview failed:</strong> {previewState.error}
                        </div>
                    )}
                    {!previewState.loading && !previewState.error && plantsResolved.length === 0 && (
                        <div className="rounded-md border border-border-light bg-bg-primary p-6 text-center text-text-tertiary text-[13px]">
                            No plants have orders for {planDate}. There&apos;s nothing to email today.
                        </div>
                    )}
                    {plantsResolved.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {plantsResolved.map((plant) => (
                                <PlantAccordionRow
                                    key={plant.code}
                                    plant={plant}
                                    expanded={expandedCode === plant.code}
                                    onToggle={() =>
                                        setExpandedCode((prev) => (prev === plant.code ? null : plant.code))
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 px-5 py-3 border-t border-border-light bg-bg-primary">
                    <div className="text-[12px] text-text-secondary flex-1 min-w-0">
                        {sendState.result ? (
                            <span className="font-semibold text-text-primary">
                                <i
                                    className="fas fa-circle-check text-[11px] mr-1"
                                    style={{ color: 'var(--text-primary)' }}
                                />
                                Sent {sentCount} of {totalCount} plant{totalCount === 1 ? '' : 's'}.
                            </span>
                        ) : plantsResolved.length === 0 ? (
                            <span className="italic text-text-tertiary">Nothing to send for this plan.</span>
                        ) : testMode ? (
                            <>
                                <span className="font-semibold text-text-primary">{plantsResolved.length}</span>{' '}
                                {plantsResolved.length === 1 ? 'email' : 'emails'} queued — all routing to the test
                                inbox.
                            </>
                        ) : (
                            <>
                                <span className="font-semibold text-text-primary">{plantsResolved.length}</span>{' '}
                                {plantsResolved.length === 1 ? 'email' : 'emails'} ready to go to plant + district
                                managers.
                            </>
                        )}
                        {sendState.error && (
                            <span className="text-text-primary ml-2">
                                <i className="fas fa-exclamation-circle text-[11px] mr-1" />
                                {sendState.error}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-border-light bg-transparent px-3 py-2 text-[12.5px] font-semibold text-text-secondary cursor-pointer hover:bg-bg-tertiary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={
                            previewState.loading ||
                            !!previewState.error ||
                            plantsResolved.length === 0 ||
                            sendState.loading
                        }
                        className="rounded-md border-0 px-4 py-2 text-[12.5px] font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: accentColor || '#1e3a5f' }}
                    >
                        {sendState.loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-1.5" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane mr-1.5" />
                                {testMode
                                    ? 'Send to test inbox'
                                    : `Send to ${plantsResolved.length} plant${plantsResolved.length === 1 ? '' : 's'}`}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default PlanReviewSendModal
