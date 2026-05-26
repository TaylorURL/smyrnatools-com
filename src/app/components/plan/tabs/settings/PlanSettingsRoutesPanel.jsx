/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { PlantSelect } from '../../../common/PlanComponents'

const filterDirectedRoutes = (travelTimes) =>
    Object.entries(travelTimes || {}).filter(([key]) => {
        const [from, to] = key.split('->')
        return from < to
    })

/**
 * Plant-to-plant travel-time configuration. The keys in `travelTimes` are
 * directed (`A->B` and `B->A`) so we filter to one direction for display
 * even though edits roundtrip both keys.
 */
export function PlanSettingsRoutesPanel({
    accentColor,
    plants,
    travelTimes,
    newTravelTime,
    setNewTravelTime,
    addTravelTime,
    removeTravelTime
}) {
    const directedRoutes = filterDirectedRoutes(travelTimes)
    return (
        <>
            <div className="px-5 py-4 bg-bg-secondary">
                <SectionLabel>Add Route</SectionLabel>
                <div className="flex items-center gap-2">
                    <PlantSelect
                        value={newTravelTime.from}
                        onChange={(e) => setNewTravelTime({ ...newTravelTime, from: e.target.value })}
                        plants={plants}
                        placeholder="From"
                        className="min-w-[80px]"
                    />
                    <i className="fas fa-arrow-right text-[10px] text-text-secondary" />
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
                        className="border rounded-lg text-sm outline-none py-1.5 px-2 text-center w-[60px] bg-bg-primary border-border-medium text-text-primary"
                    />
                    <button
                        onClick={addTravelTime}
                        className="border-none rounded-lg cursor-pointer text-sm font-semibold px-3 py-1.5 text-white active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{ background: accentColor }}
                    >
                        Add
                    </button>
                </div>
            </div>
            <div className="px-5 py-4">
                <SectionLabel>Saved Routes</SectionLabel>
                {directedRoutes.length === 0 ? (
                    <div className="text-xs py-4 text-center text-text-secondary">No travel times configured yet</div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {directedRoutes.map(([key, minutes]) => (
                            <RouteRow
                                key={key}
                                accentColor={accentColor}
                                minutes={minutes}
                                routeKey={key}
                                onRemove={() => removeTravelTime(key)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

function SectionLabel({ children }) {
    return (
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-text-secondary">{children}</div>
    )
}

function RouteRow({ accentColor, minutes, onRemove, routeKey }) {
    const [from, to] = routeKey.split('->')
    return (
        <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-bg-tertiary">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">{from}</span>
                <i className="fas fa-arrows-left-right text-[9px] text-text-secondary" />
                <span className="text-xs font-semibold text-text-primary">{to}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                    {minutes} min
                </span>
                <button
                    onClick={onRemove}
                    aria-label="Remove route"
                    className="bg-transparent border-none cursor-pointer p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 active:scale-[0.92] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                >
                    <i className="fas fa-trash text-[10px]" />
                </button>
            </div>
        </div>
    )
}
