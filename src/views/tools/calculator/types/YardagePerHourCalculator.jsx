import React, { useEffect, useMemo, useState } from 'react'

import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

const YARDS_PER_LOAD = 10

/** Per-tier metadata for the production rate grade. */
const PERFORMANCE_TIERS = [
    { kind: 'success', label: 'Excellent', min: 40 },
    { kind: 'success', label: 'Good', min: 30 },
    { kind: 'info', label: 'Average', min: 20 },
    { kind: 'warning', label: 'Below Avg', min: 10 },
    { kind: 'danger', label: 'Slow', min: 0 }
]

const getCurrentTimeString = () => new Date().toTimeString().slice(0, 5)

const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null
    const [hours, mins] = timeStr.split(':').map((p) => parseInt(p, 10))
    if (isNaN(hours) || isNaN(mins)) return null
    return hours * 60 + mins
}

/**
 * Real-time yardage production rate calculator. Two modes — `Live` keeps the
 * "Now" timestamp ticking so a rate can be tracked mid-pour, and `Completed`
 * lets the user enter both endpoints manually for a finished pour. Computes
 * yards/hr, loads/hr (assuming 10 yd/load), and total elapsed time, then
 * grades the rate. Hosted inside `CalculatorShell` so the rate leads.
 */
const YardagePerHourCalculator = () => {
    const [values, setValues] = useState({
        completionTime: '',
        firstLoadTime: '',
        totalYards: '',
        yardsPoured: ''
    })
    const [isOngoing, setIsOngoing] = useState(true)

    const handleChange = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))

    useEffect(() => {
        if (!values.completionTime) {
            setValues((prev) => ({ ...prev, completionTime: getCurrentTimeString() }))
        }
    }, [values.completionTime])

    // In live mode, refresh the "now" timestamp every 60s so the rate stays current.
    useEffect(() => {
        if (!isOngoing) return undefined
        setValues((prev) => ({ ...prev, completionTime: getCurrentTimeString() }))
        const interval = setInterval(() => {
            setValues((prev) => ({ ...prev, completionTime: getCurrentTimeString() }))
        }, 60000)
        return () => clearInterval(interval)
    }, [isOngoing])

    const result = useMemo(() => {
        const firstLoadMins = parseTimeToMinutes(values.firstLoadTime)
        const completionMins = parseTimeToMinutes(values.completionTime)
        const yards = isOngoing ? parseFloat(values.yardsPoured) : parseFloat(values.totalYards)
        if (firstLoadMins === null || completionMins === null || isNaN(yards) || yards <= 0) return null
        let elapsedMins = completionMins - firstLoadMins
        // Handle overnight pours where the completion time crosses midnight.
        if (elapsedMins <= 0) elapsedMins += 24 * 60
        const yardsPerHour = yards / (elapsedMins / 60)
        const hours = Math.floor(elapsedMins / 60)
        const mins = elapsedMins % 60
        return {
            elapsedTime: `${hours}h ${mins}m`,
            loadsPerHour: (yardsPerHour / YARDS_PER_LOAD).toFixed(2),
            totalYards: yards,
            yardsPerHour: yardsPerHour.toFixed(1)
        }
    }, [values, isOngoing])

    const status = result ? PERFORMANCE_TIERS.find((tier) => parseFloat(result.yardsPerHour) >= tier.min) : null

    const clearForm = () => {
        setValues({
            completionTime: getCurrentTimeString(),
            firstLoadTime: '',
            totalYards: '',
            yardsPoured: ''
        })
        setIsOngoing(false)
    }

    const stats = useMemo(() => {
        if (!result) return []
        return [
            { label: 'Loads / hr', value: result.loadsPerHour },
            { label: isOngoing ? 'Yards Poured' : 'Total Yards', value: result.totalYards },
            { label: 'Elapsed', value: result.elapsedTime },
            { label: 'Performance', value: status?.label || '—' }
        ]
    }, [result, isOngoing, status])

    const yardsField = isOngoing ? 'yardsPoured' : 'totalYards'

    const modeToggle = (
        <div role="group" aria-label="Pour mode" className="inline-flex items-center rounded-lg p-0.5 gap-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)]">
            <button
                type="button"
                onClick={() => setIsOngoing(false)}
                aria-pressed={!isOngoing}
                className={`flex items-center gap-1.5 font-semibold rounded text-xs py-1 px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${!isOngoing ? 'bg-accent text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
                Completed
            </button>
            <button
                type="button"
                onClick={() => setIsOngoing(true)}
                aria-pressed={isOngoing}
                className={`flex items-center gap-1.5 font-semibold rounded text-xs py-1 px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${isOngoing ? 'bg-accent text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
                <i className="fas fa-circle text-[6px]" />
                Live
            </button>
        </div>
    )

    return (
        <CalculatorShell
            icon="fa-tachometer-alt"
            onReset={clearForm}
            placeholder="Enter yards poured and load times to calculate the production rate"
            placeholderIcon="fa-truck-loading"
            primary={result ? { label: 'yards per hour', value: result.yardsPerHour } : null}
            stats={stats}
            status={status ? { kind: status.kind, label: status.label } : null}
            title="Yardage Per Hour"
        >
            <div className="flex flex-col gap-5">
                <CalcSection action={modeToggle} icon="fa-stopwatch" title="Pour Window">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <CalcField
                            label={isOngoing ? 'Poured' : 'Total'}
                            onChange={handleChange(yardsField)}
                            placeholder="0"
                            suffix="yd"
                            value={values[yardsField]}
                        />
                        <CalcField
                            label="First Load"
                            onChange={handleChange('firstLoadTime')}
                            type="time"
                            value={values.firstLoadTime}
                        />
                        <CalcField label={isOngoing ? 'Now' : 'Last Poured'}>
                            {isOngoing ? (
                                <div role="status" aria-live="polite" className="flex items-center gap-2 w-full rounded-lg bg-[color:var(--success)]/10 border border-[color:var(--success)]/40 text-text-primary font-bold text-sm py-2.5 px-3">
                                    <i className="fas fa-circle text-[6px] animate-pulse text-[color:var(--success)]" />
                                    <span className="tabular-nums">{values.completionTime}</span>
                                </div>
                            ) : (
                                <input
                                    type="time"
                                    aria-label="Last load completion time"
                                    value={values.completionTime}
                                    onChange={(e) => handleChange('completionTime')(e.target.value)}
                                    className="w-full bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-semibold outline-none transition-colors duration-150 px-3 py-2.5 [color-scheme:light] dark:[color-scheme:dark] hover:border-[var(--border-dark)] focus:border-accent focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                                />
                            )}
                        </CalcField>
                    </div>
                </CalcSection>
            </div>
        </CalculatorShell>
    )
}

export default YardagePerHourCalculator
