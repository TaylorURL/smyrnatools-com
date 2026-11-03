import React, { useEffect, useState } from 'react'

import PlantPickerField from '../../../app/components/common/PlantPickerField'
import AddViewSection, { AddViewActions } from '../../../app/components/sections/AddViewSection'
import { DialogField } from '../../../app/components/ui/Dialog'
import { usePreferences } from '../../../app/context/PreferencesContext'
import usePlantPicker from '../../../app/hooks/usePlantPicker'
import { Tractor } from '../../../app/models/tractors/Tractor'
import { getSessionUserId } from '../../../services/SessionService'
import { TractorService } from '../../../services/TractorService'
import DateUtility from '../../../utils/DateUtility'

/**
 * Slide-in form for creating a new tractor record. Requires truck number,
 * region-scoped plant assignment, and freight type (Cement/Aggregate/Dump Truck).
 * Optional blower toggle.
 */
function TractorAddView({ plants, onClose, onTractorAdded }) {
    const { preferences } = usePreferences()
    const [truckNumber, setTruckNumber] = useState('')
    const [status, setStatus] = useState('')
    const [hasBlower, setHasBlower] = useState(false)
    const [freight, setFreight] = useState('')
    const [hours, setHours] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const picker = usePlantPicker({
        plants,
        regionCode: preferences.selectedRegion?.code || '',
        regionFilter: true
    })

    useEffect(() => {
        TractorService.fetchTractors().catch((e) => console.error('Failed to prefetch tractors:', e))
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        if (!truckNumber) return setError('Truck number is required')
        if (!picker.assignedPlant) return setError('Plant is required')
        if (!freight) return setError('Freight is required')
        setIsSaving(true)
        try {
            const userId = getSessionUserId()
            if (!userId) throw new Error('User ID not available. Please log in again.')
            const now = DateUtility.formatDateForDb(new Date())
            const parsedHours =
                hours === '' || hours == null
                    ? null
                    : (() => {
                          const n = Number(hours)
                          return Number.isFinite(n) && n >= 0 ? n : null
                      })()
            const newTractor = new Tractor({
                assigned_operator: '0',
                assigned_plant: picker.assignedPlant,
                cleanliness_rating: 1,
                created_at: now,
                freight,
                has_blower: hasBlower,
                hours: parsedHours,
                status,
                truck_number: truckNumber,
                updated_at: now,
                updated_by: userId,
                updated_last: now
            })
            const savedTractor = await TractorService.createTractor(newTractor, userId)
            if (!savedTractor) throw new Error('Failed to add tractor - no data returned from server')
            onTractorAdded(savedTractor)
            onClose()
        } catch (err) {
            setError(`Failed to add tractor: ${err.message || 'Unknown error'}`)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <AddViewSection title="Add tractor" onClose={onClose} error={error}>
            <form onSubmit={handleSubmit} autoComplete="off">
                <div className="space-y-4">
                    <div className="border-b border-border-light pb-2 font-heading text-[15px] font-semibold tracking-tight text-text-primary [&>i]:hidden">
                        <i className="fas fa-truck-moving"></i>
                        <span>Basic Information</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DialogField label="Truck Number*" htmlFor="truckNumber">
                            <input
                                id="truckNumber"
                                type="text"
                                inputMode="numeric"
                                value={truckNumber}
                                onChange={(e) => setTruckNumber(e.target.value)}
                                placeholder="Enter truck number"
                                required
                                autoFocus
                            />
                        </DialogField>
                        <DialogField label="Hours" htmlFor="hours">
                            <input
                                id="hours"
                                type="number"
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                placeholder="Enter hours"
                                min="0"
                                step="any"
                            />
                        </DialogField>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="border-b border-border-light pb-2 font-heading text-[15px] font-semibold tracking-tight text-text-primary [&>i]:hidden">
                        <i className="fas fa-building"></i>
                        <span>Assignment & Status</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PlantPickerField {...picker} />
                        <DialogField label="Status" htmlFor="status">
                            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="">Select Status</option>
                                <option value="Spare">Spare</option>
                                <option value="In Shop">In Shop</option>
                                <option value="Retired">Retired</option>
                            </select>
                        </DialogField>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="border-b border-border-light pb-2 font-heading text-[15px] font-semibold tracking-tight text-text-primary [&>i]:hidden">
                        <i className="fas fa-cogs"></i>
                        <span>Equipment Details</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DialogField label="Has Blower" htmlFor="hasBlower">
                            <select
                                id="hasBlower"
                                value={hasBlower ? 'Yes' : 'No'}
                                onChange={(e) => setHasBlower(e.target.value === 'Yes')}
                            >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                            </select>
                        </DialogField>
                        <DialogField label="Freight*" htmlFor="freight">
                            <select id="freight" value={freight} onChange={(e) => setFreight(e.target.value)} required>
                                <option value="">Select Freight</option>
                                <option value="Cement">Cement</option>
                                <option value="Aggregate">Aggregate</option>
                                <option value="Dump Truck">Dump Truck</option>
                            </select>
                        </DialogField>
                    </div>
                </div>
                <AddViewActions isSaving={isSaving} label="Add tractor" onCancel={onClose} />
            </form>
        </AddViewSection>
    )
}

export default TractorAddView
