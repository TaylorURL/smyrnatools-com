import React, { useMemo, useState } from 'react'

import {
    MAX_BALANCING_ITERATIONS,
    NEGLIGIBLE_ADDITION_THRESHOLD,
    POUNDS_PER_CUBIC_YARD,
    RATIO_CONVERGENCE_TOLERANCE
} from '../../../../app/constants/calculatorConstants'
import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

const MATERIAL_FIELDS = [
    { key: 'coarse', label: 'Coarse Agg' },
    { key: 'fine', label: 'Fine Agg' },
    { key: 'cement', label: 'Primary Powder' },
    { key: 'supplemental', label: 'Supplemental' }
]

const EMPTY_FORM = { cement: '', coarse: '', fine: '', supplemental: '' }

const parseWeights = (formValues) => ({
    cement: parseFloat(formValues.cement) || 0,
    coarse: parseFloat(formValues.coarse) || 0,
    fine: parseFloat(formValues.fine) || 0,
    supplemental: parseFloat(formValues.supplemental) || 0
})

/**
 * If numerator/denominator deviates from targetRatio, bump the smaller side
 * up. Returns true if an adjustment was made.
 */
const balanceRatio = (numerator, denominator, targetRatio, setDenominator, setNumerator) => {
    const currentRatio = denominator > 0 ? numerator / denominator : 0
    if (Math.abs(currentRatio - targetRatio) <= RATIO_CONVERGENCE_TOLERANCE) return false
    if (currentRatio > targetRatio) {
        const needed = numerator / targetRatio
        if (needed > denominator) {
            setDenominator(needed)
            return true
        }
    } else {
        const needed = denominator * targetRatio
        if (needed > numerator) {
            setNumerator(needed)
            return true
        }
    }
    return false
}

/**
 * Iteratively bumps each material upward until the three design ratios
 * (coarse:fine, aggregate:cementitious, primary:supplemental) converge.
 * Only adds material — never removes — so the batch grows to the nearest
 * valid proportion set.
 */
const solveProportionAdjustments = (targetWeights, actualWeights) => {
    const hasTargetData =
        targetWeights.coarse > 0 &&
        targetWeights.fine > 0 &&
        (targetWeights.cement > 0 || targetWeights.supplemental > 0)
    const hasActualData =
        actualWeights.coarse > 0 || actualWeights.fine > 0 || actualWeights.cement > 0 || actualWeights.supplemental > 0
    if (!hasTargetData || !hasActualData) return null

    let workingCoarse = Math.max(actualWeights.coarse, targetWeights.coarse)
    let workingFine = Math.max(actualWeights.fine, targetWeights.fine)
    let workingCement = Math.max(actualWeights.cement, targetWeights.cement)
    let workingSupplemental = Math.max(actualWeights.supplemental, targetWeights.supplemental)

    const targetAggregateRatio = targetWeights.coarse / targetWeights.fine
    const targetTotalAggregate = targetWeights.coarse + targetWeights.fine
    const targetTotalCite = targetWeights.cement + targetWeights.supplemental
    const targetAggregateToCiteRatio = targetTotalCite > 0 ? targetTotalAggregate / targetTotalCite : 0
    const targetCementToSupplementalRatio =
        targetWeights.supplemental > 0 ? targetWeights.cement / targetWeights.supplemental : 0

    for (let iteration = 0; iteration < MAX_BALANCING_ITERATIONS; iteration++) {
        let changed = false
        changed =
            balanceRatio(
                workingCoarse,
                workingFine,
                targetAggregateRatio,
                (val) => {
                    workingFine = val
                },
                (val) => {
                    workingCoarse = val
                }
            ) || changed
        const currentTotalAggregate = workingCoarse + workingFine
        const currentTotalCite = workingCement + workingSupplemental
        if (targetAggregateToCiteRatio > 0) {
            const neededTotalCite = currentTotalAggregate / targetAggregateToCiteRatio
            if (neededTotalCite - currentTotalCite > RATIO_CONVERGENCE_TOLERANCE) {
                if (targetCementToSupplementalRatio > 0) {
                    const ratioSum = targetCementToSupplementalRatio + 1
                    const neededSupplemental = neededTotalCite / ratioSum
                    const neededCement = neededSupplemental * targetCementToSupplementalRatio
                    if (neededCement > workingCement) {
                        workingCement = neededCement
                        changed = true
                    }
                    if (neededSupplemental > workingSupplemental) {
                        workingSupplemental = neededSupplemental
                        changed = true
                    }
                } else if (neededTotalCite > workingCement) {
                    workingCement = neededTotalCite
                    changed = true
                }
            }
        }
        if (targetCementToSupplementalRatio > 0) {
            changed =
                balanceRatio(
                    workingCement,
                    workingSupplemental,
                    targetCementToSupplementalRatio,
                    (val) => {
                        workingSupplemental = val
                    },
                    (val) => {
                        workingCement = val
                    }
                ) || changed
        }
        if (!changed) break
    }

    const totalTargetWeight =
        targetWeights.coarse + targetWeights.cement + targetWeights.fine + targetWeights.supplemental
    const totalAdjustedWeight = workingCoarse + workingFine + workingCement + workingSupplemental
    return {
        adjustedYards: totalAdjustedWeight > 0 ? totalAdjustedWeight / POUNDS_PER_CUBIC_YARD : 0,
        cement: workingCement - actualWeights.cement,
        coarse: workingCoarse - actualWeights.coarse,
        fine: workingFine - actualWeights.fine,
        supplemental: workingSupplemental - actualWeights.supplemental,
        targetYards: totalTargetWeight > 0 ? totalTargetWeight / POUNDS_PER_CUBIC_YARD : 0
    }
}

/**
 * Overweight / proportion-fix calculator. Given a target mix design and
 * actual batched weights, iteratively determines the minimum material
 * additions needed to restore the original design ratios. Hosted inside
 * `CalculatorShell` so the adjusted batch size leads.
 */
const ProportionsCalculator = () => {
    const [target, setTarget] = useState(EMPTY_FORM)
    const [actual, setActual] = useState(EMPTY_FORM)

    const handleSet = (setter) => (field) => (value) => setter((prev) => ({ ...prev, [field]: value }))

    const adjustments = useMemo(
        () => solveProportionAdjustments(parseWeights(target), parseWeights(actual)),
        [target, actual]
    )

    const clearForm = () => {
        setTarget(EMPTY_FORM)
        setActual(EMPTY_FORM)
    }

    const overshootYards = adjustments ? Math.max(0, adjustments.adjustedYards - adjustments.targetYards) : 0

    const status = adjustments
        ? overshootYards >= 0.5
            ? { kind: 'warning', label: 'Adjust Required' }
            : overshootYards > 0
              ? { kind: 'info', label: 'Minor Bump' }
              : { kind: 'success', label: 'On Spec' }
        : null

    const stats = useMemo(() => {
        if (!adjustments) return []
        return MATERIAL_FIELDS.map(({ key, label }) => {
            const raw = adjustments[key]
            const add = raw < NEGLIGIBLE_ADDITION_THRESHOLD ? 0 : Math.round(raw)
            return { label, value: add > 0 ? `+${add} lb` : 'None' }
        })
    }, [adjustments])

    const renderFieldGroup = (form, setter) =>
        MATERIAL_FIELDS.map(({ key, label }) => (
            <CalcField
                key={key}
                label={label}
                onChange={handleSet(setter)(key)}
                placeholder="0"
                suffix="lbs"
                value={form[key]}
            />
        ))

    return (
        <CalculatorShell
            icon="fa-balance-scale"
            onReset={clearForm}
            placeholder="Enter target mix design and actual batch weights to calculate adjustments"
            placeholderIcon="fa-balance-scale"
            primary={
                adjustments
                    ? { label: 'cubic yards adjusted batch', value: adjustments.adjustedYards.toFixed(1) }
                    : null
            }
            secondary={
                adjustments
                    ? {
                          label: `target ${adjustments.targetYards.toFixed(1)} yd`,
                          value: `+${overshootYards.toFixed(1)}`
                      }
                    : null
            }
            stats={stats}
            status={status}
            title="Overweight Mix Fix"
        >
            <div className="flex flex-col gap-5">
                <CalcSection title="Target Mix Design (lb)">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{renderFieldGroup(target, setTarget)}</div>
                </CalcSection>
                <CalcSection title="Actual Batch Weights (lb)">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{renderFieldGroup(actual, setActual)}</div>
                </CalcSection>
            </div>
        </CalculatorShell>
    )
}

export default ProportionsCalculator
