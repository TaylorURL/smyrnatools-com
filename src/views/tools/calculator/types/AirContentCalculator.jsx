import React, { useMemo, useState } from 'react'

import { ACI_EXPOSURE_CLASSES, requiredAirContentPercent } from '../../../../utils/CalculatorMath'
import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

const AGG_SIZES = [
    { id: '0.375', label: '3/8"' },
    { id: '0.5', label: '1/2"' },
    { id: '0.75', label: '3/4"' },
    { id: '1.0', label: '1"' },
    { id: '1.5', label: '1-1/2"' },
    { id: '2.0', label: '2"' },
    { id: '3.0', label: '3"' }
]

const FROST_OPTIONS = ACI_EXPOSURE_CLASSES.filter((e) => e.group === 'Frost')

const EMPTY_FORM = { aggSize: '0.75', exposureClass: 'F2', tolerancePercent: '1.5' }

/**
 * ACI 318-19 Table 19.3.3.1 — total air content required for
 * frost-resistant concrete. The math is a lookup keyed by nominal max
 * aggregate size + exposure class; F1 (moderate) gets a 1% reduction
 * from the severe-exposure value, F0 imposes no requirement.
 *
 * Logic lives in `CalculatorMath.requiredAirContentPercent`.
 */
const AirContentCalculator = () => {
    const [values, setValues] = useState(EMPTY_FORM)
    const setField = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))
    const clearForm = () => setValues(EMPTY_FORM)

    const required = useMemo(
        () => requiredAirContentPercent(parseFloat(values.aggSize), values.exposureClass),
        [values.aggSize, values.exposureClass]
    )

    const tolerance = parseFloat(values.tolerancePercent) || 0
    const status = useMemo(() => {
        if (required == null) return { kind: 'info', label: 'Not required' }
        if (required >= 6) return { kind: 'warning', label: 'High air' }
        if (required >= 5) return { kind: 'success', label: 'Standard' }
        return { kind: 'info', label: 'Low' }
    }, [required])

    const stats = useMemo(() => {
        if (required == null) {
            return [
                { label: 'Exposure', value: values.exposureClass },
                { label: 'Standard', value: 'ACI 318-19 §19.3' }
            ]
        }
        const lower = Math.max(0, required - tolerance)
        const upper = required + tolerance
        return [
            { label: 'Acceptance range', value: `${lower.toFixed(1)}–${upper.toFixed(1)}%` },
            { label: 'Tolerance', value: `±${tolerance.toFixed(1)}%` },
            { label: 'Aggregate', value: AGG_SIZES.find((a) => a.id === values.aggSize)?.label || '—' },
            { label: 'Exposure', value: values.exposureClass }
        ]
    }, [required, tolerance, values])

    return (
        <CalculatorShell
            icon="fa-wind"
            onReset={clearForm}
            placeholder="Pick a nominal aggregate size and exposure class to look up the required air content."
            placeholderIcon="fa-wind"
            primary={
                required != null
                    ? { label: 'total air content (%)', value: required.toFixed(1) }
                    : { label: 'no air-entrainment requirement', value: 'n/a' }
            }
            stats={stats}
            status={status}
            title="Required Air Content"
        >
            <div className="flex flex-col gap-5">
                <CalcSection title="Nominal max aggregate">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {AGG_SIZES.map((a) => {
                            const active = values.aggSize === a.id
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => setField('aggSize')(a.id)}
                                    aria-pressed={active}
                                    className={`rounded-md px-2 py-1.5 text-[12px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${
                                        active
                                            ? 'bg-accent text-white border border-accent'
                                            : 'bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-medium)]'
                                    }`}
                                >
                                    {a.label}
                                </button>
                            )
                        })}
                    </div>
                </CalcSection>
                <CalcSection title="Exposure class">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {FROST_OPTIONS.map((opt) => {
                            const active = values.exposureClass === opt.code
                            return (
                                <button
                                    key={opt.code}
                                    type="button"
                                    onClick={() => setField('exposureClass')(opt.code)}
                                    aria-pressed={active}
                                    aria-label={`${opt.code}: ${opt.description}`}
                                    className={`flex flex-col items-start rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${
                                        active
                                            ? 'bg-accent text-white border border-accent'
                                            : 'bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-medium)]'
                                    }`}
                                >
                                    <span className="text-[12.5px] font-bold">{opt.code}</span>
                                    <span
                                        className={`text-[10.5px] mt-0.5 leading-tight line-clamp-2 ${active ? 'text-white/80' : 'text-[var(--text-tertiary)]'}`}
                                    >
                                        {opt.description}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </CalcSection>
                <CalcSection title="Field tolerance (ASTM C231)">
                    <CalcField
                        label="±%"
                        onChange={setField('tolerancePercent')}
                        placeholder="1.5"
                        step="0.1"
                        suffix="%"
                        value={values.tolerancePercent}
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                        ASTM C94 §6.1.2 / ACI 318-19 §26.4.1.4 — field air results commonly tolerate ±1.5% from the
                        target. Use the project spec when stricter.
                    </p>
                </CalcSection>
            </div>
        </CalculatorShell>
    )
}

export default AirContentCalculator
