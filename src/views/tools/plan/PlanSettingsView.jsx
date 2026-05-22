import React from 'react'

import PlanOperationalSettings from '../../../app/components/plan/tabs/settings/PlanOperationalSettings'
import PlanSettings from '../../../app/components/plan/tabs/settings/PlanSettings'
import { usePreferences } from '../../../app/context/PreferencesContext'

/**
 * Plan → Settings tab. Gated by `plan.settings`.
 *
 * Renders two surfaces:
 *   1. Operational settings — the per-region `plan_settings` row that
 *      tunes pre-trip / load / slump / DOT cap / big-pour thresholds
 *      and the slot grid. Replaces the hardcoded JS constants in
 *      `src/app/constants/planConstants.ts` so dispatch can adjust
 *      cycle math without a redeploy.
 *   2. Travel times between plants — the existing inter-plant route
 *      matrix the Planner / Schedule / Demand views consume for route
 *      math whenever a truck crosses plant boundaries.
 *
 * The prior Find-a-Spot audit log + dispatcher leaderboard +
 * recommendation breakdown stack stays in the tree (disabled at the
 * tab level) so the feature can be re-enabled later without rebuilding
 * the wiring.
 */
function PlanSettingsView({
    accentColor,
    addTravelTime,
    newTravelTime,
    plants,
    removeTravelTime,
    setNewTravelTime,
    travelTimes
}) {
    const { preferences } = usePreferences()
    const regionCode = preferences?.selectedRegion?.code || ''
    const regionName = preferences?.selectedRegion?.name || ''
    return (
        <div className="flex-1 overflow-y-auto">
            {/* Two-panel split — Operational settings on the left,
                Travel times on the right. Stacks vertically below the
                lg breakpoint so phones / narrow laptops still get a
                readable single-column layout. Items align to the top so
                the two panels don't stretch to match each other's
                height when one is much taller. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-4 lg:gap-6 mx-auto max-w-[1600px] px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
                <div className="min-w-0">
                    <PlanOperationalSettings
                        accentColor={accentColor}
                        regionCode={regionCode}
                        regionName={regionName}
                    />
                </div>

                <div className="min-w-0 flex flex-col gap-3">
                    <div>
                        <div className="text-[15px] font-semibold text-text-primary">Travel times between plants</div>
                        <div className="text-[11.5px] text-text-tertiary">
                            Minutes from one plant to another. Used by the Planner, Schedule, and Demand views for route
                            math whenever a truck crosses plant boundaries.
                        </div>
                    </div>
                    <PlanSettings
                        accentColor={accentColor}
                        addTravelTime={addTravelTime}
                        newTravelTime={newTravelTime}
                        plants={plants}
                        removeTravelTime={removeTravelTime}
                        setNewTravelTime={setNewTravelTime}
                        travelTimes={travelTimes}
                    />
                </div>
            </div>
        </div>
    )
}

export default PlanSettingsView
