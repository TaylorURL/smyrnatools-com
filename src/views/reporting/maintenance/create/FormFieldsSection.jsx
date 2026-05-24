/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { FIELD_STYLE, FIELD_TYPES, SECTION_LABEL_CLASS } from '../../../../app/constants/maintenanceCreateConstants'
import { getFieldTypeIcon, getFieldTypeName } from '../../../../utils/MaintenanceUtility'
import { Card, CardHeader, ErrorText, FieldLabel, IconButton, SubtleButton } from './atoms'

function ChecklistItems({
    errors,
    field,
    index,
    addChecklistItem,
    removeChecklistItem,
    updateChecklistItem,
    accentColor
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <FieldLabel required>Checklist Items</FieldLabel>
            {errors[`field-${index}-checklist`] && <ErrorText>{errors[`field-${index}-checklist`]}</ErrorText>}
            {(field.options?.items || []).map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-1.5">
                    <input
                        type="text"
                        value={item}
                        onChange={(e) => updateChecklistItem(index, itemIndex, e.target.value)}
                        placeholder={`Item ${itemIndex + 1}`}
                        className="flex-1 rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                        style={FIELD_STYLE}
                    />
                    <IconButton
                        icon="fa-times"
                        danger
                        onClick={() => removeChecklistItem(index, itemIndex)}
                        title="Remove item"
                    />
                </div>
            ))}
            <button
                type="button"
                onClick={() => addChecklistItem(index)}
                className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer self-start transition-colors hover:brightness-95 bg-transparent border border-border-light"
                style={{ color: accentColor }}
            >
                <i className="fas fa-plus text-[10px]" />
                Add Item
            </button>
        </div>
    )
}

function FieldCard({
    accentColor,
    addChecklistItem,
    errors,
    field,
    fieldsLength,
    index,
    moveField,
    removeChecklistItem,
    removeField,
    updateChecklistItem,
    updateField
}) {
    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-bg-secondary border-b border-border-light">
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                        style={{ color: accentColor }}
                    >
                        <i className={`fas ${getFieldTypeIcon(field.field_type)} text-[11px]`} />
                    </div>
                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        {getFieldTypeName(field.field_type)}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <IconButton
                        icon="fa-arrow-up"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                    />
                    <IconButton
                        icon="fa-arrow-down"
                        onClick={() => moveField(index, 1)}
                        disabled={index === fieldsLength - 1}
                        title="Move down"
                    />
                    <IconButton icon="fa-trash" danger onClick={() => removeField(index)} title="Remove field" />
                </div>
            </div>

            <div className="px-3 py-3 flex flex-col gap-2.5">
                <div>
                    <FieldLabel required>Question / Label</FieldLabel>
                    <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Enter question or label"
                        className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                        style={{
                            ...FIELD_STYLE,
                            borderColor: errors[`field-${index}`] ? '#dc2626' : 'var(--border-light)'
                        }}
                    />
                    {errors[`field-${index}`] && <ErrorText>{errors[`field-${index}`]}</ErrorText>}
                </div>

                <div>
                    <FieldLabel>Description (optional)</FieldLabel>
                    <input
                        type="text"
                        value={field.description || ''}
                        onChange={(e) => updateField(index, { description: e.target.value })}
                        placeholder="Add a description or instructions"
                        className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                        style={FIELD_STYLE}
                    />
                </div>

                {field.field_type === 'checklist' && (
                    <ChecklistItems
                        accentColor={accentColor}
                        addChecklistItem={addChecklistItem}
                        errors={errors}
                        field={field}
                        index={index}
                        removeChecklistItem={removeChecklistItem}
                        updateChecklistItem={updateChecklistItem}
                    />
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-text-primary">
                        <input
                            type="checkbox"
                            checked={field.is_required}
                            onChange={(e) => updateField(index, { is_required: e.target.checked })}
                            className="w-3.5 h-3.5 cursor-pointer"
                        />
                        Required field
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-text-primary">
                        <input
                            type="checkbox"
                            checked={field.image_required || false}
                            onChange={(e) => updateField(index, { image_required: e.target.checked })}
                            className="w-3.5 h-3.5 cursor-pointer"
                        />
                        Image required
                    </label>
                </div>
            </div>
        </div>
    )
}

export function FormFieldsSection({
    accentColor,
    addChecklistItem,
    addField,
    errors,
    fields,
    moveField,
    removeChecklistItem,
    removeField,
    updateChecklistItem,
    updateField
}) {
    return (
        <Card>
            <CardHeader
                accentColor={accentColor}
                icon="fa-list-check"
                title="Form Fields"
                description="Add questions and inputs for the form"
                required
            />
            <div className="px-4 py-3 flex flex-col gap-3">
                {errors.fields && <ErrorText>{errors.fields}</ErrorText>}

                <div className="flex flex-wrap gap-1.5">
                    {FIELD_TYPES.map((t) => (
                        <SubtleButton key={t.key} icon={t.icon} onClick={() => addField(t.key)}>
                            {t.label}
                        </SubtleButton>
                    ))}
                </div>

                {fields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 rounded bg-bg-secondary border border-border-light text-text-tertiary">
                        <i className="fas fa-plus-circle text-2xl mb-1.5" />
                        <p className="text-[12px] m-0">Add fields using the buttons above</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {fields.map((field, index) => (
                            <FieldCard
                                key={field.id}
                                accentColor={accentColor}
                                addChecklistItem={addChecklistItem}
                                errors={errors}
                                field={field}
                                fieldsLength={fields.length}
                                index={index}
                                moveField={moveField}
                                removeChecklistItem={removeChecklistItem}
                                removeField={removeField}
                                updateChecklistItem={updateChecklistItem}
                                updateField={updateField}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}
