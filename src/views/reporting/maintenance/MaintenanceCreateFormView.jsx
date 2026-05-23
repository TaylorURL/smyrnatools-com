/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useCallback, useEffect, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { MaintenanceService } from '../../../services/MaintenanceService'
import { PlantService } from '../../../services/PlantService'
import { UserService } from '../../../services/UserService'
import { getFieldTypeIcon, getFieldTypeName } from '../../../utils/MaintenanceUtility'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const FIELD_LABEL_CLASS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const FIELD_TYPES = [
    { icon: 'fa-font', key: 'short_answer', label: 'Short Answer' },
    { icon: 'fa-align-left', key: 'long_answer', label: 'Long Answer' },
    { icon: 'fa-check-square', key: 'checklist', label: 'Checklist' },
    { icon: 'fa-sticky-note', key: 'notes', label: 'Notes' }
]

const FREQUENCY_OPTIONS = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Bi-weekly', value: 'biweekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' }
]

const FREQUENCY_HINT = {
    biweekly: 'Task will be due every two weeks starting from this date',
    daily: 'Task will be due every day starting from this date',
    monthly: 'Task will be due on this day of each month',
    quarterly: 'Task will be due quarterly starting from this date',
    weekly: 'Task will be due every week starting from this date',
    yearly: 'Task will be due yearly on this date'
}

/* ── Plan-tab styled atoms ─────────────────────────────────────── */

function Card({ children }) {
    return <section className="rounded overflow-hidden bg-bg-primary border border-border-light">{children}</section>
}

function CardHeader({ accentColor, description, icon, required, title }) {
    return (
        <header className="flex items-center gap-2.5 px-4 py-3 border-b border-border-light">
            <div
                className="flex h-7 w-7 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                style={{ color: accentColor }}
            >
                <i className={`fas ${icon} text-[12px]`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    {title}
                    {required && <span className="ml-1.5 text-text-primary">*</span>}
                </div>
                {description && <div className="text-[11px] mt-0.5 text-text-tertiary">{description}</div>}
            </div>
        </header>
    )
}

function FieldLabel({ children, required }) {
    return (
        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
            {children}
            {required && <span className="ml-1 text-text-primary">*</span>}
        </label>
    )
}

function PrimaryButton({ accentColor, children, disabled, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

function SubtleButton({ children, danger = false, disabled = false, icon, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:brightness-95 border border-border-light"
            style={{
                background: danger ? '#fee2e2' : 'var(--bg-secondary)',
                color: danger ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

function IconButton({ bg, danger, disabled, fg, icon, onClick, title }) {
    const palette = danger
        ? { bg: '#fee2e2', fg: 'var(--text-primary)' }
        : { bg: bg || 'var(--bg-tertiary)', fg: fg || 'var(--text-secondary)' }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            className="flex h-6 w-6 items-center justify-center rounded border-none cursor-pointer transition-colors hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: palette.bg, color: palette.fg }}
        >
            <i className={`fas ${icon} text-[10px]`} />
        </button>
    )
}

function ErrorText({ children }) {
    return (
        <div className="mt-1 flex items-center gap-1 text-[10.5px] text-text-primary">
            <i className="fas fa-exclamation-circle text-[10px]" />
            <span>{children}</span>
        </div>
    )
}

function Chip({ accentColor, children, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold px-2 py-1 bg-bg-secondary border border-border-light text-text-primary">
            {children}
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="flex h-4 w-4 items-center justify-center rounded-full border-none cursor-pointer transition-colors hover:brightness-90 text-white"
                    style={{ background: accentColor }}
                    aria-label="Remove"
                >
                    <i className="fas fa-times text-[8px]" />
                </button>
            )}
        </span>
    )
}

/* ── Main view ─────────────────────────────────────────────────── */

/**
 * Form builder for creating or editing a maintenance form definition.
 * Plan-tab aesthetic: flat 1px borders, 6px radius, var() tokens, 10/9.5px
 * uppercase tracked-wider labels. All business logic preserved.
 */
export default function MaintenanceCreateFormView({ editingForm, onBack, onSaved }) {
    const { preferences } = usePreferences()
    const accentColor = useAccentColor()
    const [saving, setSaving] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [frequency, setFrequency] = useState('daily')
    const [frequencyValue, setFrequencyValue] = useState(1)
    const [assignedRoles, setAssignedRoles] = useState([])
    const [fields, setFields] = useState([])
    const [errors, setErrors] = useState({})
    const [availableRoles, setAvailableRoles] = useState([])
    const [showRoleSelector, setShowRoleSelector] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [selectedPlants, setSelectedPlants] = useState([])
    const [availablePlants, setAvailablePlants] = useState([])
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        loadOptions()
        if (editingForm) populateForm(editingForm)
    }, [editingForm])

    const loadOptions = async () => {
        try {
            const roles = await UserService.getAllRoles()
            if (roles && roles.length > 0) {
                setAvailableRoles(roles.sort((a, b) => (a.name || '').localeCompare(b.name || '')))
            } else {
                setAvailableRoles([])
            }
        } catch {
            setAvailableRoles([])
        }
    }

    const loadRegionalPlants = useCallback(async () => {
        try {
            const regionCode = preferences.selectedRegion?.code
            if (regionCode) {
                const plants = await PlantService.fetchRegionPlants(regionCode)
                setAvailablePlants(plants || [])
            } else {
                setAvailablePlants([])
            }
        } catch {
            setAvailablePlants([])
        }
    }, [preferences.selectedRegion?.code])

    useEffect(() => {
        loadRegionalPlants()
    }, [preferences.selectedRegion?.code, loadRegionalPlants])

    const populateForm = (form) => {
        setTitle(form.title || '')
        setDescription(form.description || '')
        setFrequency(form.frequency || 'daily')
        setFrequencyValue(form.frequency_value || 1)
        setAssignedRoles(form.assigned_roles || [])
        const plants = form.plant_codes || (form.plant_code ? [form.plant_code] : [])
        setSelectedPlants(plants)
        setStartDate(form.start_date || new Date().toISOString().split('T')[0])
        const existingFields = (form.maintenance_form_fields || [])
            .sort((a, b) => a.field_order - b.field_order)
            .map((f) => ({
                description: f.description || '',
                field_type: f.field_type,
                id: f.id,
                image_required: f.image_required || false,
                is_required: f.is_required,
                label: f.label,
                options: f.options || {}
            }))
        setFields(existingFields)
    }

    const addField = (type) => {
        setFields([
            ...fields,
            {
                description: '',
                field_type: type,
                id: `temp-${Date.now()}`,
                image_required: false,
                is_required: false,
                label: '',
                options: type === 'checklist' ? { items: [''] } : {}
            }
        ])
    }
    const updateField = (index, updates) => {
        const next = [...fields]
        next[index] = { ...next[index], ...updates }
        setFields(next)
    }
    const removeField = (index) => setFields(fields.filter((_, i) => i !== index))
    const moveField = (index, direction) => {
        const next = [...fields]
        const newIndex = index + direction
        if (newIndex < 0 || newIndex >= fields.length) return
        ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
        setFields(next)
    }
    const addChecklistItem = (fieldIndex) => {
        const next = [...fields]
        const items = next[fieldIndex].options?.items || []
        next[fieldIndex].options = { items: [...items, ''] }
        setFields(next)
    }
    const updateChecklistItem = (fieldIndex, itemIndex, value) => {
        const next = [...fields]
        next[fieldIndex].options.items[itemIndex] = value
        setFields(next)
    }
    const removeChecklistItem = (fieldIndex, itemIndex) => {
        const next = [...fields]
        next[fieldIndex].options.items = next[fieldIndex].options.items.filter((_, i) => i !== itemIndex)
        setFields(next)
    }
    const toggleRole = (roleId) => {
        setAssignedRoles((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]))
    }

    const validateForm = () => {
        const next = {}
        if (!title.trim()) next.title = 'Title is required'
        if (selectedPlants.length === 0) next.plants = 'At least one plant must be selected'
        if (assignedRoles.length === 0) next.assignment = 'At least one role must be assigned'
        if (fields.length === 0) next.fields = 'At least one field is required'
        fields.forEach((field, index) => {
            if (!field.label.trim()) next[`field-${index}`] = 'Field label is required'
            if (field.field_type === 'checklist') {
                const validItems = (field.options?.items || []).filter((item) => item.trim())
                if (validItems.length === 0)
                    next[`field-${index}-checklist`] = 'At least one checklist item is required'
            }
        })
        setErrors(next)
        return Object.keys(next).length === 0
    }

    const handleSave = async () => {
        if (!validateForm()) return
        setSaving(true)
        try {
            const formData = {
                assigned_roles: assignedRoles,
                description: description.trim(),
                fields: fields.map((field, index) => ({
                    description: field.description?.trim() || null,
                    field_order: index,
                    field_type: field.field_type,
                    image_required: field.image_required || false,
                    is_required: field.is_required,
                    label: field.label.trim(),
                    options:
                        field.field_type === 'checklist'
                            ? { items: (field.options?.items || []).filter((item) => item.trim()) }
                            : null
                })),
                frequency,
                frequency_value: frequencyValue,
                plant_codes: selectedPlants,
                region_code: preferences.selectedRegion?.code || null,
                start_date: startDate,
                title: title.trim()
            }
            if (editingForm) {
                await MaintenanceService.updateForm(editingForm.id, formData)
            } else {
                await MaintenanceService.createForm(formData)
            }
            onSaved()
        } catch (error) {
            setErrors({ save: error.message })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setSaving(true)
        try {
            await MaintenanceService.deleteForm(editingForm.id)
            onSaved()
        } catch (error) {
            setErrors({ save: error.message })
        } finally {
            setSaving(false)
            setShowDeleteConfirm(false)
        }
    }

    const showPerN = ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)

    return (
        <div className="min-h-screen w-full bg-bg-secondary">
            {/* Sticky page header */}
            <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-3 sm:px-4 md:px-6 py-2 bg-bg-primary border-b border-border-light">
                <div className="flex items-center gap-2.5 min-w-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer bg-bg-tertiary"
                        style={{ color: accentColor }}
                        aria-label="Back"
                    >
                        <i className="fas fa-arrow-left text-[11px]" />
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-clipboard-list text-[11px]" />
                        </div>
                        <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {editingForm ? 'Edit Form' : 'New Maintenance Form'}
                        </span>
                    </div>
                </div>
                {editingForm && (
                    <SubtleButton danger icon="fa-trash" onClick={() => setShowDeleteConfirm(true)}>
                        Delete
                    </SubtleButton>
                )}
            </div>

            {/* Content */}
            <div className="mx-auto max-w-[960px] px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-3">
                {/* Form details */}
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-info-circle"
                        title="Form Details"
                        description="Title, plants, description, and recurrence"
                    />
                    <div className="px-4 py-3 flex flex-col gap-3">
                        <div>
                            <FieldLabel required>Title</FieldLabel>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter form title"
                                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                                style={{
                                    ...FIELD_STYLE,
                                    borderColor: errors.title ? '#dc2626' : 'var(--border-light)'
                                }}
                            />
                            {errors.title && <ErrorText>{errors.title}</ErrorText>}
                        </div>

                        <div>
                            <FieldLabel required>Plants</FieldLabel>
                            {selectedPlants.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {selectedPlants.map((code) => {
                                        const plant = availablePlants.find(
                                            (p) => (p.plantCode || p.plant_code) === code
                                        )
                                        const name = plant?.plantName || plant?.plant_name || code
                                        return (
                                            <Chip
                                                key={code}
                                                accentColor={accentColor}
                                                onRemove={() =>
                                                    setSelectedPlants(selectedPlants.filter((c) => c !== code))
                                                }
                                            >
                                                <span className="font-mono tabular-nums text-[10.5px]">{code}</span>
                                                {name !== code && <span className="text-text-secondary">· {name}</span>}
                                            </Chip>
                                        )
                                    })}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowPlantModal(true)}
                                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[12.5px] cursor-pointer transition-colors hover:brightness-95"
                                style={{
                                    ...FIELD_STYLE,
                                    borderColor: errors.plants ? '#dc2626' : 'var(--border-light)'
                                }}
                            >
                                <span>{selectedPlants.length === 0 ? 'Select plants' : 'Add more plants'}</span>
                                <i className="fas fa-plus text-[10px] text-text-tertiary" />
                            </button>
                            {errors.plants && <ErrorText>{errors.plants}</ErrorText>}
                            <PlantDropdownModal
                                isOpen={showPlantModal}
                                onClose={() => setShowPlantModal(false)}
                                plants={availablePlants.filter(
                                    (p) => !selectedPlants.includes(p.plantCode || p.plant_code)
                                )}
                                onSelect={(code) => {
                                    if (!selectedPlants.includes(code)) {
                                        setSelectedPlants([...selectedPlants, code])
                                    }
                                    setShowPlantModal(false)
                                }}
                            />
                        </div>

                        <div>
                            <FieldLabel>Description</FieldLabel>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description or instructions"
                                rows={3}
                                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none resize-y min-h-[64px]"
                                style={FIELD_STYLE}
                            />
                        </div>

                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex-1 min-w-[180px]">
                                <FieldLabel>Frequency</FieldLabel>
                                <select
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value)}
                                    className="w-full rounded px-2.5 py-1.5 text-[12.5px] cursor-pointer outline-none"
                                    style={FIELD_STYLE}
                                >
                                    {FREQUENCY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {showPerN && (
                                <div className="w-[160px]">
                                    <FieldLabel>Every</FieldLabel>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            value={frequencyValue}
                                            onChange={(e) =>
                                                setFrequencyValue(Math.max(1, parseInt(e.target.value, 10) || 1))
                                            }
                                            min="1"
                                            className="flex-1 rounded px-2.5 py-1.5 text-[12.5px] outline-none font-mono tabular-nums"
                                            style={FIELD_STYLE}
                                        />
                                        <span className="text-[10.5px] whitespace-nowrap uppercase tracking-wider text-text-tertiary">
                                            {frequency === 'daily'
                                                ? 'day(s)'
                                                : frequency === 'weekly'
                                                  ? 'week(s)'
                                                  : frequency === 'monthly'
                                                    ? 'month(s)'
                                                    : 'year(s)'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <FieldLabel required>First Due Date</FieldLabel>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none font-mono tabular-nums"
                                style={FIELD_STYLE}
                            />
                            <p className="mt-1 text-[10.5px] text-text-tertiary">{FREQUENCY_HINT[frequency]}</p>
                        </div>
                    </div>
                </Card>

                {/* Assigned roles */}
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-user-shield"
                        title="Assigned Roles"
                        description="Pick which roles are responsible for this form"
                        required
                    />
                    <div className="px-4 py-3 flex flex-col gap-2">
                        {errors.assignment && <ErrorText>{errors.assignment}</ErrorText>}
                        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                            <button
                                type="button"
                                onClick={() => setShowRoleSelector((v) => !v)}
                                className="flex w-full items-center justify-between px-3 py-2 cursor-pointer border-none transition-colors hover:bg-bg-tertiary bg-bg-secondary"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                        Roles
                                    </span>
                                    <span className="font-mono tabular-nums rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider bg-bg-tertiary text-text-secondary">
                                        {assignedRoles.length} selected
                                    </span>
                                </div>
                                <i
                                    className={`fas fa-chevron-${showRoleSelector ? 'up' : 'down'} text-[10px] text-text-tertiary`}
                                />
                            </button>
                            {showRoleSelector && (
                                <div className="max-h-60 overflow-y-auto">
                                    {availableRoles.length === 0 ? (
                                        <div className="text-center py-4 text-[12px] text-text-tertiary">
                                            No roles available
                                        </div>
                                    ) : (
                                        availableRoles.map((role, idx) => (
                                            <label
                                                key={role.id}
                                                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary"
                                                style={{
                                                    borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={assignedRoles.includes(role.id)}
                                                    onChange={() => toggleRole(role.id)}
                                                    className="w-3.5 h-3.5 cursor-pointer"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[12px] font-semibold truncate text-text-primary">
                                                        {role.name}
                                                    </span>
                                                    {role.description && (
                                                        <span className="text-[10.5px] truncate text-text-secondary">
                                                            {role.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}
                            {assignedRoles.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-bg-secondary border-t border-border-light">
                                    {assignedRoles.map((roleId) => {
                                        const role = availableRoles.find((r) => r.id === roleId)
                                        return role ? (
                                            <Chip
                                                key={roleId}
                                                accentColor={accentColor}
                                                onRemove={() => toggleRole(roleId)}
                                            >
                                                {role.name}
                                            </Chip>
                                        ) : null
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Form fields */}
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

                        {/* Field type buttons */}
                        <div className="flex flex-wrap gap-1.5">
                            {FIELD_TYPES.map((t) => (
                                <SubtleButton key={t.key} icon={t.icon} onClick={() => addField(t.key)}>
                                    {t.label}
                                </SubtleButton>
                            ))}
                        </div>

                        {/* Field cards */}
                        {fields.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 rounded bg-bg-secondary border border-border-light text-text-tertiary">
                                <i className="fas fa-plus-circle text-2xl mb-1.5" />
                                <p className="text-[12px] m-0">Add fields using the buttons above</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {fields.map((field, index) => (
                                    <div
                                        key={field.id}
                                        className="rounded overflow-hidden bg-bg-primary border border-border-light"
                                    >
                                        {/* Field header */}
                                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-bg-secondary border-b border-border-light">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                    className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                                                    style={{ color: accentColor }}
                                                >
                                                    <i
                                                        className={`fas ${getFieldTypeIcon(field.field_type)} text-[11px]`}
                                                    />
                                                </div>
                                                <span
                                                    className={SECTION_LABEL_CLASS}
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
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
                                                    disabled={index === fields.length - 1}
                                                    title="Move down"
                                                />
                                                <IconButton
                                                    icon="fa-trash"
                                                    danger
                                                    onClick={() => removeField(index)}
                                                    title="Remove field"
                                                />
                                            </div>
                                        </div>

                                        {/* Field body */}
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
                                                        borderColor: errors[`field-${index}`]
                                                            ? '#dc2626'
                                                            : 'var(--border-light)'
                                                    }}
                                                />
                                                {errors[`field-${index}`] && (
                                                    <ErrorText>{errors[`field-${index}`]}</ErrorText>
                                                )}
                                            </div>

                                            <div>
                                                <FieldLabel>Description (optional)</FieldLabel>
                                                <input
                                                    type="text"
                                                    value={field.description || ''}
                                                    onChange={(e) =>
                                                        updateField(index, { description: e.target.value })
                                                    }
                                                    placeholder="Add a description or instructions"
                                                    className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                                                    style={FIELD_STYLE}
                                                />
                                            </div>

                                            {field.field_type === 'checklist' && (
                                                <div className="flex flex-col gap-1.5">
                                                    <FieldLabel required>Checklist Items</FieldLabel>
                                                    {errors[`field-${index}-checklist`] && (
                                                        <ErrorText>{errors[`field-${index}-checklist`]}</ErrorText>
                                                    )}
                                                    {(field.options?.items || []).map((item, itemIndex) => (
                                                        <div key={itemIndex} className="flex items-center gap-1.5">
                                                            <input
                                                                type="text"
                                                                value={item}
                                                                onChange={(e) =>
                                                                    updateChecklistItem(
                                                                        index,
                                                                        itemIndex,
                                                                        e.target.value
                                                                    )
                                                                }
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
                                            )}

                                            <div className="flex flex-wrap gap-3 pt-1">
                                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-text-primary">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.is_required}
                                                        onChange={(e) =>
                                                            updateField(index, { is_required: e.target.checked })
                                                        }
                                                        className="w-3.5 h-3.5 cursor-pointer"
                                                    />
                                                    Required field
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-text-primary">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.image_required || false}
                                                        onChange={(e) =>
                                                            updateField(index, { image_required: e.target.checked })
                                                        }
                                                        className="w-3.5 h-3.5 cursor-pointer"
                                                    />
                                                    Image required
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                {errors.save && (
                    <div className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-medium bg-red-100 border border-red-300 text-text-primary">
                        <i className="fas fa-exclamation-circle text-[11px]" />
                        <span>{errors.save}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <SubtleButton onClick={onBack}>Cancel</SubtleButton>
                    <PrimaryButton
                        accentColor={accentColor}
                        disabled={saving}
                        icon={saving ? 'fa-spinner fa-spin' : 'fa-save'}
                        onClick={handleSave}
                    >
                        {saving ? 'Saving…' : editingForm ? 'Update Form' : 'Create Form'}
                    </PrimaryButton>
                </div>
            </div>

            {showDeleteConfirm && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        className="w-full max-w-sm rounded overflow-hidden bg-bg-primary border border-border-light"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-red-100 text-text-primary">
                                <i className="fas fa-trash text-[11px]" />
                            </div>
                            <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Delete Form
                            </span>
                        </div>
                        <div className="px-4 py-3">
                            <p className="m-0 text-[12px] text-text-secondary">
                                Are you sure you want to delete this form? This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-bg-secondary border-t border-border-light">
                            <SubtleButton onClick={() => setShowDeleteConfirm(false)}>Cancel</SubtleButton>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600"
                            >
                                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-trash'} text-[10px]`} />
                                {saving ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
