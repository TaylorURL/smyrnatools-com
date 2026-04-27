import React, { useEffect, useState } from 'react'

import { PlantSelect } from '../../../app/components/common/PlanComponents'
import { PlantService } from '../../../services/PlantService'

const TAB_ROUTES = 'routes'
const TAB_ADDRESSES = 'addresses'

/**
 * Modal for configuring plant-to-plant travel times AND each plant's street
 * address. Plant addresses feed the Schedule tab's plant→job→plant route
 * map and seed driving-time estimates.
 */
export default function PlanSettingsModal({
    accentColor,
    plants,
    travelTimes,
    newTravelTime,
    setNewTravelTime,
    addTravelTime,
    removeTravelTime,
    onClose
}) {
    const [tab, setTab] = useState(TAB_ROUTES)
    const [addresses, setAddresses] = useState({})
    // Tracks the latest persisted value per plant so the dirty-check stops
    // nagging right after a save, even before the parent re-fetches plants.
    const [persistedOverride, setPersistedOverride] = useState({})
    const [savingCode, setSavingCode] = useState(null)
    const [savedCode, setSavedCode] = useState(null)
    const [error, setError] = useState(null)

    // Seed local edit state from the plant list whenever the modal opens or the
    // plant list changes — preserves any draft the user is mid-edit on.
    useEffect(() => {
        setAddresses((prev) => {
            const next = { ...prev }
            ;(plants || []).forEach((p) => {
                if (!p?.plant_code) return
                if (next[p.plant_code] === undefined) next[p.plant_code] = p.plant_address || ''
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
            window.setTimeout(() => setSavedCode((c) => (c === plantCode ? null : c)), 1500)
        } catch (err) {
            setError(err?.message || 'Could not save address')
        } finally {
            setSavingCode(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40" />
            <div
                className="relative rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <div className="flex items-center gap-2">
                        <i className="fas fa-sliders text-sm" style={{ color: accentColor }} />
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            Plan Settings
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
                {/* Tabs */}
                <div
                    className="flex items-center gap-1 px-5 pt-3 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    {[
                        { icon: 'fa-route', key: TAB_ROUTES, label: 'Travel Times' },
                        { icon: 'fa-location-dot', key: TAB_ADDRESSES, label: 'Plant Addresses' }
                    ].map(({ icon, key, label }) => {
                        const active = tab === key
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
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
                {tab === TAB_ROUTES ? (
                    <RoutesPanel
                        accentColor={accentColor}
                        plants={plants}
                        travelTimes={travelTimes}
                        newTravelTime={newTravelTime}
                        setNewTravelTime={setNewTravelTime}
                        addTravelTime={addTravelTime}
                        removeTravelTime={removeTravelTime}
                    />
                ) : (
                    <AddressesPanel
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
        </div>
    )
}

function RoutesPanel({
    accentColor,
    plants,
    travelTimes,
    newTravelTime,
    setNewTravelTime,
    addTravelTime,
    removeTravelTime
}) {
    return (
        <>
            {/* Add new route */}
            <div className="px-5 py-4" style={{ background: 'var(--bg-secondary)' }}>
                <div
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Add Route
                </div>
                <div className="flex items-center gap-2">
                    <PlantSelect
                        value={newTravelTime.from}
                        onChange={(e) => setNewTravelTime({ ...newTravelTime, from: e.target.value })}
                        plants={plants}
                        placeholder="From"
                        className="min-w-[80px]"
                    />
                    <i className="fas fa-arrow-right text-[10px]" style={{ color: 'var(--text-secondary)' }} />
                    <PlantSelect
                        value={newTravelTime.to}
                        onChange={(e) => setNewTravelTime({ ...newTravelTime, to: e.target.value })}
                        plants={plants}
                        placeholder="To"
                        className="min-w-[80px]"
                    />
                    <input
                        type="number"
                        placeholder="min"
                        value={newTravelTime.minutes}
                        onChange={(e) => setNewTravelTime({ ...newTravelTime, minutes: e.target.value })}
                        className="border rounded-lg text-sm outline-none py-1.5 px-2 text-center w-[60px]"
                        style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-medium)',
                            color: 'var(--text-primary)'
                        }}
                    />
                    <button
                        onClick={addTravelTime}
                        className="border-none rounded-lg cursor-pointer text-sm font-semibold px-3 py-1.5 text-white"
                        style={{ background: accentColor }}
                    >
                        Add
                    </button>
                </div>
            </div>
            {/* Saved routes */}
            <div className="px-5 py-4 max-h-[300px] overflow-y-auto">
                <div
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Saved Routes
                </div>
                {Object.entries(travelTimes).filter(([k]) => {
                    const [f, t] = k.split('->')
                    return f < t
                }).length === 0 ? (
                    <div className="text-xs py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                        No travel times configured yet
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {Object.entries(travelTimes)
                            .filter(([k]) => {
                                const [f, t] = k.split('->')
                                return f < t
                            })
                            .map(([k, v]) => {
                                const [f, t] = k.split('->')
                                return (
                                    <div
                                        key={k}
                                        className="flex items-center justify-between rounded-lg px-3 py-2"
                                        style={{ background: 'var(--bg-tertiary)' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-xs font-semibold"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {f}
                                            </span>
                                            <i
                                                className="fas fa-arrows-left-right text-[9px]"
                                                style={{ color: 'var(--text-secondary)' }}
                                            />
                                            <span
                                                className="text-xs font-semibold"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {t}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold" style={{ color: accentColor }}>
                                                {v} min
                                            </span>
                                            <button
                                                onClick={() => removeTravelTime(k)}
                                                className="bg-transparent border-none cursor-pointer p-1 rounded"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                <i className="fas fa-trash text-[10px]" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                )}
            </div>
        </>
    )
}

function AddressesPanel({
    accentColor,
    addresses,
    error,
    persistedOverride = {},
    plants,
    savedCode,
    savingCode,
    setAddresses,
    onSave
}) {
    return (
        <div className="px-5 py-4 max-h-[420px] overflow-y-auto flex flex-col gap-3">
            <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
            >
                Plant addresses
            </div>
            <p className="text-[11.5px] -mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Used by the Schedule tab to draw plant → job → plant routes when an order address is clicked.
            </p>
            {error && (
                <div
                    className="text-[11.5px] px-3 py-2 rounded-md border"
                    style={{
                        background: 'rgba(220, 38, 38, 0.12)',
                        borderColor: 'rgba(220, 38, 38, 0.4)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <i className="fas fa-triangle-exclamation mr-1" style={{ color: '#dc2626' }} /> {error}
                </div>
            )}
            {(plants || []).length === 0 ? (
                <div className="text-xs py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                    No plants in this region.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {(plants || []).map((p) => {
                        const code = p.plant_code
                        const value = addresses[code] ?? ''
                        const original =
                            persistedOverride[code] !== undefined ? persistedOverride[code] : p.plant_address || ''
                        const isDirty = (value || '').trim() !== (original || '').trim()
                        const isSaving = savingCode === code
                        const wasJustSaved = savedCode === code
                        return (
                            <div
                                key={code}
                                className="rounded-lg px-3 py-2 flex items-center gap-2"
                                style={{ background: 'var(--bg-secondary)' }}
                            >
                                <div
                                    className="flex items-center justify-center rounded-md font-bold shrink-0"
                                    style={{
                                        background: accentColor,
                                        color: '#fff',
                                        fontFamily: 'var(--font-heading)',
                                        fontSize: 11,
                                        height: 26,
                                        minWidth: 36
                                    }}
                                    title={p.plant_name || ''}
                                >
                                    {code}
                                </div>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => setAddresses((prev) => ({ ...prev, [code]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && isDirty) onSave(code)
                                    }}
                                    placeholder={`Street address for ${p.plant_name || code}`}
                                    className="flex-1 border rounded-md text-[12.5px] outline-none px-2 py-1.5"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        borderColor: 'var(--border-medium)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => onSave(code)}
                                    disabled={!isDirty || isSaving}
                                    className="border-none rounded-md cursor-pointer text-[11.5px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
                                    style={{
                                        background: wasJustSaved
                                            ? '#16a34a'
                                            : isDirty
                                              ? accentColor
                                              : 'var(--bg-tertiary)',
                                        color: wasJustSaved || isDirty ? '#fff' : 'var(--text-secondary)'
                                    }}
                                    title={isDirty ? 'Save address' : 'No changes to save'}
                                >
                                    {isSaving ? (
                                        <i className="fas fa-spinner fa-spin" />
                                    ) : wasJustSaved ? (
                                        <i className="fas fa-check" />
                                    ) : (
                                        <i className="fas fa-save" />
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
