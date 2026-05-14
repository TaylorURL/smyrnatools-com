/* eslint-disable react/forbid-dom-props */
import React from 'react'

import DateUtility from '../../../utils/DateUtility'
import { FIELD_STYLE } from '../../constants/verificationModalConstants'
import { Banner, FieldLabel, Hint, Pill, Section, SimpleField } from './VerificationAtoms'

function checklistStatusPill({ requiredFieldsOk, serviceOverdue }) {
    if (serviceOverdue) {
        return (
            <Pill bg="#fef3c7" fg="#92400e">
                Service Overdue
            </Pill>
        )
    }
    if (!requiredFieldsOk) {
        return (
            <Pill bg="#fee2e2" fg="#b91c1c">
                Incomplete
            </Pill>
        )
    }
    return (
        <Pill bg="#dcfce7" fg="#166534">
            Complete
        </Pill>
    )
}

function dateInputValue(value) {
    if (!value) return ''
    if (value instanceof Date) return value.toISOString().split('T')[0]
    return String(value).split('T')[0]
}

/** "Required Information" section — VIN/make/model/year and last service/chip dates. */
export default function VerificationChecklistSection({
    accentColor,
    expanded,
    lastChipDate,
    lastServiceDate,
    make,
    makeOk,
    model,
    modelOk,
    needsMake,
    needsModel,
    needsVin,
    needsYear,
    onToggle,
    requiredFieldsOk,
    serviceOverdue,
    setLastChipDate,
    setLastServiceDate,
    setMake,
    setModel,
    setVin,
    setYear,
    vin,
    vinInfo,
    vinOk,
    year,
    yearOk
}) {
    return (
        <Section
            icon="fa-tasks"
            title="Required Information"
            accentColor={accentColor}
            expanded={expanded}
            onToggle={onToggle}
            pill={checklistStatusPill({ requiredFieldsOk, serviceOverdue })}
        >
            <div className="flex flex-col gap-3">
                {needsVin && (
                    <div>
                        <FieldLabel required={!vinOk}>VIN</FieldLabel>
                        <input
                            type="text"
                            placeholder="17 characters (no I, O, Q)"
                            value={vin}
                            onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[IOQ]/g, ''))}
                            className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none font-mono tabular-nums"
                            style={{
                                ...FIELD_STYLE,
                                borderColor: vin && !vinOk ? '#dc2626' : 'var(--border-light)'
                            }}
                        />
                        <Hint>17 characters. Letters I, O, and Q are not used.</Hint>
                        {vin && !vinOk && (
                            <div className="mt-1">
                                {vinInfo.reasons.map((reason) => (
                                    <div key={reason} className="text-[10.5px] text-red-600">
                                        {reason}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {needsMake && (
                    <SimpleField label="Make" required={!makeOk} value={make} onChange={setMake} placeholder="Make" />
                )}
                {needsModel && (
                    <SimpleField
                        label="Model"
                        required={!modelOk}
                        value={model}
                        onChange={setModel}
                        placeholder="Model"
                    />
                )}
                {needsYear && (
                    <SimpleField label="Year" required={!yearOk} value={year} onChange={setYear} placeholder="Year" />
                )}
                {(!lastServiceDate || serviceOverdue) && (
                    <div>
                        <FieldLabel>Last Service Date</FieldLabel>
                        <input
                            type="date"
                            value={dateInputValue(lastServiceDate)}
                            onChange={(e) =>
                                setLastServiceDate(e.target.value ? DateUtility.parseLocalDate(e.target.value) : null)
                            }
                            className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                            style={FIELD_STYLE}
                        />
                        {lastServiceDate && serviceOverdue && (
                            <Banner tone="warn" icon="fa-exclamation-triangle">
                                Service is overdue. You can still verify but service is recommended.
                            </Banner>
                        )}
                        <Hint>
                            Service will show as overdue if it has been more than 6 months since last serviced. Service
                            is determined by hours on the asset — check hours of service.
                        </Hint>
                    </div>
                )}
                {typeof lastChipDate !== 'undefined' && !lastChipDate && (
                    <div>
                        <FieldLabel>Last Chip Date</FieldLabel>
                        <input
                            type="date"
                            value={dateInputValue(lastChipDate)}
                            onChange={(e) =>
                                setLastChipDate(e.target.value ? DateUtility.parseLocalDate(e.target.value) : null)
                            }
                            className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                            style={FIELD_STYLE}
                        />
                    </div>
                )}
            </div>
        </Section>
    )
}
