/* eslint-disable react/forbid-dom-props */
import React from 'react'

import AddressAutocomplete from '../common/AddressAutocomplete'

const trimSafe = (value) => (value || '').trim()

/**
 * Per-plant street address editor. Each row is independently dirty-checked
 * against the persisted value (or the optimistic `persistedOverride` if a
 * save just landed) so saves don't enable until the user actually changes
 * something.
 */
export function PlanSettingsAddressesPanel({
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
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                Plant addresses
            </div>
            <p className="text-[11.5px] -mt-1 text-text-tertiary">
                Start typing the plant&apos;s street address and pick a suggestion to verify it. The verified address
                feeds the Schedule tab&apos;s plant → job → plant routes and the booking recommender&apos;s drive-time
                math.
            </p>
            {error && <AddressErrorBanner message={error} />}
            {(plants || []).length === 0 ? (
                <div className="text-xs py-4 text-center text-text-secondary">No plants in this region.</div>
            ) : (
                <div className="flex flex-col gap-2">
                    {(plants || []).map((plant) => (
                        <AddressRow
                            key={plant.plant_code}
                            accentColor={accentColor}
                            isDirty={
                                trimSafe(addresses[plant.plant_code] ?? '') !==
                                trimSafe(
                                    persistedOverride[plant.plant_code] !== undefined
                                        ? persistedOverride[plant.plant_code]
                                        : plant.plant_address || ''
                                )
                            }
                            isSaving={savingCode === plant.plant_code}
                            plant={plant}
                            value={addresses[plant.plant_code] ?? ''}
                            wasJustSaved={savedCode === plant.plant_code}
                            onChange={(next) => setAddresses((prev) => ({ ...prev, [plant.plant_code]: next }))}
                            onSave={() => onSave(plant.plant_code)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function AddressErrorBanner({ message }) {
    return (
        <div className="text-[11.5px] px-3 py-2 rounded-md border bg-[rgba(220,_38,_38,_0.12)] border-[rgba(220,_38,_38,_0.4)] text-text-primary">
            <i className="fas fa-triangle-exclamation mr-1 text-red-600" /> {message}
        </div>
    )
}

function AddressRow({ accentColor, isDirty, isSaving, plant, value, wasJustSaved, onChange, onSave }) {
    const code = plant.plant_code
    /* `AddressAutocomplete` matches the booking-form pattern: pick from
     * Nominatim's suggestions and the canonical, geocodable display
     * name lands in state. Picking also pre-warms the geocode cache
     * with the verified lat/lng, so the routing service hits
     * localStorage on the next plant↔job route instead of re-fetching. */
    return (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2 bg-bg-secondary">
            <div
                className="flex items-center justify-center rounded-md font-bold shrink-0 text-white font-heading h-[26px]"
                style={{ background: accentColor, fontSize: 11, minWidth: 36 }}
                title={plant.plant_name || ''}
            >
                {code}
            </div>
            <div className="flex-1 min-w-0">
                <AddressAutocomplete
                    fieldStyle={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                    inputClassName="w-full rounded-md text-[12.5px] outline-none px-2 py-1.5"
                    onChange={onChange}
                    placeholder={`Street address for ${plant.plant_name || code}`}
                    value={value}
                />
            </div>
            <AddressSaveButton
                accentColor={accentColor}
                isDirty={isDirty}
                isSaving={isSaving}
                wasJustSaved={wasJustSaved}
                onSave={onSave}
            />
        </div>
    )
}

function AddressSaveButton({ accentColor, isDirty, isSaving, wasJustSaved, onSave }) {
    const buttonBackground = wasJustSaved ? '#16a34a' : isDirty ? accentColor : 'var(--bg-tertiary)'
    const buttonColor = wasJustSaved || isDirty ? '#fff' : 'var(--text-secondary)'
    return (
        <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="border-none rounded-md cursor-pointer text-[11.5px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
            style={{ background: buttonBackground, color: buttonColor }}
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
    )
}
