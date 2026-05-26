/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { DROPDOWN_ARROW_SVG, formatTimeInput } from '../../../utils/PlanUtility'

export const PlantSelect = ({ value, onChange, plants, excludeValue, placeholder, className }) => (
    <select
        value={value}
        onChange={onChange}
        aria-label={placeholder || 'Plant'}
        className={`border rounded-md text-xs outline-none py-1 pl-1.5 pr-4 appearance-none bg-no-repeat cursor-pointer w-[56px] bg-bg-primary border-border-medium text-text-primary transition-colors duration-150 hover:border-border-dark focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ${className || ''}`}
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
        aria-label="Time (HH:MM)"
        maxLength={5}
        value={value || ''}
        onChange={(e) => onChange(formatTimeInput(e.target.value))}
        className={`border rounded-md text-xs outline-none font-mono text-center py-1 px-1 w-[56px] bg-bg-primary border-border-medium text-text-primary transition-colors duration-150 placeholder:text-text-tertiary hover:border-border-dark focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
    />
)
