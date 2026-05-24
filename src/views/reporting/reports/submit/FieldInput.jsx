/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { FORM_FIELD_BASE_CLASS, FORM_FIELD_STYLE } from './formStyles'

/**
 * Renders the appropriate `<input>` / `<textarea>` / `<select>` for a
 * report field descriptor. Shared by the default and plant-manager
 * forms.
 */
const FieldInput = ({ field, form, handleChange, readOnly, className = '' }) => {
    const value = form[field.name] ?? ''
    const baseClass = className || FORM_FIELD_BASE_CLASS
    const props = {
        className: baseClass,
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
            <select {...props} className={`${baseClass} appearance-none cursor-pointer pr-8`}>
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        )
    return <input type={field.type} {...props} />
}

export default FieldInput
