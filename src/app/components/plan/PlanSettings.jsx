import React, { useEffect, useState } from 'react'

import { PlantService } from '../../../services/PlantService'
import { PlanSettingsAddressesPanel } from './PlanSettingsAddressesPanel'
import { PlanSettingsRoutesPanel } from './PlanSettingsRoutesPanel'

const TAB_ROUTES = 'routes'
const TAB_ADDRESSES = 'addresses'
const SAVED_FLASH_MS = 1500

const TABS = [
    { icon: 'fa-route', key: TAB_ROUTES, label: 'Travel Times' },
    { icon: 'fa-location-dot', key: TAB_ADDRESSES, label: 'Plant Addresses' }
]

/**
 * Inline settings panel for plant-to-plant travel times and plant street
 * addresses. Lives inside the Plan → Admin tab. Plant addresses feed the
 * Schedule tab's route map and seed driving-time estimates.
 */
export default function PlanSettings({
    accentColor,
    addTravelTime,
    newTravelTime,
    plants,
    removeTravelTime,
    setNewTravelTime,
    travelTimes
}) {
    const [tab, setTab] = useState(TAB_ROUTES)
    const [addresses, setAddresses] = useState({})
    // Tracks the latest persisted value per plant so the dirty-check stops
    // nagging right after a save, even before the parent re-fetches plants.
    const [persistedOverride, setPersistedOverride] = useState({})
    const [savingCode, setSavingCode] = useState(null)
    const [savedCode, setSavedCode] = useState(null)
    const [error, setError] = useState(null)

    // Seed local edit state from the plant list whenever the plant list
    // changes — preserves any draft the user is mid-edit on.
    useEffect(() => {
        setAddresses((prev) => {
            const next = { ...prev }
            ;(plants || []).forEach((plant) => {
                if (!plant?.plant_code) return
                if (next[plant.plant_code] === undefined) next[plant.plant_code] = plant.plant_address || ''
            })
            return next
        })
    }, [plants])

    const saveAddress = async (plantCode) => {
        setError(null)
        setSavingCode(plantCode)
        const value = (addresses[plantCode] || '').trim()
        try {
            await PlantService.updatePlantAddress(plantCode, value)
            setPersistedOverride((prev) => ({ ...prev, [plantCode]: value }))
            setSavedCode(plantCode)
            window.setTimeout(() => setSavedCode((current) => (current === plantCode ? null : current)), SAVED_FLASH_MS)
        } catch (err) {
            setError(err?.message || 'Could not save address')
        } finally {
            setSavingCode(null)
        }
    }

    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <PlanSettingsHeader accentColor={accentColor} />
            <PlanSettingsTabs accentColor={accentColor} activeTab={tab} onChange={setTab} />
            {tab === TAB_ROUTES ? (
                <PlanSettingsRoutesPanel
                    accentColor={accentColor}
                    addTravelTime={addTravelTime}
                    newTravelTime={newTravelTime}
                    plants={plants}
                    removeTravelTime={removeTravelTime}
                    setNewTravelTime={setNewTravelTime}
                    travelTimes={travelTimes}
                />
            ) : (
                <PlanSettingsAddressesPanel
                    accentColor={accentColor}
                    addresses={addresses}
                    error={error}
                    persistedOverride={persistedOverride}
                    plants={plants}
                    savedCode={savedCode}
                    savingCode={savingCode}
                    setAddresses={setAddresses}
                    onSave={saveAddress}
                />
            )}
        </div>
    )
}

function PlanSettingsHeader({ accentColor }) {
    return (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border-light">
            <i className="fas fa-sliders text-sm" style={{ color: accentColor }} />
            <span className="text-sm font-bold text-text-primary">Plan Settings</span>
        </div>
    )
}

function PlanSettingsTabs({ accentColor, activeTab, onChange }) {
    return (
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-border-light">
            {TABS.map(({ icon, key, label }) => {
                const active = activeTab === key
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className="px-3 py-2 rounded-t-md text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                        style={{
                            background: active ? `${accentColor}14` : 'transparent',
                            borderBottom: active ? `2px solid ${accentColor}` : '2px solid transparent',
                            color: active ? accentColor : 'var(--text-secondary)',
                            marginBottom: -1
                        }}
                    >
                        <i className={`fas ${icon} text-[10px]`} />
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
