import React from 'react'

import { DROPDOWN_ARROW_SVG, formatTimeInput } from '../../../utils/PlanUtility'

export const PlantSelect = ({ value, onChange, plants, excludeValue, placeholder, className }) => (
    <select
        value={value}
        onChange={onChange}
        className={`border rounded-md text-xs outline-none py-1 pl-1.5 pr-4 appearance-none bg-no-repeat cursor-pointer w-[56px] bg-bg-primary border-border-medium text-text-primary ${className || ''}`}
        style={{
            backgroundImage: DROPDOWN_ARROW_SVG,
            backgroundPosition: 'right 3px center'
        }}
    >
        <option value="">{placeholder}</option>
        {plants
            .filter((p) => p.plant_code !== excludeValue)
            .map((p) => (
                <option key={p.plant_code} value={p.plant_code}>
                    {p.plant_code}
                </option>
            ))}
    </select>
)

export const TimeInput = ({ value, onChange, placeholder = 'HH:MM', className = '' }) => (
    <input
        type="text"
        placeholder={placeholder}
        maxLength={5}
        value={value || ''}
        onChange={(e) => onChange(formatTimeInput(e.target.value))}
        className={`border rounded-md text-xs outline-none font-mono text-center py-1 px-1 w-[56px] bg-bg-primary border-border-medium text-text-primary ${className}`}
    />
)
