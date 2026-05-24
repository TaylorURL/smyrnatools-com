import { useCallback, useEffect, useState } from 'react'

import { usePreferences } from '../../../../app/context/PreferencesContext'
import { MaintenanceService } from '../../../../services/MaintenanceService'
import { PlantService } from '../../../../services/PlantService'
import { UserService } from '../../../../services/UserService'

const todayIso = () => new Date().toISOString().split('T')[0]

/**
 * Stateful controller for the maintenance form builder.
 * Owns all form state, validation, save, and delete behavior.
 */
export function useMaintenanceForm({ editingForm, onSaved }) {
    const { preferences } = usePreferences()
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
    const [startDate, setStartDate] = useState(todayIso())

    useEffect(() => {
        loadOptions()
        if (editingForm) populateForm(editingForm)
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setStartDate(form.start_date || todayIso())
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

    return {
        addChecklistItem,
        addField,
        assignedRoles,
        availablePlants,
        availableRoles,
        description,
        errors,
        fields,
        frequency,
        frequencyValue,
        handleDelete,
        handleSave,
        moveField,
        removeChecklistItem,
        removeField,
        saving,
        selectedPlants,
        setDescription,
        setFrequency,
        setFrequencyValue,
        setSelectedPlants,
        setShowDeleteConfirm,
        setShowPlantModal,
        setShowRoleSelector,
        setStartDate,
        setTitle,
        showDeleteConfirm,
        showPlantModal,
        showRoleSelector,
        startDate,
        title,
        toggleRole,
        updateChecklistItem,
        updateField
    }
}
