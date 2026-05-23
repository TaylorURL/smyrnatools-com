/* eslint-disable react/forbid-dom-props */
import React from 'react'

/* ── Plan-tab design tokens ───────────────────────────────────────────────
 *  Same vocabulary used by every redesigned report. */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }

const WEEKDAYS = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' }
]

/** Compact card header — same primitive used by every other redesigned
 *  report. */
function CardHeader({ icon, label, sub, title }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="min-w-0 flex-1">
                {label && (
                    <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        {label}
                    </div>
                )}
                <div className="text-[12.5px] font-semibold leading-tight text-text-primary">{title}</div>
                {sub && <div className="text-[10.5px] mt-0.5 text-text-tertiary">{sub}</div>}
            </div>
        </div>
    )
}

function DailyRecapSection({ form, handleChange, readOnly }) {
    return (
        <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-clipboard-list"
                label="Recap"
                title="Daily Activity Recaps"
                sub="QC activities, sample notes, mix-design decisions, and accomplishments per day."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {WEEKDAYS.map((day) => {
                    const value = form[day.key] ?? ''
                    return (
                        <div
                            key={day.key}
                            className="rounded p-2.5 flex flex-col gap-1.5 bg-bg-secondary border border-border-light"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <i className="fas fa-calendar-day text-[10px] text-text-tertiary" />
                                    <span className="text-[11.5px] font-semibold text-text-primary">{day.label}</span>
                                    {!readOnly && <span className="text-text-primary">*</span>}
                                </div>
                                <span className="text-[10px] tabular-nums text-text-tertiary">{value.length}</span>
                            </div>
                            <textarea
                                value={value}
                                onChange={(e) => handleChange(e, day.key)}
                                placeholder={readOnly ? '—' : `Notes for ${day.label.toLowerCase()}…`}
                                required={!readOnly}
                                disabled={readOnly}
                                rows={5}
                                className="w-full rounded px-2 py-1.5 text-[12px] outline-none resize-y min-h-[88px] disabled:opacity-90 bg-bg-primary border border-border-light text-text-primary"
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function QualityControlManagerPlugin({ form, setForm, readOnly }) {
    const handleChange = (e, name) => {
        if (setForm) setForm((prev) => ({ ...prev, [name]: e.target.value }))
    }
    return <DailyRecapSection form={form} handleChange={handleChange} readOnly={readOnly} />
}

/** Submit-mode wrapper for the Quality Control Manager report plugin. */
export function QualityControlManagerSubmitPlugin(props) {
    return <QualityControlManagerPlugin {...props} />
}

/** Review-mode wrapper for the Quality Control Manager report plugin (read-only). */
export function QualityControlManagerReviewPlugin({ form }) {
    return <QualityControlManagerPlugin form={form} readOnly />
}
