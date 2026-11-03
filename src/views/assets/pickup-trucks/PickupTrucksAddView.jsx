import React, { useState } from 'react'

import PlantPickerField from '../../../app/components/common/PlantPickerField'
import AddViewSection, { AddViewActions } from '../../../app/components/sections/AddViewSection'
import { DialogField } from '../../../app/components/ui/Dialog'
import { usePreferences } from '../../../app/context/PreferencesContext'
import usePlantPicker from '../../../app/hooks/usePlantPicker'
import { PickupTruckService } from '../../../services/PickupTruckService'
import { getSessionUserId } from '../../../services/SessionService'

/**
 * Slide-in form for creating a new pickup truck record. Supports VIN
 * (with I/O/Q letter stripping), make/model/year, assignee, mileage,
 * comments, region-scoped plant assignment, and status selection.
 */
function PickupTrucksAddView({ onClose, onAdded }) {
    const { preferences } = usePreferences()
    const [vin, setVin] = useState('')
    const [make, setMake] = useState('')
    const [model, setModel] = useState('')
    const [year, setYear] = useState('')
    const [assigned, setAssigned] = useState('')
    const [status, setStatus] = useState('Active')
    const [mileage, setMileage] = useState('')
    const [comments, setComments] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const picker = usePlantPicker({
        loadAllPlants: true,
        regionCode: preferences.selectedRegion?.code || '',
        regionFilter: true
    })

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        if (!picker.assignedPlant) {
            setError('Assigned plant is required')
            return
        }
        setIsSaving(true)
        try {
            const userId = getSessionUserId()
            if (!userId) throw new Error('User ID not available. Please log in again.')
            const payload = {
                assigned: assigned || null,
                assignedPlant: picker.assignedPlant || null,
                assigned_plant: picker.assignedPlant || null,
                comments: comments || null,
                make: make || null,
                mileage: mileage === '' ? null : Number(mileage),
                model: model || null,
                status: status || null,
                vin: vin || null,
                year: year || null
            }
            const saved = await PickupTruckService.create(payload, userId)
            onAdded?.(saved)
            onClose?.()
        } catch (err) {
            setError(err?.message || 'Failed to add pickup truck')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <AddViewSection title="Add pickup truck" onClose={onClose} error={error}>
            <form onSubmit={handleSubmit} autoComplete="off">
                <div className="space-y-4">
                    <div className="border-b border-border-light pb-2 font-heading text-[15px] font-semibold tracking-tight text-text-primary [&>i]:hidden">
                        <i className="fas fa-car"></i>
                        <span>Basic Information</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DialogField label="VIN" htmlFor="vin" hint="Letters I, O, and Q are not used.">
                            <input
                                id="vin"
                                type="text"
                                value={vin}
                                onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[IOQ]/g, ''))}
                                placeholder="Enter VIN (no I, O, Q)"
                                autoFocus
                            />
                        </DialogField>
                        <DialogField label="Year" htmlFor="year">
                            <input
                                id="year"
                                type="text"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="Enter year"
                            />
                        </DialogField>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DialogField label="Make" htmlFor="make">
                            <input
                                id="make"
                                type="text"
                                value={make}
                                onChange={(e) => setMake(e.target.value)}
                                placeholder="Enter make"
                            />
                        </DialogField>
                        <DialogField label="Model" htmlFor="model">
                            <input
                                id="model"
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="Enter model"
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
                                <option value="Active">Active</option>
                                <option value="Stationary">Stationary</option>
                                <option value="Spare">Spare</option>
                                <option value="In Shop">In Shop</option>
                                <option value="Retired">Retired</option>
                                <option value="Sold">Sold</option>
                            </select>
                        </DialogField>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="border-b border-border-light pb-2 font-heading text-[15px] font-semibold tracking-tight text-text-primary [&>i]:hidden">
                        <i className="fas fa-user"></i>
                        <span>Usage Details</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DialogField label="Assigned" htmlFor="assigned">
                            <input
                                id="assigned"
                                type="text"
                                value={assigned}
                                onChange={(e) => setAssigned(e.target.value)}
                                placeholder="Enter name"
                            />
                        </DialogField>
                        <DialogField label="Mileage" htmlFor="mileage">
                            <input
                                id="mileage"
                                type="number"
                                value={mileage}
                                onChange={(e) => setMileage(e.target.value)}
                                placeholder="Enter mileage"
                            />
                        </DialogField>
                        <div className="col-span-full">
                            <DialogField label="Comments" htmlFor="comments">
                                <textarea
                                    id="comments"
                                    rows={3}
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Notes"
                                />
                            </DialogField>
                        </div>
                    </div>
                </div>
                <AddViewActions isSaving={isSaving} label="Add pickup truck" onCancel={onClose} />
            </form>
        </AddViewSection>
    )
}

export default PickupTrucksAddView
