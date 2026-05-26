/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import HelpBreakdownTable from '../../../../app/components/plan/tabs/statistics/HelpBreakdownTable'
import { usePreferences } from '../../../../app/context/PreferencesContext'
import { useDistrictHelpBreakdown, useWeeklyYardageByPlant } from '../../../../app/hooks/useDistrictManagerData'
import { filterMaintenanceItemsByPlant, useAllowedPlantCodes } from '../../../../app/hooks/useReportData'
import { PlantService } from '../../../../services/PlantService'
import { getDistrictPlantCodes, getDistrictsForPlantCode } from '../../../../utils/DistrictUtility'
import {
    CARD_STYLE,
    CardHeader,
    DistrictYardageRail,
    MaintenanceItemsTable,
    StatPill
} from './weekly-dm/DistrictManagerComponents'

const WEEKDAYS = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' }
]

function DailyRecapSection({ form, handleChange, readOnly }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-clipboard-list"
                label="Recap"
                title="Daily Activity Recaps"
                sub="Activities, meetings, issues, and accomplishments per day."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {WEEKDAYS.map((day) => {
                    const value = form[day.key] ?? ''
                    return (
                        <div
                            key={day.key}
                            className="rounded p-2.5 flex flex-col gap-1.5 bg-bg-secondary border border-border-light"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <i className="fas fa-calendar-day text-[10px] text-text-tertiary" />
                                    <span className="text-[11.5px] font-semibold text-text-primary">{day.label}</span>
                                    {!readOnly && <span className="text-text-primary">*</span>}
                                </div>
                                <span className="text-[10px] tabular-nums text-text-tertiary">{value.length}</span>
                            </div>
                            <textarea
                                value={value}
                                onChange={(e) => handleChange(e, day.key)}
                                placeholder={readOnly ? '—' : `Notes for ${day.label.toLowerCase()}…`}
                                required={!readOnly}
                                disabled={readOnly}
                                rows={5}
                                aria-label={`${day.label} notes`}
                                className="w-full rounded px-2 py-1.5 text-[12px] outline-none resize-y min-h-[88px] disabled:opacity-90 disabled:cursor-not-allowed bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function DistrictManagerPlugin({
    form,
    maintenanceItems,
    plants,
    readOnly,
    setForm,
    user,
    userPlantCode: userPlantCodeProp,
    weekIso
}) {
    const { preferences } = usePreferences()
    const regionCode = preferences?.selectedRegion?.code || ''
    const allowedCodes = useAllowedPlantCodes(regionCode, PlantService)
    const filteredItems = filterMaintenanceItemsByPlant(maintenanceItems, plants, allowedCodes)
    const completedCount = filteredItems.length
    const overdueCount = filteredItems.filter((item) => item.isOverdue).length

    /* District plant scope — derived from the user's home plant + region
     * plant memberships (each plant carries a `districts` list). Falls back
     * to all region-allowed plants when district info isn't available so the
     * rail still shows something useful. */
    const userPlantCode = userPlantCodeProp || user?.plant_code || user?.plantCode || ''
    const [regionPlants, setRegionPlants] = useState([])
    useEffect(() => {
        let cancelled = false
        if (!regionCode) {
            setRegionPlants([])
            return undefined
        }
        PlantService.fetchRegionPlants(regionCode).then((rows) => {
            if (!cancelled) setRegionPlants(rows || [])
        })
        return () => {
            cancelled = true
        }
    }, [regionCode])
    const districtPlantCodes = useMemo(() => {
        if (!userPlantCode || regionPlants.length === 0) return []
        const codes = getDistrictPlantCodes(userPlantCode, regionPlants)
        return codes.length ? codes.sort() : []
    }, [userPlantCode, regionPlants])
    const districtNames = useMemo(
        () => (userPlantCode && regionPlants.length ? getDistrictsForPlantCode(userPlantCode, regionPlants) : []),
        [userPlantCode, regionPlants]
    )
    const yardageScopeCodes = useMemo(() => {
        if (districtPlantCodes.length > 0) return districtPlantCodes
        return Array.isArray(allowedCodes) ? allowedCodes : []
    }, [districtPlantCodes, allowedCodes])
    const { loading: yardageLoading, yardageByPlant } = useWeeklyYardageByPlant(weekIso, yardageScopeCodes)

    /* Same Mon–Sat scope as the yardage rail above; reuses the help-stats
     * pipeline from the Statistics tab so the table reads identically to
     * Plan → Statistics → Help & Cross-Loading, just trimmed to the DM's
     * district plants. */
    const {
        colocationMap: helpColocationMap,
        helpByGiverPlant,
        loading: helpLoading,
        plantNameByCode: helpPlantNameByCode,
        range: helpRange
    } = useDistrictHelpBreakdown({
        districtPlantCodes: yardageScopeCodes,
        plants: regionPlants.length > 0 ? regionPlants : plants,
        weekIso
    })

    const handleChange = (e, name) => {
        if (setForm) setForm((prev) => ({ ...prev, [name]: e.target.value }))
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-2.5 items-start">
            <div className="flex flex-col gap-2.5 min-w-0">
                <DailyRecapSection form={form} handleChange={handleChange} readOnly={readOnly} />

                <div className="rounded p-3" style={CARD_STYLE}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                        <CardHeader
                            icon="fa-screwdriver-wrench"
                            label="Maintenance"
                            title="Weekly Completed Items"
                            sub="Maintenance items closed during this reporting week."
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <StatPill icon="fa-circle-check" label="Completed" value={completedCount} />
                            {overdueCount > 0 && (
                                <StatPill icon="fa-triangle-exclamation" label="Were Overdue" value={overdueCount} />
                            )}
                        </div>
                    </div>
                    <MaintenanceItemsTable items={filteredItems} plants={plants} />
                </div>

                <div className="rounded p-3" style={CARD_STYLE}>
                    <CardHeader
                        icon="fa-arrows-turn-to-dots"
                        label="Help & Cross-Loading"
                        title="Help breakdown by plant"
                        sub="How each plant in the district contributed planned operators and cross-loaded yardage during the week."
                    />
                    {helpLoading && helpByGiverPlant.length === 0 ? (
                        <div className="rounded p-6 text-center flex flex-col items-center gap-1.5" style={CARD_STYLE}>
                            <i className="fas fa-spinner fa-spin text-[18px] text-text-tertiary" />
                            <p className="text-[12px] m-0 text-text-secondary">Loading help breakdown…</p>
                        </div>
                    ) : helpByGiverPlant.length === 0 ? (
                        <div className="rounded p-6 text-center flex flex-col items-center gap-1.5" style={CARD_STYLE}>
                            <i className="fas fa-arrows-turn-to-dots text-[18px] text-text-tertiary" />
                            <p className="text-[12px] m-0 text-text-secondary">
                                No district plants found for this report.
                            </p>
                        </div>
                    ) : (
                        <HelpBreakdownTable
                            accentColor="var(--text-secondary)"
                            colocationMap={helpColocationMap}
                            crossLoadColor="#16a34a"
                            deadheadColor="#2563eb"
                            helpByGiverPlant={helpByGiverPlant}
                            plantNameByCode={helpPlantNameByCode}
                            range={helpRange.current}
                        />
                    )}
                </div>
            </div>

            <div className="lg:sticky lg:top-3 self-start min-w-0">
                <DistrictYardageRail
                    districtNames={districtNames}
                    loading={yardageLoading}
                    plants={plants}
                    weekIso={weekIso}
                    yardageByPlant={yardageByPlant}
                />
            </div>
        </div>
    )
}

/** Submit-mode wrapper for the District Manager report plugin. */
export function DistrictManagerSubmitPlugin(props) {
    return <DistrictManagerPlugin {...props} />
}

/** Review-mode wrapper for the District Manager report plugin (read-only). */
export function DistrictManagerReviewPlugin({ form, maintenanceItems, plants, user, weekIso }) {
    return (
        <DistrictManagerPlugin
            form={form}
            maintenanceItems={maintenanceItems}
            plants={plants}
            readOnly
            user={user}
            weekIso={weekIso}
        />
    )
}
