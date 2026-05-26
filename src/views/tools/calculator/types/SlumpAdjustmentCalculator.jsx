import React, { useMemo, useState } from 'react'

import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

/** Industry rule of thumb: ~3 gallons of water per yard per inch of slump change. */
const WATER_GAL_PER_YD_PER_IN = 3

const EMPTY_FORM = { batchSize: '', currentSlump: '', currentWater: '', targetSlump: '' }

/**
 * Slump adjustment calculator. Determines water to add or remove to hit a
 * target slump using the standard ~3 gal/yd/in approximation, optionally
 * factoring in the current batch water to project the new total. Rendered
 * inside `CalculatorShell` so the recommended adjustment leads.
 */
const SlumpAdjustmentCalculator = () => {
    const [values, setValues] = useState(EMPTY_FORM)

    const handleChange = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))
    const clearForm = () => setValues(EMPTY_FORM)

    const result = useMemo(() => {
        const current = parseFloat(values.currentSlump) || 0
        const target = parseFloat(values.targetSlump) || 0
        const batch = parseFloat(values.batchSize) || 0
        const water = parseFloat(values.currentWater) || 0
        if (current <= 0 || target <= 0 || batch <= 0) return null
        const slumpDiff = target - current
        const waterAdjustment = slumpDiff * WATER_GAL_PER_YD_PER_IN * batch
        const newWater = water + waterAdjustment
        // Rough estimate: each % increase in batch water reduces strength by ~0.5%.
        const strengthImpact = waterAdjustment > 0 ? Math.round((waterAdjustment / (water || 1)) * 100 * 0.5) : 0
        return {
            current,
            direction: slumpDiff > 0 ? 'add' : slumpDiff < 0 ? 'reduce' : 'none',
            newWater,
            slumpDiff,
            strengthImpact,
            target,
            waterAdjustment
        }
    }, [values])

    const primary = result
        ? {
              label:
                  result.direction === 'add'
                      ? 'gallons of water to add'
                      : result.direction === 'reduce'
                        ? 'gallons of water to reduce'
                        : 'no adjustment needed',
              value: Math.abs(result.waterAdjustment).toFixed(1)
          }
        : null

    const status = result
        ? result.direction === 'add'
            ? { kind: 'success', label: 'Add Water' }
            : result.direction === 'reduce'
              ? { kind: 'danger', label: 'Reduce Water' }
              : { kind: 'neutral', label: 'On Target' }
        : null

    const stats = useMemo(() => {
        if (!result) return []
        const tiles = [
            { label: 'Slump Δ', value: `${result.slumpDiff > 0 ? '+' : ''}${result.slumpDiff.toFixed(1)} in` },
            { label: 'Current Slump', value: `${result.current.toFixed(1)} in` },
            { label: 'Target Slump', value: `${result.target.toFixed(1)} in` }
        ]
        if (parseFloat(values.currentWater) > 0) {
            tiles.push({ label: 'New Total Water', value: `${result.newWater.toFixed(1)} gal` })
        }
        return tiles
    }, [result, values.currentWater])

    return (
        <CalculatorShell
            icon="fa-tint"
            onReset={clearForm}
            placeholder="Enter current and target slump plus batch size to calculate the water adjustment"
            placeholderIcon="fa-tint"
            primary={primary}
            stats={stats}
            status={status}
            title="Slump Adjustment"
        >
            <div className="flex flex-col gap-5">
                <CalcSection title="Slump">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <CalcField
                            label="Current Slump"
                            onChange={handleChange('currentSlump')}
                            placeholder="0"
                            step="0.5"
                            suffix="in"
                            value={values.currentSlump}
                        />
                        <CalcField
                            label="Target Slump"
                            onChange={handleChange('targetSlump')}
                            placeholder="0"
                            step="0.5"
                            suffix="in"
                            value={values.targetSlump}
                        />
                        <CalcField
                            label="Batch Size"
                            onChange={handleChange('batchSize')}
                            placeholder="10"
                            suffix="yd"
                            value={values.batchSize}
                        />
                    </div>
                </CalcSection>
                <CalcSection title="Current Batch Water (optional)">
                    <CalcField
                        label="Current Water"
                        onChange={handleChange('currentWater')}
                        placeholder="0"
                        suffix="gal"
                        value={values.currentWater}
                    />
                </CalcSection>
                {result && result.strengthImpact > 0 && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-lg bg-[color:var(--warning)]/10 border border-[color:var(--warning)]/40 text-text-primary text-sm font-medium p-3"
                    >
                        <i className="fas fa-exclamation-triangle mt-0.5" />
                        <span>Adding water may reduce strength by ~{result.strengthImpact}%.</span>
                    </div>
                )}
            </div>
        </CalculatorShell>
    )
}

export default SlumpAdjustmentCalculator
