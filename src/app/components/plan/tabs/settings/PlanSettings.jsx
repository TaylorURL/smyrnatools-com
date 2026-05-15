/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { PlanSettingsRoutesPanel } from './PlanSettingsRoutesPanel'

/**
 * Inline settings panel for plant-to-plant travel times. Lives inside the
 * Plan → Admin tab. Plant addresses are no longer edited here — that
 * lives on the canonical Plants admin page (`PlantsView` / `PlantsDetailView`),
 * where address, latitude, longitude, and the manager list are all owned
 * together. This panel is now travel-time-only.
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
    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <PlanSettingsHeader accentColor={accentColor} />
            <PlanSettingsRoutesPanel
                accentColor={accentColor}
                addTravelTime={addTravelTime}
                newTravelTime={newTravelTime}
                plants={plants}
                removeTravelTime={removeTravelTime}
                setNewTravelTime={setNewTravelTime}
                travelTimes={travelTimes}
            />
        </div>
    )
}

function PlanSettingsHeader({ accentColor }) {
    return (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border-light">
            <i className="fas fa-sliders text-sm" style={{ color: accentColor }} />
            <span className="text-sm font-bold text-text-primary">Plan Settings</span>
            <span className="ml-auto text-[11px] text-text-tertiary">
                Plant addresses are managed from the Plants admin page.
            </span>
        </div>
    )
}
