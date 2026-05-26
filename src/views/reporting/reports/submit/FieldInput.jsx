/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { FORM_FIELD_BASE_CLASS, FORM_FIELD_STYLE, FORM_SELECT_CLASS } from './formStyles'

/**
 * Renders the appropriate `<input>` / `<textarea>` / `<select>` for a
 * report field descriptor. Shared by the default and plant-manager
 * forms. Selects use `FORM_SELECT_CLASS` so the dropdown affordance
 * stays visible under `appearance-none`.
 */
const FieldInput = ({ field, form, handleChange, readOnly, className = '' }) => {
    const value = form[field.name] ?? ''
    const baseClass = className || FORM_FIELD_BASE_CLASS
    const props = {
        disabled: readOnly,
        onChange: (e) => handleChange(e, field.name),
        required: field.required,
        style: FORM_FIELD_STYLE,
        value
    }
    if (field.type === 'textarea')
        return <textarea {...props} className={`${baseClass} resize-y min-h-[88px]`} rows={4} />
    if (field.type === 'select')
        return (
            <select {...props} className={className || FORM_SELECT_CLASS} aria-label={field.label || field.name}>
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        )
    return <input type={field.type} {...props} className={baseClass} />
}

export default FieldInput
