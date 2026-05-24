/* eslint-disable react/forbid-dom-props */
import React from 'react'

import FieldInput from './FieldInput'
import { FORM_FIELD_BASE_CLASS, FORM_SECTION_LABEL_CLASS } from './formStyles'
import { getFieldIcon } from './submitValidators'

/** Plant Manager weekly production form — four-column compact grid with
 *  per-field icons keyed off the field name. */
const PlantManagerForm = ({ report, form, handleChange, readOnly, accentColor }) => (
    <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                <i className="fas fa-clipboard-list text-[11px]" />
            </div>
            <div className="min-w-0 flex-1">
                <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    Production
                </div>
                <div className="text-[12.5px] font-semibold leading-tight text-text-primary">
                    Weekly Production Data
                </div>
                <div className="text-[10.5px] mt-0.5 text-text-tertiary">
                    Key production metrics for this reporting period.
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {report.fields
                .filter((f) => f.name !== 'issues' && f.type !== 'table')
                .map((field) => (
                    <div
                        key={field.name}
                        className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light"
                    >
                        <label className="flex items-center gap-1.5 text-text-tertiary">
                            <i
                                className={`fas ${getFieldIcon(field.name)} text-[10px]`}
                                style={{ color: accentColor }}
                            />
                            <span className={FORM_SECTION_LABEL_CLASS}>
                                {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                {field.required && <span className="ml-0.5 text-text-primary">*</span>}
                            </span>
                        </label>
                        <FieldInput
                            field={field}
                            form={form}
                            handleChange={handleChange}
                            readOnly={readOnly}
                            className={FORM_FIELD_BASE_CLASS}
                        />
                    </div>
                ))}
        </div>
    </div>
)

export default PlantManagerForm
