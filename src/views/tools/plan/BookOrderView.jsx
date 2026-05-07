import React, { useMemo, useState } from 'react'

import {
    buildBookingRequest,
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_TRUCK_SPACING_MIN,
    rankPlantsForBooking,
    scoreLabel,
    scoreTone
} from '../../../utils/BookOrderUtility'
import DateUtility from '../../../utils/DateUtility'

const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const FIELD_LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wider mb-2'

const formatMinutesAsClock = (mins) => {
    if (!Number.isFinite(mins)) return ''
    const wrapped = ((mins % 1440) + 1440) % 1440
    const h = Math.floor(wrapped / 60)
    const m = Math.floor(wrapped % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Single recommendation card — header (rank + plant), composite score chip,
 *  and a four-stat strip explaining the breakdown. The first card in the
 *  list is rendered with an accent border so it reads as the "best pick". */
function RecommendationCard({ accentColor, isTop, rank, row }) {
    const tone = scoreTone(row.composite)
    return (
        <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${isTop ? `${accentColor}66` : 'var(--border-light)'}`,
                boxShadow: isTop ? `0 0 0 2px ${accentColor}22` : 'none'
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 font-bold text-[14px]"
                        style={{
                            background: isTop ? accentColor : 'var(--bg-tertiary)',
                            color: isTop ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {rank}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {row.plantName}
                            <span className="text-[12px] font-normal ml-2" style={{ color: 'var(--text-tertiary)' }}>
                                #{row.plantCode}
                            </span>
                        </div>
                        {row.plantAddress && (
                            <div
                                className="text-[12px] mt-0.5 truncate"
                                style={{ color: 'var(--text-secondary)' }}
                                title={row.plantAddress}
                            >
                                {row.plantAddress}
                            </div>
                        )}
                    </div>
                </div>
                <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ background: `${tone}22`, color: tone }}
                >
                    {scoreLabel(row.composite)}
                    <span className="font-mono tabular-nums">· {Math.round(row.composite * 100)}</span>
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <BreakdownStat
                    label="Free trucks"
                    value={`${row.free} / ${row.adjustedPool}`}
                    hint={`${row.busy} busy at this time`}
                    tone={scoreTone(row.capacityScore)}
                />
                <BreakdownStat
                    label="Trucks needed"
                    value={String(row.trucksNeeded)}
                    hint={row.free >= row.trucksNeeded ? 'Pool can cover' : `${row.trucksNeeded - row.free} short`}
                    tone={row.free >= row.trucksNeeded ? '#16a34a' : '#dc2626'}
                />
                <BreakdownStat
                    label="Proximity"
                    value={`${Math.round(row.proximityScore * 100)}%`}
                    hint={row.proximityScore >= 0.7 ? 'Same area' : row.proximityScore >= 0.3 ? 'Regional' : 'Distant'}
                    tone={scoreTone(row.proximityScore)}
                />
                <BreakdownStat
                    label="Load balance"
                    value={`${Math.round(row.loadBalanceScore * 100)}%`}
                    hint={
                        row.adjustedPool > 0
                            ? `${Math.round((row.busy / row.adjustedPool) * 100)}% pool committed`
                            : 'No pool'
                    }
                    tone={scoreTone(row.loadBalanceScore)}
                />
            </div>
        </div>
    )
}

function BreakdownStat({ hint, label, tone, value }) {
    return (
        <div
            className="rounded-md px-3 py-2 flex flex-col gap-0.5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
            >
                {label}
            </div>
            <div className="text-[15px] font-bold leading-none" style={{ color: tone }}>
                {value}
            </div>
            <div className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                {hint}
            </div>
        </div>
    )
}

function BookOrderView({ accentColor, mixerCountsByPlant, planDate, plantProduction, plants }) {
    const [yardage, setYardage] = useState('')
    const [startTime, setStartTime] = useState('')
    const [address, setAddress] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const request = useMemo(() => buildBookingRequest({ address, startTime, yardage }), [address, startTime, yardage])

    /* Re-rank only after the dispatcher commits via Submit. Live-ranking on
     * every keystroke felt jumpy and made it hard to read the breakdown for
     * a partially-typed address. */
    const ranked = useMemo(() => {
        if (!submitted || !request) return []
        return rankPlantsForBooking({
            mixerCountsByPlant,
            planDate,
            plantProduction,
            plants,
            request
        })
    }, [submitted, request, plants, plantProduction, mixerCountsByPlant, planDate])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!request) return
        setSubmitted(true)
    }

    const handleReset = () => {
        setYardage('')
        setStartTime('')
        setAddress('')
        setSubmitted(false)
    }

    const top = ranked[0]
    const planDateLabel = DateUtility.formatDate(planDate)

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Form */}
                <section
                    className="lg:col-span-4 rounded-lg flex flex-col"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div
                        className="flex items-center gap-3 px-5 py-4"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                        >
                            <i className="fas fa-clipboard-list text-[16px]" />
                        </div>
                        <div>
                            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Booking Request
                            </div>
                            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                {planDateLabel ? `Scheduling for ${planDateLabel}` : 'Enter the order details'}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    Yardage
                                </label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.5"
                                    value={yardage}
                                    onChange={(e) => setYardage(e.target.value)}
                                    placeholder="50"
                                    required
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                    style={FIELD_STYLE}
                                />
                            </div>
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    Time
                                </label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                    className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                                    style={FIELD_STYLE}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Job Address
                            </label>
                            <textarea
                                rows={3}
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Street, City, State ZIP"
                                required
                                className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none resize-y"
                                style={FIELD_STYLE}
                            />
                            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                ZIP code matched against each plant&apos;s address — same ZIP scores highest.
                            </p>
                        </div>

                        {request && (
                            <div
                                className="rounded-lg px-3 py-2.5 text-[12px] flex flex-col gap-1"
                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                            >
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Estimated trucks</span>
                                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {request.trucksNeeded}
                                    </span>
                                </div>
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Pour window</span>
                                    <span
                                        className="font-semibold tabular-nums"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {formatMinutesAsClock(request.startMin)}–
                                        {formatMinutesAsClock(request.startMin + request.durationMin)}
                                    </span>
                                </div>
                                <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                    Assumes {DEFAULT_LOAD_SIZE_YARDS}-yd loads, {DEFAULT_TRUCK_SPACING_MIN}-min spacing.
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={!request}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-white px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: accentColor }}
                            >
                                <i className="fas fa-magnifying-glass-chart text-[12px]" />
                                Find Best Plant
                            </button>
                            {submitted && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    <i className="fas fa-rotate-left text-[12px]" />
                                    Reset
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                {/* Recommendations */}
                <section className="lg:col-span-8 flex flex-col gap-3">
                    {!submitted && (
                        <div
                            className="rounded-lg p-8 text-center flex flex-col items-center gap-2"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px dashed var(--border-light)',
                                color: 'var(--text-tertiary)'
                            }}
                        >
                            <i className="fas fa-route text-3xl mb-2" />
                            <div className="text-[14px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                Fill the form to see plant recommendations
                            </div>
                            <div className="text-[12px]">
                                Plants are ranked by free trucks at the requested time, distance to the job, and overall
                                load.
                            </div>
                        </div>
                    )}

                    {submitted && ranked.length === 0 && (
                        <div
                            className="rounded-lg p-6 text-center"
                            style={{
                                background: 'rgba(217, 119, 6, 0.1)',
                                border: '1px solid rgba(217, 119, 6, 0.35)',
                                color: '#b45309'
                            }}
                        >
                            <i className="fas fa-triangle-exclamation text-2xl mb-2" />
                            <div className="text-[14px] font-semibold">No plants available on {planDateLabel}.</div>
                            <div className="text-[12px] mt-1">
                                Plants may be closed (Sunday) or no driver pool data is available for this date.
                            </div>
                        </div>
                    )}

                    {submitted && top && (
                        <div
                            className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                            style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}33` }}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                                    style={{ background: accentColor, color: '#fff' }}
                                >
                                    <i className="fas fa-medal text-[16px]" />
                                </div>
                                <div className="min-w-0">
                                    <div
                                        className="text-[11px] font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        Best pick
                                    </div>
                                    <div
                                        className="text-[16px] font-bold truncate"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {top.plantName}{' '}
                                        <span
                                            className="text-[12px] font-normal"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            #{top.plantCode}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div
                                    className="text-[10px] font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    Score
                                </div>
                                <div
                                    className="text-[20px] font-bold tabular-nums"
                                    style={{ color: scoreTone(top.composite) }}
                                >
                                    {Math.round(top.composite * 100)}
                                </div>
                            </div>
                        </div>
                    )}

                    {submitted &&
                        ranked.map((row, idx) => (
                            <RecommendationCard
                                key={row.plantCode}
                                accentColor={accentColor}
                                isTop={idx === 0}
                                rank={idx + 1}
                                row={row}
                            />
                        ))}
                </section>
            </div>
        </div>
    )
}

export default BookOrderView
