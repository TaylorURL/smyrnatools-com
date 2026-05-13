import React, { useEffect, useState } from 'react'

import PlantPickerField from '../../../app/components/common/PlantPickerField'
import AddViewSection from '../../../app/components/sections/AddViewSection'
import usePlantPicker from '../../../app/hooks/usePlantPicker'
import Trailer from '../../../app/models/trailers/Trailer'
import { getSessionUserId } from '../../../services/SessionService'
import { TrailerService } from '../../../services/TrailerService'
import DateUtility from '../../../utils/DateUtility'

/**
 * Slide-in form for creating a new trailer record. Requires trailer number
 * and plant assignment. Supports type selection (Cement/End Dump) and an
 * initial cleanliness rating.
 */
function TrailerAddView({ plants, onClose, onTrailerAdded }) {
    const [trailerNumber, setTrailerNumber] = useState('')
    const [trailerType, setTrailerType] = useState('Cement')
    const [cleanlinessRating, setCleanlinessRating] = useState(1)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const picker = usePlantPicker({ plants })

    useEffect(() => {
        TrailerService.fetchTrailers().catch((e) => console.error('Failed to prefetch trailers:', e))
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        if (!trailerNumber) return setError('Trailer number is required')
        if (!picker.assignedPlant) return setError('Plant is required')
        setIsSaving(true)
        try {
            const userId = getSessionUserId()
            if (!userId) throw new Error('User ID not available. Please log in again.')
            const now = DateUtility.formatDateForDb(new Date())
            const newTrailer = new Trailer({
                assigned_plant: picker.assignedPlant,
                assigned_tractor: null,
                cleanliness_rating: cleanlinessRating,
                created_at: now,
                trailer_number: trailerNumber,
                trailer_type: trailerType,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            })
            const savedTrailer = await TrailerService.createTrailer(newTrailer, userId)
            if (!savedTrailer) throw new Error('Failed to add trailer - no data returned from server')
            onTrailerAdded(savedTrailer)
            onClose()
        } catch (err) {
            setError(`Failed to add trailer: ${err.message || 'Unknown error'}`)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <AddViewSection title="Add New Trailer" onClose={onClose} error={error}>
            <form onSubmit={handleSubmit} autoComplete="off">
                <div className="space-y-4">
                    <div className="text-lg font-semibold">
                        <i className="fas fa-trailer"></i>
                        <span>Basic Information</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="trailerNumber">Trailer Number*</label>
                            <input
                                id="trailerNumber"
                                type="text"
                                value={trailerNumber}
                                onChange={(e) => setTrailerNumber(e.target.value)}
                                placeholder="Enter trailer number"
                                required
                                autoFocus
                            />
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="text-lg font-semibold">
                        <i className="fas fa-building"></i>
                        <span>Assignment & Type</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PlantPickerField {...picker} />
                        <div className="flex flex-col gap-1">
                            <label htmlFor="trailerType">Trailer Type</label>
                            <select
                                id="trailerType"
                                value={trailerType}
                                onChange={(e) => setTrailerType(e.target.value)}
                            >
                                <option value="Cement">Cement</option>
                                <option value="End Dump">End Dump</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="text-lg font-semibold">
                        <i className="fas fa-star"></i>
                        <span>Condition</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="cleanlinessRating">Cleanliness Rating</label>
                            <select
                                id="cleanlinessRating"
                                value={cleanlinessRating}
                                onChange={(e) => setCleanlinessRating(Number(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5].map((rating) => (
                                    <option key={rating} value={rating}>
                                        {rating} Star{rating > 1 ? 's' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="submit" disabled={isSaving}>
                        {isSaving ? 'Adding...' : 'Add Trailer'}
                    </button>
                </div>
            </form>
        </AddViewSection>
    )
}

export default TrailerAddView
