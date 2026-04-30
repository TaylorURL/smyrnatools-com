import React from 'react'

/**
 * Modal for saving and loading plan templates. A template captures the
 * current assignments under a user-supplied name; loading replays the
 * captured assignments onto the active plan.
 */
export default function PlanTemplatesModal({
    accentColor,
    deleteTemplate,
    loadTemplate,
    onClose,
    saveAsTemplate,
    setTemplateName,
    templateName,
    templates
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40" />
            <div
                className="relative rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(event) => event.stopPropagation()}
            >
                <PlanTemplatesHeader accentColor={accentColor} onClose={onClose} />
                <PlanTemplatesSaveRow
                    accentColor={accentColor}
                    setTemplateName={setTemplateName}
                    templateName={templateName}
                    onSave={saveAsTemplate}
                />
                <PlanTemplatesList
                    accentColor={accentColor}
                    templates={templates}
                    onDelete={deleteTemplate}
                    onLoad={loadTemplate}
                />
            </div>
        </div>
    )
}

function PlanTemplatesHeader({ accentColor, onClose }) {
    return (
        <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border-light)' }}
        >
            <div className="flex items-center gap-2">
                <i className="fas fa-bookmark text-sm" style={{ color: accentColor }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Plan Templates
                </span>
            </div>
            <button
                onClick={onClose}
                className="border-none bg-transparent cursor-pointer p-1 rounded-md"
                style={{ color: 'var(--text-secondary)' }}
            >
                <i className="fas fa-times text-sm" />
            </button>
        </div>
    )
}

function SectionLabel({ children }) {
    return (
        <div
            className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
            style={{ color: 'var(--text-secondary)' }}
        >
            {children}
        </div>
    )
}

function PlanTemplatesSaveRow({ accentColor, setTemplateName, templateName, onSave }) {
    return (
        <div className="px-5 py-4" style={{ background: 'var(--bg-secondary)' }}>
            <SectionLabel>Save Current Plan</SectionLabel>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    placeholder="Template name..."
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onSave()}
                    className="flex-1 border rounded-lg text-sm outline-none py-1.5 px-3"
                    style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
                <button
                    onClick={onSave}
                    disabled={!templateName.trim()}
                    className="border-none rounded-lg cursor-pointer text-sm font-semibold px-3 py-1.5 text-white disabled:opacity-40"
                    style={{ background: accentColor }}
                >
                    Save
                </button>
            </div>
        </div>
    )
}

function PlanTemplatesList({ accentColor, templates, onDelete, onLoad }) {
    return (
        <div className="px-5 py-4 max-h-[300px] overflow-y-auto">
            <SectionLabel>Saved Templates</SectionLabel>
            {templates.length === 0 ? (
                <div className="text-xs py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                    No templates saved yet
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {templates.map((template) => (
                        <PlanTemplateRow
                            key={template.id}
                            accentColor={accentColor}
                            template={template}
                            onDelete={() => onDelete(template.id)}
                            onLoad={() => onLoad(template)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function PlanTemplateRow({ accentColor, template, onDelete, onLoad }) {
    const assignmentCount = template.assignments?.length || 0
    return (
        <div
            className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: 'var(--bg-tertiary)' }}
        >
            <div className="flex flex-col">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {template.name}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {assignmentCount} assignment{assignmentCount !== 1 ? 's' : ''}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={onLoad}
                    className="border-none rounded cursor-pointer text-[11px] font-semibold px-2.5 py-1 text-white"
                    style={{ background: accentColor }}
                >
                    Load
                </button>
                <button
                    onClick={onDelete}
                    className="border-none bg-transparent cursor-pointer p-1 rounded"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-trash text-[10px]" />
                </button>
            </div>
        </div>
    )
}
