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
 * "Review & Send" modal for the daily-plan email pipeline.
 *
 * Replaces the old Copy Plan flow on the Plan header. The dispatcher
 * opens it → we run usePlanScheduleData against the live plan so the
 * per-plant payloads inherit the same coverage classification + roster
 * the Schedule tab already shows → we ship those payloads through
 * `/daily-plan-email/preview` to get rendered HTML + resolved
 * recipients → we display the result as a per-plant accordion → a
 * single confirm button calls `/daily-plan-email/send`, which routes
 * every message to the test inbox while we validate the lookup logic.
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
                                <pre className="mt-2 max-h-[200px] overflow-auto rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] font-mono text-amber-900 whitespace-pre-wrap">
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
                        <h2 className="text-[16px] font-semibold leading-tight text-text-primary m-0">
                            Review & Send Daily Plan
                        </h2>
                        <p className="mt-1 text-[12px] leading-snug text-text-tertiary">
                            One email per plant, addressed to the plant manager with the district manager on CC. While
                            we&apos;re testing, every message will route to{' '}
                            <span className="font-mono text-text-secondary">
                                {data?.testRedirectEmail || 'tbtaylor@smyrnareadymix.com'}
                            </span>{' '}
                            with the intended recipients listed in the body.
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

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 bg-bg-secondary">
                    {previewState.loading && (
                        <div className="flex items-center justify-center py-12 text-text-tertiary text-[13px]">
                            <i className="fas fa-spinner fa-spin mr-2" />
                            Resolving recipients and rendering previews…
                        </div>
                    )}
                    {previewState.error && (
                        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12.5px] p-3">
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
                    <div className="text-[12px] text-text-tertiary flex-1 min-w-0">
                        {sendState.result ? (
                            <span className="font-semibold text-text-primary">
                                Sent {sentCount} of {totalCount} emails.
                            </span>
                        ) : (
                            <>
                                {plantsResolved.length} email{plantsResolved.length === 1 ? '' : 's'} ready · routed to
                                test inbox
                            </>
                        )}
                        {sendState.error && (
                            <span className="text-red-600 ml-2">
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
                                Send all (test inbox)
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
