import React, { useMemo, useState } from 'react'

import { minimumCuringDays } from '../../../../utils/CalculatorMath'
import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'

const MIX_TYPES = [
    { hint: 'Type I / II / V, no accelerator', id: 'normal', label: 'Normal' },
    { hint: 'Type III or HE accelerator', id: 'high-early', label: 'High-early' },
    { hint: 'Fly ash / slag > 20%', id: 'pozzolan', label: 'Pozzolan-heavy' }
]

const EMPTY_FORM = {
    averageTempF: '70',
    exposureSevere: false,
    mixType: 'normal',
    pourDate: ''
}

const formatPourEnd = (pourDateIso, days) => {
    if (!pourDateIso || !Number.isFinite(days)) return null
    const ms = Date.parse(`${pourDateIso}T12:00:00`)
    if (!Number.isFinite(ms)) return null
    const end = new Date(ms + days * 86400000)
    return end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' })
}

/**
 * ACI 308.1 — minimum curing duration. Starts from the §6.3.4 base
 * window (7 days normal, 3 high-early, 14 pozzolan-heavy), then layers
 * the ACI 306 cold-weather extension (one extra day per 10 °F below
 * 50 °F) and the durability-exposure bump (severe = +3 days).
 *
 * The underlying math lives in `CalculatorMath.minimumCuringDays`.
 */
const CuringScheduleCalculator = () => {
    const [values, setValues] = useState(EMPTY_FORM)
    const setField = (field) => (value) => setValues((prev) => ({ ...prev, [field]: value }))
    const clearForm = () => setValues(EMPTY_FORM)

    const days = useMemo(
        () =>
            minimumCuringDays({
                averageTempF: parseFloat(values.averageTempF),
                exposureSevere: values.exposureSevere,
                mixType: values.mixType
            }),
        [values]
    )

    const endDate = formatPourEnd(values.pourDate, days)
    const status =
        days <= 3
            ? { kind: 'success', label: 'Short' }
            : days <= 7
              ? { kind: 'info', label: 'Standard' }
              : days <= 10
                ? { kind: 'warning', label: 'Extended' }
                : { kind: 'danger', label: 'Long' }

    const stats = useMemo(() => {
        const tiles = [
            { label: 'Mix type', value: MIX_TYPES.find((m) => m.id === values.mixType)?.label || '—' },
            { label: 'Avg. temperature', value: `${values.averageTempF || 0}°F` },
            { label: 'Exposure', value: values.exposureSevere ? 'Severe (+3d)' : 'Normal' }
        ]
        if (endDate) tiles.push({ label: 'Curing ends', value: endDate })
        return tiles
    }, [endDate, values])

    return (
        <CalculatorShell
            icon="fa-droplet"
            onReset={clearForm}
            placeholder="Pick a mix type, average temperature, and exposure category to compute the minimum curing window."
            placeholderIcon="fa-droplet"
            primary={{ label: 'minimum curing days', value: days }}
            stats={stats}
            status={status}
            title="Curing Schedule"
        >
            <div className="flex flex-col gap-5">
                <CalcSection title="Mix type">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {MIX_TYPES.map((m) => {
                            const active = values.mixType === m.id
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setField('mixType')(m.id)}
                                    className={`flex flex-col items-start rounded-md px-3 py-2 text-left transition-colors ${
                                        active
                                            ? 'bg-accent text-white border border-accent'
                                            : 'bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    <span className="text-[12.5px] font-semibold">{m.label}</span>
                                    <span
                                        className={`text-[10.5px] mt-0.5 ${active ? 'text-white/80' : 'text-[var(--text-tertiary)]'}`}
                                    >
                                        {m.hint}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </CalcSection>
                <CalcSection title="Conditions">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CalcField
                            label="Avg. air temp"
                            onChange={setField('averageTempF')}
                            placeholder="70"
                            suffix="°F"
                            value={values.averageTempF}
                        />
                        <CalcField label="Pour date">
                            <input
                                type="date"
                                value={values.pourDate}
                                onChange={(e) => setField('pourDate')(e.target.value)}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] text-[13px] font-semibold outline-none transition-colors duration-150 px-2.5 py-2 focus:border-accent"
                            />
                        </CalcField>
                    </div>
                </CalcSection>
                <CalcSection title="Durability">
                    <label className="flex items-start gap-2.5 cursor-pointer rounded-md px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)]">
                        <input
                            checked={values.exposureSevere}
                            onChange={(e) => setField('exposureSevere')(e.target.checked)}
                            type="checkbox"
                            className="mt-0.5"
                        />
                        <div className="flex-1">
                            <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                                Severe exposure (F2 / F3 / marine / chloride)
                            </div>
                            <div className="text-[11px] text-[var(--text-tertiary)]">
                                Adds 3 days per ACI 308.1 §6.3.4.2 commentary.
                            </div>
                        </div>
                    </label>
                </CalcSection>
            </div>
        </CalculatorShell>
    )
}

export default CuringScheduleCalculator
