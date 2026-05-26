import React, { useCallback, useEffect, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import AddViewSection from '../../../app/components/sections/AddViewSection'
import {
    LIST_INPUT_CLASS,
    LIST_PLANT_BUTTON_CLASS,
    LIST_SELECT_CLASS,
    LIST_TEXTAREA_CLASS
} from '../../../app/constants/listViewConstants'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { AIService } from '../../../services/AIService'
import { ListService } from '../../../services/ListService'
import { PlantService } from '../../../services/PlantService'
import { UserService } from '../../../services/UserService'
import GrammarUtility from '../../../utils/GrammarUtility'

/**
 * Add/edit form for task list items. Supports multi-plant creation in add mode
 * (broadcast a single task to multiple plants) and single-plant editing.
 * Integrates AI-powered description improvement and task suggestions via AIService.
 *
 * @param {Function} onClose - Dismiss the form.
 * @param {Function} [onItemAdded] - Callback after successful save.
 * @param {Object} [item] - When provided, switches to edit mode for this existing item.
 */
function ListAddView({ onClose, onItemAdded, item = null }) {
    const { preferences } = usePreferences()
    const [description, setDescription] = useState('')
    const [plantCode, setPlantCode] = useState('')
    const [selectedPlantCodes, setSelectedPlantCodes] = useState([])
    const [deadline, setDeadline] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() + 14)
        d.setHours(17, 0, 0, 0)
        return d.toISOString().slice(0, 16)
    })
    const [comments, setComments] = useState('')
    const [status, setStatus] = useState('pending')
    const [responsibleRole, setResponsibleRole] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [currentUserId, setCurrentUserId] = useState(null)
    const [errors, setErrors] = useState({})
    const [plants, setPlants] = useState([])
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const [aiError, setAiError] = useState(null)
    const [aiSuggestions, setAiSuggestions] = useState([])
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [priority, setPriority] = useState('none')
    const [isImprovingDescription, setIsImprovingDescription] = useState(false)
    const priorityOptions = ListService.getPriorityOptions()
    const statusOptions = [
        { label: 'Pending', value: 'pending' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Ordered Materials / Parts', value: 'ordered_materials' },
        { label: 'Waiting', value: 'waiting' }
    ]
    const responsibleRoleOptions = [
        { label: 'Unassigned', value: '' },
        { label: 'Maintenance', value: 'maintenance' },
        { label: 'Plant Manager', value: 'plant_manager' },
        { label: 'District Manager', value: 'district_manager' }
    ]
    useEffect(() => {
        async function fetchCurrentUser() {
            const user = await UserService.getCurrentUser()
            if (!user) return
            setCurrentUserId(user.id)
        }
        fetchCurrentUser()
    }, [])
    useEffect(() => {
        async function fetchPlants() {
            const selectedRegionCode = preferences?.selectedRegion?.code || ''
            const allowedCodes = await PlantService.getAllowedPlantCodes(selectedRegionCode)
            if (allowedCodes) {
                const allPlants = await PlantService.fetchAllPlants()
                setPlants(
                    allPlants
                        .filter((p) => allowedCodes.has(p.plantCode.toUpperCase()))
                        .map((p) => ({
                            plant_code: p.plantCode,
                            plant_name: p.plantName
                        }))
                )
            }
        }
        fetchPlants()
    }, [preferences])
    useEffect(() => {
        if (item) {
            setDescription(item.description || '')
            setPlantCode(item.plantCode || '')
            setDeadline((prev) => (item.deadline ? new Date(item.deadline).toISOString().slice(0, 16) : prev))
            setComments(item.comments || '')
        }
    }, [item])
    const fetchSuggestions = useCallback(async (partial = '') => {
        setIsLoadingSuggestions(true)
        try {
            const suggestions = await AIService.suggestListItems(partial)
            setAiSuggestions(suggestions)
            setShowSuggestions(suggestions.length > 0)
        } catch {
            setAiSuggestions([])
            setShowSuggestions(false)
            setAiError('Suggestions unavailable')
            setTimeout(() => setAiError(null), 3000)
        } finally {
            setIsLoadingSuggestions(false)
        }
    }, [])
    /** Sends the description (and comments) to AI for rewriting; response may be a string or {description, comments} object. */
    const handleImproveDescription = async () => {
        if (!description.trim()) return
        setIsImprovingDescription(true)
        try {
            const improved = await AIService.improveListItem(description, comments)
            if (improved) {
                if (typeof improved === 'object') {
                    setDescription(improved.description || description)
                    if (improved.comments !== undefined) {
                        setComments(improved.comments)
                    }
                } else {
                    setDescription(improved)
                }
            }
        } catch {
            setAiError('Failed to improve description')
            setTimeout(() => setAiError(null), 3000)
        } finally {
            setIsImprovingDescription(false)
        }
    }
    const handleSelectSuggestion = (suggestion) => {
        setDescription(suggestion)
        setShowSuggestions(false)
        setAiSuggestions([])
    }
    const selectedPlantObj = plants.find((p) => p.plant_code === plantCode)
    const plantDisplayText = plantCode
        ? `(${selectedPlantObj?.plant_code}) ${selectedPlantObj?.plant_name}`
        : 'Select Plant'
    const validate = () => {
        const newErrors = {}
        if (!description.trim()) newErrors.description = 'Description is required'
        const isBulkMode = selectedPlantCodes.length > 0
        if (isBulkMode) {
            if (!selectedPlantCodes.length) {
                newErrors.plantCode = 'At least one plant is required'
            }
        } else {
            if (!plantCode) newErrors.plantCode = 'Plant is required'
        }
        setErrors(newErrors)
        return !Object.keys(newErrors).length
    }
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return
        setIsSaving(true)
        try {
            let userId = currentUserId
            if (!userId) {
                const user = await UserService.getCurrentUser()
                if (!user || !user.id) {
                    alert('User ID is required. Please ensure you are logged in.')
                    setIsSaving(false)
                    return
                }
                userId = user.id
                setCurrentUserId(userId)
            }
            if (item) {
                const updateData = {
                    comments: comments.trim(),
                    deadline: new Date(deadline).toISOString(),
                    description: description.trim(),
                    plant_code: plantCode,
                    priority
                }
                await ListService.updateListItem({ ...item, ...updateData })
            } else if (selectedPlantCodes.length > 0) {
                const promises = selectedPlantCodes.map((code) =>
                    ListService.createListItem(
                        code,
                        description,
                        new Date(deadline),
                        comments,
                        status,
                        responsibleRole,
                        priority
                    )
                )
                await Promise.all(promises)
            } else {
                await ListService.createListItem(
                    plantCode,
                    description,
                    new Date(deadline),
                    comments,
                    status,
                    responsibleRole,
                    priority
                )
            }
            onItemAdded?.()
            onClose?.()
        } catch (error) {
            alert(`Failed to save list item: ${error.message || 'Unknown error'}. Please try again.`)
        } finally {
            setIsSaving(false)
        }
    }
    return (
        <>
            <AddViewSection title={item ? 'Edit List Item' : 'Add New List Item'} onClose={onClose} isListItem={true}>
                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex flex-col gap-2 min-w-0">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="description" className="text-sm font-medium text-text-primary">
                                        Description*
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {description.trim() && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={handleImproveDescription}
                                                    disabled={isImprovingDescription}
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                                                    title="AI will improve and add context to your description"
                                                >
                                                    {isImprovingDescription ? (
                                                        <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                                                    ) : (
                                                        <i className="fas fa-magic" aria-hidden="true" />
                                                    )}
                                                    <span className="hidden sm:inline">Improve</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => fetchSuggestions(description)}
                                                    disabled={isLoadingSuggestions}
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                                                    title="Get AI task suggestions based on your input"
                                                >
                                                    {isLoadingSuggestions ? (
                                                        <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                                                    ) : (
                                                        <i className="fas fa-lightbulb" aria-hidden="true" />
                                                    )}
                                                    <span className="hidden sm:inline">Suggest</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        id="description"
                                        type="text"
                                        className={LIST_INPUT_CLASS}
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value)
                                            setShowSuggestions(false)
                                        }}
                                        onBlur={() => setDescription(GrammarUtility.cleanDescription(description))}
                                        placeholder="Enter item description or click Suggest for ideas"
                                        required
                                        autoFocus
                                    />
                                    {aiError && (
                                        <div
                                            className="mt-1 flex items-center gap-2 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-text-primary animate-fade-slide-in"
                                            role="alert"
                                        >
                                            <i
                                                className="fas fa-exclamation-triangle text-[10px] text-status-danger"
                                                aria-hidden="true"
                                            />
                                            <span>{aiError}</span>
                                        </div>
                                    )}
                                    {showSuggestions && aiSuggestions.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-card border border-border-light bg-bg-primary shadow-modal animate-fade-slide-in">
                                            <div className="border-b border-border-light bg-bg-secondary px-3 py-2">
                                                <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                                    <i className="fas fa-robot text-accent" aria-hidden="true" />
                                                    <span>AI Suggestions</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSuggestions(false)}
                                                        className="ml-auto rounded p-1 text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                                        aria-label="Close suggestions"
                                                    >
                                                        <i className="fas fa-times" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {aiSuggestions.map((suggestion, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => handleSelectSuggestion(suggestion)}
                                                        className="w-full border-b border-border-light px-4 py-2.5 text-left text-sm text-text-primary transition-colors duration-150 last:border-b-0 hover:bg-bg-hover focus-visible:bg-bg-hover focus-visible:outline-none"
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 min-w-0">
                            <div className="flex flex-col gap-2 min-w-0">
                                <label htmlFor="plantCode" className="text-sm font-medium text-text-primary">
                                    {selectedPlantCodes.length > 0 ? 'Plants*' : 'Plant*'}
                                </label>
                                {!item ? (
                                    <>
                                        <button
                                            type="button"
                                            className={LIST_PLANT_BUTTON_CLASS}
                                            onClick={() => setIsPlantModalOpen(true)}
                                            aria-label="Select plants"
                                        >
                                            {selectedPlantCodes.length === 0
                                                ? 'Select Plants'
                                                : `${selectedPlantCodes.length} plant${selectedPlantCodes.length !== 1 ? 's' : ''} selected`}
                                        </button>
                                        {selectedPlantCodes.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {selectedPlantCodes.map((code) => {
                                                    const plant = plants.find((p) => p.plant_code === code)
                                                    return (
                                                        <div
                                                            key={code}
                                                            className="inline-flex items-center gap-2 rounded-md border border-accent/20 bg-accent/10 px-3 py-1.5 text-sm text-text-primary"
                                                        >
                                                            <span>
                                                                ({plant?.plant_code}) {plant?.plant_name}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-text-primary transition-colors duration-150 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                                                onClick={() =>
                                                                    setSelectedPlantCodes((prev) =>
                                                                        prev.filter((c) => c !== code)
                                                                    )
                                                                }
                                                                aria-label="Remove plant"
                                                            >
                                                                <i className="fas fa-times text-xs" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className={LIST_PLANT_BUTTON_CLASS}
                                        onClick={() => setIsPlantModalOpen(true)}
                                        aria-label="Select plant"
                                    >
                                        {plantDisplayText}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                            <div className="flex flex-col gap-2 min-w-0">
                                <label htmlFor="priority" className="text-sm font-medium text-text-primary">
                                    Priority
                                </label>
                                <select
                                    id="priority"
                                    className={LIST_SELECT_CLASS}
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    {priorityOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                                <label htmlFor="status" className="text-sm font-medium text-text-primary">
                                    Status
                                </label>
                                <select
                                    id="status"
                                    className={LIST_SELECT_CLASS}
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    {statusOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                                <label htmlFor="responsibleRole" className="text-sm font-medium text-text-primary">
                                    Responsible
                                </label>
                                <select
                                    id="responsibleRole"
                                    className={LIST_SELECT_CLASS}
                                    value={responsibleRole}
                                    onChange={(e) => setResponsibleRole(e.target.value)}
                                >
                                    {responsibleRoleOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex flex-col gap-2 min-w-0">
                                <label htmlFor="comments" className="text-sm font-medium text-text-primary">
                                    Comments
                                </label>
                                <textarea
                                    id="comments"
                                    className={LIST_TEXTAREA_CLASS}
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Enter any additional comments"
                                    rows="3"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                            disabled={isSaving}
                        >
                            {isSaving && <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />}
                            {isSaving
                                ? 'Saving...'
                                : item
                                  ? 'Update Item'
                                  : selectedPlantCodes.length > 0
                                    ? `Add to ${selectedPlantCodes.length} Plant${selectedPlantCodes.length !== 1 ? 's' : ''}`
                                    : 'Add Item'}
                        </button>
                    </div>
                    {errors.description && (
                        <div className="mt-2 text-sm text-status-danger" role="alert">
                            {errors.description}
                        </div>
                    )}
                    {errors.plantCode && (
                        <div className="mt-2 text-sm text-status-danger" role="alert">
                            {errors.plantCode}
                        </div>
                    )}
                </form>
            </AddViewSection>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    onSelect={(code) => {
                        if (!item) {
                            if (!selectedPlantCodes.includes(code)) {
                                setSelectedPlantCodes((prev) => [...prev, code])
                            }
                        } else {
                            setPlantCode(code)
                            setIsPlantModalOpen(false)
                        }
                    }}
                    plants={plants}
                    allowMultiple={!item}
                    selectedPlantCodes={selectedPlantCodes}
                />
            )}
        </>
    )
}
export default ListAddView
