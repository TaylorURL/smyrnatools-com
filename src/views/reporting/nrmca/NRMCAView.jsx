/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ReportsActionBar } from '../../../app/components/reports/ReportsToolbar'
import TopSection from '../../../app/components/sections/TopSection'
import { Stat as SharedStat, StatGroup } from '../../../app/components/ui/Panel'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { NRMCAService } from '../../../services/NRMCAService'
import { PlantService } from '../../../services/PlantService'
import { getCalibrationStatus, getRenewalStatus } from './parts/nrmcaHelpers'
import { NRMCASkeleton } from './parts/NRMCASkeleton'
import { PlantCard } from './parts/PlantCard'
import { PlantFormModal } from './parts/PlantFormModal'

export default function NRMCAView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const headerRef = useRef(null)

    const [plants, setPlants] = useState([])
    const [scales, setScales] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [regionPlants, setRegionPlants] = useState([])
    /* `regionReady` is false until `fetchRegionPlants` has resolved at
     * least once for the active region code. It gates `loadData()` so
     * the NRMCA fetches never fire with a null / stale plant-code set —
     * which would have caused the service to return the entire fleet
     * and leak the other region's calibrations on first paint. */
    const [regionReady, setRegionReady] = useState(false)
    const [addPlantModal, setAddPlantModal] = useState(false)
    const [tab, setTab] = useState('all')

    const regionCode = preferences.selectedRegion?.code

    const regionPlantCodes = useMemo(() => {
        if (!regionCode || !regionPlants.length) return null
        return new Set(
            regionPlants
                .map((p) =>
                    String(p.plantCode ?? p.plant_code ?? '')
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
    }, [regionCode, regionPlants])

    const loadData = useCallback(
        async ({ background = false } = {}) => {
            if (background) setRefreshing(true)
            else setLoading(true)
            try {
                const [fetchedPlants, fetchedScales] = await Promise.all([
                    NRMCAService.fetchPlants(regionPlantCodes),
                    NRMCAService.fetchScales(regionPlantCodes)
                ])
                setPlants(fetchedPlants)
                setScales(fetchedScales)
            } catch {
                // stays empty; UI shows empty state
            } finally {
                if (background) setRefreshing(false)
                else setLoading(false)
            }
        },
        [regionPlantCodes]
    )

    useEffect(() => {
        // Reset readiness on every region change so the skeleton holds
        // through the swap instead of briefly rendering the previous
        // region's data while the new region's plants are in flight.
        setRegionReady(false)
        if (regionCode) {
            PlantService.fetchRegionPlants(regionCode)
                .then((p) => {
                    setRegionPlants(p)
                    setRegionReady(true)
                })
                .catch(() => {
                    setRegionPlants([])
                    setRegionReady(true)
                })
        } else {
            setRegionPlants([])
            setRegionReady(true)
        }
    }, [regionCode])

    useEffect(() => {
        if (!regionReady) return
        loadData()
    }, [loadData, regionReady])

    const expiredPlantCount = useMemo(
        () => plants.filter((p) => getRenewalStatus(p.renewal_expires_at) === 'expired').length,
        [plants]
    )
    const expiringPlantCount = useMemo(
        () => plants.filter((p) => getRenewalStatus(p.renewal_expires_at) === 'expiring').length,
        [plants]
    )
    const overdueScaleCount = useMemo(
        () =>
            scales.filter((s) => getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'overdue')
                .length,
        [scales]
    )
    const dueSoonScaleCount = useMemo(
        () =>
            scales.filter((s) => getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'due_soon')
                .length,
        [scales]
    )
    const issueCount = expiredPlantCount + overdueScaleCount

    const badge = useMemo(() => {
        if (loading || !plants.length) return null
        const parts = [`${plants.length} Plants`, `${scales.length} Scales`]
        if (expiredPlantCount > 0) parts.push(`${expiredPlantCount} Expired`)
        if (overdueScaleCount > 0) parts.push(`${overdueScaleCount} Overdue`)
        return parts.join(' · ')
    }, [loading, plants.length, scales.length, expiredPlantCount, overdueScaleCount])

    const visiblePlants = useMemo(() => {
        if (tab !== 'issues') return plants
        return plants.filter((plant) => {
            if (getRenewalStatus(plant.renewal_expires_at) === 'expired') return true
            return scales.some(
                (s) =>
                    s.nrmca_plant_id === plant.id &&
                    getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'overdue'
            )
        })
    }, [plants, scales, tab])

    const visibleScales = useMemo(() => {
        if (tab !== 'issues') return scales
        return scales.filter((s) => getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'overdue')
    }, [scales, tab])

    const tabs = useMemo(
        () => [
            { icon: 'fa-list', key: 'all', label: 'All' },
            {
                icon: 'fa-triangle-exclamation',
                key: 'issues',
                label: issueCount > 0 ? `Issues · ${issueCount}` : 'Issues'
            }
        ],
        [issueCount]
    )

    return (
        <div className="min-h-screen w-full pb-16 bg-bg-secondary">
            <TopSection
                title="Calibrations & Certifications"
                forwardedRef={headerRef}
                sticky
                isLoading={loading}
                badge={badge}
                hidePlantFilter
                hideViewModeToggle
                hideSearchBar
            />
            <ReportsActionBar
                tabs={tabs}
                activeTab={tab}
                onTabChange={setTab}
                isRefreshing={refreshing}
                onRefresh={() => loadData({ background: true })}
                rightChildren={
                    <button
                        type="button"
                        onClick={() => setAddPlantModal(true)}
                        className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer text-white"
                        style={{ background: accentColor }}
                    >
                        <i className="fas fa-plus text-[10px]" />
                        <span className="hidden sm:inline">Add Plant</span>
                    </button>
                }
            />

            <div className="w-full px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">
                <StatGroup columns={4}>
                    <SharedStat
                        label="Plants"
                        value={plants.length}
                        hint={
                            expiringPlantCount > 0
                                ? `${expiringPlantCount} expiring soon`
                                : plants.length > 0
                                  ? 'All current'
                                  : 'None tracked'
                        }
                    />
                    <SharedStat
                        label="Scales"
                        value={scales.length}
                        hint={
                            dueSoonScaleCount > 0
                                ? `${dueSoonScaleCount} due soon`
                                : scales.length > 0
                                  ? 'All current'
                                  : 'None tracked'
                        }
                    />
                    <SharedStat
                        label="Expired Certs"
                        value={expiredPlantCount}
                        hint={expiredPlantCount === 0 ? 'No action needed' : 'Renew now'}
                    />
                    <SharedStat
                        label="Overdue Calibrations"
                        value={overdueScaleCount}
                        hint={overdueScaleCount === 0 ? 'No action needed' : 'Schedule today'}
                    />
                </StatGroup>

                {loading ? (
                    <NRMCASkeleton />
                ) : plants.length === 0 ? (
                    <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-text-tertiary">
                            <i className="fas fa-certificate text-2xl mb-2" />
                            <div className="text-[12px]">
                                No plants defined yet — add one to start tracking certifications and calibrations.
                            </div>
                        </div>
                    </div>
                ) : visiblePlants.length === 0 ? (
                    <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-text-tertiary">
                            <i className="fas fa-circle-check text-2xl mb-2" />
                            <div className="text-[12px]">No expired certifications or overdue calibrations.</div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {visiblePlants.map((plant) => (
                            <PlantCard
                                key={plant.id}
                                plant={plant}
                                scales={visibleScales}
                                allPlants={plants}
                                regionPlants={regionPlants}
                                onReload={loadData}
                                accentColor={accentColor}
                            />
                        ))}
                    </div>
                )}
            </div>

            {addPlantModal && (
                <PlantFormModal
                    regionPlants={regionPlants}
                    onClose={() => setAddPlantModal(false)}
                    onSaved={() => {
                        setAddPlantModal(false)
                        loadData()
                    }}
                />
            )}
        </div>
    )
}
