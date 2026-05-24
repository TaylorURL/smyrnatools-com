/* eslint-disable react/forbid-dom-props */
import React from 'react'

import FieldInput from './FieldInput'
import { FORM_SECTION_LABEL_CLASS } from './formStyles'

/** Generic two-column report form used for reports that don't have a
 *  dedicated render path (plant_production, plant_manager) or are pure
 *  plugin-rendered (general_manager, district_manager, etc.). */
const DefaultReportForm = ({ report, form, handleChange, readOnly }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {report.fields
            .filter((f) => f.name !== 'issues' && f.type !== 'table')
            .map((field) => (
                <div
                    key={field.name}
                    className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light"
                >
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        {field.name === 'yardage' ? 'Total Yardage' : field.label}
                        {field.required && <span className="ml-0.5 text-text-primary">*</span>}
                    </label>
                    <FieldInput field={field} form={form} handleChange={handleChange} readOnly={readOnly} />
                </div>
            ))}
    </div>
)

export default DefaultReportForm
