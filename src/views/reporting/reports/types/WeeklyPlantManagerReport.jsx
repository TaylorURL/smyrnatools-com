import React from 'react'

import { MetricsSection } from '../../../../app/components/reports/granular/PmAtoms'
import { OperatorsSentToHelp } from '../../../../app/components/reports/granular/PmOperatorsSentToHelp'
import { WeeklyTrendsSection } from '../../../../app/components/reports/granular/PmWeeklyTrendsSection'
import { usePreferences } from '../../../../app/context/PreferencesContext'
import { useYphCalculation } from '../../../../app/hooks/useYphCalculation'

/** Submit-mode plugin for the Plant Manager report — operators-sent-to-help,
 *  monthly trends timeline, and a sidebar YPH metrics card. */
export function PlantManagerSubmitPlugin({
    yph: propYph,
    yphGrade: propYphGrade,
    yphLabel: propYphLabel,
    form,
    setForm,
    weekIso,
    user,
    plants: propPlants,
    userPlantCode: propUserPlantCode
}) {
    const { preferences: _preferences } = usePreferences()
    const userPlantCode = propUserPlantCode || user?.plant_code || ''
    const plantCode = form?.plant || userPlantCode
    const { yph, grade: yphGrade, label: yphLabel } = useYphCalculation(weekIso, plantCode, form)

    const handleOperatorsUpdate = (entries) => {
        setForm({ ...form, operators_sent_to_help: entries })
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-2.5 items-start">
            <div className="flex flex-col gap-2.5 min-w-0">
                <OperatorsSentToHelp
                    entries={form?.operators_sent_to_help || []}
                    onUpdate={handleOperatorsUpdate}
                    weekIso={weekIso}
                    readOnly={false}
                    user={user}
                    plantCode={plantCode}
                    regionalPlants={propPlants}
                />
                <WeeklyTrendsSection
                    currentWeekIso={weekIso}
                    plantCode={plantCode || userPlantCode || ''}
                    user={{ ...user, plant_code: userPlantCode }}
                />
            </div>
            <div className="lg:sticky lg:top-3 self-start min-w-0">
                <MetricsSection
                    yph={propYph ?? yph}
                    yphGrade={propYphGrade ?? yphGrade}
                    yphLabel={propYphLabel ?? yphLabel}
                />
            </div>
        </div>
    )
}

/** Review-mode plugin — read-only view of help entries, trends, and metrics. */
export function PlantManagerReviewPlugin({
    yph,
    yphGrade,
    yphLabel,
    form,
    weekIso,
    user,
    assignedPlant,
    reportUserId: _reportUserId,
    plants: propPlants
}) {
    const plantCode = assignedPlant || user?.plant_code || form?.plant || ''
    const timelinePlantCode = form?.plant || assignedPlant || user?.plant_code || ''
    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-2.5 items-start">
            <div className="flex flex-col gap-2.5 min-w-0">
                <OperatorsSentToHelp
                    entries={form?.operators_sent_to_help || []}
                    onUpdate={() => {}}
                    weekIso={weekIso}
                    readOnly={true}
                    user={user}
                    plantCode={plantCode}
                    regionalPlants={propPlants}
                />
                <WeeklyTrendsSection
                    currentWeekIso={weekIso}
                    plantCode={timelinePlantCode || user?.plant_code || ''}
                    user={user}
                />
            </div>
            <div className="lg:sticky lg:top-3 self-start min-w-0">
                <MetricsSection yph={yph} yphGrade={yphGrade} yphLabel={yphLabel} />
            </div>
        </div>
    )
}
