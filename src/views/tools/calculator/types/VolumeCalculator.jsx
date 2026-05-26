import React, { useMemo, useState } from 'react'

import {
    applyWasteFactor,
    footingVolume,
    POUNDS_PER_CUBIC_YARD,
    rectangularColumnVolume,
    roundColumnVolume,
    slabVolume
} from '../../../../utils/CalculatorMath'
import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

const SHAPES = [
    { icon: 'fa-square', id: 'slab', label: 'Slab' },
    { icon: 'fa-cube', id: 'footing', label: 'Footing' },
    { icon: 'fa-vector-square', id: 'rectColumn', label: 'Rect. Column' },
    { icon: 'fa-circle', id: 'roundColumn', label: 'Round Column' }
]

const inchesToFeet = (value) => {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n / 12 : null
}
const feet = (value) => {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : null
}

/* Each shape declares its own input set so the form swaps cleanly when
 * the user changes shape. `compute` returns yd³ given the dictionary of
 * parsed inputs; `null` means "not enough info" and the shell shows the
 * placeholder. */
const SHAPE_CONFIG = {
    footing: {
        compute: ({ length, width, depth }) => footingVolume({ depthFt: depth, lengthFt: length, widthFt: width }),
        fields: [
            { key: 'length', label: 'Length', placeholder: '8', unit: 'ft' },
            { key: 'width', label: 'Width', placeholder: '2', unit: 'ft' },
            { key: 'depth', label: 'Depth', placeholder: '12', unit: 'in' }
        ]
    },
    rectColumn: {
        compute: ({ depth, height, width }) =>
            rectangularColumnVolume({ depthFt: depth, heightFt: height, widthFt: width }),
        fields: [
            { key: 'width', label: 'Width', placeholder: '12', unit: 'in' },
            { key: 'depth', label: 'Depth', placeholder: '12', unit: 'in' },
            { key: 'height', label: 'Height', placeholder: '10', unit: 'ft' }
        ]
    },
    roundColumn: {
        compute: ({ diameter, height }) => roundColumnVolume({ diameterFt: diameter, heightFt: height }),
        fields: [
            { key: 'diameter', label: 'Diameter', placeholder: '12', unit: 'in' },
            { key: 'height', label: 'Height', placeholder: '10', unit: 'ft' }
        ]
    },
    slab: {
        compute: ({ length, thickness, width }) =>
            slabVolume({ lengthFt: length, thicknessFt: thickness, widthFt: width }),
        fields: [
            { key: 'length', label: 'Length', placeholder: '20', unit: 'ft' },
            { key: 'width', label: 'Width', placeholder: '12', unit: 'ft' },
            { key: 'thickness', label: 'Thickness', placeholder: '4', unit: 'in' }
        ]
    }
}

/**
 * Pour-volume calculator for slabs, footings, rectangular columns, and
 * round columns. Reports cubic yards (the dispatch unit), with a waste
 * factor for over-ordering and an approximate weight using ACI 211's
 * normal-weight figure (~145 lb/ft³ × 27 = 3915 lb/yd³).
 */
const VolumeCalculator = () => {
    const [shape, setShape] = useState('slab')
    const [values, setValues] = useState({})
    const [waste, setWaste] = useState('10')

    const setField = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))
    const clearForm = () => {
        setValues({})
        setWaste('10')
    }

    const result = useMemo(() => {
        const cfg = SHAPE_CONFIG[shape]
        if (!cfg) return null
        // Convert each input to feet at evaluation time so inches-keyed
        // fields (thickness, diameter, ...) don't have to be parsed by
        // the math helpers themselves.
        const parsed = cfg.fields.reduce((acc, field) => {
            acc[field.key] = field.unit === 'in' ? inchesToFeet(values[field.key]) : feet(values[field.key])
            return acc
        }, {})
        const base = cfg.compute(parsed)
        if (!Number.isFinite(base) || base <= 0) return null
        const wasteFactor = 1 + (parseFloat(waste) || 0) / 100
        const ordered = applyWasteFactor(base, wasteFactor)
        return {
            base,
            ordered,
            wastePct: ((wasteFactor - 1) * 100).toFixed(0),
            weightLbs: ordered * POUNDS_PER_CUBIC_YARD
        }
    }, [shape, values, waste])

    const status = result
        ? result.base < 1
            ? { kind: 'info', label: 'Small Pour' }
            : result.base < 10
              ? { kind: 'success', label: 'Standard' }
              : { kind: 'warning', label: 'Large Pour' }
        : null

    const stats = useMemo(() => {
        if (!result) return []
        return [
            { label: 'Net volume', value: `${result.base.toFixed(2)} yd³` },
            { label: 'Waste', value: `${result.wastePct}%` },
            { label: 'Approx. weight', value: `${Math.round(result.weightLbs).toLocaleString()} lb` },
            { label: 'Loads (10 yd)', value: Math.ceil(result.ordered / 10) }
        ]
    }, [result])

    const cfg = SHAPE_CONFIG[shape]
    const shapeSwitcher = (
        <div
            role="group"
            aria-label="Shape"
            className="inline-flex items-center rounded-lg p-0.5 gap-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] flex-wrap"
        >
            {SHAPES.map((s) => {
                const active = shape === s.id
                return (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                            setShape(s.id)
                            setValues({})
                        }}
                        aria-pressed={active}
                        className={`flex items-center gap-1.5 font-semibold rounded text-[11.5px] py-1 px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${active ? 'bg-accent text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                        <i className={`fas ${s.icon} text-[10px]`} />
                        {s.label}
                    </button>
                )
            })}
        </div>
    )

    return (
        <CalculatorShell
            icon="fa-ruler-combined"
            onReset={clearForm}
            placeholder="Pick a shape and enter dimensions to compute the order volume."
            placeholderIcon="fa-ruler-combined"
            primary={result ? { label: 'cubic yards to order', value: result.ordered.toFixed(2) } : null}
            stats={stats}
            status={status}
            title="Volume Calculator"
        >
            <div className="flex flex-col gap-5">
                <CalcSection action={shapeSwitcher} title="Shape" />
                <CalcSection title="Dimensions">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {cfg.fields.map((field) => (
                            <CalcField
                                key={field.key}
                                label={field.label}
                                onChange={setField(field.key)}
                                placeholder={field.placeholder}
                                suffix={field.unit}
                                value={values[field.key] ?? ''}
                            />
                        ))}
                    </div>
                </CalcSection>
                <CalcSection title="Waste / over-order">
                    <CalcField label="Waste" onChange={setWaste} placeholder="10" suffix="%" value={waste} />
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                        ACI 304R suggests 5–10% extra for slabs / footings, more for irregular forms. Trucks dispatch in
                        whole loads; the loads tile rounds up.
                    </p>
                </CalcSection>
            </div>
        </CalculatorShell>
    )
}

export default VolumeCalculator
