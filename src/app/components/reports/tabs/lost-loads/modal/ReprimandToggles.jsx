/* eslint-disable react/forbid-dom-props */
import React from 'react'

function ReprimandToggle({ label, checked, onChange, accentColor }) {
    return (
        <label
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            style={{
                backgroundColor: checked ? `${accentColor}12` : 'var(--bg-primary)',
                border: `1px solid ${checked ? accentColor : 'var(--border-light)'}`
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 shrink-0 cursor-pointer"
                style={{ accentColor }}
            />
            <span className="text-sm text-text-primary">{label}</span>
        </label>
    )
}

function ReprimandToggles({
    accentColor,
    operatorReprimanded,
    setOperatorReprimanded,
    plantManagerReprimanded,
    setPlantManagerReprimanded
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Reprimand</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ReprimandToggle
                    label="Operator reprimanded"
                    checked={operatorReprimanded}
                    onChange={setOperatorReprimanded}
                    accentColor={accentColor}
                />
                <ReprimandToggle
                    label="Plant Manager reprimanded"
                    checked={plantManagerReprimanded}
                    onChange={setPlantManagerReprimanded}
                    accentColor={accentColor}
                />
            </div>
        </div>
    )
}

export default ReprimandToggles
