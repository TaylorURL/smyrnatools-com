import React, { useEffect, useMemo, useRef, useState } from 'react'

import Skeleton, { SkeletonStack } from '../../../app/components/common/Skeleton'
import PlantManagersQuickEditModal from '../../../app/components/plants/PlantManagersQuickEditModal'
import TopSection from '../../../app/components/sections/TopSection'
import { PlantService } from '../../../services/PlantService'
import PlantsAddView from './PlantsAddView'
import PlantsDetailView from './PlantsDetailView'

/** Maps region types to human-readable plant type labels. */
const REGION_TYPE_TO_PLANT_TYPE = {
    Aggregate: 'Aggregate Location',
    Concrete: 'Concrete Plant',
    Office: 'Office Location'
}
const PLANT_TYPE_OPTIONS = ['Concrete Plant', 'Aggregate Location', 'Office Location']
const VIEW_MODE_STORAGE_KEY = 'plants_last_view_mode'

const getPlantCode = (plant) => plant?.plant_code || plant?.plantCode || ''
const getPlantName = (plant) => plant?.plant_name || plant?.plantName || ''
const getPlantManagerIds = (plant) => {
    const raw = plant?.manager_user_ids ?? plant?.managerUserIds
    return Array.isArray(raw) ? raw : []
}
const getPlantType = (region) => REGION_TYPE_TO_PLANT_TYPE[region?.type] || 'N/A'

/** Tailwind class + icon per plant type — used in both grid cards and list pills. */
const PLANT_TYPE_META = {
    'Aggregate Location': { badge: 'bg-amber-100 text-amber-700', icon: 'fa-mountain' },
    'Concrete Plant': { badge: 'bg-blue-100 text-blue-700', icon: 'fa-industry' },
    'Office Location': { badge: 'bg-purple-100 text-purple-700', icon: 'fa-building' }
}
const DEFAULT_TYPE_META = { badge: 'bg-slate-100 text-slate-600', icon: 'fa-map-marker-alt' }

/** Slim filter select — matches the FilterSelect atom inside TopSection so admin
 *  views read with the same rhythm as Mixers / Operators / AssetView. */
const FILTER_SELECT_CLS =
    'text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7 bg-bg-secondary border border-border-light text-text-primary'
const FILTER_SELECT_STYLE = { minWidth: 130 }

/** Grid card — matches AssetGridCard visual rhythm (header / body grid / footer). */
function PlantGridCard({ plant, region, plantType, managerCount, onSelect, onManageManagers }) {
    const meta = PLANT_TYPE_META[plantType] || DEFAULT_TYPE_META
    const code = getPlantCode(plant)
    const name = getPlantName(plant)
    return (
        <div
            className="flex flex-col overflow-hidden rounded border border-border-light bg-bg-primary shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => onSelect(code)}
        >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                <div className="w-10 h-10 rounded flex items-center justify-center text-white text-lg flex-shrink-0 bg-accent">
                    <i className={`fas ${meta.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-lg font-extrabold tracking-tight truncate text-text-primary">#{code}</div>
                    <div className="text-[11px] font-medium text-text-secondary truncate">{name || '—'}</div>
                </div>
                <span className={`inline-block rounded text-[11px] font-bold px-3 py-1.5 flex-shrink-0 ${meta.badge}`}>
                    {plantType}
                </span>
            </div>

            <div className="grid grid-cols-2">
                <div className="flex flex-col gap-0.5 px-5 py-3 border-r border-border-light">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Region</span>
                    <span className="text-[13px] font-semibold text-text-primary truncate">
                        {region?.regionName || 'N/A'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5 px-5 py-3">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                        Region Code
                    </span>
                    <span className="text-[13px] font-semibold text-text-primary truncate">
                        {region?.regionCode || '—'}
                    </span>
                </div>
            </div>

            <div className="flex border-t border-border-light">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        onManageManagers(plant)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-none bg-transparent text-[11px] font-semibold cursor-pointer transition-all text-text-secondary hover:bg-accent/10"
                    title="Attach or remove managers for this plant"
                >
                    <i className="fas fa-user-tie" />
                    {managerCount === 0 ? 'No managers' : `${managerCount} manager${managerCount === 1 ? '' : 's'}`}
                    <i className="fas fa-pen text-[9px] text-slate-400 ml-1" />
                </button>
            </div>
        </div>
    )
}

/**
 * List view for all plants. Builds a plant-to-region map on load to display
 * each plant's type (Concrete/Aggregate/Office). Supports grid/list toggle,
 * search by code/name, region filter, plant type filter, an inline
 * manager-edit modal triggered from each row/card, and drill-down into
 * PlantsDetailView for full edit.
 */
function PlantsView({ title = 'Plants' }) {
    const [plants, setPlants] = useState([])
    const [regions, setRegions] = useState([])
    const [plantRegionMap, setPlantRegionMap] = useState({})
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [selectedPlant, setSelectedPlant] = useState(null)
    const [managersEditPlant, setManagersEditPlant] = useState(null)
    const [selectedRegion, setSelectedRegion] = useState('')
    const [selectedPlantType, setSelectedPlantType] = useState('')
    const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_MODE_STORAGE_KEY) || 'grid')
    const headerRef = useRef(null)
    const handleViewModeChange = (next) => {
        setViewMode(next)
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, next)
    }
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            try {
                const [plantsData, regionsData] = await Promise.all([
                    PlantService.fetchPlants(),
                    PlantService.fetchRegions()
                ])
                setPlants(plantsData)
                setRegions(regionsData)
                const regionPlantsResults = await Promise.all(
                    regionsData.map((r) => PlantService.fetchRegionPlants(r.regionCode).catch(() => []))
                )
                const map = {}
                regionsData.forEach((region, index) => {
                    const plantsForRegion = regionPlantsResults[index] || []
                    plantsForRegion.forEach((p) => {
                        map[p.plantCode] = region
                    })
                })
                setPlantRegionMap(map)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])
    const handleSelectPlant = (plantCode) => setSelectedPlant(plants.find((p) => getPlantCode(p) === plantCode))
    const handlePlantAdded = (newPlant) => setPlants((prev) => [...prev, newPlant])
    const handlePlantDeleted = (plantCode) => {
        setPlants((prev) => prev.filter((p) => getPlantCode(p) !== plantCode))
        setSelectedPlant(null)
    }
    const handlePlantUpdated = async (plantCode) => {
        const updatedPlants = await PlantService.fetchPlants()
        setPlants(updatedPlants)
        setSelectedPlant(updatedPlants.find((p) => getPlantCode(p) === plantCode) || null)
    }
    /** Patches the local plants array with a new manager list for one plant
     *  so the row's count badge flips immediately when the modal saves. */
    const handleManagersSaved = (plantCode, managerIds) => {
        setPlants((prev) =>
            prev.map((p) => {
                if (getPlantCode(p) !== plantCode) return p
                return { ...p, managerUserIds: managerIds, manager_user_ids: managerIds }
            })
        )
    }
    const filteredPlants = useMemo(
        () =>
            plants.filter((plant) => {
                const normalizedSearch = searchText.trim().toLowerCase()
                const code = getPlantCode(plant)
                const name = getPlantName(plant)
                const searchMatch =
                    !normalizedSearch ||
                    name.toLowerCase().includes(normalizedSearch) ||
                    code.toLowerCase().includes(normalizedSearch)
                const region = plantRegionMap[code]
                const regionMatch =
                    !selectedRegion || selectedRegion === 'All Regions' || region?.regionCode === selectedRegion
                const plantType = getPlantType(region)
                const plantTypeMatch =
                    !selectedPlantType || selectedPlantType === 'All Types' || plantType === selectedPlantType
                return searchMatch && regionMatch && plantTypeMatch
            }),
        [plants, plantRegionMap, searchText, selectedRegion, selectedPlantType]
    )

    /** Pill row in TopSection — total + per-type breakdown, only counts plants with a known type. */
    const badge = useMemo(() => {
        const counts = { Aggregate: 0, Concrete: 0, Office: 0 }
        plants.forEach((plant) => {
            const region = plantRegionMap[getPlantCode(plant)]
            const type = region?.type
            if (type && counts[type] !== undefined) counts[type] += 1
        })
        return `${plants.length} Total · ${counts.Concrete} Concrete · ${counts.Aggregate} Aggregate · ${counts.Office} Office`
    }, [plants, plantRegionMap])

    const resetFilters = () => {
        setSearchText('')
        setSelectedRegion('')
        setSelectedPlantType('')
    }
    const customFilters = (
        <>
            <select
                className={FILTER_SELECT_CLS}
                style={FILTER_SELECT_STYLE}
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                aria-label="Region filter"
            >
                <option value="">All Regions</option>
                {regions.map((r) => (
                    <option key={r.regionCode} value={r.regionCode}>
                        {r.regionName}
                    </option>
                ))}
            </select>
            <select
                className={FILTER_SELECT_CLS}
                style={FILTER_SELECT_STYLE}
                value={selectedPlantType}
                onChange={(e) => setSelectedPlantType(e.target.value)}
                aria-label="Location type filter"
            >
                <option value="">All Location Types</option>
                {PLANT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                        {type}
                    </option>
                ))}
            </select>
        </>
    )
    if (selectedPlant) {
        return (
            <div className="min-h-screen bg-slate-50">
                <PlantsDetailView
                    plant={selectedPlant}
                    onClose={() => setSelectedPlant(null)}
                    onDelete={handlePlantDeleted}
                    onUpdate={handlePlantUpdated}
                />
            </div>
        )
    }
    return (
        <div className="min-h-screen bg-slate-50">
            <TopSection
                title={title}
                badge={badge}
                addButtonLabel="Add Plant"
                onAddClick={() => setShowAddSheet(true)}
                searchInput={searchText}
                onSearchInputChange={setSearchText}
                onClearSearch={() => setSearchText('')}
                searchPlaceholder="Search by plant name or code..."
                forwardedRef={headerRef}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                listLabels={['Plant Code', 'Name', 'Region', 'Type', 'Managers']}
                colWidths={['16%', '26%', '20%', '20%', '18%']}
                customFilters={customFilters}
                showReset={!!(searchText || selectedRegion || selectedPlantType)}
                onReset={resetFilters}
                hidePlantFilter={true}
            />
            <div className="px-4 lg:px-6 py-4 lg:py-6">
                {isLoading ? (
                    <PlantsLoadingState viewMode={viewMode} />
                ) : !filteredPlants.length ? (
                    <PlantsEmptyState hasSearch={!!searchText} onAddClick={() => setShowAddSheet(true)} />
                ) : viewMode === 'grid' ? (
                    <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
                    >
                        {filteredPlants.map((plant) => {
                            const code = getPlantCode(plant)
                            const region = plantRegionMap[code]
                            return (
                                <PlantGridCard
                                    key={code}
                                    plant={plant}
                                    region={region}
                                    plantType={getPlantType(region)}
                                    managerCount={getPlantManagerIds(plant).length}
                                    onSelect={handleSelectPlant}
                                    onManageManagers={setManagersEditPlant}
                                />
                            )
                        })}
                    </div>
                ) : (
                    <div className="bg-white border border-border-light rounded overflow-hidden">
                        <table className="w-full">
                            <tbody className="divide-y divide-slate-100">
                                {filteredPlants.map((plant, index) => {
                                    const code = getPlantCode(plant)
                                    const region = plantRegionMap[code]
                                    const plantType = getPlantType(region)
                                    const meta = PLANT_TYPE_META[plantType] || DEFAULT_TYPE_META
                                    const managerCount = getPlantManagerIds(plant).length
                                    return (
                                        <tr
                                            key={code}
                                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                            onClick={() => handleSelectPlant(code)}
                                        >
                                            <td className="px-5 py-4 text-sm font-bold text-accent">{code}</td>
                                            <td className="px-5 py-4 text-sm font-medium text-slate-800">
                                                {getPlantName(plant)}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {region?.regionName || 'N/A'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.badge}`}
                                                >
                                                    <i className={`fas ${meta.icon} text-[10px]`} />
                                                    {plantType}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        setManagersEditPlant(plant)
                                                    }}
                                                    className="inline-flex items-center gap-2 rounded-full border border-border-light bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:border-accent"
                                                    title="Attach or remove managers for this plant"
                                                >
                                                    <i className="fas fa-user-tie text-[10px] text-accent" />
                                                    <span>
                                                        {managerCount === 0
                                                            ? 'No managers'
                                                            : `${managerCount} manager${managerCount === 1 ? '' : 's'}`}
                                                    </span>
                                                    <i className="fas fa-pen text-[9px] text-slate-400" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {showAddSheet && <PlantsAddView onClose={() => setShowAddSheet(false)} onPlantAdded={handlePlantAdded} />}
            {managersEditPlant && (
                <PlantManagersQuickEditModal
                    plant={managersEditPlant}
                    onClose={() => setManagersEditPlant(null)}
                    onSaved={(persistedIds) => handleManagersSaved(getPlantCode(managersEditPlant), persistedIds)}
                />
            )}
        </div>
    )
}

/** Skeleton placeholder matching either grid or list view. */
function PlantsLoadingState({ viewMode }) {
    if (viewMode === 'grid') {
        return (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                <SkeletonStack count={8} gapClassName="hidden">
                    {() => (
                        <div className="rounded border border-border-light bg-white p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <Skeleton className="w-10 h-10" rounded="rounded" />
                                <div className="flex-1">
                                    <Skeleton className="h-4 w-20 mb-1.5" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <Skeleton className="h-6 w-24" rounded="rounded-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                            </div>
                        </div>
                    )}
                </SkeletonStack>
            </div>
        )
    }
    return (
        <div className="bg-white border border-border-light rounded overflow-hidden">
            <SkeletonStack count={8} gapClassName="gap-0">
                {() => (
                    <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-b-0">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-20" rounded="rounded-full" />
                        <Skeleton className="h-5 w-24" rounded="rounded-full" />
                    </div>
                )}
            </SkeletonStack>
        </div>
    )
}

/** Empty / no-results placeholder. */
function PlantsEmptyState({ hasSearch, onAddClick }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white border border-border-light rounded">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-industry text-3xl text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Plants Found</h3>
            <p className="text-slate-500 mb-6 max-w-md">
                {hasSearch ? 'No plants match your search criteria.' : 'There are no plants in the system yet.'}
            </p>
            <button
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
                onClick={onAddClick}
            >
                Add Plant
            </button>
        </div>
    )
}

export default PlantsView
