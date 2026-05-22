import React, { useMemo, useState } from 'react'

import { requiredAverageStrength } from '../../../../utils/CalculatorMath'
import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

const EMPTY_FORM = { fc: '', sampleCount: '', stdDev: '' }

/**
 * ACI 318-19 §26.4.3 — required average compressive strength f'cr.
 *
 * f'cr is the strength a mix design must be PROPORTIONED to achieve so
 * that the AS-CAST concrete has a high statistical confidence of
 * meeting the specified f'c. Two paths:
 *
 *   • Known standard deviation (s established from ≥15 tests):
 *     §26.4.3.1.1 — use the over-design equations.
 *   • s unknown:
 *     Table 26.4.3.2.1 — add a flat margin based on the f'c bracket.
 *
 * The math lives in `CalculatorMath.requiredAverageStrength` so it's
 * unit-tested directly; this component is a thin form around it.
 */
const RequiredStrengthCalculator = () => {
    const [values, setValues] = useState(EMPTY_FORM)
    const setField = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))
    const clearForm = () => setValues(EMPTY_FORM)

    const result = useMemo(() => {
        const fc = parseFloat(values.fc)
        if (!Number.isFinite(fc) || fc <= 0) return null
        const stdDev = parseFloat(values.stdDev)
        const sampleCount = parseFloat(values.sampleCount)
        return requiredAverageStrength(fc, stdDev, sampleCount)
    }, [values])

    const status = useMemo(() => {
        if (!result) return null
        if (result.method === 'known-deviation') return { kind: 'success', label: 'Statistical' }
        return { kind: 'info', label: 'Estimated' }
    }, [result])

    const stats = useMemo(() => {
        if (!result) return []
        const fc = parseFloat(values.fc) || 0
        const tiles = [
            { label: "Specified f'c", value: `${fc.toLocaleString()} psi` },
            { label: 'Over-design', value: `${(result.fcr - fc).toLocaleString()} psi` },
            { label: 'Method', value: result.method === 'known-deviation' ? 'Eq. 26.4.3.1.1' : 'Table 26.4.3.2.1' }
        ]
        if (result.sUsed != null) {
            tiles.push({ label: 's used', value: `${result.sUsed.toFixed(0)} psi` })
        }
        return tiles
    }, [result, values.fc])

    return (
        <CalculatorShell
            icon="fa-bullseye"
            onReset={clearForm}
            placeholder="Enter f'c — and optionally the test-history standard deviation — to compute the required mix-design strength."
            placeholderIcon="fa-bullseye"
            primary={
                result ? { label: "required average strength f'cr (psi)", value: result.fcr.toLocaleString() } : null
            }
            stats={stats}
            status={status}
            title="Required Strength (f'cr)"
        >
            <div className="flex flex-col gap-5">
                <CalcSection title="Specified Strength">
                    <CalcField
                        label="f'c"
                        onChange={setField('fc')}
                        placeholder="4000"
                        suffix="psi"
                        value={values.fc}
                    />
                </CalcSection>
                <CalcSection title="Test-history (optional · ACI 318 §26.4.3.1)">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CalcField
                            label="Std deviation s"
                            onChange={setField('stdDev')}
                            placeholder="450"
                            suffix="psi"
                            value={values.stdDev}
                        />
                        <CalcField
                            label="Number of tests"
                            min="0"
                            onChange={setField('sampleCount')}
                            placeholder="30"
                            value={values.sampleCount}
                        />
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                        Leave the deviation blank when fewer than 15 tests are available — the calculator falls back to{' '}
                        <strong>Table 26.4.3.2.1</strong>. Between 15 and 29 tests, s is scaled per{' '}
                        <strong>Table 26.4.3.1.1</strong>.
                    </p>
                </CalcSection>
                {result && (
                    <CalcSection title="Formula used">
                        <code className="block w-full rounded-md bg-[var(--bg-secondary)] border border-[var(--border-light)] px-3 py-2.5 text-[12px] text-[var(--text-primary)] tabular-nums break-words">
                            {result.formula}
                        </code>
                    </CalcSection>
                )}
            </div>
        </CalculatorShell>
    )
}

export default RequiredStrengthCalculator
