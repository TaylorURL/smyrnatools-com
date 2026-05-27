/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { SaturdayForecastService } from '../../../services/SaturdayForecastService'
import {
    FORECAST_MAX_OPERATORS,
    FORECAST_MIN_OPERATORS,
    formatSaturdayLabel,
    SATURDAY_FORECAST_EVENTS
} from '../../constants/saturdayForecastConstants'

const RELATIVE_TIME_FORMATTER =
    typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
        ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
        : null

const RELATIVE_TIME_UNITS = [
    { seconds: 60 * 60 * 24 * 365, unit: 'year' },
    { seconds: 60 * 60 * 24 * 30, unit: 'month' },
    { seconds: 60 * 60 * 24 * 7, unit: 'week' },
    { seconds: 60 * 60 * 24, unit: 'day' },
    { seconds: 60 * 60, unit: 'hour' },
    { seconds: 60, unit: 'minute' }
]

/** Returns a short "submitted 2h ago" style label, or null when the timestamp
 *  is unparseable or Intl.RelativeTimeFormat isn't available. */
function formatRelativeTime(iso) {
    if (!iso || !RELATIVE_TIME_FORMATTER) return null
    const then = new Date(iso).getTime()
    if (!Number.isFinite(then)) return null
    const deltaSeconds = Math.round((then - Date.now()) / 1000)
    for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
        if (Math.abs(deltaSeconds) >= seconds) {
            return RELATIVE_TIME_FORMATTER.format(Math.round(deltaSeconds / seconds), unit)
        }
    }
    return RELATIVE_TIME_FORMATTER.format(deltaSeconds, 'second')
}

/** Clamp a free-typed value into the allowed forecast range. Returns the raw
 *  string when it's still mid-edit (empty or non-numeric) so the input stays
 *  controllable; otherwise returns the clamped integer as a string. */
function clampForecastInput(raw) {
    if (raw === '' || raw == null) return ''
    const numeric = Number(raw)
    if (!Number.isFinite(numeric)) return ''
    const integer = Math.trunc(numeric)
    if (integer < FORECAST_MIN_OPERATORS) return String(FORECAST_MIN_OPERATORS)
    if (integer > FORECAST_MAX_OPERATORS) return String(FORECAST_MAX_OPERATORS)
    return String(integer)
}

/**
 * Modal collecting Saturday operator counts for every plant the current user
 * manages. Pre-fills already-submitted plants so a manager can review and
 * adjust previously sent forecasts in the same form. Partial submission is
 * supported — only rows with a value are sent to the server.
 *
 * Behaviour overview:
 *  - Esc or backdrop click closes the modal (no save).
 *  - Focus is trapped between the first and last focusable elements.
 *  - Submit calls `SaturdayForecastService.submitBulk` atomically; on success
 *    the saturday-forecast:submitted event is dispatched so the banner hook
 *    refreshes without manual coupling.
 */
export default function SaturdayForecastModal({
    accentColor,
    onClose,
    onSubmitted,
    pendingPlants,
    saturdayDate,
    submittedPlants
}) {
    const titleId = useId()
    const descriptionId = useId()
    const dialogRef = useRef(null)
    const initialFocusRef = useRef(null)
    const submitButtonRef = useRef(null)
    const closeButtonRef = useRef(null)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Build the row list once per render — pending plants on top, then any
    // already-submitted ones below as read-back rows the manager can edit.
    const submittedByCode = useMemo(() => {
        const map = new Map()
        ;(submittedPlants || []).forEach((p) => map.set(p.plantCode, p))
        return map
    }, [submittedPlants])

    const rows = useMemo(() => {
        const pendingRows = (pendingPlants || []).map((plant) => ({
            ...plant,
            kind: 'pending',
            priorCount: null,
            submittedAt: null
        }))
        const pendingCodes = new Set(pendingRows.map((r) => r.plantCode))
        const submittedRows = (submittedPlants || [])
            .filter((p) => !pendingCodes.has(p.plantCode))
            .map((p) => ({
                kind: 'submitted',
                plantCode: p.plantCode,
                plantName: p.plantName,
                priorCount: p.operatorCount,
                regionCode: null,
                regionName: null,
                submittedAt: p.submittedAt
            }))
        return [...pendingRows, ...submittedRows]
    }, [pendingPlants, submittedPlants])

    const [values, setValues] = useState(() => {
        const initial = {}
        rows.forEach((row) => {
            const prior = submittedByCode.get(row.plantCode)
            initial[row.plantCode] = prior ? String(prior.operatorCount) : ''
        })
        return initial
    })

    // Esc closes, basic focus trap inside the dialog.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose?.()
                return
            }
            if (event.key !== 'Tab') return
            const focusables = dialogRef.current?.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (!focusables || focusables.length === 0) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    // Move focus into the modal on mount; restore prior focus on unmount.
    useEffect(() => {
        const previouslyFocused = document.activeElement
        initialFocusRef.current?.focus()
        return () => {
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
        }
    }, [])

    const handleChange = (plantCode, raw) => {
        setValues((prev) => ({ ...prev, [plantCode]: clampForecastInput(raw) }))
    }

    const handleSubmit = async () => {
        setError('')
        const entries = Object.entries(values)
            .filter(([, value]) => value !== '' && value != null)
            .map(([plantCode, value]) => ({ operatorCount: Number(value), plantCode }))
            .filter((entry) => Number.isFinite(entry.operatorCount))
        if (entries.length === 0) {
            setError('Enter at least one operator count to submit.')
            return
        }
        setSubmitting(true)
        try {
            await SaturdayForecastService.submitBulk(saturdayDate, entries)
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(SATURDAY_FORECAST_EVENTS.submitted))
            }
            onSubmitted?.()
        } catch (submitError) {
            setError(submitError?.message || 'Failed to submit forecasts. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const saturdayLabel = formatSaturdayLabel(saturdayDate)
    const accentTint = accentColor ? `${accentColor}1f` : 'var(--accent-transparent)'

    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[10100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-[2px] animate-[fadeIn_180ms_ease-out_both] motion-reduce:animate-none"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="w-full max-w-[560px] flex flex-col max-h-[92vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden bg-bg-primary border border-border-light shadow-modal animate-[popIn_220ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-light">
                    <div className="min-w-0 flex flex-col gap-1">
                        <h2
                            id={titleId}
                            className="m-0 text-[16px] font-semibold leading-tight text-text-primary truncate"
                        >
                            Saturday Operator Forecast
                        </h2>
                        <p className="m-0 text-[12.5px] text-text-secondary truncate">
                            <span
                                className="font-semibold"
                                style={accentColor ? { color: accentColor } : undefined}
                            >
                                {saturdayLabel}
                            </span>
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-transparent border-none text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-colors duration-150 motion-reduce:transition-none active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_35%,transparent)]"
                    >
                        <i className="fas fa-times text-[14px]" aria-hidden="true" />
                    </button>
                </header>

                <div className="px-5 py-3 border-b border-border-light bg-bg-secondary">
                    <p id={descriptionId} className="m-0 text-[12.5px] leading-relaxed text-text-secondary">
                        Enter the number of operators you expect to have on this Saturday for each plant you manage.
                        Dispatch will use these counts when building the Saturday plan. You can leave a plant blank
                        and come back later.
                    </p>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="mx-5 mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-[12.5px] font-medium animate-fade-in-fast motion-reduce:animate-none"
                        style={{
                            background: 'rgba(220,38,38,0.08)',
                            border: '1px solid rgba(220,38,38,0.35)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <i
                            className="fas fa-exclamation-circle mt-[2px] text-[12px]"
                            style={{ color: 'var(--status-danger)' }}
                            aria-hidden="true"
                        />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-3">
                    {rows.length === 0 ? (
                        <div className="py-10 text-center text-[13px] text-text-secondary">
                            No plants to forecast for this week.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                            {rows.map((row, index) => {
                                const inputId = `saturday-forecast-${row.plantCode}`
                                const prior = submittedByCode.get(row.plantCode)
                                const relative = prior ? formatRelativeTime(prior.submittedAt) : null
                                return (
                                    <li
                                        key={row.plantCode}
                                        className="flex items-center gap-3 rounded-md px-3 py-2 bg-bg-secondary border border-border-light"
                                    >
                                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                            <div className="flex items-baseline gap-2 min-w-0">
                                                <span className="font-mono text-[12.5px] font-semibold text-text-primary shrink-0">
                                                    {row.plantCode}
                                                </span>
                                                <span className="text-[13px] text-text-primary truncate min-w-0">
                                                    {row.plantName || '—'}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-text-tertiary truncate">
                                                {row.regionName || row.regionCode || (prior ? 'Already submitted' : '')}
                                                {prior && relative && (
                                                    <>
                                                        {(row.regionName || row.regionCode) && ' · '}
                                                        <span style={accentColor ? { color: accentColor } : undefined}>
                                                            Submitted {relative}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <label htmlFor={inputId} className="sr-only">
                                            Operator count for plant {row.plantCode}
                                        </label>
                                        <input
                                            ref={index === 0 ? initialFocusRef : undefined}
                                            id={inputId}
                                            type="number"
                                            inputMode="numeric"
                                            min={FORECAST_MIN_OPERATORS}
                                            max={FORECAST_MAX_OPERATORS}
                                            step={1}
                                            placeholder="0"
                                            value={values[row.plantCode] ?? ''}
                                            onChange={(e) => handleChange(row.plantCode, e.target.value)}
                                            disabled={submitting}
                                            className="w-20 sm:w-24 rounded-md border bg-bg-primary border-border-medium px-2 py-1.5 text-sm text-right tabular-nums text-text-primary outline-none transition-colors duration-150 motion-reduce:transition-none hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-light bg-bg-secondary">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-md text-[12.5px] font-semibold bg-transparent border border-border-light text-text-primary hover:bg-bg-hover transition-colors duration-150 motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        Close
                    </button>
                    <button
                        ref={submitButtonRef}
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || rows.length === 0}
                        className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold text-white border-none transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none hover:opacity-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: accentColor || 'var(--accent)', boxShadow: `0 6px 16px -8px ${accentTint}` }}
                    >
                        {submitting ? (
                            <>
                                <i
                                    className="fas fa-circle-notch animate-dv-spin text-[11px]"
                                    aria-hidden="true"
                                />
                                <span>Submitting…</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-check text-[11px]" aria-hidden="true" />
                                <span>Submit forecasts</span>
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    )
}
