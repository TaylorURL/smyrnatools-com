import React from 'react'

import { TimeInput } from '../common/PlanComponents'

/**
 * Centred modal for fast first-job / last-job / total-yardage entry on a
 * single plant. Mirrors the at-a-glance YPH summary so the operator can
 * confirm their numbers feel right before closing.
 */
export function PlanPlantProductionEditor({
    accentColor,
    code,
    onTogglePopover,
    plantName,
    production,
    status,
    updatePlantProduction,
    yph
}) {
    return (
        <div
            data-stop-card-click
            onClick={onTogglePopover}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn"
            style={{ background: 'rgba(0,0,0,0.45)' }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                className="rounded-xl shadow-xl w-full max-w-[360px]"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-medium)' }}
            >
                <ProductionEditorHeader
                    accentColor={accentColor}
                    code={code}
                    plantName={plantName}
                    onClose={onTogglePopover}
                />
                <div className="px-4 py-4 flex flex-col gap-3">
                    <ProductionInputsGrid
                        code={code}
                        production={production}
                        updatePlantProduction={updatePlantProduction}
                    />
                    <ProductionYphSummary status={status} yph={yph} />
                </div>
                <div
                    className="px-4 py-3 flex justify-end gap-2 border-t"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <button
                        onClick={onTogglePopover}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}

function ProductionEditorHeader({ accentColor, code, plantName, onClose }) {
    return (
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{
                    background: accentColor,
                    color: '#fff',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 13,
                    fontWeight: 700,
                    height: 32,
                    width: 32
                }}
            >
                {code}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-sm font-bold"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}
                >
                    {plantName || `Plant ${code}`}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Edit production
                </div>
            </div>
            <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
                <i className="fas fa-times text-xs" />
            </button>
        </div>
    )
}

function FieldLabel({ children }) {
    return (
        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            {children}
        </div>
    )
}

function ProductionInputsGrid({ code, production, updatePlantProduction }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            <div>
                <FieldLabel>First Job</FieldLabel>
                <TimeInput
                    value={production.firstJobTime || ''}
                    onChange={(val) => updatePlantProduction(code, 'firstJobTime', val)}
                    className="!w-full"
                />
            </div>
            <div>
                <FieldLabel>Last Job</FieldLabel>
                <TimeInput
                    value={production.lastJobTime || ''}
                    onChange={(val) => updatePlantProduction(code, 'lastJobTime', val)}
                    className="!w-full"
                />
            </div>
            <div>
                <FieldLabel>Yards</FieldLabel>
                <input
                    type="number"
                    value={production.totalYardage || ''}
                    onChange={(event) => updatePlantProduction(code, 'totalYardage', event.target.value)}
                    placeholder="0"
                    className="border rounded-md text-sm outline-none font-mono text-center py-1.5 px-1 w-full"
                    style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
            </div>
        </div>
    )
}

function ProductionYphSummary({ status, yph }) {
    return (
        <div
            className="rounded-lg px-3 py-2 flex items-center justify-between"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div>
                <div
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    Yards / hr / op
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {status.label}
                </div>
            </div>
            <div className="text-lg font-bold" style={{ color: status.color, fontFamily: 'var(--font-heading)' }}>
                {yph != null ? yph : '—'}
            </div>
        </div>
    )
}
