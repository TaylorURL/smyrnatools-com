import React, { useMemo, useState } from 'react'

import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'
import { WATER_LBS_PER_GALLON } from './calculatorConstants'

/** Maps W/C ratio quality tiers to CalculatorShell status kinds. */
const RATIO_STATUS = (ratio) => {
    if (ratio < 0.35) return { kind: 'warning', label: 'Low' }
    if (ratio <= 0.45) return { kind: 'success', label: 'Optimal' }
    if (ratio <= 0.55) return { kind: 'info', label: 'Standard' }
    return { kind: 'danger', label: 'High' }
}

const EMPTY_FORM = { batchSize: '', cementLbs: '', supplementalLbs: '', waterGallons: '' }

/**
 * Water-to-cementitious (W/C) ratio calculator. Converts water from gallons
 * to pounds (at 8.34 lbs/gal) and divides by total cementitious content
 * (primary + supplemental powder). Renders inside `CalculatorShell` so the
 * headline ratio sits at the top and inputs are below.
 */
const WaterCementCalculator = () => {
    const [values, setValues] = useState(EMPTY_FORM)

    const handleChange = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))
    const clearForm = () => setValues(EMPTY_FORM)

    const result = useMemo(() => {
        const batchSize = parseFloat(values.batchSize) || 0
        const waterGal = parseFloat(values.waterGallons) || 0
        const cement = parseFloat(values.cementLbs) || 0
        const supplemental = parseFloat(values.supplementalLbs) || 0
        const totalCite = cement + supplemental
        if (waterGal <= 0 || totalCite <= 0) return null
        const waterLbs = waterGal * WATER_LBS_PER_GALLON
        const ratio = waterLbs / totalCite
        return {
            batchSize: batchSize > 0 ? batchSize : null,
            citePerYd: batchSize > 0 ? Math.round(totalCite / batchSize) : null,
            ratio: ratio.toFixed(2),
            totalCite: Math.round(totalCite),
            waterLbs: Math.round(waterLbs),
            waterPerYd: batchSize > 0 ? Math.round(waterLbs / batchSize) : null
        }
    }, [values])

    const status = result ? RATIO_STATUS(parseFloat(result.ratio)) : null

    const stats = useMemo(() => {
        if (!result) return []
        const tiles = [
            { label: 'Water', value: `${result.waterLbs} lbs` },
            { label: 'Cementitious', value: `${result.totalCite} lbs` }
        ]
        if (result.batchSize) {
            tiles.push({ label: 'Water / yd', value: `${result.waterPerYd} lb` })
            tiles.push({ label: 'Cite / yd', value: `${result.citePerYd} lb` })
        }
        return tiles
    }, [result])

    return (
        <CalculatorShell
            icon="fa-percentage"
            onReset={clearForm}
            placeholder="Enter water and cementitious weights to compute the W/C ratio"
            placeholderIcon="fa-percentage"
            primary={result ? { label: 'water / cementitious ratio', value: result.ratio } : null}
            stats={stats}
            status={status}
            title="Water / Cement Ratio"
        >
            <div className="flex flex-col gap-5">
                <CalcSection title="Water">
                    <CalcField
                        label="Water"
                        onChange={handleChange('waterGallons')}
                        placeholder="0"
                        suffix="gal"
                        value={values.waterGallons}
                    />
                </CalcSection>
                <CalcSection title="Cementitious Materials">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <CalcField
                            label="Primary Powder"
                            onChange={handleChange('cementLbs')}
                            placeholder="0"
                            suffix="lbs"
                            value={values.cementLbs}
                        />
                        <CalcField
                            label="Supplemental"
                            onChange={handleChange('supplementalLbs')}
                            placeholder="0"
                            suffix="lbs"
                            value={values.supplementalLbs}
                        />
                    </div>
                </CalcSection>
                <CalcSection title="Per Yard (optional)">
                    <CalcField
                        label="Batch Size"
                        onChange={handleChange('batchSize')}
                        placeholder="10"
                        step="0.5"
                        suffix="yd"
                        value={values.batchSize}
                    />
                </CalcSection>
            </div>
        </CalculatorShell>
    )
}

export default WaterCementCalculator
